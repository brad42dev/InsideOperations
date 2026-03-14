# SAP EHS Management (S/4HANA) — Regulatory / Compliance Connector Profile

## Application Overview

- **Vendor**: SAP SE
- **Product**: SAP EHS Management (S/4HANA add-on) / SAP Environment, Health, and Safety Management
- **Market Position**: Dominant in refineries already running SAP for ERP. Tightly integrated with Plant Maintenance (PM), Materials Management (MM), and Human Capital Management (HCM). Very common in large integrated oil companies (ExxonMobil, BP, BASF). Strong environmental compliance modules (waste tracking, emission calculations, dangerous goods).
- **Licensing**: Included in SAP S/4HANA EHS license. Cloud APIs subject to SAP BTP fair-use policy. On-premise APIs have no per-call cost.
- **Typical Deployment**: On-premise S/4HANA (majority of existing refinery installations) or SAP S/4HANA Cloud. Refinery EHS data lives alongside plant maintenance, equipment master, and financial data in the same SAP system.

## API Surface

- **Type**: OData v2/v4 via SAP Business Accelerator Hub
- **Base URL**:
  - On-premise: `https://{host}/sap/opu/odata/sap/{service_name}`
  - Cloud: `https://{tenant}-api.s4hana.cloud.sap/sap/opu/odata/sap/{service_name}`
- **Auth**:
  - On-premise: Basic Auth (SAP user/password) or X.509 client certificate
  - Cloud: OAuth 2.0 via SAP BTP — `POST /oauth/token` with client credentials
- **Pagination**: OData `$top`/`$skip` or server-driven `__next` link
- **Incremental Sync**: OData `$filter=LastChangeDateTime gt datetime'{SAP_format}'`
- **Rate Limits**: SAP BTP quotas (cloud); SAP ICM configuration (on-premise). HTTP 429 or 503 responses.
- **API Docs**: `https://api.sap.com/` (SAP Business Accelerator Hub). EHS-specific: `https://api.sap.com/package/SAPS4HANAforEHSWorkplaceSafetyIntegrationwithThirdPartySystems/`

### Key OData Services

| Service | Endpoint Pattern | Returns |
|---------|-----------------|---------|
| `API_EHS_REPORT_INCIDENT_SRV` | `/IncidentSet` | EHS incidents (well-documented, standard) |
| `API_EHS_REPORT_INCIDENT_SRV` | `/LocationSet` | Incident locations |
| `API_EHS_REPORT_INCIDENT_SRV` | `/PersonSet` | Persons involved in incidents |
| `API_EHSM_HAZARDOUS_SUBSTANCE` | `/HazSubstanceSet` | Hazardous substance data |
| (custom CDS view) | `/MOCSet` | MOC records (typically custom) |
| (custom CDS view) | `/WasteManifestSet` | RCRA waste tracking (typically custom) |
| (custom CDS view) | `/InspectionFindingSet` | Inspection/audit findings (typically custom) |

**Important**: SAP's incident management API is standardized and well-documented. MOC, PHA/risk assessment, and inspection data typically require custom CDS (Core Data Services) views or BAPIs because SAP does not ship standard OData services for these EHS functions.

## Target Tables

| I/O Table | Primary / Secondary | Data Sourced |
|-----------|-------------------|--------------|
| `safety_incidents` | Primary | `API_EHS_REPORT_INCIDENT_SRV` (standard) |
| `moc_records` | Primary | Custom CDS view (site-specific) |
| `inspection_findings` | Primary | Custom CDS view or `API_EHSM_AUDIT` if available |
| `regulatory_permits` | Secondary | Custom CDS view for environmental permits |
| `risk_assessments` | Secondary | Custom CDS view (PHA data often in third-party tools) |

## Field Mapping — Safety Incidents

This is the most standardized SAP EHS integration path. The `API_EHS_REPORT_INCIDENT_SRV` is well-documented on SAP Business Accelerator Hub.

| SAP Field | I/O `safety_incidents` Column | Transform |
|-----------|-------------------------------|-----------|
| `IncidentUUID` | `external_id` | Cast to string (SAP GUID format) |
| (static) | `source_system` | `"sap_ehs"` |
| `IncidentID` | `incident_number` | Direct |
| `IncidentTitle` / `Description` | `title` | Direct |
| `LongText` | `description` | Direct (may require separate `$expand=LongText` call) |
| `IncidentCategory` | `incident_type` | Normalize (see table below) |
| `Severity` | `severity` | Normalize (see table below) |
| `IncidentStatus` | `status` | Normalize (see table below) |
| `LocationName` (via `$expand=Location`) | `location` | Expand LocationSet |
| `FunctionalArea` | `area` | Direct |
| `IncidentUTCDateTime` | `occurred_at` | Parse SAP datetime → TIMESTAMPTZ (UTC) |
| `ReportedDateTime` | `reported_at` | Parse SAP datetime → TIMESTAMPTZ |
| `ReportedByName` (via `$expand=Person`) | `reported_by` | Expand PersonSet, filter for reporter role |
| `RootCauseText` | `root_cause` | Direct |
| Related corrective actions | `corrective_actions` | Expand if available; otherwise separate call → JSONB array |
| `Equipment` (via equipment nav property) | (lookup) | Cross-reference SAP Equipment ID → I/O point tag via equipment master mapping |
| `$remaining` | `extra_data` | Remaining SAP fields as JSONB |

### Incident Type Normalization

| SAP `IncidentCategory` | I/O `incident_type` |
|------------------------|---------------------|
| `01` / `Injury` | `injury` |
| `02` / `Near Miss` | `near_miss` |
| `03` / `Property Damage` | `property_damage` |
| `04` / `Environmental` | `environmental_release` |
| `05` / `Process Safety` | `process_safety` |
| `06` / `Fire` | `fire` |

**Note**: SAP uses numeric category codes that are configurable per installation. The mapping above shows typical defaults. Verify the actual configuration table (`T_EHS_INC_CAT` or equivalent) during setup.

### Severity Normalization

| SAP `Severity` | I/O `severity` |
|----------------|----------------|
| `01` / `Catastrophic` | `catastrophic` |
| `02` / `Major` | `major` |
| `03` / `Moderate` | `moderate` |
| `04` / `Minor` | `minor` |
| `05` / `Negligible` | `negligible` |

### Status Normalization

| SAP `IncidentStatus` | I/O `status` |
|---------------------|--------------|
| `01` / `Created` / `Reported` | `reported` |
| `02` / `In Process` / `Investigation` | `under_investigation` |
| `03` / `Corrective Action` | `corrective_action` |
| `04` / `Closed` / `Completed` | `closed` |

## Field Mapping — MOC Records (Custom CDS View)

SAP does not ship a standard MOC OData service. Most SAP EHS installations with MOC either use a custom development (Z-tables + custom CDS views) or a third-party MOC tool (Sphera, Intelex) alongside SAP. The mapping below assumes a custom CDS view has been created.

| SAP Custom Field | I/O `moc_records` Column | Transform |
|-----------------|--------------------------|-----------|
| `MOCRequestUUID` | `external_id` | Cast to string |
| (static) | `source_system` | `"sap_ehs"` |
| `MOCNumber` / `RequestNumber` | `moc_number` | Direct |
| `Title` / `Description` | `title` | Direct |
| `LongText` | `description` | Direct |
| `Status` | `status` | Normalize per site config (see SAP status codes) |
| `ChangeCategory` | `category` | Normalize per site config |
| `RiskLevel` | `risk_level` | Normalize: numeric → `"high"` / `"medium"` / `"low"` |
| `RequestedByUser` | `originator` | SAP user ID → name via user master |
| `ApprovedByUser` | `approver` | SAP user ID → name via user master |
| `SubmittedDate` | `submitted_at` | Parse SAP date → TIMESTAMPTZ |
| `ApprovedDate` | `approved_at` | Parse SAP date → TIMESTAMPTZ |
| `ImplementationDueDate` | `implementation_due_at` | Parse SAP date → TIMESTAMPTZ |
| `ClosedDate` | `closed_at` | Parse SAP date → TIMESTAMPTZ |
| `Equipment` (nav property) | `affected_equipment_ids` | Cross-reference SAP Equipment ID → I/O point UUID via mapping table |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## Field Mapping — Inspection Findings (Custom CDS View)

| SAP Custom Field | I/O `inspection_findings` Column | Transform |
|-----------------|----------------------------------|-----------|
| `FindingUUID` | `external_id` | Cast to string |
| (static) | `source_system` | `"sap_ehs"` |
| `InspectionType` | `inspection_type` | Normalize per site config |
| `FindingTitle` | `title` | Direct |
| `FindingDescription` | `description` | Direct |
| `FindingSeverity` | `finding_type` | Normalize: SAP severity code → I/O finding_type enum |
| `Status` | `status` | Normalize per site config |
| `Equipment` | `equipment_id` | Cross-reference SAP Equipment ID → I/O UUID |
| `ResponsibleUser` | `assigned_to` | SAP user ID → name |
| `DueDate` | `due_date` | Parse SAP date |
| `CompletionDate` | `closed_date` | Parse SAP date |
| `RegulatoryReference` | `regulation_reference` | Direct |
| `$remaining` | `extra_data` | Remaining fields as JSONB |

## SAP Equipment Master Cross-Reference

The highest-value aspect of SAP integration is the equipment master link. SAP's equipment hierarchy (`EQUI` table / Equipment API) provides a complete mapping from SAP equipment IDs to functional location codes and technical object descriptions. This enables I/O to cross-reference SAP-sourced compliance data with the I/O point model.

**Setup step**: During initial configuration, import or map SAP Equipment IDs to I/O point tags. Options:
1. **Tag name convention**: If SAP and I/O use the same equipment tag naming, direct string matching works
2. **Mapping table**: Maintain a `sap_equipment_map` table (`sap_equipment_id` → `io_point_id`) for sites where naming conventions differ
3. **SAP Functional Location**: Some sites use SAP functional location codes as the common key between SAP and DCS/historian tag names

## Sync Strategy

| Data Type | Interval | Watermark | Method |
|-----------|----------|-----------|--------|
| Safety incidents | 30 minutes | `LastChangeDateTime` via OData `$filter` | Incremental poll |
| MOC records | 30 minutes | `LastChangeDateTime` via OData `$filter` | Incremental poll (custom CDS) |
| Inspection findings | Daily (02:00) | `LastChangeDateTime` via OData `$filter` | Incremental poll (custom CDS) |
| Environmental / Permits | Every 4 hours | `LastChangeDateTime` via OData `$filter` | Incremental poll (custom CDS) |

### Initial Load

1. Verify OData service availability — test `$metadata` endpoint for each service
2. For standard services (`API_EHS_REPORT_INCIDENT_SRV`), run full sync with `$top`/`$skip` pagination
3. For custom CDS views, coordinate with SAP Basis team to confirm entity sets and field names
4. Import or establish SAP Equipment ID → I/O point tag mapping
5. Store latest `LastChangeDateTime` per entity as watermark

## Pre-Built Import Definition

### Connection Config — On-Premise

```json
{
  "connector_type": "rest_json",
  "name": "SAP S/4HANA EHS (On-Premise)",
  "base_url": "https://{{SAP_HOST}}/sap/opu/odata/sap",
  "auth": {
    "type": "basic",
    "username": "{{SAP_USERNAME}}",
    "password": "{{SAP_PASSWORD}}"
  },
  "default_headers": {
    "Accept": "application/json",
    "sap-client": "{{SAP_CLIENT}}"
  },
  "tls": {
    "verify_cert": true,
    "client_cert": "{{SAP_CLIENT_CERT_PATH}}",
    "client_key": "{{SAP_CLIENT_KEY_PATH}}"
  },
  "rate_limit": {
    "respect_retry_after": true,
    "max_retries": 3,
    "concurrent_requests": 2
  }
}
```

### Connection Config — Cloud

```json
{
  "connector_type": "rest_json",
  "name": "SAP S/4HANA EHS (Cloud)",
  "base_url": "https://{{SAP_TENANT}}-api.s4hana.cloud.sap/sap/opu/odata/sap",
  "auth": {
    "type": "oauth2_client_credentials",
    "token_url": "https://{{SAP_TENANT}}.authentication.{{SAP_REGION}}.hana.ondemand.com/oauth/token",
    "client_id": "{{SAP_BTP_CLIENT_ID}}",
    "client_secret": "{{SAP_BTP_CLIENT_SECRET}}"
  },
  "default_headers": {
    "Accept": "application/json"
  },
  "rate_limit": {
    "respect_retry_after": true,
    "max_retries": 3,
    "concurrent_requests": 2
  }
}
```

### Source Config — Safety Incidents

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/API_EHS_REPORT_INCIDENT_SRV/IncidentSet",
  "method": "GET",
  "query_params": {
    "$expand": "Location,Person",
    "$orderby": "LastChangeDateTime asc"
  },
  "pagination": {
    "type": "odata",
    "page_size": 100,
    "next_link_field": "__next"
  },
  "incremental": {
    "watermark_field": "LastChangeDateTime",
    "filter_template": "$filter=LastChangeDateTime gt datetime'{watermark}'",
    "format": "sap_datetime"
  },
  "schedule": "*/30 * * * *",
  "target_table": "safety_incidents",
  "upsert_key": "external_id"
}
```

### Source Config — MOC Records (Custom CDS)

```json
{
  "source_type": "rest_endpoint",
  "endpoint": "/{{SAP_MOC_CDS_SERVICE}}/MOCSet",
  "method": "GET",
  "query_params": {
    "$orderby": "LastChangeDateTime asc"
  },
  "pagination": {
    "type": "odata",
    "page_size": 100,
    "next_link_field": "__next"
  },
  "incremental": {
    "watermark_field": "LastChangeDateTime",
    "filter_template": "$filter=LastChangeDateTime gt datetime'{watermark}'",
    "format": "sap_datetime"
  },
  "schedule": "*/30 * * * *",
  "target_table": "moc_records",
  "upsert_key": "external_id"
}
```

### Field Mapping Array — Safety Incidents

```json
{
  "field_mappings": [
    {"source": "IncidentUUID", "target": "external_id", "transform": "to_string"},
    {"source": null, "target": "source_system", "transform": "static", "value": "sap_ehs"},
    {"source": "IncidentID", "target": "incident_number"},
    {"source": "IncidentTitle", "target": "title"},
    {"source": "LongText", "target": "description"},
    {"source": "IncidentCategory", "target": "incident_type", "transform": "status_map", "map": {"01": "injury", "02": "near_miss", "03": "property_damage", "04": "environmental_release", "05": "process_safety", "06": "fire"}},
    {"source": "Severity", "target": "severity", "transform": "status_map", "map": {"01": "catastrophic", "02": "major", "03": "moderate", "04": "minor", "05": "negligible"}},
    {"source": "IncidentStatus", "target": "status", "transform": "status_map", "map": {"01": "reported", "02": "under_investigation", "03": "corrective_action", "04": "closed"}},
    {"source": "Location/LocationName", "target": "location", "transform": "nested_field"},
    {"source": "FunctionalArea", "target": "area"},
    {"source": "IncidentUTCDateTime", "target": "occurred_at", "transform": "parse_sap_datetime"},
    {"source": "ReportedDateTime", "target": "reported_at", "transform": "parse_sap_datetime"},
    {"source": "Person/PersonName", "target": "reported_by", "transform": "nested_field_filter", "filter": {"role": "Reporter"}},
    {"source": "RootCauseText", "target": "root_cause"},
    {"source": "Equipment", "target": "affected_equipment_ids", "transform": "sap_equipment_to_uuid"},
    {"source": "$remaining", "target": "extra_data", "transform": "collect_unmapped"}
  ]
}
```

## Notes

- **SAP is the most complex connector to configure.** Entity names, service names, and field names vary by SAP version, industry solution, and customer customization. Budget extra time for discovery and testing.
- **Standard vs. custom OData services**: Only the incident management API (`API_EHS_REPORT_INCIDENT_SRV`) is well-standardized. MOC, PHA, inspection, and environmental data typically require custom CDS views created by the SAP Basis/ABAP team. I/O cannot create these views — they must exist in SAP before the connector can consume them.
- **SAP Basis team involvement is required.** Authentication setup (especially X.509 certificate-based on-premise), OData service activation, custom CDS view creation, and API user provisioning all require SAP Basis team action. Plan for a coordination phase.
- **SAP datetime format**: SAP OData v2 uses a non-standard datetime format: `/Date(1234567890000)/` (milliseconds since epoch). OData v4 uses ISO 8601. The connector must handle both formats depending on the service version. The `parse_sap_datetime` transform handles this.
- **`sap-client` header**: On-premise SAP systems use the `sap-client` header to identify the target client (e.g., `100`, `200`). This is required on every API call.
- **Equipment master is the key value-add.** If the refinery runs SAP PM alongside SAP EHS, the equipment master provides a complete asset registry that links compliance data to physical equipment. Cross-referencing SAP Equipment IDs with I/O point tags is the most valuable setup step. Without this mapping, compliance data lacks equipment context.
- **PHA data is usually not in SAP.** Most refineries use dedicated PHA tools (PHA-Pro/Sphera, PHAWorks) rather than SAP for HAZOP/LOPA studies. If risk assessment data is needed, expect it to come from a separate connector (Sphera) rather than SAP.
- **Concurrent request limit**: SAP ICM has configurable connection limits. Keep concurrent requests low (2-3) to avoid impacting other SAP integrations and end users.
