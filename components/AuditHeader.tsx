'use client'

import Link from 'next/link'

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ts
  }
}

export function AuditHeader({
  url,
  auditor,
  timestamp,
}: {
  url?: string
  auditor?: string
  timestamp?: string
}) {
  const meta = [auditor, timestamp ? fmtDate(timestamp) : null].filter(Boolean).join(' · ')

  return (
    <header
      className="bg-lr-asphalt"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        zIndex: 200,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 20,
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, textDecoration: 'none' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="11" fill="none" stroke="#C8313A" strokeWidth="1.8" />
          <circle cx="14" cy="14" r="4.5" fill="#C8313A" />
        </svg>
        <span className="font-serif text-lr-parchment" style={{ fontSize: 16, letterSpacing: '-0.2px', lineHeight: 1 }}>
          lanterne rouge
        </span>
      </Link>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lr-parchment/65 hover:text-lr-parchment transition-colors"
            style={{
              fontSize: 13,
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {url}
          </a>
        )}
      </div>

      <Link
        href="/"
        className="text-lr-parchment/60 hover:text-lr-parchment transition-colors"
        style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        Run a New Audit
      </Link>

      {meta && (
        <div className="text-lr-stone" style={{ fontSize: 11, flexShrink: 0, textAlign: 'right', lineHeight: 1.6 }}>
          {meta}
        </div>
      )}
    </header>
  )
}
