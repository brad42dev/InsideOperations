use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

use crate::ModelInfo;

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/// Metadata extracted from an .iomodel manifest + upload context.
#[derive(Debug, Clone)]
pub struct ModelMetadata {
    pub id: String,
    pub domain: String,
    pub version: String,
    pub filename: String,
    pub class_count: i32,
    pub uploaded_at: DateTime<Utc>,
    pub file_size_bytes: i64,
}

impl From<&ModelInfo> for ModelMetadata {
    fn from(m: &ModelInfo) -> Self {
        Self {
            id: m.id.clone(),
            domain: m.domain.clone(),
            version: m.version.clone(),
            filename: m.filename.clone(),
            class_count: m.class_count,
            uploaded_at: m.uploaded_at,
            file_size_bytes: m.file_size_bytes,
        }
    }
}

/// Preprocessing parameters for normalizing images before inference.
/// Values are stubs — real calibration comes from the .iomodel manifest in Phase 2.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PreprocessingConfig {
    /// Target width fed into the ONNX model (pixels).
    pub input_width: u32,
    /// Target height fed into the ONNX model (pixels).
    pub input_height: u32,
    /// Per-channel mean subtracted during normalization (R, G, B).
    pub mean: [f32; 3],
    /// Per-channel std divisor during normalization (R, G, B).
    pub std: [f32; 3],
}

impl Default for PreprocessingConfig {
    fn default() -> Self {
        Self {
            input_width: 640,
            input_height: 640,
            mean: [0.485, 0.456, 0.406],
            std: [0.229, 0.224, 0.225],
        }
    }
}

// ---------------------------------------------------------------------------
// DomainSlot
// ---------------------------------------------------------------------------

/// Holds everything needed to run inference for a single recognition domain
/// (P&ID or DCS).
///
/// The `session` field is `Option` because session creation is deferred to
/// Phase 2 — uploading a model populates metadata and class_map immediately,
/// but the ONNX runtime session is only constructed when `activate()` is
/// called (not yet implemented).
#[derive(Debug)]
pub struct DomainSlot {
    /// Live ONNX session. `None` until `activate()` is called in Phase 2.
    pub session: Option<Arc<RwLock<Arc<ort::session::Session>>>>,
    /// Metadata derived from the loaded .iomodel manifest.
    pub metadata: Arc<RwLock<ModelMetadata>>,
    /// Maps ONNX class index → human-readable class label.
    #[allow(dead_code)]
    pub class_map: Arc<HashMap<i64, String>>,
    /// Image pre-processing parameters for this model.
    #[allow(dead_code)]
    pub preprocessing: Arc<PreprocessingConfig>,
}

impl DomainSlot {
    /// Construct a slot from a `ModelInfo` record.
    /// `session` is always `None` at construction; call `activate()` to load
    /// the ONNX runtime session (Phase 2).
    pub fn from_model_info(info: &ModelInfo) -> Self {
        let metadata = ModelMetadata::from(info);
        Self {
            session: None,
            metadata: Arc::new(RwLock::new(metadata)),
            class_map: Arc::new(HashMap::new()),
            preprocessing: Arc::new(PreprocessingConfig::default()),
        }
    }

    /// Returns `true` if an active ONNX session is present.
    pub fn is_active(&self) -> bool {
        self.session.is_some()
    }
}

// ---------------------------------------------------------------------------
// ModelManager
// ---------------------------------------------------------------------------

/// Manages two independent recognition domains (P&ID and DCS).
///
/// Each domain occupies exactly one `DomainSlot`. Loading a model for one
/// domain never touches the other domain's slot.
#[derive(Debug)]
pub struct ModelManager {
    /// Slot for the P&ID recognition model. `None` until a P&ID model is
    /// uploaded.
    pub pid_domain: Option<DomainSlot>,
    /// Slot for the DCS recognition model. `None` until a DCS model is
    /// uploaded.
    pub dcs_domain: Option<DomainSlot>,
    /// Directory where .iomodel packages are stored on disk.
    #[allow(dead_code)]
    pub model_dir: PathBuf,
}

impl ModelManager {
    /// Create an empty `ModelManager` pointing at the given model directory.
    pub fn new(model_dir: impl Into<PathBuf>) -> Self {
        Self {
            pid_domain: None,
            dcs_domain: None,
            model_dir: model_dir.into(),
        }
    }

    /// Register an uploaded model in the appropriate domain slot.
    ///
    /// This is a metadata-only operation — the ONNX session is NOT created
    /// here (Phase 2). Any previously loaded model for the same domain is
    /// replaced.
    ///
    /// Returns an error if `domain` is not `"pid"` or `"dcs"`.
    pub fn load(&mut self, domain: &str, info: &ModelInfo) -> anyhow::Result<()> {
        let slot = DomainSlot::from_model_info(info);
        match domain {
            "pid" => {
                tracing::info!(
                    model_id = %info.id,
                    version  = %info.version,
                    "Loaded P&ID model into pid_domain slot"
                );
                self.pid_domain = Some(slot);
            }
            "dcs" => {
                tracing::info!(
                    model_id = %info.id,
                    version  = %info.version,
                    "Loaded DCS model into dcs_domain slot"
                );
                self.dcs_domain = Some(slot);
            }
            other => {
                return Err(anyhow::anyhow!(
                    "Unknown domain '{}' — must be 'pid' or 'dcs'",
                    other
                ));
            }
        }
        Ok(())
    }

    /// Return a flat list of `ModelInfo` snapshots for both loaded domains.
    /// Used by `list_models()` and `get_model()` handlers.
    pub async fn all_models(&self) -> Vec<ModelInfo> {
        let mut out = Vec::new();
        if let Some(slot) = &self.pid_domain {
            out.push(model_info_from_slot(slot).await);
        }
        if let Some(slot) = &self.dcs_domain {
            out.push(model_info_from_slot(slot).await);
        }
        out
    }

    /// Find a model by ID across both domain slots.
    pub async fn find_by_id(&self, id: &str) -> Option<ModelInfo> {
        for slot in [self.pid_domain.as_ref(), self.dcs_domain.as_ref()]
            .into_iter()
            .flatten()
        {
            let info = model_info_from_slot(slot).await;
            if info.id == id {
                return Some(info);
            }
        }
        None
    }

    /// Remove the model with the given ID from whichever domain slot holds it.
    /// Returns `true` if a model was removed, `false` if no match was found.
    pub async fn remove_by_id(&mut self, id: &str) -> bool {
        if let Some(slot) = &self.pid_domain {
            let meta = slot.metadata.read().await;
            if meta.id == id {
                drop(meta);
                self.pid_domain = None;
                return true;
            }
        }
        if let Some(slot) = &self.dcs_domain {
            let meta = slot.metadata.read().await;
            if meta.id == id {
                drop(meta);
                self.dcs_domain = None;
                return true;
            }
        }
        false
    }

    /// Returns `true` if the named domain has an active (session-bearing) slot.
    #[allow(dead_code)]
    pub fn domain_is_loaded(&self, domain: &str) -> bool {
        match domain {
            "pid" => self.pid_domain.as_ref().map_or(false, |s| s.is_active()),
            "dcs" => self.dcs_domain.as_ref().map_or(false, |s| s.is_active()),
            _ => false,
        }
    }

    /// Returns `true` if the named domain has a slot (metadata loaded, session
    /// may or may not be present — stub-friendly check).
    pub fn domain_has_model(&self, domain: &str) -> bool {
        match domain {
            "pid" => self.pid_domain.is_some(),
            "dcs" => self.dcs_domain.is_some(),
            _ => false,
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Reconstruct a `ModelInfo` snapshot from a `DomainSlot`.
async fn model_info_from_slot(slot: &DomainSlot) -> ModelInfo {
    let meta = slot.metadata.read().await;
    ModelInfo {
        id: meta.id.clone(),
        domain: meta.domain.clone(),
        version: meta.version.clone(),
        filename: meta.filename.clone(),
        class_count: meta.class_count,
        loaded: slot.is_active(),
        uploaded_at: meta.uploaded_at,
        file_size_bytes: meta.file_size_bytes,
    }
}
