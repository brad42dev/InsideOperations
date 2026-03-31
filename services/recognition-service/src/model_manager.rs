use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

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
/// The `session` field uses a double-Arc pattern for wait-free hot-swap:
/// the outer `Arc<RwLock<...>>` is shared across threads; the inner
/// `Option<Arc<ort::session::Session>>` is swapped atomically by acquiring
/// only a write lock for the pointer exchange (milliseconds), not for the
/// entire inference duration.  In-flight requests hold a clone of the
/// inner Arc and complete naturally even after a swap.
///
/// `session` is `None` inside the lock until an ONNX session is wired up
/// in Phase 2.  The surrounding `Arc<RwLock<...>>` is always present from
/// construction so that `swap_domain()` can be called at any time.
#[derive(Debug)]
pub struct DomainSlot {
    /// Hot-swap ONNX session handle.
    ///
    /// Outer `Arc<RwLock<...>>` — shared handle to the lock.
    /// Inner `Option<Arc<ort::session::Session>>` — the current session pointer.
    ///
    /// To perform a hot-swap:
    ///   1. Acquire write lock on the outer RwLock.
    ///   2. Replace the inner Option with `Some(new_arc)`.
    ///   3. Release the write lock — the old Arc is dropped when its last
    ///      in-flight clone is released.
    ///
    /// To read during inference:
    ///   1. Acquire read lock on the outer RwLock.
    ///   2. Clone the inner `Option<Arc<...>>`.
    ///   3. Release the read lock immediately — hold only the cloned Arc.
    pub session: Arc<RwLock<Option<Arc<ort::session::Session>>>>,
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
    ///
    /// The session lock is initialised with `None`; call `swap_domain()` on the
    /// owning `ModelManager` to install an ONNX session (Phase 2).
    pub fn from_model_info(info: &ModelInfo) -> Self {
        let metadata = ModelMetadata::from(info);
        Self {
            session: Arc::new(RwLock::new(None)),
            metadata: Arc::new(RwLock::new(metadata)),
            class_map: Arc::new(HashMap::new()),
            preprocessing: Arc::new(PreprocessingConfig::default()),
        }
    }

    /// Returns `true` if an active ONNX session is installed in this slot.
    ///
    /// This acquires a brief read lock to inspect the inner Option.
    pub async fn is_active(&self) -> bool {
        self.session.read().await.is_some()
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

    /// Atomically swap the ONNX session for the named domain.
    #[allow(dead_code)]
    ///
    /// This is the hot-swap operation:
    /// 1. Resolve the target `DomainSlot` (pid or dcs only — the other domain
    ///    is never touched).
    /// 2. Acquire a write lock on `DomainSlot.session` — this is held only
    ///    for the pointer exchange, not for inference.
    /// 3. Replace the inner `Option<Arc<ort::session::Session>>` with the new
    ///    session.
    /// 4. Release the write lock — callers holding a prior clone of the inner
    ///    Arc complete their in-flight requests naturally; the old session drops
    ///    when the last such clone is released.
    ///
    /// Returns `Err` if `domain` is not `"pid"` or `"dcs"`, or if the domain
    /// slot has not been initialised yet (i.e. no model is loaded for that
    /// domain).
    pub async fn swap_domain(
        &self,
        domain: &str,
        new_session: Arc<ort::session::Session>,
    ) -> anyhow::Result<()> {
        let slot = match domain {
            "pid" => self.pid_domain.as_ref(),
            "dcs" => self.dcs_domain.as_ref(),
            other => {
                return Err(anyhow::anyhow!(
                    "swap_domain: unknown domain '{}' — must be 'pid' or 'dcs'",
                    other
                ));
            }
        };
        let slot = slot.ok_or_else(|| {
            anyhow::anyhow!(
                "swap_domain: no slot initialised for domain '{}' — call load() first",
                domain
            )
        })?;

        // Write lock is held only for the pointer swap — sub-millisecond.
        *slot.session.write().await = Some(new_session);

        tracing::info!(domain = %domain, "Hot-swapped ONNX session for domain");
        Ok(())
    }

    /// Retrieve a cloned handle to the current session for the named domain,
    /// suitable for use in inference without holding the write lock.
    ///
    /// Acquires a read lock, clones the inner `Arc`, then releases the lock
    /// immediately.  In-flight requests hold only the cloned Arc — a
    /// concurrent `swap_domain()` write-lock can proceed without waiting.
    ///
    /// Returns `None` if no slot exists for the domain or no session has been
    /// installed yet.
    pub async fn session_for_domain(&self, domain: &str) -> Option<Arc<ort::session::Session>> {
        let slot = match domain {
            "pid" => self.pid_domain.as_ref(),
            "dcs" => self.dcs_domain.as_ref(),
            _ => return None,
        }?;
        // Acquire read lock, clone inner Arc, release lock before returning.
        slot.session.read().await.clone()
    }

    /// Returns `true` if the named domain has an active (session-bearing) slot.
    #[allow(dead_code)]
    pub async fn domain_is_loaded(&self, domain: &str) -> bool {
        match domain {
            "pid" => match &self.pid_domain {
                Some(s) => s.is_active().await,
                None => false,
            },
            "dcs" => match &self.dcs_domain {
                Some(s) => s.is_active().await,
                None => false,
            },
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
        loaded: slot.is_active().await,
        uploaded_at: meta.uploaded_at,
        file_size_bytes: meta.file_size_bytes,
    }
}
