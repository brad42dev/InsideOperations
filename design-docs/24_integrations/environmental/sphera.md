# Sphera (SpheraCloud) — Environmental Monitoring & Compliance Connector Profile

## Application Overview

- **Vendor**: Sphera Solutions (formerly thinkstep, acquired by Blackstone)
- **Product**: SpheraCloud Environmental Accounting (SaaS, Azure-hosted)
- **Market Position**: Leading EHS/sustainability platform globally. Very strong in European chemicals and petroleum. Growing U.S. refinery presence. Known for product stewardship, lifecycle assessment (LCA), and sustainability reporting alongside environmental compliance. SAP-certified integration partner.
- **Licensing**: Commercial SaaS subscription. API access included in enterprise tiers -- no separate connector license for most deployments.
- **Typical Refinery Deployment**: Environmental compliance and sustainability teams use Sphera for emissions tracking (criteria pollutants, HAPs, GHGs), waste management, water discharge monitoring, regulatory obligation tracking, and sustainability metrics (GRI, CDP, SASB). Particularly common at sites with European parent companies or dual U.S./EU operations requiring EU ETS compliance.

## API Surface

- **API Type**: REST (HTTPS), JSON payloads
- **Base URL**: `https://api.spheracloud.net/v1/`
- **Authentication**: OAuth 2.0 Bearer token. Client credentials or authorization code flow. Token endpoint configured in the developer portal.
- **Pagination**: Cursor-based (`?cursor={token}&pageSize=100`)
- **Rate Limits**: Enterprise-tier dependent (not publicly documented; negotiate during procurement)
- **Key Endpoints**:
  - `/environmental/emissions` -- emission calculations (criteria pollutants, HAPs, GHGs)
  - `/environmental/compliance` -- regulatory obligations and compliance status
  - `/environmental/waste` -- waste generation, disposal, and manifest records
  - `/environmental/water` -- water usage and discharge monitoring
  - `/environmental/incidents` -- environmental incidents and spills
  - `/reports/exports` -- scheduled data exports in CSV/JSON
- **API Documentation**: Developer portal at `https://platformscdevdocs.z21.web.core.windows.net/`. Additional API login at `https://platform-api-dev.portal.azure-api.net/`.
- **Date Format**: ISO 8601 timestamps (UTC)

## Target Tables

| Priority | I/O Table | Sphera Data Source |
|---|---|---|
| Primary | `emissions_events` | `/environmental/emissions` -- emission exceedances, GHG events, calculated emissions |
| Primary | `compliance_records` | `/environmental/compliance` -- regulatory obligations, compliance calendar, audits |
| Primary | `waste_manifests` | `/environmental/waste` -- waste tracking, manifests, disposal records |
| Primary | `permits` | `/environmental/compliance` (permit-type obligations) -- permits often tracked as compliance obligations in Sphera |
| Secondary | `ambient_monitoring` | `/environmental/water` -- if Sphera manages wastewater discharge data as ambient readings |
| Secondary | `ldar_records` | Not a primary Sphera capability. Use LeakDAS/Guideware CSV import. |

## Field Mapping

### emissions_events

| Sphera Field | I/O Column | Transform |
|---|---|---|
| `emissionId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sphera'` |
| `sourceName` | `source_name` | Direct |
| `pollutantCode` | `parameter_name` | Direct (SO2, NOx, CO, VOC, PM, CO2, CH4, etc.) |
| `calculatedValue` | `value` | Cast to DOUBLE PRECISION |
| `valueUnit` | `unit` | Normalize: `'lbs/hr'` → `'lbs_per_hr'`, `'metric tons'` → `'metric_tons'` |
| `regulatoryLimit` | `regulatory_limit` | Cast to DOUBLE PRECISION; NULL if none |
| `isExceedance` | `exceedance` | Direct BOOLEAN |
| `eventTimestamp` | `event_time` | Parse ISO 8601 to TIMESTAMPTZ |
| `durationMinutes` | `duration_minutes` | Direct |
| `causeCategory` | `cause` | Normalize to lowercase snake_case |
| `correctiveAction` | `corrective_action` | Direct |
| `reportingStatus` | `reported` | Map: `'reported'`/`'submitted'`/`'closed'` → `true`, others → `false` |
| `sourceType`, `processUnit`, `calculationMethod`, `emissionFactor`, `ghgScope`, `co2eValue`, `regulatoryFramework` | `extra_data` | Pack into JSONB |

### compliance_records

| Sphera Field | I/O Column | Transform |
|---|---|---|
| `obligationId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sphera'` |
| `obligationType` | `record_type` | Normalize: `'Inspection'` → `'inspection'`, `'Audit'` → `'audit'`, `'Certification'` → `'certification'`, `'Violation'` → `'violation'` |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `status` | `status` | Normalize to lowercase |
| `regulatoryBody` | `agency` | Direct |
| `regulationReference` | `regulation_reference` | Direct |
| `dueDate` | `due_date` | Parse ISO 8601 date |
| `completedDate` | `completed_date` | Parse ISO 8601 date |
| `responsiblePerson` | `assigned_to` | Direct |
| `findingsCount` | `findings_count` | Cast to INTEGER; default 0 |
| `severity`, `frequency`, `nextReviewDate`, `correctiveAction`, `regulatoryFramework`, `sustainabilityIndicator` | `extra_data` | Pack into JSONB |

### permits

Sphera often tracks permits as compliance obligations. Permits are extracted by filtering compliance records where the obligation type maps to a permit category.

| Sphera Field | I/O Column | Transform |
|---|---|---|
| `obligationId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sphera'` |
| `permitType` | `permit_type` | Normalize to snake_case |
| `permitNumber` | `permit_number` | Direct |
| `title` | `title` | Direct |
| `regulatoryBody` | `issuing_agency` | Direct |
| `status` | `status` | Normalize: `'Active'` → `'active'`, `'Expired'` → `'expired'`, `'Pending Renewal'` → `'pending_renewal'` |
| `effectiveDate` | `issue_date` | Parse ISO 8601 date |
| `expirationDate` | `expiry_date` | Parse ISO 8601 date |
| `conditions` | `conditions` | Map to JSONB array |
| `applicableUnits`, `regulationCitation`, `jurisdiction` | `extra_data` | Pack into JSONB |

### waste_manifests

| Sphera Field | I/O Column | Transform |
|---|---|---|
| `wasteRecordId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sphera'` |
| `manifestNumber` | `manifest_number` | Direct |
| `wasteCodes` | `waste_code` | Join array to comma-separated TEXT |
| `wasteDescription` | `waste_description` | Direct |
| `quantity` | `quantity` | Cast to DOUBLE PRECISION |
| `quantityUnit` | `unit` | Normalize to lowercase |
| `generatorName` | `generator_name` | Direct |
| `transporterName` | `transporter_name` | Direct |
| `disposalFacility` | `destination_facility` | Direct |
| `shipDate` | `ship_date` | Parse ISO 8601 date |
| `receivedDate` | `receipt_date` | Parse ISO 8601 date |
| `wasteType`, `generatorId`, `transporterId`, `disposalFacilityId`, `containerType`, `containerCount`, `disposalMethod`, `status` | `extra_data` | Pack into JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Notes |
|---|---|---|---|
| Emissions events | Daily | `lastModified` | Sphera excels at calculated emissions (inventories, GHG). Daily batch is the natural cadence. |
| Compliance records | Daily | `lastModified` | Compliance calendar changes are low-frequency. |
| Permits | Weekly | `lastModified` | Extracted from compliance obligations with permit-type filter. |
| Waste manifests | Daily | `lastModified` | Tracks waste from generation through disposal confirmation. |
| Incidents | 30 min | `lastModified` | Environmental incidents need faster visibility for correlation with process events. |

**Initial Load**: Paginate through all records using cursor-based pagination. For emissions, limit to current reporting year. For compliance, pull all non-archived obligations.

**Cursor-Based Pagination**: Sphera uses opaque cursor tokens, not offset/skip. The Import Service stores the last cursor value and passes it on the next request. When the API returns no `nextCursor`, the page set is complete.

**Dual-Path CEMS Note**: Sphera is not a CEMS data system. It receives calculated emissions from the DAHS or from manual data entry. If Sphera contains CEMS-derived emission totals (e.g., annual SO2 from the FCC stack), these are aggregated values, not the hourly regulatory data from the DAHS. Use the direct DAHS file/database import for hourly CEMS regulatory data. Sphera's value is in the broader emissions inventory context -- combining CEMS, emission factors, material balances, and engineering estimates into a complete picture.

## Pre-Built Import Definition

### Connection Configuration

```jsonc
{
  "connector_type": "rest_api",
  "name": "Sphera Environmental",
  "description": "SpheraCloud Environmental Accounting — emissions, compliance, waste, incidents",
  "connection": {
    "base_url": "https://api.spheracloud.net/v1",
    "auth": {
      "type": "oauth2_client_credentials",
      "token_url": "${SPHERA_TOKEN_URL}",
      "client_id": "${SPHERA_CLIENT_ID}",
      "client_secret": "${SPHERA_CLIENT_SECRET}",
      "scope": "environmental.read"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry": {
      "max_attempts": 3,
      "backoff_seconds": 5
    }
  }
}
```

### Source Configurations

#### Emissions Events

```jsonc
{
  "source_id": "sphera_emissions_events",
  "target_table": "emissions_events",
  "endpoint": "/environmental/emissions",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "pageSize": 100
  },
  "pagination": {
    "type": "cursor",
    "cursor_param": "cursor",
    "cursor_response_path": "nextCursor",
    "page_size": 100
  },
  "schedule": "0 0 * * *",
  "watermark": {
    "column": "updated_at",
    "type": "timestamp",
    "source_field": "lastModified"
  },
  "field_mapping": [
    { "source": "emissionId",        "target": "external_id",       "transform": "to_string" },
    { "source": null,                "target": "source_system",     "transform": "constant('sphera')" },
    { "source": "sourceName",        "target": "source_name",       "transform": null },
    { "source": "pollutantCode",     "target": "parameter_name",    "transform": null },
    { "source": "calculatedValue",   "target": "value",             "transform": "to_float" },
    { "source": "valueUnit",         "target": "unit",              "transform": "normalize_unit" },
    { "source": "regulatoryLimit",   "target": "regulatory_limit",  "transform": "to_float" },
    { "source": "isExceedance",      "target": "exceedance",        "transform": null },
    { "source": "eventTimestamp",    "target": "event_time",        "transform": "parse_iso8601" },
    { "source": "durationMinutes",   "target": "duration_minutes",  "transform": "to_float" },
    { "source": "causeCategory",     "target": "cause",             "transform": "to_snake_case" },
    { "source": "correctiveAction",  "target": "corrective_action", "transform": null },
    { "source": "reportingStatus",   "target": "reported",          "transform": "rhai: value == 'reported' || value == 'submitted' || value == 'closed'" }
  ],
  "extra_data_fields": [
    "sourceType", "processUnit", "calculationMethod", "emissionFactor",
    "ghgScope", "co2eValue", "regulatoryFramework"
  ]
}
```

#### Compliance Records

```jsonc
{
  "source_id": "sphera_compliance_records",
  "target_table": "compliance_records",
  "endpoint": "/environmental/compliance",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "type": "obligation",
    "pageSize": 100
  },
  "pagination": { "type": "cursor", "cursor_param": "cursor", "page_size": 100 },
  "schedule": "0 0 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModified" },
  "field_mapping": [
    { "source": "obligationId",        "target": "external_id",          "transform": "to_string" },
    { "source": null,                  "target": "source_system",        "transform": "constant('sphera')" },
    { "source": "obligationType",      "target": "record_type",          "transform": "to_lowercase" },
    { "source": "title",               "target": "title",                "transform": null },
    { "source": "description",         "target": "description",          "transform": null },
    { "source": "status",              "target": "status",               "transform": "to_lowercase" },
    { "source": "regulatoryBody",      "target": "agency",               "transform": null },
    { "source": "regulationReference", "target": "regulation_reference",  "transform": null },
    { "source": "dueDate",            "target": "due_date",              "transform": "parse_iso8601_date" },
    { "source": "completedDate",       "target": "completed_date",       "transform": "parse_iso8601_date" },
    { "source": "responsiblePerson",   "target": "assigned_to",          "transform": null },
    { "source": "findingsCount",       "target": "findings_count",       "transform": "to_integer" }
  ],
  "extra_data_fields": [
    "severity", "frequency", "nextReviewDate", "correctiveAction",
    "regulatoryFramework", "sustainabilityIndicator"
  ]
}
```

#### Permits

```jsonc
{
  "source_id": "sphera_permits",
  "target_table": "permits",
  "endpoint": "/environmental/compliance",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "type": "permit",
    "pageSize": 100
  },
  "pagination": { "type": "cursor", "cursor_param": "cursor", "page_size": 100 },
  "schedule": "0 3 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModified" },
  "field_mapping": [
    { "source": "obligationId",    "target": "external_id",     "transform": "to_string" },
    { "source": null,              "target": "source_system",   "transform": "constant('sphera')" },
    { "source": "permitType",      "target": "permit_type",     "transform": "to_snake_case" },
    { "source": "permitNumber",    "target": "permit_number",   "transform": null },
    { "source": "title",           "target": "title",           "transform": null },
    { "source": "regulatoryBody",  "target": "issuing_agency",  "transform": null },
    { "source": "status",          "target": "status",          "transform": "to_snake_case" },
    { "source": "effectiveDate",   "target": "issue_date",      "transform": "parse_iso8601_date" },
    { "source": "expirationDate",  "target": "expiry_date",     "transform": "parse_iso8601_date" },
    { "source": "conditions",      "target": "conditions",      "transform": "to_jsonb" }
  ],
  "extra_data_fields": ["applicableUnits", "regulationCitation", "jurisdiction"]
}
```

#### Waste Manifests

```jsonc
{
  "source_id": "sphera_waste_manifests",
  "target_table": "waste_manifests",
  "endpoint": "/environmental/waste",
  "method": "GET",
  "params": {
    "modifiedAfter": "${WATERMARK}",
    "pageSize": 100
  },
  "pagination": { "type": "cursor", "cursor_param": "cursor", "page_size": 100 },
  "schedule": "0 1 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "lastModified" },
  "field_mapping": [
    { "source": "wasteRecordId",     "target": "external_id",          "transform": "to_string" },
    { "source": null,                "target": "source_system",        "transform": "constant('sphera')" },
    { "source": "manifestNumber",    "target": "manifest_number",      "transform": null },
    { "source": "wasteCodes",        "target": "waste_code",           "transform": "rhai: value.join(', ')" },
    { "source": "wasteDescription",  "target": "waste_description",    "transform": null },
    { "source": "quantity",          "target": "quantity",             "transform": "to_float" },
    { "source": "quantityUnit",      "target": "unit",                "transform": "to_lowercase" },
    { "source": "generatorName",     "target": "generator_name",       "transform": null },
    { "source": "transporterName",   "target": "transporter_name",     "transform": null },
    { "source": "disposalFacility",  "target": "destination_facility",  "transform": null },
    { "source": "shipDate",          "target": "ship_date",            "transform": "parse_iso8601_date" },
    { "source": "receivedDate",      "target": "receipt_date",         "transform": "parse_iso8601_date" }
  ],
  "extra_data_fields": [
    "wasteType", "generatorId", "transporterId", "disposalFacilityId",
    "containerType", "containerCount", "disposalMethod", "status"
  ]
}
```

## Notes

- **Sustainability strength**: Sphera's differentiator is sustainability reporting (GRI, CDP, SASB, TCFD). Emission events from Sphera often include GHG scope classification (`scope_1`, `scope_2`, `scope_3`) and CO2-equivalent values. These are packed into `extra_data` for I/O but could power GHG dashboards.
- **EU ETS compliance**: For refineries with European operations, Sphera is often the EU ETS compliance platform. EU ETS allowance data, verified emissions, and compliance status can be pulled through the compliance endpoint.
- **Azure-hosted -- network considerations**: SpheraCloud runs on Azure. If the refinery's I/O instance is also on Azure (or has Azure ExpressRoute), connectivity is straightforward. For on-premise I/O deployments, the Import Service needs outbound HTTPS to `api.spheracloud.net`.
- **Cursor pagination caveat**: The opaque cursor tokens may expire after a period of inactivity. If a long-running paginated sync is interrupted, the Import Service may need to restart from the beginning of the current sync window rather than resuming from the last cursor.
- **Permits as compliance obligations**: Sphera does not always have a separate "permits" entity. Permits are often tracked as compliance obligations with a permit-type classification. The import config uses a `type=permit` filter parameter to extract permit records from the compliance endpoint. This may need adjustment per customer's Sphera configuration.
- **Rate limit negotiation**: Sphera does not publicly document rate limits. The Import Service should implement adaptive rate limiting: start conservatively (30 req/min), observe response headers for rate limit indicators, and adjust upward if permitted.
- **No LDAR or CEMS coverage**: Sphera is not a LDAR or CEMS system. LDAR data comes from LeakDAS/Guideware. CEMS regulatory data comes from the DAHS. Sphera may contain aggregated emissions derived from CEMS data (annual totals), but not the hourly regulatory values.
- **Report export fallback**: If the REST API does not expose certain data entities, Sphera supports scheduled report exports (`/reports/exports/{reportId}`). This generates a CSV/JSON file on Sphera's side that can be downloaded by the Import Service. This is a batch-only path with higher latency.
