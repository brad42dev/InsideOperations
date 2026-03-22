import { ExportButton } from '../../shared/components/ExportDialog'

// Column definitions for points_metadata
const POINTS_COLUMNS = [
  { id: 'id', label: 'ID' },
  { id: 'tag_name', label: 'Tag Name' },
  { id: 'display_name', label: 'Display Name' },
  { id: 'description', label: 'Description' },
  { id: 'unit', label: 'Unit' },
  { id: 'data_type', label: 'Data Type' },
  { id: 'opc_node_id', label: 'OPC Node ID' },
  { id: 'source_id', label: 'Source ID' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'created_at', label: 'Created At' },
  { id: 'updated_at', label: 'Updated At' },
]

const DEFAULT_VISIBLE_COLUMNS = ['tag_name', 'display_name', 'description', 'unit', 'data_type', 'enabled']

export default function PointManagement() {
  // Row counts will come from actual data queries in a future phase;
  // for now we pass zeroes which will show "0 rows" in the export dialog
  // without breaking the component tree.
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Points
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
            OPC UA point configuration and metadata
          </p>
        </div>

        <ExportButton
          module="settings"
          entity="points"
          filteredRowCount={0}
          totalRowCount={0}
          availableColumns={POINTS_COLUMNS}
          visibleColumns={DEFAULT_VISIBLE_COLUMNS}
        />
      </div>

      <p style={{ color: 'var(--io-text-secondary)', fontSize: '14px' }}>
        Full point management UI — Phase 7
      </p>
    </div>
  )
}
