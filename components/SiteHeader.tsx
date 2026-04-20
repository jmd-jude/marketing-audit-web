import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="bg-white border-b border-[#E8E4DC] sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex flex-col gap-0.5">
          <span className="font-display text-[#1A1918] text-[15px] tracking-tight leading-none">
            Marketing Intelligence
          </span>
          <span className="text-[#9C9690] text-[10px] tracking-wide leading-none">
            Digital Audits at Digital Speeds
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold text-[#2D4A6E] hover:underline hidden sm:block"
        >
          Run an audit →
        </Link>
      </div>
    </header>
  )
}
