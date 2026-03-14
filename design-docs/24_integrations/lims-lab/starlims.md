# STARLIMS — LIMS Connector Profile

## Application Overview

- **Vendor**: Abbott Informatics (Abbott Laboratories subsidiary)
- **Product**: STARLIMS Technology Platform v12.x (Quality Manufacturing Solution for refinery/petrochemical)
- **Market Position**: Third-tier in refinery specifically (~5-10% of downstream O&G) but strong in quality manufacturing broadly. Growing presence in oil & gas through the Quality Manufacturing solution. More common in integrated refinery/chemical complexes.
- **Licensing**: REST API is included with the Technology Platform license (v12+). The "System Interfacing" module may require separate licensing for advanced enterprise integration scenarios (SAP, MES). Direct database access requires no additional STARLIMS license.
- **Typical Deployment**: On-premise Windows Server, SQL Server backend (primary) or Oracle. Web application tier. Cloud-hosted option available.

## Integration Architecture

STARLIMS integrates with I/O via the **Universal Import pipeline** (Doc 24). The connector populates `lab_samples`, `lab_results`, `product_specifications`, and `sample_points` tables.

**Two integration paths** (select one per installation):

| Path | Requirements | Recommended For |
|------|-------------|-----------------|
| REST API | STARLIMS v12+ with REST framework enabled | Modern installations (v12+) |
| Direct Database (MSSQL) | Read-only DB account, network access | Pre-v12 installations, or when REST is not enabled |

**Version matters:** STARLIMS v12 was a major architectural change. Pre-v12 installations only support SOAP web services (more complex to integrate). v12.1+ added OpenAPI specification compliance for endpoint discovery.

## API Surface — REST API

- **Base URL**: `https://{hostname}/starlims/api` (v12+ REST framework)
- **Authentication**: SAML SSO for interactive users (v12+). For service integration: token-based session auth. `POST /api/auth/login` with credentials returns a session token.
- **Data Format**: JSON (REST), XML (SOAP for pre-v12)
- **Pagination**: Offset-based (implementation-specific)
- **Rate Limits**: Not publicly documented. Configurable server-side.
- **API Docs**: Not fully public. v12.1+ supports OpenAPI spec for endpoint discovery. Licensed customers get REST API framework documentation.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Obtain session token |
| GET | `/api/samples` | Query samples with filters |
| GET | `/api/samples/{id}` | Sample detail |
| GET | `/api/results` | Query results (date range, status) |
| GET | `/api/specifications` | Product specifications |
| GET | `/api/orders` | Lab orders (sample requests) |
| GET | `/api/locations` | Sample point / location master |
| GET | `/api/openapi` | OpenAPI spec (v12.1+ — endpoint discovery) |

### Custom Endpoints

STARLIMS has a built-in scripting engine (SSL — STARLIMS Scripting Language). Sites can expose custom REST endpoints via this engine. Common custom endpoints at refinery sites:

- Approved results since timestamp (flattened view combining sample + test + result)
- Off-spec notifications
- Crude assay summary reports

## API Surface — Direct Database

- **Engine**: Microsoft SQL Server (primary) or Oracle
- **Authentication**: SQL Server username/password or Windows integrated auth
- **Access**: Read-only SELECT on required tables

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `LIMS_SAMPLE` | Sample header | `SAMPLENUMBER`, `SAMPLINGPOINT`, `STATUS`, `SAMPLINGDATE`, `PRODUCT`, `BATCHID` |
| `LIMS_TEST` | Test assignments | `TESTNUMBER`, `SAMPLENUMBER`, `METHODCODE`, `STATUS`, `COMPLETEDDATE` |
| `LIMS_RESULT` | Individual results | `TESTNUMBER`, `RESULTNUMBER`, `PARAMETERNAME`, `RESULTVALUE`, `UOM`, `ENTRYDATE`, `STATUS` |
| `LIMS_SPECIFICATION` | Spec definitions | `SPECID`, `PRODUCT`, `METHODCODE`, `PARAMETERNAME`, `MINLIMIT`, `MAXLIMIT`, `UOM` |
| `LIMS_SAMPLINGPOINT` | Location master | `SAMPLINGPOINTID`, `DESCRIPTION`, `LOCATION`, `UNIT` |

### Recommended View

```sql
-- SQL Server syntax
CREATE VIEW io_lims_results_vw AS
SELECT
    s.SAMPLENUMBER              AS sample_number,
    s.SAMPLINGPOINT             AS sample_location,
    s.STATUS                    AS sample_status,
    s.SAMPLETYPE                AS sample_type,
    s.SAMPLINGDATE              AS collected_at,
    s.RECEIVEDDATE              AS received_at,
    s.COMPLETEDDATE             AS completed_at,
    s.SAMPLEDBY                 AS collected_by,
    s.PRODUCT                   AS product_grade,
    s.BATCHID                   AS batch_id,
    t.METHODCODE                AS test_method,
    t.TESTNAME                  AS test_name,
    r.RESULTNUMBER              AS result_id,
    r.PARAMETERNAME             AS parameter_name,
    r.RESULTVALUE               AS result_value,
    r.TEXTRESULT                AS result_text,
    r.UOM                       AS result_unit,
    r.MINLIMIT                  AS spec_low,
    r.MAXLIMIT                  AS spec_high,
    r.INSPEC                    AS in_spec,
    r.ANALYSTNAME               AS analyst_name,
    r.APPROVEDBY                AS approved_by,
    r.APPROVEDDATE              AS approved_at,
    r.ENTRYDATE                 AS modified_at
FROM LIMS_SAMPLE s
JOIN LIMS_TEST t ON s.SAMPLENUMBER = t.SAMPLENUMBER
JOIN LIMS_RESULT r ON t.TESTNUMBER = r.TESTNUMBER
WHERE r.ENTRYDATE > @watermark
ORDER BY r.ENTRYDATE;
```

## Target Tables

| I/O Table | Role | Sync |
|-----------|------|------|
| `lab_samples` | Primary — sample header records | Every poll cycle |
| `lab_results` | Primary — individual test results per sample | Every poll cycle |
| `product_specifications` | Reference — spec limits for quality bands | Daily |
| `sample_points` | Reference — sample location master data | Weekly or on-demand |

## Field Mapping — lab_samples

| STARLIMS Field | I/O Column | Transform | Required |
|----------------|-----------|-----------|----------|
| `SAMPLENUMBER` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'starlims'` | Yes |
| `SAMPLENUMBER` | `sample_number` | Direct | Yes |
| `SAMPLETYPE` | `sample_type` | Normalize: see map below | Yes |
| `SAMPLINGPOINT` | `sample_point_id` | FK lookup against `sample_points.external_id` | Yes |
| (resolved from equipment mapping) | `equipment_id` | FK lookup, nullable | No |
| `DESCRIPTION` | `description` | Direct | No |
| `SAMPLEDBY` | `collected_by` | Direct | No |
| `SAMPLINGDATE` | `collected_at` | Convert to UTC TIMESTAMPTZ | Yes |
| `RECEIVEDDATE` | `received_at` | Convert to UTC TIMESTAMPTZ | No |
| `COMPLETEDDATE` | `completed_at` | Convert to UTC TIMESTAMPTZ | No |
| `STATUS` | `status` | Normalize: see map below | Yes |
| `BATCHID` | `batch_id` | Direct | No |
| `PRODUCT` | `product_grade` | Direct | No |
| (overflow) | `extra_data` | JSONB — order number, priority, workflow state | No |

### Sample Type Normalization

| STARLIMS Value | I/O `sample_type` |
|---------------|-------------------|
| `PROCESS`, `QC`, `IPC` | `process` |
| `PRODUCT`, `FINISHED`, `BLEND`, `CERT` | `product` |
| `ENVIRONMENTAL`, `WASTE`, `DISCHARGE` | `environmental` |
| `WATER`, `UTILITY` | `water_chemistry` |
| `CRUDE`, `FEEDSTOCK`, `RAW` | `crude_assay` |
| `EQUIPMENT`, `OIL_ANALYSIS`, `CORROSION` | `equipment_analysis` |
| (other) | `process` (default) |

### Sample Status Normalization

| STARLIMS Status | I/O `status` |
|----------------|-------------|
| `SAMPLED`, `CREATED` | `collected` |
| `RECEIVED`, `LOGGED` | `received` |
| `IN_PROGRESS`, `TESTING`, `PENDING_REVIEW` | `in_progress` |
| `APPROVED`, `RELEASED`, `COMPLETED` | `approved` |
| `REJECTED`, `CANCELLED`, `VOIDED` | `rejected` |

## Field Mapping — lab_results

| STARLIMS Field | I/O Column | Transform | Required |
|----------------|-----------|-----------|----------|
| `RESULTNUMBER` | `external_id` | Cast to string | Yes |
| (from parent sample) | `sample_id` | FK to `lab_samples.id` | Yes |
| `TESTNAME` | `test_name` | Direct | Yes |
| `METHODCODE` | `test_method` | Direct | Yes |
| `PARAMETERNAME` | `parameter_name` | Direct | Yes |
| `RESULTVALUE` | `value` | Parse numeric; null if non-numeric | Conditional |
| `TEXTRESULT` | `value_text` | For non-numeric results | Conditional |
| `UOM` | `unit` | Direct | Yes |
| `MINLIMIT` | `spec_low` | Direct | No |
| `MAXLIMIT` | `spec_high` | Direct | No |
| `INSPEC` | `in_spec` | `1` / `'Y'` → true, else false | No |
| (literal) | `result_source` | `'lab'` | Yes |
| `ANALYSTNAME` | `analyst_name` | Direct | No |
| `APPROVEDBY` | `approved_by` | Direct | No |
| `APPROVEDDATE` | `approved_at` | Convert to UTC TIMESTAMPTZ | No |
| (overflow) | `extra_data` | JSONB — instrument, replicate, review comments | No |

## Field Mapping — product_specifications

| STARLIMS Field | I/O Column | Transform | Required |
|----------------|-----------|-----------|----------|
| `SPECID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'starlims'` | Yes |
| `PRODUCT` | `product_name` | Direct | Yes |
| `GRADE` | `product_grade` | Direct | Yes |
| `PARAMETERNAME` | `parameter_name` | Direct | Yes |
| `METHODCODE` | `test_method` | Direct | Yes |
| `MINLIMIT` | `spec_min` | Direct | No |
| `MAXLIMIT` | `spec_max` | Direct | No |
| `UOM` | `unit` | Direct | Yes |
| `REGULATORY` | `regulatory` | Boolean | No |
| `CUSTOMERSPEC` | `customer_specific` | Boolean | No |
| (overflow) | `extra_data` | JSONB — target value, revision, effective date | No |

## Field Mapping — sample_points

| STARLIMS Field | I/O Column | Transform | Required |
|----------------|-----------|-----------|----------|
| `SAMPLINGPOINTID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'starlims'` | Yes |
| `SAMPLINGPOINTID` | `name` | Direct | Yes |
| `DESCRIPTION` | `description` | Direct | No |
| `LOCATION` | `location` | Direct | No |
| `UNIT` | `unit` | Direct | No |
| `AREA` | `area` | Direct | No |
| (derived) | `stream_type` | Normalize to enum | No |
| (mapped to I/O point) | `linked_point_id` | FK lookup, nullable | No |
| (overflow) | `extra_data` | JSONB — sampling schedule, instructions | No |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Samples + Results | Poll REST or DB view | 5-15 min | `ENTRYDATE > @last_sync` on LIMS_RESULT |
| Product Specs | Poll REST or DB | Daily | Full replace or `MODIFIEDDATE` |
| Sample Points | Full sync | Weekly or on-demand | N/A (full replace) |

### Watermark Strategy

Primary watermark is `ENTRYDATE` on the LIMS_RESULT table. For API, use `modified_after` query parameter if available, or filter client-side.

For process correlation, use `SAMPLINGDATE` (collection timestamp) as the time axis.

### Initial Load

1. Register the import definition in I/O
2. Sync sample points first
3. Sync product specifications
4. Full sample + result sync for configurable lookback (default: 90 days)
5. Switch to incremental polling

## Pre-Built Import Definition

```json
{
  "name": "STARLIMS — Lab Results",
  "description": "Import lab samples, results, and specifications from STARLIMS LIMS",
  "connector_type": "rest_json",
  "source_system": "starlims",
  "connection": {
    "base_url": "https://{{SL_HOST}}/starlims/api",
    "auth": {
      "type": "token",
      "login_endpoint": "/auth/login",
      "login_body": {
        "username": "{{SL_USERNAME}}",
        "password": "{{SL_PASSWORD}}"
      },
      "token_path": "$.sessionToken",
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
      "endpoint": "/results",
      "params": {
        "status": "APPROVED,RELEASED",
        "modified_after": "{{WATERMARK}}",
        "limit": 100
      },
      "pagination": {
        "type": "offset",
        "offset_param": "offset",
        "limit_param": "limit",
        "page_size": 100
      },
      "schedule": "*/10 * * * *",
      "watermark": {
        "field": "$.entryDate",
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
      "name": "sampling_points",
      "endpoint": "/locations",
      "params": {
        "limit": 500
      },
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

### Alternative: Direct Database Import Definition

```json
{
  "name": "STARLIMS — Lab Results (Database)",
  "description": "Import lab data from STARLIMS via direct SQL Server database access",
  "connector_type": "mssql",
  "source_system": "starlims",
  "connection": {
    "host": "{{SL_DB_HOST}}",
    "port": 1433,
    "database": "{{SL_DB_NAME}}",
    "username": "{{SL_DB_USER}}",
    "password": "{{SL_DB_PASSWORD}}",
    "tls_verify": true
  },
  "sources": [
    {
      "name": "samples_and_results",
      "query": "SELECT * FROM io_lims_results_vw WHERE modified_at > @watermark ORDER BY modified_at",
      "params": {"watermark": "{{WATERMARK}}"},
      "schedule": "*/10 * * * *",
      "watermark": {
        "field": "modified_at",
        "type": "timestamp"
      }
    },
    {
      "name": "specifications",
      "query": "SELECT SPECID, PRODUCT, GRADE, METHODCODE, PARAMETERNAME, MINLIMIT, MAXLIMIT, UOM FROM LIMS_SPECIFICATION WHERE ACTIVE = 1",
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sample_points",
      "query": "SELECT SAMPLINGPOINTID, DESCRIPTION, LOCATION, UNIT, AREA FROM LIMS_SAMPLINGPOINT WHERE ACTIVE = 1",
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

## Notes

- **Version matters significantly.** Pre-v12 STARLIMS uses a completely different integration architecture (SOAP web services, SSL scripting). If the site is pre-v12, use the direct database path.
- **v12.1 OpenAPI discovery** allows I/O's import wizard to auto-discover available endpoints. If available, use `GET /api/openapi` during setup to enumerate the site's exposed endpoints.
- **STARLIMS uses SSL scripting for custom logic.** Sites often expose custom REST endpoints for common queries (e.g., "all approved results since X"). These custom endpoints may be more efficient than the standard entity endpoints.
- **SAMPLINGDATE is the correlation timestamp.** Use collection time for process correlation in I/O.
- **Quality Manufacturing solution** includes pre-configured workflows for oil & gas. Sites using this solution will have more predictable schema than generic STARLIMS installations.
- **System Interfacing module** handles bidirectional integration with SAP, MES, and other enterprise systems. I/O does not need this module — standard REST API or database access is sufficient for read-only lab data import.
- **Status values are configurable.** The mapping above reflects typical QM solution defaults. Confirm during commissioning.
- **SQL Server is the dominant database** for STARLIMS (unlike SampleManager/LabWare which lean toward Oracle). This simplifies the database connector since I/O already uses the `tiberius` crate for MSSQL.
