# SimBLAH Accounting — Demo Connector Profile

## Application Overview

- **Vendor**: SimBLAH (internal demo / proof-of-concept)
- **Product**: SimBLAH Accounting Service — part of the SimBLAH refinery simulator suite
- **Market Position**: Not a commercial product. SimBLAH Accounting manages purchase orders, spare parts inventory, vendor records, and warehouse locations for the simulated Hydrocracker Unit 25 and H₂ Plant Unit 24
- **Licensing**: Internal tooling. No licensing cost
- **Typical Deployment**: Single-server deployment alongside SimBLAH OPC Server and Maintenance services. Rust/Axum backend with PostgreSQL. Accessed via HTTPS on port 8445

## API Surface

- **Protocol**: REST/JSON
- **Base URL**: `https://acct.simblah.in-ops.com:8445/api`
- **Authentication**:
  - **Bearer Token** (preferred for I/O integration): Users with `api_access` or `admin` privilege. Use the `lnovak` account (api_access role) or `admin`
  - **Session Cookie**: Available via `POST /api/auth/login`, but Bearer token is preferred for machine-to-machine
- **Pagination**: `page` + `per_page` parameters. Max `per_page` is 100, default 50. Response includes `pagination` object with `total_items` and `total_pages`
- **Query Syntax**: Query parameters on list endpoints (e.g., `status=open`, `vendor_id=3`, `from=...&to=...`). Sort via `sort` and `order` params
- **Rate Limits**: None documented. Single-tenant demo system
- **Response Envelope**: `{ "data": {...} }` for single items, `{ "data": [...], "pagination": {...} }` for lists

### Key Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/purchase-orders` | List POs (paginated, filterable) |
| `GET /api/purchase-orders/{id}` | Single PO with embedded line items |
| `POST /api/purchase-orders/{id}/fulfill` | Fulfill PO and increment stock |
| `GET /api/inventory` | List parts/materials (paginated, filterable) |
| `GET /api/inventory/{id}` | Single part |
| `GET /api/inventory/{id}/stock` | Stock levels per warehouse location |
| `GET /api/vendors` | List vendors |
| `GET /api/vendors/{id}` | Single vendor |
| `GET /api/locations` | List warehouse/storage locations |
| `GET /api/locations/{id}` | Single location |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `purchase_orders` | **Primary** | PO headers from `/api/purchase-orders` |
| `purchase_order_lines` | **Primary** | Line items embedded in PO response |
| `inventory_items` | **Primary** | Parts/materials from `/api/inventory` + `/api/inventory/{id}/stock` |
| `vendor_master` | **Primary** | Vendor records from `/api/vendors` |
| `warehouse_locations` | Secondary | Storage locations from `/api/locations` |

## Field Mapping

### Purchase Orders: `/api/purchase-orders` → `purchase_orders`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH PO ID |
| — | `source_system` | Yes | Constant: `"simblah_acct"` | |
| `vendor_id` | `vendor_id` | No | `lookup`: match `vendor_master.external_id` | FK to vendor table |
| `vendor_name` | — | No | Stored in `extra_data` | Denormalized vendor name for reference |
| `status` | `status` | Yes | `static_map` | See status normalization below |
| `assigned_to` | `assigned_to` | No | Direct | User ID of buyer |
| `assigned_to_name` | — | No | Stored in `extra_data` | Username for display reference |
| `notes` | `description` | No | Direct | Free-text notes |
| `total_cost` | `total_amount` | No | Direct | Sum of all line item costs |
| `date_opened` | `created_at` | Yes | `parse_datetime` | ISO 8601 UTC |
| `date_fulfilled` | `fulfilled_at` | No | `parse_datetime` | Null if not yet fulfilled |
| `items` | — | No | `map_array` → `purchase_order_lines` | Embedded line items; see line mapping below |

### PO Line Items: `items[]` (nested in PO response) → `purchase_order_lines`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH line item ID |
| — | `source_system` | Yes | Constant: `"simblah_acct"` | |
| (parent PO `id`) | `purchase_order_id` | Yes | `parent_lookup`: match `purchase_orders.external_id` | FK to parent PO |
| `part_id` | `inventory_item_id` | No | `lookup`: match `inventory_items.external_id` | FK to inventory table |
| `part_number` | `part_number` | No | Direct | Manufacturer part number |
| `model_number` | — | No | Stored in `extra_data` | Manufacturer model number |
| `description` | `description` | No | Direct | Line item description |
| `quantity` | `quantity` | Yes | Direct | Quantity ordered |
| `unit_price` | `unit_price` | No | Direct | Price per unit |
| `total_price` | `line_total` | No | Direct | `quantity * unit_price` |

### Inventory / Parts: `/api/inventory` → `inventory_items`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH part ID |
| — | `source_system` | Yes | Constant: `"simblah_acct"` | |
| `part_number` | `part_number` | Yes | Direct | Manufacturer part number (e.g., `0065C9164-0001`) |
| `model_number` | `model_number` | No | Direct | Manufacturer model (e.g., `848T`) |
| `description` | `description` | No | Direct | Part description |
| `total_stock` | `quantity_on_hand` | No | Direct | Aggregate stock across all locations |
| `created_at` | `created_at` | No | `parse_datetime` | ISO 8601 UTC |

Stock levels per location require a secondary call to `/api/inventory/{id}/stock`:

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `locations[].location_id` | `warehouse_location_id` | No | `lookup`: match `warehouse_locations.external_id` | FK to locations |
| `locations[].location_name` | — | No | Stored in `extra_data` | Denormalized location name |
| `locations[].quantity` | `quantity_at_location` | No | Direct | Stock count at this location |

### Vendors: `/api/vendors` → `vendor_master`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH vendor ID |
| — | `source_system` | Yes | Constant: `"simblah_acct"` | |
| `name` | `vendor_name` | Yes | Direct | Company name |
| `contact_info` | `contact_info` | No | Direct | Pipe-delimited string: `email | phone | location` |
| `po_count` | — | No | Stored in `extra_data` | Number of associated POs (informational) |

### Locations: `/api/locations` → `warehouse_locations`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH location ID |
| — | `source_system` | Yes | Constant: `"simblah_acct"` | |
| `name` | `location_name` | Yes | Direct | e.g., `Instrument Storage - Unit 25`, `Main Warehouse` |

> Note: The SimBLAH locations endpoint returns minimal fields. The location object structure beyond `id` and `name` is not documented in the integration guide; additional fields may exist and should be captured in `extra_data`.

## Status Normalization

### Purchase Order Status

| SimBLAH Status | I/O `status` |
|---|---|
| `open` | `open` |
| `fulfilled` | `fulfilled` |
| `cancelled` | `cancelled` |

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Purchase orders | 15 min | `date_opened` | Incremental | `from={watermark}` parameter |
| Inventory / parts | Daily | — | Full sync | Only 45 parts; full refresh is trivial |
| Stock levels | Daily | — | Full sync | Secondary call per part; 45 calls max |
| Vendors | Daily | — | Full sync | Only 10 vendors; full refresh is trivial |
| Locations | Daily | — | Full sync | Only 18 locations |

- **Initial load order**: Locations first → Vendors → Inventory (parts) → Stock levels → Purchase orders (with line items). This ensures FK lookups resolve correctly
- **PO line items**: Embedded in the PO response as `items[]`. No separate endpoint needed. Extract and upsert into `purchase_order_lines` during PO sync
- **Stock level enrichment**: After syncing the base inventory record, call `GET /api/inventory/{id}/stock` for each part to populate per-location stock quantities. With only 45 parts, this is a trivial number of calls
- **Watermark limitation**: Same as Maintenance — no `updated_at` field. `date_opened` catches new POs but not status changes on existing ones. Periodically re-sync `status=open` POs to catch fulfillments and cancellations
- **Pagination**: Use `per_page=100`. Total dataset is small (~12 POs, ~45 parts, ~10 vendors, ~18 locations)

## Pre-Built Import Definition

### Purchase Orders (with Line Items)

```jsonc
{
  "name": "SimBLAH Accounting - Purchase Orders",
  "connector_type": "rest_json",
  "source_system": "simblah_acct",
  "target_table": "purchase_orders",
  "connection": {
    "base_url": "https://acct.simblah.in-ops.com:8445/api",
    "auth_type": "bearer_token",
    "auth_config": {
      "token": "{simblah_acct_token}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry_count": 3,
    "retry_backoff_ms": 1000
  },
  "source": {
    "endpoint": "/purchase-orders",
    "method": "GET",
    "params": {
      "from": "{watermark}",
      "per_page": 100,
      "sort": "date_opened",
      "order": "asc"
    },
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size": 100
    },
    "watermark": {
      "column": "date_opened",
      "format": "iso8601",
      "initial_value": "2025-01-01T00:00:00Z"
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "id", "target": "external_id", "transform": "to_string" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_acct" },
    { "source": "vendor_id", "target": "vendor_id", "transform": "lookup", "lookup_table": "vendor_master", "lookup_column": "external_id" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "open": "open", "fulfilled": "fulfilled", "cancelled": "cancelled"
    }, "default": "open" },
    { "source": "assigned_to_name", "target": "assigned_to" },
    { "source": "notes", "target": "description" },
    { "source": "total_cost", "target": "total_amount" },
    { "source": "date_opened", "target": "created_at", "transform": "parse_datetime" },
    { "source": "date_fulfilled", "target": "fulfilled_at", "transform": "parse_datetime" }
  ],
  "child_mappings": [
    {
      "source_path": "items",
      "target_table": "purchase_order_lines",
      "parent_key": "external_id",
      "field_mappings": [
        { "source": "id", "target": "external_id", "transform": "to_string" },
        { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_acct" },
        { "source": "part_id", "target": "inventory_item_id", "transform": "lookup", "lookup_table": "inventory_items", "lookup_column": "external_id" },
        { "source": "part_number", "target": "part_number" },
        { "source": "description", "target": "description" },
        { "source": "quantity", "target": "quantity" },
        { "source": "unit_price", "target": "unit_price" },
        { "source": "total_price", "target": "line_total" }
      ]
    }
  ]
}
```

### Inventory

```jsonc
{
  "name": "SimBLAH Accounting - Inventory",
  "connector_type": "rest_json",
  "source_system": "simblah_acct",
  "target_table": "inventory_items",
  "connection": {
    "base_url": "https://acct.simblah.in-ops.com:8445/api",
    "auth_type": "bearer_token",
    "auth_config": {
      "token": "{simblah_acct_token}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry_count": 3,
    "retry_backoff_ms": 1000
  },
  "source": {
    "endpoint": "/inventory",
    "method": "GET",
    "params": {
      "per_page": 100
    },
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size": 100
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "id", "target": "external_id", "transform": "to_string" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_acct" },
    { "source": "part_number", "target": "part_number" },
    { "source": "model_number", "target": "model_number" },
    { "source": "description", "target": "description" },
    { "source": "total_stock", "target": "quantity_on_hand" },
    { "source": "created_at", "target": "created_at", "transform": "parse_datetime" }
  ]
}
```

### Vendors

```jsonc
{
  "name": "SimBLAH Accounting - Vendors",
  "connector_type": "rest_json",
  "source_system": "simblah_acct",
  "target_table": "vendor_master",
  "connection": {
    "base_url": "https://acct.simblah.in-ops.com:8445/api",
    "auth_type": "bearer_token",
    "auth_config": {
      "token": "{simblah_acct_token}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry_count": 3,
    "retry_backoff_ms": 1000
  },
  "source": {
    "endpoint": "/vendors",
    "method": "GET",
    "params": {
      "per_page": 100
    },
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size": 100
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "id", "target": "external_id", "transform": "to_string" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_acct" },
    { "source": "name", "target": "vendor_name" },
    { "source": "contact_info", "target": "contact_info" }
  ]
}
```

## Notes

### Demo System Characteristics
- **Tiny dataset**: ~12 POs, ~45 parts, ~10 vendors, ~18 locations. Full syncs complete in under a second. Ideal for testing the import pipeline end-to-end without scale concerns
- **Seeded data uses real part numbers**: Parts reference actual manufacturer models (Rosemount, Omega, Emerson). Part numbers like `0065C9164-0001` (Rosemount 848T) are realistic and useful for testing equipment cross-referencing
- **PO fulfillment side effect**: When a PO is fulfilled via `POST /api/purchase-orders/{id}/fulfill`, stock levels are atomically incremented. The next inventory sync will pick up the updated `total_stock` values
- **No `updated_at` field**: Same limitation as the Maintenance service. `date_opened` watermark only catches new POs, not status transitions. Run periodic full re-sync of `status=open` POs

### Vendor Contact Info Format
- The `contact_info` field is a pipe-delimited string: `email | phone | location` (e.g., `sales@emerson.com | 1-800-833-8314 | Houston TX`). If I/O needs structured vendor contact fields, parse on ` | ` delimiter

### Stock Level Enrichment
- The base `/api/inventory` endpoint returns `total_stock` (aggregate across all locations) but not per-location breakdown
- Per-location stock requires a secondary call: `GET /api/inventory/{id}/stock` returns a `locations[]` array with `location_id`, `location_name`, and `quantity`
- With only 45 parts and 18 locations, the secondary calls add negligible overhead

### Authentication Setup
- Use the `lnovak` account (`api_access` role, password `Refinery1!`) for Bearer token access
- Tokens are managed via the SimBLAH Accounting web UI at `https://acct.simblah.in-ops.com:8445` under Configuration → Users
- For development without nginx TLS: `http://localhost:3003/api`
