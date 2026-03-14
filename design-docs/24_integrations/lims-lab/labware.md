# LabWare LIMS — LIMS Connector Profile

## Application Overview

- **Vendor**: LabWare Inc.
- **Product**: LabWare LIMS 8 (current major version)
- **Market Position**: Second-largest LIMS vendor globally. ~25% of refinery installations. Strong presence in multi-site corporate standardization — several major oil companies use LabWare as their global LIMS standard. Offers a "Process Industry Template" pre-configured for refinery workflows.
- **Licensing**: Integration Platform is a licensed component. REST API access is typically included with enterprise deployments, but contract-dependent. Direct database access requires no additional LabWare license.
- **Typical Deployment**: On-premise Oracle (most common) or SQL Server backend. Application server tier (Windows). Some sites running LabWare Cloud (AWS-hosted).

## Integration Architecture

LabWare integrates with I/O via the **Universal Import pipeline** (Doc 24). The connector populates `lab_samples`, `lab_results`, `product_specifications`, and `sample_points` tables.

**Two integration paths** (select one per installation):

| Path | Requirements | Recommended For |
|------|-------------|-----------------|
| REST API | LabWare 8+ with Integration Platform enabled, network access | Sites with modern LabWare, Integration Platform licensed |
| Direct Database (Oracle/MSSQL) | Read-only DB account, network access to LabWare database | Most installations — simpler, no API licensing questions |

The direct database path is **the more common choice** for LabWare. Many sites already have reporting views or ETL queries against the LabWare database, and the Process Industry Template uses standardized table/column names that make mapping predictable.

## API Surface — REST API

- **Base URL**: `https://{hostname}/labware/api/v1` (varies by installation)
- **Authentication**: Token-based. Endpoint and flow are installation-specific. SSO integration possible. LabWare Integration Platform may use API keys for service accounts.
- **Data Format**: JSON (REST), XML, CSV also supported
- **Pagination**: Implementation-specific (offset or cursor)
- **Rate Limits**: Not publicly documented
- **API Docs**: Not public. Available via LabWare customer portal and implementation partners.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/token` | Obtain session token (path varies) |
| GET | `/api/samples` | List/search samples with filters |
| GET | `/api/samples/{id}/results` | Results for a specific sample |
| GET | `/api/specifications` | Product specifications |
| GET | `/api/sqc/charts` | SQC chart data (ASTM D6299) |
| GET | `/api/locations` | Sample point master data |
| GET | `/api/inventory` | Reagent/standard inventory (informational) |

## API Surface — Direct Database

- **Engine**: Oracle (most common) or Microsoft SQL Server
- **Authentication**: Database username/password with SELECT-only grants
- **Access**: Read-only account on required tables/views

### LabWare Core Tables (Process Industry Template)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `SAMPLE` | Sample header | `SAMPLE_NUMBER`, `SAMPLE_POINT`, `STATUS`, `DATE_SAMPLED`, `PRODUCT`, `BATCH`, `GRADE` |
| `TEST` | Test assignments per sample | `TEST_NUMBER`, `SAMPLE_NUMBER`, `ANALYSIS`, `STATUS`, `DATE_COMPLETED` |
| `RESULT` | Individual result values | `TEST_NUMBER`, `RESULT_NUMBER`, `NAME`, `FORMATTED_RESULT`, `UNITS`, `ENTRY_DATE`, `STATUS` |
| `SPECIFICATION` | Product spec definitions | `SPEC_ID`, `PRODUCT`, `ANALYSIS`, `COMPONENT`, `MIN_LIMIT`, `MAX_LIMIT`, `UNITS` |
| `SAMPLE_POINT` | Sampling location master | `SAMPLE_POINT`, `DESCRIPTION`, `LOCATION`, `UNIT_OPERATION` |
| `BATCH` | Batch/lot tracking | `BATCH_ID`, `PRODUCT`, `STATUS` |

### Recommended View

```sql
-- Oracle syntax (adapt for SQL Server)
CREATE OR REPLACE VIEW io_lims_results_vw AS
SELECT
    s.SAMPLE_NUMBER            AS sample_number,
    s.SAMPLE_POINT             AS sample_location,
    s.STATUS                   AS sample_status,
    s.SAMPLE_TYPE              AS sample_type,
    s.DATE_SAMPLED             AS collected_at,
    s.DATE_RECEIVED            AS received_at,
    s.DATE_COMPLETED           AS completed_at,
    s.SAMPLED_BY               AS collected_by,
    s.PRODUCT                  AS product_grade,
    s.BATCH                    AS batch_id,
    t.ANALYSIS                 AS test_method,
    t.COMPONENT_LIST           AS test_name,
    r.RESULT_NUMBER            AS result_id,
    r.NAME                     AS parameter_name,
    r.FORMATTED_RESULT         AS result_value,
    r.TEXT_VALUE                AS result_text,
    r.UNITS                    AS result_unit,
    r.MIN_LIMIT                AS spec_low,
    r.MAX_LIMIT                AS spec_high,
    r.IN_SPEC                  AS in_spec,
    r.ENTERED_BY               AS analyst_name,
    r.AUTHORISED_BY            AS approved_by,
    r.AUTHORISED_DATE          AS approved_at,
    r.ENTRY_DATE               AS modified_at
FROM SAMPLE s
JOIN TEST t ON s.SAMPLE_NUMBER = t.SAMPLE_NUMBER
JOIN RESULT r ON t.TEST_NUMBER = r.TEST_NUMBER
WHERE r.ENTRY_DATE > :watermark
ORDER BY r.ENTRY_DATE;
```

## Target Tables

| I/O Table | Role | Sync |
|-----------|------|------|
| `lab_samples` | Primary — sample header records | Every poll cycle |
| `lab_results` | Primary — individual test results per sample | Every poll cycle |
| `product_specifications` | Reference — spec limits for quality bands | Daily |
| `sample_points` | Reference — sample location master data | Weekly or on-demand |

## Field Mapping — lab_samples

| LabWare Field | I/O Column | Transform | Required |
|---------------|-----------|-----------|----------|
| `SAMPLE_NUMBER` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labware'` | Yes |
| `SAMPLE_NUMBER` | `sample_number` | Direct | Yes |
| `SAMPLE_TYPE` | `sample_type` | Normalize: see map below | Yes |
| `SAMPLE_POINT` | `sample_point_id` | FK lookup against `sample_points.external_id` | Yes |
| (resolved from equipment mapping) | `equipment_id` | FK lookup, nullable | No |
| `DESCRIPTION` | `description` | Direct | No |
| `SAMPLED_BY` | `collected_by` | Direct | No |
| `DATE_SAMPLED` | `collected_at` | Convert to UTC TIMESTAMPTZ | Yes |
| `DATE_RECEIVED` | `received_at` | Convert to UTC TIMESTAMPTZ | No |
| `DATE_COMPLETED` | `completed_at` | Convert to UTC TIMESTAMPTZ | No |
| `STATUS` | `status` | Normalize: see map below | Yes |
| `BATCH` | `batch_id` | Direct | No |
| `PRODUCT` / `GRADE` | `product_grade` | Direct | No |
| (overflow) | `extra_data` | JSONB — priority, rush flag, worksheet ID | No |

### Sample Type Normalization

| LabWare Value | I/O `sample_type` |
|--------------|-------------------|
| `P`, `PROCESS`, `PROCESS_CTRL` | `process` |
| `PROD`, `PRODUCT`, `CERT`, `BLEND` | `product` |
| `ENV`, `ENVIRONMENTAL`, `DISCHARGE` | `environmental` |
| `WATER`, `CW`, `BFW`, `STEAM` | `water_chemistry` |
| `CRUDE`, `ASSAY`, `FEEDSTOCK` | `crude_assay` |
| `OIL`, `WEAR`, `CORROSION`, `COUPON` | `equipment_analysis` |
| (other) | `process` (default) |

### Sample Status Normalization

| LabWare Status | I/O `status` |
|---------------|-------------|
| `U` (Unreceived) | `collected` |
| `I` (Received/Logged In) | `received` |
| `P` (Pending), `A` (Active), `T` (Testing) | `in_progress` |
| `C` (Complete), `V` (Verified), `R` (Released) | `approved` |
| `X` (Cancelled), `J` (Rejected) | `rejected` |

## Field Mapping — lab_results

| LabWare Field | I/O Column | Transform | Required |
|---------------|-----------|-----------|----------|
| `RESULT_NUMBER` | `external_id` | Cast to string | Yes |
| (from parent sample) | `sample_id` | FK to `lab_samples.id` | Yes |
| `COMPONENT_LIST` or `ANALYSIS` | `test_name` | Direct | Yes |
| `ANALYSIS` | `test_method` | Direct | Yes |
| `NAME` | `parameter_name` | Direct | Yes |
| `FORMATTED_RESULT` | `value` | Parse numeric; null if non-numeric | Conditional |
| `TEXT_VALUE` | `value_text` | For non-numeric results | Conditional |
| `UNITS` | `unit` | Direct | Yes |
| `MIN_LIMIT` | `spec_low` | Direct | No |
| `MAX_LIMIT` | `spec_high` | Direct | No |
| `IN_SPEC` | `in_spec` | `'Y'` / `'T'` → true, else false | No |
| (literal) | `result_source` | `'lab'` | Yes |
| `ENTERED_BY` | `analyst_name` | Direct | No |
| `AUTHORISED_BY` | `approved_by` | Direct | No |
| `AUTHORISED_DATE` | `approved_at` | Convert to UTC TIMESTAMPTZ | No |
| (overflow) | `extra_data` | JSONB — instrument, replicate, SQC flags, worksheet | No |

## Field Mapping — product_specifications

| LabWare Field | I/O Column | Transform | Required |
|---------------|-----------|-----------|----------|
| `SPEC_ID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labware'` | Yes |
| `PRODUCT` | `product_name` | Direct | Yes |
| `GRADE` | `product_grade` | Direct | Yes |
| `COMPONENT` | `parameter_name` | Direct | Yes |
| `ANALYSIS` | `test_method` | Direct | Yes |
| `MIN_LIMIT` | `spec_min` | Direct | No |
| `MAX_LIMIT` | `spec_max` | Direct | No |
| `UNITS` | `unit` | Direct | Yes |
| `REGULATORY` | `regulatory` | Boolean | No |
| `CUSTOMER_SPEC` | `customer_specific` | Boolean | No |
| (overflow) | `extra_data` | JSONB — target value, grade group, effective date | No |

## Field Mapping — sample_points

| LabWare Field | I/O Column | Transform | Required |
|---------------|-----------|-----------|----------|
| `SAMPLE_POINT` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labware'` | Yes |
| `SAMPLE_POINT` | `name` | Direct | Yes |
| `DESCRIPTION` | `description` | Direct | No |
| `LOCATION` | `location` | Direct | No |
| `UNIT_OPERATION` | `unit` | Direct | No |
| `AREA` | `area` | Direct | No |
| (derived from sample point config) | `stream_type` | Normalize to enum | No |
| (mapped to I/O point) | `linked_point_id` | FK lookup, nullable | No |
| (overflow) | `extra_data` | JSONB — schedule, frequency, sampling instructions | No |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Samples + Results | Poll REST or DB view | 5-15 min | `ENTRY_DATE > @last_sync` on RESULT table |
| Product Specs | Poll REST or DB | Daily | `MODIFIED_DATE` or full replace |
| Sample Points | Full sync | Weekly or on-demand | N/A (full replace) |

### Watermark Strategy

Primary watermark is `ENTRY_DATE` (or `MODIFIED_DATE`) on the RESULT table. LabWare's RESULT table has reliable timestamps for incremental sync.

For process correlation, use `DATE_SAMPLED` (collection timestamp) as the time axis, not `AUTHORISED_DATE`.

### Initial Load

1. Register the import definition in I/O
2. Sync sample points first (provides FK targets)
3. Sync product specifications
4. Full sample + result sync for configurable lookback (default: 90 days)
5. Switch to incremental polling

## Pre-Built Import Definition

```json
{
  "name": "LabWare LIMS — Lab Results",
  "description": "Import lab samples, results, and specifications from LabWare LIMS",
  "connector_type": "rest_json",
  "source_system": "labware",
  "connection": {
    "base_url": "https://{{LW_HOST}}/labware/api/v1",
    "auth": {
      "type": "token",
      "login_endpoint": "/auth/token",
      "login_body": {
        "username": "{{LW_USERNAME}}",
        "password": "{{LW_PASSWORD}}"
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
        "status": "C,V,R",
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
        "field": "$.results[*].entry_date",
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
      "name": "sample_points",
      "endpoint": "/locations",
      "params": {
        "type": "SAMPLE_POINT",
        "limit": 500
      },
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

### Alternative: Direct Database Import Definition (Recommended)

```json
{
  "name": "LabWare LIMS — Lab Results (Database)",
  "description": "Import lab data from LabWare LIMS via direct Oracle/MSSQL database access",
  "connector_type": "oracle",
  "source_system": "labware",
  "connection": {
    "host": "{{LW_DB_HOST}}",
    "port": 1521,
    "service_name": "{{LW_DB_SERVICE}}",
    "username": "{{LW_DB_USER}}",
    "password": "{{LW_DB_PASSWORD}}",
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
    },
    {
      "name": "specifications",
      "query": "SELECT SPEC_ID, PRODUCT, GRADE, ANALYSIS, COMPONENT, MIN_LIMIT, MAX_LIMIT, UNITS FROM SPECIFICATION WHERE ACTIVE = 'Y'",
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sample_points",
      "query": "SELECT SAMPLE_POINT, DESCRIPTION, LOCATION, UNIT_OPERATION, AREA FROM SAMPLE_POINT WHERE ACTIVE = 'Y'",
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

## Notes

- **Direct database is the pragmatic default.** Many LabWare sites do not have the Integration Platform licensed or REST API enabled. The database schema is well-structured (especially with the Process Industry Template) and more predictable than the API surface.
- **Process Industry Template standardizes column names.** Sites using this template will have predictable schema. Custom LabWare installations may have different column names — verify during commissioning.
- **DATE_SAMPLED is the correlation timestamp.** Use collection time for process correlation, not approval time.
- **LabWare uses configurable status codes.** The status mapping above reflects typical Process Industry Template defaults. Verify the site's actual workflow configuration.
- **SQC chart data** is available but not mapped to I/O standard tables. If needed, capture via `custom_import_data` or `extra_data` JSONB.
- **Oracle vs. SQL Server:** LabWare historically ran on Oracle. Newer installations may use SQL Server. The view and query syntax differ slightly — the examples above use Oracle syntax.
- **LabWare Cloud deployments** may restrict direct database access. For cloud-hosted LabWare, the REST API is the only option.
- **Instrument integration data** (Empower, Chromeleon, LabX results) flows through LabWare and appears in the standard RESULT table — no special handling needed.
- **Volume:** Same as other LIMS — 500-2,000 results/day is typical. 10-minute polling is more than adequate.
