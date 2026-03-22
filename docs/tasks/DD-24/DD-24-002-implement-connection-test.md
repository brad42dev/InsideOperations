---
id: DD-24-002
title: Implement real connection test using connector dispatch
unit: DD-24
status: pending
priority: high
depends-on: [DD-24-001]
---

## What This Feature Should Do

When an administrator clicks "Test Connection" on an import connection, the Import Service should dispatch to the correct connector implementation, attempt to open a connection to the external system, and return a real pass/fail result. Currently the handler always returns `status: 'ok'` regardless of the connection's configuration.

## Spec Excerpt (verbatim)

> ```rust
> async fn test_connection(
>     &self,
>     config: &ConnectionConfig,
> ) -> Result<ConnectionTestResult>;
> ```
> — 24_UNIVERSAL_IMPORT.md, §2 Connector Architecture (ImportConnector trait)

> **[Test Connection]**: Available in both the connection setup wizard and the connector template configuration step. Must validate credentials before allowing the user to proceed.
> — 24_UNIVERSAL_IMPORT.md, §13 Template Configuration UI

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/handlers/import.rs:602–628` — stub `test_connection` handler
- `services/import-service/src/connectors/mod.rs:66–75` — `DcsConnector::test_connection` — pattern to follow for general connectors
- `services/import-service/src/connectors/pi_web_api.rs` — example of how DCS connectors implement test_connection

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `test_connection` handler fetches the full `import_connections` row including `connection_type`, `config`, `auth_type`, `auth_config`
- [ ] Handler dispatches to a connector registry function (e.g., `get_import_connector(connection_type)`) and calls `.test_connection(&cfg).await`
- [ ] On connector success: updates `last_tested_at`, `last_test_status = 'connected'`, `last_test_message` with a success message
- [ ] On connector failure: updates `last_tested_at`, `last_test_status = 'error'`, `last_test_message` with the error detail
- [ ] Response body includes `{ "status": "connected" | "error", "message": "..." }` — never hardcoded "ok"
- [ ] The DCS supplemental connectors (pi_web_api, experion_rest, etc.) are also reachable via this general path

## Assessment

- **Status**: ❌ Missing (stub)
- `handlers/import.rs:606–627` — hardcoded `last_test_status = 'ok'`, `last_test_message = 'Connection test succeeded'` with no connector call. Comment at line 606 explicitly states: "stub — real connectors not implemented yet".

## Fix Instructions

1. Inside `test_connection` handler (after `handlers/import.rs:605`), fetch the connection row including `connection_type`, `config`, `auth_type`, `auth_config`.

2. Build a `ConnectorConfig` using `connectors::extract_connector_config(id, &config, &auth_type, &auth_config)`.

3. Look up the connector via a general `get_import_connector(connection_type)` function. For Phase 7 MVP: at minimum cover the 7 DCS supplemental types (already have `get_connector` in `connectors/mod.rs`). For other types (csv, rest_json, postgresql, etc.), return a "not yet supported, but config saved" result rather than pretending success.

4. Call `.test_connection(&cfg).await` on the connector. Map the Result:
   - `Ok(_)` → set `last_test_status = 'connected'`, `last_test_message = 'Connection successful'`
   - `Err(e)` → set `last_test_status = 'error'`, `last_test_message = e.to_string()`

5. Update `import_connections` in the DB with the real result, and return it in the response body.

Do NOT:
- Return `status: 'ok'` as a hardcoded string — only `'connected'` or `'error'` are valid outcomes
- Invent a "tested ok" result for connector types that have no implementation yet — return an honest "connection test not supported for this connector type yet" message
