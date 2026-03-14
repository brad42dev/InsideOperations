# Inside/Operations - Log Module

## Overview

Digital operational log book with rich text editing, structured templates, shift-based scheduling, and mobile support. Logs follow a template/segment/instance model where administrators define templates from reusable segments, instances are generated on schedule, and operators fill them out during their shift.

## WYSIWYG Editor

**Tiptap** (MIT, built on ProseMirror). Selected for MIT licensing compatibility (TinyMCE and CKEditor have licensing concerns).

- Rich text formatting (bold, italic, underline, strikethrough)
- Fonts and colors
- Bulleted and numbered lists
- Tables
- Images (inline)
- Paste from Microsoft Office/Google Docs (preserve formatting)
- Undo/redo
- HTML sanitization on backend (XSS prevention)
- Auto-save drafts every 30 seconds

## Template/Segment/Instance Model

### Log Segments (Reusable Building Blocks)

Segments are the atomic building blocks of log templates. Each segment is one of:

| Segment Type | Description |
|---|---|
| **WYSIWYG text block** | Free-form rich text (Tiptap editor). Operator types narrative entries. |
| **Table of fields** | Structured form with labeled rows — field name, field type, value. For consistent data collection. |
| **List of fields** | Simpler key/value entries. Lighter-weight than table of fields. |
| **Point data section** | Auto-populated with live or snapshot OPC point values. Can be read-only or allow operator annotations. |

Segments can combine multiple types. A single segment might have a WYSIWYG intro, a table of readings, and a point data snapshot.

### Log Templates

Assembled from an ordered list of segments. Created by administrators or supervisors. Templates define:

- Which segments, in what order
- Which fields are required vs optional
- Default values or pre-populated content
- Which shift/team the template is for

### Log Instances

Generated from templates on a schedule. Each instance is a concrete occurrence that operators fill out.

- Auto-created based on schedule configuration
- Pre-populated with template structure and any default values
- Point data sections snapshot live values at creation time (and can refresh)
- Status: `draft` → `in_progress` → `submitted` → `reviewed`

## Scheduling

Log instances are generated automatically based on schedule configuration:

- **Per shift**: One log instance per shift (e.g., day shift log, night shift log)
- **By time window**: Every 6 hours, once per day, custom interval
- **Multiple logs per shift by team**: Different templates for different teams on the same shift (e.g., logistics log, utilities log — same shift, different crews)

## Operator Workflow

1. Log instance appears for their shift/time window
2. Fill out segments:
   - Type narrative in WYSIWYG sections
   - Enter values in field tables and lists
   - Review and annotate point data snapshots
3. **Every entry is tagged by the user who enters it** — multiple operators can contribute to the same log instance, each entry attributed
4. Save progress, come back later within the schedule window
5. Submit when complete

## Shift Integration (doc 30)

- Log instances are auto-tagged with the active shift
- **Auto badge-in entries**: When a manager adds someone to a shift, a badge-in entry is auto-created in the shift log (configurable per template — can be turned off)
- **Shift handover**: Logs from the outgoing shift are visible to the incoming shift for continuity
- Shift metadata (shift name, start/end times, crew) embedded in log instance

## Attachments

- Photo upload (equipment condition)
- Video upload (procedures)
- Audio recording (voice notes)
- File size limits (10 MB per file)
- Stored on server filesystem, referenced by file_path in database

## Search

- **Full-text search** across all log entry content — powered by `tsvector`/GIN index (doc 04 schema)
- Filter by date, author, shift, tags, template
- **Attachment text extraction (OCR)**: image attachments (photo, screenshot) are processed on upload to extract visible text

### Attachment OCR

When an image is attached to a log entry (or a round response — see doc 14), text is extracted and made searchable:

**v1 — Printed Text (Tesseract, Apache 2.0):**
- Runs async after media upload — does not block the save operation
- Tesseract processes the image and stores extracted text in `extracted_text` column on `log_media` (and `round_media`)
- Extracted text is included in the full-text search scope (tsvector/GIN) — searching for "V-1001" finds log entries where someone photographed the V-1001 nameplate
- Best for: equipment labels, HMI screenshots, typed/printed forms, safety signage
- If no text is detected, `extracted_text` stays NULL — no harm done
- System dependency: `tesseract-ocr` package installed via `install_baseline.sh`
- Rust binding: `tesseract-rs` (Apache 2.0)

**Post-v1 — Handwritten Text (ONNX HTR model, flagged for future):**

Architecture is in place for a handwritten text recognition (HTR) upgrade path using a transformer-based model (e.g., TrOCR, MIT license) exported to ONNX:

- Same `ort` crate already used by the Recognition Service (doc 26)
- Two-pass pipeline: Tesseract first (fast, CPU-only). If Tesseract confidence is low and text-like regions are detected, run the HTR ONNX model as a second pass.
- HTR models are large (200-400MB) and benefit from GPU acceleration. Commercial installations targeting handwriting OCR should include GPU in hardware requirements (see doc 22).
- Model management: HTR model packaged and deployed via the same mechanism as recognition models. Admin enables/disables in Settings.
- Handles neat block printing and legible cursive well. Truly messy handwriting remains unreliable with current technology.

## Data Export

- Export button on log entry table toolbar: `[Export v]` split button
- Exportable entities: log entries (filtered), single log entry with formatting (PDF/HTML), log templates
- Log entries export: rich text stripped to plain text for CSV/XLSX; PDF/HTML preserve WYSIWYG formatting
- Log templates export: name, fields, required_flags as CSV/JSON
- Supported formats: CSV, XLSX, PDF, JSON (entries); PDF, HTML (single entry with formatting)
- Requires `log:export` permission
- Sensitive note: log entries may contain operationally sensitive information; export respects both `log:read` and `log:export` permissions
- See doc 25 for full export specifications

## Mobile Interface

- **Entry mode on mobile**: Fill out log templates, view previous logs
- **Full template editing is desktop-only**
- Online connectivity required (see doc 20)
- Large touch targets (60px)
- Responsive Tiptap editor with touch-optimized toolbar

## User Stories

1. **As an operator, I want to fill out my shift log from a template, so I can quickly document my shift with consistent structure.**

2. **As a field technician, I want to attach photos to log entries from my tablet, so I can document equipment issues.**

3. **As a supervisor, I want to search historical logs by keyword and shift, so I can find information about past events.**

4. **As a manager, I want shift handover logs visible to the incoming crew, so nothing gets lost between shifts.**

## Technical Requirements

### Editor

- **Tiptap** (MIT, ProseMirror-based)
- HTML sanitization on backend (XSS prevention)
- Auto-save drafts every 30 seconds
- Collaborative-ready architecture (ProseMirror supports it; not required for v1)

### Mobile Considerations

- Responsive design
- Touch-optimized controls
- Online connectivity required (see doc 20)
- Entry mode only — no template management on mobile

### Storage

- Log templates in `log_templates` table
- Log segments in `log_segments` table
- Log instances in `log_instances` table
- Log entries/responses in `log_entries` table
- Attachments in `log_media` table
- Full-text search: `tsvector` column with GIN index on log entry content
- File storage on server filesystem, referenced by `file_path` in database

## API Endpoints

- `GET /api/logs/templates` - List log templates
- `POST /api/logs/templates` - Create log template
- `PUT /api/logs/templates/:id` - Update log template
- `GET /api/logs/segments` - List reusable segments
- `POST /api/logs/segments` - Create segment
- `GET /api/logs/instances` - List log instances (filterable by shift, date, status)
- `GET /api/logs/instances/:id` - Get log instance with entries
- `PUT /api/logs/instances/:id` - Update log instance (fill in entries)
- `POST /api/logs/instances/:id/submit` - Submit completed log
- `POST /api/logs/instances/:id/attachments` - Upload attachment
- `GET /api/logs/search` - Full-text search across log content
- `DELETE /api/logs/instances/:id` - Soft-delete log instance (sets `deleted_at` timestamp; per system-wide delete semantics in doc 02)

## Success Criteria

- Operators can fill out shift logs from structured templates
- Multiple segment types (WYSIWYG, field tables, point data) work correctly
- Full-text search returns relevant results quickly
- Shift integration auto-generates log instances on schedule
- Mobile entry mode works on tablets (online connectivity required)
- Attachments upload and display correctly
- Multi-user attribution tracks who entered what

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `log:read` | View log entries | All roles |
| `log:write` | Create/edit log entries | Operator, Analyst, Supervisor, Content Manager, Admin |
| `log:delete` | Delete log entries | Supervisor, Admin |
| `log:export` | Export log entries | Analyst, Supervisor, Content Manager, Admin |
| `log:admin` | Log module administration (templates, segments, schedules) | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Change Log

- **v0.7**: Updated permission table from 3-role column format (User/Power User/Admin) to Default Roles format listing all 8 predefined roles. Adjusted role assignments per centralized RBAC model (doc 03).
- **v0.6**: Removed false offline support claims from Mobile Interface and Mobile Considerations sections — Log is online-only per doc 20 (Mobile Architecture v0.3). Fixed `log_attachments` table name to `log_media` (matches doc 04 schema and this document's own OCR section).
- **v0.5**: Promoted attachment OCR from "future" to v1. Tesseract (Apache 2.0) extracts printed text from image attachments on upload, stored in `extracted_text` column on `log_media`, indexed for full-text search. Covers equipment labels, HMI screenshots, typed forms. Post-v1 upgrade path: ONNX HTR model for handwritten text (two-pass pipeline, GPU recommended). See doc 01 for Tesseract crate, doc 04 for schema.
- **v0.4**: Major redesign — Tiptap WYSIWYG editor (MIT) replaces TinyMCE/CKEditor. Template/segment/instance model with 4 segment types (WYSIWYG text, table of fields, list of fields, point data). Shift-based scheduling with multiple logs per shift by team. Auto badge-in entries from doc 30. Full-text search via tsvector/GIN index. API endpoints expanded for templates, segments, instances. Mobile limited to entry mode.
- **v0.3**: Reverted `DELETE /api/logs/:id` to soft delete (`deleted_at` column) per system-wide delete semantics policy in 02_SYSTEM_ARCHITECTURE.md. Log entries are business entities and follow the soft-delete-by-default rule.
- **v0.2**: Fixed `DELETE /api/logs/:id` — changed "soft delete" to "permanent; deletion is recorded in audit log" since `log_entries` table has no soft-delete column.
- **v0.1**: Added Data Export section. Log entries gain export button with 6 formats. Rich text stripped to plain text for CSV/XLSX; PDF/HTML preserve formatting. Requires `log:export` permission. See 25_EXPORT_SYSTEM.md.
