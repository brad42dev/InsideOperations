# Cority — Regulatory / Compliance Connector Profile

## Application Overview

- **Vendor**: Cority (formerly Medgate; rebranded 2018)
- **Product**: Cority EHS Platform (SaaS)
- **Market Position**: Enterprise EHS platform with strong occupational health heritage (Medgate roots). Growing presence in process industries including oil & gas, chemicals, and mining. Acquired ehsAI (AI-powered compliance) and Enviance (environmental compliance) to build out full EHS/ESG suite. Competes directly with Intelex and VelocityEHS in the mid-to-large enterprise segment.
- **Licensing**: SaaS subscription. REST API access included in enterprise tier. Integration capabilities may require the "Cority Connect" add-on for lower tiers.
- **Typical Deployment**: Cloud SaaS (primary). Some legacy on-premise Medgate installations still exist. Refinery EHS teams use Cority for incident management, MOC, audits/inspections, environmental compliance, industrial hygiene, and occupational health.

## API Surface

- **Type**: REST/JSON
- **Base URL**: `https://{instance}.cority.com/api/v1` (estimated pattern; exact URL provided during onboarding)
- **Auth**: OAuth 2.0 client credentials — `POST /oauth/token` with `client_id`, `client_secret`. Returns bearer token. Some instances may support API key via `x-api-key` header.
- **Pagination**: Offset-based — `?offset=0&limit=100` or cursor-based (depends on endpoint)
- **Incremental Sync**: `?modifiedSince={ISO8601}` or `?updated_after={ISO8601}` (verify per endpoint during setup)
- **Rate Limits**: Not publicly documented. Expect standard enterprise throttling with HTTP 429 responses.
- **API Docs**: Available through Cority Connect developer portal (requires customer login). Not publicly accessible. Contact Cority support or account team for API documentation.

### Key Endpoints (Estimated)

Cority's API is not publicly documented. The endpoint patterns below are based on typical REST conventions for their module structure. **Verify all endpoints during connection setup.**

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/incidents` | Incidents and near-misses |
| GET | `/moc` or `/management-of-change` | MOC records |
| GET | `/audits` | Audit and inspection records |
| GET | `/audits/findings` | Individual audit/inspection findings |
| GET | `/corrective-actions` | Action items across modules |
| GET | `/environmental/permits` | Environmental permits and conditions |
| GET | `/inspections` | Equipment and facility inspections |

## Target Tables

| I/O Table | Primary / Secondary | Data Sourced |
|-----------|-------------------|--------------|
| `moc_records` | Primary | MOC endpoint |
| `safety_incidents` | Primary | Incidents endpoint |
| `inspection_findings` | Primary | Audits/findings and inspections endpoints |
| `regulatory_permits` | Secondary | Environmental permits endpoint |
| `risk_assessments` | Secondary | Audits endpoint (PHA/risk review records if tracked in Cority) |

## Field Mapping — MOC Records

Cority field names must be verified via API documentation or schema discovery during setup. The mappings below are based on typical Cority EHS module conventions.

| Cority Field | I/O `moc_records` Column | Transform |
|-------------|--------------------------|-----------|
| `id` / `moc_id` | `external_id` | Cast to string |
| (static) | `source_system` | `"cority"` |
| `moc_number` / `reference_number` | `moc_number` | Direct |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `status` | `status` | Normalize (see table below) |
| `change_type` / `category` | `category` | Normalize (see table below) |
| `risk_level` / `risk_rating` | `risk_level` | Normalize: `"High"` → `"high"`, `"Medium"` → `"medium"`, `"Low"` → `"low"` |
| `originator` / `requested_by` | `originator` | Direct |
| `approved_by` / `approver` | `approver` | Direct |
| `submitted_date` | `submitted_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `approved_date` | `approved_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `implementation_due_date` | `implementation_due_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `closed_date` / `completion_date` | `closed_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `affected_equipment` | `affected_equipment_ids` | Lookup tags → UUID via `points_metadata`; unresolved in `extra_data` |
| remaining fields | `extra_data` | Collect as JSONB |

### MOC Status Normalization

| Cority `status` | I/O `status` |
|-----------------|--------------|
| `Draft` | `draft` |
| `Submitted` / `Pending` | `submitted` |
| `Under Review` / `In Review` | `under_review` |
| `Approved` | `approved` |
| `Implemented` / `In Progress` | `implemented` |
| `Closed` / `Completed` | `closed` |
| `Rejected` / `Cancelled` | `rejected` |

### MOC Category Normalization

| Cority `change_type` | I/O `category` |
|----------------------|----------------|
| `Process` / `Process Change` | `process` |
| `Equipment` / `Equipment Change` | `equipment` |
| `Procedure` / `Procedural` | `procedure` |
| `Organizational` / `Personnel` | `organization` |
| `Temporary` / `Temporary Change` | `temporary` |

## Field Mapping — Safety Incidents

| Cority Field | I/O `safety_incidents` Column | Transform |
|-------------|-------------------------------|-----------|
| `id` / `incident_id` | `external_id` | Cast to string |
| (static) | `source_system` | `"cority"` |
| `incident_number` / `reference_number` | `incident_number` | Direct |
| `title` / `summary` | `title` | Direct |
| `description` | `description` | Direct |
| `incident_type` / `category` | `incident_type` | Normalize (see table below) |
| `severity` / `severity_level` | `severity` | Normalize (see table below) |
| `status` | `status` | Normalize: `"Open"` / `"Reported"` → `"reported"`, `"Investigating"` → `"under_investigation"`, `"Corrective Action"` → `"corrective_action"`, `"Closed"` → `"closed"` |
| `location` / `facility` | `location` | Direct |
| `area` / `unit` | `area` | Direct |
| `incident_date` / `occurred_at` | `occurred_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `reported_date` | `reported_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `reported_by` | `reported_by` | Direct |
| `root_cause` / `root_cause_category` | `root_cause` | Direct |
| `corrective_actions` (related) | `corrective_actions` | Map to JSONB array `[{description, owner, due_date, status}]` |
| remaining fields | `extra_data` | Collect as JSONB |

### Incident Type Normalization

| Cority `incident_type` | I/O `incident_type` |
|------------------------|---------------------|
| `Injury` / `Illness` / `Occupational` | `injury` |
| `Near Miss` | `near_miss` |
| `Property Damage` | `property_damage` |
| `Environmental Release` / `Spill` | `environmental_release` |
| `Process Safety` / `PSE` | `process_safety` |
| `Fire` / `Explosion` | `fire` |

### Severity Normalization

| Cority `severity` | I/O `severity` |
|-------------------|----------------|
| `Catastrophic` / `Fatality` | `catastrophic` |
| `Major` / `Lost Time` | `major` |
| `Moderate` / `Recordable` | `moderate` |
| `Minor` / `First Aid` | `minor` |
| `Negligible` / `Near Miss` | `negligible` |

## Field Mapping — Inspection Findings

| Cority Field | I/O `inspection_findings` Column | Transform |
|-------------|----------------------------------|-----------|
| `id` / `finding_id` | `external_id` | Cast to string |
| (static) | `source_system` | `"cority"` |
| `inspection_type` / `audit_type` | `inspection_type` | Normalize: `"Regulatory"` → `"regulatory"`, `"Internal"` → `"internal"`, `"Insurance"` → `"insurance"`, `"Mechanical Integrity"` / `"MI"` → `"mechanical_integrity"` |
| `finding_title` / `title` | `title` | Direct |
| `finding_description` / `description` | `description` | Direct |
| `severity` / `priority` | `finding_type` | Normalize: `"Critical"` → `"critical_finding"`, `"Major"` → `"major_finding"`, `"Minor"` → `"minor_finding"`, `"Observation"` → `"observation"` |
| `status` | `status` | Normalize: `"Open"` → `"open"`, `"In Progress"` → `"in_progress"`, `"Closed"` / `"Verified"` → `"closed"`, `"Overdue"` → `"overdue"` |
| `equipment_tag` / `equipment` | `equipment_id` | Lookup tag → UUID; null if unresolved |
| `assigned_to` / `action_owner` | `assigned_to` | Direct |
| `due_date` | `due_date` | Parse date |
| `closed_date` / `completion_date` | `closed_date` | Parse date |
| `regulation_reference` / `regulatory_ref` | `regulation_reference` | Direct |
| remaining fields | `extra_data` | Collect as JSONB |

## Field Mapping — Regulatory Permits

| Cority Field | I/O `regulatory_permits` Column | Transform |
|-------------|----------------------------------|-----------|
| `id` / `permit_id` | `external_id` | Cast to string |
| (static) | `source_system` | `"cority"` |
| `permit_type` | `permit_type` | Direct |
| `permit_number` | `permit_number` | Direct |
| `title` / `description` | `title` | Direct |
| `issuing_agency` / `regulator` | `issuing_agency` | Direct |
| `status` | `status` | Normalize: `"Active"` → `"active"`, `"Expired"` → `"expired"`, `"Pending Renewal"` → `"pending_renewal"`, `"Suspended"` → `"suspended"` |
| `issue_date` / `effective_date` | `issue_date` | Parse date |
| `expiry_date` / `expiration_date` | `expiry_date` | Parse date |
| `conditions` (related) | `conditions` | Map to JSONB array |
| `responsible_person` | `responsible_person` | Direct |
| remaining fields | `extra_data` | Collect as JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Method |
|-----------|----------|-----------|--------|
| MOC records | 30 minutes | `modified_date` / `updated_at` via filter param | Incremental poll |
| Safety incidents | 30 minutes | `modified_date` / `updated_at` via filter param | Incremental poll |
| Inspection findings | Daily (02:00) | `modified_date` / `updated_at` via filter param | Incremental poll |
| Regulatory permits | Daily (04:00) | `modified_date` / `updated_at` via filter param | Incremental poll |

### Initial Load

1. Contact Cority account team to obtain API documentation and provision API credentials
2. Run schema discovery against available endpoints to verify field names and entity structure
3. Full sync per entity type, paginating through all records
4. Start with MOC and incidents (highest operational value)
5. Store latest watermark per entity for incremental syncs
6. Expected volumes: similar to other EHS platforms (hundreds to low thousands per entity type at a typical refinery)

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "rest_json",
  "name": "Cority EHS Platform",
  "base_url": "https://{{CORITY_INSTANCE}}.cority.com/api/v1",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "https://{{CORITY_INSTANCE}}.cority.com/oauth/token",
    "client_id": "{{CORITY_CLIENT_ID}}",
    "client_secret": "{{CORITY_CLIENT_SECRET}}"
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
    "watermark_field": "updated_at",
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
    "watermark_field": "updated_at",
    "filter_param": "modifiedSince",
    "format": "iso8601"
  },
  "schedule": "*/30 * * * *",
  "target_table": "safety_incidents",
  "upsert_key": "external_id"
}
```

### Source Config — Inspection Findings

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/audits/findings",
  "method": "GET",
  "pagination": {
    "type": "offset",
    "offset_param": "offset",
    "limit_param": "limit",
    "page_size": 100
  },
  "incremental": {
    "watermark_field": "updated_at",
    "filter_param": "modifiedSince",
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
    {"source": "id", "target": "external_id", "transform": "to_string"},
    {"source": null, "target": "source_system", "transform": "static", "value": "cority"},
    {"source": "moc_number", "target": "moc_number"},
    {"source": "title", "target": "title"},
    {"source": "description", "target": "description"},
    {"source": "status", "target": "status", "transform": "status_map", "map": {"Draft": "draft", "Submitted": "submitted", "Pending": "submitted", "Under Review": "under_review", "In Review": "under_review", "Approved": "approved", "Implemented": "implemented", "In Progress": "implemented", "Closed": "closed", "Completed": "closed", "Rejected": "rejected", "Cancelled": "rejected"}},
    {"source": "change_type", "target": "category", "transform": "status_map", "map": {"Process": "process", "Process Change": "process", "Equipment": "equipment", "Equipment Change": "equipment", "Procedure": "procedure", "Procedural": "procedure", "Organizational": "organization", "Personnel": "organization", "Temporary": "temporary", "Temporary Change": "temporary"}},
    {"source": "risk_level", "target": "risk_level", "transform": "lowercase"},
    {"source": "originator", "target": "originator"},
    {"source": "approved_by", "target": "approver"},
    {"source": "submitted_date", "target": "submitted_at", "transform": "parse_iso8601"},
    {"source": "approved_date", "target": "approved_at", "transform": "parse_iso8601"},
    {"source": "implementation_due_date", "target": "implementation_due_at", "transform": "parse_iso8601"},
    {"source": "closed_date", "target": "closed_at", "transform": "parse_iso8601"},
    {"source": "affected_equipment", "target": "affected_equipment_ids", "transform": "tag_to_uuid_array"},
    {"source": "$remaining", "target": "extra_data", "transform": "collect_unmapped"}
  ]
}
```

## Notes

- **API documentation is not publicly available.** Cority requires customer portal access or direct engagement with their account/integration team to obtain API docs. Budget time for this coordination during implementation planning.
- **Cority Connect**: Cority's integration platform (formerly "Cority API Gateway") provides the REST API surface. Enterprise-tier customers typically have access. Lower tiers may require the Cority Connect add-on.
- **Enviance acquisition**: Cority acquired Enviance (environmental compliance platform) in 2019. Environmental and permit data may come through Enviance-heritage endpoints with different field naming than the core Cority incident/MOC modules. Verify during setup.
- **Occupational health strength**: Cority's Medgate heritage means their occupational health and industrial hygiene modules are particularly strong. While not directly relevant to I/O's process monitoring focus, exposure monitoring data from industrial hygiene could be imported as a future enhancement.
- **CSV/Excel export as fallback**: If real-time API access proves difficult to establish, Cority supports scheduled CSV/Excel exports from most modules. I/O's file-based connector can consume these as a lower-fidelity alternative to API polling. Daily CSV export is a viable interim path while API access is being provisioned.
- **Schema discovery is essential.** Since field names are not publicly documented, run discovery against all target endpoints during connection setup. The import wizard's schema discovery step is critical for Cority integrations.
- **Estimated endpoint patterns**: All endpoint URLs in this profile are estimates based on typical REST conventions. The actual paths, parameter names, and response structures must be confirmed with Cority documentation.
