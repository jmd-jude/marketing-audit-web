export function SiteFooter() {
  return (
    <footer className="border-t border-lr-border bg-lr-white px-6 py-6 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="#C8313A" strokeWidth="1.2"/>
            <circle cx="8" cy="8" r="2.5" fill="#C8313A"/>
          </svg>
          <span className="font-serif text-lr-ink text-sm tracking-tight">lanterne rouge</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-lr-stone">
          <span>© {new Date().getFullYear()} lanternerouge.io</span>
        </div>
      </div>
    </footer>
  )
}
