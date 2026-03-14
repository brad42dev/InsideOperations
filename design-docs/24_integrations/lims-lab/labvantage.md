# LabVantage — LIMS Connector Profile

## Application Overview

- **Vendor**: LabVantage Solutions Inc.
- **Product**: LabVantage LIMS 8.x (Oil & Gas Solution)
- **Market Position**: Strong mid-market player, ~10-15% of refinery installations. Dedicated Oil & Gas Solution with pre-configured workflows for crude assay, product testing, environmental monitoring, and blend optimization. Claims 75% faster deployment vs. generic LIMS. 1,500+ global customer sites across industries.
- **Licensing**: REST API is a core platform feature — no separate license required. Enterprise Connector (for SAP/MES integration) is separately licensed but not needed for I/O integration. Direct database access requires no additional license.
- **Typical Deployment**: On-premise application server (Java-based), Oracle or PostgreSQL backend. Web UI. Some sites use LabVantage Cloud.

## Integration Architecture

LabVantage integrates with I/O via the **Universal Import pipeline** (Doc 24). The connector populates `lab_samples`, `lab_results`, `product_specifications`, and `sample_points` tables.

**LabVantage has the best-documented public REST API of the major LIMS vendors.** The REST API is the recommended integration path.

**Two integration paths** (select one per installation):

| Path | Requirements | Recommended For |
|------|-------------|-----------------|
| REST API (recommended) | LabVantage 8.x, network access, REST enabled via RESTPolicy | All modern installations |
| Direct Database (Oracle/PostgreSQL) | Read-only DB account, network access | Fallback if REST is disabled or firewalled |

## API Surface — REST API

- **Base URL**: `https://{hostname}/labvantage/rest/sdc` (SDC = Sample Data Collection)
- **Authentication**: Token-based.
  1. `POST /rest/connections` with body `{"databaseid": "...", "username": "...", "password": "..."}`
  2. Returns a `ConnectionId` token
  3. Pass via: (a) Cookie (automatic if using session), (b) `Authorization` header, or (c) query parameter `?connectionid={id}`
  4. Tokens can be restricted to REST-only access (no SOAP, no Controller)
  5. Tokens support configurable expiration dates
  6. Token sessions do not time out like interactive user sessions — ideal for service integration
- **Data Format**: JSON
- **Pagination**: LabVantage Query system — `?queryid={id}&param1={value}` for parameterized server-side queries. Also supports standard limit/offset on SDC endpoints.
- **Rate Limits**: Not publicly documented. HTTPS/TLS required.
- **API Docs**: Partially public at `vantagecare.labvantage.com`. Built-in `/rest/api` endpoint provides self-documenting API discovery.
- **RESTPolicy**: Server-side configuration controls which SDC resources are exposed via REST. Must be configured to expose samples, tests, datasets, and items.

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/rest/connections` | Obtain connection token |
| GET | `/rest/sdc/samples` | List samples |
| GET | `/rest/sdc/samples/{id}` | Sample detail |
| GET | `/rest/sdc/samples/{id}/tests` | Tests for a sample |
| GET | `/rest/sdc/samples/{id}/tests/{testid}/datasets` | Data sets for a test |
| GET | `/rest/sdc/samples/{id}/tests/{testid}/datasets/{dsid}/items` | Individual result items |
| POST | `/rest/actions` | Execute system actions |
| GET | `/rest/api` | Built-in API documentation / discovery |

### Hierarchical Resource Model

LabVantage uses a hierarchical SDC model: **Sample → Tests → DataSets → DataItems**. Getting a complete sample with all results requires traversing this hierarchy. Two approaches:

1. **Multiple requests per sample**: Walk the hierarchy (verbose but precise)
2. **LabVantage Query**: Use a pre-defined server-side query that flattens the hierarchy into a single result set (recommended for bulk sync)

A LabVantage admin should create a query like:

```
QueryID: IO_APPROVED_RESULTS
Parameters: modified_after (timestamp)
Returns: Flattened sample + test + result rows
```

This avoids the N+1 request problem of walking the hierarchy.

## API Surface — Direct Database

- **Engine**: Oracle (most common) or PostgreSQL
- **Authentication**: Database username/password with SELECT-only grants

### Recommended View

```sql
-- Oracle syntax (adapt for PostgreSQL)
CREATE OR REPLACE VIEW io_lims_results_vw AS
SELECT
    s.SAMPLEID                 AS sample_id,
    s.SAMPLINGPOINT            AS sample_location,
    s.SAMPLESTATUS             AS sample_status,
    s.SAMPLETYPE               AS sample_type,
    s.SAMPLINGDATE             AS collected_at,
    s.RECEIVEDDATE             AS received_at,
    s.COMPLETEDDATE            AS completed_at,
    s.SAMPLEDBY                AS collected_by,
    s.PRODUCTNAME              AS product_grade,
    s.BATCHID                  AS batch_id,
    t.TESTMETHODID             AS test_method,
    t.TESTNAME                 AS test_name,
    di.SDCID                   AS result_id,
    di.PARAMNAME               AS parameter_name,
    di.NUMERICVALUE            AS result_value,
    di.TEXTVALUE               AS result_text,
    di.UNITS                   AS result_unit,
    di.LOLIMIT                 AS spec_low,
    di.HILIMIT                 AS spec_high,
    di.INSPEC                  AS in_spec,
    di.ENTEREDBY               AS analyst_name,
    di.APPROVEDBY              AS approved_by,
    di.APPROVEDDATE            AS approved_at,
    di.MODIFIEDDATE            AS modified_at
FROM SDCSAMPLE s
JOIN SDCSAMPLETEST t ON s.SAMPLEID = t.SAMPLEID
JOIN SDCDATASET ds ON t.SAMPLEID = ds.SAMPLEID AND t.SDCID = ds.PARENTSDCID
JOIN SDCDATAITEM di ON ds.SDCID = di.PARENTSDCID
WHERE di.MODIFIEDDATE > :watermark
ORDER BY di.MODIFIEDDATE;
```

## Target Tables

| I/O Table | Role | Sync |
|-----------|------|------|
| `lab_samples` | Primary — sample header records | Every poll cycle |
| `lab_results` | Primary — individual test results per sample | Every poll cycle |
| `product_specifications` | Reference — spec limits for quality bands | Daily |
| `sample_points` | Reference — sample location master data | Weekly or on-demand |

## Field Mapping — lab_samples

| LabVantage Field | I/O Column | Transform | Required |
|-----------------|-----------|-----------|----------|
| `SAMPLEID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labvantage'` | Yes |
| `SAMPLEID` | `sample_number` | Direct | Yes |
| `SAMPLETYPE` | `sample_type` | Normalize: see map below | Yes |
| `SAMPLINGPOINT` | `sample_point_id` | FK lookup against `sample_points.external_id` | Yes |
| (resolved from equipment mapping) | `equipment_id` | FK lookup, nullable | No |
| `DESCRIPTION` | `description` | Direct | No |
| `SAMPLEDBY` | `collected_by` | Direct | No |
| `SAMPLINGDATE` | `collected_at` | Convert to UTC TIMESTAMPTZ | Yes |
| `RECEIVEDDATE` | `received_at` | Convert to UTC TIMESTAMPTZ | No |
| `COMPLETEDDATE` | `completed_at` | Convert to UTC TIMESTAMPTZ | No |
| `SAMPLESTATUS` | `status` | Normalize: see map below | Yes |
| `BATCHID` | `batch_id` | Direct | No |
| `PRODUCTNAME` | `product_grade` | Direct | No |
| (overflow) | `extra_data` | JSONB — priority, project, custom fields | No |

### Sample Type Normalization

| LabVantage Value | I/O `sample_type` |
|-----------------|-------------------|
| `PROCESS`, `QC`, `IN_PROCESS` | `process` |
| `PRODUCT`, `FINISHED`, `BLEND`, `CERT` | `product` |
| `ENVIRONMENTAL`, `WASTE`, `EFFLUENT` | `environmental` |
| `WATER`, `COOLING`, `BOILER` | `water_chemistry` |
| `CRUDE`, `CRUDE_ASSAY`, `FEEDSTOCK` | `crude_assay` |
| `EQUIPMENT`, `OIL_ANALYSIS`, `CORROSION` | `equipment_analysis` |
| (other) | `process` (default) |

### Sample Status Normalization

| LabVantage Status | I/O `status` |
|------------------|-------------|
| `CREATED`, `SAMPLED` | `collected` |
| `RECEIVED`, `LOGGED` | `received` |
| `IN_PROGRESS`, `TESTING`, `PENDING_APPROVAL` | `in_progress` |
| `APPROVED`, `RELEASED`, `COMPLETED` | `approved` |
| `REJECTED`, `CANCELLED`, `VOIDED` | `rejected` |

## Field Mapping — lab_results

| LabVantage Field | I/O Column | Transform | Required |
|-----------------|-----------|-----------|----------|
| `SDCID` (DataItem) | `external_id` | Cast to string | Yes |
| (from parent sample) | `sample_id` | FK to `lab_samples.id` | Yes |
| `TESTNAME` | `test_name` | Direct | Yes |
| `TESTMETHODID` | `test_method` | Direct | Yes |
| `PARAMNAME` | `parameter_name` | Direct | Yes |
| `NUMERICVALUE` | `value` | Direct (already numeric) | Conditional |
| `TEXTVALUE` | `value_text` | For non-numeric results | Conditional |
| `UNITS` | `unit` | Direct | Yes |
| `LOLIMIT` | `spec_low` | Direct | No |
| `HILIMIT` | `spec_high` | Direct | No |
| `INSPEC` | `in_spec` | `'Y'` / `1` → true, else false | No |
| (literal) | `result_source` | `'lab'` | Yes |
| `ENTEREDBY` | `analyst_name` | Direct | No |
| `APPROVEDBY` | `approved_by` | Direct | No |
| `APPROVEDDATE` | `approved_at` | Convert to UTC TIMESTAMPTZ | No |
| (overflow) | `extra_data` | JSONB — instrument, replicate, data set context | No |

## Field Mapping — product_specifications

| LabVantage Field | I/O Column | Transform | Required |
|-----------------|-----------|-----------|----------|
| `SPECID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labvantage'` | Yes |
| `PRODUCTNAME` | `product_name` | Direct | Yes |
| `GRADE` | `product_grade` | Direct | Yes |
| `PARAMNAME` | `parameter_name` | Direct | Yes |
| `TESTMETHODID` | `test_method` | Direct | Yes |
| `LOLIMIT` | `spec_min` | Direct | No |
| `HILIMIT` | `spec_max` | Direct | No |
| `UNITS` | `unit` | Direct | Yes |
| `REGULATORY` | `regulatory` | Boolean | No |
| `CUSTOMERSPEC` | `customer_specific` | Boolean | No |
| (overflow) | `extra_data` | JSONB — target value, revision, effective date | No |

## Field Mapping — sample_points

| LabVantage Field | I/O Column | Transform | Required |
|-----------------|-----------|-----------|----------|
| `SAMPLINGPOINTID` | `external_id` | Cast to string | Yes |
| (literal) | `source_system` | `'labvantage'` | Yes |
| `SAMPLINGPOINTID` | `name` | Direct | Yes |
| `DESCRIPTION` | `description` | Direct | No |
| `LOCATION` | `location` | Direct | No |
| `UNIT` | `unit` | Direct | No |
| `AREA` | `area` | Direct | No |
| (derived) | `stream_type` | Normalize to enum | No |
| (mapped to I/O point) | `linked_point_id` | FK lookup, nullable | No |
| (overflow) | `extra_data` | JSONB — schedule, frequency, instructions | No |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Samples + Results | Poll REST query or DB view | 5-15 min | `MODIFIEDDATE > @last_sync` on DataItem |
| Product Specs | Poll REST or DB | Daily | Full replace or `MODIFIEDDATE` |
| Sample Points | Full sync | Weekly or on-demand | N/A (full replace) |

### Watermark Strategy

Primary watermark is `MODIFIEDDATE` on the SDCDATAITEM (DataItem) table. For REST API, use the LabVantage Query system with a `modified_after` parameter rather than walking the SDC hierarchy.

For process correlation, use `SAMPLINGDATE` (collection timestamp) as the time axis.

### Initial Load

1. Register the import definition in I/O
2. Verify RESTPolicy exposes required SDC resources (or create the io_lims_results_vw database view)
3. Sync sample points first
4. Sync product specifications
5. Full sample + result sync for configurable lookback (default: 90 days)
6. Switch to incremental polling

## Pre-Built Import Definition

```json
{
  "name": "LabVantage — Lab Results",
  "description": "Import lab samples, results, and specifications from LabVantage LIMS",
  "connector_type": "rest_json",
  "source_system": "labvantage",
  "connection": {
    "base_url": "https://{{LV_HOST}}/labvantage/rest",
    "auth": {
      "type": "custom",
      "login_endpoint": "/connections",
      "login_method": "POST",
      "login_body": {
        "databaseid": "{{LV_DATABASE_ID}}",
        "username": "{{LV_USERNAME}}",
        "password": "{{LV_PASSWORD}}"
      },
      "token_path": "$.ConnectionId",
      "token_header": "Authorization",
      "token_prefix": "",
      "refresh_on": [401, 403]
    },
    "timeout_sec": 30,
    "tls_verify": true
  },
  "sources": [
    {
      "name": "samples_and_results",
      "endpoint": "/sdc/samples",
      "params": {
        "queryid": "IO_APPROVED_RESULTS",
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
        "field": "$.modifiedDate",
        "type": "timestamp",
        "format": "ISO8601"
      },
      "target_table": "lab_samples",
      "child_sources": [
        {
          "path": "$.dataItems",
          "target_table": "lab_results",
          "parent_key": "external_id"
        }
      ]
    },
    {
      "name": "specifications",
      "endpoint": "/sdc/specifications",
      "params": {
        "active": true,
        "limit": 500
      },
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sampling_points",
      "endpoint": "/sdc/samplingpoints",
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
  "name": "LabVantage — Lab Results (Database)",
  "description": "Import lab data from LabVantage via direct Oracle/PostgreSQL database access",
  "connector_type": "oracle",
  "source_system": "labvantage",
  "connection": {
    "host": "{{LV_DB_HOST}}",
    "port": 1521,
    "service_name": "{{LV_DB_SERVICE}}",
    "username": "{{LV_DB_USER}}",
    "password": "{{LV_DB_PASSWORD}}",
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
      "query": "SELECT SPECID, PRODUCTNAME, GRADE, TESTMETHODID, PARAMNAME, LOLIMIT, HILIMIT, UNITS FROM SDCSPECIFICATION WHERE ACTIVE = 'Y'",
      "schedule": "0 2 * * *",
      "target_table": "product_specifications"
    },
    {
      "name": "sample_points",
      "query": "SELECT SAMPLINGPOINTID, DESCRIPTION, LOCATION, UNIT, AREA FROM SDCSAMPLINGPOINT WHERE ACTIVE = 'Y'",
      "schedule": "0 3 * * 0",
      "target_table": "sample_points"
    }
  ]
}
```

## Notes

- **Best public API documentation of the five vendors.** LabVantage's REST API patterns, authentication flow, and SDC resource model are partially documented at `vantagecare.labvantage.com`. The built-in `/rest/api` endpoint provides self-documenting discovery at runtime.
- **Hierarchical SDC model requires LabVantage Query for efficiency.** Walking Sample → Test → DataSet → DataItem generates many HTTP requests. Have the LabVantage admin create a flattened query (e.g., `IO_APPROVED_RESULTS`) that returns all needed fields in one result set.
- **RESTPolicy must be configured.** LabVantage's RESTPolicy controls which SDC resources are exposed. If the import wizard cannot see samples, the RESTPolicy needs updating. This is a LabVantage admin task.
- **Token sessions don't time out.** Unlike interactive user sessions, REST API token sessions remain valid until their configured expiration date. This is ideal for scheduled polling — no session timeout issues between polls.
- **databaseid in auth** is a LabVantage concept — it identifies which LabVantage database instance to connect to. Multi-database installations may have separate instances for production, QA, etc.
- **SAMPLINGDATE is the correlation timestamp.** Use collection time for process correlation in I/O.
- **Oracle vs. PostgreSQL:** Older LabVantage installations use Oracle. Newer ones may use PostgreSQL. The SDC table names are consistent across database engines; SQL syntax differences are minor.
- **Oil & Gas Solution pre-configuration** includes crude assay workflows, blend optimization, and environmental monitoring. Sites using this solution will have predictable field names and workflows.
- **Volume:** 500-2,000 results/day typical. 10-minute polling is more than adequate.
