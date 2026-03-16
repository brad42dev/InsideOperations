import { useParams } from 'react-router-dom'

export default function ReportGenerator() {
  const { template_id } = useParams<{ template_id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Generate Report</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        Template ID: {template_id} — async report generation (Phase 9)
      </p>
    </div>
  )
}
