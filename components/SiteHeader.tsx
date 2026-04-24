import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="bg-lr-asphalt sticky top-0 z-30" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="11" fill="none" stroke="#C8313A" strokeWidth="1.8"/>
            <circle cx="14" cy="14" r="4.5" fill="#C8313A"/>
          </svg>
          <div>
            <div className="font-serif text-lr-parchment text-[15px] leading-none tracking-tight">lanterne rouge</div>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold text-lr-parchment/60 hover:text-lr-parchment transition-colors hidden sm:block"
        >
          Run a New Audit
        </Link>
      </div>
    </header>
  )
}
