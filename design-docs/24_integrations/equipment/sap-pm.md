# SAP Plant Maintenance (SAP PM / S/4HANA) -- Equipment Registry Connector Profile

## Application Overview

- **Vendor**: SAP SE
- **Product**: SAP Plant Maintenance (PM module within SAP ERP ECC / S/4HANA)
- **Market position**: Dominant globally, especially at sites already running SAP ERP. Common in European, Asian, and multinational refineries. SAP PM is the maintenance sub-module within SAP ERP; S/4HANA is the current-generation platform
- **Licensing**: Commercial. API access via SAP Gateway (on-premise) or SAP BTP (cloud). OData services require SAP Gateway configuration on ECC; S/4HANA Cloud exposes them by default
- **Typical refinery scenario**: SAP PM is the system of record for equipment master data, functional locations, maintenance plans, and work orders. Equipment hierarchy is built on Functional Locations (IFLOs) with Equipment records attached at the appropriate level. Classification system stores nameplate/technical characteristics

## API Surface

| Attribute | Detail |
|-----------|--------|
| **API type** | OData V2 (ECC via Gateway), OData V4 (S/4HANA Cloud) |
| **Base URL** | `https://{sap-host}/sap/opu/odata/sap/{service_name}` |
| **Auth methods** | Basic Auth (most common on-premise), OAuth 2.0 client credentials (S/4HANA Cloud), X.509 certificate mTLS |
| **Pagination** | OData standard: `$skip` / `$top` (server default typically 1000). Server-driven `__next` URL in response |
| **Rate limits** | SAP Gateway configurable; typically 50-200 requests/min depending on system sizing |
| **Incremental sync** | `$filter=LastChangeDateTime gt datetime'2024-01-15T00:00:00'` on OData V2; `$filter=LastChangeDateTime gt 2024-01-15T00:00:00Z` on V4 |
| **Response format** | JSON (`$format=json`) or XML (default). Always request JSON |
| **API docs** | [SAP Business Hub](https://api.sap.com/) -- search for `API_EQUIPMENT`, `API_FUNCTIONALLOCATION` |

### Key Endpoints

| Purpose | OData Service / Entity Set | Method |
|---------|---------------------------|--------|
| Equipment list | `API_EQUIPMENT/A_Equipment` | GET |
| Equipment detail | `API_EQUIPMENT/A_Equipment('{EQUNR}')` | GET |
| Functional locations | `API_FUNCTIONALLOCATION/A_FunctionalLocation` | GET |
| Equipment classification | `API_CLFN_EQUIPMENT_CLASS/A_ClfnEquipmentClass` | GET |
| Classification values | `$expand=to_CharacteristicValue` on classification entity | GET |
| Maintenance notifications | `API_MAINTNOTIFICATION/A_MaintenanceNotification` | GET |

### Connection Configuration

```jsonc
{
  "connector_type": "rest_json",
  "base_url": "https://{sap-host}/sap/opu/odata/sap",
  "auth": {
    "method": "basic",          // or "oauth2_client_credentials" or "certificate_mtls"
    "username": "{service-user}",
    "password": "{secret}",
    // OAuth 2.0 alternative:
    // "token_url": "https://{sap-host}/sap/bc/sec/oauth2/token",
    // "client_id": "{client-id}",
    // "client_secret": "{secret}"
  },
  "headers": {
    "Accept": "application/json",
    "sap-client": "{client-number}"     // SAP mandant/client number (e.g., "100")
  },
  "pagination": {
    "strategy": "odata_next",
    "page_size": 1000,
    "page_size_param": "$top"
  },
  "rate_limit": {
    "requests_per_minute": 100
  }
}
```

## Target Tables

| I/O Table | Role | Populated |
|-----------|------|-----------|
| `equipment` | Primary -- one row per SAP equipment record | Yes |
| `equipment_nameplate` | Classification characteristics as key-value pairs | Yes |
| `equipment_criticality` | ABC indicator + classification-based risk scores | Yes |
| `equipment_points` | Not directly -- SAP PM rarely holds point-to-equipment mapping | No (manual in I/O) |

## Field Mapping

### Equipment Master (`A_Equipment` -> `equipment`)

| SAP OData Field | I/O Column | Transform | Required |
|-----------------|------------|-----------|----------|
| `Equipment` | `external_id` | Direct (SAP equipment number, e.g., "000000010012345") | Yes |
| `Equipment` | `tag` | `strip_leading_zeros(Equipment)` -- SAP pads with zeros; strip to get "P-101A" style tag. If result is purely numeric, prefix with site convention | Yes |
| `EquipmentName` | `description` | Direct, trim whitespace | Yes |
| `FunctionalLocation` | `functional_location` | Direct (e.g., "CDU-FRAC-OHD") | No |
| `FunctionalLocation` | `area` | `extract_segment(FunctionalLocation, 0)` -- first segment is typically the unit/area | No |
| `FunctionalLocation` | `unit` | `extract_segment(FunctionalLocation, 1)` -- second segment is typically the system | No |
| `SuperiorEquipment` | `parent_id` | Lookup: resolve `SuperiorEquipment` to I/O `equipment.id` via `external_id` match | No |
| `Manufacturer` | `manufacturer` | Direct | No |
| `ManufacturerPartNmbr` | `model_number` | Direct | No |
| `SerialNumber` | `serial_number` | Direct | No |
| `EquipInstallDate` | `year_installed` | `extract_year(EquipInstallDate)` -- SAP stores full date, I/O stores year | No |
| `ConstructionMaterial` | `material_of_construction` | Direct | No |
| -- | `source_system` | Constant: `"sap_pm"` | Yes |
| -- | `data_source` | Constant: `"imported"` | Yes |
| -- | `status` | See status normalization below | Yes |
| -- | `equipment_class` | See class normalization below | Yes |
| -- | `equipment_type` | See type normalization below | No |
| `ABCIndicator` | `criticality` | See criticality normalization below | No |
| `EquipmentCategory` | `extra_data.sap_category` | Preserved in JSONB (`M` = machine, `F` = fleet, etc.) | No |
| `InventoryNumber` | `barcode` | Direct (if populated -- SAP inventory number can serve as barcode) | No |
| `TechnicalObjectType` | `extra_data.sap_tech_object_type` | Preserved in JSONB | No |
| `ValidityEndDate` | `extra_data.sap_validity_end` | Preserved in JSONB (decommission indicator) | No |

### SAP Classification Characteristics -> `equipment_nameplate`

SAP stores technical/nameplate data in the Classification System. Equipment is assigned to a Class (e.g., `PUMP_CENTRIFUGAL`), and each class has Characteristics (e.g., `DESIGN_PRESSURE`, `RATED_FLOW`).

| SAP Classification Field | I/O Column | Transform |
|--------------------------|------------|-----------|
| `equipment_id` | `equipment_id` | Lookup via `external_id` |
| `CharcInternalID` / `Characteristic` | `attribute_name` | Normalize: lowercase, replace spaces with underscores |
| `CharcValue` | `attribute_value` | Direct string value |
| `CharcValue` | (parse) | `try_parse_numeric(CharcValue)` for `unit_of_measure` comparison |
| `Unit` | `unit_of_measure` | SAP UoM code -> I/O standard (see UoM mapping) |
| -- | `extra_data.sap_class` | Preserve the SAP class name |
| -- | `extra_data.sap_charc_id` | Preserve `CharcInternalID` for back-reference |

### SAP ABC Indicator -> `equipment_criticality`

| SAP Field | I/O Column | Transform |
|-----------|------------|-----------|
| `ABCIndicator` = `"A"` | `overall_criticality` | `1` (most critical) |
| `ABCIndicator` = `"B"` | `overall_criticality` | `3` |
| `ABCIndicator` = `"C"` | `overall_criticality` | `5` (least critical) |
| -- | `safety_impact` | Not available from SAP PM directly; set `NULL` |
| -- | `environmental_impact` | Not available; set `NULL` |
| -- | `production_impact` | Not available; set `NULL` |
| -- | `maintenance_cost_impact` | Not available; set `NULL` |
| -- | `notes` | `"Imported from SAP PM ABCIndicator"` |

If the site uses SAP's Risk-Based Inspection (RBI) or has custom classification characteristics for criticality factors, those can be mapped to the individual impact columns via a site-specific classification-to-criticality transform.

## Equipment Class Normalization

SAP uses `TechnicalObjectType` and classification class names. Map to I/O `equipment_class` enum:

| SAP Technical Object Type / Class Pattern | I/O `equipment_class` |
|-------------------------------------------|----------------------|
| `PUMP*`, `COMP*`, `TURB*`, `FAN*`, `AGIT*`, `BLWR*` | `rotating` |
| `VESS*`, `COLM*`, `TANK*`, `DRUM*`, `REAC*` | `static` |
| `HEXC*`, `EXCH*`, `COND*`, `COOL*`, `BOIL*`, `FURN*` | `heat_exchanger` |
| `INST*`, `TRAN*`, `VALV*` (control), `ANAL*`, `FLOW*`, `PRES*`, `TEMP*`, `LEVL*` | `instrument` |
| `MOTR*`, `XFMR*`, `SWGR*`, `VFD*`, `BRKR*`, `GEN*` | `electrical` |
| `PIPE*`, `FITT*`, `FLNG*` | `piping` |
| `PSV*`, `RV*`, `SFTY*`, `SIS*`, `ESD*` | `relief_device` |
| `STRC*`, `FNDN*`, `SUPP*` | `structural` |

**Fallback**: If `TechnicalObjectType` is not populated or doesn't match, attempt classification from the SAP Class name. If still unresolved, set `equipment_class = 'static'` (most common default) and flag in `extra_data.classification_warning`.

## Equipment Type Normalization

`equipment_type` is a freeform field in I/O. Map from SAP's classification class name:

| SAP Class Name (examples) | I/O `equipment_type` |
|---------------------------|---------------------|
| `PUMP_CENTRIFUGAL` | `centrifugal_pump` |
| `PUMP_RECIPROCATING` | `reciprocating_pump` |
| `PUMP_POSITIVE_DISPLACEMENT` | `positive_displacement_pump` |
| `COMPRESSOR_CENTRIFUGAL` | `centrifugal_compressor` |
| `COMPRESSOR_RECIPROCATING` | `reciprocating_compressor` |
| `EXCHANGER_SHELL_TUBE` | `shell_tube_exchanger` |
| `EXCHANGER_AIR_COOLED` | `air_cooled_exchanger` |
| `EXCHANGER_PLATE` | `plate_exchanger` |
| `VESSEL_PRESSURE` | `pressure_vessel` |
| `COLUMN_DISTILLATION` | `distillation_column` |
| `TANK_STORAGE` | `storage_tank` |
| `MOTOR_ELECTRIC` | `electric_motor` |
| `VALVE_CONTROL` | `control_valve` |
| `TRANSMITTER_PRESSURE` | `pressure_transmitter` |
| `PSV` | `pressure_safety_valve` |

**Fallback**: Lowercase the SAP class name, replace spaces/hyphens with underscores, store as-is.

## Status Normalization

| SAP User Status / System Status | I/O `status` |
|--------------------------------|--------------|
| `OPER`, `AVLB`, `INST` (installed) | `active` |
| `INAC`, `DLFL` (deactivated) | `inactive` |
| `DCMS`, `SCRP` (scrapped) | `decommissioned` |
| Not mapped / unknown | `active` (default) |

SAP has both System Status (controlled by SAP) and User Status (configurable per site). User Status takes priority if a mapping is defined; otherwise fall back to System Status.

## Hierarchy Mapping

SAP PM uses a two-level hierarchy model:

1. **Functional Location (IFLO)**: A hierarchical tree representing physical plant structure (Site > Unit > System > Subsystem). Encoded in the Functional Location ID itself (e.g., `CDU-FRAC-OHD` where `-` is the hierarchy separator).
2. **Equipment**: Attached to a Functional Location. Equipment can also have parent-child relationships (e.g., pump assembly -> motor, coupling).

### Mapping to I/O `equipment.parent_id`

- **Equipment-to-equipment**: SAP's `SuperiorEquipment` field maps directly to I/O's `parent_id`. Resolve via two-pass import: first pass creates all equipment records, second pass resolves `parent_id` references.
- **Functional Location hierarchy**: Mapped to `functional_location` field on the equipment record. I/O does not import the full IFLO tree as separate records -- the functional location string encodes the hierarchy implicitly.
- **Area/Unit extraction**: Parse the Functional Location string by its separator character (configurable -- typically `-` or `.`) to extract `area` (segment 0-1) and `unit` (segment 1-2).

### Import Order

1. Equipment records (first pass -- no `parent_id`)
2. Equipment records (second pass -- resolve `parent_id` from `SuperiorEquipment`)
3. Classification characteristics -> `equipment_nameplate`
4. ABC Indicator -> `equipment_criticality`

## Sync Strategy

| Aspect | Configuration |
|--------|---------------|
| **Schedule** | Daily at 02:00 site time (off-peak for SAP) |
| **Sync type** | Incremental (watermark-based) |
| **Watermark column** | `LastChangeDateTime` on `A_Equipment` |
| **Full sync trigger** | Initial load, or manual trigger after SAP data migration/cleanup |
| **Initial load** | Page through all equipment with `$top=1000&$skip=N`. Expect 2,000-15,000 records. Typical runtime: 5-30 minutes depending on SAP system performance |
| **Conflict resolution** | SAP wins (source of truth). I/O-only fields (`equipment_points`, I/O-specific `extra_data`) are preserved |
| **Soft delete sync** | Equipment with SAP status `SCRP`/`DCMS` or `ValidityEndDate` in past -> set I/O `status = 'decommissioned'` |
| **Upsert key** | `external_id` + `source_system` (maps to `equipment.external_id` where `source_system = 'sap_pm'`) |

## Pre-Built Import Definition

```jsonc
{
  "name": "SAP PM Equipment Registry",
  "description": "Import equipment master data, nameplate characteristics, and criticality from SAP Plant Maintenance",
  "source_system": "sap_pm",
  "connector_type": "rest_json",
  "domain": "equipment",
  "enabled": true,

  "connection": {
    "base_url": "https://{sap-host}/sap/opu/odata/sap",
    "auth_method": "basic",
    "headers": {
      "Accept": "application/json",
      "sap-client": "{client-number}"
    },
    "timeout_seconds": 60,
    "retry_attempts": 3,
    "retry_delay_seconds": 10
  },

  "source": {
    "endpoints": [
      {
        "id": "equipment_master",
        "path": "/API_EQUIPMENT/A_Equipment",
        "params": {
          "$select": "Equipment,EquipmentName,FunctionalLocation,SuperiorEquipment,Manufacturer,ManufacturerPartNmbr,SerialNumber,EquipInstallDate,ConstructionMaterial,ABCIndicator,EquipmentCategory,TechnicalObjectType,InventoryNumber,ValidityEndDate",
          "$format": "json",
          "$top": 1000
        },
        "pagination": {
          "strategy": "odata_next",
          "page_size_param": "$top",
          "next_link_field": "d.__next"
        },
        "watermark": {
          "field": "LastChangeDateTime",
          "filter_template": "$filter=LastChangeDateTime gt datetime'{watermark}'"
        },
        "response_root": "d.results"
      },
      {
        "id": "equipment_classification",
        "path": "/API_CLFN_EQUIPMENT_CLASS/A_ClfnEquipmentClass",
        "params": {
          "$expand": "to_CharacteristicValue",
          "$format": "json",
          "$top": 1000
        },
        "pagination": {
          "strategy": "odata_next",
          "page_size_param": "$top",
          "next_link_field": "d.__next"
        },
        "response_root": "d.results",
        "depends_on": "equipment_master"
      }
    ]
  },

  "field_mappings": [
    {
      "target_table": "equipment",
      "source_endpoint": "equipment_master",
      "mappings": [
        { "source": "Equipment",                "target": "external_id" },
        { "source": "Equipment",                "target": "tag",                   "transform": "strip_leading_zeros" },
        { "source": "EquipmentName",            "target": "description",           "transform": "trim" },
        { "source": "FunctionalLocation",       "target": "functional_location" },
        { "source": "FunctionalLocation",       "target": "area",                  "transform": "extract_segment(0, '-')" },
        { "source": "FunctionalLocation",       "target": "unit",                  "transform": "extract_segment(1, '-')" },
        { "source": "SuperiorEquipment",        "target": "parent_id",             "transform": "lookup_equipment_by_external_id" },
        { "source": "Manufacturer",             "target": "manufacturer" },
        { "source": "ManufacturerPartNmbr",     "target": "model_number" },
        { "source": "SerialNumber",             "target": "serial_number" },
        { "source": "EquipInstallDate",         "target": "year_installed",        "transform": "extract_year" },
        { "source": "ConstructionMaterial",      "target": "material_of_construction" },
        { "source": "ABCIndicator",             "target": "criticality",           "transform": "map_abc_to_numeric" },
        { "source": "TechnicalObjectType",      "target": "equipment_class",       "transform": "normalize_sap_equipment_class" },
        { "source": "TechnicalObjectType",      "target": "equipment_type",        "transform": "normalize_sap_equipment_type" },
        { "source": "InventoryNumber",          "target": "barcode" },
        { "source": null,                       "target": "source_system",         "transform": "constant('sap_pm')" },
        { "source": null,                       "target": "data_source",           "transform": "constant('imported')" },
        { "source": null,                       "target": "status",                "transform": "normalize_sap_status" }
      ]
    },
    {
      "target_table": "equipment_nameplate",
      "source_endpoint": "equipment_classification",
      "mappings": [
        { "source": "Equipment",                "target": "equipment_id",          "transform": "lookup_equipment_by_external_id" },
        { "source": "Characteristic",           "target": "attribute_name",        "transform": "lowercase_underscore" },
        { "source": "CharcValue",               "target": "attribute_value" },
        { "source": "Unit",                     "target": "unit_of_measure",       "transform": "normalize_sap_uom" }
      ]
    },
    {
      "target_table": "equipment_criticality",
      "source_endpoint": "equipment_master",
      "mappings": [
        { "source": "Equipment",                "target": "equipment_id",          "transform": "lookup_equipment_by_external_id" },
        { "source": "ABCIndicator",             "target": "overall_criticality",   "transform": "map_abc_to_15" },
        { "source": null,                       "target": "notes",                 "transform": "constant('Imported from SAP PM ABCIndicator')" }
      ],
      "filter": "ABCIndicator IS NOT NULL"
    }
  ],

  "transforms": {
    "strip_leading_zeros": "regex_replace('^0+', '')",
    "map_abc_to_numeric": "map({'A': 1, 'B': 3, 'C': 5}, default=3)",
    "map_abc_to_15": "map({'A': 1, 'B': 3, 'C': 5}, default=3)",
    "normalize_sap_equipment_class": "See Equipment Class Normalization table above",
    "normalize_sap_equipment_type": "See Equipment Type Normalization table above",
    "normalize_sap_status": "map({'OPER': 'active', 'AVLB': 'active', 'INST': 'active', 'INAC': 'inactive', 'DLFL': 'inactive', 'DCMS': 'decommissioned', 'SCRP': 'decommissioned'}, default='active')",
    "normalize_sap_uom": "map({'BAR': 'bar', 'PSI': 'psig', 'M3/H': 'm3/h', 'GPM': 'gpm', 'DEG_C': 'degC', 'DEG_F': 'degF', 'KW': 'kW', 'HP': 'HP', 'RPM': 'rpm', 'MM': 'mm', 'IN': 'in'}, default=identity)"
  },

  "schedule": {
    "type": "cron",
    "expression": "0 2 * * *",
    "timezone": "site_local",
    "retry_on_failure": true,
    "max_retries": 2
  },

  "sync": {
    "mode": "incremental",
    "upsert_key": ["external_id", "source_system"],
    "soft_delete": true,
    "preserve_io_fields": ["extra_data", "pid_reference", "gps_latitude", "gps_longitude", "barcode"],
    "import_order": ["equipment_master", "equipment_classification"]
  }
}
```

## Notes

- **SAP client number**: Every SAP request requires the `sap-client` header. This is the SAP mandant number, not a user ID. Typically `100`, `200`, or `300`. Missing this header causes 400 errors with no useful message.
- **Leading zeros on Equipment number**: SAP internally stores equipment numbers as 18-character zero-padded strings (e.g., `000000000010012345`). Always strip leading zeros for the I/O `tag` field. The full zero-padded number goes in `external_id` for reliable back-reference.
- **Functional Location separator**: The character separating hierarchy levels in Functional Location IDs is configurable per SAP installation. Common separators: `-`, `.`, `/`. The import wizard should allow the user to specify this.
- **Classification system complexity**: SAP's classification system (classes, characteristics, values) is powerful but deep. A single piece of equipment may be assigned to multiple classes. The connector should import all characteristics as nameplate attributes, using the class name as a prefix if there are naming collisions.
- **S/4HANA vs ECC differences**: S/4HANA uses OData V4 with slightly different entity names and query syntax. The `__next` pagination link becomes `@odata.nextLink`. The import definition above targets ECC/V2; an S/4HANA variant should be provided as a separate profile or a toggle in the connection config.
- **Authorization scope**: The SAP service user needs `S_EQUI` authorization object with activity `03` (read) and the relevant equipment categories. Missing authorizations cause silent empty result sets, not errors.
- **Large sites**: Refineries with 10,000+ equipment records should increase `$top` to 5000 and expect the initial load to take 15-30 minutes. Incremental daily syncs typically process 10-50 changed records and complete in under a minute.
- **Equipment-to-point mapping**: SAP PM does not store DCS/OPC tag associations. This mapping must be built in I/O, either manually or by matching equipment tag patterns to point tagname prefixes (e.g., all points starting with `P101A_` map to equipment `P-101A`).
