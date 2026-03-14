# SAP S/4HANA — ERP / Financial Connector Profile

## Application Overview

- **Vendor**: SAP SE
- **Product**: SAP S/4HANA (on-premise and Cloud editions)
- **Market position**: Dominant in large refineries and integrated oil companies. ~60-70% of major refineries worldwide run SAP. Strong across Middle East, Europe, and Asia downstream operations.
- **Licensing**: OData API access is included with the S/4HANA license. No additional API licensing cost. SAP API Business Hub provides sandbox access with API keys.
- **Typical refinery deployment**: On-premise S/4HANA or S/4HANA Cloud. Materials Management (MM) for spare parts and procurement, Plant Maintenance (PM) for work orders, Controlling (CO) for cost centers. SAP Gateway exposes OData services.

## API Surface

- **API type**: OData V2 (most services) and OData V4 (newer services) via SAP Gateway
- **Base URL pattern**: `https://<sap-host>:<port>/sap/opu/odata/sap/<SERVICE_NAME>/`
- **Authentication**:
  - OAuth 2.0 client_credentials (S/4HANA Cloud)
  - Basic Auth with SAP client number (on-premise via SAP Gateway)
  - X.509 certificate authentication (on-premise, high-security)
- **Pagination**: `$skip` and `$top` parameters. Default page size 100. Server-driven pagination via `__next` link in response.
- **Rate limits**: Customer-specific. Typically generous on dedicated systems, restrictive on shared landscapes. No published global limit.
- **CSRF token**: Required for write operations (not relevant for I/O read-only, but `X-CSRF-Token: Fetch` header needed on some GET endpoints depending on SAP config)
- **Date format**: ABAP internal format `/Date(1234567890)/` (milliseconds since epoch) — connector must parse this
- **API documentation**: [SAP API Business Hub](https://api.sap.com/package/S4HANAOPAPI/odata)

## Target Tables

| Priority | I/O Table | SAP Source Module |
|----------|-----------|-------------------|
| Primary | `inventory_items` | MM (Materials Management) |
| Primary | `purchase_orders` | MM (Procurement) |
| Primary | `purchase_order_lines` | MM (Procurement) |
| Primary | `vendor_master` | MM (Vendor Master) |
| Secondary | `cost_centers` | CO (Controlling) |

## Field Mapping

### inventory_items

| I/O Column | SAP OData Field | SAP Code | Transform | Required |
|------------|----------------|----------|-----------|----------|
| `external_id` | `Material` + `Plant` + `StorageLocation` | MATNR+WERKS+LGORT | Composite key: `{Material}_{Plant}_{StorageLocation}` | Yes |
| `source_system` | — | — | Constant: `"sap_s4hana"` | Yes |
| `part_number` | `Material` | MATNR | Trim leading zeros | Yes |
| `description` | `MaterialName` | MAKTX | Direct | Yes |
| `quantity_on_hand` | `MatlWrhsStkQtyInMatlBaseUnit` | LABST | Numeric, unrestricted stock | Yes |
| `quantity_reserved` | `ResvdQtyInMatlBaseUnit` | RESBE | Numeric, reserved for orders | No |
| `quantity_available` | — | — | Calculated: `quantity_on_hand - quantity_reserved` | Auto |
| `reorder_point` | `ReorderPoint` | MINBE | Numeric | No |
| `unit_cost` | `MovingAveragePrice` or `StandardPrice` | VERPR / STPRS | Numeric; prefer VERPR if non-zero, else STPRS | No |
| `currency` | `Currency` | WAERS | ISO 4217 3-char | No |
| `warehouse_id` | `Plant` | WERKS | Direct | No |
| `warehouse_name` | `PlantName` | — | From Plant master lookup | No |
| `bin_location` | `StorageLocation` | LGORT | Direct | No |
| `last_receipt_date` | `LastGoodsReceiptDate` | — | Parse ABAP date → ISO 8601 | No |
| `last_issue_date` | `LastGoodsIssueDate` | — | Parse ABAP date → ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"material_group": MATKL, "material_type": MTART, "base_unit": MEINS, "lead_time_days": PLIFZ, "plant": WERKS, "criticality": from SSQSS indicator}` | No |

**OData Services**:
- Material master: `API_MATERIAL_SRV_0001/A_Material` with `$expand=to_Description`
- Stock levels: `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod`
- Joined via `Material` key

### purchase_orders

| I/O Column | SAP OData Field | SAP Code | Transform | Required |
|------------|----------------|----------|-----------|----------|
| `external_id` | `PurchaseOrder` | EBELN | Direct | Yes |
| `source_system` | — | — | Constant: `"sap_s4hana"` | Yes |
| `po_number` | `PurchaseOrder` | EBELN | Direct | Yes |
| `status` | `PurchasingDocumentDeletionCode` + `PurchaseOrderLifecycleStatus` | LOEKZ + custom | See status normalization below | Yes |
| `vendor_id` | `Supplier` | LIFNR | FK lookup to `vendor_master.external_id` | Yes |
| `vendor_name` | `SupplierName` | — | From `$expand=to_Supplier` or vendor master cache | No |
| `order_date` | `PurchaseOrderDate` | BEDAT | Parse ABAP date → ISO 8601 | Yes |
| `expected_delivery_date` | — | — | Earliest `DeliveryDate` from PO lines | No |
| `total_amount` | `NetPriceAmount` (summed) | — | Sum of line-level `NetPriceAmount * OrderQuantity` | No |
| `currency` | `DocumentCurrency` | WAERS | ISO 4217 | No |
| `created_by_name` | `CreatedByUser` | ERNAM | Direct (SAP user ID) | No |
| `extra_data` | — | — | JSONB: `{"purchasing_org": EKORG, "purchasing_group": EKGRP, "company_code": BUKRS, "plant": WERKS}` | No |

**OData Service**: `API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder`

### purchase_order_lines

| I/O Column | SAP OData Field | SAP Code | Transform | Required |
|------------|----------------|----------|-----------|----------|
| `purchase_order_id` | — | — | FK: lookup `purchase_orders.id` by `PurchaseOrder` | Yes |
| `line_number` | `PurchaseOrderItem` | EBELP | Integer | Yes |
| `part_number` | `Material` | MATNR | Trim leading zeros | No |
| `description` | `PurchaseOrderItemText` | TXZ01 | Direct | No |
| `quantity_ordered` | `OrderQuantity` | MENGE | Numeric | Yes |
| `quantity_received` | `GoodsReceiptQuantity` | — | From goods receipt history | No |
| `unit_price` | `NetPriceAmount` | NETPR | Numeric | No |
| `currency` | `DocumentCurrency` | WAERS | ISO 4217 | No |
| `delivery_date` | `DeliveryDate` | EINDT | Parse ABAP date → ISO 8601 | No |
| `extra_data` | — | — | JSONB: `{"plant": WERKS, "storage_location": LGORT, "item_category": PSTYP, "account_assignment": KNTTP}` | No |

**OData Service**: `API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem` (child of PO header via `$expand=to_PurchaseOrderItem`)

### vendor_master

| I/O Column | SAP OData Field | SAP Code | Transform | Required |
|------------|----------------|----------|-----------|----------|
| `external_id` | `Supplier` | LIFNR | Direct | Yes |
| `source_system` | — | — | Constant: `"sap_s4hana"` | Yes |
| `vendor_code` | `Supplier` | LIFNR | Trim leading zeros | Yes |
| `name` | `SupplierName` | NAME1 | Direct | Yes |
| `address` | `StreetAddress` | STRAS | Direct | No |
| `city` | `CityName` | ORT01 | Direct | No |
| `state` | `Region` | REGIO | Direct | No |
| `country` | `Country` | LAND1 | ISO 3166-1 alpha-2 | No |
| `contact_name` | — | — | Not directly available; use `extra_data` | No |
| `contact_email` | `EmailAddress` | SMTP_ADDR | From partner function contact | No |
| `contact_phone` | `PhoneNumber` | TELF1 | Direct | No |
| `payment_terms` | `PaymentTerms` | ZTERM | Map to human-readable (e.g., "Z030" → "Net 30") | No |
| `lead_time_days` | `PlannedDeliveryTime` | PLIFZ | Integer, from purchasing info record | No |
| `performance_rating` | — | — | Not native in SAP; leave null or compute from GR history | No |
| `extra_data` | — | — | JSONB: `{"vendor_group": KTOKK, "company_code": BUKRS, "purchasing_org": EKORG, "currency": WAERS}` | No |

**OData Service**: `API_BUSINESS_PARTNER/A_Supplier` (S/4HANA uses Business Partner model)

### cost_centers

| I/O Column | SAP OData Field | SAP Code | Transform | Required |
|------------|----------------|----------|-----------|----------|
| `external_id` | `CostCenter` | KOSTL | Direct | Yes |
| `source_system` | — | — | Constant: `"sap_s4hana"` | Yes |
| `code` | `CostCenter` | KOSTL | Trim leading zeros | Yes |
| `name` | `CostCenterName` | KTEXT | Direct | Yes |
| `description` | `CostCenterDescription` | LTEXT | Direct | No |
| `parent_id` | `CostCenterCategory` | KOSGR | Self-ref FK via hierarchy mapping | No |
| `budget_amount` | — | — | From CO budget reports (separate API call) | No |
| `currency` | `CurrencyCode` | WAERS | ISO 4217 | No |
| `fiscal_year` | `FiscalYear` | GJAHR | Integer | Yes |
| `extra_data` | — | — | JSONB: `{"company_code": BUKRS, "controlling_area": KOKRS, "responsible_person": VERAK, "category": KOSAR}` | No |

**OData Service**: `API_COSTCENTER_SRV/A_CostCenter`

## PO Status Normalization

SAP does not expose a single clean PO status field. Status is derived from a combination of flags:

| SAP Condition | I/O Status |
|---------------|------------|
| `PurchasingDocumentDeletionCode = 'L'` | `cancelled` |
| `PurchaseOrderLifecycleStatus = '01'` (not yet approved) | `draft` |
| `PurchaseOrderLifecycleStatus = '02'` (approved, no GR) | `approved` |
| Approved + transmitted to vendor | `ordered` |
| Any line has `GoodsReceiptQuantity > 0` but not all lines fully received | `partially_received` |
| All lines fully received (`GoodsReceiptQuantity >= OrderQuantity`) | `received` |
| Final invoice posted and PO closed | `closed` |

**Implementation note**: The connector must query both the PO header and line-level GR quantities to determine `partially_received` vs `received`. Use `$expand=to_PurchaseOrderItem` to get lines in a single request.

## Sync Strategy

| Target Table | Interval | Method | Watermark Column |
|-------------|----------|--------|-----------------|
| `inventory_items` (material master) | 24 hours | Full sync with delta detection | `LastChangeDateTime` on `A_Material` |
| `inventory_items` (stock levels) | 60 minutes | Incremental | `LastChangeDateTime` on `A_MatlStkInAcctMod` |
| `purchase_orders` + lines | 15 minutes | Incremental | `LastChangeDateTime` on `A_PurchaseOrder` |
| `vendor_master` | 7 days | Full sync | `LastChangeDateTime` on `A_Supplier` |
| `cost_centers` | 24 hours | Full sync | None (small dataset) |

**Watermark filter**: `$filter=LastChangeDateTime gt datetime'2025-01-15T10:30:00'`

**Initial load**: Use `$top=5000` with automatic pagination. Material master can be 50K+ records. Run during off-hours. Estimated time: 30-60 minutes for a typical refinery SAP system.

## Pre-Built Import Definition

### Connection Config

```json
{
  "connector_type": "odata_v2",
  "name": "SAP S/4HANA",
  "connection": {
    "base_url": "https://${SAP_HOST}:${SAP_PORT}/sap/opu/odata/sap/",
    "auth_type": "basic",
    "auth_config": {
      "username": "${SAP_USERNAME}",
      "password": "${SAP_PASSWORD}",
      "custom_headers": {
        "sap-client": "${SAP_CLIENT}"
      }
    },
    "tls": {
      "verify_server_cert": true,
      "ca_cert_path": null
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
    "name": "SAP Inventory Items",
    "source_system": "sap_s4hana",
    "target_table": "inventory_items",
    "schedule": {
      "stock_levels": { "cron": "0 * * * *", "type": "incremental" },
      "material_master": { "cron": "0 2 * * *", "type": "full" }
    },
    "source_config": {
      "primary_service": "API_MATERIAL_STOCK_SRV",
      "primary_entity": "A_MatlStkInAcctMod",
      "secondary_service": "API_MATERIAL_SRV_0001",
      "secondary_entity": "A_Material",
      "join_key": "Material",
      "odata_params": {
        "$select": "Material,Plant,StorageLocation,MatlWrhsStkQtyInMatlBaseUnit,ResvdQtyInMatlBaseUnit",
        "$filter": "Plant eq '${PLANT_CODE}'"
      },
      "watermark_column": "LastChangeDateTime"
    },
    "field_mapping": [
      { "source": "Material+Plant+StorageLocation", "target": "external_id", "transform": "composite_key", "separator": "_" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "sap_s4hana" },
      { "source": "Material", "target": "part_number", "transform": "trim_leading_zeros" },
      { "source": "MaterialName", "target": "description", "transform": "direct" },
      { "source": "MatlWrhsStkQtyInMatlBaseUnit", "target": "quantity_on_hand", "transform": "to_decimal" },
      { "source": "ResvdQtyInMatlBaseUnit", "target": "quantity_reserved", "transform": "to_decimal" },
      { "source": null, "target": "quantity_available", "transform": "expression", "expression": "quantity_on_hand - quantity_reserved" },
      { "source": "ReorderPoint", "target": "reorder_point", "transform": "to_decimal" },
      { "source": "MovingAveragePrice", "target": "unit_cost", "transform": "to_decimal" },
      { "source": "Currency", "target": "currency", "transform": "direct" },
      { "source": "Plant", "target": "warehouse_id", "transform": "direct" },
      { "source": "PlantName", "target": "warehouse_name", "transform": "direct" },
      { "source": "StorageLocation", "target": "bin_location", "transform": "direct" },
      { "source": "LastGoodsReceiptDate", "target": "last_receipt_date", "transform": "abap_date_to_iso8601" },
      { "source": "LastGoodsIssueDate", "target": "last_issue_date", "transform": "abap_date_to_iso8601" }
    ],
    "extra_data_mapping": [
      { "source": "MaterialGroup", "key": "material_group" },
      { "source": "MaterialType", "key": "material_type" },
      { "source": "BaseUnit", "key": "base_unit" },
      { "source": "PlannedDeliveryTimeInDays", "key": "lead_time_days" }
    ]
  },
  {
    "name": "SAP Purchase Orders",
    "source_system": "sap_s4hana",
    "target_table": "purchase_orders",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "service": "API_PURCHASEORDER_PROCESS_SRV",
      "entity": "A_PurchaseOrder",
      "odata_params": {
        "$expand": "to_PurchaseOrderItem",
        "$filter": "PurchasingOrganization eq '${PURCHASING_ORG}'"
      },
      "watermark_column": "LastChangeDateTime"
    },
    "field_mapping": [
      { "source": "PurchaseOrder", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "sap_s4hana" },
      { "source": "PurchaseOrder", "target": "po_number", "transform": "direct" },
      { "source": null, "target": "status", "transform": "sap_po_status_normalization" },
      { "source": "Supplier", "target": "vendor_id", "transform": "vendor_fk_lookup" },
      { "source": "SupplierName", "target": "vendor_name", "transform": "direct" },
      { "source": "PurchaseOrderDate", "target": "order_date", "transform": "abap_date_to_iso8601" },
      { "source": null, "target": "expected_delivery_date", "transform": "earliest_line_delivery_date" },
      { "source": null, "target": "total_amount", "transform": "sum_line_values" },
      { "source": "DocumentCurrency", "target": "currency", "transform": "direct" },
      { "source": "CreatedByUser", "target": "created_by_name", "transform": "direct" }
    ],
    "extra_data_mapping": [
      { "source": "PurchasingOrganization", "key": "purchasing_org" },
      { "source": "PurchasingGroup", "key": "purchasing_group" },
      { "source": "CompanyCode", "key": "company_code" }
    ]
  },
  {
    "name": "SAP Purchase Order Lines",
    "source_system": "sap_s4hana",
    "target_table": "purchase_order_lines",
    "schedule": { "cron": "*/15 * * * *", "type": "incremental" },
    "source_config": {
      "note": "Lines are fetched as part of the PO header request via $expand. Processed in the same sync run as purchase_orders.",
      "parent_entity": "A_PurchaseOrder",
      "child_path": "to_PurchaseOrderItem"
    },
    "field_mapping": [
      { "source": "PurchaseOrder", "target": "purchase_order_id", "transform": "parent_fk_lookup" },
      { "source": "PurchaseOrderItem", "target": "line_number", "transform": "to_integer" },
      { "source": "Material", "target": "part_number", "transform": "trim_leading_zeros" },
      { "source": "PurchaseOrderItemText", "target": "description", "transform": "direct" },
      { "source": "OrderQuantity", "target": "quantity_ordered", "transform": "to_decimal" },
      { "source": "GoodsReceiptQuantity", "target": "quantity_received", "transform": "to_decimal" },
      { "source": "NetPriceAmount", "target": "unit_price", "transform": "to_decimal" },
      { "source": "DocumentCurrency", "target": "currency", "transform": "direct" },
      { "source": "DeliveryDate", "target": "delivery_date", "transform": "abap_date_to_iso8601" }
    ],
    "extra_data_mapping": [
      { "source": "Plant", "key": "plant" },
      { "source": "StorageLocation", "key": "storage_location" },
      { "source": "PurchaseOrderItemCategory", "key": "item_category" }
    ]
  },
  {
    "name": "SAP Vendor Master",
    "source_system": "sap_s4hana",
    "target_table": "vendor_master",
    "schedule": { "cron": "0 3 * * 0", "type": "full" },
    "source_config": {
      "service": "API_BUSINESS_PARTNER",
      "entity": "A_Supplier",
      "odata_params": {
        "$expand": "to_SupplierCompany,to_SupplierPurchasingOrg",
        "$filter": "SupplierIsBlocked eq ''"
      },
      "watermark_column": "LastChangeDateTime"
    },
    "field_mapping": [
      { "source": "Supplier", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "sap_s4hana" },
      { "source": "Supplier", "target": "vendor_code", "transform": "trim_leading_zeros" },
      { "source": "SupplierName", "target": "name", "transform": "direct" },
      { "source": "StreetName", "target": "address", "transform": "direct" },
      { "source": "CityName", "target": "city", "transform": "direct" },
      { "source": "Region", "target": "state", "transform": "direct" },
      { "source": "Country", "target": "country", "transform": "direct" },
      { "source": null, "target": "contact_name", "transform": "null" },
      { "source": "EmailAddress", "target": "contact_email", "transform": "direct" },
      { "source": "PhoneNumber", "target": "contact_phone", "transform": "direct" },
      { "source": "PaymentTerms", "target": "payment_terms", "transform": "sap_payment_terms_lookup" },
      { "source": "PlannedDeliveryTime", "target": "lead_time_days", "transform": "to_integer" },
      { "source": null, "target": "performance_rating", "transform": "null" }
    ],
    "extra_data_mapping": [
      { "source": "SupplierAccountGroup", "key": "vendor_group" },
      { "source": "PurchasingOrganization", "key": "purchasing_org" }
    ]
  },
  {
    "name": "SAP Cost Centers",
    "source_system": "sap_s4hana",
    "target_table": "cost_centers",
    "schedule": { "cron": "0 3 * * *", "type": "full" },
    "source_config": {
      "service": "API_COSTCENTER_SRV",
      "entity": "A_CostCenter",
      "odata_params": {
        "$filter": "ControllingArea eq '${CONTROLLING_AREA}' and FiscalYear eq '${FISCAL_YEAR}'"
      },
      "watermark_column": null
    },
    "field_mapping": [
      { "source": "CostCenter", "target": "external_id", "transform": "direct" },
      { "source": null, "target": "source_system", "transform": "constant", "value": "sap_s4hana" },
      { "source": "CostCenter", "target": "code", "transform": "trim_leading_zeros" },
      { "source": "CostCenterName", "target": "name", "transform": "direct" },
      { "source": "CostCenterDescription", "target": "description", "transform": "direct" },
      { "source": "CostCenterCategory", "target": "parent_id", "transform": "hierarchy_lookup" },
      { "source": null, "target": "budget_amount", "transform": "separate_budget_api_call" },
      { "source": "CurrencyCode", "target": "currency", "transform": "direct" },
      { "source": "FiscalYear", "target": "fiscal_year", "transform": "to_integer" }
    ],
    "extra_data_mapping": [
      { "source": "CompanyCode", "key": "company_code" },
      { "source": "ControllingArea", "key": "controlling_area" },
      { "source": "PersonResponsible", "key": "responsible_person" },
      { "source": "CostCenterCategory", "key": "category" }
    ]
  }
]
```

### Custom Transforms

| Transform ID | Description |
|-------------|-------------|
| `abap_date_to_iso8601` | Parse SAP `/Date(ms)/` format to ISO 8601 timestamp |
| `trim_leading_zeros` | Remove leading zeros from SAP numeric codes (e.g., `000000001234` → `1234`) |
| `sap_po_status_normalization` | Multi-field status derivation per the normalization table above |
| `sap_payment_terms_lookup` | Map SAP ZTERM codes to human-readable strings (e.g., `ZB30` → `Net 30`) |
| `composite_key` | Concatenate multiple fields with separator |
| `earliest_line_delivery_date` | Scan PO line items, return the earliest `DeliveryDate` |
| `sum_line_values` | Sum `NetPriceAmount * OrderQuantity` across all PO lines |
| `vendor_fk_lookup` | Resolve SAP `Supplier` to `vendor_master.id` FK |
| `parent_fk_lookup` | Resolve SAP `PurchaseOrder` to `purchase_orders.id` FK |
| `hierarchy_lookup` | Map SAP cost center category to `cost_centers.id` self-reference |
| `separate_budget_api_call` | Budget data requires a separate CO report API call — not available on the cost center entity directly |

## Notes

- **SAP-side setup required**: OData services must be activated in transaction `/IWFND/MAINT_SERVICE` before I/O can connect. Budget for SAP BASIS/consultant time during initial deployment.
- **Authorization**: SAP Gateway authorization is granular and customer-specific. The integration user needs `S_SERVICE` authorization for each OData service and `S_TABU_DIS` for underlying table access.
- **Cryptic field names**: SAP internal codes (MATNR, WERKS, LGORT, etc.) are used in OData responses. The I/O import wizard should display human-readable aliases alongside SAP codes.
- **On-premise vs Cloud**: S/4HANA Cloud has all OData services activated by default. On-premise deployments may have none activated — verify during site assessment.
- **CSRF tokens**: Some SAP Gateway configurations require a CSRF token even for GET requests. The connector should handle the `X-CSRF-Token: Fetch` / response header flow automatically.
- **Large initial loads**: Material master can exceed 50K records. Use `$top=5000` with pagination. Run initial load during off-hours to avoid SAP Gateway performance impact.
- **Middleware alternative**: Many SAP customers use SAP Integration Suite, MuleSoft, or Dell Boomi as middleware. I/O supports direct OData, but document that middleware is a valid path for customers with existing integration layers.
- **Dual stock queries**: Getting a complete inventory picture requires joining material master (`A_Material`) with stock (`A_MatlStkInAcctMod`). The connector handles this as a two-query join on the `Material` key.
- **I/O is strictly read-only**: No write-back to SAP. PO creation, inventory adjustments, and cost postings remain in SAP.
