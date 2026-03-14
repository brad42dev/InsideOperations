# Thermo Fisher SampleManager — LIMS Connector Profile

## Application Overview

- **Vendor**: Thermo Fisher Scientific (Digital Solutions division)
- **Product**: SampleManager LIMS (v11.2+ for REST API; current release 21.3+)
- **Market Position**: Dominant in downstream oil & gas. Estimated 40%+ of refinery LIMS installations globally. Ships a pre-configured "Refinery Solution" template with ASTM method libraries, SQC/AQC (ASTM D6299), blend management, and certificate of analysis generation.
- **Licensing**: REST API is included with the base SampleManager license — no separate API license required. API was originally built for the SampleManager mobile app and later extended for general integration.
- **Typical Deployment**: On-premise Windows Server, Oracle or SQL Server backend database, web application tier. Some sites run on cloud (AWS/Azure) with Thermo's managed hosting.

## Integration Architecture

SampleManager integrates with I/O via the **Universal Import pipeline** (Doc 24). The connector populates `lab_samples`, `lab_results`, `product_specifications`, and `sample_points` tables.

**Two integration paths** (select one per installation):

| Path | Requirements | Recommended For |
|------|-------------|-----------------|
| REST API | SampleManager v11.2+, network access to SM web server | Modern installations, sites with REST enabled |
| Direct Database (Oracle/MSSQL) | Read-only DB account, network access to SM database | Older installations, locked-down environments, sites that prefer SQL |

## API Surface — REST API

- **Base URL**: `https://{hostname}:{port}/api/v1` (path varies by installation; some sites use `/samplemanager/api/v1`)
- **Authentication**: Token-based. `POST /api/v1/login` with `{"username": "...", "password": "..."}` returns a session token. Pass as `Authorization: Bearer {token}` on subsequent requests. Token refresh on HTTP 401.
- **Data Format**: JSON
- **Pagination**: Offset-based — `?offset=0&limit=100`
- **Rate Limits**: Not formally documented. Server-side configuration governs concurrency.
- **API Docs**: Not public. Available to licensed customers via Thermo Fisher support portal. Astrix Inc. published a summary whitepaper on REST API capabilities.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/login` | Obtain session token |
| GET | `/api/v1/samples` | List/search samples (supports date range, status, location filters) |
| GET | `/api/v1/samples/{id}` | Sample detail with test assignments |
| GET | `/api/v1/samples/{id}/results` | Results for a specific sample |
| GET | `/api/v1/specifications` | Product specification records |
| GET | `/api/v1/locations` | Sample point / location master data |
| GET | `/api/v1/instruments` | Instrument list |
| GET | `/api/v1/audit` | Audit trail entries |

## API Surface — Direct Database

- **Engine**: Oracle (most common) or Microsoft SQL Server
- **Authentication**: Database username/password with SELECT-only grants
- **Access**: Read-only account on required tables/views

### Recommended View

SampleManager's schema is highly customized per installation. Creating a read-only view isolates I/O from schema variations.

```sql
-- Oracle syntax (adapt for SQL Server)
-- Column names vary by installation — verify against site schema
CREATE OR REPLACE VIEW io_lims_results_vw AS
SELECT
    s.SAMPLE_ID_NUMERIC       AS sample_id,
    s.TEXT_ID                  AS sample_number,
    s.SAMPLE_TYPE              AS sample_type,
    s.STATUS                   AS sample_status,
    s.LOCATION                 AS sample_location,
    s.SAMPLED_DATE             AS collected_at,
    s.LOGIN_DATE               AS received_at,
    s.COMPLETED_DATE           AS completed_at,
    s.SAMPLED_BY               AS collected_by,
    t.ANALYSIS                 AS test_method,
    t.COMPONENT_NAME           AS test_name,
    r.FORMATTED_RESULT         AS result_value,
    r.TEXT_RESULT               AS result_text,
    r.UNITS                    AS result_unit,
    r.MIN_LIMIT                AS spec_low,
    r.MAX_LIMIT                AS spec_high,
    CASE WHEN r.IN_SPEC = 'T' THEN 1 ELSE 0 END AS in_spec,
    r.ENTERED_BY               AS analyst_name,
    r.AUTHORISED_BY            AS approved_by,
    r.AUTHORISED_DATE          AS approved_at,
    s.PRODUCT                  AS product_grade,
    s.BATCH                    AS batch_id,
    r.MODIFIED_ON              AS modified_at
FROM SAMPLE s
JOIN TEST t ON s.SAMPLE_ID_NUMERIC = t.SAMPLE_ID_NUMERIC
JOIN RESULT r ON t.TEST_NUMBER = r.TEST_NUMBER
WHERE r.MODIFIED_ON > :watermark
ORDER BY r.MODIFIED_ON;
```

## Target Tables

| I/O Table | Role | Sync |
|-----------|------|------|
| `lab_samples` | Primary — sample header records | Every poll cycle |
| `lab_results` | Primary — individual test results per sample | Every poll cycle |
| `product_specifications` | Reference — spec limits for quality bands | Daily |
| `sample_points` | Reference — sample location master data | Weekly or on-demand |

## Field Mapping — lab_samples

| SampleManager Field | I/O Column | Transform | Required |
|---------------------|-----------|-----------|----------|
| `SAMPLE_ID_NUMERIC` or `TEXT_ID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'thermo_samplemanager'` | Yes |
| `TEXT_ID` | `sample_number` | Direct | Yes |
| `SAMPLE_TYPE` | `sample_type` | Normalize: see status map below | Yes |
| (resolved from `LOCATION`) | `sample_point_id` | FK lookup against `sample_points.external_id` | Yes |
| (resolved from `LOCATION` + equipment mapping) | `equipment_id` | FK lookup against `equipment.external_id`, nullable | No |
| `DESCRIPTION` | `description` | Direct | No |
| `SAMPLED_BY` | `collected_by` | Direct | No |
| `SAMPLED_DATE` | `collected_at` | Convert to UTC TIMESTAMPTZ | Yes |
| `LOGIN_DATE` | `received_at` | Convert to UTC TIMESTAMPTZ | No |
| `COMPLETED_DATE` | `completed_at` | Convert to UTC TIMESTAMPTZ | No |
| `STATUS` | `status` | Normalize: see status map below | Yes |
| `BATCH` | `batch_id` | Direct | No |
| `PRODUCT` | `product_grade` | Direct | No |
| (overflow fields) | `extra_data` | JSONB — custom fields, priority, urgency, SQC flags | No |

### Sample Type Normalization

| SampleManager Value | I/O `sample_type` |
|--------------------|-------------------|
| `PROCESS`, `PROCESS_CONTROL` | `process` |
| `PRODUCT`, `PRODUCT_CERT`, `BLEND` | `product` |
| `ENVIRONMENTAL`, `DISCHARGE`, `EMISSION` | `environmental` |
| `WATER`, `COOLING`, `BOILER`, `STEAM` | `water_chemistry` |
| `CRUDE`, `CRUDE_ASSAY`, `FEEDSTOCK` | `crude_assay` |
| `OIL_ANALYSIS`, `CORROSION`, `WEAR`, `CATALYST` | `equipment_analysis` |
| (other) | `process` (default) |

### Sample Status Normalization

| SampleManager Status | I/O `status` |
|---------------------|-------------|
| `U` (Unreceived), `V` (Logged) | `collected` |
| `I` (Received) | `received` |
| `P` (In Progress), `W` (Awaiting) | `in_progress` |
| `A` (Authorised), `C` (Complete) | `approved` |
| `X` (Cancelled), `R` (Rejected) | `rejected` |

## Field Mapping — lab_results

| SampleManager Field | I/O Column | Transform | Required |
|---------------------|-----------|-----------|----------|
| `TEST_NUMBER` or `RESULT_ID` | `external_id` | Cast to string | Yes |
| (from parent sample) | `sample_id` | FK to `lab_samples.id` via `external_id` lookup | Yes |
| `COMPONENT_NAME` | `test_name` | Direct | Yes |
| `ANALYSIS` | `test_method` | Direct (e.g., "ASTM D86") | Yes |
| `COMPONENT_NAME` | `parameter_name` | Direct (e.g., "Sulfur", "Flash Point") | Yes |
| `FORMATTED_RESULT` | `value` | Parse numeric; null if non-numeric | Conditional |
| `TEXT_RESULT` | `value_text` | For non-numeric results (color, appearance) | Conditional |
| `UNITS` | `unit` | Direct | Yes |
| `MIN_LIMIT` | `spec_low` | Direct | No |
| `MAX_LIMIT` | `spec_high` | Direct | No |
| `IN_SPEC` | `in_spec` | `'T'` → true, else false | No |
| (literal) | `result_source` | `'lab'` | Yes |
| `ENTERED_BY` | `analyst_name` | Direct | No |
| `AUTHORISED_BY` | `approved_by` | Direct | No |
| `AUTHORISED_DATE` | `approved_at` | Convert to UTC TIMESTAMPTZ | No |
| (overflow) | `extra_data` | JSONB — instrument ID, replicate number, SQC data | No |

## Field Mapping — product_specifications

| SampleManager Field | I/O Column | Transform | Required |
|---------------------|-----------|-----------|----------|
| `SPEC_ID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'thermo_samplemanager'` | Yes |
| `PRODUCT` or `GRADE` | `product_name` | Direct | Yes |
| `GRADE` | `product_grade` | Direct | Yes |
| `COMPONENT_NAME` | `parameter_name` | Direct | Yes |
| `ANALYSIS` | `test_method` | Direct | Yes |
| `MIN_LIMIT` | `spec_min` | Direct | No |
| `MAX_LIMIT` | `spec_max` | Direct | No |
| `UNITS` | `unit` | Direct | Yes |
| `REGULATORY` flag | `regulatory` | Boolean | No |
| `CUSTOMER_SPEC` flag | `customer_specific` | Boolean | No |
| (overflow) | `extra_data` | JSONB — target value, effective date, revision | No |

## Field Mapping — sample_points

| SampleManager Field | I/O Column | Transform | Required |
|---------------------|-----------|-----------|----------|
| `LOCATION_ID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'thermo_samplemanager'` | Yes |
| `LOCATION_NAME` | `name` | Direct | Yes |
| `DESCRIPTION` | `description` | Direct | No |
| `LOCATION` (parent) | `location` | Direct | No |
| `UNIT` | `unit` | Direct | No |
| `AREA` | `area` | Direct | No |
| (derived from location type) | `stream_type` | Normalize to enum | No |
| (mapped to I/O point) | `linked_point_id` | FK lookup, nullable | No |
| (overflow) | `extra_data` | JSONB — sampling instructions, frequency, schedule | No |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Samples + Results | Poll REST or DB view | 5-15 min | `MODIFIED_ON > @last_sync` on results table |
| Product Specs | Poll REST or DB | Daily | `MODIFIED_ON` or full replace |
| Sample Points | Full sync | Weekly or on-demand | N/A (full replace) |

### Watermark Strategy

The primary watermark is `MODIFIED_ON` (or `modified_date`) on the RESULT table. This captures new results, status changes, and approval events. Filter samples by joining to results modified since last sync — this avoids re-fetching unchanged samples.

For process correlation, use `SAMPLED_DATE` (collection timestamp) as the time axis, not `AUTHORISED_DATE` (approval). The collection timestamp represents when conditions were measured.

### Initial Load

1. Register the import definition in I/O
2. Sync sample points first (provides FK targets for samples)
3. Sync product specifications (provides spec limits)
4. Full sample + result sync for configurable lookback period (default: 90 days)
5. Switch to incremental polling

## Pre-Built Import Definition

```json
{
  "name": "Thermo SampleManager — Lab Results",
  "description": "Import lab samples, results, and specifications from Thermo Fisher SampleManager LIMS",
  "connector_type": "rest_json",
  "source_system": "thermo_samplemanager",
  "connection": {
    "base_url": "https://{{SM_HOST}}:{{SM_PORT}}/api/v1",
    "auth": {
      "type": "token",
      "login_endpoint": "/login",
      "login_body": {
        "username": "{{SM_USERNAME}}",
        "password": "{{SM_PASSWORD}}"
      },
      "token_path": "$.token",
      "token_header": "Authorization",
      "token_prefix": "Bearer ",
      "refresh_on": [401]
    },
    "timeout_sec": 30,
    "tls_verify": true
  },
  "sources": [
    {
      "name": "samples_and_results",
      "endpoint": "/samples",
      "params": {
        "status": "A,C",
        "modified_after": "{{WATERMARK}}",
        "limit": 100,
        "include": "results"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "offset",
        "limit_param": "limit",
        "page_size": 100
      },
      "schedule": "*/10 * * * *",
      "watermark": {
        "field": "$.results[*].modified_date",
        "type": "timestamp",
        "format": "ISO8601"
      },
      "target_table": "lab_samples",
      "child_sources": [
        {
          "path": "$.results",
          "target_table": "lab_results",
          "parent_key": "external_id"
        }
      ]
    },
    {
      "name": "specifications",
      "endpoint": "/specifications",
      "params": {
        "active": true,
        "limit": 500
      },
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "locations",
      "endpoint": "/locations",
      "params": {
        "type": "SAMPLE_POINT",
        "limit": 500
      },
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ],
  "field_mappings": {
    "lab_samples": [
      {"source": "$.sample_id", "target": "external_id"},
      {"source": "'thermo_samplemanager'", "target": "source_system", "literal": true},
      {"source": "$.text_id", "target": "sample_number"},
      {"source": "$.sample_type", "target": "sample_type", "transform": "normalize_sample_type"},
      {"source": "$.location", "target": "sample_point_id", "transform": "lookup_sample_point"},
      {"source": "$.description", "target": "description"},
      {"source": "$.sampled_by", "target": "collected_by"},
      {"source": "$.sampled_date", "target": "collected_at", "transform": "to_utc_timestamp"},
      {"source": "$.login_date", "target": "received_at", "transform": "to_utc_timestamp"},
      {"source": "$.completed_date", "target": "completed_at", "transform": "to_utc_timestamp"},
      {"source": "$.status", "target": "status", "transform": "normalize_status"},
      {"source": "$.batch", "target": "batch_id"},
      {"source": "$.product", "target": "product_grade"}
    ],
    "lab_results": [
      {"source": "$.result_id", "target": "external_id"},
      {"source": "$.component_name", "target": "test_name"},
      {"source": "$.analysis", "target": "test_method"},
      {"source": "$.component_name", "target": "parameter_name"},
      {"source": "$.formatted_result", "target": "value", "transform": "parse_numeric"},
      {"source": "$.text_result", "target": "value_text"},
      {"source": "$.units", "target": "unit"},
      {"source": "$.min_limit", "target": "spec_low"},
      {"source": "$.max_limit", "target": "spec_high"},
      {"source": "$.in_spec", "target": "in_spec", "transform": "to_boolean"},
      {"source": "'lab'", "target": "result_source", "literal": true},
      {"source": "$.entered_by", "target": "analyst_name"},
      {"source": "$.authorised_by", "target": "approved_by"},
      {"source": "$.authorised_date", "target": "approved_at", "transform": "to_utc_timestamp"}
    ],
    "product_specifications": [
      {"source": "$.spec_id", "target": "external_id"},
      {"source": "'thermo_samplemanager'", "target": "source_system", "literal": true},
      {"source": "$.product", "target": "product_name"},
      {"source": "$.grade", "target": "product_grade"},
      {"source": "$.component_name", "target": "parameter_name"},
      {"source": "$.analysis", "target": "test_method"},
      {"source": "$.min_limit", "target": "spec_min"},
      {"source": "$.max_limit", "target": "spec_max"},
      {"source": "$.units", "target": "unit"},
      {"source": "$.regulatory", "target": "regulatory", "transform": "to_boolean"},
      {"source": "$.customer_spec", "target": "customer_specific", "transform": "to_boolean"}
    ],
    "sample_points": [
      {"source": "$.location_id", "target": "external_id"},
      {"source": "'thermo_samplemanager'", "target": "source_system", "literal": true},
      {"source": "$.location_name", "target": "name"},
      {"source": "$.description", "target": "description"},
      {"source": "$.location", "target": "location"},
      {"source": "$.unit", "target": "unit"},
      {"source": "$.area", "target": "area"},
      {"source": "$.stream_type", "target": "stream_type", "transform": "normalize_stream_type"}
    ]
  }
}
```

### Alternative: Direct Database Import Definition

```json
{
  "name": "Thermo SampleManager — Lab Results (Database)",
  "connector_type": "oracle",
  "source_system": "thermo_samplemanager",
  "connection": {
    "host": "{{SM_DB_HOST}}",
    "port": 1521,
    "service_name": "{{SM_DB_SERVICE}}",
    "username": "{{SM_DB_USER}}",
    "password": "{{SM_DB_PASSWORD}}",
    "tls_verify": true
  },
  "sources": [
    {
      "name": "samples_and_results",
      "query": "SELECT * FROM io_lims_results_vw WHERE modified_at > :watermark ORDER BY modified_at",
      "params": {"watermark": "{{WATERMARK}}"},
      "schedule": "*/10 * * * *",
      "watermark": {
        "field": "modified_at",
        "type": "timestamp"
      }
    }
  ]
}
```

## Notes

- **Endpoint paths are installation-specific.** SampleManager is highly configurable. Sites may rename entities, add custom fields, and expose custom API endpoints. Work with the site's SM administrator to get their exact API documentation.
- **REST API was designed for mobile first.** The API surface may not cover all entity types. Some data (e.g., SQC charts, complex specifications) may only be accessible via direct database query.
- **SAMPLED_DATE is the correlation timestamp.** For process correlation in I/O Forensics, always use the collection timestamp — not the approval timestamp. A sample collected at 14:00 but approved at 16:00 should align with process conditions at 14:00.
- **SQC/AQC data (ASTM D6299)** is available in SampleManager but not mapped to I/O's standard tables. If the site wants SQC chart data, capture it in `extra_data` JSONB on `lab_results` or create a dedicated import with `custom_import_data`.
- **Status code letters vary.** SampleManager uses configurable single-character status codes. The mapping above shows typical defaults. Confirm the site's actual status workflow during commissioning.
- **Oracle TNS vs. service name:** Older installations may require TNS connection strings instead of host/service_name. The database connector config supports both.
- **Volume:** A busy refinery lab produces 500-2,000 results per day. Polling every 10 minutes at 100 results per page will comfortably keep up.
