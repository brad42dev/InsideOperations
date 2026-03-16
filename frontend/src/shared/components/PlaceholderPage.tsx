interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--io-text-muted)',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px dashed var(--io-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}
      >
        ⋯
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--io-text-secondary)',
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: '13px' }}>
        {description ?? 'This module will be available in a future phase.'}
      </p>
    </div>
  )
}
