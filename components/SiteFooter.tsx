export function SiteFooter() {
  return (
    <footer className="border-t border-[#E8E4DC] bg-white px-6 py-6 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="font-display text-[#1A1918] text-sm tracking-tight">
          
        </span>
        <div className="flex items-center gap-6 text-xs text-[#9C9690]">
          
          <span>© {new Date().getFullYear()} Hoffner Marketing</span>
        </div>
      </div>
    </footer>
  )
}
