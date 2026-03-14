# Enablon (Wolters Kluwer) — Regulatory / Compliance Connector Profile

## Application Overview

- **Vendor**: Wolters Kluwer (acquired Enablon 2018)
- **Product**: Enablon Vision Platform
- **Market Position**: Strong in integrated EHS + ESG for large multinationals. Major oil & gas customers include Total, Shell, Chevron. Particularly strong in environmental compliance (EPA Title V, RCRA) and incident management. Good European and global presence.
- **Licensing**: API access is part of the Vision Platform tier. Enablon Hub Self-Service Development Kit for integration development. Contract-dependent API access.
- **Typical Deployment**: Cloud SaaS (Enablon Vision Platform). Some legacy on-premise deployments exist. Refinery EHS teams use Enablon for incident management, MOC, audits, environmental reporting (emissions, waste), and permit compliance.

## API Surface

- **Type**: REST/JSON (preferred), OData v4 (structured queries), SOAP/XML (legacy)
- **Base URL**: `https://{instance}.enablon.com/api/odata/v4/{module}`
- **Auth**: Token-based — `POST /api/auth/token` with API key in header. Some deployments use OAuth 2.0 (client credentials).
- **Pagination**: OData `$top` / `$skip` or server-driven `@odata.nextLink` continuation tokens
- **Incremental Sync**: OData `$filter=ModifiedDate gt {datetime}`
- **Rate Limits**: Not publicly documented. HTTP 429 standard response.
- **API Docs**: Enablon Hub developer portal (requires login; no public URL for full documentation)

### Key Endpoints

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/Incidents` | Incidents and near-misses |
| GET | `/ManagementOfChange` | MOC records |
| GET | `/Audits` | Audit and inspection records |
| GET | `/CorrectiveActions` | Action items across all modules |
| GET | `/EnvironmentalData` | Emissions, waste, permit data |

## Target Tables

| I/O Table | Primary / Secondary | Data Sourced |
|-----------|-------------------|--------------|
| `moc_records` | Primary | `/ManagementOfChange` endpoint |
| `safety_incidents` | Primary | `/Incidents` endpoint |
| `inspection_findings` | Primary | `/Audits` endpoint |
| `regulatory_permits` | Primary | `/EnvironmentalData` endpoint (permit conditions) |
| `risk_assessments` | Secondary | `/Audits` endpoint (PHA/risk review records) |

## Field Mapping — MOC Records

| Enablon Field | I/O `moc_records` Column | Transform |
|--------------|--------------------------|-----------|
| `MOCId` | `external_id` | Cast to string |
| (static) | `source_system` | `"enablon"` |
| `MOCNumber` / `ReferenceNumber` | `moc_number` | Direct |
| `Title` | `title` | Direct |
| `Description` | `description` | Direct |
| `Status` | `status` | Normalize (see table below) |
| `ChangeCategory` | `category` | Normalize (see table below) |
| `RiskLevel` | `risk_level` | Normalize: `"High"` → `"high"`, `"Medium"` → `"medium"`, `"Low"` → `"low"` |
| `Originator` / `RequestedBy` | `originator` | Direct |
| `ApprovedBy` | `approver` | Direct |
| `SubmissionDate` | `submitted_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ApprovalDate` | `approved_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ImplementationDueDate` | `implementation_due_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ClosureDate` | `closed_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `AffectedEquipment` (related entity) | `affected_equipment_ids` | Use `$expand=AffectedEquipment`; lookup tags → UUID via `points_metadata` |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

### MOC Status Normalization

| Enablon `Status` | I/O `status` |
|------------------|--------------|
| `Draft` | `draft` |
| `Submitted` / `Pending Approval` | `submitted` |
| `Under Review` | `under_review` |
| `Approved` | `approved` |
| `Implementation` / `In Progress` | `implemented` |
| `Closed` / `Completed` | `closed` |
| `Rejected` / `Cancelled` | `rejected` |

### MOC Category Normalization

| Enablon `ChangeCategory` | I/O `category` |
|--------------------------|----------------|
| `Process` / `Process Change` | `process` |
| `Equipment` / `Equipment Modification` | `equipment` |
| `Procedure` / `Procedural Change` | `procedure` |
| `Organizational` / `Personnel Change` | `organization` |
| `Temporary` / `Temporary Modification` | `temporary` |

## Field Mapping — Safety Incidents

| Enablon Field | I/O `safety_incidents` Column | Transform |
|--------------|-------------------------------|-----------|
| `IncidentId` | `external_id` | Cast to string |
| (static) | `source_system` | `"enablon"` |
| `IncidentNumber` / `ReferenceNumber` | `incident_number` | Direct |
| `Title` / `Summary` | `title` | Direct |
| `Description` | `description` | Direct |
| `IncidentCategory` | `incident_type` | Normalize (see table below) |
| `SeverityLevel` | `severity` | Normalize (see table below) |
| `Status` | `status` | Normalize: `"Open"` / `"Reported"` → `"reported"`, `"Investigation"` → `"under_investigation"`, `"Corrective Action"` → `"corrective_action"`, `"Closed"` → `"closed"` |
| `Location` / `Facility` | `location` | Direct |
| `Area` / `Unit` | `area` | Direct |
| `IncidentDate` | `occurred_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ReportedDate` | `reported_at` | Parse ISO 8601 → TIMESTAMPTZ |
| `ReportedBy` | `reported_by` | Direct |
| `RootCause` | `root_cause` | Direct |
| Related `CorrectiveActions` | `corrective_actions` | Use `$expand=CorrectiveActions`; map to JSONB array |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

### Incident Type Normalization

| Enablon `IncidentCategory` | I/O `incident_type` |
|---------------------------|---------------------|
| `Injury` / `Occupational Injury` | `injury` |
| `Near Miss` | `near_miss` |
| `Property Damage` / `Asset Damage` | `property_damage` |
| `Environmental Release` / `Spill` | `environmental_release` |
| `Process Safety Event` | `process_safety` |
| `Fire` / `Explosion` | `fire` |

### Severity Normalization

| Enablon `SeverityLevel` | I/O `severity` |
|------------------------|----------------|
| `Catastrophic` / `Level 5` | `catastrophic` |
| `Major` / `Level 4` | `major` |
| `Moderate` / `Level 3` | `moderate` |
| `Minor` / `Level 2` | `minor` |
| `Negligible` / `Level 1` | `negligible` |

## Field Mapping — Inspection Findings (from Audits)

| Enablon Field | I/O `inspection_findings` Column | Transform |
|--------------|----------------------------------|-----------|
| `AuditFindingId` | `external_id` | Cast to string |
| (static) | `source_system` | `"enablon"` |
| `AuditType` | `inspection_type` | Normalize: `"Regulatory Audit"` → `"regulatory"`, `"Internal Audit"` → `"internal"`, `"Insurance Review"` → `"insurance"`, `"Mechanical Integrity"` → `"mechanical_integrity"` |
| `FindingTitle` | `title` | Direct |
| `FindingDescription` | `description` | Direct |
| `Severity` / `Priority` | `finding_type` | Normalize: `"Critical"` → `"critical_finding"`, `"Major"` → `"major_finding"`, `"Minor"` → `"minor_finding"`, `"Observation"` → `"observation"` |
| `Status` | `status` | Normalize: `"Open"` → `"open"`, `"In Progress"` → `"in_progress"`, `"Closed"` / `"Verified"` → `"closed"`, `"Overdue"` → `"overdue"` |
| `EquipmentReference` | `equipment_id` | Lookup tag → UUID; null if unresolved |
| `AssignedTo` | `assigned_to` | Direct |
| `DueDate` | `due_date` | Parse date |
| `ClosureDate` | `closed_date` | Parse date |
| `RegulatoryReference` | `regulation_reference` | Direct |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## Field Mapping — Regulatory Permits

Enablon's environmental compliance module tracks permit conditions. This is Enablon's particular strength for EPA-regulated refineries.

| Enablon Field | I/O `regulatory_permits` Column | Transform |
|--------------|----------------------------------|-----------|
| `PermitId` / `ConditionId` | `external_id` | Cast to string |
| (static) | `source_system` | `"enablon"` |
| `PermitType` | `permit_type` | Direct (e.g., `"Title V"`, `"NPDES"`, `"RCRA"`, `"State Air"`) |
| `PermitNumber` | `permit_number` | Direct |
| `PermitTitle` / `Description` | `title` | Direct |
| `IssuingAgency` / `Regulator` | `issuing_agency` | Direct |
| `ComplianceStatus` | `status` | Normalize: `"Active"` / `"Compliant"` → `"active"`, `"Expired"` → `"expired"`, `"Pending Renewal"` → `"pending_renewal"`, `"Suspended"` / `"Non-Compliant"` → `"suspended"` |
| `IssueDate` / `EffectiveDate` | `issue_date` | Parse date |
| `ExpirationDate` | `expiry_date` | Parse date |
| `Conditions` (related entity) | `conditions` | Use `$expand=Conditions`; map to JSONB array `[{number, description, parameter, limit_value, unit}]` |
| `ResponsiblePerson` | `responsible_person` | Direct |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Method |
|-----------|----------|-----------|--------|
| MOC records | 30 minutes | `ModifiedDate` via OData `$filter` | Incremental poll |
| Safety incidents | 30 minutes | `ModifiedDate` via OData `$filter` | Incremental poll |
| Audit findings | Daily (02:00) | `ModifiedDate` via OData `$filter` | Incremental poll |
| Environmental / Permits | Every 4 hours | `ModifiedDate` via OData `$filter` | Incremental poll |

### Initial Load

1. Full sync per entity type with `$orderby=ModifiedDate asc` and `$top`/`$skip` pagination
2. If server returns `@odata.nextLink`, follow continuation tokens instead of manual `$skip`
3. Start with MOC and incidents (highest operational value), then permits, then audits
4. Store latest `ModifiedDate` per entity as watermark

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "rest_json",
  "name": "Enablon Vision Platform",
  "base_url": "https://{{ENABLON_INSTANCE}}.enablon.com/api/odata/v4",
  "auth": {
    "type": "api_key",
    "header_name": "X-API-Key",
    "key": "{{ENABLON_API_KEY}}"
  },
  "auth_alternative": {
    "type": "oauth2_client_credentials",
    "token_url": "https://{{ENABLON_INSTANCE}}.enablon.com/api/auth/token",
    "client_id": "{{ENABLON_CLIENT_ID}}",
    "client_secret": "{{ENABLON_CLIENT_SECRET}}"
  },
  "default_headers": {
    "Accept": "application/json",
    "OData-Version": "4.0"
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
  "endpoint": "/ManagementOfChange",
  "method": "GET",
  "query_params": {
    "$orderby": "ModifiedDate asc"
  },
  "pagination": {
    "type": "odata",
    "page_size": 100,
    "next_link_field": "@odata.nextLink"
  },
  "incremental": {
    "watermark_field": "ModifiedDate",
    "filter_template": "$filter=ModifiedDate gt {watermark}",
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
  "endpoint": "/Incidents",
  "method": "GET",
  "query_params": {
    "$expand": "CorrectiveActions",
    "$orderby": "ModifiedDate asc"
  },
  "pagination": {
    "type": "odata",
    "page_size": 100,
    "next_link_field": "@odata.nextLink"
  },
  "incremental": {
    "watermark_field": "ModifiedDate",
    "filter_template": "$filter=ModifiedDate gt {watermark}",
    "format": "iso8601"
  },
  "schedule": "*/30 * * * *",
  "target_table": "safety_incidents",
  "upsert_key": "external_id"
}
```

### Source Config — Regulatory Permits

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/EnvironmentalData",
  "method": "GET",
  "query_params": {
    "$expand": "Conditions",
    "$filter": "RecordType eq 'Permit'",
    "$orderby": "ModifiedDate asc"
  },
  "pagination": {
    "type": "odata",
    "page_size": 100,
    "next_link_field": "@odata.nextLink"
  },
  "incremental": {
    "watermark_field": "ModifiedDate",
    "filter_template": "$filter=ModifiedDate gt {watermark} and RecordType eq 'Permit'",
    "format": "iso8601"
  },
  "schedule": "0 */4 * * *",
  "target_table": "regulatory_permits",
  "upsert_key": "external_id"
}
```

### Field Mapping Array — MOC Records

```json
{
  "field_mappings": [
    {"source": "MOCId", "target": "external_id", "transform": "to_string"},
    {"source": null, "target": "source_system", "transform": "static", "value": "enablon"},
    {"source": "MOCNumber", "target": "moc_number"},
    {"source": "Title", "target": "title"},
    {"source": "Description", "target": "description"},
    {"source": "Status", "target": "status", "transform": "status_map", "map": {"Draft": "draft", "Submitted": "submitted", "Pending Approval": "submitted", "Under Review": "under_review", "Approved": "approved", "Implementation": "implemented", "In Progress": "implemented", "Closed": "closed", "Completed": "closed", "Rejected": "rejected", "Cancelled": "rejected"}},
    {"source": "ChangeCategory", "target": "category", "transform": "status_map", "map": {"Process": "process", "Process Change": "process", "Equipment": "equipment", "Equipment Modification": "equipment", "Procedure": "procedure", "Procedural Change": "procedure", "Organizational": "organization", "Personnel Change": "organization", "Temporary": "temporary", "Temporary Modification": "temporary"}},
    {"source": "RiskLevel", "target": "risk_level", "transform": "lowercase"},
    {"source": "Originator", "target": "originator"},
    {"source": "ApprovedBy", "target": "approver"},
    {"source": "SubmissionDate", "target": "submitted_at", "transform": "parse_iso8601"},
    {"source": "ApprovalDate", "target": "approved_at", "transform": "parse_iso8601"},
    {"source": "ImplementationDueDate", "target": "implementation_due_at", "transform": "parse_iso8601"},
    {"source": "ClosureDate", "target": "closed_at", "transform": "parse_iso8601"},
    {"source": "AffectedEquipment", "target": "affected_equipment_ids", "transform": "expand_to_uuid_array"},
    {"source": "$remaining", "target": "extra_data", "transform": "collect_unmapped"}
  ]
}
```

## Notes

- **OData v4 is Enablon's primary API.** Standard OData operators (`$filter`, `$select`, `$expand`, `$orderby`, `$count`) work across all entity sets. This significantly reduces custom connector logic compared to proprietary REST APIs.
- **`@odata.nextLink` pagination**: For large result sets, Enablon returns server-driven continuation tokens instead of relying on `$skip`. The import connector must follow `@odata.nextLink` until it returns no more results. This is more reliable than offset-based pagination for datasets that change during sync.
- **Environmental compliance is Enablon's strength.** The `EnvironmentalData` entity covers emissions tracking, waste manifests, permit conditions, and regulatory reporting deadlines. For refineries with complex EPA obligations (Title V, RCRA, CERCLA/EPCRA), Enablon typically has the most complete permit data.
- **SOAP endpoint exists but avoid it.** The SOAP/XML endpoint is a legacy interface for older integrations. Always use OData v4 unless a specific module is not exposed via OData.
- **Enablon Hub SDK**: Allows registering custom entity types for non-standard modules. If the refinery has extended Enablon with custom compliance tracking, those custom entities may require Hub SDK configuration before they appear in the OData surface.
- **Auth may vary by deployment.** Older Enablon installations may use API key authentication while newer Vision Platform deployments use OAuth 2.0. The connection config includes both options — verify during setup which method the target instance supports.
