# Sphera (SpheraCloud) — Regulatory / Compliance Connector Profile

## Application Overview

- **Vendor**: Sphera (formerly Petrotechnics; owned by Blackstone)
- **Product**: SpheraCloud platform + PHA-Pro (HAZOP/LOPA)
- **Market Position**: Dominant in process safety for downstream oil & gas. PHA-Pro is the most widely used HAZOP/LOPA tool in refining. Very high prevalence on the US Gulf Coast.
- **Licensing**: SpheraCloud subscription. API access included at the Integration tier or as a contract add-on. No documented per-call fees.
- **Typical Deployment**: Cloud-hosted (SpheraCloud SaaS). PHA-Pro may also be on-premise with cloud sync. Refinery EHS teams use Sphera for incident management, MOC, audit tracking, and process safety studies.

## API Surface

- **Type**: REST/JSON + optional EventHub (event-driven push)
- **Base URL**: `https://api.spheracloud.net/api/v1/{tenant}`
- **Auth**: OAuth 2.0 client credentials — `POST /oauth/token` with `client_id`, `client_secret`, `grant_type=client_credentials`. Returns bearer `access_token`.
- **Pagination**: Offset-based — `?offset=0&limit=100`
- **Incremental Sync**: `?modifiedSince={ISO8601}` on all list endpoints. Watermark field: `modifiedDate`.
- **Rate Limits**: Not publicly documented; enterprise SLA-dependent. Respect HTTP 429 with `Retry-After` header.
- **API Docs**: `https://platformscdevdocs.z21.web.core.windows.net/` (developer portal)

### Key Endpoints

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/incidents` | Safety incidents and near-misses |
| GET | `/moc` | Management of Change records |
| GET | `/audits` | Audit findings and corrective actions |
| GET | `/actions` | Corrective action items (cross-entity) |
| GET | `/pha/studies` | PHA/HAZOP study headers (PHA-Pro Cloud) |
| GET | `/pha/scenarios` | Individual HAZOP/LOPA scenarios with findings |

## Target Tables

| I/O Table | Primary / Secondary | Data Sourced |
|-----------|-------------------|--------------|
| `moc_records` | Primary | `/moc` endpoint |
| `safety_incidents` | Primary | `/incidents` endpoint |
| `inspection_findings` | Primary | `/audits` endpoint (audit findings mapped as inspections) |
| `risk_assessments` | Primary | `/pha/studies` + `/pha/scenarios` endpoints |
| `regulatory_permits` | Secondary | `/audits` endpoint (permit-related findings only, if tracked in Sphera) |

## Field Mapping — MOC Records

| Sphera Field | I/O `moc_records` Column | Transform |
|-------------|--------------------------|-----------|
| `mocId` | `external_id` | Cast to string |
| (static) | `source_system` | `"sphera"` |
| `mocNumber` | `moc_number` | Direct |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `status` | `status` | Normalize (see table below) |
| `changeCategory` | `category` | Normalize (see table below) |
| `riskLevel` | `risk_level` | Normalize: `"High"` → `"high"`, `"Medium"` → `"medium"`, `"Low"` → `"low"` |
| `requestedBy` | `originator` | Direct |
| `approvedBy` | `approver` | Direct |
| `requestedDate` | `submitted_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `approvedDate` | `approved_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `implementationDueDate` | `implementation_due_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `completionDate` | `closed_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `equipmentTags[]` | `affected_equipment_ids` | Lookup tag → UUID via `points_metadata`; unresolved go to `extra_data` |
| `affectedPoints[]` | `affected_point_ids` | Lookup tag → UUID via `points_metadata` |
| `pssrCompleted`, `pssrDate`, `revertDate`, `openActionCount`, full JSON | `extra_data` | Remaining fields as JSONB |

### MOC Status Normalization

| Sphera `status` | I/O `status` |
|-----------------|--------------|
| `Draft` | `draft` |
| `Pending Review` / `Submitted` | `submitted` |
| `Under Review` / `In Review` | `under_review` |
| `Approved` | `approved` |
| `Implemented` / `In Progress` | `implemented` |
| `Closed` / `Completed` | `closed` |
| `Cancelled` / `Rejected` | `rejected` |

### MOC Category Normalization

| Sphera `changeCategory` | I/O `category` |
|--------------------------|----------------|
| `Process Change` / `Process` | `process` |
| `Equipment Change` / `Equipment` | `equipment` |
| `Procedure Change` / `Procedure` | `procedure` |
| `Organizational Change` / `Organization` | `organization` |
| `Temporary Change` / `Temporary` | `temporary` |

## Field Mapping — Safety Incidents

| Sphera Field | I/O `safety_incidents` Column | Transform |
|-------------|-------------------------------|-----------|
| `incidentId` | `external_id` | Cast to string |
| (static) | `source_system` | `"sphera"` |
| `incidentNumber` | `incident_number` | Direct |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `incidentType` | `incident_type` | Normalize (see table below) |
| `severity` | `severity` | Normalize (see table below) |
| `status` | `status` | Normalize: `"Open"` → `"reported"`, `"Investigating"` → `"under_investigation"`, `"Corrective Action"` → `"corrective_action"`, `"Closed"` → `"closed"` |
| `unitName` | `location` | Direct |
| `areaName` | `area` | Direct |
| `incidentDateTime` | `occurred_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `reportedDateTime` | `reported_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `reportedBy` | `reported_by` | Direct |
| `rootCauseCategory` | `root_cause` | Direct |
| `correctiveActions[]` | `corrective_actions` | Map array → JSONB `[{description, owner, due_date, status}]` |
| `equipmentTags[]` | (lookup) | Resolve to `affected_equipment_ids` via point model; unresolved in `extra_data` |
| `oshaRecordable`, `dartDays`, `api754Tier`, full JSON | `extra_data` | Remaining fields as JSONB |

### Incident Type Normalization

| Sphera `incidentType` | I/O `incident_type` |
|-----------------------|---------------------|
| `Injury` / `Illness` | `injury` |
| `Near Miss` | `near_miss` |
| `Property Damage` | `property_damage` |
| `Environmental Release` / `Spill` | `environmental_release` |
| `Process Safety Event` / `PSE` | `process_safety` |
| `Fire` | `fire` |

### Severity Normalization

| Sphera `severity` | I/O `severity` |
|-------------------|----------------|
| `Fatality` / `Catastrophic` | `catastrophic` |
| `Lost Time` / `Major` | `major` |
| `Recordable` / `Moderate` | `moderate` |
| `First Aid` / `Minor` | `minor` |
| `Near Miss` / `Negligible` | `negligible` |

## Field Mapping — Inspection Findings (from Audits)

| Sphera Field | I/O `inspection_findings` Column | Transform |
|-------------|----------------------------------|-----------|
| `auditFindingId` | `external_id` | Cast to string |
| (static) | `source_system` | `"sphera"` |
| `auditType` | `inspection_type` | Normalize: `"PSM Audit"` → `"internal"`, `"Regulatory"` → `"regulatory"`, `"Insurance"` → `"insurance"`, default → `"internal"` |
| `findingSummary` | `title` | Truncate to 500 chars |
| `findingDetail` | `description` | Direct |
| `findingSeverity` | `finding_type` | Normalize: `"Critical"` → `"critical_finding"`, `"Major"` → `"major_finding"`, `"Minor"` → `"minor_finding"`, `"Observation"` → `"observation"` |
| `actionStatus` | `status` | Normalize: `"Open"` → `"open"`, `"In Progress"` → `"in_progress"`, `"Closed"` / `"Verified"` → `"closed"`, `"Overdue"` → `"overdue"` |
| `equipmentTag` | `equipment_id` | Lookup tag → UUID via equipment registry; null if unresolved |
| `actionOwner` | `assigned_to` | Direct |
| `actionDueDate` | `due_date` | Parse date |
| `closedDate` | `closed_date` | Parse date |
| `regulationRef` | `regulation_reference` | Direct |
| full JSON | `extra_data` | Remaining fields |

## Field Mapping — Risk Assessments (PHA-Pro)

| Sphera Field | I/O `risk_assessments` Column | Transform |
|-------------|-------------------------------|-----------|
| `studyId` | `external_id` | Cast to string |
| (static) | `source_system` | `"sphera"` |
| `studyType` | `assessment_type` | Normalize: `"HAZOP"` → `"hazop"`, `"LOPA"` → `"lopa"`, `"What-If"` → `"what_if"`, `"Bow-Tie"` → `"bowtie"`, default → `"pha"` |
| `studyTitle` | `title` | Direct |
| `studyDescription` | `description` | Direct |
| `status` | `status` | Direct (lowercase) |
| `nodeSection` | `facility_area` | Direct |
| `unitName` | `unit` | Direct |
| `studyDate` | `assessment_date` | Parse date |
| `revalidationDue` | `next_revalidation_date` | Parse date |
| `teamLead` | `team_lead` | Direct |
| `recommendationsCount` | `recommendations_count` | Direct |
| `openActionsCount` | `open_actions_count` | Direct |
| scenarios[], riskMatrix, safeguards, full JSON | `extra_data` | Remaining fields as JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Method |
|-----------|----------|-----------|--------|
| MOC records | 30 minutes | `modifiedDate` via `?modifiedSince=` | Incremental poll |
| Safety incidents | 30 minutes | `modifiedDate` via `?modifiedSince=` | Incremental poll |
| Audit findings | Daily (02:00) | `modifiedDate` via `?modifiedSince=` | Incremental poll |
| Risk assessments (PHA) | Daily (03:00) | `modifiedDate` via `?modifiedSince=` | Incremental poll |

### Initial Load

1. Run full sync for each entity type (no `modifiedSince` filter), paginating through all records
2. Start with risk assessments and MOC records (highest operational value)
3. Store the latest `modifiedDate` from each entity as the watermark for subsequent incremental syncs
4. Expect 500-5,000 MOC records, 200-2,000 incidents, 1,000-10,000 audit findings, 50-500 PHA studies at a typical large refinery

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "rest_json",
  "name": "Sphera SpheraCloud",
  "base_url": "https://api.spheracloud.net/api/v1/{{SPHERA_TENANT}}",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "https://api.spheracloud.net/oauth/token",
    "client_id": "{{SPHERA_CLIENT_ID}}",
    "client_secret": "{{SPHERA_CLIENT_SECRET}}"
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
  "endpoint": "/moc",
  "method": "GET",
  "pagination": {
    "type": "offset",
    "offset_param": "offset",
    "limit_param": "limit",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "modifiedDate",
    "filter_param": "modifiedSince",
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
  "endpoint": "/incidents",
  "method": "GET",
  "pagination": {
    "type": "offset",
    "offset_param": "offset",
    "limit_param": "limit",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "modifiedDate",
    "filter_param": "modifiedSince",
    "format": "iso8601"
  },
  "schedule": "*/30 * * * *",
  "target_table": "safety_incidents",
  "upsert_key": "external_id"
}
```

### Source Config — Risk Assessments

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/pha/studies",
  "method": "GET",
  "pagination": {
    "type": "offset",
    "offset_param": "offset",
    "limit_param": "limit",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "modifiedDate",
    "filter_param": "modifiedSince",
    "format": "iso8601"
  },
  "schedule": "0 3 * * *",
  "target_table": "risk_assessments",
  "upsert_key": "external_id"
}
```

### Field Mapping Array — MOC Records

```json
{
  "field_mappings": [
    {"source": "mocId", "target": "external_id", "transform": "to_string"},
    {"source": null, "target": "source_system", "transform": "static", "value": "sphera"},
    {"source": "mocNumber", "target": "moc_number"},
    {"source": "title", "target": "title"},
    {"source": "description", "target": "description"},
    {"source": "status", "target": "status", "transform": "status_map", "map": {"Draft": "draft", "Pending Review": "submitted", "Submitted": "submitted", "Under Review": "under_review", "In Review": "under_review", "Approved": "approved", "Implemented": "implemented", "In Progress": "implemented", "Closed": "closed", "Completed": "closed", "Cancelled": "rejected", "Rejected": "rejected"}},
    {"source": "changeCategory", "target": "category", "transform": "status_map", "map": {"Process Change": "process", "Process": "process", "Equipment Change": "equipment", "Equipment": "equipment", "Procedure Change": "procedure", "Procedure": "procedure", "Organizational Change": "organization", "Organization": "organization", "Temporary Change": "temporary", "Temporary": "temporary"}},
    {"source": "riskLevel", "target": "risk_level", "transform": "lowercase"},
    {"source": "requestedBy", "target": "originator"},
    {"source": "approvedBy", "target": "approver"},
    {"source": "requestedDate", "target": "submitted_at", "transform": "parse_iso8601"},
    {"source": "approvedDate", "target": "approved_at", "transform": "parse_iso8601"},
    {"source": "implementationDueDate", "target": "implementation_due_at", "transform": "parse_iso8601"},
    {"source": "completionDate", "target": "closed_at", "transform": "parse_iso8601"},
    {"source": "equipmentTags", "target": "affected_equipment_ids", "transform": "tag_to_uuid_array"},
    {"source": "$remaining", "target": "extra_data", "transform": "collect_unmapped"}
  ]
}
```

## Notes

- **PHA-Pro is Sphera's unique strength.** HAZOP/LOPA data is the hardest to get from other EHS platforms. If a refinery uses PHA-Pro, prioritize the risk assessment sync — this data is not available elsewhere.
- **EventHub alternative**: Sphera supports webhook-style push via EventHub. This would require the Import Service to expose an inbound HTTP listener. Polling is simpler for v1; EventHub is a future optimization for near-real-time MOC status changes.
- **Tenant ID**: The `{tenant}` path segment is provided during Sphera onboarding. It identifies the customer's data partition.
- **PHA-Pro on-premise**: Some sites run PHA-Pro as a desktop application without cloud sync. In that case, PHA data is not available via SpheraCloud APIs. The alternative is database direct access to PHA-Pro's SQL Server database (separate connector configuration, not covered here).
- **Equipment tag correlation**: Sphera's `equipmentTags[]` field uses the customer's naming convention. Quality of tag-to-point correlation depends on consistent tag naming between Sphera and the I/O point model. The import wizard should include a tag mapping review step.
