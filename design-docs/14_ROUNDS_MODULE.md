# Inside/Operations - Rounds Module

## Overview

Equipment inspection rounds with templated checklists, shift-based scheduling, and mobile-first field use. Rounds follow a template/instance/response model where templates define the inspection checklist, instances are scheduled occurrences, and responses capture individual checkpoint data.

## Template/Instance/Response Model

### Round Templates

Define the inspection checklist:

- Ordered list of checkpoints, each with a data type, validation rules, and media requirements
- Barcode/GPS gate configuration per checkpoint
- Range validation and alarm thresholds for numeric checkpoints
- Expression builder formulas for multi-field calculations
- Organized by unit/area/equipment

### Round Schedules

Recurrence configuration for when templates generate instances:

- **Per shift**: One round per shift (e.g., "night shift does boiler round")
- **Daily/interval**: Every N hours, once per day
- **Weekly**: Specific days of the week
- **Frequency within shift**: "Once every 3 days on night shift", "Once per shift every day for day and night"
- **Assigned to shifts or time windows, NOT specific people**. Any authorized user on the assigned shift can start the round.

### Round Instances

A specific scheduled occurrence of a round:

- Status: `pending` → `in_progress` → `completed` (or `missed` / `transferred`)
- Auto-generated from schedule configuration
- Appears as available for the assigned shift/window

### Round Responses

Individual checkpoint data captured per instance. Each response records the operator, timestamp, checkpoint values, media attachments, GPS coordinates, and any barcode scans.

## Checkpoint Data Types

| Type | Description | Example |
|---|---|---|
| **Text** | Free text entry | Equipment condition notes |
| **Numeric** | Number entry with optional range validation and alarm thresholds | Temperature: 185.4 |
| **True/False** | Boolean toggle | Pump running: Yes/No |
| **Dropdown** | Select from pre-defined values | Valve position: Auto / On / Off |
| **Multi-field** | Multiple input fields per checkpoint (see below) | Feet + Inches + Eighths |

## Every Checkpoint Can (Configurable as Required or Optional)

- **Take a photo** — equipment condition documentation
- **Take a video** — procedure recording
- **Record audio** — voice notes
- **Add comments** — free-text annotation
- **Scan a barcode** — equipment identification (see Barcode/GPS Gates below)

Each of these can be configured per checkpoint as: not available, optional, or **required**. Required media forces the operator to capture before moving to the next checkpoint.

## Barcode/GPS Entry Gates

Barcode and GPS function as **entry gates** — proof that the operator is physically at the equipment — not as data collection fields.

### Barcode Gate

- Checkpoint won't accept data entry until the correct barcode is scanned
- Proves the operator is physically at the equipment
- **PWA BarcodeDetector API** (Chrome/Android), **zxing-js** fallback (iOS/Safari)
- On unsupported browsers: searchable equipment list or manual equipment ID entry

### GPS Gate

- Checkpoint locked until GPS confirms user is within configured radius of equipment location
- Proves proximity to the inspection point
- **GPS coordinates are logged on EVERY round entry** regardless of whether GPS gating is enabled for that checkpoint

## Range Validation and Alarm Thresholds (Numeric Checkpoints)

Two modes for numeric value validation:

### Limit Mode

Restricts data entry. The field rejects values outside the configured range.

- Example: Percent field only accepts 0–100
- Hard enforcement — cannot submit out-of-range values

### Alarm Mode

Allows entry of any value but triggers notifications and can force conditions:

- **Threshold levels**: HH (high-high), H (high), L (low), LL (low-low) — same model as process alarms
- **Forced conditions on alarm** (configurable per threshold):
  - Require photo on alarm
  - Require comment on alarm
  - Require video on alarm
- Out-of-range values are flagged visually and can trigger Alert System (doc 27) escalation

## Multi-Field Checkpoints

Multiple input fields per checkpoint for compound data entry. Use cases:

1. **Compound measurements**: Feet field + Inches field + Eighths field → Expression Builder converts to decimal. Raw fields are stored; calculated decimal is used for range checks and reports.
2. **Unit conversions**: Enter in field units (e.g., PSI), expression converts to standard (e.g., kPa) for storage.
3. **Logical grouping**: 3 gauges on one piece of equipment captured as one checkpoint with 3 numeric sub-fields.

## Expression Builder Integration

Same engine as doc 23. Each checkpoint context provides its own fields as available inputs, plus optionally OPC points from the input catalog. Used for:

- **Multi-field calculations**: Compound measurements → stored decimal value
- **Unit conversions**: Field units → standard units
- **Cross-referencing**: Compare manual reading against live OPC value, flag if deviation exceeds configured threshold

## Locking and Transfer

- **When a user starts a round, it locks to that user**. No one else can enter data.
- **Transfer mechanisms**:
  - Manager/supervisor override — immediate transfer
  - Notification to current owner → **1 minute no-acknowledgment → auto-transfer** to requesting user
- **Partial completion**: Saveable at any point. User can resume within the schedule window.

## Non-Badged Entry Flagging

If a round entry is made by someone **not badged into the facility** (per doc 30 presence data), the entry is flagged visually. This does not block entry — it creates an audit trail for entries made by operators without confirmed physical presence.

## Notification and Escalation

Email notifications for round assignments and overdue rounds delivered via Email Service (doc 28). Overdue rounds can trigger alerts via Alert System (doc 27) with configurable escalation chain:

1. Email reminder at due time
2. Follow-up email after configurable delay
3. SMS notification (via `io-sms` crate — Twilio client)
4. Supervisor alert

Escalation thresholds and recipients are configured per round template.

## Data Export

- Export button on rounds table toolbars: `[Export v]` split button
- Exportable entities: round templates (catalog), round template definitions (full checklist JSONB as JSON), round instances (schedule table), completed round results (inspection data), completion history (trend data)
- Supported formats: CSV, XLSX, PDF, JSON (per entity; JSON only for template definitions)
- Bulk-update candidates: round templates (questions, expected values), round schedules (assignments, due dates)
- Requires `rounds:export` permission
- See doc 25 for full export specifications

## Mobile-First Design

Rounds are **primarily done on tablets in the field**. The mobile Rounds module focuses on the pick/start/complete workflow:

1. View available rounds for current shift
2. Start a round (locks it)
3. Walk through checkpoints sequentially
4. Capture data, scan barcodes, take photos/video at each checkpoint
5. Submit completed round

**Full template management and schedule configuration is desktop-only.**

- Offline round completion (IndexedDB + sync queue)
- Automatic sync when online
- Large touch targets (60px for gloved fingers)
- Camera/microphone access for media capture

## User Stories

1. **As a supervisor, I want to create a daily equipment round template with numeric thresholds, so operators are alerted to abnormal readings.**

2. **As an operator, I want to complete my shift's round on my tablet, scanning barcodes to confirm I'm at each piece of equipment.**

3. **As a manager, I want to track round completion rates by shift and flag entries from non-badged personnel.**

4. **As an engineer, I want multi-field checkpoints for tank gauging (feet/inches/eighths) with automatic decimal conversion.**

## Technical Requirements

### Template Designer (Desktop)

- Drag-and-drop checkpoint builder
- Checkpoint type configuration (text, numeric, true/false, dropdown, multi-field)
- Conditional checkpoints (show based on previous answer)
- Validation rules (range limits, alarm thresholds)
- Expression builder integration for multi-field calculations
- Barcode/GPS gate configuration per checkpoint
- Media requirement toggles (photo/video/audio/comments — optional or required)

### Mobile Capabilities

- Offline storage (IndexedDB)
- Sync queue for completed rounds
- Camera access for photos/video
- Microphone access for audio notes
- Barcode scanner: PWA BarcodeDetector API (Chrome/Android), zxing-js fallback (iOS)
- GPS capture on every checkpoint entry
- Touch-optimized sequential checkpoint flow

### Scheduling

- Shift-based and time-window scheduling
- Automatic instance generation
- Escalation for overdue rounds (doc 27)

## Printable Round Checklist

The Print button in the Rounds module generates a paper-backup checklist from a round template. This covers scenarios where mobile devices are impractical (hazardous areas, extreme weather, device failure).

**Print dialog options:**
- **Template**: Select which round template to print
- **Mode**: Blank checklist (empty fields for handwritten entry) or Current results (pre-filled with latest round data)
- **Page size**: Letter or A4

**Blank checklist format:**
- Table layout with one row per checkpoint
- Columns: Checkpoint # | Equipment ID | Location | Description | Expected Range | Reading | Pass/Fail | Notes
- Numeric checkpoints show HH/H/L/LL thresholds in the Expected Range column
- Checkbox fields render as empty squares
- Dropdown fields list the valid options in the Expected Range column
- Multi-field checkpoints expand to one row per sub-field
- Header: Round template name, site, print date, blank line for operator name and shift
- Footer: Page number, "UNCONTROLLED COPY" watermark (configurable, see doc 25)

**Current results format:**
- Same table layout but Reading and Pass/Fail columns are pre-filled with the most recent completed round
- Out-of-range values highlighted with bold text and asterisk
- Footer includes the round instance date, operator who completed it, and completion status

Print color normalization (doc 06) applies: white background, dark text, semantic colors preserved.

---

## API Endpoints

- `GET /api/rounds/templates` - List round templates
- `POST /api/rounds/templates` - Create template
- `PUT /api/rounds/templates/:id` - Update template
- `GET /api/rounds/schedules` - List round schedules
- `POST /api/rounds/schedules` - Create schedule
- `PUT /api/rounds/schedules/:id` - Update schedule
- `GET /api/rounds/instances` - List round instances (filterable by shift, date, status)
- `GET /api/rounds/instances/:id` - Get instance with responses
- `POST /api/rounds/instances/:id/start` - Start round (locks to user)
- `POST /api/rounds/instances/:id/transfer` - Request transfer
- `POST /api/rounds/instances/:id/complete` - Submit completed round
- `POST /api/rounds/instances/:id/responses` - Save checkpoint responses (partial save)
- `GET /api/rounds/history` - Completion history and trend data

## Success Criteria

- Round templates support all 5 checkpoint types including multi-field
- Barcode/GPS gates enforce physical presence before data entry
- Range validation and alarm thresholds work for numeric checkpoints
- Expression builder correctly calculates multi-field values
- Shift-based scheduling generates instances automatically
- Locking prevents concurrent editing; transfer works via notification or override
- Mobile interface works for field use with offline support
- Non-badged entries are flagged visually
- Completion tracking provides visibility by shift

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `rounds:read` | View rounds and results | All roles |
| `rounds:execute` | Complete assigned rounds | Operator, Maintenance, Supervisor, Admin |
| `rounds:create` | Create/edit round templates | Supervisor, Admin |
| `rounds:delete` | Delete round templates/instances | Supervisor, Admin |
| `rounds:export` | Export round data | Analyst, Supervisor, Content Manager, Admin |
| `rounds:admin` | Rounds administration (schedules, transfers, system config) | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Change Log

- **v0.6**: Updated permission table from 3-role column format (User/Power User/Admin) to Default Roles format listing all 8 predefined roles. Split `rounds:write` into `rounds:execute` (complete rounds — field personnel) and `rounds:create` (create/edit templates — supervisors). Adjusted role assignments per centralized RBAC model (doc 03).
- **v0.5**: Added Printable Round Checklist section. Print button generates paper-backup checklists from round templates. Two modes: blank (empty fields for handwritten entry) or current results (pre-filled from latest round). Table format with checkpoint #, equipment ID, location, expected range, reading, pass/fail, notes. HH/H/L/LL thresholds shown. Multi-field checkpoints expand to sub-rows. Watermark and print color normalization applied. See docs 06, 25.
- **v0.4**: Major redesign — template/instance/response model with 5 checkpoint data types (text, numeric, true/false, dropdown, multi-field). Expression builder integration for multi-field calculations and unit conversions. Barcode/GPS as entry gates (not data collection). Media requirements configurable as required per checkpoint (photo/video/audio/comments). Range validation with HH/H/L/LL alarm thresholds. Shift-based scheduling (assigned to shifts, not people). Locking with manager override and 1-minute auto-transfer. Non-badged entry flagging from doc 30. API endpoints expanded for schedules, instances, responses, transfers.
- **v0.3**: Clarified SMS notifications use shared `io-sms` crate (Twilio, compiled into API Gateway). Replaced ambiguous barcode scanning references with concrete spec: PWA BarcodeDetector API (Chrome/Android) with searchable list fallback on unsupported browsers. No native app required.
- **v0.2**: Updated Assignment section — email notifications for assignments and overdue rounds via Email Service (doc 28). Configurable escalation chain (email → SMS → supervisor alert) for overdue rounds via Alert System (doc 27).
- **v0.1**: Added Data Export section. Rounds module gains export buttons for templates, assigned rounds, completed results, and completion history. Bulk-update candidates: templates and schedules. Requires `rounds:export` permission. See 25_EXPORT_SYSTEM.md.
