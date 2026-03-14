# IBM Maximo Asset Management -- Equipment Registry Connector Profile

## Application Overview

- **Vendor**: IBM
- **Product**: Maximo Asset Management (7.6.x) / Maximo Application Suite (MAS 8.x / 9.x)
- **Market position**: Dominant in oil & gas, especially large North American refineries. The most commonly encountered CMMS in downstream petroleum
- **Licensing**: Commercial (per-user or per-asset). REST API access is included with the base Maximo license -- no additional API gateway purchase required
- **Typical refinery scenario**: Maximo is the system of record for assets, locations, work orders, spare parts inventory, and failure tracking. Equipment hierarchy is modeled through Location records (parent-child tree) with Asset records attached at each location level. Nameplate data is stored via Classification/Specification attributes on assets

## API Surface

| Attribute | Detail |
|-----------|--------|
| **API type** | REST/JSON (OSLC-based). Maximo 7.6.0.2+ and all MAS versions |
| **Base URL** | `https://{maximo-host}:{port}/maximo/oslc/os/{object_structure}` |
| **Auth methods** | API key (header: `apikey`), Basic Auth, OAuth 2.0 client credentials. MAS uses API keys primarily |
| **Pagination** | Offset-based: `oslc.pageSize=N&pageno=N`. Response includes `responseInfo.nextPage` URL for cursor-style paging |
| **Rate limits** | Maximo has configurable request throttling; typically 100-500 requests/min depending on installation |
| **Incremental sync** | Filter by `_changestamp` for reliable change detection, or `statusdate` / `changedate` for watermark-based filtering |
| **Response format** | JSON with `lean=1` parameter (compact format, strips metadata). Always use `lean=1` |
| **API docs** | IBM documentation: [Maximo REST API](https://www.ibm.com/docs/en/maximo-manage/continuous-delivery?topic=integration-rest-api) |

### Key Endpoints

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Asset list | `GET mxapiasset?oslc.select={fields}&oslc.pageSize=500&lean=1` | GET |
| Asset detail | `GET mxapiasset/{assetuid}?lean=1` | GET |
| Asset specifications (nameplate) | `GET mxapiasset?oslc.select=assetnum,assetspec.*&lean=1` | GET |
| Location hierarchy | `GET mxapilocation?oslc.select=location,description,parent,type,siteid&lean=1` | GET |
| Work orders (failure history) | `GET mxapiwodetail?oslc.where=worktype="CM"&oslc.select=wonum,assetnum,description,statusdate,failurecode&lean=1` | GET |

### Connection Configuration

```jsonc
{
  "connector_type": "rest_json",
  "base_url": "https://{maximo-host}:{port}/maximo/oslc/os",
  "auth": {
    "method": "api_key_header",
    "header_name": "apikey",
    "api_key": "{maximo-api-key}"
    // Basic Auth alternative:
    // "method": "basic",
    // "username": "{service-user}",
    // "password": "{secret}"
  },
  "params": {
    "lean": "1"
  },
  "pagination": {
    "strategy": "pageno",
    "page_size": 500,
    "page_size_param": "oslc.pageSize",
    "page_param": "pageno"
  },
  "rate_limit": {
    "requests_per_minute": 200
  }
}
```

## Target Tables

| I/O Table | Role | Populated |
|-----------|------|-----------|
| `equipment` | Primary -- one row per Maximo asset | Yes |
| `equipment_nameplate` | Asset specification attributes as key-value pairs | Yes |
| `equipment_criticality` | Maximo priority + risk fields mapped to criticality | Yes |
| `equipment_points` | Not directly from Maximo -- build in I/O | No (manual in I/O) |

## Field Mapping

### Asset Master (`mxapiasset` -> `equipment`)

| Maximo OSLC Field | I/O Column | Transform | Required |
|-------------------|------------|-----------|----------|
| `assetnum` | `external_id` | Direct | Yes |
| `assetnum` | `tag` | Direct -- Maximo asset numbers are typically the plant tag (e.g., "P-101A"). No transformation needed in most cases | Yes |
| `description` | `description` | Direct, trim whitespace | Yes |
| `location` | `functional_location` | Direct (Maximo location code) | No |
| `location` | `area` | Lookup: resolve location to its top-level parent for area | No |
| `location` | `unit` | Lookup: resolve location to its immediate parent for unit | No |
| `parent` | `parent_id` | Lookup: resolve Maximo `parent` asset number to I/O `equipment.id` via `external_id` | No |
| `manufacturer` | `manufacturer` | Direct | No |
| `modelnum` | `model_number` | Direct | No |
| `serialnum` | `serial_number` | Direct | No |
| `installdate` | `year_installed` | `extract_year(installdate)` | No |
| `siteid` | `site_id` | Lookup: map Maximo `siteid` to I/O `sites.id` | No |
| `priority` | `criticality` | See criticality normalization below | No |
| `assettype` | `equipment_class` | See class normalization below | No |
| `assettype` | `equipment_type` | See type normalization below | No |
| `status` | `status` | See status normalization below | Yes |
| `classstructureid` | `extra_data.maximo_class` | Preserved in JSONB for nameplate query back-reference | No |
| `failurecode` | `extra_data.maximo_failure_code` | Preserved in JSONB | No |
| `groupname` | `extra_data.maximo_group` | Preserved in JSONB (Maximo asset group) | No |
| -- | `source_system` | Constant: `"maximo"` | Yes |
| -- | `data_source` | Constant: `"imported"` | Yes |

### Asset Specifications (`assetspec` -> `equipment_nameplate`)

Maximo stores nameplate/technical data as "Asset Specifications" -- key-value pairs attached to an asset via its classification. The `assetspec` child object on `mxapiasset` contains these.

| Maximo Field | I/O Column | Transform |
|--------------|------------|-----------|
| (parent `assetnum`) | `equipment_id` | Lookup via `external_id` |
| `assetattrid` | `attribute_name` | Lowercase, replace spaces with underscores |
| `alnvalue` | `attribute_value` | Use `alnvalue` (alphanumeric) if populated; fall back to `numvalue` converted to string |
| `numvalue` | (numeric parse) | Direct to assist with `unit_of_measure` comparison |
| `measureunitid` | `unit_of_measure` | Normalize Maximo UoM codes (see UoM mapping) |
| `classstructureid` | `extra_data.maximo_class` | Preserve classification context |

### Maximo Priority -> `equipment_criticality`

Maximo uses a numeric `priority` field (typically 1-5 or 1-3, site-configurable):

| Maximo `priority` | I/O `overall_criticality` | I/O `safety_critical` | I/O `environmental_critical` |
|--------------------|--------------------------|----------------------|----------------------------|
| `1` | `1` | Infer `true` if Maximo safety classification exists | -- |
| `2` | `2` | -- | -- |
| `3` | `3` | -- | -- |
| `4` | `4` | -- | -- |
| `5` (or NULL) | `5` | -- | -- |

If the Maximo site uses an A/B/C ranking instead of 1-5 numeric priority:

| Maximo ranking | I/O `overall_criticality` |
|---------------|--------------------------|
| `A` / `CRITICAL` | `1` |
| `B` / `IMPORTANT` | `3` |
| `C` / `ROUTINE` | `5` |

Additional criticality factor scores (`safety_impact`, `environmental_impact`, `production_impact`, `maintenance_cost_impact`) are typically not stored in standard Maximo fields. If the site has custom attributes or a separate RBI (Risk-Based Inspection) dataset, these can be mapped via a site-specific classification.

## Equipment Class Normalization

Maximo `assettype` is site-configurable. Common patterns in refineries:

| Maximo `assettype` / Classification | I/O `equipment_class` |
|--------------------------------------|----------------------|
| `ROTATING`, `PUMP`, `COMPRESSOR`, `TURBINE`, `FAN`, `BLOWER` | `rotating` |
| `STATIC`, `VESSEL`, `COLUMN`, `TANK`, `DRUM`, `REACTOR` | `static` |
| `HEAT_EXCHANGER`, `EXCHANGER`, `HEATER`, `CONDENSER`, `COOLER`, `BOILER`, `FURNACE` | `heat_exchanger` |
| `INSTRUMENT`, `TRANSMITTER`, `ANALYZER`, `CONTROL_VALVE`, `FLOW`, `LEVEL`, `PRESSURE`, `TEMPERATURE` | `instrument` |
| `ELECTRICAL`, `MOTOR`, `TRANSFORMER`, `SWITCHGEAR`, `VFD`, `GENERATOR`, `BREAKER` | `electrical` |
| `PIPING`, `PIPE`, `FITTING`, `FLANGE` | `piping` |
| `RELIEF`, `PSV`, `SAFETY_VALVE`, `SIS`, `ESD` | `relief_device` |
| `STRUCTURAL`, `FOUNDATION`, `SUPPORT`, `STEEL` | `structural` |

**Fallback**: Maximo `assettype` values are highly site-specific. The import wizard should present the user with all distinct `assettype` values found during initial scan and allow manual mapping to I/O classes. Unmapped types default to `static`.

## Equipment Type Normalization

Map Maximo classification (from `classstructureid` hierarchy) to I/O `equipment_type`:

| Maximo Classification | I/O `equipment_type` |
|-----------------------|---------------------|
| `PUMP\CENTRIFUGAL` | `centrifugal_pump` |
| `PUMP\RECIPROCATING` | `reciprocating_pump` |
| `PUMP\PD` | `positive_displacement_pump` |
| `COMPRESSOR\CENTRIFUGAL` | `centrifugal_compressor` |
| `COMPRESSOR\RECIPROCATING` | `reciprocating_compressor` |
| `EXCHANGER\SHELL_TUBE` | `shell_tube_exchanger` |
| `EXCHANGER\AIR_COOLED` | `air_cooled_exchanger` |
| `VESSEL\PRESSURE` | `pressure_vessel` |
| `COLUMN\DISTILLATION` | `distillation_column` |
| `MOTOR\ELECTRIC` | `electric_motor` |
| `VALVE\CONTROL` | `control_valve` |
| `VALVE\RELIEF` | `pressure_safety_valve` |

**Fallback**: Lowercase the leaf classification name, replace spaces/hyphens/backslashes with underscores, store as-is.

## Status Normalization

| Maximo `status` | I/O `status` |
|-----------------|--------------|
| `OPERATING`, `ACTIVE` | `active` |
| `NOT READY`, `BROKEN`, `INACTIVE` | `inactive` |
| `DECOMMISSIONED` | `decommissioned` |
| Not mapped / unknown | `active` (default) |

## Hierarchy Mapping

Maximo uses two parallel hierarchy mechanisms:

1. **Locations**: A parent-child tree of location records (Site > Plant > Unit > System > Sub-system). Each location has a `parent` field pointing to its parent location.
2. **Assets**: Attached to a location via the `location` field. Assets also have a `parent` field for equipment-to-equipment hierarchy (e.g., pump assembly -> motor).

### Mapping to I/O `equipment.parent_id`

- **Asset-to-asset**: Maximo's `parent` field on the asset maps directly to I/O's `parent_id`. Two-pass import: first pass creates all equipment, second pass resolves parent references.
- **Location hierarchy**: The asset's `location` field maps to `functional_location`. I/O does not import the full Maximo location tree -- the location code serves as the hierarchy reference. Area and unit are derived by walking the Maximo location hierarchy during import.
- **Multi-site**: Maximo's `siteid` on the asset maps to I/O's `site_id`. All hierarchy resolution is site-scoped.

### Import Order

1. Equipment records (first pass -- no `parent_id` resolution)
2. Equipment records (second pass -- resolve `parent_id` from `parent` asset numbers)
3. Asset specifications -> `equipment_nameplate`
4. Priority/criticality -> `equipment_criticality`

## Sync Strategy

| Aspect | Configuration |
|--------|---------------|
| **Schedule** | Daily at 02:00 site time |
| **Sync type** | Incremental (watermark-based) |
| **Watermark column** | `_changestamp` (Maximo internal change counter) or `changedate` (timestamp) |
| **Full sync trigger** | Initial load, or manual trigger after Maximo data migration |
| **Initial load** | Page through all assets with `oslc.pageSize=500`. Expect 2,000-15,000 asset records. Include `assetspec` in the select for nameplate data in the same request. Typical runtime: 5-20 minutes |
| **Conflict resolution** | Maximo wins (source of truth). I/O-only fields preserved |
| **Soft delete sync** | Assets with Maximo status `DECOMMISSIONED` -> set I/O `status = 'decommissioned'` |
| **Upsert key** | `external_id` + `source_system` (maps to `equipment.external_id` where `source_system = 'maximo'`) |

## Pre-Built Import Definition

```jsonc
{
  "name": "IBM Maximo Equipment Registry",
  "description": "Import asset master data, specifications (nameplate), and criticality from IBM Maximo",
  "source_system": "maximo",
  "connector_type": "rest_json",
  "domain": "equipment",
  "enabled": true,

  "connection": {
    "base_url": "https://{maximo-host}:{port}/maximo/oslc/os",
    "auth_method": "api_key_header",
    "auth_header": "apikey",
    "params": {
      "lean": "1"
    },
    "timeout_seconds": 60,
    "retry_attempts": 3,
    "retry_delay_seconds": 10
  },

  "source": {
    "endpoints": [
      {
        "id": "asset_master",
        "path": "/mxapiasset",
        "params": {
          "oslc.select": "assetnum,description,status,location,parent,manufacturer,modelnum,serialnum,installdate,priority,assettype,siteid,classstructureid,failurecode,groupname",
          "oslc.pageSize": 500
        },
        "pagination": {
          "strategy": "pageno",
          "page_size_param": "oslc.pageSize",
          "page_param": "pageno",
          "next_link_field": "responseInfo.nextPage"
        },
        "watermark": {
          "field": "changedate",
          "filter_template": "oslc.where=changedate>\"{watermark}\""
        },
        "response_root": "member"
      },
      {
        "id": "asset_specifications",
        "path": "/mxapiasset",
        "params": {
          "oslc.select": "assetnum,assetspec{assetattrid,alnvalue,numvalue,measureunitid,classstructureid}",
          "oslc.pageSize": 500
        },
        "pagination": {
          "strategy": "pageno",
          "page_size_param": "oslc.pageSize",
          "page_param": "pageno"
        },
        "response_root": "member",
        "depends_on": "asset_master"
      }
    ]
  },

  "field_mappings": [
    {
      "target_table": "equipment",
      "source_endpoint": "asset_master",
      "mappings": [
        { "source": "assetnum",            "target": "external_id" },
        { "source": "assetnum",            "target": "tag" },
        { "source": "description",         "target": "description",            "transform": "trim" },
        { "source": "location",            "target": "functional_location" },
        { "source": "location",            "target": "area",                   "transform": "resolve_maximo_location_area" },
        { "source": "location",            "target": "unit",                   "transform": "resolve_maximo_location_unit" },
        { "source": "parent",              "target": "parent_id",              "transform": "lookup_equipment_by_external_id" },
        { "source": "manufacturer",        "target": "manufacturer" },
        { "source": "modelnum",            "target": "model_number" },
        { "source": "serialnum",           "target": "serial_number" },
        { "source": "installdate",         "target": "year_installed",         "transform": "extract_year" },
        { "source": "siteid",              "target": "site_id",                "transform": "lookup_site_by_code" },
        { "source": "priority",            "target": "criticality",            "transform": "coerce_1_to_5" },
        { "source": "assettype",           "target": "equipment_class",        "transform": "normalize_maximo_equipment_class" },
        { "source": "classstructureid",    "target": "equipment_type",         "transform": "normalize_maximo_equipment_type" },
        { "source": "status",              "target": "status",                 "transform": "normalize_maximo_status" },
        { "source": null,                  "target": "source_system",          "transform": "constant('maximo')" },
        { "source": null,                  "target": "data_source",            "transform": "constant('imported')" }
      ]
    },
    {
      "target_table": "equipment_nameplate",
      "source_endpoint": "asset_specifications",
      "flatten": "assetspec",
      "mappings": [
        { "source": "$parent.assetnum",    "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "assetattrid",         "target": "attribute_name",         "transform": "lowercase_underscore" },
        { "source": "alnvalue",            "target": "attribute_value",        "transform": "coalesce(alnvalue, to_string(numvalue))" },
        { "source": "measureunitid",       "target": "unit_of_measure",        "transform": "normalize_maximo_uom" }
      ]
    },
    {
      "target_table": "equipment_criticality",
      "source_endpoint": "asset_master",
      "mappings": [
        { "source": "assetnum",            "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "priority",            "target": "overall_criticality",    "transform": "coerce_1_to_5" },
        { "source": null,                  "target": "notes",                  "transform": "constant('Imported from Maximo asset priority')" }
      ],
      "filter": "priority IS NOT NULL"
    }
  ],

  "transforms": {
    "coerce_1_to_5": "clamp(to_int(value), 1, 5)",
    "normalize_maximo_equipment_class": "See Equipment Class Normalization table above",
    "normalize_maximo_equipment_type": "See Equipment Type Normalization table above",
    "normalize_maximo_status": "map({'OPERATING': 'active', 'ACTIVE': 'active', 'NOT READY': 'inactive', 'BROKEN': 'inactive', 'INACTIVE': 'inactive', 'DECOMMISSIONED': 'decommissioned'}, default='active')",
    "normalize_maximo_uom": "map({'PSI': 'psig', 'BAR': 'bar', 'GPM': 'gpm', 'M3/H': 'm3/h', 'DEG F': 'degF', 'DEG C': 'degC', 'HP': 'HP', 'KW': 'kW', 'RPM': 'rpm', 'IN': 'in', 'MM': 'mm', 'FT': 'ft'}, default=identity)",
    "resolve_maximo_location_area": "Query Maximo location hierarchy to resolve top-level parent",
    "resolve_maximo_location_unit": "Query Maximo location hierarchy for immediate parent name"
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
    "import_order": ["asset_master", "asset_specifications"]
  }
}
```

## Notes

- **`lean=1` parameter**: Always include this. Without it, Maximo returns verbose OSLC metadata that bloats response size 3-5x and complicates parsing.
- **`oslc.select` is critical**: Without an explicit field selection, Maximo returns all fields on the object structure, including related objects. This can return megabytes per record. Always specify exactly the fields needed.
- **Asset number format**: Unlike SAP, Maximo asset numbers are typically stored as the actual plant tag (e.g., "P-101A", not zero-padded). No stripping needed. However, some sites use a separate `assetid` (numeric auto-increment) as the internal key -- always use `assetnum` (the user-facing tag) as the I/O `tag`.
- **Asset specifications fetch strategy**: Two approaches: (a) Include `assetspec.*` in the main asset query's `oslc.select` -- returns specs nested in each asset record, but increases response size. (b) Query specs separately by asset -- cleaner but requires N+1 requests. Approach (a) is recommended for the initial load; approach (b) for incremental updates on changed assets.
- **Maximo 7.6 vs MAS 8.x/9.x**: The OSLC API is consistent across versions. MAS adds GraphQL as an alternative API surface, but OSLC remains the recommended approach for bulk data extraction. API key generation moved to the MAS admin UI in 8.x.
- **Multi-site Maximo**: Large companies often run a single Maximo instance serving multiple sites. All queries should be scoped with `oslc.where=siteid="{site-id}"` to avoid pulling equipment from other sites. The import wizard should prompt for the Maximo site ID.
- **Classification hierarchy**: Maximo classifications can be deeply nested (e.g., `ROTATING\PUMP\CENTRIFUGAL\API610`). The connector should resolve the leaf classification for `equipment_type` and the root classification for `equipment_class`.
- **Rate limiting gotcha**: Maximo's default connection pool is often sized for UI users (5-20 connections). A bulk import hammering the API can starve interactive users. Honor the rate limit setting and run imports during off-peak hours.
- **Equipment-to-point mapping**: Like SAP PM, Maximo does not natively store DCS/OPC tag associations. Some sites maintain this mapping in Maximo custom fields or in a separate spreadsheet. If available in Maximo custom fields, add a site-specific mapping entry to extract it. Otherwise, build the mapping in I/O.
