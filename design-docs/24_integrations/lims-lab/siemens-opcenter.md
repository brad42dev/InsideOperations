# Siemens Opcenter Quality (Unilab) — LIMS Connector Profile

## Application Overview

- **Vendor**: Siemens Digital Industries Software (formerly Siemens PLM / Camstar)
- **Product**: Opcenter Quality Execution (LIMS component, formerly Simatic IT Unilab). Part of the broader Opcenter MES/QMS suite.
- **Market Position**: Niche in standalone refinery LIMS (~5% of downstream O&G), but significant presence at refineries that already run Siemens MES (Opcenter Execution Process) or DCS (PCS 7/PCS neo). Common at integrated refinery/chemical sites within Siemens-centric automation ecosystems. Growing through Opcenter platform consolidation.
- **Licensing**: REST API access (Opcenter Intelligence/Connect layer) may require separate licensing beyond the base Unilab license. Direct database access requires no additional Siemens license. OPC UA interface available at sites with Siemens DCS integration.
- **Typical Deployment**: On-premise Windows Server, Oracle or SQL Server backend. Web UI (Opcenter Quality Portal). Often co-deployed with Opcenter Execution Process (MES) and Opcenter Intelligence (analytics/reporting).

## Integration Architecture

Opcenter Quality integrates with I/O via the **Universal Import pipeline** (Doc 24). The connector populates `lab_samples`, `lab_results`, `product_specifications`, and `sample_points` tables.

**Three integration paths** (select one per installation):

| Path | Requirements | Recommended For |
|------|-------------|-----------------|
| REST API (Opcenter Connect) | Opcenter Connect module licensed, network access | Sites with modern Opcenter platform |
| Direct Database (Oracle/MSSQL) | Read-only DB account, network access to Unilab database | Most installations — especially legacy Unilab |
| OPC UA | Opcenter OPC UA server, lab data published as OPC nodes | Sites with Siemens DCS where lab results are already in the OPC namespace |

The direct database path is **the most common choice**. Opcenter Connect (the REST API layer) is a relatively new addition and not universally deployed. Many sites still run legacy Unilab without the Opcenter wrapper.

**Important distinction:** Siemens Opcenter Quality is NOT the same product as the standalone Unilab LIMS that predates the Opcenter branding. Unilab (pre-Opcenter) has no REST API — database-only integration. Opcenter Quality (post-2019 branding) may or may not have the Connect REST layer depending on licensing.

## API Surface — REST API (Opcenter Connect)

- **Base URL**: `https://{hostname}/opcenter/api/v1` (varies by installation; Opcenter Connect gateway)
- **Authentication**: OAuth 2.0 client credentials (Opcenter Connect uses OIDC). Service account with `client_id` and `client_secret`. Some installations use token-based auth via Siemens MindSphere identity.
- **Data Format**: JSON
- **Pagination**: Offset-based or OData-style `$top`/`$skip`
- **Rate Limits**: Not publicly documented
- **API Docs**: Not public. Available through Siemens support portal (SiePortal) for licensed Opcenter Connect customers.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/oauth/token` | Obtain access token (client credentials) |
| GET | `/api/v1/samples` | Query samples with filters |
| GET | `/api/v1/samples/{id}/results` | Results for a sample |
| GET | `/api/v1/specifications` | Product specification records |
| GET | `/api/v1/samplingpoints` | Sample point master data |
| GET | `/api/v1/methods` | Test method definitions |

## API Surface — Direct Database

- **Engine**: Oracle (most common for Unilab) or Microsoft SQL Server
- **Authentication**: Database username/password with SELECT-only grants
- **Access**: Read-only account on Unilab schema tables

### Key Tables (Unilab Schema)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `UTSCMAIN` | Sample header (main sample table) | `SC`, `SS` (status), `SC_TYPE`, `SAMPLING_DATE`, `PRODUCT`, `BATCH` |
| `UTSCNODE` | Sample hierarchy/tree nodes | `SC`, `NODE_ID`, `NODE_TYPE` |
| `UTRSRESULT` | Result values | `SC`, `NODE_ID`, `RS_ID`, `VALUE`, `UNIT`, `ENTRY_DATE`, `STATUS` |
| `UTMTMETHOD` | Method definitions | `MT`, `MT_NAME`, `MT_TYPE` |
| `UTPRPARAM` | Parameter definitions | `PR`, `PR_NAME`, `UNIT`, `LO_LIMIT`, `HI_LIMIT` |
| `UTSPECSPEC` | Specification definitions | `SPEC`, `PRODUCT`, `PARAMETER`, `LO_LIMIT`, `HI_LIMIT` |
| `UTLCLOCATION` | Sample point / location | `LC`, `LC_NAME`, `DESCRIPTION` |

### Recommended View

```sql
-- Oracle syntax (Unilab schema — verify column names per installation)
CREATE OR REPLACE VIEW io_lims_results_vw AS
SELECT
    m.SC                       AS sample_id,
    m.SC                       AS sample_number,
    l.LC_NAME                  AS sample_location,
    m.SS                       AS sample_status,
    m.SC_TYPE                  AS sample_type,
    m.SAMPLING_DATE            AS collected_at,
    m.RECEIVED_DATE            AS received_at,
    m.COMPLETED_DATE           AS completed_at,
    m.SAMPLED_BY               AS collected_by,
    m.PRODUCT                  AS product_grade,
    m.BATCH                    AS batch_id,
    mt.MT_NAME                 AS test_method,
    mt.MT                      AS test_code,
    r.RS_ID                    AS result_id,
    pr.PR_NAME                 AS parameter_name,
    r.VALUE                    AS result_value,
    r.TEXT_VALUE                AS result_text,
    r.UNIT                     AS result_unit,
    pr.LO_LIMIT                AS spec_low,
    pr.HI_LIMIT                AS spec_high,
    CASE WHEN r.IN_SPEC = 'Y' THEN 1 ELSE 0 END AS in_spec,
    r.ENTERED_BY               AS analyst_name,
    r.APPROVED_BY              AS approved_by,
    r.APPROVED_DATE            AS approved_at,
    r.ENTRY_DATE               AS modified_at
FROM UTSCMAIN m
LEFT JOIN UTLCLOCATION l ON m.LC = l.LC
JOIN UTSCNODE n ON m.SC = n.SC
JOIN UTRSRESULT r ON n.SC = r.SC AND n.NODE_ID = r.NODE_ID
LEFT JOIN UTMTMETHOD mt ON n.MT = mt.MT
LEFT JOIN UTPRPARAM pr ON r.PR = pr.PR
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

| Unilab/Opcenter Field | I/O Column | Transform | Required |
|-----------------------|-----------|-----------|----------|
| `SC` (sample code) | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'siemens_opcenter'` | Yes |
| `SC` | `sample_number` | Direct | Yes |
| `SC_TYPE` | `sample_type` | Normalize: see map below | Yes |
| `LC` (location code) | `sample_point_id` | FK lookup against `sample_points.external_id` | Yes |
| (resolved from equipment mapping) | `equipment_id` | FK lookup, nullable | No |
| `DESCRIPTION` | `description` | Direct | No |
| `SAMPLED_BY` | `collected_by` | Direct | No |
| `SAMPLING_DATE` | `collected_at` | Convert to UTC TIMESTAMPTZ | Yes |
| `RECEIVED_DATE` | `received_at` | Convert to UTC TIMESTAMPTZ | No |
| `COMPLETED_DATE` | `completed_at` | Convert to UTC TIMESTAMPTZ | No |
| `SS` (sample status) | `status` | Normalize: see map below | Yes |
| `BATCH` | `batch_id` | Direct | No |
| `PRODUCT` | `product_grade` | Direct | No |
| (overflow) | `extra_data` | JSONB — priority, MES lot reference, workflow ID | No |

### Sample Type Normalization

| Unilab Value | I/O `sample_type` |
|-------------|-------------------|
| `P`, `PROCESS`, `QC` | `process` |
| `F`, `PRODUCT`, `FINISHED`, `CERT` | `product` |
| `E`, `ENV`, `ENVIRONMENTAL` | `environmental` |
| `W`, `WATER`, `UTILITY` | `water_chemistry` |
| `C`, `CRUDE`, `FEEDSTOCK` | `crude_assay` |
| `M`, `MAINT`, `OIL`, `CORROSION` | `equipment_analysis` |
| (other) | `process` (default) |

### Sample Status Normalization

Unilab uses configurable single-character or short string status codes:

| Unilab Status | I/O `status` |
|--------------|-------------|
| `@` (Planned), `A` (Available) | `collected` |
| `R` (Received) | `received` |
| `I` (In Progress), `P` (Pending) | `in_progress` |
| `C` (Complete), `V` (Validated), `Z` (Authorized) | `approved` |
| `X` (Cancelled), `J` (Rejected) | `rejected` |

## Field Mapping — lab_results

| Unilab/Opcenter Field | I/O Column | Transform | Required |
|-----------------------|-----------|-----------|----------|
| `RS_ID` | `external_id` | Cast to string | Yes |
| (from parent sample) | `sample_id` | FK to `lab_samples.id` | Yes |
| `MT_NAME` (method name) | `test_name` | Direct | Yes |
| `MT` (method code) | `test_method` | Direct | Yes |
| `PR_NAME` (parameter name) | `parameter_name` | Direct | Yes |
| `VALUE` | `value` | Parse numeric; null if non-numeric | Conditional |
| `TEXT_VALUE` | `value_text` | For non-numeric results | Conditional |
| `UNIT` | `unit` | Direct | Yes |
| `LO_LIMIT` (from parameter) | `spec_low` | Direct | No |
| `HI_LIMIT` (from parameter) | `spec_high` | Direct | No |
| `IN_SPEC` | `in_spec` | `'Y'` → true, else false | No |
| (literal) | `result_source` | `'lab'` | Yes |
| `ENTERED_BY` | `analyst_name` | Direct | No |
| `APPROVED_BY` | `approved_by` | Direct | No |
| `APPROVED_DATE` | `approved_at` | Convert to UTC TIMESTAMPTZ | No |
| (overflow) | `extra_data` | JSONB — instrument, replicate, MES context | No |

## Field Mapping — product_specifications

| Unilab/Opcenter Field | I/O Column | Transform | Required |
|-----------------------|-----------|-----------|----------|
| `SPEC` (spec code) | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'siemens_opcenter'` | Yes |
| `PRODUCT` | `product_name` | Direct | Yes |
| `GRADE` | `product_grade` | Direct | Yes |
| `PR_NAME` | `parameter_name` | Direct | Yes |
| `MT` | `test_method` | Direct | Yes |
| `LO_LIMIT` | `spec_min` | Direct | No |
| `HI_LIMIT` | `spec_max` | Direct | No |
| `UNIT` | `unit` | Direct | Yes |
| `REGULATORY` | `regulatory` | Boolean | No |
| `CUSTOMER_SPEC` | `customer_specific` | Boolean | No |
| (overflow) | `extra_data` | JSONB — target, revision, effective date | No |

## Field Mapping — sample_points

| Unilab/Opcenter Field | I/O Column | Transform | Required |
|-----------------------|-----------|-----------|----------|
| `LC` (location code) | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'siemens_opcenter'` | Yes |
| `LC_NAME` | `name` | Direct | Yes |
| `DESCRIPTION` | `description` | Direct | No |
| `LOCATION_PATH` | `location` | Direct | No |
| `UNIT` | `unit` | Direct | No |
| `AREA` | `area` | Direct | No |
| (derived) | `stream_type` | Normalize to enum | No |
| (mapped to I/O point) | `linked_point_id` | FK lookup, nullable | No |
| (overflow) | `extra_data` | JSONB — schedule, MES equipment link | No |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Samples + Results | Poll REST or DB view | 5-15 min | `ENTRY_DATE > @last_sync` on UTRSRESULT |
| Product Specs | Poll REST or DB | Daily | Full replace or `MODIFIED_DATE` |
| Sample Points | Full sync | Weekly or on-demand | N/A (full replace) |

### Watermark Strategy

Primary watermark is `ENTRY_DATE` (or `MODIFIED_DATE`) on the UTRSRESULT table. Unilab's result table has reliable timestamps for incremental sync.

For process correlation, use `SAMPLING_DATE` (collection timestamp) as the time axis.

### Initial Load

1. Register the import definition in I/O
2. Sync sample points first
3. Sync product specifications
4. Full sample + result sync for configurable lookback (default: 90 days)
5. Switch to incremental polling

## Pre-Built Import Definition

### REST API (Opcenter Connect)

```json
{
  "name": "Siemens Opcenter Quality — Lab Results",
  "description": "Import lab samples, results, and specifications from Siemens Opcenter Quality (Unilab)",
  "connector_type": "rest_json",
  "source_system": "siemens_opcenter",
  "connection": {
    "base_url": "https://{{OC_HOST}}/opcenter/api/v1",
    "auth": {
      "type": "oauth2_client_credentials",
      "token_endpoint": "https://{{OC_HOST}}/oauth/token",
      "client_id": "{{OC_CLIENT_ID}}",
      "client_secret": "{{OC_CLIENT_SECRET}}",
      "scope": "lims.read"
    },
    "timeout_sec": 30,
    "tls_verify": true
  },
  "sources": [
    {
      "name": "samples_and_results",
      "endpoint": "/samples",
      "params": {
        "$filter": "status eq 'APPROVED' and modifiedDate gt {{WATERMARK}}",
        "$top": 100,
        "$expand": "results"
      },
      "pagination": {
        "type": "odata",
        "top_param": "$top",
        "skip_param": "$skip",
        "page_size": 100
      },
      "schedule": "*/10 * * * *",
      "watermark": {
        "field": "$.modifiedDate",
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
        "$filter": "active eq true",
        "$top": 500
      },
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sampling_points",
      "endpoint": "/samplingpoints",
      "params": {
        "$top": 500
      },
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

### Direct Database (Recommended for most installations)

```json
{
  "name": "Siemens Opcenter Quality — Lab Results (Database)",
  "description": "Import lab data from Siemens Opcenter Quality (Unilab) via direct Oracle database access",
  "connector_type": "oracle",
  "source_system": "siemens_opcenter",
  "connection": {
    "host": "{{OC_DB_HOST}}",
    "port": 1521,
    "service_name": "{{OC_DB_SERVICE}}",
    "username": "{{OC_DB_USER}}",
    "password": "{{OC_DB_PASSWORD}}",
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
      "query": "SELECT SPEC, PRODUCT, GRADE, MT, PR_NAME, LO_LIMIT, HI_LIMIT, UNIT FROM UTSPECSPEC WHERE ACTIVE = 'Y'",
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sample_points",
      "query": "SELECT LC, LC_NAME, DESCRIPTION, LOCATION_PATH, UNIT, AREA FROM UTLCLOCATION WHERE ACTIVE = 'Y'",
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

## Notes

- **Unilab vs. Opcenter branding is confusing.** Many sites still call it "Unilab" even if they've been upgraded to Opcenter branding. The underlying database schema is essentially the same. Ask the site admin which version they run — the answer determines whether REST API is available.
- **Opcenter Connect is the REST gateway.** It sits on top of Unilab and other Opcenter modules. If the site has Opcenter Connect licensed, REST is available. If not, database-only.
- **Unilab schema uses short code column names.** `SC` = sample code, `SS` = sample status, `MT` = method, `PR` = parameter, `RS` = result, `LC` = location. This is a Unilab convention, not a typo.
- **Status codes are single-character by default** but can be customized per installation. The `@` (planned) status is specific to Unilab's workflow. Verify the site's actual status configuration.
- **Oracle is the dominant database** for Unilab/Opcenter Quality. SQL Server is less common but supported in newer versions.
- **SAMPLING_DATE is the correlation timestamp.** Use collection time for process correlation in I/O.
- **MES integration advantage:** If the site also runs Opcenter Execution Process (MES), the LIMS may have richer batch context (lot genealogy, process orders, material tracking) that can flow into `extra_data` JSONB for enhanced I/O correlation.
- **OPC UA path:** Some Siemens-centric sites publish lab results as OPC UA nodes alongside process data. If lab results are already in the OPC namespace that I/O subscribes to, they'll arrive as regular OPC point updates with no additional LIMS connector needed. Check this before setting up a separate LIMS import.
- **Schema varies significantly between Unilab versions.** The table/column names above reflect a common Unilab 7.x/8.x schema. Earlier versions may differ. Always verify against the site's actual schema.
- **Volume:** Same as other LIMS — 500-2,000 results/day typical. 10-minute polling handles this easily.
