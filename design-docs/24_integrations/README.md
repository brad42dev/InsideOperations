# Integration Connector Profiles

This folder contains application-specific connector profiles for the Universal Import system (Doc 24). Each file documents how to connect I/O to a specific external application and map its data to I/O's typed internal tables.

## Folder Structure

```
24_integrations/
├── README.md                    (this file)
├── maintenance/                 (CMMS / Work Order systems)
├── equipment/                   (Asset/Equipment Registry sources)
├── access-control/              (Physical Access Control systems)
├── erp-financial/               (ERP and Financial systems)
├── ticketing/                   (ITSM / Help Desk systems)
├── environmental/               (Environmental Monitoring & Compliance)
├── lims-lab/                    (Laboratory Information Management)
└── regulatory/                  (Safety, Compliance & Permit Management)
```

## File Template

Every connector profile follows this structure:

```markdown
# [Application Name] — [Domain] Connector Profile

## Application Overview
- Vendor, product version, market position
- Licensing model for API access
- Typical refinery deployment scenario

## API Surface
- API type (REST, SOAP, OData, database)
- Base URL pattern
- Authentication method and configuration
- Pagination strategy
- Rate limits
- API documentation URL (if public)

## Target Tables
- Which I/O typed tables this connector populates
- Primary table and any secondary tables

## Field Mapping
- Source field → I/O column mapping table
- Required vs optional fields
- Transform rules (type conversions, value normalization, lookups)
- Status/priority value normalization across vendors

## Sync Strategy
- Recommended polling interval
- Watermark column for incremental sync
- Full sync vs incremental
- Initial load considerations

## Pre-Built Import Definition
- Ready-to-use JSONB configuration for the import wizard
- Connection config template
- Source config template
- Field mapping array

## Notes
- Vendor-specific quirks, known issues, version differences
- Alternative integration paths (API vs database direct)
```

## Conventions

- File names use lowercase with hyphens: `sap-pm.md`, `ibm-maximo.md`
- Each file is self-contained — no cross-references between connector profiles
- All connector profiles target I/O's typed internal tables (defined in Doc 04)
- Status/priority values are normalized to I/O's standard enums in the transform step
- Credentials are never included — only configuration templates with placeholder values
