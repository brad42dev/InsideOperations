# Enablon (Wolters Kluwer) — Environmental Monitoring & Compliance Connector Profile

## Application Overview

- **Vendor**: Wolters Kluwer (Enablon product line)
- **Product**: Enablon Vision Platform (SaaS, Azure-hosted)
- **Market Position**: Enterprise-grade EHS/ESG platform. Strong in large multinationals, oil majors, and chemical companies. Differentiator is Wolters Kluwer's deep regulatory content library covering 200+ countries. Target market is large enterprises with complex, multi-jurisdiction compliance needs.
- **Licensing**: Commercial SaaS subscription. The "Enablon Open Insights" integration layer may require additional licensing beyond the base platform. Confirm during procurement.
- **Typical Refinery Deployment**: Environmental, safety, and sustainability teams at large refining companies use Enablon for emissions management, compliance calendars, audit programs, waste tracking, incident investigations, regulatory obligation tracking, and ESG reporting. Common at oil majors (Shell, BP, TotalEnergies-scale operations) where multi-site, multi-jurisdiction regulatory coverage is critical.

## API Surface

- **API Type**: REST (HTTPS) via Enablon Open Insights integration layer, JSON payloads
- **Base URL**: `https://{tenant}.enablon.com/api/openinsights/v1/`
- **Authentication**: OAuth 2.0 Bearer token via OIDC. SAML federation supported for enterprise SSO. Service-to-service integration uses client credentials with API tokens.
- **Pagination**: Offset-based (`?offset=0&limit=100`)
- **Rate Limits**: Enterprise contract dependent (not publicly documented)
- **Key Endpoints**:
  - `/data/environmental/emissions` -- emissions metrics and calculations
  - `/data/environmental/compliance` -- compliance calendars and obligation tracking
  - `/data/environmental/waste` -- waste generation, tracking, and manifests
  - `/data/environmental/water` -- water usage and discharge monitoring
  - `/data/environmental/permits` -- permit records and conditions
  - `/exports/{reportId}` -- scheduled report data exports (async)
- **API Documentation**: Limited public documentation. Enterprise customers receive access through Wolters Kluwer's support portal. Integration guidance via the Open Insights product page.
- **Date Format**: ISO 8601 timestamps (UTC)

## Target Tables

| Priority | I/O Table | Enablon Data Source |
|---|---|---|
| Primary | `emissions_events` | `/data/environmental/emissions` -- emission events, exceedances, calculated emissions |
| Primary | `compliance_records` | `/data/environmental/compliance` -- compliance obligations, audits, inspections |
| Primary | `permits` | `/data/environmental/permits` -- permits and conditions |
| Primary | `waste_manifests` | `/data/environmental/waste` -- waste tracking and manifest records |
| Secondary | `ambient_monitoring` | `/data/environmental/water` -- wastewater discharge monitoring (if applicable) |
| Secondary | `ldar_records` | Not a primary Enablon capability. Use LeakDAS/Guideware CSV import. |

## Field Mapping

### emissions_events

| Enablon Field | I/O Column | Transform |
|---|---|---|
| `recordId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'enablon'` |
| `emissionSource` | `source_name` | Direct |
| `pollutant` | `parameter_name` | Direct (standard codes) |
| `emissionValue` | `value` | Cast to DOUBLE PRECISION |
| `unit` | `unit` | Normalize: `'lbs/hr'` → `'lbs_per_hr'`, `'metric tons'` → `'metric_tons'` |
| `regulatoryLimit` | `regulatory_limit` | Cast to DOUBLE PRECISION; NULL if none |
| `isExceedance` | `exceedance` | Direct BOOLEAN |
| `eventDate` | `event_time` | Parse ISO 8601 to TIMESTAMPTZ |
| `durationMinutes` | `duration_minutes` | Direct |
| `causeCategory` | `cause` | Normalize to lowercase snake_case |
| `correctiveAction` | `corrective_action` | Direct |
| `reportingStatus` | `reported` | Map: `'Reported'`/`'Submitted'`/`'Closed'` → `true`, others → `false` |
| `sourceType`, `processUnit`, `calculationMethod`, `jurisdiction`, `regulatoryFramework`, `riskAssessmentRef` | `extra_data` | Pack into JSONB |

### compliance_records

| Enablon Field | I/O Column | Transform |
|---|---|---|
| `recordId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'enablon'` |
| `obligationType` | `record_type` | Normalize: `'Inspection'` → `'inspection'`, `'Audit'` → `'audit'`, `'Certification'` → `'certification'`, `'Violation'` → `'violation'` |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `complianceStatus` | `status` | Normalize to lowercase |
| `regulatoryBody` | `agency` | Direct |
| `regulationReference` | `regulation_reference` | Direct |
| `dueDate` | `due_date` | Parse ISO 8601 date |
| `completedDate` | `completed_date` | Parse ISO 8601 date |
| `responsiblePerson` | `assigned_to` | Direct |
| `findingsCount` | `findings_count` | Cast to INTEGER; default 0 |
| `severity`, `frequency`, `nextReviewDate`, `corrective_action`, `jurisdiction`, `countryCode`, `auditProgramRef` | `extra_data` | Pack into JSONB |

### permits

| Enablon Field | I/O Column | Transform |
|---|---|---|
| `permitId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'enablon'` |
| `permitType` | `permit_type` | Normalize to snake_case |
| `permitNumber` | `permit_number` | Direct |
| `title` | `title` | Direct |
| `issuingAgency` | `issuing_agency` | Direct |
| `status` | `status` | Normalize: `'Active'` → `'active'`, `'Expired'` → `'expired'`, `'Pending Renewal'` → `'pending_renewal'`, `'Suspended'` → `'suspended'` |
| `issueDate` | `issue_date` | Parse ISO 8601 date |
| `expirationDate` | `expiry_date` | Parse ISO 8601 date |
| `conditions` | `conditions` | Map to JSONB array |
| `applicableUnits`, `jurisdiction`, `countryCode`, `regulationCitation` | `extra_data` | Pack into JSONB |

### waste_manifests

| Enablon Field | I/O Column | Transform |
|---|---|---|
| `wasteRecordId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'enablon'` |
| `manifestNumber` | `manifest_number` | Direct |
| `wasteCodes` | `waste_code` | Join array to comma-separated TEXT |
| `wasteDescription` | `waste_description` | Direct |
| `quantity` | `quantity` | Cast to DOUBLE PRECISION |
| `quantityUnit` | `unit` | Normalize to lowercase |
| `generatorName` | `generator_name` | Direct |
| `transporterName` | `transporter_name` | Direct |
| `destinationFacility` | `destination_facility` | Direct |
| `shipDate` | `ship_date` | Parse ISO 8601 date |
| `receivedDate` | `receipt_date` | Parse ISO 8601 date |
| `wasteType`, `generatorId`, `transporterId`, `destinationId`, `containerType`, `containerCount`, `disposalMethod`, `status`, `hazardClass` | `extra_data` | Pack into JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Notes |
|---|---|---|---|
| Emissions events | Daily | `lastModifiedDate` | Enablon Open Insights is designed for batch integration, not real-time. Daily batch is the recommended cadence. |
| Compliance records | Daily | `lastModifiedDate` | Compliance calendar changes infrequently. |
| Permits | Weekly | `lastModifiedDate` | Permits change rarely. |
| Waste manifests | Daily | `lastModifiedDate` | Track manifests from creation through disposal confirmation. |

**Initial Load**: Full sync with `offset=0`, paginate through all records. For emissions, limit to current reporting year. For permits, filter to active/pending status.

**Async Report Export Path**: For bulk data that is not efficiently served by the REST endpoints, Enablon supports scheduled report exports. The workflow is:
1. Trigger report generation: `POST /exports/{reportId}/generate`
2. Poll for completion: `GET /exports/{reportId}/status` (returns `pending`, `processing`, `complete`, `failed`)
3. Download result: `GET /exports/{reportId}/download` (CSV or JSON)

This is useful for large historical data pulls (e.g., 5 years of emissions history for initial load) where paginating through the REST API would be slow.

**Dual-Path CEMS Note**: Enablon is not a CEMS or DAHS system. It may contain aggregated emissions data derived from CEMS measurements (e.g., annual emission totals by source), but not hourly regulatory CEMS data. Use the direct DAHS file/database import for regulatory CEMS data. Enablon's emissions data is typically calculated from emission factors, material balances, and CEMS summaries -- useful for the complete emissions inventory picture but not for real-time or hourly compliance tracking.

## Pre-Built Import Definition

### Connection Configuration

```jsonc
{
  "connector_type": "rest_api",
  "name": "Enablon Environmental",
  "description": "Enablon (Wolters Kluwer) EHS platform via Open Insights — emissions, compliance, permits, waste",
  "connection": {
    "base_url": "https://${ENABLON_TENANT}.enablon.com/api/openinsights/v1",
    "auth": {
      "type": "oauth2_client_credentials",
      "token_url": "https://${ENABLON_TENANT}.enablon.com/oauth2/token",
      "client_id": "${ENABLON_CLIENT_ID}",
      "client_secret": "${ENABLON_CLIENT_SECRET}",
      "scope": "openinsights.read"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 60,
    "retry": {
      "max_attempts": 3,
      "backoff_seconds": 10
    }
  }
}
```

### Source Configurations

#### Emissions Events

```jsonc
{
  "source_id": "enablon_emissions_events",
  "target_table": "emissions_events",
  "endpoint": "/data/environmental/emissions",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "limit": 100,
    "offset": "${OFFSET}"
  },
  "pagination": {
    "type": "offset",
    "page_size": 100,
    "max_pages": 200
  },
  "schedule": "0 0 * * *",
  "watermark": {
    "column": "updated_at",
    "type": "timestamp",
    "source_field": "lastModifiedDate"
  },
  "field_mapping": [
    { "source": "recordId",          "target": "external_id",       "transform": "to_string" },
    { "source": null,                "target": "source_system",     "transform": "constant('enablon')" },
    { "source": "emissionSource",    "target": "source_name",       "transform": null },
    { "source": "pollutant",         "target": "parameter_name",    "transform": null },
    { "source": "emissionValue",     "target": "value",             "transform": "to_float" },
    { "source": "unit",              "target": "unit",              "transform": "normalize_unit" },
    { "source": "regulatoryLimit",   "target": "regulatory_limit",  "transform": "to_float" },
    { "source": "isExceedance",      "target": "exceedance",        "transform": null },
    { "source": "eventDate",         "target": "event_time",        "transform": "parse_iso8601" },
    { "source": "durationMinutes",   "target": "duration_minutes",  "transform": "to_float" },
    { "source": "causeCategory",     "target": "cause",             "transform": "to_snake_case" },
    { "source": "correctiveAction",  "target": "corrective_action", "transform": null },
    { "source": "reportingStatus",   "target": "reported",          "transform": "rhai: value == 'Reported' || value == 'Submitted' || value == 'Closed'" }
  ],
  "extra_data_fields": [
    "sourceType", "processUnit", "calculationMethod", "jurisdiction",
    "regulatoryFramework", "riskAssessmentRef"
  ]
}
```

#### Compliance Records

```jsonc
{
  "source_id": "enablon_compliance_records",
  "target_table": "compliance_records",
  "endpoint": "/data/environmental/compliance",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "limit": 100,
    "offset": "${OFFSET}"
  },
  "pagination": { "type": "offset", "page_size": 100 },
  "schedule": "0 0 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModifiedDate" },
  "field_mapping": [
    { "source": "recordId",            "target": "external_id",          "transform": "to_string" },
    { "source": null,                  "target": "source_system",        "transform": "constant('enablon')" },
    { "source": "obligationType",      "target": "record_type",          "transform": "to_lowercase" },
    { "source": "title",               "target": "title",                "transform": null },
    { "source": "description",         "target": "description",          "transform": null },
    { "source": "complianceStatus",    "target": "status",               "transform": "to_lowercase" },
    { "source": "regulatoryBody",      "target": "agency",               "transform": null },
    { "source": "regulationReference", "target": "regulation_reference",  "transform": null },
    { "source": "dueDate",            "target": "due_date",              "transform": "parse_iso8601_date" },
    { "source": "completedDate",       "target": "completed_date",       "transform": "parse_iso8601_date" },
    { "source": "responsiblePerson",   "target": "assigned_to",          "transform": null },
    { "source": "findingsCount",       "target": "findings_count",       "transform": "to_integer" }
  ],
  "extra_data_fields": [
    "severity", "frequency", "nextReviewDate", "correctiveAction",
    "jurisdiction", "countryCode", "auditProgramRef"
  ]
}
```

#### Permits

```jsonc
{
  "source_id": "enablon_permits",
  "target_table": "permits",
  "endpoint": "/data/environmental/permits",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "limit": 100,
    "offset": "${OFFSET}"
  },
  "pagination": { "type": "offset", "page_size": 100 },
  "schedule": "0 3 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModifiedDate" },
  "field_mapping": [
    { "source": "permitId",        "target": "external_id",     "transform": "to_string" },
    { "source": null,              "target": "source_system",   "transform": "constant('enablon')" },
    { "source": "permitType",      "target": "permit_type",     "transform": "to_snake_case" },
    { "source": "permitNumber",    "target": "permit_number",   "transform": null },
    { "source": "title",           "target": "title",           "transform": null },
    { "source": "issuingAgency",   "target": "issuing_agency",  "transform": null },
    { "source": "status",          "target": "status",          "transform": "to_snake_case" },
    { "source": "issueDate",       "target": "issue_date",      "transform": "parse_iso8601_date" },
    { "source": "expirationDate",  "target": "expiry_date",     "transform": "parse_iso8601_date" },
    { "source": "conditions",      "target": "conditions",      "transform": "to_jsonb" }
  ],
  "extra_data_fields": ["applicableUnits", "jurisdiction", "countryCode", "regulationCitation"]
}
```

#### Waste Manifests

```jsonc
{
  "source_id": "enablon_waste_manifests",
  "target_table": "waste_manifests",
  "endpoint": "/data/environmental/waste",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "limit": 100,
    "offset": "${OFFSET}"
  },
  "pagination": { "type": "offset", "page_size": 100 },
  "schedule": "0 1 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModifiedDate" },
  "field_mapping": [
    { "source": "wasteRecordId",       "target": "external_id",          "transform": "to_string" },
    { "source": null,                  "target": "source_system",        "transform": "constant('enablon')" },
    { "source": "manifestNumber",      "target": "manifest_number",      "transform": null },
    { "source": "wasteCodes",          "target": "waste_code",           "transform": "rhai: value.join(', ')" },
    { "source": "wasteDescription",    "target": "waste_description",    "transform": null },
    { "source": "quantity",            "target": "quantity",             "transform": "to_float" },
    { "source": "quantityUnit",        "target": "unit",                "transform": "to_lowercase" },
    { "source": "generatorName",       "target": "generator_name",       "transform": null },
    { "source": "transporterName",     "target": "transporter_name",     "transform": null },
    { "source": "destinationFacility", "target": "destination_facility",  "transform": null },
    { "source": "shipDate",            "target": "ship_date",            "transform": "parse_iso8601_date" },
    { "source": "receivedDate",        "target": "receipt_date",         "transform": "parse_iso8601_date" }
  ],
  "extra_data_fields": [
    "wasteType", "generatorId", "transporterId", "destinationId",
    "containerType", "containerCount", "disposalMethod", "status", "hazardClass"
  ]
}
```

## Notes

- **Limited public API documentation**: This is the primary integration challenge with Enablon. Unlike Intelex (public developer portal, Postman collection) or Cority (Swagger docs), Enablon's API documentation is gated behind enterprise customer access. Plan for vendor engagement during connector setup -- you will need Enablon's integration team to provide endpoint details and confirm field names.
- **Open Insights licensing**: The Open Insights integration layer may be a separate line item on the Enablon contract. Confirm API access is included before planning the integration. Without Open Insights, the only data extraction path is scheduled report exports (CSV/Excel) from the Enablon UI.
- **Batch-oriented design**: Open Insights is designed for batch data exchange, not real-time querying. Daily sync is the natural cadence. Do not attempt high-frequency polling (sub-hourly) -- the API is not optimized for it and may trigger rate limiting.
- **Higher timeout**: The connection config uses 60s timeout (vs. 30s for other connectors) because Enablon's Open Insights queries can be slower, especially for large datasets with complex filtering. The API may build on-demand data views rather than serving from pre-indexed tables.
- **Multi-jurisdiction strength**: Enablon's regulatory content library (200+ countries) means the compliance records may include jurisdiction-specific fields and regulatory framework references. These are packed into `extra_data` but could be valuable for multi-site refinery operators with global compliance requirements.
- **SAML/OIDC complexity**: For service-to-service integration, OAuth 2.0 client credentials is the path. However, if the customer's Enablon instance uses SAML federation exclusively, the token acquisition flow may require additional configuration (e.g., SAML assertion exchange for an OAuth token). This is an enterprise SSO integration pattern that may need the customer's identity team.
- **No LDAR or CEMS**: Like Sphera, Enablon is not a CEMS or LDAR system. It contains aggregated environmental data, not the raw monitoring records. Use direct DAHS and LeakDAS/Guideware imports for those data types.
- **Report export as fallback**: If the REST API does not expose a needed data entity, the async report export path (`/exports/{reportId}`) can generate CSV or JSON files. This adds latency (minutes to generate) but works for bulk historical data or data entities not yet covered by the Open Insights API.
