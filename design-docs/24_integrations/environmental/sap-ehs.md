# SAP EHS Management — Environmental Monitoring & Compliance Connector Profile

## Application Overview

- **Vendor**: SAP SE
- **Product**: SAP EHS Management module (part of SAP S/4HANA, on-premise or cloud)
- **Market Position**: Dominant in large enterprises already running SAP for ERP, finance, and maintenance. Strong in European refining, growing in North America. EHS module is typically chosen when the refinery's parent company has standardized on SAP across all business functions. Not a best-of-breed EHS platform -- it is an EHS module within the broader SAP ecosystem.
- **Licensing**: SAP license (expensive). EHS module is part of the S/4HANA license or available as standalone SAP EHS Management. OData API access is included with the platform -- no separate API license. However, SAP Gateway must be configured and specific OData services must be activated by the SAP Basis team.
- **Typical Refinery Deployment**: Refineries with SAP as their enterprise platform use the EHS module for emissions management (source groups, emission factors, calculations), waste management, hazardous substance tracking, incident management, and occupational health. The environmental compliance team works within SAP transactions alongside the finance and maintenance teams using SAP PM/MM.

## API Surface

- **API Type**: OData REST API via SAP Gateway (HTTPS)
- **Base URL**: `https://{sap-host}:{port}/sap/opu/odata/sap/`
- **Authentication**: Multiple options:
  - **Basic Auth**: Username/password for SAP system. Simplest but least secure.
  - **OAuth 2.0**: Via SAP Cloud Platform / SAP BTP. Preferred for cloud-to-cloud integration.
  - **X.509 Client Certificate**: For service-to-service on-premise integration. Most common in enterprise SAP environments.
- **Pagination**: Server-driven paging (`__next` links in OData v2) or `$skip`/`$top` in OData v4. SAP defaults to 100-500 rows per page depending on service configuration.
- **Rate Limits**: No hard rate limit -- throughput depends on SAP system sizing and Gateway configuration. SAP Basis teams may impose limits.
- **OData Version**: OData v2 (SAP standard for most services) or v4 (S/4HANA Cloud). The connector must handle both.
- **Key OData Services**:
  - `EHS_EMISSION_MGMT_SRV` -- emissions data, source groups, calculations, emission factors
  - `EHS_INCIDENT_SRV` -- incident management and investigation
  - `EHS_WASTE_SRV` -- waste management records
  - `EHS_HAZMAT_SRV` -- hazardous substance data
  - Custom CDS views -- site-specific analytical views (common in SAP S/4HANA environments)
- **API Documentation**: SAP API Business Hub (`api.sap.com`) for public service catalog. Site-specific services require SAP Gateway metadata (`$metadata` endpoint).
- **Date Format**: SAP-specific formats. OData v2 uses `/Date(epoch_ms)/` (e.g., `/Date(1234567890000)/`). OData v4 uses ISO 8601. **Both must be handled.**

## Target Tables

| Priority | I/O Table | SAP Data Source |
|---|---|---|
| Primary | `emissions_events` | `EHS_EMISSION_MGMT_SRV` -- emission calculations, exceedances, source-level emissions |
| Primary | `compliance_records` | `EHS_INCIDENT_SRV` + custom CDS views -- compliance tasks, inspection results |
| Primary | `waste_manifests` | `EHS_WASTE_SRV` -- waste management records, manifest tracking |
| Primary | `permits` | Custom CDS views or `EHS_EMISSION_MGMT_SRV` (permits linked to emission sources) |
| Secondary | `ambient_monitoring` | Not a primary SAP EHS capability. Use file import from lab data. |
| Secondary | `ldar_records` | Not a SAP EHS capability. Use LeakDAS/Guideware CSV import. |

## Field Mapping

### emissions_events

| SAP Field | I/O Column | Transform |
|---|---|---|
| `EmissionEventId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sap_ehs'` |
| `EmissionSourceName` | `source_name` | Direct |
| `PollutantCode` | `parameter_name` | SAP may use internal codes -- map via lookup: `'SO2'` stays, `'SULFUR_DIOXIDE'` → `'SO2'` |
| `EmissionQuantity` | `value` | Cast to DOUBLE PRECISION |
| `QuantityUnit` | `unit` | SAP unit codes → I/O: `'LB'` → `'lbs'`, `'TO'` → `'tons'`, `'KG'` → `'kg'`, `'LB/H'` → `'lbs_per_hr'` |
| `RegulatoryLimit` | `regulatory_limit` | Cast to DOUBLE PRECISION; NULL if none |
| `IsExceedance` | `exceedance` | SAP ABAP boolean: `'X'` → `true`, `''` → `false` |
| `EventDate` | `event_time` | **OData v2**: Parse `/Date(ms)/` to TIMESTAMPTZ. **OData v4**: Parse ISO 8601. |
| `DurationMinutes` | `duration_minutes` | Direct |
| `CauseCode` | `cause` | SAP cause codes → I/O: `'01'` → `'startup'`, `'02'` → `'shutdown'`, `'03'` → `'malfunction'`, `'04'` → `'upset'`, `'05'` → `'routine'` |
| `CorrectiveActionText` | `corrective_action` | Direct |
| `ReportingStatus` | `reported` | SAP status codes: `'SUBMITTED'`/`'CLOSED'` → `true`, others → `false` |
| `EmissionSourceType`, `PlantSection`, `CalculationMethod`, `EmissionFactorId`, `SourceGroupId`, `CompanyCode`, `Werks` | `extra_data` | Pack into JSONB |

### compliance_records

SAP EHS compliance data may come from the incident service or custom CDS views, depending on the customer's SAP configuration.

| SAP Field | I/O Column | Transform |
|---|---|---|
| `IncidentId` or `TaskId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sap_ehs'` |
| `TaskType` | `record_type` | Map SAP codes: `'INSP'` → `'inspection'`, `'AUDT'` → `'audit'`, `'CERT'` → `'certification'`, `'VIOL'` → `'violation'` |
| `Description` | `title` | Direct |
| `LongText` | `description` | Direct (may require separate OData call for long text) |
| `Status` | `status` | Map SAP status: `'E0001'` → `'compliant'`, `'E0002'` → `'non_compliant'`, `'E0003'` → `'pending'` |
| `RegulatoryBody` | `agency` | Direct |
| `RegulationRef` | `regulation_reference` | Direct |
| `DueDate` | `due_date` | Parse SAP date format |
| `CompletedDate` | `completed_date` | Parse SAP date format |
| `ResponsiblePerson` | `assigned_to` | SAP user ID → resolve to name via user master (or pass ID and resolve later) |
| `FindingsCount` | `findings_count` | Cast to INTEGER |
| `Priority`, `CompanyCode`, `Werks`, `FunctionalLocation`, `CorrectiveAction`, `CorrectiveActionDue` | `extra_data` | Pack into JSONB |

### permits

Permits in SAP EHS are often linked to emission source groups or maintained via custom CDS views. The exact data model varies by customer.

| SAP Field | I/O Column | Transform |
|---|---|---|
| `PermitId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sap_ehs'` |
| `PermitType` | `permit_type` | Map SAP codes to snake_case |
| `PermitNumber` | `permit_number` | Direct |
| `Description` | `title` | Direct |
| `Authority` | `issuing_agency` | Direct |
| `Status` | `status` | Map SAP status codes: `'ACTV'` → `'active'`, `'EXPR'` → `'expired'`, `'PEND'` → `'pending_renewal'`, `'SUSP'` → `'suspended'` |
| `ValidFrom` | `issue_date` | Parse SAP date format |
| `ValidTo` | `expiry_date` | Parse SAP date format |
| `Conditions` (expand) | `conditions` | Map to JSONB array. May require separate OData call to condition entity set. |
| `CompanyCode`, `Werks`, `FunctionalLocation`, `SourceGroupId` | `extra_data` | Pack into JSONB |

### waste_manifests

| SAP Field | I/O Column | Transform |
|---|---|---|
| `WasteDocumentId` | `external_id` | Cast to TEXT |
| -- | `source_system` | Constant: `'sap_ehs'` |
| `ManifestNumber` | `manifest_number` | Direct |
| `WasteCode` | `waste_code` | SAP internal waste code → EPA codes (may need lookup table) |
| `WasteDescription` | `waste_description` | Direct |
| `Quantity` | `quantity` | Cast to DOUBLE PRECISION |
| `QuantityUnit` | `unit` | SAP unit → I/O: `'GAL'` → `'gallons'`, `'LB'` → `'lbs'`, `'TO'` → `'tons'` |
| `GeneratorName` | `generator_name` | Direct |
| `TransporterName` | `transporter_name` | Direct |
| `DisposalFacility` | `destination_facility` | Direct |
| `ShipDate` | `ship_date` | Parse SAP date format |
| `ReceivedDate` | `receipt_date` | Parse SAP date format |
| `WasteType`, `GeneratorEPAId`, `TransporterEPAId`, `DisposalEPAId`, `ContainerType`, `ContainerCount`, `DOTDescription`, `Status`, `HazardClass`, `CompanyCode`, `Werks` | `extra_data` | Pack into JSONB |

## Sync Strategy

| Data Type | Interval | Watermark | Notes |
|---|---|---|---|
| Emissions events | Daily | `ChangedOn` / `LastChangedDateTime` | SAP emission calculations are typically batch processes. Daily sync captures new calculations. |
| Compliance records | Daily | `ChangedOn` | Compliance tasks update during business hours. |
| Permits | Weekly | `ChangedOn` | Low-frequency changes. |
| Waste manifests | Daily | `ChangedOn` | Waste documents created as shipments are prepared. |

**Initial Load**: Use OData pagination. For OData v2, follow `__next` links. For v4, use `$skip`/`$top`. SAP systems can be slow for large result sets -- limit initial load to current year for emissions and active records for permits.

**Network Considerations**: SAP systems are typically on-premise behind a corporate firewall. The Import Service needs one of:
- **VPN**: Corporate VPN from the I/O server to the SAP network
- **SAP Cloud Connector**: If SAP BTP is in use, the Cloud Connector creates a reverse tunnel from the on-premise SAP system to the cloud
- **SAP Gateway exposed to DMZ**: Less common but possible -- SAP Gateway can be placed in a DMZ with restricted access

**Dual-Path CEMS Note**: SAP EHS does not process CEMS data in real-time. Some sites manually enter CEMS summary data into SAP (e.g., annual emission totals per source). This is aggregated data, not the hourly regulatory CEMS records. Use the direct DAHS file/database import for CEMS regulatory data. SAP's value is in the broader emissions management context -- combining CEMS totals with emission factor calculations, material balances, and regulatory reporting.

## Pre-Built Import Definition

### Connection Configuration

```jsonc
{
  "connector_type": "rest_api",
  "name": "SAP EHS Environmental",
  "description": "SAP S/4HANA EHS Management — emissions, compliance, permits, waste (OData)",
  "connection": {
    "base_url": "https://${SAP_HOST}:${SAP_PORT}/sap/opu/odata/sap",
    "auth": {
      "type": "${SAP_AUTH_TYPE}",
      "options": {
        "basic": {
          "username": "${SAP_USERNAME}",
          "password": "${SAP_PASSWORD}"
        },
        "oauth2": {
          "token_url": "${SAP_BTP_TOKEN_URL}",
          "client_id": "${SAP_CLIENT_ID}",
          "client_secret": "${SAP_CLIENT_SECRET}"
        },
        "x509": {
          "cert_path": "${SAP_CLIENT_CERT}",
          "key_path": "${SAP_CLIENT_KEY}"
        }
      }
    },
    "headers": {
      "Accept": "application/json",
      "sap-client": "${SAP_CLIENT_NUMBER}",
      "X-CSRF-Token": "Fetch"
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
  "source_id": "sap_ehs_emissions_events",
  "target_table": "emissions_events",
  "endpoint": "/EHS_EMISSION_MGMT_SRV/EmissionEvents",
  "method": "GET",
  "params": {
    "$filter": "ChangedOn gt datetime'${WATERMARK}'",
    "$orderby": "ChangedOn asc",
    "$format": "json"
  },
  "pagination": {
    "type": "odata_next_link",
    "next_link_path": "d.__next"
  },
  "schedule": "0 0 * * *",
  "watermark": {
    "column": "updated_at",
    "type": "timestamp",
    "source_field": "ChangedOn",
    "format": "sap_odata_v2"
  },
  "field_mapping": [
    { "source": "EmissionEventId",     "target": "external_id",       "transform": "to_string" },
    { "source": null,                  "target": "source_system",     "transform": "constant('sap_ehs')" },
    { "source": "EmissionSourceName",  "target": "source_name",       "transform": null },
    { "source": "PollutantCode",       "target": "parameter_name",    "transform": "rhai: sap_pollutant_map(value)" },
    { "source": "EmissionQuantity",    "target": "value",             "transform": "to_float" },
    { "source": "QuantityUnit",        "target": "unit",              "transform": "rhai: sap_unit_map(value)" },
    { "source": "RegulatoryLimit",     "target": "regulatory_limit",  "transform": "to_float" },
    { "source": "IsExceedance",        "target": "exceedance",        "transform": "rhai: value == 'X'" },
    { "source": "EventDate",           "target": "event_time",        "transform": "parse_sap_date" },
    { "source": "DurationMinutes",     "target": "duration_minutes",  "transform": "to_float" },
    { "source": "CauseCode",           "target": "cause",             "transform": "rhai: sap_cause_map(value)" },
    { "source": "CorrectiveActionText","target": "corrective_action", "transform": null },
    { "source": "ReportingStatus",     "target": "reported",          "transform": "rhai: value == 'SUBMITTED' || value == 'CLOSED'" }
  ],
  "extra_data_fields": [
    "EmissionSourceType", "PlantSection", "CalculationMethod",
    "EmissionFactorId", "SourceGroupId", "CompanyCode", "Werks"
  ],
  "transform_functions": {
    "sap_pollutant_map": "fn(v) { match v { 'SULFUR_DIOXIDE' => 'SO2', 'NITROGEN_OXIDES' => 'NOx', 'CARBON_MONOXIDE' => 'CO', 'PARTICULATE' => 'PM', 'VOC' => 'VOC', _ => v } }",
    "sap_unit_map": "fn(v) { match v { 'LB' => 'lbs', 'TO' => 'tons', 'KG' => 'kg', 'LB/H' => 'lbs_per_hr', 'TO/YR' => 'tons_per_yr', 'MT' => 'metric_tons', _ => v.to_lower() } }",
    "sap_cause_map": "fn(v) { match v { '01' => 'startup', '02' => 'shutdown', '03' => 'malfunction', '04' => 'upset', '05' => 'routine', '06' => 'maintenance', '07' => 'emergency', _ => 'other' } }"
  }
}
```

#### Compliance Records

```jsonc
{
  "source_id": "sap_ehs_compliance_records",
  "target_table": "compliance_records",
  "endpoint": "/EHS_INCIDENT_SRV/ComplianceTasks",
  "method": "GET",
  "params": {
    "$filter": "ChangedOn gt datetime'${WATERMARK}'",
    "$orderby": "ChangedOn asc",
    "$format": "json"
  },
  "pagination": { "type": "odata_next_link", "next_link_path": "d.__next" },
  "schedule": "0 0 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ChangedOn", "format": "sap_odata_v2" },
  "field_mapping": [
    { "source": "TaskId",              "target": "external_id",          "transform": "to_string" },
    { "source": null,                  "target": "source_system",        "transform": "constant('sap_ehs')" },
    { "source": "TaskType",            "target": "record_type",          "transform": "rhai: match value { 'INSP' => 'inspection', 'AUDT' => 'audit', 'CERT' => 'certification', 'VIOL' => 'violation', _ => 'inspection' }" },
    { "source": "Description",         "target": "title",                "transform": null },
    { "source": "LongText",            "target": "description",          "transform": null },
    { "source": "Status",              "target": "status",               "transform": "rhai: match value { 'E0001' => 'compliant', 'E0002' => 'non_compliant', 'E0003' => 'pending', _ => 'pending' }" },
    { "source": "RegulatoryBody",      "target": "agency",               "transform": null },
    { "source": "RegulationRef",       "target": "regulation_reference",  "transform": null },
    { "source": "DueDate",            "target": "due_date",              "transform": "parse_sap_date" },
    { "source": "CompletedDate",       "target": "completed_date",       "transform": "parse_sap_date" },
    { "source": "ResponsiblePerson",   "target": "assigned_to",          "transform": null },
    { "source": "FindingsCount",       "target": "findings_count",       "transform": "to_integer" }
  ],
  "extra_data_fields": [
    "Priority", "CompanyCode", "Werks", "FunctionalLocation",
    "CorrectiveAction", "CorrectiveActionDue"
  ]
}
```

#### Permits

```jsonc
{
  "source_id": "sap_ehs_permits",
  "target_table": "permits",
  "endpoint": "/EHS_EMISSION_MGMT_SRV/Permits",
  "method": "GET",
  "params": {
    "$filter": "ChangedOn gt datetime'${WATERMARK}'",
    "$format": "json"
  },
  "pagination": { "type": "odata_next_link", "next_link_path": "d.__next" },
  "schedule": "0 3 * * 0",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ChangedOn", "format": "sap_odata_v2" },
  "field_mapping": [
    { "source": "PermitId",       "target": "external_id",     "transform": "to_string" },
    { "source": null,             "target": "source_system",   "transform": "constant('sap_ehs')" },
    { "source": "PermitType",     "target": "permit_type",     "transform": "to_snake_case" },
    { "source": "PermitNumber",   "target": "permit_number",   "transform": null },
    { "source": "Description",    "target": "title",           "transform": null },
    { "source": "Authority",      "target": "issuing_agency",  "transform": null },
    { "source": "Status",         "target": "status",          "transform": "rhai: match value { 'ACTV' => 'active', 'EXPR' => 'expired', 'PEND' => 'pending_renewal', 'SUSP' => 'suspended', _ => 'active' }" },
    { "source": "ValidFrom",      "target": "issue_date",      "transform": "parse_sap_date" },
    { "source": "ValidTo",        "target": "expiry_date",     "transform": "parse_sap_date" },
    { "source": "Conditions",     "target": "conditions",      "transform": "to_jsonb" }
  ],
  "extra_data_fields": ["CompanyCode", "Werks", "FunctionalLocation", "SourceGroupId"]
}
```

#### Waste Manifests

```jsonc
{
  "source_id": "sap_ehs_waste_manifests",
  "target_table": "waste_manifests",
  "endpoint": "/EHS_WASTE_SRV/WasteDocuments",
  "method": "GET",
  "params": {
    "$filter": "ChangedOn gt datetime'${WATERMARK}'",
    "$format": "json"
  },
  "pagination": { "type": "odata_next_link", "next_link_path": "d.__next" },
  "schedule": "0 1 * * *",
  "watermark": { "column": "updated_at", "type": "timestamp", "source_field": "ChangedOn", "format": "sap_odata_v2" },
  "field_mapping": [
    { "source": "WasteDocumentId",   "target": "external_id",          "transform": "to_string" },
    { "source": null,                "target": "source_system",        "transform": "constant('sap_ehs')" },
    { "source": "ManifestNumber",    "target": "manifest_number",      "transform": null },
    { "source": "WasteCode",         "target": "waste_code",           "transform": null },
    { "source": "WasteDescription",  "target": "waste_description",    "transform": null },
    { "source": "Quantity",          "target": "quantity",             "transform": "to_float" },
    { "source": "QuantityUnit",      "target": "unit",                "transform": "rhai: sap_unit_map(value)" },
    { "source": "GeneratorName",     "target": "generator_name",       "transform": null },
    { "source": "TransporterName",   "target": "transporter_name",     "transform": null },
    { "source": "DisposalFacility",  "target": "destination_facility",  "transform": null },
    { "source": "ShipDate",          "target": "ship_date",            "transform": "parse_sap_date" },
    { "source": "ReceivedDate",      "target": "receipt_date",         "transform": "parse_sap_date" }
  ],
  "extra_data_fields": [
    "WasteType", "GeneratorEPAId", "TransporterEPAId", "DisposalEPAId",
    "ContainerType", "ContainerCount", "DOTDescription", "Status",
    "HazardClass", "CompanyCode", "Werks"
  ],
  "transform_functions": {
    "sap_unit_map": "fn(v) { match v { 'GAL' => 'gallons', 'LB' => 'lbs', 'TO' => 'tons', 'CY' => 'cubic_yards', 'DR' => 'drums', _ => v.to_lower() } }"
  }
}
```

## Notes

- **SAP date format is the biggest gotcha**: OData v2 returns dates as `/Date(1234567890000)/` (epoch milliseconds wrapped in a string). OData v4 returns ISO 8601. The Import Service needs a `parse_sap_date` transform that detects the format and converts accordingly. This is a common integration pain point with SAP.
- **ABAP booleans**: SAP uses `'X'` for true and `''` (empty string) for false, not JSON `true`/`false`. The `exceedance` field transform handles this explicitly.
- **SAP internal codes everywhere**: Pollutant codes, unit of measure codes, cause codes, and status codes are all SAP-internal identifiers that need mapping. The Rhai transform functions (`sap_pollutant_map`, `sap_unit_map`, `sap_cause_map`) handle the known cases. Customer-specific codes may need additions -- the import wizard should support editing these lookup maps.
- **CSRF token required**: SAP Gateway requires a CSRF token for write operations. For read-only imports, the `X-CSRF-Token: Fetch` header retrieves a token that can be cached. While the Import Service only reads, some SAP configurations enforce CSRF validation on GET requests.
- **SAP Client number**: The `sap-client` header specifies which SAP client (logical partition) to connect to. This is mandatory and site-specific (typically `100`, `200`, or `300`).
- **Three auth options**: The connection config provides templates for all three SAP auth methods. The administrator selects one during setup. Basic Auth is simplest for proof-of-concept; X.509 certificates are standard for production on-premise; OAuth 2.0 via SAP BTP is the path for cloud-to-cloud.
- **Network access is the real challenge**: SAP systems are almost always behind a corporate firewall. Getting network access from the I/O server to the SAP Gateway is often a weeks-long IT process involving firewall rules, VPN configuration, or SAP Cloud Connector setup. Plan for this early.
- **Custom CDS views**: Many SAP EHS customers create custom CDS (Core Data Services) views for reporting and integration. These expose data models tailored to the site's specific SAP configuration. If standard OData services do not expose the needed data, ask the customer's SAP team for their custom CDS views -- these can be used as OData endpoints directly.
- **OData v2 vs v4 pagination**: v2 uses `__next` links (server-driven, opaque URL). v4 uses `$skip`/`$top` or `@odata.nextLink`. The Import Service's pagination handler needs to detect which version is in use (from the `$metadata` response or the response format) and handle accordingly.
- **Higher timeout**: Like Enablon, SAP can be slow for large queries. The 60s timeout accounts for SAP's processing time, especially for complex OData queries with `$expand`.
- **No LDAR or CEMS**: SAP EHS does not handle LDAR monitoring or CEMS real-time data. Use LeakDAS/Guideware for LDAR and direct DAHS import for CEMS regulatory data.
- **SAP as secondary source**: Many refineries have SAP for ERP but use a best-of-breed EHS platform (Cority, Sphera, Intelex) for environmental compliance. In those cases, SAP EHS may not be the environmental data source at all. Confirm with the customer which system is their environmental system of record before configuring this connector.
