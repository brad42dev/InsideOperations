import { useRef, useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/auth'

// ---------------------------------------------------------------------------
// Lightweight markdown renderer — handles the subset used in the EULA
// ---------------------------------------------------------------------------

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string }
  | { type: 'empty' }

// Insert a non-breaking space after sentence-ending periods so the browser
// renders the classic double-space gap instead of collapsing it.
function addSentenceSpacing(text: string): string {
  return text.replace(/\.( [A-Z])/g, '.\u00A0$1')
}

function parseInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, and their combinations
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={i}>{addSentenceSpacing(tok.slice(2, -2))}</strong>
    }
    if (tok.startsWith('*') && tok.endsWith('*')) {
      return <em key={i}>{addSentenceSpacing(tok.slice(1, -1))}</em>
    }
    return addSentenceSpacing(tok)
  })
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Heading 1
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2) })
      i++
      continue
    }

    // Heading 2
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) })
      i++
      continue
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Blockquote — consume all consecutive > lines
    if (line.startsWith('>')) {
      const bqLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].slice(1).trimStart())
        i++
      }
      blocks.push({ type: 'blockquote', lines: bqLines })
      continue
    }

    // Unordered list
    if (/^- /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph
    blocks.push({ type: 'p', text: line })
    i++
  }

  return blocks
}

function EulaContent({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)
  // Skip the leading H1 — it's already in the modal header
  const body = blocks[0]?.type === 'h1' ? blocks.slice(1) : blocks

  return (
    <div style={{ color: 'var(--io-text-secondary)', fontSize: '13.5px', lineHeight: 1.7 }}>
      {body.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return null

          case 'h2':
            return (
              <h3
                key={idx}
                style={{
                  margin: '24px 0 8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--io-text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--io-border-subtle)',
                  paddingBottom: '6px',
                }}
              >
                {parseInline(block.text)}
              </h3>
            )

          case 'hr':
            return (
              <hr
                key={idx}
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--io-border)',
                  margin: '20px 0',
                }}
              />
            )

          case 'blockquote': {
            // Parse blockquote lines into sub-blocks (supports nested ul inside blockquote)
            const bqItems: { isBullet: boolean; text: string }[] = block.lines.map(l => ({
              isBullet: l.startsWith('- '),
              text: l.startsWith('- ') ? l.slice(2) : l,
            }))
            return (
              <div
                key={idx}
                style={{
                  margin: '16px 0',
                  padding: '14px 18px',
                  background: 'var(--io-accent-subtle)',
                  borderLeft: '3px solid var(--io-accent)',
                  borderRadius: '0 var(--io-radius) var(--io-radius) 0',
                  color: 'var(--io-text-secondary)',
                  fontSize: '13px',
                }}
              >
                {bqItems.map((item, j) => {
                  if (item.text.trim() === '') return <br key={j} />
                  if (item.isBullet) {
                    return (
                      <div key={j} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--io-accent)', flexShrink: 0, marginTop: '2px' }}>•</span>
                        <span>{parseInline(item.text)}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={j} style={{ marginBottom: '2px' }}>
                      {parseInline(item.text)}
                    </div>
                  )
                })}
              </div>
            )
          }

          case 'ul':
            return (
              <ul
                key={idx}
                style={{
                  margin: '8px 0',
                  paddingLeft: '0',
                  listStyle: 'none',
                }}
              >
                {block.items.map((item, j) => (
                  <li key={j} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--io-text-muted)', flexShrink: 0 }}>–</span>
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol
                key={idx}
                style={{
                  margin: '8px 0',
                  paddingLeft: '0',
                  listStyle: 'none',
                  counterReset: 'eula-ol',
                }}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}
                  >
                    <span
                      style={{
                        color: 'var(--io-accent)',
                        fontWeight: 600,
                        flexShrink: 0,
                        minWidth: '16px',
                      }}
                    >
                      {j + 1}.
                    </span>
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ol>
            )

          case 'p': {
            const text = block.text.trim()
            if (!text) return null
            // Italic-only lines (e.g. the footer attribution) get muted styling
            const isItalicLine = /^\*[^*].+[^*]\*$/.test(text)
            return (
              <p
                key={idx}
                style={{
                  margin: '8px 0',
                  color: isItalicLine ? 'var(--io-text-muted)' : 'var(--io-text-secondary)',
                  fontSize: isItalicLine ? '12px' : undefined,
                }}
              >
                {parseInline(text)}
              </p>
            )
          }

          default:
            return null
        }
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EulaAcceptance page
// ---------------------------------------------------------------------------

export default function EulaAcceptance() {
  const navigate = useNavigate()
  const { user, setEulaAccepted, logout } = useAuthStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const {
    data: eulaData,
    isLoading: eulaLoading,
    isError: eulaError,
  } = useQuery({
    queryKey: ['eula-current'],
    queryFn: async () => {
      const result = await authApi.eulaGetCurrent()
      if (result.success) return result.data
      throw new Error('Failed to load Terms of Use')
    },
    staleTime: 60 * 60 * 1000,
  })

  const acceptMutation = useMutation({
    mutationFn: async (version: string) => {
      const result = await authApi.eulaAccept(version)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      setEulaAccepted(true)
      navigate('/', { replace: true })
    },
    onError: (err: Error) => {
      setAcceptError(err.message ?? 'Failed to record acceptance. Please try again.')
    },
  })

  useEffect(() => {
    if (!eulaData) return
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      const fits = scrollRef.current.scrollHeight <= scrollRef.current.clientHeight + 8
      if (fits) setScrolledToBottom(true)
    })
  }, [eulaData])

  if (user?.eula_accepted === true) {
    return <Navigate to="/" replace />
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (atBottom) setScrolledToBottom(true)
  }

  async function handleDecline() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleAccept() {
    if (!eulaData || !scrolledToBottom) return
    setAcceptError(null)
    acceptMutation.mutate(eulaData.version)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--io-surface-primary)',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius-lg)',
          width: '100%',
          maxWidth: '760px',
          boxShadow: 'var(--io-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '24px 32px 20px',
            borderBottom: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h2
              style={{
                margin: 0,
                color: 'var(--io-text-primary)',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Inside/Operations
            </h2>
            <span style={{ color: 'var(--io-text-muted)', fontSize: '14px', fontWeight: 400 }}>
              Terms of Use
            </span>
            {eulaData && (
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  background: 'var(--io-surface-sunken)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius-sm)',
                  color: 'var(--io-text-muted)',
                  fontSize: '11px',
                  fontFamily: 'var(--io-font-mono)',
                  flexShrink: 0,
                }}
              >
                v{eulaData.version}
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Please read the following terms carefully before using this application.
          </p>
        </div>

        {/* Content area */}
        <div style={{ padding: '0 32px', flex: 1, minHeight: 0 }}>
          {eulaLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--io-text-muted)',
                fontSize: '14px',
              }}
            >
              Loading Terms of Use…
            </div>
          )}

          {eulaError && (
            <div
              style={{
                margin: '24px 0',
                padding: '14px',
                background: 'var(--io-status-error-bg)',
                border: '1px solid var(--io-status-error)',
                borderRadius: 'var(--io-radius-md)',
                color: 'var(--io-status-error)',
                fontSize: '13px',
              }}
            >
              Unable to load the Terms of Use. Please refresh the page or contact your administrator.
            </div>
          )}

          {eulaData && (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                maxHeight: '62vh',
                overflowY: 'scroll',
                padding: '20px 4px 20px 0',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--io-border) transparent',
              }}
            >
              <EulaContent markdown={eulaData.content} />
            </div>
          )}
        </div>

        {/* Footer */}
        {eulaData && (
          <div
            style={{
              padding: '16px 32px',
              borderTop: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
            }}
          >
            {/* Scroll prompt */}
            {!scrolledToBottom && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'var(--io-surface-sunken)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  fontSize: '12px',
                  color: 'var(--io-text-muted)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M8 2v12M4 10l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Scroll to the bottom to enable acceptance
              </div>
            )}

            {/* Error */}
            {acceptError && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  background: 'var(--io-status-error-bg)',
                  border: '1px solid var(--io-status-error)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-status-error)',
                  fontSize: '13px',
                }}
              >
                {acceptError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--io-text-muted)', maxWidth: '420px' }}>
                This is an end-user Terms of Use. The full software license agreement governing your
                organization's rights is available from{' '}
                <span style={{ color: 'var(--io-text-secondary)' }}>Settings → About</span>.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={acceptMutation.isPending}
                  style={{
                    background: 'none',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    padding: '8px 18px',
                    color: 'var(--io-text-secondary)',
                    fontSize: '13px',
                    cursor: acceptMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: acceptMutation.isPending ? 0.5 : 1,
                  }}
                >
                  Decline & Sign Out
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!scrolledToBottom || acceptMutation.isPending}
                  style={{
                    background: scrolledToBottom ? 'var(--io-accent)' : 'var(--io-surface-sunken)',
                    border: '1px solid',
                    borderColor: scrolledToBottom ? 'transparent' : 'var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    padding: '8px 22px',
                    color: scrolledToBottom ? 'var(--io-accent-contrast)' : 'var(--io-text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !scrolledToBottom || acceptMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: acceptMutation.isPending ? 0.7 : 1,
                    transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                  }}
                >
                  {acceptMutation.isPending ? 'Accepting…' : 'I Accept'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
