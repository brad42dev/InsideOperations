# Intelex (Fortive) — Regulatory / Compliance Connector Profile

## Application Overview

- **Vendor**: Intelex Technologies (acquired by Fortive 2019)
- **Product**: Intelex Platform (v6.6.7+ for REST API v2)
- **Market Position**: Strong mid-market to enterprise EHS. Configurable platform with Application Builder for custom modules. Good North American refinery presence. Claims hundreds of enterprise customers in process industries.
- **Licensing**: API access included in platform license (no separate API license required). Available from Platform Version 6.6.7+.
- **Typical Deployment**: Cloud SaaS (most common) or on-premise. Refinery EHS teams use Intelex for incidents, MOC, inspections, audits, environmental compliance, and training tracking.

## API Surface

- **Type**: REST/JSON, OData-compatible query syntax
- **Base URL**: `https://{instance}.intelex.com/api/v2/object`
- **Auth**: Two options:
  - **API Key**: `x-api-key` header (from user profile in Intelex admin). Simple but tied to a user account.
  - **OAuth 2.0** (recommended): Client credentials flow — `POST /api/v2/auth/token` with `client_id` + `client_secret`. Returns bearer token.
- **Pagination**: OData-style — `$top=100&$skip=0`
- **Incremental Sync**: `$filter=DateModified gt datetime'{ISO8601}'`
- **Rate Limits**: Standard enterprise throttling (not publicly documented). HTTP 429 with retry.
- **API Docs**: `https://developers.intelex.com/` (public developer portal with endpoint references, auth guides, examples)
- **Schema Discovery**: `GET /api/v2/object/{ObjectName}/$metadata` returns available fields and types per entity

### Key Endpoints

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/IncidentsObject` | Incidents and near-misses |
| GET | `/MOCObject` | Management of Change records |
| GET | `/AuditObject` | Audits and compliance reviews |
| GET | `/InspectionObject` | Equipment and facility inspections |
| GET | `/CorrectiveActionsObject` | Action items across all modules |
| GET | `/EnvironmentalObject` | Environmental compliance data |

## Target Tables

| I/O Table | Primary / Secondary | Data Sourced |
|-----------|-------------------|--------------|
| `moc_records` | Primary | `/MOCObject` endpoint |
| `safety_incidents` | Primary | `/IncidentsObject` endpoint |
| `inspection_findings` | Primary | `/InspectionObject` + `/AuditObject` endpoints |
| `risk_assessments` | Primary | `/AuditObject` (PHA/HAZOP records if tracked in Intelex) |
| `regulatory_permits` | Secondary | `/EnvironmentalObject` (permit-related records) |

## Field Mapping — MOC Records

Intelex field names are configurable per instance (Application Builder). The mappings below use Intelex default field names. Run `$metadata` discovery during connection setup to verify.

| Intelex Field | I/O `moc_records` Column | Transform |
|--------------|--------------------------|-----------|
| `Id` (GUID) | `external_id` | Cast to string |
| (static) | `source_system` | `"intelex"` |
| `MOCNumber` | `moc_number` | Direct |
| `Name` / `Title` | `title` | Direct |
| `Description` | `description` | Direct |
| `Status` | `status` | Normalize (see table below) |
| `ChangeType` / `Category` | `category` | Normalize (see table below) |
| `RiskLevel` / `RiskRating` | `risk_level` | Normalize: `"High"` → `"high"`, `"Medium"` → `"medium"`, `"Low"` → `"low"` |
| `Originator` / `RequestedBy` | `originator` | Direct |
| `Approver` / `ApprovedBy` | `approver` | Direct |
| `SubmittedDate` | `submitted_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ApprovedDate` | `approved_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ImplementationDueDate` | `implementation_due_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ClosedDate` / `CompletionDate` | `closed_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `EquipmentTags` (custom field) | `affected_equipment_ids` | Lookup tag → UUID via `points_metadata`; unresolved in `extra_data` |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

### MOC Status Normalization

| Intelex `Status` | I/O `status` |
|------------------|--------------|
| `Draft` | `draft` |
| `Submitted` / `Pending` | `submitted` |
| `Under Review` / `In Review` | `under_review` |
| `Approved` | `approved` |
| `Implemented` / `In Progress` | `implemented` |
| `Closed` / `Complete` | `closed` |
| `Rejected` / `Cancelled` | `rejected` |

### MOC Category Normalization

| Intelex `ChangeType` | I/O `category` |
|----------------------|----------------|
| `Process` / `Process Change` | `process` |
| `Equipment` / `Equipment Change` | `equipment` |
| `Procedure` / `Procedural` | `procedure` |
| `Organizational` / `Personnel` | `organization` |
| `Temporary` / `Temporary Change` | `temporary` |

## Field Mapping — Safety Incidents

| Intelex Field | I/O `safety_incidents` Column | Transform |
|--------------|-------------------------------|-----------|
| `Id` (GUID) | `external_id` | Cast to string |
| (static) | `source_system` | `"intelex"` |
| `IncidentNumber` | `incident_number` | Direct |
| `Name` / `Title` | `title` | Direct |
| `Description` | `description` | Direct |
| `IncidentType` / `Category` | `incident_type` | Normalize (see table below) |
| `Severity` / `SeverityLevel` | `severity` | Normalize (see table below) |
| `Status` | `status` | Normalize: `"Open"` / `"Reported"` → `"reported"`, `"Investigating"` → `"under_investigation"`, `"Corrective Action"` → `"corrective_action"`, `"Closed"` → `"closed"` |
| `Location` / `UnitArea` | `location` | Direct |
| `Area` / `SubLocation` | `area` | Direct |
| `IncidentDate` | `occurred_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ReportedDate` | `reported_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ReportedBy` | `reported_by` | Direct |
| `RootCause` / `RootCauseCategory` | `root_cause` | Direct |
| Related `CorrectiveActionsObject` | `corrective_actions` | Use `$expand=CorrectiveActions` to inline; map to JSONB array |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

### Incident Type Normalization

| Intelex `IncidentType` | I/O `incident_type` |
|------------------------|---------------------|
| `Injury` / `Illness` | `injury` |
| `Near Miss` | `near_miss` |
| `Property Damage` | `property_damage` |
| `Environmental` / `Spill` / `Release` | `environmental_release` |
| `Process Safety` / `PSE` | `process_safety` |
| `Fire` / `Explosion` | `fire` |

### Severity Normalization

| Intelex `Severity` | I/O `severity` |
|--------------------|----------------|
| `Catastrophic` / `Fatality` | `catastrophic` |
| `Major` / `Lost Time` | `major` |
| `Moderate` / `Recordable` | `moderate` |
| `Minor` / `First Aid` | `minor` |
| `Negligible` / `Near Miss` | `negligible` |

## Field Mapping — Inspection Findings

| Intelex Field | I/O `inspection_findings` Column | Transform |
|--------------|----------------------------------|-----------|
| `Id` (GUID) | `external_id` | Cast to string |
| (static) | `source_system` | `"intelex"` |
| `InspectionType` | `inspection_type` | Normalize: `"Regulatory"` → `"regulatory"`, `"Internal"` → `"internal"`, `"Insurance"` → `"insurance"`, `"Mechanical Integrity"` / `"API"` → `"mechanical_integrity"` |
| `FindingTitle` / `Name` | `title` | Direct |
| `FindingDescription` | `description` | Direct |
| `FindingSeverity` | `finding_type` | Normalize: `"Critical"` → `"critical_finding"`, `"Major"` → `"major_finding"`, `"Minor"` → `"minor_finding"`, `"Observation"` → `"observation"` |
| `Status` | `status` | Normalize: `"Open"` → `"open"`, `"In Progress"` → `"in_progress"`, `"Closed"` / `"Verified"` → `"closed"`, `"Overdue"` → `"overdue"` |
| `EquipmentTag` / `Equipment` | `equipment_id` | Lookup tag → UUID via equipment registry; null if unresolved |
| `AssignedTo` / `ActionOwner` | `assigned_to` | Direct |
| `DueDate` | `due_date` | Parse date |
| `ClosedDate` / `CompletionDate` | `closed_date` | Parse date |
| `RegulatoryReference` | `regulation_reference` | Direct |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## Field Mapping — Risk Assessments

| Intelex Field | I/O `risk_assessments` Column | Transform |
|--------------|-------------------------------|-----------|
| `Id` (GUID) | `external_id` | Cast to string |
| (static) | `source_system` | `"intelex"` |
| `AssessmentType` / `StudyType` | `assessment_type` | Normalize: `"HAZOP"` → `"hazop"`, `"LOPA"` → `"lopa"`, `"What-If"` → `"what_if"`, `"Bow Tie"` → `"bowtie"`, default → `"pha"` |
| `Name` / `Title` | `title` | Direct |
| `Description` | `description` | Direct |
| `Status` | `status` | Direct (lowercase) |
| `FacilityArea` / `UnitArea` | `facility_area` | Direct |
| `Unit` | `unit` | Direct |
| `AssessmentDate` / `StudyDate` | `assessment_date` | Parse date |
| `RevalidationDue` / `NextReviewDate` | `next_revalidation_date` | Parse date |
| `TeamLead` / `Leader` | `team_lead` | Direct |
| (count from `$expand`) | `recommendations_count` | Count related recommendations |
| (count with status=open) | `open_actions_count` | Count open action items |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Method |
|-----------|----------|-----------|--------|
| MOC records | 15-30 minutes | `DateModified` via `$filter` | Incremental poll |
| Safety incidents | 15-30 minutes | `DateModified` via `$filter` | Incremental poll |
| Inspections | Daily (02:00) | `DateModified` via `$filter` | Incremental poll |
| Risk assessments | Daily (03:00) | `DateModified` via `$filter` | Incremental poll |

### Initial Load

1. Run schema discovery via `$metadata` for each target Object to verify field names
2. Full sync for each entity type (no `$filter`), paginating with `$top` / `$skip`
3. Start with MOC and incidents (highest operational value)
4. Store latest `DateModified` per entity as watermark for incremental syncs
5. Subsequent runs use `$filter=DateModified gt datetime'{watermark}'`

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "rest_json",
  "name": "Intelex EHS Platform",
  "base_url": "https://{{INTELEX_INSTANCE}}.intelex.com/api/v2/object",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "https://{{INTELEX_INSTANCE}}.intelex.com/api/v2/auth/token",
    "client_id": "{{INTELEX_CLIENT_ID}}",
    "client_secret": "{{INTELEX_CLIENT_SECRET}}"
  },
  "default_headers": {
    "Accept": "application/json"
  },
  "rate_limit": {
    "respect_retry_after": true,
    "max_retries": 3
  }
}
```

### Source Config — MOC Records

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/MOCObject",
  "method": "GET",
  "query_params": {
    "$select": "Id,MOCNumber,Name,Description,Status,ChangeType,RiskLevel,Originator,Approver,SubmittedDate,ApprovedDate,ImplementationDueDate,ClosedDate,EquipmentTags",
    "$orderby": "DateModified asc"
  },
  "pagination": {
    "type": "offset",
    "offset_param": "$skip",
    "limit_param": "$top",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "DateModified",
    "filter_template": "$filter=DateModified gt datetime'{watermark}'",
    "format": "iso8601"
  },
  "schedule": "*/30 * * * *",
  "target_table": "moc_records",
  "upsert_key": "external_id"
}
```

### Source Config — Safety Incidents

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/IncidentsObject",
  "method": "GET",
  "query_params": {
    "$expand": "CorrectiveActions",
    "$orderby": "DateModified asc"
  },
  "pagination": {
    "type": "offset",
    "offset_param": "$skip",
    "limit_param": "$top",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "DateModified",
    "filter_template": "$filter=DateModified gt datetime'{watermark}'",
    "format": "iso8601"
  },
  "schedule": "*/15 * * * *",
  "target_table": "safety_incidents",
  "upsert_key": "external_id"
}
```

### Source Config — Inspection Findings

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/InspectionObject",
  "method": "GET",
  "query_params": {
    "$orderby": "DateModified asc"
  },
  "pagination": {
    "type": "offset",
    "offset_param": "$skip",
    "limit_param": "$top",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "DateModified",
    "filter_template": "$filter=DateModified gt datetime'{watermark}'",
    "format": "iso8601"
  },
  "schedule": "0 2 * * *",
  "target_table": "inspection_findings",
  "upsert_key": "external_id"
}
```

### Field Mapping Array — MOC Records

```json
{
  "field_mappings": [
    {"source": "Id", "target": "external_id", "transform": "to_string"},
    {"source": null, "target": "source_system", "transform": "static", "value": "intelex"},
    {"source": "MOCNumber", "target": "moc_number"},
    {"source": "Name", "target": "title"},
    {"source": "Description", "target": "description"},
    {"source": "Status", "target": "status", "transform": "status_map", "map": {"Draft": "draft", "Submitted": "submitted", "Pending": "submitted", "Under Review": "under_review", "In Review": "under_review", "Approved": "approved", "Implemented": "implemented", "In Progress": "implemented", "Closed": "closed", "Complete": "closed", "Rejected": "rejected", "Cancelled": "rejected"}},
    {"source": "ChangeType", "target": "category", "transform": "status_map", "map": {"Process": "process", "Process Change": "process", "Equipment": "equipment", "Equipment Change": "equipment", "Procedure": "procedure", "Procedural": "procedure", "Organizational": "organization", "Personnel": "organization", "Temporary": "temporary", "Temporary Change": "temporary"}},
    {"source": "RiskLevel", "target": "risk_level", "transform": "lowercase"},
    {"source": "Originator", "target": "originator"},
    {"source": "Approver", "target": "approver"},
    {"source": "SubmittedDate", "target": "submitted_at", "transform": "parse_iso8601"},
    {"source": "ApprovedDate", "target": "approved_at", "transform": "parse_iso8601"},
    {"source": "ImplementationDueDate", "target": "implementation_due_at", "transform": "parse_iso8601"},
    {"source": "ClosedDate", "target": "closed_at", "transform": "parse_iso8601"},
    {"source": "EquipmentTags", "target": "affected_equipment_ids", "transform": "tag_to_uuid_array"},
    {"source": "$remaining", "target": "extra_data", "transform": "collect_unmapped"}
  ]
}
```

## Notes

- **Best-documented API of the five.** The public developer portal at `developers.intelex.com` has endpoint references, auth guides, and working examples. This makes Intelex the easiest regulatory connector to implement and debug.
- **Schema discovery is essential.** Intelex's Application Builder allows customers to add custom fields, rename default fields, and create entirely new objects. Always run `$metadata` discovery during connection setup to get the actual field inventory for the target instance.
- **OData query operators work.** Standard `$filter`, `$select`, `$expand`, `$orderby` operators are supported on all entity endpoints. Use `$expand` to inline related corrective actions on incidents to avoid N+1 API calls.
- **`ILX.Attachments` sub-entity**: If the refinery attaches photos, inspection reports, or documents to records, these are accessible via a separate sub-entity. I/O does not import attachments but could store references in `extra_data`.
- **Custom objects**: If the refinery has built custom Intelex objects (e.g., a specialized PSM tracking module), those are queryable via the same `/api/v2/object/{CustomObjectName}` pattern. The import wizard can discover these during connection setup.
- **GUID-based IDs**: Intelex uses GUIDs as primary keys. These are stable across syncs, making upsert reliable.
