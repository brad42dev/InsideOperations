# Inside/Operations - Symbol Recognition

## Overview

Symbol Recognition enables I/O to automatically detect and classify symbols in imported P&ID (Piping and Instrumentation Diagram) images and DCS (Distributed Control System) graphics. This capability lives in I/O's production environment and consumes pre-trained ONNX models produced by [SymBA](../../SymBA/design-docs/00_PROJECT_OVERVIEW.md), a separate companion application for ML training and gamified annotation.

**What I/O does:**
- Loads `.iomodel` packages (P&ID and DCS domains)
- Runs inference on imported P&ID images and DCS graphics
- Presents detected symbols for human review and collects correction feedback
- Imports `.iogap` variation gap reports for symbol library gap analysis

**What I/O does NOT do:** Train models, annotate training data, or run gamification games. That is SymBA's job.

### Integration Boundary

```
SymBA (separate app)              I/O (this app)
========================          ========================
Trains models             ─────► Consumes models
Exports .iomodel          ─────► Imports .iomodel
                          ◄───── Exports .iofeedback
Ingests feedback                  Collects corrections
Exports .iogap            ─────► Imports gap reports
```

The canonical specification for `.iomodel`, `.iofeedback`, and `.iogap` formats lives in [SymBA 17_IO_INTEGRATION.md](../../SymBA/design-docs/17_IO_INTEGRATION.md). This document covers I/O's implementation of the consuming side.

### Recognition vs Direct Import

Recognition is a **fallback** path for creating I/O graphics. The preferred path is direct import of native DCS graphics files (vendor-specific formats). Recognition handles the cases where native files aren't available:

- **Preferred**: Import proprietary DCS graphics files directly → full fidelity with point bindings, layout, and interactivity
- **Fallback (P&ID)**: Scan/screenshot of P&ID → SymBA recognition → human review → generated graphic with point binding placeholders
- **Fallback (DCS)**: Screenshot, PDF, or standalone SVG of DCS console → SymBA recognition → human review → generated graphic

Both paths coexist. Recognition supplements direct import; it doesn't replace it.

## Recognition Service

### Architecture

Symbol Recognition is implemented as a dedicated **Recognition Service** running on port 3010. This allows GPU-intensive inference to run independently without blocking the API Gateway. The API Gateway proxies `/api/recognition/*` requests to the Recognition Service.

```
Recognition Service (Port 3010)
├── Recognition handlers (/api/recognition/*)
│   ├── Inference endpoint (auto-routes by model_domain)
│   ├── Model management endpoints
│   ├── Feedback endpoints
│   └── Gap report endpoints
└── ModelManager
    ├── P&ID Domain
    │   ├── Arc<RwLock<Arc<ort::Session>>>   (FCOS FP16 or FP32)
    │   └── Arc<RwLock<ModelMetadata>>
    ├── DCS Domain
    │   ├── Arc<RwLock<Arc<ort::Session>>>   (FCOS FP16 or FP32)
    │   └── Arc<RwLock<ModelMetadata>>
    └── Model selection: FP16 if CUDA available, FP32 otherwise
```

### Model Loading

On startup, the Recognition Service checks the configured model directory for `.iomodel` files. If found, it loads the most recent version per domain:

```rust
// Simplified model loading — dual domain, single model per domain
pub struct DomainSlot {
    session: Arc<RwLock<Arc<ort::Session>>>,  // FCOS FP16 (GPU) or FP32 (CPU)
    metadata: Arc<RwLock<ModelMetadata>>,
    class_map: Arc<HashMap<i64, String>>,     // class ID → class name
    preprocessing: Arc<PreprocessingConfig>,   // from preprocessing.json
}

pub struct ModelManager {
    pid_domain: Option<DomainSlot>,   // P&ID: single FCOS model
    dcs_domain: Option<DomainSlot>,   // DCS: single FCOS model (same architecture, different classes)
    model_dir: PathBuf,
}

impl ModelManager {
    /// Load a .iomodel package. Called at startup and on hot-swap.
    /// Reads model_domain from manifest.json and loads into the appropriate domain slot.
    pub fn load(&self, path: &Path) -> Result<(), ModelError> {
        // 1. Unzip .iomodel to temp directory
        // 2. Parse manifest.json, validate format_version
        // 3. Read model_domain ("pid" or "dcs") from manifest
        // 4. Load preprocessing.json and class_map.json
        // 5. Select model file: prefer FP16 if CUDA available, else FP32
        // 6. Create single ort::Session for the selected model file
        // 6a. Swap into the domain-specific DomainSlot
        // 7. Old sessions drop when last reference is released
        // 8. Other domain is unaffected
        Ok(())
    }
}
```

Both P&ID and DCS models can be loaded simultaneously. Each domain operates independently — loading a DCS model does not affect the P&ID model and vice versa.

### Hot-Swap

Models can be updated without restarting the Recognition Service. Hot-swap is **domain-specific**: swapping a DCS model does not affect the P&ID model and vice versa.

1. Admin drops a new `.iomodel` file into the model directory (or uploads via Settings UI)
2. Recognition Service detects the new file (filesystem watcher or manual trigger via API)
3. `model_domain` is read from the manifest to determine which domain slot to update
4. New `ort::Session` instances are created from the new ONNX files
5. Inner `Arc` is swapped via `RwLock` write lock on the target domain only
6. In-flight requests using the old `Arc<Session>` complete normally
7. Old sessions are dropped when the last reference is released

Zero downtime. No request failures during swap. The other domain continues operating uninterrupted.

### .iomodel Package Structure

Each `.iomodel` package is a ZIP archive produced by SymBA containing a single detection model with metadata:

```
<model>_v<version>.iomodel (ZIP archive)
├── manifest.json              (metadata)
├── model.onnx                 (primary ONNX model, FP32)
├── model_fp16.onnx            (FP16 variant for GPU, optional)
├── class_map.json             (category ID to name mapping)
├── preprocessing.json         (image preprocessing config)
└── eval_report.json           (evaluation metrics)
```

Both P&ID and DCS packages use the same structure. The `model_domain` field in `manifest.json` distinguishes them (`"pid"` or `"dcs"`). The Recognition Service selects `model_fp16.onnx` when CUDA is available, otherwise `model.onnx` (FP32).

**manifest.json:**

```json
{
  "format_version": "1.1",
  "model_name": "pid_fcos",
  "model_version": "1.0.0",
  "model_domain": "pid",
  "architecture": "fcos_resnet50_fpn",
  "num_classes": 20,
  "image_size": 640,
  "quantization": "fp32",
  "created_at": "2026-03-10T...",
  "mlflow_run_id": "...",
  "training_dataset": "merged_v1",
  "training_epochs": 30,
  "best_map50": 0.866,
  "onnx_opset": 17,
  "model_hash": "sha256:abc123...",
  "model_hashes": {
    "model.onnx": "sha256:abc123...",
    "model_fp16.onnx": "sha256:def456..."
  },
  "per_class_ap": {
    "valve": 0.92,
    "pump": 0.89,
    "tank": 0.85
  },
  "models": [
    {"name": "fcos", "file": "model.onnx"},
    {"name": "fcos_fp16", "file": "model_fp16.onnx"}
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format_version` | string | Yes | Package format version. Currently `"1.1"`. I/O warns if missing (backwards compat with older packages). |
| `model_hash` | string | Yes | `sha256:<hex>` digest of the primary `model.onnx`. I/O verifies on load — reject if mismatch. |
| `model_hashes` | object | Yes | Map of `filename → sha256:<hex>` for every ONNX file. Verify each file on load. |
| `per_class_ap` | object | Optional | Map of `class_name → AP@0.50` from SymBA's evaluation. Empty if no eval report generated. Surfaced in Settings > Recognition. |

**Integrity verification on load:** When loading a `.iomodel` package, the Recognition Service MUST compute the SHA-256 digest of each ONNX file and compare against `model_hashes`. On mismatch: log an error, reject the package, and surface the error in Settings > Recognition. Old packages without `model_hash` fields load with a warning ("model integrity not verified — pre-1.1 package").

The `models` array lists all ONNX files in the package. Currently each package contains one architecture (FCOS) in FP32 and optionally FP16. DCS packages use the same single-model structure — SymBA confirmed that DCS `.iomodel` packages contain equipment detection only (no OCR models). OCR is I/O's responsibility.

### P&ID Inference Pipeline

```
Input Image (PNG/PDF scan)
        │
        ▼
┌─────────────────┐
│ 1. Preprocess    │  Resize to 640x640, normalize (ImageNet mean/std),
│    (from         │  letterbox pad (value 114). Parameters loaded from
│     preprocessing│  preprocessing.json in .iomodel package.
│     .json)       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. Detect        │  Run FCOS (primary) or RetinaNet (secondary)
│    Symbols       │  FP16 on GPU (Tensor Core accelerated), FP32 on CPU
│                  │  Output: [batch, 300, 4] boxes + [batch, 300] scores
│                  │  + [batch, 300] class IDs. Filter by score threshold (0.5).
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. Post-Process  │  Map class IDs to symbol names via class_map.json
│                  │  (20 ISA 5.1 classes). Group related detections
│                  │  (valve + actuator = control valve).
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. Present       │  Show detected symbols overlaid on original image
│    Results       │  User reviews, accepts, corrects, or rejects each detection
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. Generate      │  Map accepted symbols to I/O graphics templates
│    Graphics      │  Create SVG elements with point binding placeholders
└─────────────────┘
```

### P&ID Classes (20 ISA 5.1)

| ID | Class Name | Category |
|----|-----------|----------|
| 0 | valve_gate | Valve |
| 1 | valve_globe | Valve |
| 2 | valve_ball | Valve |
| 3 | valve_butterfly | Valve |
| 4 | valve_check | Valve |
| 5 | valve_control | Valve |
| 6 | pump_centrifugal | Pump |
| 7 | pump_positive_displacement | Pump |
| 8 | compressor | Rotating Equipment |
| 9 | heat_exchanger | Heat Transfer |
| 10 | vessel_vertical | Vessel |
| 11 | vessel_horizontal | Vessel |
| 12 | tank_storage | Vessel |
| 13 | instrument_indicator | Instrument |
| 14 | instrument_transmitter | Instrument |
| 15 | instrument_controller | Instrument |
| 16 | reducer | Piping Component |
| 17 | tee | Piping Component |
| 18 | elbow | Piping Component |
| 19 | flange | Piping Component |

### Output Tensor Format

All models output fixed-size tensors (padded with zeros; filter by score threshold):

| Tensor | Shape | Format |
|--------|-------|--------|
| Boxes | `[batch_size, 300, 4]` | Top 300 detections, `[x, y, w, h]` |
| Scores | `[batch_size, 300]` | Confidence 0.0–1.0 |
| Labels | `[batch_size, 300]` | Class IDs (0–19), int64 |

Default score threshold: 0.5 (configurable per-request via API).

### DCS Inference Pipeline

DCS recognition uses the same single-model detection architecture as P&ID but trained on DCS-specific equipment classes. The `model_domain` field in the manifest distinguishes them. Both produce bounding boxes + class IDs + confidence scores via the same fixed-size output tensor format.

```
Input Image (DCS screenshot/export)
        │
        ▼
┌─────────────────┐
│ 1. Preprocess    │  Resize, normalize, pad per preprocessing.json
│                  │  Same contract as P&ID but may have different parameters
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. Detect        │  Run FCOS (primary) or RetinaNet (secondary)
│    Equipment     │  Same architecture as P&ID, trained on DCS classes
│                  │  Output: bounding boxes + class IDs + confidence scores
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. Post-Process  │  Map class IDs to DCS equipment names via class_map.json
│                  │  Confidence filtering, score threshold
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. Present       │  Show detected equipment overlaid on original image
│    Results       │  User reviews, accepts, corrects, or rejects each detection
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. Generate      │  Map equipment to DCS SVG templates (ISA-101 HMI style)
│    Graphics      │  Include state bindings (CSS class-based), text bindings
└─────────────────┘
```

> **DCS class map (27 classes):** The DCS model targets 27 fine-grained equipment types. Class indices 0–26 are stable: valve_gate(0), valve_globe(1), valve_ball(2), valve_butterfly(3), valve_control(4), valve_relief(5), pump_centrifugal(6), pump_positive_displacement(7), compressor(8), heat_exchanger_shell_tube(9), heat_exchanger_plate(10), vessel_vertical(11), vessel_horizontal(12), tank_storage(13), reactor(14), column_distillation(15), filter(16), mixer(17), fan_blower(18), motor(19), indicator_pressure(20), indicator_temperature(21), indicator_flow(22), indicator_level(23), controller(24), alarm_annunciator(25), interlock(26). Most classes map 1:1 to SVG shape filenames in the shape library (Doc 35, 25 Tier 1 shapes). Instrument classes 20–24 are many-to-one: all map to the single generic `instrument` shape with different designation text (P, T, F, L, C).
>
> **OCR ownership:** DCS `.iomodel` packages contain equipment detection only — no text detection or OCR models. OCR is I/O's responsibility (see Doc 34 DCS Graphics Import for the OCR pipeline).
>
> **Note:** SymBA currently has ~2,725 DCS images but zero annotations. The DCS model is not production-ready yet. Once I/O provides shape SVGs (Doc 35), SymBA can generate synthetic training data to bootstrap the model.

### Domain Auto-Detection

When a user uploads an image for recognition, the system determines which pipeline to use:

1. If a `model_domain` is specified in the request, use that pipeline
2. If both P&ID and DCS models are loaded, run the image through a lightweight classifier (or use heuristics based on image characteristics) to determine the domain
3. If only one domain model is loaded, use that pipeline
4. The user can always override the auto-detected domain in the review step

### Hardware Detection

The Recognition Service auto-detects available hardware and selects the appropriate model(s) per domain:

| Hardware | Model Used | Expected Performance |
|----------|-----------|---------------------|
| NVIDIA GPU (CUDA) | FCOS FP16 (Tensor Core accelerated) | P&ID: ~100-200ms/image, DCS: similar |
| CPU only | FCOS FP32 or RetinaNet FP32 | P&ID: ~1-3s/image, DCS: similar |
| No model loaded | Disabled | Recognition features hidden per domain |

Detection uses the `ort` crate's execution provider selection:

```rust
let session = ort::Session::builder()?
    .with_execution_providers([
        ort::CUDAExecutionProvider::default().build(),
        ort::CPUExecutionProvider::default().build(),
    ])?
    .commit_from_file(model_path)?;
```

## Designer Module Integration

Symbol Recognition integrates with the [Designer Module](09_DESIGNER_MODULE.md) through an **Import Wizard** that supports both P&ID and DCS image sources:

### Import Wizard Flow

1. **Upload**: User uploads an image (PNG, JPEG, PDF, TIFF) via Designer
2. **Domain Selection**: System auto-detects domain (P&ID or DCS) or user selects explicitly
3. **Detect**: Recognition Service runs the appropriate inference pipeline, returns detected symbols
4. **Review**: User sees the original image with detections overlaid
   - **P&ID**: bounding boxes around symbols with class + confidence
   - **DCS**: equipment bounding boxes with class + confidence (same presentation as P&ID)
   - Color coding: green (high confidence > 0.90), yellow (medium 0.70-0.90), red (low < 0.70)
   - User can: accept (checkmark), reject (X), or correct (change class via dropdown)
   - User can switch domain if auto-detection was wrong
5. **Map**: Accepted detections are mapped to I/O's SVG template library
   - Each symbol/equipment class has a corresponding SVG template (ISA-101 HMI style)
   - DCS equipment templates include state binding definitions (alarm, open/closed via CSS classes)
   - If no template exists for a class, mark as "unmapped" for manual handling
6. **Generate**: I/O creates an SVG graphic with:
   - Detected symbols/equipment placed at their bounding box positions
   - Point binding placeholders (tag numbers mapped to symbol locations)
   - DCS: state bindings (CSS class-based) attached to equipment templates
   - P&ID: connection lines preserved from the original image (future: topology detection)
7. **Refine**: User opens the generated graphic in Designer for manual refinement

### Permission

The import wizard requires the `designer:import` permission (already exists). No new permissions are needed for recognition specifically -- it is a capability within the existing import workflow.

## Model Management UI

Model management is exposed in the [Settings Module](15_SETTINGS_MODULE.md) under a new **Recognition** section, accessible to Admin users:

### Settings > Recognition

- **Domain Tabs**: P&ID | DCS -- each domain shows its own model info independently
- **Current Model** (per domain): display model version, training date, class count, mAP summary, model_domain
- **Import Model**: file upload for `.iomodel` packages, with validation (manifest check, ONNX load test). Domain auto-detected from manifest.json `model_domain` field
- **Model History** (per domain): table of previously loaded models (version, domain, loaded date, replaced date)
- **Feedback Configuration**:
  - Toggle: Enable/disable correction feedback collection (global)
  - Toggle: Include anonymized symbol crops in feedback (Layer 2)
  - Export: Generate `.iofeedback` package from collected corrections (filterable by domain)
  - Stats: total inferences, total corrections, correction rate, top confused classes (filterable by domain)
- **Variation Gap Reports**:
  - Import: file upload for `.iogap` packages
  - Report list: previously imported gap reports with coverage summary
  - Browse: drill into per-equipment-type coverage and variation thumbnails
  - See [Variation Gap Reports (.iogap)](#variation-gap-reports-iogap) below

### API Endpoints

All recognition endpoints are served by the Recognition Service (Port 3010). The API Gateway proxies `/api/recognition/*` requests to the Recognition Service, so clients use the same base URL.

**Recognition:**

```
POST   /api/recognition/detect
       Body: multipart/form-data { image: File, options?: { confidence_threshold?: number, domain?: "pid" | "dcs" | "auto" } }
       "auto" (default) auto-detects domain from image characteristics
       Response: { domain: "pid" | "dcs", detections: [{ bbox: [x,y,w,h], class_id: number, class_name: string, confidence: number }], ocr_results: [...], line_results?: [...] }

GET    /api/recognition/classes
       Query: ?domain=pid|dcs (optional, returns all if omitted)
       Response: { classes: [{ id: number, name: string, display_name: string, domain: string, template_available: boolean }] }

GET    /api/recognition/status
       Response: { domains: { pid: { model_loaded: boolean, hardware: string, mode: "gpu" | "cpu" | "disabled" }, dcs: { model_loaded: boolean, hardware: string, mode: "gpu" | "cpu" | "disabled" } } }

POST   /api/recognition/generate
       Body: { detections: [{ class_id, class_name, bbox, tag_number? }], domain: "pid" | "dcs", source_image_hash: string }
       Response: { graphic_id: UUID, unmapped_count: number }
```

**Model Management (Admin):**

```
GET    /api/recognition/model
       Query: ?domain=pid|dcs (optional, returns all domains if omitted)
       Response: { models: [{ domain: string, loaded: boolean, version: string, classes: number, mAP: number, loaded_at: string }] }

POST   /api/recognition/model
       Body: multipart/form-data { model: File (.iomodel) }
       Domain auto-detected from manifest.json model_domain field
       Response: { domain: string, version: string, classes: number, validation: { passed: boolean, details: string } }

GET    /api/recognition/model/history
       Query: ?domain=pid|dcs (optional)
       Response: { models: [{ version: string, domain: string, loaded_at: string, replaced_at: string }] }

DELETE /api/recognition/model
       Query: ?domain=pid|dcs (required)
       Response: { unloaded: boolean, domain: string, previous_version: string }
```

**Feedback:**

```
GET    /api/recognition/feedback/stats
       Query: ?domain=pid|dcs (optional, returns aggregate if omitted)
       Response: { total_inferences: number, total_corrections: number, correction_rate: number, top_confused: [...] }

POST   /api/recognition/feedback/export
       Query: ?domain=pid|dcs (optional, exports all if omitted)
       Response: binary (.iofeedback file download)

POST   /api/recognition/feedback/corrections
       Body: { image_hash: string, domain: "pid" | "dcs", detections: [{ original: {...}, corrected: {...} }] }
       Response: { correction_id: string }

DELETE /api/recognition/feedback
       Query: ?domain=pid|dcs (optional, clears all if omitted)
       Response: { cleared_count: number }
```

**Gap Reports:**

```
POST   /api/recognition/gap-reports
       Body: multipart/form-data { report: File (.iogap) }
       Response: { report_id: string, coverage: number, equipment_types: number, variations_found: number }

GET    /api/recognition/gap-reports
       Response: { reports: [{ id: string, imported_at: string, coverage: number, equipment_types: number, recommendations_count: number }] }

GET    /api/recognition/gap-reports/:id
       Response: { full gap report data with per-equipment variations }

DELETE /api/recognition/gap-reports/:id
       Response: { deleted: boolean }
```

## Feedback Collection

When a user reviews recognition results in the Designer import wizard, every correction is logged:

### Correction Types

**Common (P&ID and DCS):**

| Correction | Type Value | What Happened | Data Captured |
|-----------|-----------|---------------|---------------|
| Reclassify | `reclassify` | User changed detected class from X to Y | original class, corrected class, bbox, confidence |
| False positive | `false_positive` | User rejected a false positive | bbox, original class, marked as false positive |
| Missed detection | `missed_detection` | User added a missed symbol (false negative) | bbox, class, marked as missed detection |
| Bbox adjust | `bbox_adjust` | User resized/repositioned bounding box | original bbox, corrected bbox, class |

**DCS-specific:**

| Correction | Type Value | What Happened | Data Captured |
|-----------|-----------|---------------|---------------|
| State misclassification | `state_misclassification` | Model detected equipment but got state wrong (open vs closed, alarm vs normal) | original state, corrected state, equipment bbox |
| Line misclassification | `line_misclassification` | Line type was wrong (process line classified as signal line, etc.) | original line type, corrected type, line segment coordinates |

### Storage

Corrections are stored in a new database table:

```sql
CREATE TABLE recognition_correction (
    correction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash      VARCHAR(64) NOT NULL,       -- SHA-256 of source image
    correction_type VARCHAR(30) NOT NULL,        -- 'reclassify', 'false_positive', 'missed_detection', 'bbox_adjust',
                                                 -- 'state_misclassification', 'line_misclassification'
    original_data   JSONB,                       -- original detection
    corrected_data  JSONB NOT NULL,              -- corrected annotation
    model_version   VARCHAR(20) NOT NULL,        -- domain inferred from model_version's manifest
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_model ON recognition_correction(model_version);
CREATE INDEX idx_correction_created ON recognition_correction(created_at);
```

The correction domain (P&ID or DCS) is inferred from the `model_version` field, which maps to a loaded model's manifest containing `model_domain`. No separate `correction_domain` column is needed since the model version uniquely identifies the domain.

### .iofeedback Export

When the admin clicks "Export Feedback" in Settings, I/O generates a `.iofeedback` ZIP package matching SymBA's expected format:

```
<deployment_id>_<timestamp>.iofeedback (ZIP)
├── corrections.json            (JSON array of corrections)
├── metadata.json               (source deployment info)
└── crops/                      (optional symbol crop images, if Layer 2 enabled)
    ├── crop_001.jpg
    └── ...
```

**corrections.json** (JSON array, NOT JSONL):

```json
[
  {
    "crop_file": "crop_001.jpg",
    "class": "valve_globe",
    "correct_class": "valve_gate",
    "bbox": [100, 50, 150, 120],
    "confidence": 0.72,
    "deployment_id": "io_prod_001",
    "timestamp": "2026-03-10T12:30:45Z"
  }
]
```

**metadata.json:**

```json
{
  "deployment_id": "io_prod_001",
  "deployment_region": "Plant A",
  "total_crops": 1200,
  "unique_crops": 1150,
  "timestamp": "2026-03-10T12:30:45Z",
  "io_version": "2.1.0",
  "model_version": "1.0.0"
}
```

This file is manually transferred to SymBA's Node 1 (`C:\Users\brad\symba\feedback\incoming\`) for ingestion into the training pipeline. Future: automated pull.

## Variation Gap Reports (.iogap)

SymBA's variation tracking system produces `.iogap` packages containing symbol variation analysis and gap recommendations. I/O consumes these reports to identify where the SVG template library needs expansion.

### Import Flow

1. Admin imports `.iogap` file via Settings > Recognition > Variation Gap Reports
2. I/O parses the gap summary and per-equipment variation files
3. Results displayed in a browsable report:
   - Overall coverage percentage
   - Per-equipment-type coverage with bar charts
   - Variation thumbnails showing unmatched symbol appearances
   - Priority-ranked recommendations for new template creation
4. Gap report data is stored in the `settings` table (key: `recognition_gap_reports`) as JSONB
5. Reports are reference data only -- they do not affect recognition inference

### Integration with Template Library

Gap reports link to the template mapping in Settings > Recognition. When a gap report identifies an unmatched variation, the admin can:

1. **Create a new template** in Designer matching the variation
2. **Map an existing template** to cover the variation
3. **Flag the variation** for SymBA to collect more training data (included in next `.iofeedback` export as a gap flag)

Coverage trend is tracked across successive gap report imports, showing whether template library expansion is keeping pace with recognized variation diversity.

## Database Changes

### New Table

One new table: `recognition_correction` (defined above).

### Schema Domain

Add to the "Recognition" domain in [04_DATABASE_DESIGN.md](04_DATABASE_DESIGN.md):

| Table | Purpose |
|-------|---------|
| `recognition_correction` | Stores user corrections to model predictions for feedback export |

### Model Storage

`.iomodel` files are stored on the filesystem, not in the database. Organized by domain:

```
/opt/io/models/
├── current/
│   ├── pid/
│   │   └── model_pid_v1.2.0.iomodel
│   └── dcs/
│       └── model_dcs_v1.0.0.iomodel
├── archive/
│   ├── pid/
│   │   ├── model_pid_v1.1.0.iomodel
│   │   └── model_pid_v1.0.0.iomodel
│   └── dcs/
│       └── (previous DCS models)
├── incoming/
│   └── (new .iomodel files dropped here for hot-swap; domain auto-detected from manifest)
└── gap-reports/
    └── (imported .iogap files)
```

The `settings` table stores the path to the current model per domain and whether recognition is enabled per domain.

## Technology

### New Crate

| Crate | Version | License | Purpose |
|-------|---------|---------|---------|
| `ort` | 2.x | MIT/Apache-2.0 | ONNX Runtime bindings for Rust |

The `ort` crate provides:
- ONNX model loading and inference
- CUDA execution provider for GPU inference
- CPU execution provider fallback
- Session management with thread-safe `Arc` sharing

### Existing Crates Reused

| Crate | Already In | Purpose for Recognition |
|-------|-----------|------------------------|
| `axum` | Recognition Service | Recognition endpoints |
| `sqlx` | Recognition Service | Correction storage |
| `serde_json` | Recognition Service | Model manifest parsing |
| `uuid` | Recognition Service | Correction IDs |
| `sha2` | Recognition Service | Image hashing for deduplication |
| `zip` | Export System | .iomodel/.iofeedback unpacking |
| `image` | Parser Service | Image preprocessing |

## Graceful Degradation

Symbol Recognition is entirely optional and degrades per domain independently:

**No models loaded (neither P&ID nor DCS):**
- Recognition API endpoints return `503 Service Unavailable` with message "No recognition model loaded"
- Designer Module hides the import wizard recognition options entirely
- Settings > Recognition section shows "No models loaded. Import a .iomodel file to enable symbol recognition."

**One domain loaded (e.g., P&ID loaded, DCS not loaded):**
- The loaded domain works normally
- The unloaded domain's features are hidden in the UI (no DCS option in import wizard domain selector)
- API calls specifying the unloaded domain return `503` with message indicating which domain is unavailable
- Domain auto-detection only routes to the loaded domain

**Both domains loaded:**
- Full functionality. Domain auto-detection active. User can select either domain.

All other I/O functionality is unaffected regardless of recognition state. I/O can ship and deploy without any SymBA dependency. Recognition activates only when model(s) are provided.

## User Stories

1. **As an engineer**, I want to import a scanned P&ID and have symbols automatically detected so I can create a digital process graphic faster than manual tracing.

2. **As an engineer**, I want to review and correct auto-detected symbols so the final graphic is accurate.

3. **As an admin**, I want to import a new recognition model without restarting I/O so users experience zero downtime.

4. **As an admin**, I want to export correction feedback so the SymBA team can improve the model with our real-world data.

5. **As an admin**, I want to see recognition accuracy statistics so I know whether a model update actually improved things.

6. **As a designer**, I want auto-detected symbols to be placed as editable SVG elements in the Designer so I can refine the graphic with normal Designer tools.

7. **As an engineer**, I want to import a DCS graphics screenshot and have equipment, lines, and text automatically detected so I can recreate the DCS display digitally.

8. **As an admin**, I want to import SymBA's variation gap report so I can see which DCS symbol templates need to be added to improve recognition-to-display mapping.

9. **As a designer**, I want auto-detected DCS equipment to include state bindings (alarm, open/closed) so the generated graphic is immediately functional.

## Success Criteria

**P&ID:**
- [ ] `.iomodel` packages load correctly on startup and via hot-swap
- [ ] Inference runs on FCOS FP16 (GPU) and FCOS FP32 (CPU)
- [ ] Designer import wizard shows detected symbols with confidence scores
- [ ] Users can accept, reject, and correct detections
- [ ] Corrections are stored and exportable as `.iofeedback` (JSON array format matching SymBA spec)
- [ ] Recognition features are completely hidden when no model is loaded
- [ ] Model swap causes zero dropped requests

**DCS:**
- [ ] DCS single-model inference produces detection results comparable to P&ID
- [ ] DCS `.iomodel` packages with `model_domain: "dcs"` load correctly alongside P&ID models
- [ ] `.iogap` reports importable and browsable in Settings > Recognition
- [ ] DCS corrections include `state_misclassification` and `line_misclassification` types
- [ ] Domain auto-detection routes images to correct pipeline
- [ ] Domain-specific hot-swap does not affect the other domain
- [ ] Per-domain graceful degradation hides only the unavailable domain's features
- [ ] ModelManager handles future multi-model DCS packages based on manifest `models` field

## Integration Points

| Document | Integration |
|----------|------------|
| [02_SYSTEM_ARCHITECTURE](02_SYSTEM_ARCHITECTURE.md) | Recognition Service (dedicated service, port 3010) |
| [04_DATABASE_DESIGN](04_DATABASE_DESIGN.md) | `recognition_correction` table |
| [09_DESIGNER_MODULE](09_DESIGNER_MODULE.md) | P&ID and DCS import wizard |
| [15_SETTINGS_MODULE](15_SETTINGS_MODULE.md) | Recognition settings section (per-domain models, gap reports) |
| [19_GRAPHICS_SYSTEM](19_GRAPHICS_SYSTEM.md) | SVG template library for recognized symbols (P&ID and DCS) |
| [21_API_DESIGN](21_API_DESIGN.md) | `/api/recognition/*` endpoints (including gap reports) |
| [22_DEPLOYMENT_GUIDE](22_DEPLOYMENT_GUIDE.md) | Model directory (per-domain), `ort` CUDA setup |
| [01_TECHNOLOGY_STACK](01_TECHNOLOGY_STACK.md) | `ort` crate addition |
| [05_DEVELOPMENT_PHASES](05_DEVELOPMENT_PHASES.md) | Recognition integration phase |
| [SymBA 17_IO_INTEGRATION](../../SymBA/design-docs/17_IO_INTEGRATION.md) | Canonical .iomodel/.iofeedback/.iogap format spec |

## Late v1 Enhancements (Post-SymBA Integration)

The following features are built late in the v1 cycle, after the core SymBA import pipeline is functional and models can be tested end-to-end. These are essential for validating that SymBA's models actually work in production.

- **Automated model pull**: I/O periodically checks a configured SymBA server for model updates, downloads new `.iomodel` packages, validates integrity, and hot-swaps the running model. Eliminates manual upload workflow.
- **Topology detection**: Line tracing and connectivity extraction from P&ID scans. Requires SymBA line detection models. Outputs pipe routing and equipment connectivity for use in graphic generation.
- **Batch import**: Process multiple P&ID sheets or DCS screenshots in a queue. Upload a set of images, queue them for sequential processing, review results per-image. Essential for real-world use where a single P&ID set may be 50+ sheets.
- **Confidence auto-accept**: Automatically accept detections above a configurable confidence threshold without requiring human review. Threshold per-class (some symbols are more reliably detected than others). Dramatically reduces manual review burden for high-quality models.
- **Symbol template auto-generation**: When a detection is high-confidence and matches no existing template, generate a candidate SVG template from the detected region. Admin reviews and approves before it enters the shape library. Accelerates template library buildout.
- **DCS state detection**: Automatic state classification (alarm, open/closed, running/stopped) from color/fill analysis of detected equipment regions in DCS screenshots. Maps detected states to I/O CSS state classes.
- **Symbol variation learning**: When users create new templates for unmatched variations, feed the mapping back to SymBA via `.iofeedback` packages for improved recognition in future model versions.

**Still deferred:**
- **DCS multi-model pipeline**: When SymBA produces multi-model DCS packages (equipment + line + text), expand DCS inference to run all models and merge results. Depends on SymBA model maturity.

## Change Log

- **v0.7**: Promoted 7 future enhancements to late v1 build: automated model pull, topology detection, batch import, confidence auto-accept, symbol template auto-generation, DCS state detection, symbol variation learning. All gated on core SymBA import pipeline being functional. DCS multi-model pipeline remains deferred (depends on SymBA model maturity).
- **v0.6**: Updated .iomodel manifest spec with format_version 1.1, model_hash (SHA-256 integrity verification), model_hashes (per-file), per_class_ap (per-class AP@0.50 from SymBA evaluation). Added integrity verification requirement on load with reject-on-mismatch. Backwards compat: old packages without hash fields load with warning. DCS class map confirmed at 27 fine-grained classes (indices 0–26) aligned 1:1 with shape library (Doc 35). OCR ownership confirmed: DCS .iomodel = equipment detection only, OCR is I/O's responsibility. DCS data status: ~2,725 images, zero annotations, model not production-ready. Per SymBA handoff commit cba68d2.
- **v0.5**: Reconciled with SymBA actual implementation. Replaced speculative RF-DETR/YOLOX with actual FCOS/RetinaNet architectures. Simplified DCS from multi-model to single-model pipeline (matching SymBA's current output). Updated .iomodel package structure, manifest schema, and .iofeedback format to match SymBA's actual formats. Added 20 ISA 5.1 P&ID classes. Added "Recognition vs Direct Import" framing section. Updated output tensor format, hardware detection table, and success criteria.
- **v0.4**: Updated architecture from API Gateway module to dedicated Recognition Service (port 3010), aligning with docs 02, 05, and 22. Updated architecture diagram, model loading, hot-swap, and API endpoint sections. Updated model directory structure to match doc 22 deployment layout (top-level current/archive/incoming/gap-reports). Updated Existing Crates Reused table to reference Recognition Service. Updated Integration Points table.
- **v0.3**: Expanded from P&ID-only to dual-domain recognition (P&ID + DCS). Renamed document title from "P&ID Recognition" to "Symbol Recognition". Added DCS multi-model inference pipeline (equipment detector + line classifier + text detector + text classifier). Added domain auto-detection. Updated ModelManager for per-domain model sessions with independent hot-swap. Added DCS-specific correction types (`state_misclassification`, `line_misclassification`). Added `.iogap` variation gap report consumption (import flow, template library integration, gap report API endpoints). Updated hardware detection table for dual-domain performance estimates. Expanded Designer import wizard for DCS (state bindings, line topology, domain selection). Updated all API endpoints with domain query parameter support. Per-domain graceful degradation. Added DCS user stories (7-9) and DCS success criteria. Updated integration points for `.iogap`. Added DCS future enhancements (state detection, variation learning). See SymBA 17_IO_INTEGRATION.md for canonical format specs.
- **v0.2**: Fixed FK reference from `app_user(user_id)` to `users(id)` in `recognition_correction` DDL. Updated correction_type values to match SymBA canonical values: `reclassify`, `false_positive`, `missed_detection`, `bbox_adjust`. Fixed table name `app_settings` → `settings`. Changed .iofeedback crop format from `.webp` to `.png` per SymBA 17 spec. Added 4 missing API endpoints: `GET /api/recognition/status`, `POST /api/recognition/generate`, `DELETE /api/recognition/model`, `DELETE /api/recognition/feedback`.
- **v0.1**: Initial document creation
