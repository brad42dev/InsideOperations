# AVEVA Asset Information Management (PI Asset Framework) -- Equipment Registry Connector Profile

## Application Overview

- **Vendor**: AVEVA (Schneider Electric subsidiary)
- **Product**: AVEVA PI System with PI Asset Framework (AF), and/or AVEVA Asset Information Management (AIM) via AVEVA Connect cloud platform
- **Market position**: Strong at sites already running AVEVA/Wonderware DCS or the PI System historian. Often deployed alongside (not replacing) a CMMS like Maximo or SAP PM. PI Asset Framework provides the richest equipment-to-point mapping of any source because assets are modeled with PI point attributes built in
- **Licensing**: Commercial. PI Web API is included with PI System license. AVEVA Connect cloud requires a separate subscription
- **Typical refinery scenario**: PI AF is an asset hierarchy database layered on top of the PI Data Archive historian. Assets are organized in a tree (Site > Unit > System > Equipment) with attributes that link directly to PI points (real-time tags). This makes PI AF uniquely valuable for I/O because it can provide both equipment master data and the equipment-to-point mapping in a single import. Sites using PI AF typically also have a CMMS -- the value of this connector is supplementary: richer point mappings and condition-based attributes that the CMMS does not have

## API Surface

| Attribute | Detail |
|-----------|--------|
| **API type** | REST/JSON (PI Web API on-premise), REST/JSON (AVEVA Connect cloud API) |
| **Base URL** | `https://{pi-host}/piwebapi/` (on-premise) or `https://{connect-host}/api/v1/` (cloud) |
| **Auth methods** | Kerberos/NTLM (most common on-premise), Basic Auth, OAuth 2.0 client credentials (AVEVA Connect cloud) |
| **Pagination** | `startIndex` + `maxCount` parameters. Default `maxCount` is 1000 |
| **Rate limits** | PI Web API: generous defaults (1000+ requests/min). AVEVA Connect: cloud-tier rate limits apply |
| **Incremental sync** | Asset attributes support time-based queries. Element modifications tracked via `Links.Self` + `WebId` stability |
| **Response format** | JSON |
| **API docs** | [PI Web API Reference](https://docs.aveva.com/bundle/pi-web-api-reference/) |

### Key Endpoints

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Asset databases | `GET assetdatabases` | GET |
| Root elements | `GET assetdatabases/{webId}/elements` | GET |
| Child elements (hierarchy) | `GET elements/{webId}/elements` | GET |
| Element attributes | `GET elements/{webId}/attributes` | GET |
| Attribute value | `GET attributes/{webId}/value` | GET |
| Element search | `GET search/query?q=name:{name}&scope={dbWebId}` | GET |
| Element templates | `GET elementtemplates` | GET |
| Event frames | `GET eventframes?searchMode=BackwardFromEndTime&startTime=*-365d` | GET |

### Connection Configuration

```jsonc
{
  "connector_type": "rest_json",
  "base_url": "https://{pi-host}/piwebapi",
  "auth": {
    "method": "kerberos",
    "spn": "HTTP/{pi-host}"
    // Basic Auth alternative:
    // "method": "basic",
    // "username": "{domain}\\{user}",
    // "password": "{secret}"
    // AVEVA Connect alternative:
    // "method": "oauth2_client_credentials",
    // "token_url": "https://connect.aveva.com/oauth/token",
    // "client_id": "{client-id}",
    // "client_secret": "{secret}"
  },
  "headers": {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  "pagination": {
    "strategy": "offset",
    "page_size": 1000,
    "page_size_param": "maxCount",
    "offset_param": "startIndex"
  },
  "rate_limit": {
    "requests_per_minute": 500
  }
}
```

## Target Tables

| I/O Table | Role | Populated |
|-----------|------|-----------|
| `equipment` | Primary -- one row per PI AF element that represents equipment | Yes |
| `equipment_nameplate` | PI AF attributes (non-point-linked) as nameplate key-value pairs | Yes |
| `equipment_criticality` | If PI AF has criticality attributes or risk scores | Conditional |
| `equipment_points` | PI AF point-linked attributes -> equipment-to-point mapping | **Yes** (unique to this connector) |

This connector is the only equipment registry source that can auto-populate `equipment_points`, because PI AF elements have attributes directly linked to PI points (which map to I/O OPC tags).

## Field Mapping

### PI AF Elements -> `equipment`

PI AF organizes data as Elements within an Asset Database. Elements are arranged in a tree hierarchy. Each element has a Template that defines its type and attributes.

| PI AF Field | I/O Column | Transform | Required |
|-------------|------------|-----------|----------|
| `WebId` | `external_id` | Direct (stable unique identifier) | Yes |
| `Name` | `tag` | Direct -- PI AF element names are typically the plant tag (e.g., "P-101A") | Yes |
| `Description` | `description` | Direct. If empty, use `Name` | Yes |
| `TemplateName` | `equipment_class` | See class normalization below | Yes |
| `TemplateName` | `equipment_type` | See type normalization below | No |
| `Path` | `functional_location` | Extract parent path segments: `\\Server\DB\Site\Unit\System\Equipment` -> `Site.Unit.System` | No |
| `Path` | `area` | Extract path segment at depth 1 (Unit level) | No |
| `Path` | `unit` | Extract path segment at depth 2 (System level) | No |
| Parent element `WebId` | `parent_id` | Lookup: resolve parent element's WebId to I/O `equipment.id` | No |
| -- | `source_system` | Constant: `"pi_af"` | Yes |
| -- | `data_source` | Constant: `"imported"` | Yes |
| -- | `status` | Default: `"active"` (PI AF elements don't have a status field; decommissioned equipment is typically removed from AF) | Yes |

### PI AF Attributes -> `equipment_nameplate`

Each PI AF element has attributes. Attributes can be either static values (nameplate data) or linked to PI points (real-time data). Only non-point-linked attributes map to nameplate; point-linked attributes map to `equipment_points`.

| PI AF Attribute Field | I/O Column | Transform |
|-----------------------|------------|-----------|
| (parent element `WebId`) | `equipment_id` | Lookup via `external_id` |
| `Name` | `attribute_name` | Lowercase, replace spaces with underscores |
| `Value.Value` | `attribute_value` | Convert to string |
| `DefaultUnitsOfMeasure` | `unit_of_measure` | Normalize PI UoM abbreviations |
| `Type` | `extra_data.pi_type` | Preserve (e.g., "Double", "String", "Int32") |

**Filter**: Only import attributes where `DataReferencePlugIn` is NULL or empty (static values). Attributes with `DataReferencePlugIn = "PI Point"` are real-time links and go to `equipment_points` instead.

### PI AF Point-Linked Attributes -> `equipment_points`

This is the high-value mapping unique to PI AF. Attributes linked to PI points encode the equipment-to-measurement relationship.

| PI AF Field | I/O Column | Transform |
|-------------|------------|-----------|
| (parent element `WebId`) | `equipment_id` | Lookup via `external_id` |
| Linked PI point tagname | `point_id` | Lookup: resolve PI tag name to I/O `points_metadata.id` via `tagname` match |
| Attribute `Name` | `relationship_type` | See relationship type mapping below |

#### Relationship Type Mapping

Map PI AF attribute naming conventions to I/O `relationship_type` enum:

| PI AF Attribute Name Pattern | I/O `relationship_type` |
|------------------------------|------------------------|
| Names containing `flow`, `pressure`, `temperature`, `level` (primary process vars) | `primary_measurement` |
| Names containing `vibration`, `bearing`, `proximity` | `secondary` |
| Names containing `output`, `setpoint`, `command`, `valve_position` | `control_output` |
| Names containing `status`, `fault`, `health`, `battery` | `diagnostic` |
| Default / unmatched | `secondary` |

### PI AF Criticality -> `equipment_criticality`

PI AF does not have a standard criticality field. However, many sites define custom attributes on their element templates for criticality. Common patterns:

| PI AF Attribute (if present) | I/O Column | Transform |
|------------------------------|------------|-----------|
| `Criticality` or `CriticalityRanking` | `overall_criticality` | Map A/B/C or 1-5 to I/O 1-5 scale |
| `RiskScore` or `HealthScore` | `overall_criticality` | Bucket: 0-20 -> 5, 21-40 -> 4, 41-60 -> 3, 61-80 -> 2, 81-100 -> 1 |
| `SafetyCritical` (boolean) | `safety_impact` | `true` -> 1, `false` -> 5 |
| `EnvironmentalCritical` (boolean) | `environmental_impact` | `true` -> 1, `false` -> 5 |

If no criticality attributes exist in PI AF, skip `equipment_criticality` population for this source. The CMMS connector (Maximo, SAP PM) should provide criticality data instead.

## Equipment Class Normalization

PI AF uses Element Templates to type assets. Template names are site-configurable but follow common patterns:

| PI AF Template Name | I/O `equipment_class` |
|---------------------|----------------------|
| `Pump`, `Compressor`, `Turbine`, `Fan`, `Blower`, `Agitator` | `rotating` |
| `Vessel`, `Column`, `Tank`, `Drum`, `Reactor` | `static` |
| `Heat Exchanger`, `Exchanger`, `Heater`, `Condenser`, `Cooler`, `Boiler`, `Furnace`, `Reboiler` | `heat_exchanger` |
| `Instrument`, `Transmitter`, `Analyzer`, `Control Valve`, `Meter` | `instrument` |
| `Motor`, `Transformer`, `Switchgear`, `VFD`, `Generator`, `MCC` | `electrical` |
| `Pipe`, `Pipeline`, `Header` | `piping` |
| `Relief Valve`, `PSV`, `Safety Valve`, `SIS`, `ESD` | `relief_device` |
| `Structure`, `Foundation`, `Steel` | `structural` |

**Fallback**: During initial setup, list all Element Templates in the target AF database. Present to user for manual mapping. Unmapped templates default to `static`.

## Equipment Type Normalization

Map from the specific PI AF template name:

| PI AF Template Name | I/O `equipment_type` |
|---------------------|---------------------|
| `Centrifugal Pump` | `centrifugal_pump` |
| `Reciprocating Pump` | `reciprocating_pump` |
| `Centrifugal Compressor` | `centrifugal_compressor` |
| `Reciprocating Compressor` | `reciprocating_compressor` |
| `Shell and Tube Exchanger` | `shell_tube_exchanger` |
| `Air Cooled Exchanger` | `air_cooled_exchanger` |
| `Plate Exchanger` | `plate_exchanger` |
| `Pressure Vessel` | `pressure_vessel` |
| `Distillation Column` | `distillation_column` |
| `Storage Tank` | `storage_tank` |
| `Electric Motor` | `electric_motor` |
| `Control Valve` | `control_valve` |
| `Pressure Transmitter` | `pressure_transmitter` |
| `PSV` | `pressure_safety_valve` |

**Fallback**: Lowercase the template name, replace spaces with underscores, store as-is.

## Hierarchy Mapping

PI AF uses a tree hierarchy that closely mirrors the physical plant structure:

```
\\PIServer\AssetDatabase
  └── Refinery (Site)
       ├── Crude Unit (Unit)
       │    ├── Atmospheric Section (System)
       │    │    ├── P-101A (Equipment)
       │    │    │    ├── Motor (Sub-equipment)
       │    │    │    └── Coupling (Sub-equipment)
       │    │    ├── E-101 (Equipment)
       │    │    └── V-101 (Equipment)
       │    └── Vacuum Section (System)
       └── FCC Unit (Unit)
```

### Mapping to I/O `equipment.parent_id`

- **Element hierarchy is direct**: Every PI AF element has a parent element. The `elements/{webId}/elements` endpoint returns children. Walk the tree recursively.
- **Import scope**: The user selects the root element for import (typically a unit or the entire site). Only elements below that root are imported.
- **Template filtering**: Not every PI AF element is "equipment" -- some are organizational containers (Site, Unit, System). Filter by template: only import elements whose template maps to an I/O equipment class. Organizational elements above equipment level contribute to `functional_location`, `area`, and `unit` via path parsing.
- **Two-pass import**: First pass creates all equipment records, second pass resolves `parent_id` for sub-equipment (e.g., motor under pump).

### Import Order

1. Recursive tree walk from selected root element
2. Equipment records (first pass -- template-filtered elements)
3. Equipment records (second pass -- resolve `parent_id` for sub-equipment)
4. Static attributes -> `equipment_nameplate`
5. Point-linked attributes -> `equipment_points`
6. Criticality attributes -> `equipment_criticality` (if present)

## Sync Strategy

| Aspect | Configuration |
|--------|---------------|
| **Schedule** | Daily at 02:00 site time |
| **Sync type** | Full tree walk (PI AF does not have a reliable global change timestamp) |
| **Watermark** | None reliable for hierarchy changes. For attribute values, use `GetRecordedAtTime` API |
| **Full sync trigger** | Every run is effectively a full scan of the hierarchy. Compare against existing records and upsert |
| **Initial load** | Recursive tree walk. Depth depends on site AF structure. Expect 500-10,000 elements with 5-50 attributes each. Typical runtime: 10-30 minutes (dominated by attribute fetches) |
| **Conflict resolution** | PI AF wins for equipment identity and nameplate data. I/O-only fields preserved. `equipment_points` is additive -- PI AF point links merge with any manually-created mappings in I/O |
| **Delete detection** | Elements removed from PI AF are detected by comparing imported `external_id` set against previous run. Missing elements get I/O `status = 'decommissioned'` |
| **Upsert key** | `external_id` + `source_system` (where `source_system = 'pi_af'`) |

## Pre-Built Import Definition

```jsonc
{
  "name": "AVEVA PI Asset Framework Equipment Registry",
  "description": "Import equipment hierarchy, nameplate attributes, and point mappings from PI Asset Framework",
  "source_system": "pi_af",
  "connector_type": "rest_json",
  "domain": "equipment",
  "enabled": true,

  "connection": {
    "base_url": "https://{pi-host}/piwebapi",
    "auth_method": "kerberos",
    "headers": {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    },
    "timeout_seconds": 60,
    "retry_attempts": 3,
    "retry_delay_seconds": 10
  },

  "source": {
    "endpoints": [
      {
        "id": "asset_database",
        "path": "/assetdatabases",
        "params": {},
        "response_root": "Items",
        "description": "List available AF databases. User selects target DB during wizard setup."
      },
      {
        "id": "element_tree",
        "path": "/elements/{rootWebId}/elements",
        "params": {
          "maxCount": 1000,
          "searchFullHierarchy": true,
          "selectedFields": "Items.WebId;Items.Name;Items.Description;Items.TemplateName;Items.Path;Items.HasChildren;Items.Links"
        },
        "pagination": {
          "strategy": "offset",
          "page_size_param": "maxCount",
          "offset_param": "startIndex"
        },
        "response_root": "Items",
        "recursive": true,
        "description": "Walk the element tree from the user-selected root. Filter by template during processing."
      },
      {
        "id": "element_attributes",
        "path": "/elements/{webId}/attributes",
        "params": {
          "maxCount": 200,
          "selectedFields": "Items.WebId;Items.Name;Items.Description;Items.Value;Items.Type;Items.DefaultUnitsOfMeasure;Items.DataReferencePlugIn;Items.ConfigString"
        },
        "iteration": "per_record",
        "iterate_over": "element_tree",
        "iterate_key": "WebId",
        "response_root": "Items",
        "depends_on": "element_tree"
      }
    ]
  },

  "field_mappings": [
    {
      "target_table": "equipment",
      "source_endpoint": "element_tree",
      "filter": "TemplateName is not null AND TemplateName maps to equipment_class",
      "mappings": [
        { "source": "WebId",               "target": "external_id" },
        { "source": "Name",                "target": "tag" },
        { "source": "Description",         "target": "description",            "transform": "coalesce(Description, Name)" },
        { "source": "TemplateName",        "target": "equipment_class",        "transform": "normalize_piaf_equipment_class" },
        { "source": "TemplateName",        "target": "equipment_type",         "transform": "normalize_piaf_equipment_type" },
        { "source": "Path",                "target": "functional_location",    "transform": "extract_piaf_path_location" },
        { "source": "Path",                "target": "area",                   "transform": "extract_piaf_path_segment(1)" },
        { "source": "Path",                "target": "unit",                   "transform": "extract_piaf_path_segment(2)" },
        { "source": null,                  "target": "source_system",          "transform": "constant('pi_af')" },
        { "source": null,                  "target": "data_source",            "transform": "constant('imported')" },
        { "source": null,                  "target": "status",                 "transform": "constant('active')" }
      ]
    },
    {
      "target_table": "equipment_nameplate",
      "source_endpoint": "element_attributes",
      "filter": "DataReferencePlugIn IS NULL OR DataReferencePlugIn = ''",
      "mappings": [
        { "source": "$parent.WebId",       "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "Name",                "target": "attribute_name",         "transform": "lowercase_underscore" },
        { "source": "Value.Value",         "target": "attribute_value",        "transform": "to_string" },
        { "source": "DefaultUnitsOfMeasure", "target": "unit_of_measure",     "transform": "normalize_piaf_uom" }
      ]
    },
    {
      "target_table": "equipment_points",
      "source_endpoint": "element_attributes",
      "filter": "DataReferencePlugIn = 'PI Point'",
      "mappings": [
        { "source": "$parent.WebId",       "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "ConfigString",        "target": "point_id",              "transform": "extract_pi_tagname_then_lookup_point" },
        { "source": "Name",                "target": "relationship_type",      "transform": "infer_relationship_type_from_name" }
      ]
    },
    {
      "target_table": "equipment_criticality",
      "source_endpoint": "element_attributes",
      "filter": "Name IN ('Criticality', 'CriticalityRanking', 'RiskScore')",
      "mappings": [
        { "source": "$parent.WebId",       "target": "equipment_id",           "transform": "lookup_equipment_by_external_id" },
        { "source": "Value.Value",         "target": "overall_criticality",    "transform": "normalize_piaf_criticality" },
        { "source": null,                  "target": "notes",                  "transform": "constant('Imported from PI AF asset attribute')" }
      ]
    }
  ],

  "transforms": {
    "extract_piaf_path_location": "Split path by '\\', drop first 3 segments (server, db, site), join remaining with '.'",
    "extract_piaf_path_segment": "Split path by '\\', return segment at specified depth after site level",
    "normalize_piaf_equipment_class": "See Equipment Class Normalization table above",
    "normalize_piaf_equipment_type": "See Equipment Type Normalization table above",
    "normalize_piaf_criticality": "If numeric 1-5, use directly. If A/B/C, map A->1 B->3 C->5. If 0-100 risk score, bucket to 1-5.",
    "extract_pi_tagname_then_lookup_point": "Parse ConfigString to extract PI tag name (format: '\\\\server\\tagname'), then lookup in points_metadata by tagname",
    "infer_relationship_type_from_name": "Pattern match attribute name to determine relationship type (see mapping table above)",
    "normalize_piaf_uom": "PI UoM abbreviations are generally standard engineering units; pass through with minor normalization (psi->psig, °F->degF, °C->degC)"
  },

  "schedule": {
    "type": "cron",
    "expression": "0 2 * * *",
    "timezone": "site_local",
    "retry_on_failure": true,
    "max_retries": 2
  },

  "sync": {
    "mode": "full",
    "upsert_key": ["external_id", "source_system"],
    "soft_delete": true,
    "delete_detection": "compare_against_previous_run",
    "preserve_io_fields": ["extra_data", "pid_reference", "gps_latitude", "gps_longitude", "barcode", "criticality", "safety_critical", "environmental_critical"],
    "equipment_points_merge": "additive",
    "import_order": ["element_tree", "element_attributes"]
  }
}
```

## Notes

- **Kerberos authentication**: The most common auth method for on-premise PI Web API. The I/O Import Service must be able to obtain a Kerberos ticket for the PI Web API service principal. This typically requires the I/O server to be domain-joined, or use `kinit` with a keytab file. Kerberos configuration is often the most difficult part of PI AF integration.
- **`X-Requested-With` header**: PI Web API requires this header for CSRF protection. Without it, requests may be redirected to a login page.
- **WebId stability**: PI AF WebIds are stable identifiers derived from the element path. If an element is moved in the hierarchy, its WebId changes. The connector should detect this (element with new WebId matching a known tag name) and update the `external_id` rather than creating a duplicate.
- **Recursive tree walk performance**: For large AF databases (10,000+ elements), `searchFullHierarchy=true` can be slow. If performance is an issue, switch to level-by-level recursion with depth control. Equipment typically lives at depth 3-5 in the hierarchy.
- **PI tag name resolution**: PI AF attributes linked to PI points store the tag reference in the `ConfigString` field (format: `\\\\PISERVER\\TAGNAME` or just `TAGNAME`). Extract the tag name and match against I/O's `points_metadata.tagname`. This assumes the PI tag names match the OPC tag names that I/O is already collecting -- which they do in most PI-based installations, since PI collects from the same OPC sources.
- **Dual-source strategy**: PI AF is best used alongside a CMMS connector, not instead of one. The recommended approach: (a) Import equipment identity and criticality from Maximo/SAP PM, (b) Import point mappings and nameplate data from PI AF, (c) PI AF equipment records that don't exist in the CMMS are created as new I/O records. Conflict resolution: CMMS wins for identity fields, PI AF wins for point mappings.
- **Event Frames for failure history**: PI AF Event Frames can capture equipment failure/upset events with start/end times, cause codes, and linked data. These are better mapped to I/O's event tables (via a separate maintenance connector) than to the equipment registry. Mentioned here for completeness but out of scope for this equipment connector.
- **AVEVA Connect cloud variant**: The cloud API at `connect.aveva.com` uses OAuth 2.0 and has a different URL structure but the same data model. A toggle in the connection config switches between on-premise PI Web API and AVEVA Connect endpoints.
- **No status field**: PI AF elements do not have a native status. Decommissioned equipment is typically deleted from AF or moved to an "Archive" branch. The connector defaults all imported equipment to `status = 'active'`. Delete detection (comparing current run against previous) handles decommissioning.
