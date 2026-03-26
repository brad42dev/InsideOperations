---
id: DD-15-016
title: Implement OPC UA namespace browser in OPC Sources config
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When an admin has created an OPC UA source and configured its endpoint URL, they need a way to browse the OPC server's address space to discover available node IDs without writing them by hand. The namespace browser opens as a panel or dialog from the source detail view, connects via the backend to the live OPC server, and renders a tree of nodes the admin can expand and select. Selecting a node copies its NodeId into a point configuration form.

## Spec Excerpt (verbatim)

> **OPC UA source configuration**: When adding or editing an OPC UA source, the configuration form includes: endpoint URL, security policy selection, "Client Certificate" dropdown (lists client certificates from the centralized certificate store), optional platform dropdown ("What platform is this?"), **connection test button**, and live connection status indicator. Connection testing and status monitoring are per-source-instance operations. OPC UA server certificates received during connection handshake are automatically stored in the Trusted CAs section of the central certificate store.
> — 15_SETTINGS_MODULE.md, §Point Source Management

> **Source health monitoring**: connection status, `last_connected_at`, error messages
> — 15_SETTINGS_MODULE.md, §Point Source Management

(The namespace browser is required for point discovery — OPC UA points are identified by NodeId strings that must be browsed from the live server, not entered manually.)

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/OpcSources.tsx` — source detail panel; add a "Browse Namespace" button that opens the browser
- `services/opc-service/src/` — backend OPC UA client; must expose a browse endpoint
- `services/api-gateway/src/` — route: `POST /api/v1/opc/sources/{id}/browse` (browse a node's children)

## Verification Checklist

- [ ] OPC source detail panel has a "Browse Namespace" button visible when the source is connected
- [ ] Clicking the button opens a tree panel or dialog showing the root namespace nodes
- [ ] Nodes can be expanded to reveal children (lazy-loaded on expand via API)
- [ ] Selecting a node displays its NodeId string and a "Copy NodeId" or "Use this Node" action
- [ ] Browse API `POST /api/v1/opc/sources/{id}/browse` with body `{ node_id?: string }` returns `{ nodes: { id, name, type, has_children }[] }`
- [ ] Browsing a disconnected source returns an error state (not a crash)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `namespace` match anywhere in OpcSources.tsx. No browse endpoint found in the API gateway or opc-service. The test connection button exists (OpcSources.tsx:1318) but the address space browser is absent entirely.

## Fix Instructions

**1. Backend — browse endpoint** (in `services/opc-service/src/` and exposed via API gateway):

Add `POST /api/v1/opc/sources/{id}/browse`:
- Body: `{ node_id?: string }` (omit for root browse)
- Response: `{ nodes: [{ id: string, name: string, node_class: "Object" | "Variable" | "Method", data_type?: string, has_children: bool }] }`
- Permission check: `system:opc_config`
- Uses the existing OPC UA session for the source if connected, or opens a temporary session

**2. Frontend — "Browse Namespace" button** (OpcSources.tsx source detail panel):

Find the source detail/stats section (around line 356+) and add a "Browse Namespace" button next to "Test Connection". The button should:
- Be disabled when source status is not "connected"
- Open a `<Dialog>` containing an `OpcNamespaceBrowser` component

**3. Frontend — OpcNamespaceBrowser component** (can live in `frontend/src/pages/settings/OpcSources.tsx` or a separate file):

```tsx
// Conceptual structure
function OpcNamespaceBrowser({ sourceId, onSelectNode }) {
  const [parentId, setParentId] = useState<string | undefined>(undefined)
  const browseQuery = useQuery({
    queryKey: ['opc-browse', sourceId, parentId],
    queryFn: () => fetch(`/api/v1/opc/sources/${sourceId}/browse`, {
      method: 'POST',
      body: JSON.stringify({ node_id: parentId })
    }).then(r => r.json())
  })
  // Render tree nodes; clicking a node with has_children expands it
  // Clicking a Variable node offers "Copy NodeId" action
}
```

Do NOT:
- Eager-load the entire namespace tree — browse lazily on expand only
- Block the source form save on namespace browse (browser is optional discovery tool)
- Show the browse button when the source is not connected — disable it with tooltip "Connect the source first to browse its namespace"
