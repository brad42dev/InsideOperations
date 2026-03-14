# Intelex Technologies — Environmental Monitoring & Compliance Connector Profile

## Application Overview

- **Vendor**: Intelex Technologies ULC (acquired by Fortive Corporation, 2019)
- **Product**: Intelex SaaS platform (cloud-hosted)
- **Market Position**: Major EHS&Q platform with ~1,400 customers globally. Strong in manufacturing and oil & gas. Known for configurability and no-code workflow builder.
- **Licensing**: Commercial SaaS subscription. API access is included in the standard license -- no separate connector license required.
- **Typical Refinery Deployment**: Environmental compliance team uses Intelex for emissions data records, compliance obligation tracking, permit management, LDAR oversight, waste manifests, inspections, and corrective actions. Some sites also use Intelex for safety/incident management, making it a single platform for EHS.

## API Surface

- **API Type**: REST with OData v4 conventions (HTTPS)
- **Base URL**: `https://{tenant}.intelex.com/api/v2/`
- **Authentication**: API Key in `X-INTELEX-API-KEY` header. Key generated from User Profile menu in the Intelex web UI.
- **Pagination**: OData `$skip`/`$top` (default page size 100, max 1000 per request)
- **Rate Limits**: 300 requests/min (documented)
- **Query Capabilities**: Full OData v4 support -- `$filter`, `$select`, `$expand`, `$orderby`, `$top`, `$skip`, `$count`
- **Key Endpoints** (OData entity sets):
  - `/EmissionsData` -- air emission events and calculations
  - `/ComplianceObligations` -- compliance tasks, obligations, status tracking
  - `/Permits` -- permit records and conditions
  - `/WasteManifests` -- waste tracking and RCRA manifests
  - `/Inspections` -- environmental and compliance inspections
  - `/CorrectiveActions` -- corrective and preventive actions
  - `/AuditFindings` -- audit results
  - `/LDARInspections` -- LDAR monitoring records (if LDAR module licensed)
- **API Documentation**: Developer portal at `https://developers.intelex.com/`. Postman collection available ("Intelex v6 API Examples").
- **Date Format**: ISO 8601 timestamps (UTC)

## Target Tables

| Priority | I/O Table | Intelex Data Source |
|---|---|---|
| Primary | `emissions_events` | `/EmissionsData` -- emission exceedances, calculated emissions, flare events |
| Primary | `compliance_records` | `/ComplianceObligations` + `/Inspections` + `/AuditFindings` -- merged via record_type |
| Primary | `permits` | `/Permits` -- air, water, waste permits with conditions |
| Primary | `waste_manifests` | `/WasteManifests` -- hazardous and non-hazardous waste shipments |
| Secondary | `ldar_records` | `/LDARInspections` -- Method 21 readings, leak tracking, repair status |
| Secondary | `ambient_monitoring` | Not a primary Intelex strength. Use file import from lab data instead. |

## Field Mapping

### emissions_events

| Intelex Field (OData) | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'intelex'` |
| `SourceName` | `source_name` | Direct |
| `Pollutant` | `parameter_name` | Direct (standard codes: SO2, NOx, CO, VOC, PM, etc.) |
| `EmissionQuantity` | `value` | Cast to DOUBLE PRECISION |
| `EmissionUnit` | `unit` | Normalize: `'lbs/hr'` → `'lbs_per_hr'`, `'tons/yr'` → `'tons_per_yr'` |
| `RegulatoryLimit` | `regulatory_limit` | Cast to DOUBLE PRECISION; NULL if no limit |
| `IsExceedance` | `exceedance` | Direct BOOLEAN |
| `EventStartDate` | `event_time` | Parse ISO 8601 to TIMESTAMPTZ |
| `DurationMinutes` | `duration_minutes` | Direct; calculate from `EventEndDate - EventStartDate` if absent |
| `CauseCategory` | `cause` | Normalize to lowercase snake_case |
| `CorrectiveAction` | `corrective_action` | Direct |
| `ReportingStatus` | `reported` | Map: `'Submitted'`/`'Closed'` → `true`, others → `false` |
| `SourceType`, `ProcessUnit`, `CalculationMethod`, `EmissionFactor`, `RootCause`, `EventEndDate` | `extra_data` | Pack into JSONB |

### compliance_records

Three Intelex entity sets merge into `compliance_records` with different `record_type` values:

**From `/ComplianceObligations`:**

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'intelex'` |
| -- | `record_type` | Constant: `'inspection'` or derive from `ObligationType` |
| `Title` | `title` | Direct |
| `RequirementDescription` | `description` | Direct |
| `ComplianceStatus` | `status` | Normalize: `'Compliant'` → `'compliant'`, `'Non-Compliant'` → `'non_compliant'`, `'Pending'` → `'pending'` |
| `RegulatoryBody` | `agency` | Direct |
| `RegulationCitation` | `regulation_reference` | Direct |
| `DueDate` | `due_date` | Parse ISO 8601 date |
| `CompletedDate` | `completed_date` | Parse ISO 8601 date |
| `ResponsiblePerson` | `assigned_to` | Direct |
| `FindingsCount` | `findings_count` | Cast to INTEGER; default 0 |
| `PermitNumber`, `NextReviewDate`, `Frequency`, `Severity`, `CorrectiveAction`, `CorrectiveActionDue` | `extra_data` | Pack into JSONB |

**From `/Inspections`:**

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Prefix with `'insp_'` to avoid collisions |
| -- | `record_type` | Constant: `'inspection'` |
| `InspectionTitle` | `title` | Direct |
| `InspectionStatus` | `status` | Normalize to lowercase |
| `InspectingAgency` | `agency` | Direct |
| `ScheduledDate` | `due_date` | Parse ISO 8601 date |
| `CompletedDate` | `completed_date` | Parse ISO 8601 date |
| `InspectorName` | `assigned_to` | Direct |
| `FindingsCount` | `findings_count` | Direct |

**From `/AuditFindings`:**

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Prefix with `'audit_'` |
| -- | `record_type` | Constant: `'audit'` |
| `AuditTitle` | `title` | Direct |
| `FindingDescription` | `description` | Direct |
| `Status` | `status` | Normalize |
| `AuditDate` | `completed_date` | Parse ISO 8601 date |

### permits

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'intelex'` |
| `PermitType` | `permit_type` | Normalize to snake_case: `'Air Operating'` → `'air_operating'` |
| `PermitNumber` | `permit_number` | Direct |
| `Title` | `title` | Direct |
| `IssuingAgency` | `issuing_agency` | Direct |
| `Status` | `status` | Normalize: `'Active'` → `'active'`, `'Expired'` → `'expired'`, `'Pending Renewal'` → `'pending_renewal'` |
| `IssueDate` | `issue_date` | Parse ISO 8601 date |
| `ExpirationDate` | `expiry_date` | Parse ISO 8601 date |
| `Conditions` (expand) | `conditions` | Map to JSONB array via `$expand=Conditions` |
| `ApplicableUnits`, `RegulationCitation` | `extra_data` | Pack into JSONB |

### waste_manifests

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'intelex'` |
| `ManifestTrackingNumber` | `manifest_number` | Direct |
| `WasteCodes` | `waste_code` | Join array to comma-separated TEXT |
| `WasteDescription` | `waste_description` | Direct |
| `Quantity` | `quantity` | Cast to DOUBLE PRECISION |
| `QuantityUnit` | `unit` | Normalize to lowercase |
| `GeneratorName` | `generator_name` | Direct |
| `TransporterName` | `transporter_name` | Direct |
| `TSDFName` | `destination_facility` | Direct |
| `ShipDate` | `ship_date` | Parse ISO 8601 date |
| `ReceivedDate` | `receipt_date` | Parse ISO 8601 date |
| `ManifestType`, `GeneratorEPAId`, `TransporterEPAId`, `TSDFEPAId`, `ContainerType`, `ContainerCount`, `DOTDescription`, `Status` | `extra_data` | Pack into JSONB |

### ldar_records

| Intelex Field | I/O Column | Transform |
|---|---|---|
| `Id` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'intelex'` |
| `ComponentTag` | `component_id` | Direct |
| `ComponentType` | `component_type` | Normalize to snake_case |
| `ProcessUnit` | `location` | Direct |
| `Reading` | `reading_ppm` | Cast to DOUBLE PRECISION |
| `LeakDefinition` | `leak_threshold_ppm` | Cast to DOUBLE PRECISION |
| `IsLeak` | `is_leak` | Direct BOOLEAN |
| `InspectionDate` | `inspection_date` | Parse ISO 8601 date |
| `InspectorName` | `inspector_name` | Direct |
| `RepairDate` | `repair_date` | Parse ISO 8601 date |
| `RepairType` | `repair_method` | Direct |
| `EquipmentId`, `Service`, `Regulation`, `MonitoringMethod`, `RemonitorDate`, `RemonitorReading`, `DelayOfRepair`, `DORJustification`, `EstimatedEmissions` | `extra_data` | Pack into JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | OData Filter |
|---|---|---|---|
| Emissions events | Daily | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}&$orderby=ModifiedDate asc` |
| Compliance obligations | Daily | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |
| Inspections | 30 min | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |
| Audit findings | Daily | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |
| Permits | Weekly | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |
| Waste manifests | Daily | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |
| LDAR records | Weekly | `ModifiedDate` | `$filter=ModifiedDate gt {watermark}` |

**Initial Load**: Use `$top=1000&$skip=0` and paginate. For emissions, filter to current year: `$filter=EventStartDate ge 2025-01-01T00:00:00Z`. For permits, filter to active: `$filter=Status eq 'Active' or Status eq 'Pending Renewal'`.

**Dual-Path CEMS Note**: Intelex is not typically the source of raw CEMS data. If the site has CEMS data in Intelex, it was imported from the DAHS (StackVision, NetDAHS). The OPC path handles real-time CEMS analyzer values. The Intelex path, if used for CEMS, would contain the same regulatory data as a direct DAHS import. Choose one source, not both.

## Pre-Built Import Definition

### Connection Configuration

```jsonc
{
  "connector_type": "rest_api",
  "name": "Intelex Environmental",
  "description": "Intelex EHS platform — emissions, compliance, permits, waste, LDAR (OData v4)",
  "connection": {
    "base_url": "https://${INTELEX_TENANT}.intelex.com/api/v2",
    "auth": {
      "type": "api_key",
      "header_name": "X-INTELEX-API-KEY",
      "key": "${INTELEX_API_KEY}"
    },
    "headers": {
      "Accept": "application/json",
      "OData-Version": "4.0"
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
  "source_id": "intelex_emissions_events",
  "target_table": "emissions_events",
  "endpoint": "/EmissionsData",
  "method": "GET",
  "params": {
    "$filter": "ModifiedDate gt ${WATERMARK}",
    "$orderby": "ModifiedDate asc",
    "$top": 1000,
    "$skip": "${OFFSET}",
    "$select": "Id,SourceName,Pollutant,EmissionQuantity,EmissionUnit,RegulatoryLimit,IsExceedance,EventStartDate,EventEndDate,DurationMinutes,CauseCategory,CorrectiveAction,ReportingStatus,SourceType,ProcessUnit,CalculationMethod",
    "$count": true
  },
  "pagination": {
    "type": "odata_skip",
    "page_size": 1000,
    "total_count_path": "@odata.count"
  },
  "schedule": "0 0 * * *",
  "watermark": {
    "column": "updated_at",
    "type": "timestamp",
    "source_field": "ModifiedDate"
  },
  "field_mapping": [
    { "source": "Id",                "target": "external_id",       "transform": "to_string" },
    { "source": null,                "target": "source_system",     "transform": "constant('intelex')" },
    { "source": "SourceName",        "target": "source_name",       "transform": null },
    { "source": "Pollutant",         "target": "parameter_name",    "transform": null },
    { "source": "EmissionQuantity",  "target": "value",             "transform": "to_float" },
    { "source": "EmissionUnit",      "target": "unit",              "transform": "normalize_unit" },
    { "source": "RegulatoryLimit",   "target": "regulatory_limit",  "transform": "to_float" },
    { "source": "IsExceedance",      "target": "exceedance",        "transform": null },
    { "source": "EventStartDate",    "target": "event_time",        "transform": "parse_iso8601" },
    { "source": "DurationMinutes",   "target": "duration_minutes",  "transform": "to_float" },
    { "source": "CauseCategory",     "target": "cause",             "transform": "to_snake_case" },
    { "source": "CorrectiveAction",  "target": "corrective_action", "transform": null },
    { "source": "ReportingStatus",   "target": "reported",          "transform": "rhai: value == 'Submitted' || value == 'Closed'" }
  ],
  "extra_data_fields": [
    "SourceType", "ProcessUnit", "CalculationMethod", "EmissionFactor",
    "RootCause", "EventEndDate"
  ]
}
```

#### Compliance Records (Obligations)

```jsonc
{
  "source_id": "intelex_compliance_obligations",
  "target_table": "compliance_records",
  "endpoint": "/ComplianceObligations",
  "method": "GET",
  "params": {
    "$filter": "ModifiedDate gt ${WATERMARK}",
    "$orderby": "ModifiedDate asc",
    "$top": 1000,
    "$skip": "${OFFSET}",
    "$count": true
  },
  "pagination": { "type": "odata_skip", "page_size": 1000 },
  "schedule": "0 0 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ModifiedDate" },
  "field_mapping": [
    { "source": "Id",                    "target": "external_id",          "transform": "to_string" },
    { "source": null,                    "target": "source_system",        "transform": "constant('intelex')" },
    { "source": "ObligationType",        "target": "record_type",          "transform": "to_lowercase" },
    { "source": "Title",                 "target": "title",                "transform": null },
    { "source": "RequirementDescription","target": "description",          "transform": null },
    { "source": "ComplianceStatus",      "target": "status",               "transform": "to_snake_case" },
    { "source": "RegulatoryBody",        "target": "agency",               "transform": null },
    { "source": "RegulationCitation",    "target": "regulation_reference",  "transform": null },
    { "source": "DueDate",              "target": "due_date",              "transform": "parse_iso8601_date" },
    { "source": "CompletedDate",         "target": "completed_date",       "transform": "parse_iso8601_date" },
    { "source": "ResponsiblePerson",     "target": "assigned_to",          "transform": null },
    { "source": "FindingsCount",         "target": "findings_count",       "transform": "to_integer" }
  ],
  "extra_data_fields": [
    "PermitNumber", "NextReviewDate", "Frequency", "Severity",
    "CorrectiveAction", "CorrectiveActionDue"
  ]
}
```

#### Permits

```jsonc
{
  "source_id": "intelex_permits",
  "target_table": "permits",
  "endpoint": "/Permits",
  "method": "GET",
  "params": {
    "$filter": "ModifiedDate gt ${WATERMARK}",
    "$expand": "Conditions",
    "$top": 500,
    "$skip": "${OFFSET}"
  },
  "pagination": { "type": "odata_skip", "page_size": 500 },
  "schedule": "0 3 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ModifiedDate" },
  "field_mapping": [
    { "source": "Id",              "target": "external_id",     "transform": "to_string" },
    { "source": null,              "target": "source_system",   "transform": "constant('intelex')" },
    { "source": "PermitType",      "target": "permit_type",     "transform": "to_snake_case" },
    { "source": "PermitNumber",    "target": "permit_number",   "transform": null },
    { "source": "Title",           "target": "title",           "transform": null },
    { "source": "IssuingAgency",   "target": "issuing_agency",  "transform": null },
    { "source": "Status",          "target": "status",          "transform": "to_snake_case" },
    { "source": "IssueDate",       "target": "issue_date",      "transform": "parse_iso8601_date" },
    { "source": "ExpirationDate",  "target": "expiry_date",     "transform": "parse_iso8601_date" },
    { "source": "Conditions",      "target": "conditions",      "transform": "to_jsonb" }
  ],
  "extra_data_fields": ["ApplicableUnits", "RegulationCitation"]
}
```

#### Waste Manifests

```jsonc
{
  "source_id": "intelex_waste_manifests",
  "target_table": "waste_manifests",
  "endpoint": "/WasteManifests",
  "method": "GET",
  "params": {
    "$filter": "ModifiedDate gt ${WATERMARK}",
    "$top": 1000,
    "$skip": "${OFFSET}"
  },
  "pagination": { "type": "odata_skip", "page_size": 1000 },
  "schedule": "0 1 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ModifiedDate" },
  "field_mapping": [
    { "source": "Id",                     "target": "external_id",          "transform": "to_string" },
    { "source": null,                     "target": "source_system",        "transform": "constant('intelex')" },
    { "source": "ManifestTrackingNumber", "target": "manifest_number",      "transform": null },
    { "source": "WasteCodes",            "target": "waste_code",           "transform": "rhai: value.join(', ')" },
    { "source": "WasteDescription",      "target": "waste_description",    "transform": null },
    { "source": "Quantity",              "target": "quantity",             "transform": "to_float" },
    { "source": "QuantityUnit",          "target": "unit",                "transform": "to_lowercase" },
    { "source": "GeneratorName",         "target": "generator_name",       "transform": null },
    { "source": "TransporterName",       "target": "transporter_name",     "transform": null },
    { "source": "TSDFName",             "target": "destination_facility",  "transform": null },
    { "source": "ShipDate",             "target": "ship_date",            "transform": "parse_iso8601_date" },
    { "source": "ReceivedDate",          "target": "receipt_date",         "transform": "parse_iso8601_date" }
  ],
  "extra_data_fields": [
    "ManifestType", "GeneratorEPAId", "TransporterEPAId", "TSDFEPAId",
    "ContainerType", "ContainerCount", "DOTDescription", "Status"
  ]
}
```

#### LDAR Records

```jsonc
{
  "source_id": "intelex_ldar_records",
  "target_table": "ldar_records",
  "endpoint": "/LDARInspections",
  "method": "GET",
  "params": {
    "$filter": "ModifiedDate gt ${WATERMARK}",
    "$top": 1000,
    "$skip": "${OFFSET}"
  },
  "pagination": { "type": "odata_skip", "page_size": 1000 },
  "schedule": "0 4 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ModifiedDate" },
  "field_mapping": [
    { "source": "Id",              "target": "external_id",        "transform": "to_string" },
    { "source": null,              "target": "source_system",      "transform": "constant('intelex')" },
    { "source": "ComponentTag",    "target": "component_id",       "transform": null },
    { "source": "ComponentType",   "target": "component_type",     "transform": "to_snake_case" },
    { "source": "ProcessUnit",     "target": "location",           "transform": null },
    { "source": "Reading",         "target": "reading_ppm",        "transform": "to_float" },
    { "source": "LeakDefinition",  "target": "leak_threshold_ppm", "transform": "to_float" },
    { "source": "IsLeak",          "target": "is_leak",            "transform": null },
    { "source": "InspectionDate",  "target": "inspection_date",    "transform": "parse_iso8601_date" },
    { "source": "InspectorName",   "target": "inspector_name",     "transform": null },
    { "source": "RepairDate",      "target": "repair_date",        "transform": "parse_iso8601_date" },
    { "source": "RepairType",      "target": "repair_method",      "transform": null }
  ],
  "extra_data_fields": [
    "EquipmentId", "Service", "Regulation", "MonitoringMethod",
    "RemonitorDate", "RemonitorReading", "DelayOfRepair",
    "DORJustification", "EstimatedEmissions"
  ]
}
```

## Notes

- **OData is the differentiator**: Intelex's OData v4 support makes it the most query-friendly of the five environmental platforms. The Import Service can use `$filter`, `$select`, and `$expand` to request exactly the data it needs, reducing payload size and improving sync efficiency. This is a significant advantage over the other vendors' plain REST APIs.
- **API key simplicity**: Unlike Cority, Sphera, and Enablon (all OAuth 2.0), Intelex uses a simple API key. This eliminates the token refresh cycle and reduces configuration complexity. The key is generated from the user's profile and has the same permissions as that user -- ensure a service account with read-only environmental access is used.
- **300 req/min rate limit**: This is well-documented and consistent. The Import Service should respect this ceiling. With 1000-record pages, a full sync of 50,000 emissions records takes 50 pages = 50 requests, well within the limit.
- **Configurable entity sets**: Intelex is known for customer-specific configuration. The OData entity set names listed here are defaults -- some customers may have custom entity sets or additional fields. The import wizard should support field discovery via OData `$metadata` endpoint.
- **Three-source merge for compliance_records**: Compliance obligations, inspections, and audit findings are three separate Intelex entity sets that all map to the same `compliance_records` table with different `record_type` values. The Import Service runs three separate source configs, each producing rows in the same target table. Use the `external_id` prefix (`insp_`, `audit_`) to prevent ID collisions.
- **LDAR module is optional**: Not all Intelex customers license the LDAR module. If the site uses LeakDAS or Guideware for LDAR, disable the LDAR source config and use the CSV file import path instead.
- **Python SDK exists but irrelevant**: Intelex publishes a Python SDK on PyPI. This is not useful for I/O's Rust backend. The REST/OData API is the integration path.
- **Postman collection available**: The "Intelex v6 API Examples" Postman collection can be used during initial setup to validate endpoints and field names before configuring the Import Service.
