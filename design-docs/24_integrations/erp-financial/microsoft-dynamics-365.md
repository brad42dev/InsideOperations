# Microsoft Dynamics 365 Finance & Operations — ERP / Financial Connector Profile

## Application Overview

- **Vendor**: Microsoft Corporation
- **Product**: Dynamics 365 Finance & Operations (F&O), including Dynamics 365 Supply Chain Management
- **Market position**: Growing in midsize refineries and petrochemical operations (~5-10% refinery market share). Less common than SAP/Oracle in large integrated oil companies, but strong in independent refiners, specialty chemical plants, and Microsoft-ecosystem shops.
- **Licensing**: OData API access is included with the D365 F&O license. No additional per-call cost. Azure AD app registration is free.
- **Typical refinery deployment**: D365 Supply Chain Management for inventory and procurement, D365 Finance for cost centers and GL, Asset Management module for maintenance work orders. Fully cloud-hosted on Azure.

## API Surface

- **API type**: OData V4 REST API (primary), Data Management Framework (DMF) package API (bulk operations)
- **Base URL pattern**: `https://<instance>.operations.dynamics.com/data/`
- **Authentication**: Azure AD OAuth 2.0 (client_credentials flow via app registration)
- **Pagination**: Standard OData `$skip` and `$top`. Server-side limit of 10,000 records per request. Automatic `@odata.nextLink` for pagination.
- **Rate limits**: Service protection limits — 6,000 requests per 5-minute sliding window per user. Throttled requests receive HTTP 429 with `Retry-After` header.
- **Date format**: ISO 8601 — no special parsing needed
- **Query support**: Full OData V4 — `$filter`, `$select`, `$expand`, `$orderby`, `$count` all work as expected
- **Cross-company**: `?cross-company=true` query parameter for multi-entity access
- **API documentation**: [D365 F&O Data Entities](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/data-entities)

## Target Tables

| Priority | I/O Table | D365 Source Module |
|----------|-----------|---------------------|
| Primary | `inventory_items` | Supply Chain Management (Inventory) |
| Primary | `purchase_orders` | Supply Chain Management (Procurement) |
| Primary | `purchase_order_lines` | Supply Chain Management (Procurement) |
| Primary | `vendor_master` | Procurement (Vendor Management) |
| Secondary | `cost_centers` | Finance (Cost Accounting) |

## Field Mapping

### inventory_items

| I/O Column | D365 OData Entity / Field | Transform | Required |
|------------|--------------------------|-----------|----------|
| `external_id` | `ReleasedProductV2Entity.ItemNumber` + `InventItemOnHandV2Entity.InventorySiteId` + `WarehouseId` | Composite: `{ItemNumber}_{SiteId}_{WarehouseId}` | Yes |
| `source_system` | — | Constant: `"dynamics_365"` | Yes |
| `part_number` | `ReleasedProductV2Entity.ItemNumber` | Direct | Yes |
| `description` | `ReleasedProductV2Entity.ProductName` | Direct | Yes |
| `quantity_on_hand` | `InventItemOnHandV2Entity.AvailableOnHandQuantity` | Numeric | Yes |
| `quantity_reserved` | `InventItemOnHandV2Entity.ReservedOnHandQuantity` | Numeric | No |
| `quantity_available` | `InventItemOnHandV2Entity.AvailableOnHandQuantity` | Direct (D365 provides this pre-calculated) | Auto |
| `reorder_point` | `InventItemOnHandV2Entity.ReorderPoint` or `ItemCoverageEntity.MinimumQuantity` | Numeric | No |
| `unit_cost` | `InventItemPriceEntity.Price` | From standard/active cost version | No |
| `currency` | `InventItemPriceEntity.CurrencyCode` | ISO 4217 | No |
| `warehouse_id` | `InventItemOnHandV2Entity.WarehouseId` | Direct | No |
| `warehouse_name` | `InventWarehouseEntity.WarehouseName` | Join on WarehouseId | No |
| `bin_location` | `InventItemOnHandV2Entity.WMSLocationId` | Direct | No |
| `last_receipt_date` | `InventItemOnHandV2Entity.PhysicalDate` | Latest receipt transaction date | No |
| `last_issue_date` | — | From `InventTransEntity` filtered by issue type | No |
| `extra_data` | — | JSONB: `{"item_group": ItemGroupId, "uom": UnitOfMeasureSymbol, "site_id": InventorySiteId, "product_type": ProductType, "item_model_group": ItemModelGroupId}` | No |

**OData entities**:
- Product master: `ReleasedProductV2Entity` (`/data/ReleasedProductsV2`)
- On-hand: `InventItemOnHandV2Entity` (`/data/InventItemOnHandsV2`)
- Pricing: `InventItemPriceEntity` (`/data/InventItemPrices`)

### purchase_orders

| I/O Column | D365 OData Entity / Field | Transform | Required |
|------------|--------------------------|-----------|----------|
| `external_id` | `PurchaseOrderHeaderV2Entity.PurchaseOrderNumber` | Direct | Yes |
| `source_system` | — | Constant: `"dynamics_365"` | Yes |
| `po_number` | `PurchaseOrderHeaderV2Entity.PurchaseOrderNumber` | Direct | Yes |
| `status` | `PurchaseOrderHeaderV2Entity.PurchaseOrderStatus` + `DocumentApprovalStatus` | See normalization below | Yes |
| `vendor_id` | `PurchaseOrderHeaderV2Entity.OrderVendorAccountNumber` | FK lookup to `vendor_master.external_id` | Yes |
| `vendor_name` | `PurchaseOrderHeaderV2Entity.VendorName` | Direct (expanded field) | No |
| `order_date` | `PurchaseOrderHeaderV2Entity.OrderCreatedDateTime` | ISO 8601 | Yes |
| `expected_delivery_date` | `PurchaseOrderHeaderV2Entity.RequestedDeliveryDate` | ISO 8601 | No |
| `total_amount` | `PurchaseOrderHeaderV2Entity.TotalPurchaseOrderAmount` | Numeric | No |
| `currency` | `PurchaseOrderHeaderV2Entity.CurrencyCode` | ISO 4217 | No |
| `created_by_name` | `PurchaseOrderHeaderV2Entity.PurchaseOrderCreatedBy` | Direct (user alias) | No |
| `extra_data` | — | JSONB: `{"buyer_group": BuyerGroupId, "delivery_address": DeliveryAddressName, "site_id": InventorySiteId, "warehouse_id": WarehouseId}` | No |

**OData entity**: `PurchaseOrderHeaderV2Entity` (`/data/PurchaseOrderHeadersV2`)

### purchase_order_lines

| I/O Column | D365 OData Entity / Field | Transform | Required |
|------------|--------------------------|-----------|----------|
| `purchase_order_id` | `PurchaseOrderLineV2Entity.PurchaseOrderNumber` | FK lookup to `purchase_orders.id` | Yes |
| `line_number` | `PurchaseOrderLineV2Entity.LineNumber` | Integer | Yes |
| `part_number` | `PurchaseOrderLineV2Entity.ItemNumber` | Direct | No |
| `description` | `PurchaseOrderLineV2Entity.ProductName` or `PurchaseOrderLineName` | Direct | No |
| `quantity_ordered` | `PurchaseOrderLineV2Entity.OrderedPurchaseQuantity` | Numeric | Yes |
| `quantity_received` | `PurchaseOrderLineV2Entity.ReceivingQuantity` or from product receipts | Numeric | No |
| `unit_price` | `PurchaseOrderLineV2Entity.PurchasePrice` | Numeric | No |
| `currency` | `PurchaseOrderLineV2Entity.CurrencyCode` | ISO 4217 | No |
| `delivery_date` | `PurchaseOrderLineV2Entity.ConfirmedDeliveryDate` or `RequestedDeliveryDate` | Prefer confirmed, fall back to requested | No |
| `extra_data` | — | JSONB: `{"site_id": InventorySiteId, "warehouse_id": WarehouseId, "procurement_category": ProcurementCategoryName, "line_amount": LineAmount}` | No |

**OData entity**: `PurchaseOrderLineV2Entity` (`/data/PurchaseOrderLinesV2`)

### vendor_master

| I/O Column | D365 OData Entity / Field | Transform | Required |
|------------|--------------------------|-----------|----------|
| `external_id` | `VendorsV2Entity.VendorAccountNumber` | Direct | Yes |
| `source_system` | — | Constant: `"dynamics_365"` | Yes |
| `vendor_code` | `VendorsV2Entity.VendorAccountNumber` | Direct | Yes |
| `name` | `VendorsV2Entity.VendorOrganizationName` | Direct | Yes |
| `address` | `VendorsV2Entity.AddressStreet` | Direct | No |
| `city` | `VendorsV2Entity.AddressCity` | Direct | No |
| `state` | `VendorsV2Entity.AddressState` | Direct | No |
| `country` | `VendorsV2Entity.AddressCountryRegionId` | ISO 3166-1 alpha-2 | No |
| `contact_name` | `VendorsV2Entity.PrimaryContactName` | Direct | No |
| `contact_email` | `VendorsV2Entity.PrimaryContactEmail` | Direct | No |
| `contact_phone` | `VendorsV2Entity.PrimaryContactPhone` | Direct | No |
| `payment_terms` | `VendorsV2Entity.VendorPaymentTermsName` | Direct (human-readable in D365) | No |
| `lead_time_days` | `VendorsV2Entity.DefaultDeliveryTermsCode` | Map to days or pull from trade agreements | No |
| `performance_rating` | — | Not native; leave null | No |
| `extra_data` | — | JSONB: `{"vendor_group": VendorGroupId, "tax_exempt_number": TaxExemptNumber, "payment_method": VendorPaymentMethodName, "currency": DefaultCurrency}` | No |

**OData entity**: `VendorsV2Entity` (`/data/VendorsV2`)

### cost_centers

| I/O Column | D365 OData Entity / Field | Transform | Required |
|------------|--------------------------|-----------|----------|
| `external_id` | `CostCenterEntity.CostCenterId` | Direct | Yes |
| `source_system` | — | Constant: `"dynamics_365"` | Yes |
| `code` | `CostCenterEntity.CostCenterId` | Direct | Yes |
| `name` | `CostCenterEntity.Name` | Direct | Yes |
| `description` | `CostCenterEntity.Description` | Direct | No |
| `parent_id` | `DimensionHierarchyEntity` parent lookup | Self-ref FK via hierarchy | No |
| `budget_amount` | `BudgetAccountEntryEntity.TransactionAmount` | Sum for cost center + fiscal year + budget model | No |
| `currency` | `CostCenterEntity.LegalEntityCurrency` | ISO 4217 | No |
| `fiscal_year` | Filter parameter | From sync config | Yes |
| `extra_data` | — | JSONB: `{"company_id": LegalEntity, "cost_center_type": CostCenterType}` | No |

**OData entity**: `CostCenterEntity` (`/data/CostCenters`) or `FinancialDimensionValueEntity`

## PO Status Normalization

D365 F&O has two relevant status fields:

### PurchaseOrderStatus (header lifecycle)

| D365 `PurchaseOrderStatus` enum | Value | I/O Status |
|--------------------------------|-------|------------|
| `None` | 0 | `draft` |
| `Received` | 1 | `received` |
| `Invoiced` | 2 | `closed` |
| `Cancelled` | 3 | `cancelled` |

### DocumentApprovalStatus (approval workflow)

| D365 `DocumentApprovalStatus` | Combined Logic | I/O Status |
|-------------------------------|---------------|------------|
| `Draft` | PO not yet submitted | `draft` |
| `InReview` | In approval workflow | `draft` |
| `Approved` | Approved + not confirmed to vendor | `approved` |
| `Approved` + `PurchaseOrderConfirmation` posted | Sent to vendor | `ordered` |
| `Approved` + partial product receipt | At least one line partially received | `partially_received` |
| `Approved` + all lines fully received | PurchaseOrderStatus = Received | `received` |
| PurchaseOrderStatus = Invoiced | Final invoice posted | `closed` |
| PurchaseOrderStatus = Cancelled | PO cancelled | `cancelled` |
| `Rejected` | Rejected in workflow | `cancelled` |

**Implementation note**: Check `PurchaseOrderStatus` first for terminal states (Received, Invoiced, Cancelled). Then use `DocumentApprovalStatus` for pre-receipt states. For `partially_received`, check line-level `ReceivingQuantity > 0` where not all lines are fully received.

## Sync Strategy

| Target Table | Interval | Method | Watermark Column |
|-------------|----------|--------|-----------------|
| `inventory_items` (product master) | 24 hours | `$filter=ModifiedDateTime gt ${watermark}` | `ModifiedDateTime` |
| `inventory_items` (on-hand) | 60 minutes | Incremental delta filter | `ModifiedDateTime` |
| `purchase_orders` + lines | 15 minutes | `$filter=ModifiedDateTime gt ${watermark}` | `ModifiedDateTime` |
| `vendor_master` | 7 days | Full sync (small dataset, typically <5K records) | `ModifiedDateTime` |
| `cost_centers` | 7 days | Full sync | None (small dataset) |

**DMF bulk load**: For initial data loads exceeding 10K records, use the Data Management Framework package API:
1. POST to `/data/DataManagementDefinitionGroups/Microsoft.Dynamics.DataEntities.ExportToPackage` with entity definition
2. Poll `GetExportedPackageUrl` until package is ready
3. Download the resulting zip containing CSV files
4. Parse and import CSVs into I/O tables

This async pattern handles large volumes without hitting OData pagination limits.

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "odata_v4",
  "name": "Microsoft Dynamics 365 F&O",
  "connection": {
    "base_url": "https://${D365_INSTANCE}.operations.dynamics.com/data/",
    "auth_type": "oauth2_azure_ad",
    "auth_config": {
      "tenant_id": "${AZURE_TENANT_ID}",
      "client_id": "${AZURE_CLIENT_ID}",
      "client_secret": "${AZURE_CLIENT_SECRET}",
      "token_url": "https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token",
      "scope": "https://${D365_INSTANCE}.operations.dynamics.com/.default"
    },
    "tls": {
      "verify_server_cert": true
    },
    "timeout_seconds": 60,
    "max_retries": 3,
    "rate_limit": {
      "max_requests_per_5min": 5500,
      "retry_on_429": true
    }
  }
}
```

### Import Definitions

```json
[
  {
    "name": "D365 Inventory Items",
    "source_system": "dynamics_365",
    "target_table": "inventory_items",
    "schedule": {
      "onhand": { "cron": "0 * * * *", "type": "incremental" },
      "master": { "cron": "0 2 * * *", "type": "full" }
    },
    "source_config": {
      "master_entity": "ReleasedProductsV2",
      "onhand_entity": "InventItemOnHandsV2",
      "price_entity": "InventItemPrices",
      "join_key": "ItemNumber",
      "odata_params": {
        "$select": "ItemNumber,ProductName,UnitOfMeasureSymbol,ItemGroupId,ProductType",
        "$filter": "dataAreaId eq '${LEGAL_ENTITY}'"
      },
      "watermark_column": "ModifiedDateTime",
      "cross_company": false
    },
    "field_mapping": [
      { "source": "ItemNumber+InventorySiteId+WarehouseId", "target": "external_id", "transform": "composite_key", "separator": "_" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "dynamics_365" },
      { "source": "ItemNumber", "target": "part_number", "transform": "direct" },
      { "source": "ProductName", "target": "description", "transform": "direct" },
      { "source": "AvailableOnHandQuantity", "target": "quantity_on_hand", "transform": "to_decimal" },
      { "source": "ReservedOnHandQuantity", "target": "quantity_reserved", "transform": "to_decimal" },
      { "source": "AvailableOnHandQuantity", "target": "quantity_available", "transform": "to_decimal" },
      { "source": "ReorderPoint", "target": "reorder_point", "transform": "to_decimal" },
      { "source": "Price", "target": "unit_cost", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "WarehouseId", "target": "warehouse_id", "transform": "direct" },
      { "source": "WarehouseName", "target": "warehouse_name", "transform": "direct" },
      { "source": "WMSLocationId", "target": "bin_location", "transform": "direct" },
      { "source": "PhysicalDate", "target": "last_receipt_date", "transform": "direct" },
      { "source": null, "target": "last_issue_date", "transform": "null" }
    ],
    "extra_data_mapping": [
      { "source": "ItemGroupId", "key": "item_group" },
      { "source": "UnitOfMeasureSymbol", "key": "uom" },
      { "source": "InventorySiteId", "key": "site_id" },
      { "source": "ProductType", "key": "product_type" },
      { "source": "ItemModelGroupId", "key": "item_model_group" }
    ]
  },
  {
    "name": "D365 Purchase Orders",
    "source_system": "dynamics_365",
    "target_table": "purchase_orders",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "entity": "PurchaseOrderHeadersV2",
      "odata_params": {
        "$select": "PurchaseOrderNumber,OrderVendorAccountNumber,PurchaseOrderStatus,DocumentApprovalStatus,OrderCreatedDateTime,RequestedDeliveryDate,TotalPurchaseOrderAmount,CurrencyCode,PurchaseOrderCreatedBy",
        "$filter": "dataAreaId eq '${LEGAL_ENTITY}'"
      },
      "watermark_column": "ModifiedDateTime"
    },
    "field_mapping": [
      { "source": "PurchaseOrderNumber", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "dynamics_365" },
      { "source": "PurchaseOrderNumber", "target": "po_number", "transform": "direct" },
      { "source": null, "target": "status", "transform": "d365_po_status_normalization" },
      { "source": "OrderVendorAccountNumber", "target": "vendor_id", "transform": "vendor_fk_lookup" },
      { "source": null, "target": "vendor_name", "transform": "vendor_name_from_cache" },
      { "source": "OrderCreatedDateTime", "target": "order_date", "transform": "direct" },
      { "source": "RequestedDeliveryDate", "target": "expected_delivery_date", "transform": "direct" },
      { "source": "TotalPurchaseOrderAmount", "target": "total_amount", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "PurchaseOrderCreatedBy", "target": "created_by_name", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "BuyerGroupId", "key": "buyer_group" },
      { "source": "DeliveryAddressName", "key": "delivery_address" },
      { "source": "InventorySiteId", "key": "site_id" },
      { "source": "WarehouseId", "key": "warehouse_id" }
    ]
  },
  {
    "name": "D365 Purchase Order Lines",
    "source_system": "dynamics_365",
    "target_table": "purchase_order_lines",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "entity": "PurchaseOrderLinesV2",
      "odata_params": {
        "$filter": "dataAreaId eq '${LEGAL_ENTITY}'"
      },
      "watermark_column": "ModifiedDateTime"
    },
    "field_mapping": [
      { "source": "PurchaseOrderNumber", "target": "purchase_order_id", "transform": "parent_fk_lookup" },
      { "source": "LineNumber", "target": "line_number", "transform": "to_integer" },
      { "source": "ItemNumber", "target": "part_number", "transform": "direct" },
      { "source": "ProductName", "target": "description", "transform": "direct" },
      { "source": "OrderedPurchaseQuantity", "target": "quantity_ordered", "transform": "to_decimal" },
      { "source": "ReceivingQuantity", "target": "quantity_received", "transform": "to_decimal" },
      { "source": "PurchasePrice", "target": "unit_price", "transform": "to_decimal" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "ConfirmedDeliveryDate", "target": "delivery_date", "transform": "coalesce_with_requested" }
    ],
    "extra_data_mapping": [
      { "source": "InventorySiteId", "key": "site_id" },
      { "source": "WarehouseId", "key": "warehouse_id" },
      { "source": "ProcurementCategoryName", "key": "procurement_category" },
      { "source": "LineAmount", "key": "line_amount" }
    ]
  },
  {
    "name": "D365 Vendor Master",
    "source_system": "dynamics_365",
    "target_table": "vendor_master",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "entity": "VendorsV2",
      "odata_params": {
        "$filter": "dataAreaId eq '${LEGAL_ENTITY}' and VendorHoldStatus eq Microsoft.Dynamics.DataEntities.VendorOnHoldStatus'No'"
      },
      "watermark_column": "ModifiedDateTime"
    },
    "field_mapping": [
      { "source": "VendorAccountNumber", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "dynamics_365" },
      { "source": "VendorAccountNumber", "target": "vendor_code", "transform": "direct" },
      { "source": "VendorOrganizationName", "target": "name", "transform": "direct" },
      { "source": "AddressStreet", "target": "address", "transform": "direct" },
      { "source": "AddressCity", "target": "city", "transform": "direct" },
      { "source": "AddressState", "target": "state", "transform": "direct" },
      { "source": "AddressCountryRegionId", "target": "country", "transform": "direct" },
      { "source": "PrimaryContactName", "target": "contact_name", "transform": "direct" },
      { "source": "PrimaryContactEmail", "target": "contact_email", "transform": "direct" },
      { "source": "PrimaryContactPhone", "target": "contact_phone", "transform": "direct" },
      { "source": "VendorPaymentTermsName", "target": "payment_terms", "transform": "direct" },
      { "source": null, "target": "lead_time_days", "transform": "null" },
      { "source": null, "target": "performance_rating", "transform": "null" }
    ],
    "extra_data_mapping": [
      { "source": "VendorGroupId", "key": "vendor_group" },
      { "source": "TaxExemptNumber", "key": "tax_exempt_number" },
      { "source": "VendorPaymentMethodName", "key": "payment_method" },
      { "source": "DefaultCurrency", "key": "currency" }
    ]
  },
  {
    "name": "D365 Cost Centers",
    "source_system": "dynamics_365",
    "target_table": "cost_centers",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "entity": "CostCenters",
      "odata_params": {
        "$filter": "dataAreaId eq '${LEGAL_ENTITY}'"
      },
      "watermark_column": null
    },
    "field_mapping": [
      { "source": "CostCenterId", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "dynamics_365" },
      { "source": "CostCenterId", "target": "code", "transform": "direct" },
      { "source": "Name", "target": "name", "transform": "direct" },
      { "source": "Description", "target": "description", "transform": "direct" },
      { "source": null, "target": "parent_id", "transform": "hierarchy_lookup" },
      { "source": null, "target": "budget_amount", "transform": "separate_budget_query" },
      { "source": "LegalEntityCurrency", "target": "currency", "transform": "direct" },
      { "source": null, "target": "fiscal_year", "transform": "from_sync_config" }
    ],
    "extra_data_mapping": [
      { "source": "LegalEntity", "key": "company_id" },
      { "source": "CostCenterType", "key": "cost_center_type" }
    ]
  }
]
```

### Custom Transforms

| Transform ID | Description |
|-------------|-------------|
| `d365_po_status_normalization` | Combine `PurchaseOrderStatus` + `DocumentApprovalStatus` + line receipt data per normalization table |
| `vendor_fk_lookup` | Resolve `OrderVendorAccountNumber` to `vendor_master.id` FK |
| `vendor_name_from_cache` | Lookup vendor name from cached vendor_master data |
| `parent_fk_lookup` | Resolve `PurchaseOrderNumber` to `purchase_orders.id` FK |
| `hierarchy_lookup` | Map D365 dimension hierarchy to `cost_centers.id` self-reference |
| `coalesce_with_requested` | Use `ConfirmedDeliveryDate` if present, else `RequestedDeliveryDate` |
| `separate_budget_query` | Budget data requires separate `BudgetAccountEntryEntity` query |
| `from_sync_config` | Pull fiscal year from import definition configuration |
| `composite_key` | Concatenate multiple fields with separator |

## Notes

- **Easiest connector of the five**: Standard OData V4, standard Azure AD OAuth2, human-readable entity and field names. If a customer is on D365, this integration is straightforward.
- **Azure AD setup**: Requires an Azure AD app registration with `Dynamics ERP` API permission. The admin creates this in the Azure portal — no D365-specific configuration needed beyond granting the app access to the F&O environment.
- **Entity names are readable**: `PurchaseOrderHeaderV2Entity`, `VendorAccountNumber`, `AvailableOnHandQuantity` — no cryptic codes to decode, unlike SAP's MATNR/WERKS system.
- **Service protection limits**: D365 enforces 6,000 requests per 5-minute window. The connector should implement request counting and automatic throttling. HTTP 429 responses include a `Retry-After` header.
- **DMF for bulk loads**: The Data Management Framework package API handles initial bulk loads well. Submit an export job, poll for completion, download the CSV package. Use this for historical data loads exceeding 10K records.
- **Cross-company access**: Multi-entity companies can use `?cross-company=true` to pull data across all legal entities in a single query. The import wizard should offer a checkbox for this.
- **`dataAreaId` filter**: Every query should include `dataAreaId eq '${LEGAL_ENTITY}'` to scope results to the correct legal entity (company). This is the D365 equivalent of SAP's plant/company code filter.
- **PO lines are a separate entity**: Unlike some ERPs, D365 exposes PO lines as a separate OData entity (`PurchaseOrderLinesV2`), not as a child of the header. The connector can query them independently with `$filter=PurchaseOrderNumber eq '...'` or sync all lines incrementally.
- **Power BI complement**: Many D365 customers already have Power BI dashboards. I/O complements (not replaces) Power BI by providing real-time operational context that Power BI cannot — live OPC data correlated with ERP data.
- **I/O is strictly read-only**: No write-back to D365. PO creation, inventory adjustments, and cost postings remain in D365.
