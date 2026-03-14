# Hexagon HxGN EAM (formerly Infor EAM Enterprise) -- Equipment Registry Connector Profile

## Application Overview

- **Vendor**: Hexagon AB (acquired from Infor in 2023; product was originally Datastream MP5/7i, then Infor EAM Enterprise)
- **Product**: HxGN EAM (also branded as Hexagon SmartPlant Foundation EAM in sites with Hexagon's SmartPlant ecosystem)
- **Market position**: Significant installed base in refining and petrochemical, especially at sites with Hexagon's engineering data management (SmartPlant Foundation, Smart P&ID). Common in utilities and government. Transitioning from Infor EAM branding
- **Licensing**: Commercial SaaS or on-premise. REST API included with standard license. Databridge Pro (Apache NiFi-based ETL) is a separately licensed add-on module
- **Typical refinery scenario**: HxGN EAM is the system of record for equipment, locations, work orders, PM schedules, and parts inventory. Sites with Hexagon's broader engineering suite (SmartPlant) benefit from tighter integration between engineering data and maintenance records. Equipment hierarchy uses parent-child equipment structures and location trees

## API Surface

| Attribute | Detail |
|-----------|--------|
| **API type** | REST/JSON (primary), SOAP/WSDL (legacy) |
| **Base URL** | `https://{hxgn-host}/apis/rest/{entity}` |
| **Auth methods** | API key (`X-API-Key` header), Basic Auth, OAuth 2.0 client credentials |
| **Pagination** | Offset-based: `page` + `pageSize` parameters |
| **Rate limits** | Server-configured; typically 200 requests/min |
| **Incremental sync** | Filter by modification timestamp field on each entity |
| **Response format** | JSON |
| **API docs** | Swagger UI available at `https://{hxgn-host}/apis/rest/swagger-ui.html` (on-premise) |

### Key Endpoints

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Equipment list | `GET equipment?fields={field_list}&pageSize=500` | GET |
| Equipment detail | `GET equipment/{code}` | GET |
| Equipment hierarchy | `GET equipment/{code}/structure` | GET |
| Equipment custom fields | `GET equipment/{code}/customfields` | GET |
| Locations | `GET locations?fields=code,description,parentLocation,type,status` | GET |
| Work history | `GET workorders?equipment={code}&type=corrective` | GET |

### Connection Configuration

```jsonc
{
  "connector_type": "rest_json",
  "base_url": "https://{hxgn-host}/apis/rest",
  "auth": {
    "method": "api_key_header",
    "header_name": "X-API-Key",
    "api_key": "{hxgn-api-key}"
    // OAuth 2.0 alternative:
    // "method": "oauth2_client_credentials",
    // "token_url": "https://{hxgn-host}/apis/oauth/token",
    // "client_id": "{client-id}",
    // "client_secret": "{secret}"
  },
  "headers": {
    "Accept": "application/json"
  },
  "pagination": {
    "strategy": "page_number",
    "page_size": 500,
    "page_size_param": "pageSize",
    "page_param": "page"
  },
  "rate_limit": {
    "requests_per_minute": 200
  }
}
```

## Target Tables

| I/O Table | Role | Populated |
|-----------|------|-----------|
| `equipment` | Primary -- one row per HxGN equipment record | Yes |
| `equipment_nameplate` | Custom fields and class-specific attributes as key-value pairs | Yes |
| `equipment_criticality` | HxGN criticality ranking mapped to 1-5 scale | Yes |
| `equipment_points` | Not directly from HxGN EAM | No (manual in I/O) |

## Field Mapping

### Equipment Master (`equipment` -> `equipment`)

| HxGN EAM Field | I/O Column | Transform | Required |
|-----------------|------------|-----------|----------|
| `code` | `external_id` | Direct | Yes |
| `code` | `tag` | Direct -- HxGN equipment codes are typically the plant tag | Yes |
| `description` | `description` | Direct, trim whitespace | Yes |
| `class` | `equipment_class` | See class normalization below | Yes |
| `category` | `equipment_type` | See type normalization below | No |
| `status` | `status` | See status normalization below | Yes |
| `criticality` | `criticality` | See criticality normalization below | No |
| `location` | `functional_location` | Direct (HxGN location code) | No |
| `department` | `area` | Direct -- HxGN department often maps to plant area | No |
| `costCenter` | `extra_data.hxgn_cost_center` | Preserved in JSONB | No |
| `parent` | `parent_id` | Lookup: resolve parent equipment code to I/O `equipment.id` via `external_id` | No |
| `manufacturer` | `manufacturer` | Direct | No |
| `model` | `model_number` | Direct | No |
| `serialNumber` | `serial_number` | Direct | No |
| `installationDate` | `year_installed` | `extract_year(installationDate)` | No |
| `commissionDate` | `extra_data.commission_date` | Preserved in JSONB | No |
| `warrantyExpirationDate` | `extra_data.warranty_expiry` | Preserved in JSONB | No |
| `drawingReference` | `pid_reference` | Direct (P&ID or engineering drawing reference) | No |
| `barCode` | `barcode` | Direct | No |
| -- | `source_system` | Constant: `"hxgn_eam"` | Yes |
| -- | `data_source` | Constant: `"imported"` | Yes |

### Equipment Custom Fields -> `equipment_nameplate`

HxGN EAM stores nameplate/technical data in custom field groups attached to equipment classes. The `/customfields` endpoint returns these.

| HxGN EAM Field | I/O Column | Transform |
|----------------|------------|-----------|
| (parent `code`) | `equipment_id` | Lookup via `external_id` |
| `fieldName` | `attribute_name` | Lowercase, replace spaces with underscores |
| `fieldValue` | `attribute_value` | Direct string value |
| `fieldValue` | (parse) | `try_parse_numeric(fieldValue)` for numeric attributes |
| `uom` | `unit_of_measure` | Normalize HxGN UoM codes |

### Criticality -> `equipment_criticality`

HxGN EAM uses a criticality ranking field, typically configured as a code table:

| HxGN `criticality` | I/O `overall_criticality` |
|---------------------|--------------------------|
| `CRITICAL`, `A`, `1` | `1` |
| `HIGH`, `B`, `2` | `2` |
| `MEDIUM`, `C`, `3` | `3` |
| `LOW`, `D`, `4` | `4` |
| `ROUTINE`, `E`, `5` | `5` |
| NULL / unmapped | `3` (default medium) |

Additional factor-level scores (`safety_impact`, `environmental_impact`, etc.) are not standard HxGN EAM fields. If the site has configured custom criticality factors in custom field groups, those can be mapped with site-specific configuration.

## Equipment Class Normalization

HxGN EAM `class` is a configurable code table. Common refinery values:

| HxGN `class` | I/O `equipment_class` |
|--------------|----------------------|
| `ROTATING`, `PUMPS`, `COMPRESSORS`, `TURBINES`, `FANS`, `BLOWERS` | `rotating` |
| `STATIC`, `VESSELS`, `COLUMNS`, `TANKS`, `DRUMS`, `REACTORS` | `static` |
| `HEAT_EXCHANGERS`, `EXCHANGERS`, `HEATERS`, `CONDENSERS`, `COOLERS`, `BOILERS`, `FURNACES` | `heat_exchanger` |
| `INSTRUMENTS`, `TRANSMITTERS`, `ANALYZERS`, `CONTROL_VALVES` | `instrument` |
| `ELECTRICAL`, `MOTORS`, `TRANSFORMERS`, `SWITCHGEAR`, `VFDS`, `GENERATORS` | `electrical` |
| `PIPING`, `PIPES`, `FITTINGS` | `piping` |
| `RELIEF_DEVICES`, `PSV`, `SAFETY_VALVES`, `SIS` | `relief_device` |
| `STRUCTURAL`, `FOUNDATIONS`, `SUPPORTS` | `structural` |

**Fallback**: Present distinct HxGN `class` values during setup wizard for manual mapping. Default to `static`.

## Equipment Type Normalization

Map from HxGN `category` (sub-classification within class):

| HxGN `category` | I/O `equipment_type` |
|-----------------|---------------------|
| `CENTRIFUGAL_PUMP` | `centrifugal_pump` |
| `RECIPROCATING_PUMP` | `reciprocating_pump` |
| `PD_PUMP` | `positive_displacement_pump` |
| `CENTRIFUGAL_COMPRESSOR` | `centrifugal_compressor` |
| `RECIPROCATING_COMPRESSOR` | `reciprocating_compressor` |
| `SHELL_TUBE` | `shell_tube_exchanger` |
| `AIR_COOLED` | `air_cooled_exchanger` |
| `PLATE_EXCHANGER` | `plate_exchanger` |
| `PRESSURE_VESSEL` | `pressure_vessel` |
| `DISTILLATION_COLUMN` | `distillation_column` |
| `STORAGE_TANK` | `storage_tank` |
| `ELECTRIC_MOTOR` | `electric_motor` |
| `CONTROL_VALVE` | `control_valve` |
| `PRESSURE_TRANSMITTER` | `pressure_transmitter` |
| `PSV` | `pressure_safety_valve` |

**Fallback**: Lowercase, replace spaces/hyphens with underscores, store as-is.

## Status Normalization

| HxGN EAM `status` | I/O `status` |
|-------------------|--------------|
| `I` (Installed), `A` (Active), `OPERATING` | `active` |
| `D` (Deactivated), `INACTIVE`, `OUT_OF_SERVICE` | `inactive` |
| `S` (Scrapped), `DECOMMISSIONED` | `decommissioned` |
| Not mapped / unknown | `active` (default) |

## Hierarchy Mapping

HxGN EAM supports two hierarchy mechanisms (shared heritage with Infor EAM):

1. **Location hierarchy**: Location records with parent-child tree. Locations represent physical plant structure (Site > Plant > Unit > System).
2. **Equipment structure**: Equipment-to-equipment parent-child using the `parent` field. The `/structure` endpoint returns the full sub-tree for any equipment code.

### Mapping to I/O `equipment.parent_id`

- **Equipment-to-equipment**: The `parent` field maps directly to I/O's `parent_id`. Two-pass import for reference resolution.
- **Location hierarchy**: Mapped to `functional_location`. Use the location API to resolve department/area if needed.
- **SmartPlant Foundation integration**: Sites using Hexagon SPF may have a richer functional location hierarchy maintained in the engineering database. This can supplement or replace the EAM location hierarchy.

### Import Order

1. Equipment records (first pass -- no `parent_id`)
2. Equipment records (second pass -- resolve `parent_id`)
3. Custom fields -> `equipment_nameplate`
4. Criticality -> `equipment_criticality`

## Sync Strategy

| Aspect | Configuration |
|--------|---------------|
| **Schedule** | Daily at 02:00 site time |
| **Sync type** | Incremental (timestamp-based) |
| **Watermark column** | `lastModified` or `updateDate` on equipment records |
| **Full sync trigger** | Initial load, or manual trigger after data migration |
| **Initial load** | Page through all equipment with `pageSize=500`. Expect 2,000-15,000 records. Typical runtime: 5-15 minutes |
| **Conflict resolution** | HxGN EAM wins (source of truth). I/O-only fields preserved |
| **Soft delete sync** | Equipment with HxGN status `S` (Scrapped) or `DECOMMISSIONED` -> I/O `status = 'decommissioned'` |
| **Upsert key** | `external_id` + `source_system` |

## Pre-Built Import Definition

```jsonc
{
  "name": "Hexagon HxGN EAM Equipment Registry",
  "description": "Import equipment master data, custom fields (nameplate), and criticality from Hexagon HxGN EAM",
  "source_system": "hxgn_eam",
  "connector_type": "rest_json",
  "domain": "equipment",
  "enabled": true,

  "connection": {
    "base_url": "https://{hxgn-host}/apis/rest",
    "auth_method": "api_key_header",
    "auth_header": "X-API-Key",
    "timeout_seconds": 60,
    "retry_attempts": 3,
    "retry_delay_seconds": 10
  },

  "source": {
    "endpoints": [
      {
        "id": "equipment_master",
        "path": "/equipment",
        "params": {
          "fields": "code,description,class,category,status,criticality,department,costCenter,location,parent,manufacturer,model,serialNumber,installationDate,commissionDate,warrantyExpirationDate,drawingReference,barCode",
          "pageSize": 500
        },
        "pagination": {
          "strategy": "page_number",
          "page_size_param": "pageSize",
          "page_param": "page"
        },
        "watermark": {
          "field": "lastModified",
          "filter_template": "lastModified>{watermark}"
        },
        "response_root": "data"
      },
      {
        "id": "equipment_customfields",
        "path": "/equipment/{code}/customfields",
        "params": {},
        "iteration": "per_record",
        "iterate_over": "equipment_master",
        "iterate_key": "code",
        "response_root": "data",
        "depends_on": "equipment_master"
      }
    ]
  },

  "field_mappings": [
    {
      "target_table": "equipment",
      "source_endpoint": "equipment_master",
      "mappings": [
        { "source": "code",                    "target": "external_id" },
        { "source": "code",                    "target": "tag" },
        { "source": "description",             "target": "description",            "transform": "trim" },
        { "source": "class",                   "target": "equipment_class",        "transform": "normalize_hxgn_equipment_class" },
        { "source": "category",                "target": "equipment_type",         "transform": "normalize_hxgn_equipment_type" },
        { "source": "status",                  "target": "status",                 "transform": "normalize_hxgn_status" },
        { "source": "criticality",             "target": "criticality",            "transform": "normalize_hxgn_criticality" },
        { "source": "location",                "target": "functional_location" },
        { "source": "department",              "target": "area" },
        { "source": "parent",                  "target": "parent_id",              "transform": "lookup_equipment_by_external_id" },
        { "source": "manufacturer",            "target": "manufacturer" },
        { "source": "model",                   "target": "model_number" },
        { "source": "serialNumber",            "target": "serial_number" },
        { "source": "installationDate",        "target": "year_installed",         "transform": "extract_year" },
        { "source": "drawingReference",        "target": "pid_reference" },
        { "source": "barCode",                 "target": "barcode" },
        { "source": null,                      "target": "source_system",          "transform": "constant('hxgn_eam')" },
        { "source": null,                      "target": "data_source",            "transform": "constant('imported')" }
      ]
    },
    {
      "target_table": "equipment_nameplate",
      "source_endpoint": "equipment_customfields",
      "mappings": [
        { "source": "$parent.code",            "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "fieldName",               "target": "attribute_name",         "transform": "lowercase_underscore" },
        { "source": "fieldValue",              "target": "attribute_value" },
        { "source": "uom",                     "target": "unit_of_measure",        "transform": "normalize_hxgn_uom" }
      ]
    },
    {
      "target_table": "equipment_criticality",
      "source_endpoint": "equipment_master",
      "mappings": [
        { "source": "code",                    "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "criticality",             "target": "overall_criticality",    "transform": "normalize_hxgn_criticality" },
        { "source": null,                      "target": "notes",                  "transform": "constant('Imported from HxGN EAM criticality ranking')" }
      ],
      "filter": "criticality IS NOT NULL"
    }
  ],

  "transforms": {
    "normalize_hxgn_criticality": "map({'CRITICAL': 1, 'A': 1, '1': 1, 'HIGH': 2, 'B': 2, '2': 2, 'MEDIUM': 3, 'C': 3, '3': 3, 'LOW': 4, 'D': 4, '4': 4, 'ROUTINE': 5, 'E': 5, '5': 5}, default=3)",
    "normalize_hxgn_equipment_class": "See Equipment Class Normalization table above",
    "normalize_hxgn_equipment_type": "See Equipment Type Normalization table above",
    "normalize_hxgn_status": "map({'I': 'active', 'A': 'active', 'OPERATING': 'active', 'D': 'inactive', 'INACTIVE': 'inactive', 'OUT_OF_SERVICE': 'inactive', 'S': 'decommissioned', 'DECOMMISSIONED': 'decommissioned'}, default='active')",
    "normalize_hxgn_uom": "map({'PSI': 'psig', 'BAR': 'bar', 'GPM': 'gpm', 'M3/H': 'm3/h', 'DEGF': 'degF', 'DEGC': 'degC', 'HP': 'HP', 'KW': 'kW', 'RPM': 'rpm', 'IN': 'in', 'MM': 'mm', 'FT': 'ft'}, default=identity)"
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
    "preserve_io_fields": ["extra_data", "gps_latitude", "gps_longitude"],
    "import_order": ["equipment_master", "equipment_customfields"]
  }
}
```

## Notes

- **Infor EAM heritage**: HxGN EAM shares its codebase with Infor EAM. Sites migrated from Infor to Hexagon should see identical API behavior. The connector works for both branded versions. The only difference is the base URL and branding in the UI.
- **Custom field groups**: HxGN EAM's nameplate data lives in custom field groups that are configured per equipment class. The `/customfields` endpoint returns all custom fields for a given equipment record. During initial setup, the import wizard should scan a sample of equipment across different classes to discover all available custom fields and let the user select which ones to import as nameplate attributes.
- **Per-record custom field fetch**: The custom fields endpoint is per-equipment, requiring N+1 API calls. For the initial load of 10,000+ records, this is slow (potentially hours at 200 req/min). Mitigation: (a) Use the bulk export API if available in the site's HxGN version, (b) filter to only fetch custom fields for equipment classes that have nameplate data (skip structural, piping), (c) parallelize requests within rate limits.
- **Databridge Pro alternative**: Sites with Databridge Pro (HxGN's NiFi-based integration module) can push equipment data to I/O instead of I/O polling the API. This inverts the integration direction -- I/O exposes a webhook/file-drop endpoint, and Databridge Pro sends data on change. This is more efficient for large datasets but requires Databridge Pro licensing and configuration on the HxGN side.
- **SmartPlant Foundation enrichment**: Sites with Hexagon SPF have richer engineering data (tag-to-equipment mappings from Smart P&ID, equipment datasheets from SmartPlant Instrumentation). If SPF REST APIs are accessible, a supplementary connector can pull this data to enrich the equipment records imported from EAM.
- **Status codes**: HxGN EAM uses single-letter status codes by default (`I` = Installed, `D` = Deactivated, `S` = Scrapped) but sites can configure full-word alternatives. The normalization map should cover both patterns.
- **Equipment-to-point mapping**: Not available from HxGN EAM natively. Build in I/O. Sites with Hexagon SmartPlant Instrumentation may have instrument tag-to-loop mappings that can partially populate this.
