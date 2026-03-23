import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { systemApi, type LicenseEntry } from '../../api/system'
import DataTable from '../../shared/components/DataTable'
import type { ColumnDef } from '../../shared/components/DataTable'

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type LicenseTab = 'backend' | 'frontend'
type ViewMode = 'package' | 'license'

// ---------------------------------------------------------------------------
// License text expander (inline expandable row outside the DataTable)
// ---------------------------------------------------------------------------

function LicenseTextRow({ text }: { text: string }) {
  if (!text) {
    return (
      <div style={{ padding: '8px 16px', color: 'var(--io-text-muted)', fontSize: '12px' }}>
        No license text available.
      </div>
    )
  }
  return (
    <pre
      style={{
        margin: 0,
        padding: '12px 16px',
        fontSize: '11px',
        fontFamily: 'var(--io-font-mono)',
        color: 'var(--io-text-secondary)',
        background: 'var(--io-surface-sunken, var(--io-surface-primary))',
        borderTop: '1px solid var(--io-border)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '300px',
        overflowY: 'auto',
      }}
    >
      {text}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// By-Package view — uses DataTable with expandable rows
// ---------------------------------------------------------------------------

function PackageTable({ data, loading }: { data: LicenseEntry[]; loading: boolean }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const columns: ColumnDef<LicenseEntry>[] = [
    {
      id: 'name',
      header: 'Package',
      accessorKey: 'name',
      sortable: true,
      filterType: 'text',
      width: 220,
      minWidth: 120,
    },
    {
      id: 'version',
      header: 'Version',
      accessorKey: 'version',
      sortable: true,
      width: 110,
      minWidth: 80,
    },
    {
      id: 'license',
      header: 'License',
      accessorKey: 'license',
      sortable: true,
      filterType: 'text',
      width: 160,
      minWidth: 100,
      cell: (value) => (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'var(--io-surface-sunken)',
            color: 'var(--io-text-muted)',
            border: '1px solid var(--io-border)',
            whiteSpace: 'nowrap',
          }}
        >
          {String(value ?? '')}
        </span>
      ),
    },
    {
      id: 'copyright',
      header: 'Copyright',
      accessorKey: 'copyright',
      sortable: false,
      width: 280,
      minWidth: 120,
    },
    {
      id: 'expand',
      header: '',
      width: 48,
      minWidth: 48,
      cell: (_value, row) => {
        const key = `${row.name}@${row.version}`
        const isOpen = expandedRow === key
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpandedRow(isOpen ? null : key)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: '12px',
              padding: '0 4px',
            }}
            title={isOpen ? 'Collapse license text' : 'Expand license text'}
          >
            {isOpen ? '▲' : '▼'}
          </button>
        )
      },
    },
  ]

  return (
    <div>
      <DataTable<LicenseEntry>
        data={data}
        columns={columns}
        height={420}
        loading={loading}
        emptyMessage="No license data available"
        showExport={false}
        onRowClick={(row) => {
          const key = `${row.name}@${row.version}`
          setExpandedRow(expandedRow === key ? null : key)
        }}
      />
      {expandedRow && (() => {
        const entry = data.find((d) => `${d.name}@${d.version}` === expandedRow)
        if (!entry) return null
        return (
          <div
            style={{
              border: '1px solid var(--io-border)',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
            }}
          >
            <div
              style={{
                padding: '6px 16px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                background: 'var(--io-surface-secondary)',
                borderTop: '1px solid var(--io-border)',
              }}
            >
              {entry.name} {entry.version} — {entry.license}
            </div>
            <LicenseTextRow text={entry.text} />
          </div>
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// By-License view — grouped list
// ---------------------------------------------------------------------------

function ByLicenseView({ data }: { data: LicenseEntry[] }) {
  const [expandedLicense, setExpandedLicense] = useState<string | null>(null)
  const [expandedText, setExpandedText] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, LicenseEntry[]>()
    for (const entry of data) {
      const key = entry.license || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [data])

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '13px',
        }}
      >
        No license data available
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {grouped.map(([licenseName, entries]) => {
        const isOpen = expandedLicense === licenseName
        return (
          <div
            key={licenseName}
            style={{
              border: '1px solid var(--io-border)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {/* License group header */}
            <div
              onClick={() => setExpandedLicense(isOpen ? null : licenseName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                cursor: 'pointer',
                background: 'var(--io-surface-secondary)',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    padding: '1px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'var(--io-surface-sunken)',
                    color: 'var(--io-text-muted)',
                    border: '1px solid var(--io-border)',
                  }}
                >
                  {licenseName}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                  {entries.length} {entries.length === 1 ? 'package' : 'packages'}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--io-text-muted)' }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {/* Package list */}
            {isOpen && (
              <div>
                {entries.map((entry) => {
                  const key = `${licenseName}::${entry.name}@${entry.version}`
                  const textOpen = expandedText === key
                  return (
                    <div
                      key={key}
                      style={{ borderTop: '1px solid var(--io-border-subtle, var(--io-border))' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 14px',
                          background: 'var(--io-surface-primary)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--io-text-primary)',
                            }}
                          >
                            {entry.name}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'var(--io-font-mono)',
                              color: 'var(--io-text-muted)',
                            }}
                          >
                            {entry.version}
                          </span>
                          {entry.copyright && (
                            <span
                              style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}
                            >
                              {entry.copyright}
                            </span>
                          )}
                        </div>
                        {entry.text && (
                          <button
                            onClick={() => setExpandedText(textOpen ? null : key)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--io-text-muted)',
                              fontSize: '11px',
                              padding: '0 4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {textOpen ? 'Hide text' : 'View text'}
                          </button>
                        )}
                      </div>
                      {textOpen && <LicenseTextRow text={entry.text} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<LicenseTab>('backend')
  const [viewMode, setViewMode] = useState<ViewMode>('package')
  const [searchFilter, setSearchFilter] = useState('')

  // Fetch about info
  const aboutQuery = useQuery({
    queryKey: ['system', 'about'],
    queryFn: async () => {
      const result = await systemApi.about()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    retry: 1,
    staleTime: 60_000,
  })

  // Fetch backend licenses
  const backendQuery = useQuery({
    queryKey: ['system', 'licenses', 'backend'],
    queryFn: async () => {
      const result = await systemApi.licensesBackend()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 300_000,
  })

  // Fetch frontend licenses
  const frontendQuery = useQuery({
    queryKey: ['system', 'licenses', 'frontend'],
    queryFn: async () => {
      const result = await systemApi.licensesFrontend()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 300_000,
  })

  // SBOM download
  const [sbomDownloading, setSbomDownloading] = useState(false)

  async function handleSbomDownload() {
    setSbomDownloading(true)
    try {
      const res = await systemApi.downloadSbom()
      if (!res.ok) {
        throw new Error(`SBOM download failed: ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'io-sbom.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('SBOM download error:', err)
    } finally {
      setSbomDownloading(false)
    }
  }

  // Active license data filtered by search
  const rawLicenses =
    activeTab === 'backend' ? (backendQuery.data ?? []) : (frontendQuery.data ?? [])
  const isLicensesLoading =
    activeTab === 'backend' ? backendQuery.isLoading : frontendQuery.isLoading

  const filteredLicenses = useMemo(() => {
    if (!searchFilter.trim()) return rawLicenses
    const q = searchFilter.toLowerCase()
    return rawLicenses.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.license.toLowerCase().includes(q) ||
        e.copyright.toLowerCase().includes(q),
    )
  }, [rawLicenses, searchFilter])

  const about = aboutQuery.data

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* Logo / title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '24px',
          padding: '24px',
          background: 'var(--io-surface-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--io-border)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'var(--io-accent-subtle)',
            border: '1px solid var(--io-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: 'var(--io-accent)',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
            }}
          >
            I/O
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
            }}
          >
            Inside/Operations
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Industrial Process Monitoring Platform
          </div>
        </div>
        {/* SBOM download */}
        <button
          onClick={handleSbomDownload}
          disabled={sbomDownloading}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid var(--io-border)',
            borderRadius: '6px',
            background: 'var(--io-surface-primary)',
            color: 'var(--io-text-primary)',
            cursor: sbomDownloading ? 'not-allowed' : 'pointer',
            opacity: sbomDownloading ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {sbomDownloading ? 'Downloading…' : 'Download SBOM'}
        </button>
      </div>

      {/* Application info grid */}
      <div
        style={{
          marginBottom: '28px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          background: 'var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--io-border)',
        }}
      >
        {aboutQuery.isLoading
          ? [
              { label: 'Version', value: '—' },
              { label: 'Build', value: '—' },
              { label: 'Server', value: '—' },
              { label: 'EULA Version', value: '—' },
            ].map((row) => (
              <div
                key={row.label}
                style={{ padding: '12px 16px', background: 'var(--io-surface-secondary)' }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '4px',
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--io-text-muted)',
                    fontWeight: 500,
                    animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                >
                  Loading…
                </div>
              </div>
            ))
          : [
              { label: 'Version', value: about?.version ?? 'N/A' },
              { label: 'Build', value: about?.build ?? 'N/A' },
              { label: 'Server', value: about?.serverHostname ?? 'N/A' },
              { label: 'EULA Version', value: about?.eulaVersion ?? 'N/A' },
            ].map((row) => (
              <div
                key={row.label}
                style={{ padding: '12px 16px', background: 'var(--io-surface-secondary)' }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '4px',
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--io-text-primary)',
                    fontWeight: 500,
                    fontFamily: row.label === 'Build' ? 'var(--io-font-mono)' : undefined,
                  }}
                >
                  {row.value}
                </div>
              </div>
            ))}
      </div>

      {/* Licenses section */}
      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--io-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            flex: 1,
          }}
        >
          Open Source Licenses
        </h3>

        {/* View toggle */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--io-border)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {(['package', 'license'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background:
                  viewMode === mode
                    ? 'var(--io-accent-subtle)'
                    : 'var(--io-surface-secondary)',
                color:
                  viewMode === mode
                    ? 'var(--io-accent)'
                    : 'var(--io-text-secondary)',
                transition: 'background 0.1s',
              }}
            >
              {mode === 'package' ? 'By Package' : 'By License'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar: Backend / Frontend */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--io-border)',
          marginBottom: '12px',
          gap: '0',
        }}
      >
        {(['backend', 'frontend'] as LicenseTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color:
                activeTab === tab
                  ? 'var(--io-accent)'
                  : 'var(--io-text-secondary)',
              borderBottom: activeTab === tab
                ? '2px solid var(--io-accent)'
                : '2px solid transparent',
              transition: 'color 0.1s',
            }}
          >
            {tab === 'backend' ? 'Backend' : 'Frontend'}
            <span
              style={{
                marginLeft: '6px',
                fontSize: '11px',
                color: 'var(--io-text-muted)',
                fontWeight: 400,
              }}
            >
              {tab === 'backend'
                ? (backendQuery.data?.length ?? 0)
                : (frontendQuery.data?.length ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Search filter */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search packages, licenses…"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 12px',
            fontSize: '13px',
            border: '1px solid var(--io-border)',
            borderRadius: '6px',
            background: 'var(--io-surface-primary)',
            color: 'var(--io-text-primary)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* License table / grouped view */}
      {viewMode === 'package' ? (
        <PackageTable data={filteredLicenses} loading={isLicensesLoading} />
      ) : (
        <ByLicenseView data={filteredLicenses} />
      )}

      {/* Footer note */}
      <p
        style={{
          marginTop: '20px',
          marginBottom: '8px',
          fontSize: '12px',
          color: 'var(--io-text-muted)',
          lineHeight: 1.6,
        }}
      >
        The full Inside/Operations Software License Agreement governing your
        organization&rsquo;s rights is provided at installation time and is accessible to
        administrators under{' '}
        <span style={{ color: 'var(--io-text-secondary)' }}>Settings &rarr; EULA</span>.
        Contact{' '}
        <a href="mailto:legal@in-ops.com" style={{ color: 'var(--io-accent)' }}>
          legal@in-ops.com
        </a>{' '}
        for a copy.
      </p>

      <style>{`
        @keyframes io-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
