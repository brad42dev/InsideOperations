# Oracle Fusion Cloud ERP / E-Business Suite — ERP / Financial Connector Profile

## Application Overview

- **Vendor**: Oracle Corporation
- **Products**: Oracle Fusion Cloud ERP (modern, SaaS) and Oracle E-Business Suite (legacy, on-premise)
- **Market position**: Second most common in large refineries (~15-20% market share). Strong in North American refineries. Many sites are mid-migration from EBS to Fusion Cloud.
- **Licensing**: REST API access is included with the Oracle ERP license. No additional per-call cost for Fusion Cloud REST APIs. EBS may require Oracle Integration Cloud (OIC) license for middleware-based integration.
- **Typical refinery deployment**: Fusion Cloud for new deployments; EBS R12 still widely running at brownfield sites. Inventory Management for spare parts, Procurement for POs, Enterprise Asset Management (EAM) for maintenance work orders.

## API Surface

### Oracle Fusion Cloud

- **API type**: REST API with OData-like query parameters
- **Base URL pattern**: `https://<instance>.fa.<region>.oraclecloud.com/fscmRestApi/resources/<version>/`
- **Authentication**: OAuth 2.0 (client_credentials or authorization_code flow) via Oracle Identity Cloud Service (IDCS)
- **Pagination**: `offset` and `limit` parameters. Default limit 25, max 500. Link-based pagination via `hasMore` / `next` in response.
- **Rate limits**: Typically 1,000 requests/minute on Fusion Cloud. Connector should batch requests.
- **Date format**: RFC 3339 (ISO 8601) — no special parsing needed
- **API documentation**: [Oracle Fusion Cloud REST API](https://docs.oracle.com/en/cloud/saas/procurement/25d/fapra/rest-endpoints.html)

### Oracle E-Business Suite

- **API type**: SOAP Web Services, PL/SQL APIs, or Oracle Integration Cloud (OIC) REST adapters
- **Base URL pattern**: `https://<ebs-host>:<port>/webservices/rest/<service>/` (if REST gateway enabled)
- **Authentication**: Basic Auth (behind VPN) or OIC handles auth
- **Alternative**: Read-only database views (`PO_HEADERS_ALL`, `PO_LINES_ALL`, `MTL_ONHAND_QUANTITIES`) via direct DB connection
- **API documentation**: [Oracle EBS Integration Repository](https://docs.oracle.com/cd/E26401_01/doc.122/e20933/toc.htm)

## Target Tables

| Priority | I/O Table | Oracle Source Module |
|----------|-----------|---------------------|
| Primary | `inventory_items` | Inventory Management |
| Primary | `purchase_orders` | Procurement |
| Primary | `purchase_order_lines` | Procurement |
| Primary | `vendor_master` | Supplier Management |
| Secondary | `cost_centers` | General Ledger / Cost Management |

## Field Mapping

### inventory_items

| I/O Column | Fusion REST Field | EBS View/Column | Transform | Required |
|------------|------------------|-----------------|-----------|----------|
| `external_id` | `InventoryItemId` | `MTL_SYSTEM_ITEMS_B.INVENTORY_ITEM_ID` | String cast | Yes |
| `source_system` | — | — | Constant: `"oracle_fusion"` or `"oracle_ebs"` | Yes |
| `part_number` | `ItemNumber` | `MTL_SYSTEM_ITEMS_B.SEGMENT1` | Direct | Yes |
| `description` | `Description` | `MTL_SYSTEM_ITEMS_B.DESCRIPTION` | Direct | Yes |
| `quantity_on_hand` | `OnhandQuantity` (from onhand endpoint) | `MTL_ONHAND_QUANTITIES.TRANSACTION_QUANTITY` | Sum by item + org | Yes |
| `quantity_reserved` | `ReservedQuantity` | `MTL_RESERVATIONS.PRIMARY_RESERVATION_QUANTITY` | Sum by item | No |
| `quantity_available` | `AvailableQuantity` | — | Calculated: `on_hand - reserved` | Auto |
| `reorder_point` | `MinimumOrderQuantity` | `MTL_SYSTEM_ITEMS_B.MIN_MINMAX_QUANTITY` | Numeric | No |
| `unit_cost` | `UnitCost` | `CST_ITEM_COSTS.ITEM_COST` | Numeric | No |
| `currency` | `CurrencyCode` | `GL_SETS_OF_BOOKS.CURRENCY_CODE` | ISO 4217 | No |
| `warehouse_id` | `OrganizationId` | `MTL_PARAMETERS.ORGANIZATION_ID` | String cast | No |
| `warehouse_name` | `OrganizationName` | `HR_ALL_ORGANIZATION_UNITS.NAME` | Direct | No |
| `bin_location` | `Subinventory` | `MTL_ONHAND_QUANTITIES.SUBINVENTORY_CODE` | Direct | No |
| `last_receipt_date` | `LastReceiptDate` | `MTL_MATERIAL_TRANSACTIONS.TRANSACTION_DATE` (latest receipt type) | ISO 8601 | No |
| `last_issue_date` | `LastIssueDate` | `MTL_MATERIAL_TRANSACTIONS.TRANSACTION_DATE` (latest issue type) | ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"item_type": ItemType, "uom": PrimaryUOMCode, "organization_code": OrganizationCode, "category": CategoryName, "planner_code": PlannerCode}` | No |

**Fusion endpoints**: `/inventoryItems` (master), `/inventoryOnhandBalances` (stock levels)
**EBS views**: `MTL_SYSTEM_ITEMS_B` (master), `MTL_ONHAND_QUANTITIES` (stock)

### purchase_orders

| I/O Column | Fusion REST Field | EBS View/Column | Transform | Required |
|------------|------------------|-----------------|-----------|----------|
| `external_id` | `POHeaderId` | `PO_HEADERS_ALL.PO_HEADER_ID` | String cast | Yes |
| `source_system` | — | — | Constant: `"oracle_fusion"` or `"oracle_ebs"` | Yes |
| `po_number` | `OrderNumber` | `PO_HEADERS_ALL.SEGMENT1` | Direct | Yes |
| `status` | `Status` | `PO_HEADERS_ALL.AUTHORIZATION_STATUS` + line receipt status | See status normalization below | Yes |
| `vendor_id` | `SupplierId` | `PO_HEADERS_ALL.VENDOR_ID` | FK lookup to `vendor_master.external_id` | Yes |
| `vendor_name` | `Supplier` | `AP_SUPPLIERS.VENDOR_NAME` (join) | Direct | No |
| `order_date` | `OrderDate` | `PO_HEADERS_ALL.CREATION_DATE` | ISO 8601 | Yes |
| `expected_delivery_date` | — | — | Earliest `NeedByDate` from PO lines | No |
| `total_amount` | `TotalAmount` | `PO_HEADERS_ALL.BLANKET_TOTAL_AMOUNT` or sum of lines | Numeric | No |
| `currency` | `CurrencyCode` | `PO_HEADERS_ALL.CURRENCY_CODE` | ISO 4217 | No |
| `created_by_name` | `CreatedBy` | `PO_HEADERS_ALL.CREATED_BY` | User ID lookup | No |
| `extra_data` | — | — | JSONB: `{"procurement_bu": ProcurementBUId, "buyer": BuyerName, "ship_to_location": ShipToLocationId, "bill_to_location": BillToLocationId}` | No |

**Fusion endpoint**: `/purchaseOrders`
**EBS view**: `PO_HEADERS_ALL`

### purchase_order_lines

| I/O Column | Fusion REST Field | EBS View/Column | Transform | Required |
|------------|------------------|-----------------|-----------|----------|
| `purchase_order_id` | `POHeaderId` | `PO_LINES_ALL.PO_HEADER_ID` | FK lookup to `purchase_orders.id` | Yes |
| `line_number` | `LineNumber` | `PO_LINES_ALL.LINE_NUM` | Integer | Yes |
| `part_number` | `ItemNumber` | `PO_LINES_ALL.ITEM_ID` → `MTL_SYSTEM_ITEMS_B.SEGMENT1` | Join for EBS | No |
| `description` | `Description` | `PO_LINES_ALL.ITEM_DESCRIPTION` | Direct | No |
| `quantity_ordered` | `Quantity` | `PO_LINE_LOCATIONS_ALL.QUANTITY` | Numeric | Yes |
| `quantity_received` | `QuantityReceived` | `PO_LINE_LOCATIONS_ALL.QUANTITY_RECEIVED` | Numeric | No |
| `unit_price` | `UnitPrice` | `PO_LINES_ALL.UNIT_PRICE` | Numeric | No |
| `currency` | `CurrencyCode` | `PO_HEADERS_ALL.CURRENCY_CODE` (from header) | ISO 4217 | No |
| `delivery_date` | `NeedByDate` | `PO_LINE_LOCATIONS_ALL.NEED_BY_DATE` | ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"ship_to_org": ShipToOrganizationId, "category": CategoryName, "line_type": LineType}` | No |

**Fusion endpoint**: `/purchaseOrders/{POHeaderId}/lines`
**EBS view**: `PO_LINES_ALL` + `PO_LINE_LOCATIONS_ALL`

### vendor_master

| I/O Column | Fusion REST Field | EBS View/Column | Transform | Required |
|------------|------------------|-----------------|-----------|----------|
| `external_id` | `SupplierId` | `AP_SUPPLIERS.VENDOR_ID` | String cast | Yes |
| `source_system` | — | — | Constant: `"oracle_fusion"` or `"oracle_ebs"` | Yes |
| `vendor_code` | `SupplierNumber` | `AP_SUPPLIERS.SEGMENT1` | Direct | Yes |
| `name` | `Supplier` | `AP_SUPPLIERS.VENDOR_NAME` | Direct | Yes |
| `address` | `AddressLine1` | `AP_SUPPLIER_SITES_ALL.ADDRESS_LINE1` | Direct | No |
| `city` | `City` | `AP_SUPPLIER_SITES_ALL.CITY` | Direct | No |
| `state` | `State` | `AP_SUPPLIER_SITES_ALL.STATE` | Direct | No |
| `country` | `Country` | `AP_SUPPLIER_SITES_ALL.COUNTRY` | ISO 3166-1 alpha-2 | No |
| `contact_name` | `ContactName` (from contacts child) | `AP_SUPPLIER_CONTACTS.FIRST_NAME + LAST_NAME` | Concatenate | No |
| `contact_email` | `EmailAddress` | `AP_SUPPLIER_CONTACTS.EMAIL_ADDRESS` | Direct | No |
| `contact_phone` | `PhoneNumber` | `AP_SUPPLIER_CONTACTS.PHONE` | Direct | No |
| `payment_terms` | `PaymentTerms` | `AP_TERMS.NAME` (join via `TERMS_ID`) | Direct (human-readable in Oracle) | No |
| `lead_time_days` | — | `PO_APPROVED_SUPPLIER_LIST.PROCESSING_LEAD_TIME` | From ASL if available | No |
| `performance_rating` | — | — | Not native; leave null | No |
| `extra_data` | — | — | JSONB: `{"supplier_type": SupplierType, "tax_id": TaxRegistrationNumber, "status": Status, "procurement_bu": ProcurementBU}` | No |

**Fusion endpoint**: `/suppliers`
**EBS view**: `AP_SUPPLIERS` + `AP_SUPPLIER_SITES_ALL`

### cost_centers

| I/O Column | Fusion REST Field | EBS View/Column | Transform | Required |
|------------|------------------|-----------------|-----------|----------|
| `external_id` | `CostCenterId` | `GL_CODE_COMBINATIONS.SEGMENT2` (typical) | Direct | Yes |
| `source_system` | — | — | Constant: `"oracle_fusion"` or `"oracle_ebs"` | Yes |
| `code` | `CostCenterValue` | `FND_FLEX_VALUES.FLEX_VALUE` | Direct | Yes |
| `name` | `CostCenterName` | `FND_FLEX_VALUES_TL.DESCRIPTION` | Direct | Yes |
| `description` | `Description` | `FND_FLEX_VALUES_TL.DESCRIPTION` | Direct | No |
| `parent_id` | `ParentCostCenterId` | Hierarchy via `FND_FLEX_VALUE_HIERARCHIES` | Self-ref FK lookup | No |
| `budget_amount` | — | `GL_BALANCES` budget type | Separate GL budget query | No |
| `currency` | `CurrencyCode` | `GL_SETS_OF_BOOKS.CURRENCY_CODE` | ISO 4217 | No |
| `fiscal_year` | `FiscalYear` | `GL_PERIODS.PERIOD_YEAR` | Integer | Yes |
| `extra_data` | — | — | JSONB: `{"ledger": LedgerId, "company": CompanySegment, "department": DepartmentSegment}` | No |

**Fusion endpoint**: `/costCenters` or GL value sets
**EBS view**: `FND_FLEX_VALUES` (cost center segment of chart of accounts)

## PO Status Normalization

### Oracle Fusion Cloud

| Fusion `Status` | I/O Status |
|-----------------|------------|
| `INCOMPLETE` | `draft` |
| `REQUIRES REAPPROVAL` | `draft` |
| `APPROVED` | `approved` |
| `IN PROCESS` (approved, sent to vendor) | `ordered` |
| Lines partially received (`QuantityReceived > 0` but `< Quantity`) | `partially_received` |
| All lines fully received | `received` |
| `CLOSED` | `closed` |
| `CANCELLED` | `cancelled` |
| `ON HOLD` | `approved` (with `extra_data.on_hold: true`) |
| `REJECTED` | `cancelled` |

### Oracle E-Business Suite

| EBS `AUTHORIZATION_STATUS` | I/O Status |
|---------------------------|------------|
| `INCOMPLETE` | `draft` |
| `REQUIRES REAPPROVAL` | `draft` |
| `IN PROCESS` (in approval workflow) | `draft` |
| `APPROVED` + no receipts | `approved` |
| `APPROVED` + sent to vendor | `ordered` |
| Partial receipt (check `RCV_TRANSACTIONS`) | `partially_received` |
| Full receipt | `received` |
| `CLOSED` / `FINALLY CLOSED` | `closed` |
| `CANCELLED` | `cancelled` |

**Implementation note**: For both Fusion and EBS, determining `partially_received` vs `received` requires checking line-level receipt quantities. In Fusion, use `$expand=lines` to get line data in a single request. In EBS, join `PO_LINE_LOCATIONS_ALL` for `QUANTITY_RECEIVED`.

## Sync Strategy

| Target Table | Interval | Method | Watermark Column |
|-------------|----------|--------|-----------------|
| `inventory_items` (master) | 24 hours | Full with delta: `?q=LastUpdateDate > '{watermark}'` | `LastUpdateDate` |
| `inventory_items` (onhand) | 60 minutes | Incremental | `LastUpdateDate` |
| `purchase_orders` + lines | 15 minutes | Incremental: `?q=LastUpdateDate > '{watermark}'` | `LastUpdateDate` |
| `vendor_master` | 7 days | Full sync (small dataset) | `LastUpdateDate` |
| `cost_centers` | 24 hours | Full sync | None |

**Fusion query syntax**: `?q=LastUpdateDate > '2025-01-15T10:30:00Z'` (RSQL-style filter)
**EBS alternative**: `WHERE LAST_UPDATE_DATE > :watermark` (direct DB or OIC-mediated)

**Initial load**: Fusion supports `limit=500` per page. For large datasets, use the FBDI (File-Based Data Import/Export) bulk extract. EBS can use `UTL_FILE` exports or OIC bulk extract adapters.

## Pre-Built Import Definition

### Connection Config (Fusion Cloud)

```json
{
  "connector_type": "rest_json",
  "name": "Oracle Fusion Cloud ERP",
  "connection": {
    "base_url": "https://${ORACLE_INSTANCE}.fa.${ORACLE_REGION}.oraclecloud.com/fscmRestApi/resources/11.13.18.05/",
    "auth_type": "oauth2_client_credentials",
    "auth_config": {
      "client_id": "${ORACLE_CLIENT_ID}",
      "client_secret": "${ORACLE_CLIENT_SECRET}",
      "token_url": "https://${ORACLE_IDCS_INSTANCE}.identity.oraclecloud.com/oauth2/v1/token",
      "scope": "urn:opc:resource:consumer::all"
    },
    "tls": {
      "verify_server_cert": true
    },
    "timeout_seconds": 60,
    "max_retries": 3
  }
}
```

### Connection Config (EBS — Direct DB)

```json
{
  "connector_type": "database_readonly",
  "name": "Oracle E-Business Suite",
  "connection": {
    "db_type": "oracle",
    "host": "${EBS_DB_HOST}",
    "port": 1521,
    "service_name": "${EBS_SERVICE_NAME}",
    "username": "${EBS_READONLY_USER}",
    "password": "${EBS_READONLY_PASSWORD}",
    "tls": {
      "verify_server_cert": true
    }
  }
}
```

### Import Definitions

```json
[
  {
    "name": "Oracle Inventory Items",
    "source_system": "oracle_fusion",
    "target_table": "inventory_items",
    "schedule": {
      "onhand": { "cron": "0 * * * *", "type": "incremental" },
      "master": { "cron": "0 2 * * *", "type": "full" }
    },
    "source_config": {
      "master_endpoint": "/inventoryItems",
      "onhand_endpoint": "/inventoryOnhandBalances",
      "join_key": "InventoryItemId",
      "query_params": {
        "q": "OrganizationCode = '${ORG_CODE}'",
        "limit": 500,
        "fields": "InventoryItemId,ItemNumber,Description,PrimaryUOMCode,OrganizationCode"
      },
      "watermark_column": "LastUpdateDate"
    },
    "field_mapping": [
      { "source": "InventoryItemId", "target": "external_id", "transform": "to_string" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_fusion" },
      { "source": "ItemNumber", "target": "part_number", "transform": "direct" },
      { "source": "Description", "target": "description", "transform": "direct" },
      { "source": "OnhandQuantity", "target": "quantity_on_hand", "transform": "to_decimal" },
      { "source": "ReservedQuantity", "target": "quantity_reserved", "transform": "to_decimal" },
      { "source": null, "target": "quantity_available", "transform": "expression", "expression": "quantity_on_hand - quantity_reserved" },
      { "source": "MinimumOrderQuantity", "target": "reorder_point", "transform": "to_decimal" },
      { "source": "UnitCost", "target": "unit_cost", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "OrganizationId", "target": "warehouse_id", "transform": "to_string" },
      { "source": "OrganizationName", "target": "warehouse_name", "transform": "direct" },
      { "source": "Subinventory", "target": "bin_location", "transform": "direct" },
      { "source": "LastReceiptDate", "target": "last_receipt_date", "transform": "direct" },
      { "source": "LastIssueDate", "target": "last_issue_date", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "ItemType", "key": "item_type" },
      { "source": "PrimaryUOMCode", "key": "uom" },
      { "source": "OrganizationCode", "key": "organization_code" },
      { "source": "CategoryName", "key": "category" }
    ]
  },
  {
    "name": "Oracle Purchase Orders",
    "source_system": "oracle_fusion",
    "target_table": "purchase_orders",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "endpoint": "/purchaseOrders",
      "query_params": {
        "expand": "lines",
        "q": "ProcurementBU = '${PROCUREMENT_BU}'",
        "limit": 200
      },
      "watermark_column": "LastUpdateDate"
    },
    "field_mapping": [
      { "source": "POHeaderId", "target": "external_id", "transform": "to_string" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_fusion" },
      { "source": "OrderNumber", "target": "po_number", "transform": "direct" },
      { "source": "Status", "target": "status", "transform": "oracle_fusion_po_status" },
      { "source": "SupplierId", "target": "vendor_id", "transform": "vendor_fk_lookup" },
      { "source": "Supplier", "target": "vendor_name", "transform": "direct" },
      { "source": "OrderDate", "target": "order_date", "transform": "direct" },
      { "source": null, "target": "expected_delivery_date", "transform": "earliest_line_need_by_date" },
      { "source": "TotalAmount", "target": "total_amount", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "CreatedBy", "target": "created_by_name", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "ProcurementBU", "key": "procurement_bu" },
      { "source": "BuyerName", "key": "buyer" },
      { "source": "ShipToLocationId", "key": "ship_to_location" }
    ]
  },
  {
    "name": "Oracle Purchase Order Lines",
    "source_system": "oracle_fusion",
    "target_table": "purchase_order_lines",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "note": "Lines fetched via $expand on PO header request. Processed in same sync run as purchase_orders.",
      "parent_endpoint": "/purchaseOrders",
      "child_path": "lines"
    },
    "field_mapping": [
      { "source": "POHeaderId", "target": "purchase_order_id", "transform": "parent_fk_lookup" },
      { "source": "LineNumber", "target": "line_number", "transform": "to_integer" },
      { "source": "ItemNumber", "target": "part_number", "transform": "direct" },
      { "source": "Description", "target": "description", "transform": "direct" },
      { "source": "Quantity", "target": "quantity_ordered", "transform": "to_decimal" },
      { "source": "QuantityReceived", "target": "quantity_received", "transform": "to_decimal" },
      { "source": "UnitPrice", "target": "unit_price", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "NeedByDate", "target": "delivery_date", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "ShipToOrganizationId", "key": "ship_to_org" },
      { "source": "CategoryName", "key": "category" },
      { "source": "LineType", "key": "line_type" }
    ]
  },
  {
    "name": "Oracle Vendor Master",
    "source_system": "oracle_fusion",
    "target_table": "vendor_master",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "endpoint": "/suppliers",
      "query_params": {
        "q": "Status = 'ACTIVE'",
        "expand": "sites,contacts",
        "limit": 500
      },
      "watermark_column": "LastUpdateDate"
    },
    "field_mapping": [
      { "source": "SupplierId", "target": "external_id", "transform": "to_string" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_fusion" },
      { "source": "SupplierNumber", "target": "vendor_code", "transform": "direct" },
      { "source": "Supplier", "target": "name", "transform": "direct" },
      { "source": "AddressLine1", "target": "address", "transform": "direct" },
      { "source": "City", "target": "city", "transform": "direct" },
      { "source": "State", "target": "state", "transform": "direct" },
      { "source": "Country", "target": "country", "transform": "direct" },
      { "source": "ContactName", "target": "contact_name", "transform": "direct" },
      { "source": "EmailAddress", "target": "contact_email", "transform": "direct" },
      { "source": "PhoneNumber", "target": "contact_phone", "transform": "direct" },
      { "source": "PaymentTerms", "target": "payment_terms", "transform": "direct" },
      { "source": null, "target": "lead_time_days", "transform": "null" },
      { "source": null, "target": "performance_rating", "transform": "null" }
    ],
    "extra_data_mapping": [
      { "source": "SupplierType", "key": "supplier_type" },
      { "source": "TaxRegistrationNumber", "key": "tax_id" },
      { "source": "ProcurementBU", "key": "procurement_bu" }
    ]
  },
  {
    "name": "Oracle Cost Centers",
    "source_system": "oracle_fusion",
    "target_table": "cost_centers",
    "schedule": { "cron": "0 3 * * *", "type": "full" },
    "source_config": {
      "endpoint": "/costCenters",
      "query_params": {
        "q": "ChartOfAccountsId = '${COA_ID}'",
        "limit": 500
      },
      "watermark_column": null
    },
    "field_mapping": [
      { "source": "CostCenterId", "target": "external_id", "transform": "to_string" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_fusion" },
      { "source": "CostCenterValue", "target": "code", "transform": "direct" },
      { "source": "CostCenterName", "target": "name", "transform": "direct" },
      { "source": "Description", "target": "description", "transform": "direct" },
      { "source": "ParentCostCenterId", "target": "parent_id", "transform": "self_ref_fk_lookup" },
      { "source": null, "target": "budget_amount", "transform": "separate_gl_budget_query" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "FiscalYear", "target": "fiscal_year", "transform": "to_integer" }
    ],
    "extra_data_mapping": [
      { "source": "LedgerId", "key": "ledger" },
      { "source": "CompanySegment", "key": "company" }
    ]
  }
]
```

### Custom Transforms

| Transform ID | Description |
|-------------|-------------|
| `oracle_fusion_po_status` | Map Fusion `Status` + line receipt quantities to I/O normalized status |
| `oracle_ebs_po_status` | Map EBS `AUTHORIZATION_STATUS` + receipt data to I/O normalized status |
| `vendor_fk_lookup` | Resolve Oracle `SupplierId` to `vendor_master.id` FK |
| `parent_fk_lookup` | Resolve `POHeaderId` to `purchase_orders.id` FK |
| `self_ref_fk_lookup` | Resolve parent cost center to `cost_centers.id` self-reference |
| `earliest_line_need_by_date` | Scan PO lines, return earliest `NeedByDate` |
| `separate_gl_budget_query` | Budget data requires separate GL balance API call |

## Notes

- **Fusion vs EBS**: The connector should detect which system it is connecting to during setup. The import wizard should offer "Oracle Fusion Cloud" and "Oracle E-Business Suite" as separate connection options, since the APIs and field names differ substantially.
- **EBS direct DB access**: Many EBS customers prefer read-only database views over SOAP APIs. The I/O import wizard should support a database connector option for EBS (`PO_HEADERS_ALL`, `MTL_SYSTEM_ITEMS_B`, etc.). This requires a read-only Oracle DB user with SELECT grants on the relevant views.
- **EBS-to-Fusion migration**: Sites in mid-migration may need both connectors active simultaneously. I/O handles this via separate import definitions with different `source_system` values.
- **Fusion date handling**: RFC 3339 format, no special parsing. This is the easiest date handling of all five ERP connectors.
- **Rate limits**: Fusion Cloud enforces ~1,000 requests/minute. The connector should implement request throttling and batch child queries (expand lines with parent) to stay within limits.
- **FBDI for bulk**: Oracle's File-Based Data Import/Export (FBDI) is the recommended approach for initial bulk loads exceeding 10K records. The connector can trigger an FBDI export via REST API and download the resulting CSV.
- **Oracle licensing**: REST API access is included in the ERP license. No additional cost per API call. OIC middleware (if needed for EBS) is a separate license.
- **I/O is strictly read-only**: No write-back to Oracle. PO creation, inventory transactions, and GL postings remain in Oracle.
