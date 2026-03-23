# UAT Scenarios — OPC-BACKEND

## OPC Backend (OPC-BACKEND) — /settings/opc-sources

Note: All OPC-BACKEND tasks are backend service fixes (endpoint selection, A&C methods, deadband). Not directly browser-testable. Testing via OPC source config UI.

Scenario 1: [OPC-BACKEND-001] OPC sources page renders — navigate to /settings/opc-sources → page loads, no error boundary
Scenario 2: [OPC-BACKEND-001] OPC source form loads — click add/edit OPC source → configuration form opens
Scenario 3: [OPC-BACKEND-003] OPC source config has security endpoint settings — check OPC source form → endpoint security configuration options visible
