# GE Vernova APM (formerly Meridium / GE Digital APM) -- Equipment Registry Connector Profile

## Application Overview

- **Vendor**: GE Vernova (spun off from GE Digital in 2024; product originated as Meridium, acquired by GE in 2016)
- **Product**: GE APM (Asset Performance Management). Modules include APM Health, APM Reliability, APM Strategy, Mechanical Integrity, and Risk-Based Inspection (RBI)
- **Market position**: Strong in downstream petroleum and power generation. Meridium's installed base in North American refineries is significant. Often deployed alongside a CMMS (Maximo or SAP PM) as the reliability and risk analysis layer. GE APM is not a CMMS -- it provides asset health scoring, risk assessment, failure analysis, and inspection management on top of CMMS master data
- **Licensing**: Commercial (named-user or enterprise). REST API access included with the APM platform license. On-premise (legacy) and SaaS (current) deployments
- **Typical refinery scenario**: GE APM imports equipment master data from the site's CMMS, then adds reliability data (failure modes, risk scores, inspection results, health indicators). For I/O, GE APM is most valuable as a source of equipment criticality/risk scoring and RBI inspection data. It can also serve as the primary equipment registry if the site uses APM as its consolidated asset data hub

## API Surface

| Attribute | Detail |
|-----------|--------|
| **API type** | REST/JSON (APM V4 API). Legacy SOAP/XML available on older on-premise installations |
| **Base URL** | `https://{apm-host}/service/api/v4/` (SaaS) or `https://{apm-host}/meridium/api/v4/` (on-premise) |
| **Auth methods** | OAuth 2.0 authorization code or client credentials (SaaS), Basic Auth or Windows Auth (on-premise legacy) |
| **Pagination** | Offset-based: `page` (1-based) + `pageSize` parameters. Response includes `totalCount` |
| **Rate limits** | SaaS: tier-dependent, typically 300-600 requests/min. On-premise: server-configured |
| **Incremental sync** | Filter by `lastModifiedDate` on most entities |
| **Response format** | JSON |
| **API docs** | GE Vernova APM API documentation (requires customer portal access) |

### Key Endpoints

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Equipment list | `GET assets?page=1&pageSize=500` | GET |
| Equipment detail | `GET assets/{entityKey}` | GET |
| Equipment hierarchy | `GET assets/{entityKey}/hierarchy` | GET |
| Equipment fields/attributes | `GET assets/{entityKey}/fields` | GET |
| Functional locations | `GET functional-locations?page=1&pageSize=500` | GET |
| RBI components | `GET rbi/components?assetId={entityKey}` | GET |
| Risk assessments | `GET rbi/risk-assessments?assetId={entityKey}` | GET |
| Health indicators | `GET health/indicators?assetId={entityKey}` | GET |
| Criticality assessments | `GET criticality/assessments?assetId={entityKey}` | GET |
| Custom queries (GQL) | `POST query` (APM's internal query language) | POST |

### Connection Configuration

```jsonc
{
  "connector_type": "rest_json",
  "base_url": "https://{apm-host}/service/api/v4",
  "auth": {
    "method": "oauth2_client_credentials",
    "token_url": "https://{apm-host}/service/auth/token",
    "client_id": "{client-id}",
    "client_secret": "{secret}",
    "scope": "api"
    // On-premise legacy alternative:
    // "method": "basic",
    // "username": "{domain}\\{user}",
    // "password": "{secret}"
  },
  "headers": {
    "Accept": "application/json",
    "Content-Type": "application/json"
  },
  "pagination": {
    "strategy": "page_number",
    "page_size": 500,
    "page_size_param": "pageSize",
    "page_param": "page",
    "one_based": true
  },
  "rate_limit": {
    "requests_per_minute": 300
  }
}
```

## Target Tables

| I/O Table | Role | Populated |
|-----------|------|-----------|
| `equipment` | Primary -- one row per GE APM asset record | Yes |
| `equipment_nameplate` | Asset field values (design data, nameplate attributes) | Yes |
| `equipment_criticality` | RBI risk scores and criticality assessments -- **this is GE APM's strongest data** | Yes |
| `equipment_points` | Not directly from GE APM | No (manual in I/O) |

## Field Mapping

### Asset Master (`assets` -> `equipment`)

| GE APM Field | I/O Column | Transform | Required |
|--------------|------------|-----------|----------|
| `entityKey` | `external_id` | Direct (GE APM internal entity key, numeric or GUID) | Yes |
| `assetId` | `tag` | Direct -- typically the plant equipment tag (e.g., "P-101A"). GE APM imports this from the CMMS | Yes |
| `description` | `description` | Direct, trim whitespace | Yes |
| `assetFamily` | `equipment_class` | See class normalization below | Yes |
| `assetType` | `equipment_type` | See type normalization below | No |
| `status` | `status` | See status normalization below | Yes |
| `functionalLocation` | `functional_location` | Direct | No |
| `area` | `area` | Direct (if populated in APM) | No |
| `unit` | `unit` | Direct (if populated in APM) | No |
| `parentAssetId` | `parent_id` | Lookup: resolve parent asset ID to I/O `equipment.id` via `external_id` | No |
| `manufacturer` | `manufacturer` | Direct | No |
| `modelNumber` | `model_number` | Direct | No |
| `serialNumber` | `serial_number` | Direct | No |
| `installDate` | `year_installed` | `extract_year(installDate)` | No |
| `materialOfConstruction` | `material_of_construction` | Direct | No |
| `pidDrawingNumber` | `pid_reference` | Direct | No |
| `cmmsId` | `extra_data.cmms_id` | Preserved in JSONB for CMMS back-reference | No |
| `cmmsSystem` | `extra_data.cmms_system` | Preserved in JSONB | No |
| `siteKey` | `site_id` | Lookup: map GE APM site key to I/O `sites.id` | No |
| -- | `source_system` | Constant: `"ge_apm"` | Yes |
| -- | `data_source` | Constant: `"imported"` | Yes |

### Asset Fields -> `equipment_nameplate`

GE APM stores technical attributes as "fields" on asset families. Each asset family (e.g., Pump, Compressor) has a defined set of fields for design/nameplate data.

| GE APM Field | I/O Column | Transform |
|--------------|------------|-----------|
| (parent `entityKey`) | `equipment_id` | Lookup via `external_id` |
| `fieldId` or `fieldName` | `attribute_name` | Lowercase, replace spaces with underscores |
| `value` | `attribute_value` | Convert to string |
| `unitOfMeasure` | `unit_of_measure` | Normalize GE APM UoM codes |
| `fieldCategory` | `extra_data.ge_field_category` | Preserve (e.g., "Design", "Operating", "Nameplate") |

### RBI / Criticality Assessments -> `equipment_criticality`

This is GE APM's most valuable data for I/O. GE APM's RBI module calculates risk scores based on probability of failure (PoF) and consequence of failure (CoF). Criticality assessments provide multi-factor risk breakdowns.

| GE APM Field | I/O Column | Transform |
|--------------|------------|-----------|
| (parent `entityKey`) | `equipment_id` | Lookup via `external_id` |
| `overallRiskRanking` or `criticalityRating` | `overall_criticality` | See criticality normalization below |
| `safetyConsequence` | `safety_impact` | Scale to 1-5: map GE's consequence categories (A-E or 1-5) |
| `environmentalConsequence` | `environmental_impact` | Scale to 1-5 |
| `productionConsequence` | `production_impact` | Scale to 1-5 |
| `financialConsequence` | `maintenance_cost_impact` | Scale to 1-5 |
| `assessedBy` | `assessed_by` | Direct |
| `assessmentDate` | `assessment_date` | Direct date |
| `nextAssessmentDate` | `extra_data.next_assessment_date` | Preserved in JSONB |
| `methodology` | `notes` | Concatenate: `"GE APM {methodology} assessment. PoF={pofCategory}, CoF={cofCategory}"` |

#### Criticality Normalization

GE APM uses risk matrices (typically 5x5 PoF vs CoF). The overall risk ranking maps to I/O's 1-5 scale:

| GE APM `overallRiskRanking` | I/O `overall_criticality` |
|------------------------------|--------------------------|
| `VH` (Very High), `CRITICAL`, `5` | `1` |
| `H` (High), `HIGH`, `4` | `2` |
| `M` (Medium), `MEDIUM`, `3` | `3` |
| `L` (Low), `LOW`, `2` | `4` |
| `VL` (Very Low), `ROUTINE`, `1` | `5` |

GE APM consequence scores (typically A-E or 1-5) map to I/O's 1-5 impact scales:

| GE APM Consequence | I/O Impact Score |
|-------------------|-----------------|
| `A` / `5` (Catastrophic) | `1` |
| `B` / `4` (Major) | `2` |
| `C` / `3` (Moderate) | `3` |
| `D` / `2` (Minor) | `4` |
| `E` / `1` (Negligible) | `5` |

**Note**: GE APM's consequence scales are inverted relative to I/O (GE: 5=worst, I/O: 1=most critical). The transform must invert: `io_score = 6 - ge_score`.

## Equipment Class Normalization

GE APM uses "Asset Families" to classify equipment. These are broadly standardized but can be customized:

| GE APM `assetFamily` | I/O `equipment_class` |
|-----------------------|----------------------|
| `Pump`, `Compressor`, `Turbine`, `Fan`, `Blower`, `Agitator`, `Rotating Equipment` | `rotating` |
| `Vessel`, `Column`, `Tank`, `Drum`, `Reactor`, `Pressure Vessel` | `static` |
| `Heat Exchanger`, `Exchanger`, `Air Cooler`, `Heater`, `Boiler`, `Condenser`, `Furnace` | `heat_exchanger` |
| `Instrument`, `Transmitter`, `Analyzer`, `Control Valve`, `Meter`, `Instrumentation` | `instrument` |
| `Motor`, `Transformer`, `Switchgear`, `VFD`, `Generator`, `Electrical Equipment` | `electrical` |
| `Piping`, `Pipeline`, `Pipe` | `piping` |
| `Relief Device`, `PSV`, `Safety Valve`, `PRV`, `SIS`, `Safety Instrumented System` | `relief_device` |
| `Structural`, `Foundation`, `Civil` | `structural` |

**Fallback**: List all distinct asset families during setup wizard for manual mapping. Default to `static`.

## Equipment Type Normalization

Map from GE APM's more specific asset type/sub-family:

| GE APM `assetType` | I/O `equipment_type` |
|---------------------|---------------------|
| `Centrifugal Pump` | `centrifugal_pump` |
| `Reciprocating Pump` | `reciprocating_pump` |
| `Positive Displacement Pump` | `positive_displacement_pump` |
| `Centrifugal Compressor` | `centrifugal_compressor` |
| `Reciprocating Compressor` | `reciprocating_compressor` |
| `Shell and Tube Exchanger` | `shell_tube_exchanger` |
| `Air Cooled Exchanger` | `air_cooled_exchanger` |
| `Plate Heat Exchanger` | `plate_exchanger` |
| `Pressure Vessel` | `pressure_vessel` |
| `Distillation Column` | `distillation_column` |
| `Storage Tank` | `storage_tank` |
| `Electric Motor` | `electric_motor` |
| `Control Valve` | `control_valve` |
| `Pressure Transmitter` | `pressure_transmitter` |
| `Pressure Safety Valve` | `pressure_safety_valve` |

**Fallback**: Lowercase, replace spaces with underscores, store as-is.

## Status Normalization

| GE APM `status` | I/O `status` |
|-----------------|--------------|
| `Active`, `In Service`, `Operating` | `active` |
| `Inactive`, `Out of Service`, `Standby` | `inactive` |
| `Decommissioned`, `Retired`, `Scrapped` | `decommissioned` |
| Not mapped / unknown | `active` (default) |

## Hierarchy Mapping

GE APM supports equipment hierarchy through:

1. **Functional Location tree**: Organizational structure (Site > Plant > Unit > System), typically imported from the CMMS.
2. **Asset-to-asset parent-child**: The `parentAssetId` field on assets supports sub-equipment relationships (e.g., pump -> motor, compressor -> driver).
3. **RBI component hierarchy**: RBI-specific hierarchy of components within equipment (e.g., pressure vessel -> nozzle, shell, head). Not mapped to I/O equipment hierarchy -- these are RBI-internal.

### Mapping to I/O `equipment.parent_id`

- **Asset-to-asset**: `parentAssetId` maps directly to I/O's `parent_id`. Two-pass import for reference resolution.
- **Functional Location**: Mapped to `functional_location` field on the equipment record.
- **RBI components**: Not imported as equipment records. RBI component data is too granular for I/O's equipment registry. If needed, preserve in `extra_data.rbi_components` as JSONB.

### Import Order

1. Equipment records (first pass -- no `parent_id`)
2. Equipment records (second pass -- resolve `parent_id`)
3. Asset fields -> `equipment_nameplate`
4. Criticality/RBI assessments -> `equipment_criticality`

## Sync Strategy

| Aspect | Configuration |
|--------|---------------|
| **Schedule** | Daily at 02:00 site time |
| **Sync type** | Incremental (watermark-based) |
| **Watermark column** | `lastModifiedDate` on assets |
| **Full sync trigger** | Initial load, or manual trigger after GE APM data migration |
| **Initial load** | Page through all assets with `pageSize=500`. Expect 2,000-15,000 asset records. Additional N+1 calls for fields and criticality assessments. Typical runtime: 15-45 minutes |
| **Conflict resolution** | GE APM wins for criticality data (its primary value). For equipment identity fields, defer to CMMS connector if both are configured. I/O-only fields preserved |
| **Soft delete sync** | Assets with GE APM status `Decommissioned`/`Retired` -> I/O `status = 'decommissioned'` |
| **Upsert key** | `external_id` + `source_system` |
| **Multi-source note** | If both GE APM and a CMMS connector (Maximo/SAP PM) are configured, GE APM should run after the CMMS connector. GE APM updates criticality and nameplate data on existing equipment records created by the CMMS import |

## Pre-Built Import Definition

```jsonc
{
  "name": "GE Vernova APM Equipment Registry",
  "description": "Import asset master data, nameplate attributes, and criticality/RBI risk scores from GE APM",
  "source_system": "ge_apm",
  "connector_type": "rest_json",
  "domain": "equipment",
  "enabled": true,

  "connection": {
    "base_url": "https://{apm-host}/service/api/v4",
    "auth_method": "oauth2_client_credentials",
    "token_url": "https://{apm-host}/service/auth/token",
    "timeout_seconds": 60,
    "retry_attempts": 3,
    "retry_delay_seconds": 10
  },

  "source": {
    "endpoints": [
      {
        "id": "asset_master",
        "path": "/assets",
        "params": {
          "pageSize": 500,
          "page": 1
        },
        "pagination": {
          "strategy": "page_number",
          "page_size_param": "pageSize",
          "page_param": "page",
          "total_count_field": "totalCount"
        },
        "watermark": {
          "field": "lastModifiedDate",
          "filter_template": "lastModifiedDate>{watermark}"
        },
        "response_root": "data"
      },
      {
        "id": "asset_fields",
        "path": "/assets/{entityKey}/fields",
        "params": {},
        "iteration": "per_record",
        "iterate_over": "asset_master",
        "iterate_key": "entityKey",
        "response_root": "data",
        "depends_on": "asset_master"
      },
      {
        "id": "criticality_assessments",
        "path": "/criticality/assessments",
        "params": {
          "assetId": "{entityKey}",
          "latest": true
        },
        "iteration": "per_record",
        "iterate_over": "asset_master",
        "iterate_key": "entityKey",
        "response_root": "data",
        "depends_on": "asset_master"
      }
    ]
  },

  "field_mappings": [
    {
      "target_table": "equipment",
      "source_endpoint": "asset_master",
      "mappings": [
        { "source": "entityKey",              "target": "external_id" },
        { "source": "assetId",                "target": "tag" },
        { "source": "description",            "target": "description",            "transform": "trim" },
        { "source": "assetFamily",            "target": "equipment_class",        "transform": "normalize_ge_equipment_class" },
        { "source": "assetType",              "target": "equipment_type",         "transform": "normalize_ge_equipment_type" },
        { "source": "status",                 "target": "status",                 "transform": "normalize_ge_status" },
        { "source": "functionalLocation",     "target": "functional_location" },
        { "source": "area",                   "target": "area" },
        { "source": "unit",                   "target": "unit" },
        { "source": "parentAssetId",          "target": "parent_id",              "transform": "lookup_equipment_by_external_id" },
        { "source": "manufacturer",           "target": "manufacturer" },
        { "source": "modelNumber",            "target": "model_number" },
        { "source": "serialNumber",           "target": "serial_number" },
        { "source": "installDate",            "target": "year_installed",         "transform": "extract_year" },
        { "source": "materialOfConstruction", "target": "material_of_construction" },
        { "source": "pidDrawingNumber",       "target": "pid_reference" },
        { "source": null,                     "target": "source_system",          "transform": "constant('ge_apm')" },
        { "source": null,                     "target": "data_source",            "transform": "constant('imported')" }
      ]
    },
    {
      "target_table": "equipment_nameplate",
      "source_endpoint": "asset_fields",
      "filter": "fieldCategory IN ('Design', 'Nameplate', 'Operating')",
      "mappings": [
        { "source": "$parent.entityKey",      "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "fieldName",              "target": "attribute_name",         "transform": "lowercase_underscore" },
        { "source": "value",                  "target": "attribute_value",        "transform": "to_string" },
        { "source": "unitOfMeasure",          "target": "unit_of_measure",        "transform": "normalize_ge_uom" }
      ]
    },
    {
      "target_table": "equipment_criticality",
      "source_endpoint": "criticality_assessments",
      "mappings": [
        { "source": "$parent.entityKey",      "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "overallRiskRanking",     "target": "overall_criticality",    "transform": "normalize_ge_risk_ranking" },
        { "source": "safetyConsequence",      "target": "safety_impact",          "transform": "invert_ge_consequence" },
        { "source": "environmentalConsequence", "target": "environmental_impact", "transform": "invert_ge_consequence" },
        { "source": "productionConsequence",  "target": "production_impact",      "transform": "invert_ge_consequence" },
        { "source": "financialConsequence",   "target": "maintenance_cost_impact", "transform": "invert_ge_consequence" },
        { "source": "assessedBy",             "target": "assessed_by" },
        { "source": "assessmentDate",         "target": "assessment_date" },
        { "source": null,                     "target": "notes",                  "transform": "format_ge_assessment_notes" }
      ]
    }
  ],

  "transforms": {
    "normalize_ge_risk_ranking": "map({'VH': 1, 'CRITICAL': 1, '5': 1, 'H': 2, 'HIGH': 2, '4': 2, 'M': 3, 'MEDIUM': 3, '3': 3, 'L': 4, 'LOW': 4, '2': 4, 'VL': 5, 'ROUTINE': 5, '1': 5}, default=3)",
    "invert_ge_consequence": "If numeric 1-5, compute 6-value. If letter A-E, map A->1 B->2 C->3 D->4 E->5.",
    "normalize_ge_equipment_class": "See Equipment Class Normalization table above",
    "normalize_ge_equipment_type": "See Equipment Type Normalization table above",
    "normalize_ge_status": "map({'Active': 'active', 'In Service': 'active', 'Operating': 'active', 'Inactive': 'inactive', 'Out of Service': 'inactive', 'Standby': 'inactive', 'Decommissioned': 'decommissioned', 'Retired': 'decommissioned', 'Scrapped': 'decommissioned'}, default='active')",
    "normalize_ge_uom": "map({'psi': 'psig', 'bar': 'bar', 'gpm': 'gpm', 'm3/h': 'm3/h', 'degF': 'degF', 'degC': 'degC', 'hp': 'HP', 'kW': 'kW', 'rpm': 'rpm', 'in': 'in', 'mm': 'mm', 'ft': 'ft'}, default=identity)",
    "format_ge_assessment_notes": "Concatenate: 'GE APM {methodology} assessment. PoF={pofCategory}, CoF={cofCategory}, Risk={riskMatrix}'"
  },

  "schedule": {
    "type": "cron",
    "expression": "0 3 * * *",
    "timezone": "site_local",
    "retry_on_failure": true,
    "max_retries": 2
  },

  "sync": {
    "mode": "incremental",
    "upsert_key": ["external_id", "source_system"],
    "soft_delete": true,
    "preserve_io_fields": ["extra_data", "gps_latitude", "gps_longitude", "barcode"],
    "import_order": ["asset_master", "asset_fields", "criticality_assessments"],
    "multi_source_priority": "If CMMS connector also configured, GE APM runs second. Equipment identity from CMMS; criticality from GE APM overwrites CMMS criticality."
  }
}
```

## Notes

- **GE APM as a supplementary source**: GE APM is rarely the only equipment data source at a refinery. It is almost always deployed alongside Maximo or SAP PM. The recommended integration pattern is: (1) CMMS connector imports equipment identity (tag, description, hierarchy, manufacturer), (2) GE APM connector enriches those records with criticality scores, RBI data, and health indicators. Configure GE APM to run 1 hour after the CMMS connector (hence the 03:00 schedule vs 02:00 for CMMS connectors).
- **Dual-key matching**: When GE APM is supplementary, equipment records already exist in I/O from the CMMS import. GE APM's `assetId` (plant tag) should match the existing I/O `tag`. The upsert can match on `tag` + `site_id` instead of `external_id` + `source_system` to update existing CMMS-sourced records rather than creating duplicates. This requires a site-specific configuration toggle.
- **RBI data richness**: GE APM's RBI module provides the most detailed criticality data of any source -- individual consequence scores by category (safety, environmental, production, financial), probability of failure scores, risk matrix position, and inspection recommendations. This maps directly to I/O's `equipment_criticality` table with all factor columns populated. No other connector in this set can populate all five impact columns.
- **Consequence scale inversion**: GE APM typically uses scales where higher numbers = worse consequences (5 = catastrophic). I/O's `equipment_criticality` uses 1 = most critical/highest impact. The transform must invert: `io_score = 6 - ge_score`. This is the most common mapping error -- verify during testing.
- **Per-record API calls for fields and criticality**: Like HxGN EAM, fetching asset fields and criticality assessments requires per-asset API calls. For 10,000 assets, this means 20,000+ API calls (fields + criticality). At 300 req/min, the initial load takes over an hour. Mitigation: (a) Use GE APM's bulk query endpoint (`POST /query`) with GQL to fetch fields for multiple assets in one request if available, (b) Only fetch criticality for equipment classes where it's relevant (skip piping, structural), (c) Cache results and only re-fetch on incremental sync.
- **GE APM query language**: GE APM supports a proprietary query language (GQL) via the `POST /query` endpoint. This can be more efficient than the REST endpoints for bulk data extraction. Example: `SELECT [Asset ID], [Description], [Criticality Rating] FROM [Equipment] WHERE [Status] = 'Active'`. If the site's APM version supports GQL, prefer it over per-record REST calls.
- **Health indicators**: GE APM health indicators (real-time equipment health scores based on condition monitoring rules) are valuable for I/O dashboards but update more frequently than daily. These are better served by a separate real-time integration (webhook or more frequent polling) rather than the daily equipment sync. Out of scope for this equipment registry connector but noted for future enhancement.
- **Meridium legacy versions**: Older Meridium installations (pre-GE acquisition, v3.x) use a different API surface (SOAP-based or direct SQL views). For these installations, a file-based import (CSV export from Meridium reports) is more practical than API integration.
- **Equipment-to-point mapping**: GE APM does not store DCS/OPC tag associations natively. Some sites configure health indicators that reference PI or OPC tags, but this mapping is in the health indicator configuration, not the asset master. Build the equipment-to-point mapping in I/O or source it from PI AF if available.
