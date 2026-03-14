# Hitachi Energy Ellipse EAM — ERP / Financial Connector Profile

## Application Overview

- **Vendor**: Hitachi Energy (formerly ABB)
- **Product**: Ellipse EAM (Enterprise Asset Management), versions 8.x+
- **Market position**: Very common in Australian, Asian, and Middle Eastern refineries and utilities. Maintenance-focused EAM, not a full ERP — handles work orders, spare parts inventory, and maintenance procurement. Often deployed alongside SAP or Oracle for financial functions. Recently rebranded under Hitachi Energy after the ABB power grids acquisition.
- **Licensing**: EIP (Ellipse Integration Platform) API access is included with the Ellipse license. No additional per-call cost.
- **Typical refinery deployment**: Ellipse manages maintenance work orders, spare parts inventory, and maintenance-related POs. Financial data (GL, cost center budgets) typically resides in a companion ERP (SAP FI/CO or Oracle GL). Ellipse is the primary source for parts inventory and maintenance procurement.

## API Surface

- **API type**: SOAP Web Services via EIP (primary, mature), REST API (versions 8.9+, less complete), JMS messaging (event-driven)
- **Base URL pattern**:
  - SOAP: `https://<ellipse-host>/ews/services/<ServiceName>`
  - REST: `https://<ellipse-host>/api/v1/<resource>`
  - WSDL: `https://<ellipse-host>/ews/services/<ServiceName>?wsdl`
- **Authentication**:
  - Basic Auth (SOAP — most common)
  - OAuth 2.0 (REST API on newer versions)
  - API keys (simpler REST integrations)
- **Pagination**: SOAP uses `maxInstances` and `restartKey` pattern. REST uses `offset` and `limit`.
- **Rate limits**: Not formally documented. Ellipse web services are typically deployed behind a customer-managed gateway.
- **Data format**: XML (SOAP/EIP), JSON (REST), CSV (batch exports)
- **OAGIS BODs**: Ellipse supports OAGIS-standard Business Object Documents for event-driven integration, similar to Infor ION
- **API documentation**: [Ellipse Integration Platform SDK](https://dev-n01-pro.ellipsehosting.com/onlinehelp/en_AU/overview_sdk.htm)

## Target Tables

| Priority | I/O Table | Ellipse Source Module |
|----------|-----------|----------------------|
| Primary | `inventory_items` | Materials / Inventory (Stock Codes) |
| Primary | `purchase_orders` | Purchasing |
| Primary | `purchase_order_lines` | Purchasing |
| Primary | `vendor_master` | Purchasing (Supplier Management) |
| Secondary | `cost_centers` | Finance (basic — usually defers to companion ERP) |

## Field Mapping

### inventory_items

| I/O Column | Ellipse SOAP / REST Field | Notes | Transform | Required |
|------------|--------------------------|-------|-----------|----------|
| `external_id` | `stockCode` + `warehouse` | Composite key | `{stockCode}_{warehouseId}` | Yes |
| `source_system` | — | — | Constant: `"ellipse_eam"` | Yes |
| `part_number` | `stockCode` | Ellipse stock code identifier | Direct | Yes |
| `description` | `stockCodeDescription1` + `stockCodeDescription2` | Two description lines, concatenate | Concatenate with space | Yes |
| `quantity_on_hand` | `quantityInStock` | From `retrieveStockOnHand` | Numeric | Yes |
| `quantity_reserved` | `quantityReserved` | Reserved for work orders | Numeric | No |
| `quantity_available` | `quantityAvailable` | May be provided directly | If null: `on_hand - reserved` | Auto |
| `reorder_point` | `reorderPoint` or `minimumQuantity` | Min stock level | Numeric | No |
| `unit_cost` | `averageUnitCost` or `lastPurchasePrice` | Prefer average cost | Numeric | No |
| `currency` | `currencyType` | ISO 4217 | Direct | No |
| `warehouse_id` | `warehouseId` | Ellipse warehouse code | Direct | No |
| `warehouse_name` | `warehouseDescription` | Warehouse name | Direct | No |
| `bin_location` | `binCode` | Bin/shelf location | Direct | No |
| `last_receipt_date` | `lastReceiptDate` | Last goods receipt | Parse Ellipse date | No |
| `last_issue_date` | `lastIssueDate` | Last goods issue | Parse Ellipse date | No |
| `extra_data` | — | — | JSONB: `{"stock_type": stockType, "uom": unitOfMeasure, "manufacturer": manufacturerName, "manufacturer_part": manufacturerPartNumber, "abc_class": inventoryCategory, "criticality": criticalityIndicator, "lead_time_days": normalLeadTime}` | No |

**SOAP service**: `StockCodeService.retrieveStockCode` (master), `StockCodeService.retrieveStockOnHand` (stock levels)
**REST alternative**: `/api/v1/stockcodes`, `/api/v1/stockcodes/{id}/onhand`

### purchase_orders

| I/O Column | Ellipse SOAP / REST Field | Notes | Transform | Required |
|------------|--------------------------|-------|-----------|----------|
| `external_id` | `purchaseOrderNumber` | PO identifier | Direct | Yes |
| `source_system` | — | — | Constant: `"ellipse_eam"` | Yes |
| `po_number` | `purchaseOrderNumber` | PO number | Direct | Yes |
| `status` | `purchaseOrderStatus` | See normalization below | Ellipse status map | Yes |
| `vendor_id` | `supplierNumber` | FK to vendor_master | Vendor FK lookup | Yes |
| `vendor_name` | `supplierName` | Vendor name | Direct | No |
| `order_date` | `orderDate` | PO creation date | Parse Ellipse date | Yes |
| `expected_delivery_date` | `requiredByDate` or `deliveryDate` | Header-level or earliest line | Parse Ellipse date | No |
| `total_amount` | `totalOrderValue` | PO total value | Numeric | No |
| `currency` | `currencyType` | ISO 4217 | Direct | No |
| `created_by_name` | `createdBy` | User who created PO | Direct | No |
| `extra_data` | — | — | JSONB: `{"district": districtCode, "originator": originatorId, "work_order_ref": workOrderNumber, "requisition_ref": requisitionNumber, "cost_center": costCentre, "priority": priorityCode}` | No |

**SOAP service**: `PurchasingService.retrievePurchaseOrder`, `PurchasingService.searchPurchaseOrders`
**REST alternative**: `/api/v1/purchaseorders`

### purchase_order_lines

| I/O Column | Ellipse SOAP / REST Field | Notes | Transform | Required |
|------------|--------------------------|-------|-----------|----------|
| `purchase_order_id` | `purchaseOrderNumber` | FK to purchase_orders | Parent FK lookup | Yes |
| `line_number` | `purchaseOrderItemNumber` | Line sequence (typically 001, 002...) | To integer | Yes |
| `part_number` | `stockCode` | May be null for non-stock items | Direct | No |
| `description` | `itemDescription1` + `itemDescription2` | Two description lines | Concatenate with space | No |
| `quantity_ordered` | `quantityOrdered` | Ordered qty | Numeric | Yes |
| `quantity_received` | `quantityReceived` | Received qty from goods receipts | Numeric | No |
| `unit_price` | `unitPrice` or `estimatedPrice` | Per-unit price | Numeric | No |
| `currency` | `currencyType` | From PO header | ISO 4217 | No |
| `delivery_date` | `requiredByDate` | Per-line delivery date | Parse Ellipse date | No |
| `extra_data` | — | — | JSONB: `{"work_order_ref": workOrderNumber, "equipment_ref": equipmentReference, "account_code": accountCode, "delivery_location": deliveryLocation}` | No |

**SOAP service**: Line items returned as child elements of `retrievePurchaseOrder` response
**REST alternative**: `/api/v1/purchaseorders/{id}/items`

### vendor_master

| I/O Column | Ellipse SOAP / REST Field | Notes | Transform | Required |
|------------|--------------------------|-------|-----------|----------|
| `external_id` | `supplierNumber` | Ellipse supplier code | Direct | Yes |
| `source_system` | — | — | Constant: `"ellipse_eam"` | Yes |
| `vendor_code` | `supplierNumber` | Supplier ID | Direct | Yes |
| `name` | `supplierName` | Company name | Direct | Yes |
| `address` | `addressLine1` | Street address | Direct | No |
| `city` | `city` | City | Direct | No |
| `state` | `stateProvince` | State/province | Direct | No |
| `country` | `countryCode` | ISO 3166-1 | Direct | No |
| `contact_name` | `contactName` | Primary contact | Direct | No |
| `contact_email` | `emailAddress` | Email | Direct | No |
| `contact_phone` | `phoneNumber` | Phone | Direct | No |
| `payment_terms` | `paymentTerms` | Payment terms code | Lookup to description | No |
| `lead_time_days` | `defaultLeadTime` | Standard lead time | Integer | No |
| `performance_rating` | `supplierRating` | If available (version-dependent) | Numeric | No |
| `extra_data` | — | — | JSONB: `{"district": districtCode, "supplier_type": supplierType, "status": supplierStatus, "tax_id": taxNumber, "currency": defaultCurrency}` | No |

**SOAP service**: `SupplierService.retrieveSupplier`, `SupplierService.searchSuppliers`
**REST alternative**: `/api/v1/suppliers`

### cost_centers

| I/O Column | Ellipse SOAP / REST Field | Notes | Transform | Required |
|------------|--------------------------|-------|-----------|----------|
| `external_id` | `costCentre` | Ellipse cost centre code | Direct | Yes |
| `source_system` | — | — | Constant: `"ellipse_eam"` | Yes |
| `code` | `costCentre` | Cost centre code | Direct | Yes |
| `name` | `costCentreDescription` | Name | Direct | Yes |
| `description` | `costCentreDescription` | Same as name in Ellipse | Direct | No |
| `parent_id` | `parentCostCentre` | Parent in hierarchy | Self-ref FK lookup | No |
| `budget_amount` | — | Typically not in Ellipse — use companion ERP | Null | No |
| `currency` | `currencyType` | ISO 4217 | Direct | No |
| `fiscal_year` | `financialYear` | Fiscal year | Integer | Yes |
| `extra_data` | — | — | JSONB: `{"district": districtCode, "department": departmentCode, "responsible_person": responsiblePerson}` | No |

**SOAP service**: Cost centre data via `TableService` or `AccountService`
**REST alternative**: `/api/v1/costcentres`

**Note**: Ellipse's cost centre data is typically limited compared to a full ERP. If the site runs SAP or Oracle for finance, cost centre data should come from the financial ERP, not Ellipse. The Ellipse cost centre connector is provided for sites where Ellipse is the only system.

## PO Status Normalization

| Ellipse `purchaseOrderStatus` | I/O Status |
|-------------------------------|------------|
| `OP` (Open / Created) | `draft` |
| `AU` (Authorized / Approved) | `approved` |
| `PR` (Printed / Sent to Supplier) | `ordered` |
| `PA` (Partially Arrived / Partially Received) | `partially_received` |
| `AR` (Arrived / Fully Received) | `received` |
| `CL` (Closed) | `closed` |
| `CN` (Cancelled) | `cancelled` |
| `HO` (On Hold) | `approved` (with `extra_data.on_hold: true`) |
| `RE` (Rejected) | `cancelled` |

**Implementation note**: Ellipse uses 2-character status codes. The mapping is straightforward — Ellipse's PO status is more direct than SAP's multi-field approach. However, the `PA` (partially received) status may not exist in older Ellipse versions — in that case, check line-level receipt quantities.

## Sync Strategy

| Target Table | Interval | Method | Watermark |
|-------------|----------|--------|-----------|
| `inventory_items` (stock codes) | 24 hours | Full sync via `searchStockCodes` | `lastModifiedDate` (if available) |
| `inventory_items` (stock on hand) | 60 minutes | `retrieveStockOnHand` for tracked items | `lastModifiedDate` |
| `purchase_orders` + lines | 15 minutes | `searchPurchaseOrders` with date filter | `lastModifiedDate` or `statusChangeDate` |
| `vendor_master` | 7 days | Full sync via `searchSuppliers` | `lastModifiedDate` |
| `cost_centers` | 7 days | Full sync | None (small dataset) |

**SOAP search pattern**: Ellipse's SOAP `search*` operations accept filter criteria including date ranges. Use `lastModifiedDate > {watermark}` for incremental sync. If `lastModifiedDate` is not available on the entity, fall back to full sync with hash-based change detection.

**JMS integration**: Ellipse supports JMS topic-based messaging for event-driven updates. However, this requires a JMS client in the Import Service (or an HTTP bridge). For most deployments, REST/SOAP polling is simpler and sufficient. JMS should be offered as an advanced option for high-frequency stock level updates.

**Batch exports**: For initial load, Ellipse supports CSV batch exports via scheduled reports or the EIP file adapter. The I/O import wizard can accept these CSV files as an alternative to API-based initial sync.

## Pre-Built Import Definition

### Connection Config (SOAP — Primary)

```json
{
  "connector_type": "soap_xml",
  "name": "Hitachi Ellipse EAM (SOAP)",
  "connection": {
    "base_url": "https://${ELLIPSE_HOST}/ews/services/",
    "auth_type": "basic",
    "auth_config": {
      "username": "${ELLIPSE_USERNAME}",
      "password": "${ELLIPSE_PASSWORD}",
      "district": "${ELLIPSE_DISTRICT}"
    },
    "tls": {
      "verify_server_cert": true,
      "ca_cert_path": null
    },
    "timeout_seconds": 120,
    "max_retries": 3,
    "soap_config": {
      "wsdl_cache": true,
      "xml_parser": "quick-xml"
    }
  }
}
```

### Connection Config (REST — Newer Versions)

```json
{
  "connector_type": "rest_json",
  "name": "Hitachi Ellipse EAM (REST)",
  "connection": {
    "base_url": "https://${ELLIPSE_HOST}/api/v1/",
    "auth_type": "oauth2_client_credentials",
    "auth_config": {
      "client_id": "${ELLIPSE_CLIENT_ID}",
      "client_secret": "${ELLIPSE_CLIENT_SECRET}",
      "token_url": "https://${ELLIPSE_HOST}/oauth2/token"
    },
    "tls": {
      "verify_server_cert": true
    },
    "timeout_seconds": 60,
    "max_retries": 3
  }
}
```

### Import Definitions

```json
[
  {
    "name": "Ellipse Inventory Items",
    "source_system": "ellipse_eam",
    "target_table": "inventory_items",
    "schedule": {
      "stock_levels": { "cron": "0 * * * *", "type": "incremental" },
      "master": { "cron": "0 2 * * *", "type": "full" }
    },
    "source_config": {
      "master_operation": {
        "service": "StockCodeService",
        "operation": "searchStockCodes",
        "filter": { "districtCode": "${DISTRICT}", "stockType": "INV" }
      },
      "stock_operation": {
        "service": "StockCodeService",
        "operation": "retrieveStockOnHand",
        "filter": { "warehouseId": "${WAREHOUSE}" }
      },
      "join_key": "stockCode",
      "watermark_column": "lastModifiedDate",
      "pagination": {
        "max_instances": 500,
        "use_restart_key": true
      }
    },
    "field_mapping": [
      { "source": "stockCode+warehouseId", "target": "external_id", "transform": "composite_key", "separator": "_" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "ellipse_eam" },
      { "source": "stockCode", "target": "part_number", "transform": "direct" },
      { "source": "stockCodeDescription1+stockCodeDescription2", "target": "description", "transform": "concatenate", "separator": " " },
      { "source": "quantityInStock", "target": "quantity_on_hand", "transform": "to_decimal" },
      { "source": "quantityReserved", "target": "quantity_reserved", "transform": "to_decimal" },
      { "source": "quantityAvailable", "target": "quantity_available", "transform": "to_decimal_or_calculate" },
      { "source": "reorderPoint", "target": "reorder_point", "transform": "to_decimal" },
      { "source": "averageUnitCost", "target": "unit_cost", "transform": "to_decimal" },
      { "source": "currencyType", "target": "currency", "transform": "direct" },
      { "source": "warehouseId", "target": "warehouse_id", "transform": "direct" },
      { "source": "warehouseDescription", "target": "warehouse_name", "transform": "direct" },
      { "source": "binCode", "target": "bin_location", "transform": "direct" },
      { "source": "lastReceiptDate", "target": "last_receipt_date", "transform": "ellipse_date_to_iso8601" },
      { "source": "lastIssueDate", "target": "last_issue_date", "transform": "ellipse_date_to_iso8601" }
    ],
    "extra_data_mapping": [
      { "source": "stockType", "key": "stock_type" },
      { "source": "unitOfMeasure", "key": "uom" },
      { "source": "manufacturerName", "key": "manufacturer" },
      { "source": "manufacturerPartNumber", "key": "manufacturer_part" },
      { "source": "inventoryCategory", "key": "abc_class" },
      { "source": "criticalityIndicator", "key": "criticality" },
      { "source": "normalLeadTime", "key": "lead_time_days" }
    ]
  },
  {
    "name": "Ellipse Purchase Orders",
    "source_system": "ellipse_eam",
    "target_table": "purchase_orders",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "service": "PurchasingService",
      "operation": "searchPurchaseOrders",
      "filter": {
        "districtCode": "${DISTRICT}",
        "lastModifiedDate": "${WATERMARK}"
      },
      "watermark_column": "lastModifiedDate",
      "detail_operation": "retrievePurchaseOrder",
      "pagination": {
        "max_instances": 200,
        "use_restart_key": true
      }
    },
    "field_mapping": [
      { "source": "purchaseOrderNumber", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "ellipse_eam" },
      { "source": "purchaseOrderNumber", "target": "po_number", "transform": "direct" },
      { "source": "purchaseOrderStatus", "target": "status", "transform": "ellipse_po_status" },
      { "source": "supplierNumber", "target": "vendor_id", "transform": "vendor_fk_lookup" },
      { "source": "supplierName", "target": "vendor_name", "transform": "direct" },
      { "source": "orderDate", "target": "order_date", "transform": "ellipse_date_to_iso8601" },
      { "source": "requiredByDate", "target": "expected_delivery_date", "transform": "ellipse_date_to_iso8601" },
      { "source": "totalOrderValue", "target": "total_amount", "transform": "to_decimal" },
      { "source": "currencyType", "target": "currency", "transform": "direct" },
      { "source": "createdBy", "target": "created_by_name", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "districtCode", "key": "district" },
      { "source": "originatorId", "key": "originator" },
      { "source": "workOrderNumber", "key": "work_order_ref" },
      { "source": "requisitionNumber", "key": "requisition_ref" },
      { "source": "costCentre", "key": "cost_center" },
      { "source": "priorityCode", "key": "priority" }
    ]
  },
  {
    "name": "Ellipse Purchase Order Lines",
    "source_system": "ellipse_eam",
    "target_table": "purchase_order_lines",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "note": "Line items returned as child elements of retrievePurchaseOrder SOAP response. Processed in same sync run as purchase_orders.",
      "parent_service": "PurchasingService",
      "parent_operation": "retrievePurchaseOrder",
      "child_element": "purchaseOrderItem"
    },
    "field_mapping": [
      { "source": "purchaseOrderNumber", "target": "purchase_order_id", "transform": "parent_fk_lookup" },
      { "source": "purchaseOrderItemNumber", "target": "line_number", "transform": "to_integer" },
      { "source": "stockCode", "target": "part_number", "transform": "direct" },
      { "source": "itemDescription1+itemDescription2", "target": "description", "transform": "concatenate", "separator": " " },
      { "source": "quantityOrdered", "target": "quantity_ordered", "transform": "to_decimal" },
      { "source": "quantityReceived", "target": "quantity_received", "transform": "to_decimal" },
      { "source": "unitPrice", "target": "unit_price", "transform": "to_decimal" },
      { "source": "currencyType", "target": "currency", "transform": "direct" },
      { "source": "requiredByDate", "target": "delivery_date", "transform": "ellipse_date_to_iso8601" }
    ],
    "extra_data_mapping": [
      { "source": "workOrderNumber", "key": "work_order_ref" },
      { "source": "equipmentReference", "key": "equipment_ref" },
      { "source": "accountCode", "key": "account_code" },
      { "source": "deliveryLocation", "key": "delivery_location" }
    ]
  },
  {
    "name": "Ellipse Vendor Master",
    "source_system": "ellipse_eam",
    "target_table": "vendor_master",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "service": "SupplierService",
      "operation": "searchSuppliers",
      "filter": {
        "districtCode": "${DISTRICT}",
        "supplierStatus": "A"
      },
      "watermark_column": "lastModifiedDate",
      "pagination": {
        "max_instances": 500,
        "use_restart_key": true
      }
    },
    "field_mapping": [
      { "source": "supplierNumber", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "ellipse_eam" },
      { "source": "supplierNumber", "target": "vendor_code", "transform": "direct" },
      { "source": "supplierName", "target": "name", "transform": "direct" },
      { "source": "addressLine1", "target": "address", "transform": "direct" },
      { "source": "city", "target": "city", "transform": "direct" },
      { "source": "stateProvince", "target": "state", "transform": "direct" },
      { "source": "countryCode", "target": "country", "transform": "direct" },
      { "source": "contactName", "target": "contact_name", "transform": "direct" },
      { "source": "emailAddress", "target": "contact_email", "transform": "direct" },
      { "source": "phoneNumber", "target": "contact_phone", "transform": "direct" },
      { "source": "paymentTerms", "target": "payment_terms", "transform": "ellipse_payment_terms_lookup" },
      { "source": "defaultLeadTime", "target": "lead_time_days", "transform": "to_integer" },
      { "source": "supplierRating", "target": "performance_rating", "transform": "to_decimal" }
    ],
    "extra_data_mapping": [
      { "source": "districtCode", "key": "district" },
      { "source": "supplierType", "key": "supplier_type" },
      { "source": "taxNumber", "key": "tax_id" },
      { "source": "defaultCurrency", "key": "currency" }
    ]
  },
  {
    "name": "Ellipse Cost Centres",
    "source_system": "ellipse_eam",
    "target_table": "cost_centers",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "service": "TableService",
      "operation": "retrieveCostCentre",
      "note": "Cost centre data in Ellipse is limited. For full budget data, use companion ERP (SAP/Oracle).",
      "filter": {
        "districtCode": "${DISTRICT}"
      },
      "watermark_column": null
    },
    "field_mapping": [
      { "source": "costCentre", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "ellipse_eam" },
      { "source": "costCentre", "target": "code", "transform": "direct" },
      { "source": "costCentreDescription", "target": "name", "transform": "direct" },
      { "source": "costCentreDescription", "target": "description", "transform": "direct" },
      { "source": "parentCostCentre", "target": "parent_id", "transform": "self_ref_fk_lookup" },
      { "source": null, "target": "budget_amount", "transform": "null" },
      { "source": "currencyType", "target": "currency", "transform": "direct" },
      { "source": "financialYear", "target": "fiscal_year", "transform": "to_integer" }
    ],
    "extra_data_mapping": [
      { "source": "districtCode", "key": "district" },
      { "source": "departmentCode", "key": "department" },
      { "source": "responsiblePerson", "key": "responsible_person" }
    ]
  }
]
```

### Custom Transforms

| Transform ID | Description |
|-------------|-------------|
| `ellipse_date_to_iso8601` | Parse Ellipse date format (`YYYYMMDD` or `YYYY-MM-DD`) to ISO 8601 timestamp |
| `ellipse_po_status` | Map Ellipse 2-char PO status codes (OP, AU, PR, PA, AR, CL, CN) to I/O normalized status |
| `ellipse_payment_terms_lookup` | Map Ellipse payment terms codes to human-readable strings |
| `concatenate` | Join multiple SOAP response fields with separator |
| `vendor_fk_lookup` | Resolve `supplierNumber` to `vendor_master.id` FK |
| `parent_fk_lookup` | Resolve `purchaseOrderNumber` to `purchase_orders.id` FK |
| `self_ref_fk_lookup` | Resolve parent cost centre to `cost_centers.id` self-reference |
| `to_decimal_or_calculate` | Use source value if present; otherwise calculate from `on_hand - reserved` |
| `composite_key` | Concatenate multiple fields with separator |

## Notes

- **SOAP is the safe bet**: The SOAP interface is mature, stable, and covers all entities. REST API is available on newer versions (8.9+) but may not expose all entities yet. Default to SOAP unless the customer confirms REST coverage for all required entities.
- **SOAP implementation in Rust**: I/O's Import Service uses `reqwest` for HTTP and `quick-xml` for XML parsing/building. SOAP envelope construction is templated. The connector builds XML request bodies from the field mapping config and parses XML responses into flat records.
- **Ellipse date format**: Ellipse typically returns dates as `YYYYMMDD` strings (e.g., `20250115`) in SOAP responses, or ISO 8601 in REST responses. The `ellipse_date_to_iso8601` transform handles both.
- **District code**: Ellipse uses a `districtCode` (typically 2-4 characters) to scope all data. Every API call must include the district. This is analogous to SAP's plant code or D365's legal entity.
- **Dual-system deployment**: Ellipse is frequently the sole source for spare parts and maintenance POs, while SAP or Oracle handles financial data. The I/O admin should configure Ellipse for `inventory_items`, `purchase_orders`, `purchase_order_lines`, and `vendor_master`, and the companion ERP for `cost_centers` with budget data.
- **Search then retrieve pattern**: Ellipse SOAP often uses a two-step pattern: `search*` returns a list of keys, then `retrieve*` fetches full details per record. The connector should batch retrieve calls (or use search with `returnFullDetails=true` if the version supports it) to minimize round trips.
- **Pagination via restartKey**: Ellipse SOAP pagination uses `maxInstances` (page size) and `restartKey` (the key of the last record in the previous page). The connector must extract the restart key from each response and include it in the next request.
- **JMS not recommended for most deployments**: JMS topic-based messaging provides real-time event notification but requires a JMS client or bridge. Polling every 15-60 minutes is sufficient for I/O's use cases and avoids the JMS infrastructure dependency.
- **OAGIS BODs**: If the customer has Ellipse's OAGIS integration configured, I/O can receive BOD messages similar to Infor ION. The same BOD parsing logic applies. However, OAGIS is less commonly configured on Ellipse than on Infor.
- **Hitachi Energy modernization**: Hitachi Energy is actively modernizing Ellipse's API surface. Newer deployments (8.9+) have better REST coverage. During site assessment, check the Ellipse version and available REST endpoints before defaulting to SOAP.
- **I/O is strictly read-only**: No write-back to Ellipse. PO creation, inventory transactions, and work orders remain in Ellipse.
