# Infor CloudSuite / EAM — ERP / Financial Connector Profile

## Application Overview

- **Vendor**: Infor (Koch Industries subsidiary)
- **Products**: Infor CloudSuite Industrial, Infor LN (full ERP), Infor EAM (formerly Datastream MP2/7i — maintenance-focused)
- **Market position**: Strong in midstream and downstream oil & gas, especially North America (~10-15% refinery market share). Koch Industries ownership means deep refinery domain understanding. Infor EAM is widely deployed for maintenance — often alongside SAP for finance.
- **Licensing**: API access via ION API Gateway is included with CloudSuite/EAM license. No per-call API cost.
- **Typical refinery deployment**: Infor EAM for maintenance and spare parts management, often paired with SAP or Oracle for financial functions. CloudSuite Industrial or LN covers full ERP at Infor-only sites. ION middleware handles all integration.

## API Surface

- **API type**: REST via ION API Gateway (primary), BOD messaging via ION Connect (event-driven), SOAP (legacy)
- **Base URL pattern**: `https://mingle-ionapi.inforcloudsuite.com/<TENANT>/`
- **Authentication**: OAuth 2.0 via ION API Gateway. Credentials bundled in `.ionapi` file (JSON containing endpoint URLs, client ID/secret, token URL, tenant ID).
- **Pagination**: `offset` and `limit` parameters. Varies by endpoint. Typical max 1000 per page.
- **Rate limits**: Tenant-specific. Default is generous for API gateway calls.
- **Data format**: JSON (REST), XML (BODs follow OAGIS standard)
- **BOD messaging**: Publish/subscribe model via ION Connect. Business Object Documents (e.g., `Sync.StockBalance`, `Process.PurchaseOrder`) push changes in near-real-time.
- **API documentation**: [Infor ION API Gateway](https://docs.infor.com/m3cs/latest/en-us/m3cslib/solution_overview_m3cloudsuite/zos1659093396395.html)

## Target Tables

| Priority | I/O Table | Infor Source Module |
|----------|-----------|---------------------|
| Primary | `inventory_items` | EAM (StockItems / StoreRoomParts) or SCM (Inventory) |
| Primary | `purchase_orders` | EAM or SCM (Purchasing) |
| Primary | `purchase_order_lines` | EAM or SCM (Purchasing) |
| Primary | `vendor_master` | EAM or SCM (Supplier Management) |
| Secondary | `cost_centers` | Financials (GL / Cost Management) |

## Field Mapping

### inventory_items

| I/O Column | Infor ION REST Field | Notes | Transform | Required |
|------------|---------------------|-------|-----------|----------|
| `external_id` | `StockCode` + `Warehouse` | Composite key | `{StockCode}_{Warehouse}` | Yes |
| `source_system` | — | — | Constant: `"infor_eam"` or `"infor_cloudsuite"` | Yes |
| `part_number` | `StockCode` | Infor stock code | Direct | Yes |
| `description` | `StockCodeDescription` | Part description | Direct | Yes |
| `quantity_on_hand` | `QuantityOnHand` | Unrestricted stock | Numeric | Yes |
| `quantity_reserved` | `QuantityReserved` | Reserved for work orders | Numeric | No |
| `quantity_available` | `QuantityAvailable` | May be provided directly | If null: `on_hand - reserved` | Auto |
| `reorder_point` | `ReorderPoint` | Min stock level | Numeric | No |
| `unit_cost` | `AverageCost` or `StandardCost` | Prefer average cost | Numeric | No |
| `currency` | `CurrencyCode` | ISO 4217 | Direct | No |
| `warehouse_id` | `Warehouse` | Infor warehouse code | Direct | No |
| `warehouse_name` | `WarehouseDescription` | Warehouse name | Direct | No |
| `bin_location` | `BinLocation` | Bin/shelf location | Direct | No |
| `last_receipt_date` | `LastReceiptDate` | Last goods receipt | ISO 8601 | No |
| `last_issue_date` | `LastIssueDate` | Last goods issue | ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"stock_type": StockType, "uom": UnitOfMeasure, "manufacturer": ManufacturerName, "manufacturer_part": ManufacturerPartNumber, "criticality": CriticalityCode, "abc_class": ABCClass}` | No |

**ION REST endpoints**: `/EAM/StockItems` (master), `/EAM/StoreRoomParts` (stock levels by warehouse)
**BOD alternative**: `Sync.StockBalance` pushes stock level changes

### purchase_orders

| I/O Column | Infor ION REST Field | Notes | Transform | Required |
|------------|---------------------|-------|-----------|----------|
| `external_id` | `PurchaseOrderNumber` | PO identifier | Direct | Yes |
| `source_system` | — | — | Constant: `"infor_eam"` or `"infor_cloudsuite"` | Yes |
| `po_number` | `PurchaseOrderNumber` | PO number | Direct | Yes |
| `status` | `PurchaseOrderStatus` | See normalization below | Infor status map | Yes |
| `vendor_id` | `SupplierCode` | FK to vendor_master | Vendor FK lookup | Yes |
| `vendor_name` | `SupplierName` | Vendor name | Direct | No |
| `order_date` | `OrderDate` | PO creation date | ISO 8601 | Yes |
| `expected_delivery_date` | `RequiredByDate` | Header-level or earliest line | ISO 8601 | No |
| `total_amount` | `TotalOrderValue` | PO total value | Numeric | No |
| `currency` | `CurrencyCode` | ISO 4217 | Direct | No |
| `created_by_name` | `CreatedBy` | User who created PO | Direct | No |
| `extra_data` | — | — | JSONB: `{"originator": Originator, "work_order_ref": WorkOrderNumber, "cost_center": CostCenter, "priority": Priority}` | No |

**ION REST endpoint**: `/EAM/PurchaseOrders` or `/SCM/PurchaseOrders`
**BOD alternative**: `Process.PurchaseOrder` pushes PO status changes

### purchase_order_lines

| I/O Column | Infor ION REST Field | Notes | Transform | Required |
|------------|---------------------|-------|-----------|----------|
| `purchase_order_id` | `PurchaseOrderNumber` | FK to purchase_orders | Parent FK lookup | Yes |
| `line_number` | `LineItemNumber` | Line sequence | Integer | Yes |
| `part_number` | `StockCode` | May be null for non-stock items | Direct | No |
| `description` | `LineItemDescription` | Line description | Direct | No |
| `quantity_ordered` | `QuantityOrdered` | Ordered qty | Numeric | Yes |
| `quantity_received` | `QuantityReceived` | Received qty | Numeric | No |
| `unit_price` | `UnitPrice` | Per-unit price | Numeric | No |
| `currency` | `CurrencyCode` | From PO header | ISO 4217 | No |
| `delivery_date` | `RequiredByDate` | Per-line delivery | ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"work_order_ref": WorkOrderNumber, "equipment_ref": EquipmentReference, "tax_code": TaxCode}` | No |

**ION REST endpoint**: Lines returned as child array on PO resource

### vendor_master

| I/O Column | Infor ION REST Field | Notes | Transform | Required |
|------------|---------------------|-------|-----------|----------|
| `external_id` | `SupplierCode` | Infor supplier code | Direct | Yes |
| `source_system` | — | — | Constant: `"infor_eam"` or `"infor_cloudsuite"` | Yes |
| `vendor_code` | `SupplierCode` | Supplier ID | Direct | Yes |
| `name` | `SupplierName` | Company name | Direct | Yes |
| `address` | `AddressLine1` | Street address | Direct | No |
| `city` | `City` | City | Direct | No |
| `state` | `StateProvince` | State/province | Direct | No |
| `country` | `CountryCode` | ISO 3166-1 | Direct | No |
| `contact_name` | `ContactName` | Primary contact | Direct | No |
| `contact_email` | `ContactEmail` | Email | Direct | No |
| `contact_phone` | `ContactPhone` | Phone | Direct | No |
| `payment_terms` | `PaymentTerms` | Payment terms code | Lookup to description | No |
| `lead_time_days` | `DefaultLeadTimeDays` | Standard lead time | Integer | No |
| `performance_rating` | `SupplierRating` | If available in EAM | Numeric (normalize to 0-100) | No |
| `extra_data` | — | — | JSONB: `{"supplier_type": SupplierType, "status": Status, "tax_id": TaxId, "currency": DefaultCurrency}` | No |

**ION REST endpoint**: `/EAM/Suppliers` or `/SCM/Suppliers`

### cost_centers

| I/O Column | Infor ION REST Field | Notes | Transform | Required |
|------------|---------------------|-------|-----------|----------|
| `external_id` | `CostCenterCode` | Cost center ID | Direct | Yes |
| `source_system` | — | — | Constant: `"infor_cloudsuite"` | Yes |
| `code` | `CostCenterCode` | Cost center code | Direct | Yes |
| `name` | `CostCenterDescription` | Name | Direct | Yes |
| `description` | `CostCenterDescription` | Same as name typically | Direct | No |
| `parent_id` | `ParentCostCenter` | Hierarchy parent | Self-ref FK lookup | No |
| `budget_amount` | `BudgetAmount` | If available via financials | Numeric | No |
| `currency` | `CurrencyCode` | ISO 4217 | Direct | No |
| `fiscal_year` | `FiscalYear` | Fiscal year | Integer | Yes |
| `extra_data` | — | — | JSONB: `{"company": CompanyCode, "department": Department, "responsible_person": ResponsiblePerson}` | No |

**ION REST endpoint**: `/Financials/CostCenters` or GL segment values

## PO Status Normalization

### Infor EAM

| Infor EAM `PurchaseOrderStatus` | I/O Status |
|---------------------------------|------------|
| `Created` / `Pending Approval` | `draft` |
| `Approved` | `approved` |
| `Issued` / `Sent to Supplier` | `ordered` |
| `Partially Received` | `partially_received` |
| `Fully Received` / `Received` | `received` |
| `Closed` / `Complete` | `closed` |
| `Cancelled` / `Rejected` | `cancelled` |

### Infor CloudSuite / LN

| Infor LN PO Status | I/O Status |
|--------------------|------------|
| `Free` (not yet approved) | `draft` |
| `Approved` | `approved` |
| `Printed` / `Confirmed` (sent to vendor) | `ordered` |
| Partial receipt (check line-level receipts) | `partially_received` |
| All lines received | `received` |
| `Closed` | `closed` |
| `Blocked` / `Cancelled` | `cancelled` |

**Implementation note**: Infor EAM typically provides a cleaner PO status than SAP. The `PurchaseOrderStatus` field usually maps directly without needing multi-field derivation.

## Sync Strategy

| Target Table | Interval | Method | Watermark |
|-------------|----------|--------|-----------|
| `inventory_items` (master) | 24 hours | Full sync via REST | `LastModifiedDate` |
| `inventory_items` (stock levels) | 60 minutes (poll) + BOD push | `Sync.StockBalance` BOD for real-time, REST poll as backup | `LastModifiedDate` |
| `purchase_orders` + lines | 15 minutes (poll) + BOD push | `Process.PurchaseOrder` BOD for changes, REST poll as backup | `LastModifiedDate` |
| `vendor_master` | 7 days | Full sync via REST | `LastModifiedDate` |
| `cost_centers` | 24 hours | Full sync | None |

**BOD integration**: If the customer has ION Connect configured, I/O can subscribe to BODs for near-real-time updates. This is the preferred Infor integration pattern and should be offered as an option in the import wizard alongside standard polling.

**BOD subscription setup**: Requires ION Desk configuration on the Infor side — a connection point for I/O that subscribes to relevant BOD topics. I/O's Import Service exposes an HTTP endpoint to receive BOD webhook callbacks.

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "rest_json",
  "name": "Infor CloudSuite / EAM",
  "connection": {
    "base_url": "https://mingle-ionapi.inforcloudsuite.com/${INFOR_TENANT}/",
    "auth_type": "oauth2_client_credentials",
    "auth_config": {
      "client_id": "${INFOR_CLIENT_ID}",
      "client_secret": "${INFOR_CLIENT_SECRET}",
      "token_url": "https://mingle-sso.inforcloudsuite.com/${INFOR_TENANT}/as/token.oauth2"
    },
    "tls": {
      "verify_server_cert": true
    },
    "timeout_seconds": 60,
    "max_retries": 3,
    "ionapi_file_upload": true
  }
}
```

**`.ionapi` file support**: The import wizard should accept a `.ionapi` file upload for one-click configuration. The `.ionapi` file is a JSON file containing `ci` (client ID), `cs` (client secret), `iu` (ION API URL), `pu` (token URL), and `oa` (OAuth authority). Parsing this file auto-fills the connection config.

### Import Definitions

```json
[
  {
    "name": "Infor Inventory Items",
    "source_system": "infor_eam",
    "target_table": "inventory_items",
    "schedule": {
      "stock_levels": { "cron": "0 * * * *", "type": "incremental" },
      "master": { "cron": "0 2 * * *", "type": "full" }
    },
    "source_config": {
      "master_endpoint": "EAM/StockItems",
      "stock_endpoint": "EAM/StoreRoomParts",
      "join_key": "StockCode",
      "query_params": {
        "warehouse": "${WAREHOUSE_CODE}"
      },
      "watermark_column": "LastModifiedDate",
      "bod_subscription": {
        "enabled": false,
        "bod_name": "Sync.StockBalance",
        "callback_path": "/api/v1/import/webhook/infor/stock-balance"
      }
    },
    "field_mapping": [
      { "source": "StockCode+Warehouse", "target": "external_id", "transform": "composite_key", "separator": "_" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "infor_eam" },
      { "source": "StockCode", "target": "part_number", "transform": "direct" },
      { "source": "StockCodeDescription", "target": "description", "transform": "direct" },
      { "source": "QuantityOnHand", "target": "quantity_on_hand", "transform": "to_decimal" },
      { "source": "QuantityReserved", "target": "quantity_reserved", "transform": "to_decimal" },
      { "source": "QuantityAvailable", "target": "quantity_available", "transform": "to_decimal_or_calculate" },
      { "source": "ReorderPoint", "target": "reorder_point", "transform": "to_decimal" },
      { "source": "AverageCost", "target": "unit_cost", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "Warehouse", "target": "warehouse_id", "transform": "direct" },
      { "source": "WarehouseDescription", "target": "warehouse_name", "transform": "direct" },
      { "source": "BinLocation", "target": "bin_location", "transform": "direct" },
      { "source": "LastReceiptDate", "target": "last_receipt_date", "transform": "direct" },
      { "source": "LastIssueDate", "target": "last_issue_date", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "StockType", "key": "stock_type" },
      { "source": "UnitOfMeasure", "key": "uom" },
      { "source": "ManufacturerName", "key": "manufacturer" },
      { "source": "ManufacturerPartNumber", "key": "manufacturer_part" },
      { "source": "CriticalityCode", "key": "criticality" },
      { "source": "ABCClass", "key": "abc_class" }
    ]
  },
  {
    "name": "Infor Purchase Orders",
    "source_system": "infor_eam",
    "target_table": "purchase_orders",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "endpoint": "EAM/PurchaseOrders",
      "query_params": {},
      "watermark_column": "LastModifiedDate",
      "bod_subscription": {
        "enabled": false,
        "bod_name": "Process.PurchaseOrder",
        "callback_path": "/api/v1/import/webhook/infor/purchase-order"
      }
    },
    "field_mapping": [
      { "source": "PurchaseOrderNumber", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "infor_eam" },
      { "source": "PurchaseOrderNumber", "target": "po_number", "transform": "direct" },
      { "source": "PurchaseOrderStatus", "target": "status", "transform": "infor_eam_po_status" },
      { "source": "SupplierCode", "target": "vendor_id", "transform": "vendor_fk_lookup" },
      { "source": "SupplierName", "target": "vendor_name", "transform": "direct" },
      { "source": "OrderDate", "target": "order_date", "transform": "direct" },
      { "source": "RequiredByDate", "target": "expected_delivery_date", "transform": "direct" },
      { "source": "TotalOrderValue", "target": "total_amount", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "CreatedBy", "target": "created_by_name", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "Originator", "key": "originator" },
      { "source": "WorkOrderNumber", "key": "work_order_ref" },
      { "source": "CostCenter", "key": "cost_center" },
      { "source": "Priority", "key": "priority" }
    ]
  },
  {
    "name": "Infor Purchase Order Lines",
    "source_system": "infor_eam",
    "target_table": "purchase_order_lines",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "note": "Lines returned as child array on PO resource. Processed in same sync run as purchase_orders.",
      "parent_endpoint": "EAM/PurchaseOrders",
      "child_path": "LineItems"
    },
    "field_mapping": [
      { "source": "PurchaseOrderNumber", "target": "purchase_order_id", "transform": "parent_fk_lookup" },
      { "source": "LineItemNumber", "target": "line_number", "transform": "to_integer" },
      { "source": "StockCode", "target": "part_number", "transform": "direct" },
      { "source": "LineItemDescription", "target": "description", "transform": "direct" },
      { "source": "QuantityOrdered", "target": "quantity_ordered", "transform": "to_decimal" },
      { "source": "QuantityReceived", "target": "quantity_received", "transform": "to_decimal" },
      { "source": "UnitPrice", "target": "unit_price", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "RequiredByDate", "target": "delivery_date", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "WorkOrderNumber", "key": "work_order_ref" },
      { "source": "EquipmentReference", "key": "equipment_ref" },
      { "source": "TaxCode", "key": "tax_code" }
    ]
  },
  {
    "name": "Infor Vendor Master",
    "source_system": "infor_eam",
    "target_table": "vendor_master",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "endpoint": "EAM/Suppliers",
      "query_params": {
        "status": "Active"
      },
      "watermark_column": "LastModifiedDate"
    },
    "field_mapping": [
      { "source": "SupplierCode", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "infor_eam" },
      { "source": "SupplierCode", "target": "vendor_code", "transform": "direct" },
      { "source": "SupplierName", "target": "name", "transform": "direct" },
      { "source": "AddressLine1", "target": "address", "transform": "direct" },
      { "source": "City", "target": "city", "transform": "direct" },
      { "source": "StateProvince", "target": "state", "transform": "direct" },
      { "source": "CountryCode", "target": "country", "transform": "direct" },
      { "source": "ContactName", "target": "contact_name", "transform": "direct" },
      { "source": "ContactEmail", "target": "contact_email", "transform": "direct" },
      { "source": "ContactPhone", "target": "contact_phone", "transform": "direct" },
      { "source": "PaymentTerms", "target": "payment_terms", "transform": "infor_payment_terms_lookup" },
      { "source": "DefaultLeadTimeDays", "target": "lead_time_days", "transform": "to_integer" },
      { "source": "SupplierRating", "target": "performance_rating", "transform": "normalize_to_100" }
    ],
    "extra_data_mapping": [
      { "source": "SupplierType", "key": "supplier_type" },
      { "source": "TaxId", "key": "tax_id" },
      { "source": "DefaultCurrency", "key": "currency" }
    ]
  },
  {
    "name": "Infor Cost Centers",
    "source_system": "infor_cloudsuite",
    "target_table": "cost_centers",
    "schedule": { "cron": "0 3 * * *", "type": "full" },
    "source_config": {
      "endpoint": "Financials/CostCenters",
      "query_params": {
        "fiscalYear": "${FISCAL_YEAR}"
      },
      "watermark_column": null
    },
    "field_mapping": [
      { "source": "CostCenterCode", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "infor_cloudsuite" },
      { "source": "CostCenterCode", "target": "code", "transform": "direct" },
      { "source": "CostCenterDescription", "target": "name", "transform": "direct" },
      { "source": "CostCenterDescription", "target": "description", "transform": "direct" },
      { "source": "ParentCostCenter", "target": "parent_id", "transform": "self_ref_fk_lookup" },
      { "source": "BudgetAmount", "target": "budget_amount", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "FiscalYear", "target": "fiscal_year", "transform": "to_integer" }
    ],
    "extra_data_mapping": [
      { "source": "CompanyCode", "key": "company" },
      { "source": "Department", "key": "department" },
      { "source": "ResponsiblePerson", "key": "responsible_person" }
    ]
  }
]
```

### Custom Transforms

| Transform ID | Description |
|-------------|-------------|
| `infor_eam_po_status` | Map Infor EAM `PurchaseOrderStatus` to I/O normalized status |
| `infor_ln_po_status` | Map Infor LN PO status to I/O normalized status |
| `infor_payment_terms_lookup` | Map Infor payment terms codes to human-readable strings |
| `normalize_to_100` | Scale Infor's supplier rating to 0-100 range |
| `vendor_fk_lookup` | Resolve `SupplierCode` to `vendor_master.id` FK |
| `parent_fk_lookup` | Resolve `PurchaseOrderNumber` to `purchase_orders.id` FK |
| `self_ref_fk_lookup` | Resolve parent cost center to `cost_centers.id` self-reference |
| `to_decimal_or_calculate` | Use source value if present; otherwise calculate from `on_hand - reserved` |
| `composite_key` | Concatenate multiple fields with separator |

## Notes

- **`.ionapi` file import**: The I/O import wizard should accept a `.ionapi` file upload for one-click connection setup. This JSON file bundles the ION API URL, OAuth credentials, and tenant info. Parsing it fills all connection fields automatically.
- **Dual-ERP scenario**: Infor EAM is frequently deployed alongside SAP (SAP for finance, Infor for maintenance/inventory). I/O supports this via separate import definitions with different `source_system` values. The admin configures which system is authoritative for each data type.
- **BOD messaging**: BOD-based push integration is the preferred Infor pattern for near-real-time updates. If the customer has ION Connect configured, subscribing to BODs avoids polling overhead. I/O's Import Service exposes webhook endpoints for BOD callbacks. The import wizard should offer a toggle: "Enable BOD push (requires ION Desk configuration on Infor side)" vs "Polling only".
- **OAGIS standard**: BOD messages follow the OAGIS (Open Applications Group Integration Specification) XML schema. If I/O already supports Ellipse OAGIS BODs, the same parsing logic applies to Infor BODs.
- **EAM vs CloudSuite field names**: Infor EAM and CloudSuite Industrial/LN have different field names for similar concepts. The import wizard should offer separate presets: "Infor EAM" and "Infor CloudSuite/LN".
- **Koch Industries connection**: Infor's refinery domain expertise means their data models map well to I/O's target tables. Less transformation needed compared to SAP.
- **Maintenance-first data**: In EAM deployments, spare parts and PO data is maintenance-centric. Work order references on PO lines are common and valuable for I/O's equipment cost correlation use case. These are captured in `extra_data`.
- **I/O is strictly read-only**: No write-back to Infor. PO creation, inventory transactions, and work orders remain in Infor.
