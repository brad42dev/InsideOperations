# Cority (Enviance) — Environmental Monitoring & Compliance Connector Profile

## Application Overview

- **Vendor**: Cority Software Inc. (acquired Enviance in 2020)
- **Product**: CorityOne SaaS platform (cloud-hosted)
- **Market Position**: Major player in oil & gas EHS. Enviance was the dominant environmental-specific platform in U.S. petroleum refining. 400+ organizations across 30+ industries.
- **Licensing**: Commercial SaaS subscription. REST API access requires a separate "Cority Enviance Connectors" license -- this is a procurement item, not a technical blocker.
- **Typical Refinery Deployment**: Environmental compliance team uses Cority for emissions tracking, permit management, waste manifests, regulatory submissions, and LDAR program oversight. Frequently the system of record for air quality compliance, waste tracking, and fenceline monitoring results.

## API Surface

- **API Type**: REST (HTTPS), JSON payloads
- **Base URL**: `https://{tenant}.enviance.com/api/v2/`
- **Authentication**: OAuth 2.0 Bearer token via client credentials flow. Token endpoint: `https://{tenant}.enviance.com/oauth/token`. Requires `client_id` and `client_secret` from the Connectors license.
- **Pagination**: Offset-based (`?offset=0&limit=100`), max 1000 per page
- **Rate Limits**: Contract-dependent, typically 60-120 requests/min
- **Key Endpoints**:
  - `/emissions/events` -- emission events with calculations
  - `/compliance/tasks` -- compliance obligations and status
  - `/permits` -- permit details and conditions
  - `/waste/manifests` -- waste tracking and manifest records
  - `/air/monitoring` -- CEMS summary data and ambient readings
  - `/water/discharge` -- wastewater monitoring data
  - `/ldar/inspections` -- LDAR monitoring results
  - `/reports/scheduled` -- pre-built report data exports
- **API Documentation**: Swagger docs at `https://api.enviance.com/`
- **Date Format**: ISO 8601 timestamps (UTC)

## Target Tables

| Priority | I/O Table | Cority Data Source |
|---|---|---|
| Primary | `emissions_events` | `/emissions/events` -- emission exceedances, flare events, excess emission reports |
| Primary | `compliance_records` | `/compliance/tasks` -- compliance obligations, inspections, audits, violations |
| Primary | `permits` | `/permits` -- air operating permits, NPDES, RCRA, PSD permits |
| Primary | `waste_manifests` | `/waste/manifests` -- hazardous and non-hazardous waste tracking |
| Secondary | `ambient_monitoring` | `/air/monitoring` -- fenceline results, ambient station data (if managed in Cority) |
| Secondary | `ldar_records` | `/ldar/inspections` -- LDAR monitoring results (if Cority manages LDAR instead of LeakDAS) |

## Field Mapping

### emissions_events

| Cority Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'cority'` |
| `source.name` | `source_name` | Direct |
| `pollutant.code` | `parameter_name` | Direct (already standard codes: SO2, NOx, CO, etc.) |
| `quantity.value` | `value` | Cast to DOUBLE PRECISION |
| `quantity.uom` | `unit` | Normalize: `'lbs/hr'` → `'lbs_per_hr'`, `'tons/yr'` → `'tons_per_yr'` |
| `exceedance.limit` | `regulatory_limit` | Cast to DOUBLE PRECISION; NULL if no limit applies |
| `exceedance.exceeded` | `exceedance` | Direct BOOLEAN |
| `startTime` | `event_time` | Parse ISO 8601 to TIMESTAMPTZ |
| `durationMinutes` | `duration_minutes` | Direct; or calculate from `endTime - startTime` if absent |
| `causeCategory` | `cause` | Normalize: `'Startup'` → `'startup'`, `'Malfunction'` → `'malfunction'` |
| `correctiveAction` | `corrective_action` | Direct |
| `reportingStatus` | `reported` | Map: `'submitted'`/`'closed'` → `true`, all others → `false` |
| `source.type`, `processUnit`, `rootCause`, `calculationMethod`, `emissionFactorId`, `regulatoryReportId` | `extra_data` | Pack remaining fields into JSONB |

### compliance_records

| Cority Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'cority'` |
| `taskType` | `record_type` | Normalize: `'Inspection'` → `'inspection'`, `'Audit'` → `'audit'`, `'Certification'` → `'certification'`, `'Violation'` → `'violation'` |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `complianceStatus` | `status` | Normalize to lowercase: `'Compliant'` → `'compliant'`, `'Non-Compliant'` → `'non_compliant'`, `'Pending'` → `'pending'` |
| `regulatoryBody` | `agency` | Direct |
| `regulationCitation` | `regulation_reference` | Direct |
| `dueDate` | `due_date` | Parse ISO 8601 date |
| `completedDate` | `completed_date` | Parse ISO 8601 date; NULL if not completed |
| `responsiblePerson` | `assigned_to` | Direct |
| `findingsCount` | `findings_count` | Cast to INTEGER; default 0 |
| `permitNumber`, `severity`, `frequency`, `correctiveAction`, `documentationLinks` | `extra_data` | Pack into JSONB |

### permits

| Cority Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'cority'` |
| `permitType` | `permit_type` | Normalize: `'Air Operating'` → `'air_operating'`, `'NPDES'` → `'npdes'`, `'RCRA'` → `'rcra'`, `'PSD'` → `'psd'` |
| `permitNumber` | `permit_number` | Direct |
| `title` | `title` | Direct |
| `regulatoryBody` | `issuing_agency` | Direct |
| `status` | `status` | Normalize: `'Active'` → `'active'`, `'Expired'` → `'expired'`, `'Pending Renewal'` → `'pending_renewal'`, `'Suspended'` → `'suspended'` |
| `issueDate` | `issue_date` | Parse ISO 8601 date |
| `expirationDate` | `expiry_date` | Parse ISO 8601 date; NULL if no expiration |
| `conditions[]` | `conditions` | Map array to JSONB array of `{number, type, description, limit_value, limit_unit}` |
| `applicableUnits`, `regulationCitation`, `contactPerson` | `extra_data` | Pack into JSONB |

### waste_manifests

| Cority Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'cority'` |
| `trackingNumber` | `manifest_number` | Direct (12-digit EPA manifest tracking number) |
| `wasteCodes` | `waste_code` | Join array: `['D001','D002']` → `'D001, D002'` |
| `wasteDescription` | `waste_description` | Direct |
| `quantity.value` | `quantity` | Cast to DOUBLE PRECISION |
| `quantity.uom` | `unit` | Normalize: `'Gallons'` → `'gallons'`, `'Pounds'` → `'lbs'`, `'Tons'` → `'tons'` |
| `generator.name` | `generator_name` | Direct |
| `transporter.name` | `transporter_name` | Direct |
| `tsdf.name` | `destination_facility` | Direct |
| `shipDate` | `ship_date` | Parse ISO 8601 date |
| `receivedDate` | `receipt_date` | Parse ISO 8601 date; NULL if not yet received |
| `manifestType`, `generatorEpaId`, `transporterEpaId`, `tsdfEpaId`, `containerType`, `containerCount`, `dotDescription`, `status` | `extra_data` | Pack into JSONB |

### ambient_monitoring

| Cority Field | I/O Column | Transform |
|---|---|---|
| `stationId` | `station_id` | Direct |
| `stationName` | `station_name` | Direct |
| `parameter` | `parameter_name` | Direct (e.g., `'benzene'`, `'PM2.5'`, `'H2S'`) |
| `value` | `value` | Cast to DOUBLE PRECISION |
| `unit` | `unit` | Normalize: `'ug/m3'` → `'ug_m3'`, `'ppb'` → `'ppb'` |
| `timestamp` | `measurement_time` | Parse ISO 8601 to TIMESTAMPTZ |
| `qualityFlag` | `quality_flag` | Normalize: `'Valid'` → `'valid'`, `'Suspect'` → `'suspect'`, `'Invalid'` → `'invalid'` |
| `latitude`, `longitude`, `averagingPeriod`, `detectionLimit`, `regulatoryLimit`, `methodReference`, `sampleId` | `extra_data` | Pack into JSONB |

### ldar_records

| Cority Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'cority'` |
| `componentTag` | `component_id` | Direct (e.g., `'V-12345-001'`) |
| `componentType` | `component_type` | Normalize: `'Valve'` → `'valve'`, `'Pump Seal'` → `'pump_seal'`, `'Connector'` → `'connector'` |
| `location` | `location` | Direct (process unit or area identifier) |
| `reading` | `reading_ppm` | Cast to DOUBLE PRECISION |
| `leakThreshold` | `leak_threshold_ppm` | Cast to DOUBLE PRECISION (typically 500 or 10000) |
| `isLeak` | `is_leak` | Direct BOOLEAN |
| `inspectionDate` | `inspection_date` | Parse ISO 8601 date |
| `inspectorName` | `inspector_name` | Direct |
| `repairDate` | `repair_date` | Parse ISO 8601 date; NULL if not yet repaired |
| `repairMethod` | `repair_method` | Direct |
| `equipmentId`, `service`, `regulation`, `monitoringMethod`, `remonitorDate`, `remonitorReading`, `delayOfRepair`, `dorJustification`, `estimatedEmissions` | `extra_data` | Pack into JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Notes |
|---|---|---|---|
| Emissions events | 15 min | `updated_at` | Critical for near-real-time exceedance visibility. Emission events can be created retroactively after DAHS processing. |
| Compliance records | Daily (midnight) | `updated_at` | Compliance status changes are low-frequency. Daily sync is sufficient. |
| Permits | Weekly | `updated_at` | Permits change rarely. Weekly keeps conditions current without wasted cycles. |
| Waste manifests | Daily | `updated_at` | Manifests update when shipments are received and confirmed. |
| Ambient monitoring | Hourly | `timestamp` | Only relevant if Cority ingests real-time ambient data. For lab-reported fenceline results (bi-weekly), daily is fine. |
| LDAR records | Weekly | `updated_at` | LDAR monitoring cycles are quarterly to annual. Weekly captures new inspection batches. |

**Initial Load**: Full sync with `offset=0`, paginate through all records. For emissions events, limit to the current calendar year to avoid pulling decades of history. For permits, pull all active permits regardless of age.

**Dual-Path CEMS Note**: Cority may contain CEMS summary data imported from the DAHS (StackVision, NetDAHS). If so, these arrive in Cority as processed regulatory values, not raw analyzer readings. The OPC path delivers real-time raw CEMS values to Console/Process graphics. The Cority import path delivers regulatory-calculated values (with EPA data substitution, QA flags) to `emissions_events`. Both are valuable -- the OPC path is for operator awareness, the import path is for compliance records.

## Pre-Built Import Definition

### Connection Configuration

```jsonc
{
  "connector_type": "rest_api",
  "name": "Cority Environmental",
  "description": "Cority (Enviance) EHS platform — emissions, compliance, permits, waste, ambient, LDAR",
  "connection": {
    "base_url": "https://${CORITY_TENANT}.enviance.com/api/v2",
    "auth": {
      "type": "oauth2_client_credentials",
      "token_url": "https://${CORITY_TENANT}.enviance.com/oauth/token",
      "client_id": "${CORITY_CLIENT_ID}",
      "client_secret": "${CORITY_CLIENT_SECRET}",
      "scope": "read"
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
  "source_id": "cority_emissions_events",
  "target_table": "emissions_events",
  "endpoint": "/emissions/events",
  "method": "GET",
  "params": {
    "modified_after": "${WATERMARK}",
    "limit": 500,
    "offset": "${OFFSET}"
  },
  "pagination": {
    "type": "offset",
    "page_size": 500,
    "max_pages": 100
  },
  "schedule": "*/15 * * * *",
  "watermark": {
    "column": "updated_at",
    "type": "timestamp",
    "param_name": "modified_after"
  },
  "field_mapping": [
    { "source": "id",                   "target": "external_id",       "transform": "to_string" },
    { "source": null,                    "target": "source_system",     "transform": "constant('cority')" },
    { "source": "source.name",           "target": "source_name",       "transform": null },
    { "source": "pollutant.code",        "target": "parameter_name",    "transform": null },
    { "source": "quantity.value",        "target": "value",             "transform": "to_float" },
    { "source": "quantity.uom",          "target": "unit",              "transform": "normalize_unit" },
    { "source": "exceedance.limit",      "target": "regulatory_limit",  "transform": "to_float" },
    { "source": "exceedance.exceeded",   "target": "exceedance",        "transform": null },
    { "source": "startTime",             "target": "event_time",        "transform": "parse_iso8601" },
    { "source": "durationMinutes",       "target": "duration_minutes",  "transform": "to_float" },
    { "source": "causeCategory",         "target": "cause",             "transform": "to_lowercase" },
    { "source": "correctiveAction",      "target": "corrective_action", "transform": null },
    { "source": "reportingStatus",       "target": "reported",          "transform": "rhai: status == 'submitted' || status == 'closed'" }
  ],
  "extra_data_fields": [
    "source.type", "processUnit.name", "rootCause", "calculationMethod",
    "emissionFactorId", "regulatoryReportId", "endTime", "exceedance.amount"
  ]
}
```

#### Compliance Records

```jsonc
{
  "source_id": "cority_compliance_records",
  "target_table": "compliance_records",
  "endpoint": "/compliance/tasks",
  "method": "GET",
  "params": {
    "modified_after": "${WATERMARK}",
    "limit": 500
  },
  "pagination": { "type": "offset", "page_size": 500 },
  "schedule": "0 0 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp" },
  "field_mapping": [
    { "source": "id",                "target": "external_id",          "transform": "to_string" },
    { "source": null,                "target": "source_system",        "transform": "constant('cority')" },
    { "source": "taskType",          "target": "record_type",          "transform": "to_lowercase" },
    { "source": "title",             "target": "title",                "transform": null },
    { "source": "description",       "target": "description",          "transform": null },
    { "source": "complianceStatus",  "target": "status",               "transform": "to_lowercase" },
    { "source": "regulatoryBody",    "target": "agency",               "transform": null },
    { "source": "regulationCitation","target": "regulation_reference",  "transform": null },
    { "source": "dueDate",           "target": "due_date",             "transform": "parse_iso8601_date" },
    { "source": "completedDate",     "target": "completed_date",       "transform": "parse_iso8601_date" },
    { "source": "responsiblePerson", "target": "assigned_to",          "transform": null },
    { "source": "findingsCount",     "target": "findings_count",       "transform": "to_integer" }
  ],
  "extra_data_fields": [
    "permitNumber", "severity", "frequency", "correctiveAction",
    "correctiveActionDue", "correctiveActionStatus", "documentationLinks"
  ]
}
```

#### Permits

```jsonc
{
  "source_id": "cority_permits",
  "target_table": "permits",
  "endpoint": "/permits",
  "method": "GET",
  "params": { "modified_after": "${WATERMARK}", "limit": 200 },
  "pagination": { "type": "offset", "page_size": 200 },
  "schedule": "0 2 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp" },
  "field_mapping": [
    { "source": "id",              "target": "external_id",     "transform": "to_string" },
    { "source": null,              "target": "source_system",   "transform": "constant('cority')" },
    { "source": "permitType",      "target": "permit_type",     "transform": "rhai: to_snake_case(value)" },
    { "source": "permitNumber",    "target": "permit_number",   "transform": null },
    { "source": "title",           "target": "title",           "transform": null },
    { "source": "regulatoryBody",  "target": "issuing_agency",  "transform": null },
    { "source": "status",          "target": "status",          "transform": "rhai: to_snake_case(value)" },
    { "source": "issueDate",       "target": "issue_date",      "transform": "parse_iso8601_date" },
    { "source": "expirationDate",  "target": "expiry_date",     "transform": "parse_iso8601_date" },
    { "source": "conditions",      "target": "conditions",      "transform": "to_jsonb" }
  ],
  "extra_data_fields": ["applicableUnits", "regulationCitation", "contactPerson"]
}
```

#### Waste Manifests

```jsonc
{
  "source_id": "cority_waste_manifests",
  "target_table": "waste_manifests",
  "endpoint": "/waste/manifests",
  "method": "GET",
  "params": { "modified_after": "${WATERMARK}", "limit": 500 },
  "pagination": { "type": "offset", "page_size": 500 },
  "schedule": "0 1 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp" },
  "field_mapping": [
    { "source": "id",                "target": "external_id",         "transform": "to_string" },
    { "source": null,                "target": "source_system",       "transform": "constant('cority')" },
    { "source": "trackingNumber",    "target": "manifest_number",     "transform": null },
    { "source": "wasteCodes",        "target": "waste_code",          "transform": "rhai: value.join(', ')" },
    { "source": "wasteDescription",  "target": "waste_description",   "transform": null },
    { "source": "quantity.value",    "target": "quantity",            "transform": "to_float" },
    { "source": "quantity.uom",      "target": "unit",                "transform": "to_lowercase" },
    { "source": "generator.name",    "target": "generator_name",      "transform": null },
    { "source": "transporter.name",  "target": "transporter_name",    "transform": null },
    { "source": "tsdf.name",         "target": "destination_facility", "transform": null },
    { "source": "shipDate",          "target": "ship_date",           "transform": "parse_iso8601_date" },
    { "source": "receivedDate",      "target": "receipt_date",        "transform": "parse_iso8601_date" }
  ],
  "extra_data_fields": [
    "manifestType", "generatorEpaId", "transporterEpaId", "tsdfEpaId",
    "containerType", "containerCount", "dotDescription", "status"
  ]
}
```

## Notes

- **Connector license required**: Cority's REST API is not included in the base SaaS subscription. The customer must purchase the "Cority Enviance Connectors" add-on. This is a procurement/sales conversation, not a technical limitation.
- **Tenant-specific URL**: Each Cority customer has a unique subdomain. The base URL is not a fixed endpoint.
- **Enviance legacy vs. CorityOne**: Some customers are still on the legacy Enviance platform. The API surface is the same, but the base URL may be `api.enviance.com` instead of the tenant-specific pattern. Confirm with the customer.
- **LDAR coverage varies**: Many refineries use dedicated LDAR software (LeakDAS, Guideware) instead of Cority for LDAR. The LDAR source config should only be enabled if Cority is the LDAR system of record. Otherwise, use the LeakDAS/Guideware CSV file import path.
- **Cority as CEMS aggregator**: Some sites configure Cority to ingest CEMS summary data from the DAHS. If so, Cority becomes a pass-through source for CEMS regulatory data. This is distinct from the direct DAHS file/database import path. Do not double-import the same CEMS data from both Cority and the DAHS.
- **Rate limit monitoring**: The 60-120 req/min limit is contract-specific. The Import Service should log rate limit headers (`X-RateLimit-Remaining`) and back off when approaching the threshold.
- **Webhook alternative**: Cority supports webhook notifications for some event types. If configured, the Import Service could receive push notifications instead of polling for emissions events. This requires the Import Service to expose an inbound webhook endpoint (not currently in the Universal Import architecture -- would be a future enhancement).
