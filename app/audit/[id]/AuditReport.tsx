'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>

const AGENT_LABELS: Record<string, string> = {
  content:     'Content & Messaging',
  conversion:  'Conversion / CRO',
  technical:   'SEO & Technical',
  strategy:    'Brand & Growth Strategy',
  competitive: 'Competitive Positioning',
}

const AGENT_ORDER = ['content', 'conversion', 'technical', 'strategy', 'competitive']

// ── Download helpers ──────────────────────────────────────────────────────────

function slugFromUrl(url: string) {
  return (url || 'audit').replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function generateMarkdown(data: D): string {
  const date = new Date(data.timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const L: string[] = []
  const push = (s?: string) => L.push(s ?? '')

  push(`# Site Audit: ${data.url}`)
  push(`**Date:** ${date}`)
  if (data.auditor) push(`**Auditor:** ${data.auditor}`)
  push(`**Composite Score:** ${data.compositeScore}/100`)
  push('')

  const m = data.pageMetadata
  if (m) {
    push('## Page Metadata')
    if (m.title)           push(`**Title:** ${m.title}`)
    if (m.metaDescription) push(`**Meta Description:** ${m.metaDescription}`)
    if (m.h1s?.length)     push(`**H1s:** ${m.h1s.join(' / ')}`)
    if (m.wordCount)       push(`**Word Count:** ~${m.wordCount.toLocaleString()}`)
    if (m.canonical)       push(`**Canonical:** ${m.canonical}`)
    if (m.metaRobots)      push(`**Robots:** ${m.metaRobots}`)
    if (m.generator)       push(`**Generator:** ${m.generator}`)
    const flags: string[] = []
    if (m.hasStructuredData) flags.push('Structured Data')
    if (m.hasOgTags)         flags.push('OG Tags')
    if (flags.length)        push(`**Signals:** ${flags.join(', ')}`)
    push('')
  }

  if (Array.isArray(data.pagesAnalyzed) && data.pagesAnalyzed.length) {
    push('## Interior Pages Analyzed')
    data.pagesAnalyzed.forEach((p: D) => {
      push(`- **${p.url}** — ${p.status}${p.chars ? ` (${(p.chars / 1000).toFixed(1)}k chars)` : ''}`)
    })
    push('')
  }

  if (data.gscContext) {
    push('## Search Console Data')
    push(data.gscContext)
    push('')
  }

  if (data.ga4Context) {
    push('## Google Analytics 4 Data')
    push(data.ga4Context)
    push('')
  }

  const s = data.summary ?? {}
  if (s.overall_verdict || s.top_priorities?.length || s.quick_wins?.length) {
    push('## Summary')
    if (s.overall_verdict) {
      push('### Overall Verdict')
      push(s.overall_verdict)
      push('')
    }
    if (s.top_priorities?.length) {
      push('### Top Priorities')
      s.top_priorities.forEach((p: D) => {
        push(`**${p.rank}. ${p.area}**`)
        push(p.finding)
        if (p.action) push(`→ ${p.action}`)
        push('')
      })
    }
    if (s.quick_wins?.length) {
      push('### Quick Wins')
      s.quick_wins.forEach((w: string) => push(`- ${w}`))
      push('')
    }
  }

  ;(data.agents ?? []).forEach((ag: D) => {
    const label = AGENT_LABELS[ag.key] ?? ag.key
    const r: D = ag.result ?? {}
    push(`## ${label}`)
    if (ag.score != null) push(`**Score:** ${ag.score}/100`)
    push('')

    if (r.dimensions?.length) {
      push('### Dimensions')
      r.dimensions.forEach((d: D) => push(`**${d.name}:** ${d.score}/10${d.finding ? ` — ${d.finding}` : ''}`))
      push('')
    }
    if (r.wins?.length) {
      push('### Strengths')
      r.wins.forEach((w: string) => push(`- ${w}`))
      push('')
    }
    if (r.critical_fixes?.length) {
      push('### Critical Fixes')
      r.critical_fixes.forEach((f: string) => push(`- ${f}`))
      push('')
    }
    if (r.before_after?.length) {
      push('### Copy Rewrites')
      r.before_after.forEach((ba: D) => {
        push(`**${ba.element}**`)
        push('| | |')
        push('|---|---|')
        push(`| Before | ${ba.before} |`)
        push(`| After | ${ba.after} |`)
        if (ba.why) push(`*${ba.why}*`)
        push('')
      })
    }
    if (r.quick_wins?.length) {
      push('### Quick Wins')
      r.quick_wins.forEach((w: string) => push(`- ${w}`))
      push('')
    }
    if (r.funnel_leaks?.length) {
      push('### Funnel Leaks')
      r.funnel_leaks.forEach((l: D) => {
        push(`**[${l.severity}] ${l.stage}:** ${l.issue}`)
        if (l.fix) push(`→ ${l.fix}`)
        push('')
      })
    }
    if (r.ab_tests?.length) {
      push('### A/B Test Ideas')
      r.ab_tests.forEach((t: D) => {
        push(`- *${t.hypothesis}*`)
        push(`  Metric: ${t.metric}${t.impact ? ` · Impact: ${t.impact}` : ''}`)
      })
      push('')
    }
    if (r.pagespeed) {
      const ps: D = r.pagespeed
      push('### PageSpeed')
      push('| Performance | Accessibility | SEO | Best Practices |')
      push('|---|---|---|---|')
      push(`| ${ps.performance ?? '—'} | ${ps.accessibility ?? '—'} | ${ps.seo ?? '—'} | ${ps.best_practices ?? '—'} |`)
      const cwv = [['LCP', ps.lcp], ['CLS', ps.cls], ['TBT', ps.tbt], ['FCP', ps.fcp]].filter(([, v]) => v)
      if (cwv.length) push(cwv.map(([k, v]) => `**${k}:** ${v}`).join(' · '))
      push('')
    }
    if (r.seo_quick_wins?.length) {
      push('### SEO Quick Wins')
      r.seo_quick_wins.forEach((w: string) => push(`- ${w}`))
      push('')
    }
    if (r.technical_issues?.length) {
      push('### Technical Issues')
      r.technical_issues.forEach((i: D) => {
        push(`**[${i.severity}] ${i.issue}**`)
        if (i.impact) push(i.impact)
        if (i.fix) push(`→ ${i.fix}`)
        push('')
      })
    }
    if (r.tracking_status?.length) {
      push('### Tracking Status')
      r.tracking_status.forEach((t: D) => push(`- **${t.tool}:** ${t.present ? 'Present' : 'Missing'}${t.notes ? ` — ${t.notes}` : ''}`))
      push('')
    }
    if (r.likely_competitors?.length) {
      push('### Competitors')
      r.likely_competitors.forEach((c: D) => {
        push(`**${c.name}**`)
        push(`Strength: ${c.strength}`)
        push(`Weakness: ${c.weakness}`)
        push('')
      })
    }
    if (r.opportunities?.length) {
      push('### Opportunities')
      r.opportunities.forEach((o: D) => {
        push(`**${o.title}**`)
        push(o.description)
        push('')
      })
    }
    if (r.recommended_actions?.length) {
      push('### Recommended Actions')
      r.recommended_actions.forEach((a: string) => push(`- ${a}`))
      push('')
    }
    if (r.biggest_lever) {
      const lever = r.biggest_lever
      const rec = typeof lever === 'object' && lever !== null ? lever.recommendation : lever
      const why = typeof lever === 'object' && lever !== null ? lever.why : null
      push('### Biggest Lever')
      push(rec)
      if (why) push(`*${why}*`)
      push('')
    }
    if (r.revenue_opportunities) {
      const rev: D = r.revenue_opportunities
      push('### Revenue Opportunities')
      const revTier = (items: D[], tierLabel: string) => {
        if (!items?.length) return
        push(`**${tierLabel}**`)
        items.forEach((i: D) => push(`- [${i.effort}] ${i.opportunity}${i.impact ? ` — ${i.impact}` : ''}`))
      }
      revTier(rev.quick_wins, 'Quick Wins')
      revTier(rev.medium_term, 'Medium Term')
      revTier(rev.strategic, 'Strategic')
      push('')
    }
    if (r.brand_score != null || r.growth_score != null) {
      push('### Brand & Growth Scores')
      if (r.brand_score != null) push(`**Brand Score:** ${r.brand_score}`)
      if (r.growth_score != null) push(`**Growth Score:** ${r.growth_score}`)
      push('')
    }
  })

  return L.join('\n')
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return 'text-[#15803D]'
  if (s >= 40) return 'text-[#B45309]'
  return 'text-[#B91C1C]'
}

function dimColor(s: number) {
  if (s >= 7) return 'bg-[#15803D]'
  if (s >= 4) return 'bg-[#B45309]'
  return 'bg-[#B91C1C]'
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

function fmtMs(ms: number) {
  return ms ? (ms / 1000).toFixed(1) + 's' : '—'
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ── Signal detection ──────────────────────────────────────────────────────────

function detectSignals(msg: string) {
  if (!msg) return {} as Record<string, boolean>
  const m = msg.toLowerCase()
  return {
    html:        msg.length > 200,
    pagespeed:   m.includes('pagespeed') || m.includes('lighthouse') || m.includes('core web vitals'),
    gsc:         m.includes('search console') || m.includes('gsc') || m.includes('impressions') || m.includes('clicks'),
    ga4:         m.includes('google analytics') || m.includes('ga4') || m.includes('sessions') || m.includes('pageviews'),
    dataforseo:  m.includes('dataforseo') || m.includes('domain rank') || m.includes('organic traffic') || m.includes('keyword count'),
    competitors: m.includes('competitor') || m.includes('competing domain'),
    interior:    m.includes('## interior page'),
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <div className="text-[12px] font-bold mt-3 mb-1 pb-0.5 border-b border-[#CDD1D8] text-[#1C1E21]">{children}</div>,
  h2: ({ children }: { children?: React.ReactNode }) => <div className="text-[12px] font-bold mt-3 mb-1 pb-0.5 border-b border-[#CDD1D8] text-[#1C1E21]">{children}</div>,
  h3: ({ children }: { children?: React.ReactNode }) => <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mt-2 mb-1">{children}</div>,
  p:  ({ children }: { children?: React.ReactNode }) => <p className="text-[12px] text-[#1C1E21] leading-relaxed mb-1.5">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-[12px] text-[#1C1E21]">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-[12px] text-[#1C1E21]">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-[#1C1E21]">{children}</strong>,
  table: ({ children }: { children?: React.ReactNode }) => <table className="w-full border-collapse text-[11px] font-mono mb-2">{children}</table>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="text-left font-bold px-2 py-1 border-b-2 border-[#CDD1D8] text-[#606770]">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-2 py-1 border-b border-[#DDE1E7] align-top">{children}</td>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="bg-[#EAECF0] px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
}

function MdContent({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {children}
    </ReactMarkdown>
  )
}

// ── Richness grid ─────────────────────────────────────────────────────────────

function RichnessItem({ status, name, detail }: { status: 'present' | 'absent' | 'partial'; name: string; detail: string }) {
  const styles = {
    present: 'bg-[#D1FAE5] border-[#A7F3D0] text-[#065F46]',
    absent:  'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]',
    partial: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
  }
  const detailStyles = {
    present: 'text-[#047857]',
    absent:  'text-[#B91C1C]',
    partial: 'text-[#92400E]',
  }
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${styles[status]}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${styles[status]}`}>{name}</div>
      <div className={`text-[11px] ${detailStyles[status]}`}>{detail}</div>
    </div>
  )
}

// ── Collapsible ───────────────────────────────────────────────────────────────

function Collapsible({
  label,
  meta,
  children,
}: {
  label: string
  meta?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-[#DDE1E7] rounded-[10px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-[1.1rem] py-3 text-left hover:bg-[#F0F2F5] transition-colors"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#606770]">{label}</span>
        <div className="flex items-center gap-3 text-[11px] text-[#606770]">
          {meta}
          <span className={`text-[10px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-[#DDE1E7] px-[1.1rem] py-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sev badge ─────────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    critical: 'bg-[#FEE2E2] text-[#991B1B]',
    high:     'bg-[#FEF3C7] text-[#92400E]',
    medium:   'bg-[#E0F2FE] text-[#0C4A6E]',
    low:      'bg-[#F0FDF4] text-[#166534]',
  }
  const cls = map[sev?.toLowerCase()] ?? 'bg-[#EAECF0] text-[#606770]'
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${cls}`}>
      {sev}
    </span>
  )
}

// ── Formatted report renderers ────────────────────────────────────────────────

function Dimensions({ dims }: { dims: D[] }) {
  if (!dims?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Dimensions</div>
      <div className="space-y-1.5">
        {dims.map((d) => (
          <div key={d.name}>
            <div className="flex items-center gap-3">
              <span className="w-40 flex-shrink-0 text-[12px] font-medium text-[#1C1E21]">{d.name}</span>
              <div className="flex-1 bg-[#EAECF0] rounded-full h-[5px]">
                <div className={`h-[5px] rounded-full ${dimColor(d.score)}`} style={{ width: `${d.score * 10}%` }} />
              </div>
              <span className={`w-10 text-right text-[11px] font-bold tabular-nums flex-shrink-0 ${scoreColor(d.score * 10)}`}>
                {d.score}<span className="text-[#606770] font-normal">/10</span>
              </span>
            </div>
            {d.finding && (
              <p className="text-[11px] text-[#606770] mt-0.5 pl-[11rem] leading-snug">{d.finding}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StringList({ items, label, marker, markerClass }: {
  items: string[]
  label: string
  marker: string
  markerClass: string
}) {
  if (!items?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">{label}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 text-[12px] text-[#1C1E21] leading-relaxed relative pl-4">
            <span className={`absolute left-0 font-bold ${markerClass}`}>{marker}</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function BiggestLever({ lever }: { lever: D | string }) {
  if (!lever) return null
  const isObj = typeof lever === 'object' && lever !== null
  const recommendation = isObj ? lever.recommendation : lever
  const why = isObj ? lever.why : null
  if (!recommendation) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Biggest Lever</div>
      <div className="bg-[#E7F0FF] border border-[#BFCFE8] rounded-lg px-3.5 py-3 text-[13px] text-[#1C1E21] leading-relaxed">
        {recommendation}
        {why && <div className="text-[11px] text-[#606770] mt-1.5">{why}</div>}
      </div>
    </div>
  )
}

function CopyRewrites({ items }: { items: D[] }) {
  if (!items?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Copy Rewrites</div>
      <div className="space-y-2.5">
        {items.map((ba, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg overflow-hidden">
            <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#606770]">
              {ba.element}
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#DDE1E7]">
              <div className="px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#B91C1C] mb-1">Before</div>
                <p className="text-[11px] text-[#1C1E21] leading-relaxed">{ba.before}</p>
              </div>
              <div className="px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] mb-1">After</div>
                <p className="text-[11px] text-[#1C1E21] leading-relaxed">{ba.after}</p>
              </div>
            </div>
            {ba.why && (
              <div className="border-t border-[#DDE1E7] px-3.5 py-2 text-[11px] text-[#606770] italic">{ba.why}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FunnelLeaks({ leaks }: { leaks: D[] }) {
  if (!leaks?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Funnel Leaks</div>
      <div className="space-y-2">
        {leaks.map((l, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <SevBadge sev={l.severity} />
              <span className="text-[12px] font-semibold text-[#1C1E21]">{l.stage}</span>
            </div>
            <p className="text-[11px] text-[#606770] leading-relaxed mb-1.5">{l.issue}</p>
            {l.fix && (
              <p className="text-[11px] text-[#1C1E21] leading-relaxed">
                <span className="text-[#15803D] font-bold">→ </span>{l.fix}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AbTests({ tests }: { tests: D[] }) {
  if (!tests?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">A/B Test Ideas</div>
      <div className="space-y-2">
        {tests.map((t, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg px-3.5 py-3">
            <p className="text-[12px] text-[#1C1E21] italic leading-relaxed mb-1.5">{t.hypothesis}</p>
            <div className="flex gap-4 text-[11px] text-[#606770]">
              {t.metric && <span><span className="font-semibold text-[#1C1E21]">Metric:</span> {t.metric}</span>}
              {t.impact && <span><span className="font-semibold text-[#1C1E21]">Impact:</span> {t.impact}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PageSpeed({ ps }: { ps: D }) {
  if (!ps) return null
  function psClass(v: number) {
    if (v >= 90) return { pill: 'bg-[#F0FDF4] border-[#BBF7D0]', num: 'text-[#15803D]' }
    if (v >= 50) return { pill: 'bg-[#FFFBEB] border-[#FDE68A]', num: 'text-[#B45309]' }
    return { pill: 'bg-[#FEF2F2] border-[#FECACA]', num: 'text-[#B91C1C]' }
  }
  const metrics = [
    ['Performance', ps.performance],
    ['Accessibility', ps.accessibility],
    ['SEO', ps.seo],
    ['Best Practices', ps.best_practices],
  ] as [string, number][]
  const cwv = [['LCP', ps.lcp], ['CLS', ps.cls], ['TBT', ps.tbt], ['FCP', ps.fcp]].filter(([, v]) => v) as [string, string][]

  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">PageSpeed</div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {metrics.map(([label, val]) => {
          const c = psClass(val)
          return (
            <div key={label} className={`border rounded-lg text-center px-2 py-2.5 ${c.pill}`}>
              <div className={`text-base font-black tabular-nums leading-none ${c.num}`}>{val}</div>
              <div className="text-[9px] text-[#606770] mt-1">{label}</div>
            </div>
          )
        })}
      </div>
      {cwv.length > 0 && (
        <div className="flex gap-4 flex-wrap text-[11px] text-[#606770]">
          {cwv.map(([k, v]) => (
            <span key={k}><span className="font-semibold text-[#1C1E21]">{k}</span> {v}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function TechnicalIssues({ issues }: { issues: D[] }) {
  if (!issues?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Technical Issues</div>
      <div className="space-y-2">
        {issues.map((iss, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <SevBadge sev={iss.severity} />
              <span className="text-[12px] font-semibold text-[#1C1E21]">{iss.issue}</span>
            </div>
            {iss.impact && <p className="text-[11px] text-[#606770] leading-relaxed mb-1.5">{iss.impact}</p>}
            {iss.fix && (
              <p className="text-[11px] text-[#1C1E21] leading-relaxed">
                <span className="text-[#15803D] font-bold">→ </span>{iss.fix}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TrackingStatus({ tracking }: { tracking: D[] }) {
  if (!tracking?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Tracking Status</div>
      <div className="space-y-1.5">
        {tracking.map((t, i) => (
          <div key={i} className="flex items-baseline gap-3 text-[12px]">
            <span className="w-32 flex-shrink-0 text-[11px] font-medium text-[#1C1E21]">{t.tool}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
              t.present ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
            }`}>
              {t.present ? 'YES' : 'NO'}
            </span>
            {t.notes && <span className="text-[11px] text-[#606770]">{t.notes}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Competitors({ comps }: { comps: D[] }) {
  if (!comps?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Likely Competitors</div>
      <div className="space-y-2">
        {comps.map((c, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg px-3.5 py-3">
            <div className="text-[12px] font-bold text-[#1C1E21] mb-2">{c.name}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#15803D] mb-1">Strength</div>
                <p className="text-[11px] text-[#1C1E21] leading-relaxed">{c.strength}</p>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#B91C1C] mb-1">Weakness</div>
                <p className="text-[11px] text-[#1C1E21] leading-relaxed">{c.weakness}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Opportunities({ opps }: { opps: D[] }) {
  if (!opps?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Opportunities</div>
      <div className="space-y-2">
        {opps.map((o, i) => (
          <div key={i} className="bg-[#F0F2F5] rounded-lg px-3.5 py-3">
            <div className="text-[12px] font-semibold text-[#1C1E21] mb-1">{o.title}</div>
            <p className="text-[11px] text-[#606770] leading-relaxed">{o.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevenueOpportunities({ rev }: { rev: D }) {
  if (!rev) return null
  const tiers = [
    { key: 'quick_wins', label: 'Quick Wins' },
    { key: 'medium_term', label: 'Medium Term' },
    { key: 'strategic', label: 'Strategic' },
  ]
  const hasSomething = tiers.some((t) => rev[t.key]?.length)
  if (!hasSomething) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Revenue Opportunities</div>
      {tiers.map(({ key, label }) => {
        const items: D[] = rev[key] ?? []
        if (!items.length) return null
        return (
          <div key={key} className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] border-b border-[#DDE1E7] pb-1 mb-2">
              {label}
            </div>
            {items.map((item, i) => (
              <div key={i} className="py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold bg-[#EAECF0] text-[#606770] px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
                    {item.effort}
                  </span>
                  <span className="text-[11px] text-[#1C1E21] leading-relaxed">{item.opportunity}</span>
                </div>
                {item.impact && (
                  <p className="text-[10px] text-[#606770] leading-relaxed pl-9">{item.impact}</p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function FormattedReport({ agent }: { agent: D }) {
  const r: D = agent.result ?? {}
  return (
    <div>
      <Dimensions dims={r.dimensions} />
      <StringList items={r.wins} label="Strengths" marker="+" markerClass="text-[#15803D]" />
      <StringList items={r.critical_fixes} label="Critical Fixes" marker="!" markerClass="text-[#B91C1C]" />
      <CopyRewrites items={r.before_after} />
      <StringList items={r.quick_wins} label="Quick Wins" marker="→" markerClass="text-[#15803D]" />
      <FunnelLeaks leaks={r.funnel_leaks} />
      <AbTests tests={r.ab_tests} />
      <PageSpeed ps={r.pagespeed} />
      <StringList items={r.seo_quick_wins} label="SEO Quick Wins" marker="→" markerClass="text-[#15803D]" />
      <TechnicalIssues issues={r.technical_issues} />
      <TrackingStatus tracking={r.tracking_status} />
      <Competitors comps={r.likely_competitors} />
      <Opportunities opps={r.opportunities} />
      <StringList items={r.recommended_actions} label="Recommended Actions" marker="→" markerClass="text-[#1877F2]" />
      <BiggestLever lever={r.biggest_lever} />
      <RevenueOpportunities rev={r.revenue_opportunities} />
      {(r.brand_score != null || r.growth_score != null) && (
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Brand &amp; Growth Scores</div>
          <div className="flex gap-6">
            {r.brand_score != null && (
              <div className="text-center">
                <div className={`text-2xl font-black tabular-nums ${scoreColor(r.brand_score)}`}>{r.brand_score}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#606770] mt-0.5">Brand</div>
              </div>
            )}
            {r.growth_score != null && (
              <div className="text-center">
                <div className={`text-2xl font-black tabular-nums ${scoreColor(r.growth_score)}`}>{r.growth_score}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#606770] mt-0.5">Growth</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agent card (tabbed) ───────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: D }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'brief' | 'output'>('brief')
  const label = AGENT_LABELS[agent.key] ?? agent.key
  const sig = detectSignals(agent.userMessage ?? '')

  const signalPills = [
    ['Page Content', sig.html],
    ['PageSpeed', sig.pagespeed],
    ['GSC', sig.gsc],
    ['GA4', sig.ga4],
    ['DataForSEO', sig.dataforseo],
    ['Competitors', sig.competitors],
    ['Interior Pages', sig.interior],
  ] as [string, boolean][]

  return (
    <div className="bg-white border border-[#DDE1E7] rounded-[8px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-[#EAECF0] hover:bg-[#CDD1D8] transition-colors px-4 py-3 flex justify-between items-center"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[13px] font-bold text-[#1C1E21]">{label}</span>
          <span className="text-[11px] text-[#606770]">
            {fmt(agent.inputTokens)} in · {fmt(agent.outputTokens)} out
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[18px] font-black tabular-nums ${scoreColor(agent.score)}`}>{agent.score}</span>
          <span className={`text-[10px] text-[#606770] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {open && (
        <div>
          {/* Tab bar */}
          <div className="flex border-b border-[#DDE1E7] bg-[#FAFBFC]">
            {(['brief', 'output'] as const).map((t) => {
              const tabLabel = t === 'output' ? 'Discovered' : 'Reviewed'
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${
                    tab === t
                      ? 'text-[#1877F2] border-[#1877F2]'
                      : 'text-[#606770] border-transparent hover:text-[#1C1E21]'
                  }`}
                >
                  {tabLabel}
                </button>
              )
            })}
          </div>

          {/* Tab panels */}
          {tab === 'output' && (
            <div className="px-[1.1rem] py-4 max-h-[500px] overflow-y-auto">
              <FormattedReport agent={agent} />
            </div>
          )}

          {tab === 'brief' && (
            <div className="px-[1.1rem] py-4 max-h-[500px] overflow-y-auto">
              <div className="flex gap-4 flex-wrap mb-3 text-[11px]">
                <span className="text-[#606770]">
                  Characters: <span className="font-bold text-[#1C1E21]">{(agent.userMessage ?? '').length.toLocaleString()}</span>
                </span>
                <span className="text-[#606770]">
                  Input tokens: <span className="font-bold text-[#1C1E21]">{fmt(agent.inputTokens)}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {signalPills.map(([name, on]) => (
                  <span
                    key={name}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                      on ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div className="bg-[#F8F9FA] border border-[#CDD1D8] rounded-lg p-3">
                <MdContent>{agent.userMessage ?? ''}</MdContent>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Gate card ─────────────────────────────────────────────────────────────────

function GateCard({ auditId, url, auditor }: { auditId: string; url: string; auditor?: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), auditId, url, auditor }),
      })
      setSubmitted(true)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-[#2D4A6E] rounded-xl px-8 py-8 text-center">
        <div className="max-w-sm mx-auto space-y-2">
          <div className="text-white font-semibold text-base">You're on the list.</div>
          <p className="text-[#A8C0D8] text-sm leading-relaxed">
            We'll send the full report to <span className="text-white font-medium">{email}</span> shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#2D4A6E] rounded-xl px-8 py-8 text-center">
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <div className="text-white font-semibold text-base mb-1">Get the full recommendations</div>
          <p className="text-[#A8C0D8] text-sm leading-relaxed">
            This report includes specific action steps for each finding, quick wins, copy rewrites,
            funnel analysis, and a competitive breakdown.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            required
            className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white ${
              error ? 'border-2 border-red-400' : 'border border-transparent'
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-[#2D4A6E] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#F0EDE8] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? 'Sending…' : 'Get full report'}
          </button>
        </form>
        {error && <p className="text-red-300 text-xs">Something went wrong — try again.</p>}
        <p className="text-[#7A9AB8] text-xs">No account required.</p>
        <p className="text-[#7A9AB8] text-xs">
          Curious what the full report looks like?{' '}
          <a href="/sample" className="text-[#A8C0D8] hover:text-white underline transition-colors">
            See an example →
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AuditReport({ data, autoUnlock }: { data: D; autoUnlock?: boolean }) {
  const [unlocked, setUnlocked] = useState(autoUnlock ?? false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('full') === '1') setUnlocked(true)
  }, [])

  const summary: D = data.summary ?? {}
  const agents: D[] = data.agents ?? []
  const compositeScore: number = data.compositeScore ?? 0
  const priorities: D[] = summary.top_priorities ?? []

  const orderedAgents = AGENT_ORDER
    .map((key) => agents.find((a: D) => a.key === key))
    .filter((a): a is D => Boolean(a))

  // Data richness signals
  const techAgent = agents.find((a: D) => a.key === 'technical')
  const compAgent = agents.find((a: D) => a.key === 'competitive')
  const stratAgent = agents.find((a: D) => a.key === 'strategy')
  const techMsg = techAgent?.userMessage ?? ''
  const psPresent = techAgent && detectSignals(techAgent.userMessage ?? '').pagespeed
  const robotsPresent = techMsg.includes('## robots.txt')
  const sitemapPresent = techMsg.includes('## sitemap.xml')
  const gscPresent = !!data.gscContext
  const ga4Present = !!data.ga4Context
  const dfRank = stratAgent && detectSignals(stratAgent.userMessage ?? '').dataforseo
  const dfComps = compAgent && detectSignals(compAgent.userMessage ?? '').competitors
  const hasPages = Array.isArray(data.pagesAnalyzed) && data.pagesAnalyzed.length > 0
  const pagesFetched = hasPages ? data.pagesAnalyzed.filter((p: D) => p.status === 'fetched') : []

  const totalIn  = agents.reduce((a: number, ag: D) => a + (ag.inputTokens ?? 0), 0) + ((data.summaryTokens ?? {}).input ?? 0)
  const totalOut = agents.reduce((a: number, ag: D) => a + (ag.outputTokens ?? 0), 0) + ((data.summaryTokens ?? {}).output ?? 0)

  const m = data.pageMetadata

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-8 px-4">
      <div className="max-w-[1100px] mx-auto space-y-4">

        {/* Run header */}
        <div className="bg-white border border-[#DDE1E7] rounded-[10px] p-5 flex justify-between items-start gap-4">
          <div>
            <div className="text-[18px] font-bold tracking-tight break-all mb-1.5">{data.url}</div>
            <div className="flex flex-wrap gap-2 items-center text-[12px] text-[#606770]">
              <span>{formatDate(data.timestamp)}</span>
              {data.auditor && <span>{data.auditor}</span>}
              {/* {data.model && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAECF0] text-[#606770] uppercase tracking-wide">
                  {data.model.replace('claude-', '').replace(/-\d{8}$/, '')}
                </span>
              )}
              {data.durationMs && <span>{fmtMs(data.durationMs)}</span>} */}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-[44px] font-black leading-none tabular-nums ${scoreColor(compositeScore)}`}>
              {compositeScore}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-[#606770] mt-0.5">Composite Score</div>
            {unlocked && (
              <button
                onClick={() => downloadFile(generateMarkdown(data), `audit-${slugFromUrl(data.url)}.md`, 'text/markdown')}
                className="mt-2 text-[10px] font-semibold text-[#606770] border border-[#CDD1D8] rounded px-2 py-1 hover:bg-[#F0F2F5] transition-colors"
                title="Download report as Markdown"
              >
                ↓ Download .md
              </button>
            )}
          </div>
        </div>

        {/* Overall assessment — locked view only */}
        {!unlocked && summary.overall_verdict && (
          <div className="bg-white border border-[#DDE1E7] rounded-[10px] px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Overall Assessment</div>
            <p className="text-[13px] text-[#1C1E21] leading-relaxed">{summary.overall_verdict}</p>
          </div>
        )}

        {/* Data richness grid */}
        <div className="bg-white border border-[#DDE1E7] rounded-[10px] px-5 py-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-3">
            Data Sources
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <RichnessItem status="present" name="Homepage HTML" detail="Always fetched · 15k char limit" />
            <RichnessItem
              status={psPresent ? 'present' : 'absent'}
              name="PageSpeed / CWV"
              detail={psPresent ? 'Lighthouse scores included' : 'Not found in brief'}
            />
            <RichnessItem
              status={(robotsPresent || sitemapPresent) ? 'present' : 'absent'}
              name="robots.txt / sitemap"
              detail={
                robotsPresent && sitemapPresent ? 'Both present' :
                robotsPresent ? 'robots.txt only' :
                sitemapPresent ? 'sitemap only' : 'Neither present'
              }
            />
            <RichnessItem
              status={gscPresent ? 'present' : 'absent'}
              name="Search Console"
              detail={gscPresent ? `${(data.gscContext.length / 1000).toFixed(1)}k chars` : 'Not connected'}
            />
            <RichnessItem
              status={ga4Present ? 'present' : 'absent'}
              name="Google Analytics 4"
              detail={ga4Present ? `${(data.ga4Context.length / 1000).toFixed(1)}k chars` : 'Not connected'}
            />
            <RichnessItem
              status={dfRank ? 'present' : 'absent'}
              name="Domain Ranking"
              detail={dfRank ? 'Domain rank data included' : 'Not detected in brief'}
            />
            <RichnessItem
              status={dfComps ? 'present' : 'absent'}
              name="Competitor Insights"
              detail={dfComps ? 'Competitor context data included' : 'Not detected in brief'}
            />
            <RichnessItem
              status={pagesFetched.length > 0 ? 'present' : 'absent'}
              name="Interior Pages"
              detail={pagesFetched.length > 0 ? `${pagesFetched.length} page${pagesFetched.length !== 1 ? 's' : ''} fetched` : 'None fetched'}
            />
          </div>

          {hasPages && (
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Interior Pages Detail</div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr>
                    {['URL', 'Status', 'Chars', 'Dimensions'].map((h) => (
                      <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-[#606770] px-2.5 py-1.5 border-b border-[#CDD1D8]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.pagesAnalyzed.map((p: D, i: number) => (
                    <tr key={i} className="border-b border-[#DDE1E7] last:border-0">
                      <td className="px-2.5 py-1.5 font-mono text-[11px]">{p.url}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          p.status === 'fetched' ? 'bg-[#D1FAE5] text-[#065F46]' :
                          p.status === 'skipped' ? 'bg-[#EAECF0] text-[#606770]' :
                          'bg-[#FEE2E2] text-[#991B1B]'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px]">
                        {p.chars ? (p.chars / 1000).toFixed(1) + 'k' : '—'}
                      </td>
                      <td className="px-2.5 py-1.5 text-[11px]">
                        {Array.isArray(p.agents) ? p.agents.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Findings */}
        {unlocked && (summary.overall_verdict || priorities.length > 0) && (
          <Collapsible label="Summary of Findings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.overall_verdict && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Overall Verdict</div>
                  <p className="text-[13px] text-[#1C1E21] leading-relaxed">{summary.overall_verdict}</p>
                  {summary.quick_wins?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Quick Wins</div>
                      <div className="space-y-1">
                        {summary.quick_wins.map((w: string, i: number) => (
                          <div key={i} className="flex gap-2 text-[12px] text-[#1C1E21] leading-relaxed relative pl-4">
                            <span className="absolute left-0 font-bold text-[#15803D]">+</span>
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {priorities.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-2">Top Priorities</div>
                  {priorities.map((p: D, i: number) => (
                    <div key={p.rank ?? i} className="flex gap-2.5 mb-3 last:mb-0">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EAECF0] flex items-center justify-center text-[10px] font-bold text-[#606770] mt-0.5">
                        {p.rank ?? i + 1}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wide mb-0.5">{p.area}</div>
                        <p className="text-[12px] text-[#1C1E21] leading-relaxed">{p.finding}</p>
                        {p.action && (
                          <div className="mt-1 bg-[#EAECF0] rounded px-2.5 py-1.5 text-[11px] text-[#1C1E21] leading-relaxed">
                            <strong>Action:</strong> {p.action}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Collapsible>
        )}

        {/* GA4 & GSC collapsible */}
        {unlocked && (gscPresent || ga4Present) && (
          <Collapsible
            label="Google: GA4 & Search Console"
            meta={
              <>
                {gscPresent && <span>GSC {(data.gscContext.length / 1000).toFixed(1)}k chars</span>}
                {ga4Present && <span>GA4 {(data.ga4Context.length / 1000).toFixed(1)}k chars</span>}
              </>
            }
          >
            {gscPresent && (
              <div className="bg-[#F8F9FA] border border-[#CDD1D8] rounded-lg p-3 mb-3 last:mb-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#606770]">Search Console Context</span>
                  <span className="text-[10px] text-[#606770]">{data.gscContext.length.toLocaleString()} chars</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto prose-brief">
                  <MdContent>{data.gscContext}</MdContent>
                </div>
              </div>
            )}
            {ga4Present && (
              <div className="bg-[#F8F9FA] border border-[#CDD1D8] rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#606770]">GA4 Context</span>
                  <span className="text-[10px] text-[#606770]">{data.ga4Context.length.toLocaleString()} chars</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto prose-brief">
                  <MdContent>{data.ga4Context}</MdContent>
                </div>
              </div>
            )}
          </Collapsible>
        )}

        {/* Page metadata collapsible */}
        {unlocked && m && (
          <Collapsible
            label="Page Metadata"
            meta={
              <>
                {m.title && <span>{m.title.slice(0, 40)}{m.title.length > 40 ? '…' : ''}</span>}
                {m.wordCount && <span>~{m.wordCount.toLocaleString()} words</span>}
              </>
            }
          >
            <div className="grid grid-cols-[7rem_1fr] gap-1.5 text-[12px] mb-3">
              {m.title && <><span className="text-[#606770] font-medium">Title</span><span>{m.title}</span></>}
              {m.metaDescription && <><span className="text-[#606770] font-medium">Meta Desc</span><span>{m.metaDescription}</span></>}
              {m.h1s?.length && <><span className="text-[#606770] font-medium">H1s</span><span>{m.h1s.join(' / ')}</span></>}
              {m.canonical && <><span className="text-[#606770] font-medium">Canonical</span><span className="font-mono text-[11px]">{m.canonical}</span></>}
              {m.wordCount && <><span className="text-[#606770] font-medium">Word count</span><span>~{m.wordCount.toLocaleString()}</span></>}
              {m.metaRobots && <><span className="text-[#606770] font-medium">Robots</span><span>{m.metaRobots}</span></>}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['hasStructuredData', 'hasOgTags', 'metaDescription', 'canonical'] as const).map((k) => {
                const on = !!m[k]
                const label: Record<string, string> = {
                  hasStructuredData: 'Structured Data',
                  hasOgTags: 'OG Tags',
                  metaDescription: 'Meta Desc',
                  canonical: 'Canonical',
                }
                return (
                  <span
                    key={k}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                      on ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {label[k]}
                  </span>
                )
              })}
            </div>
          </Collapsible>
        )}

        {/* Top findings — locked view only */}
        {!unlocked && priorities.length > 0 && (
          <div className="bg-white border border-[#DDE1E7] rounded-[10px] px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-3">Top Findings</div>
            <div className="space-y-4">
              {priorities.map((p: D, i: number) => (
                <div key={p.rank ?? i} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EAECF0] flex items-center justify-center text-[11px] font-bold text-[#606770] mt-0.5">
                    {p.rank ?? i + 1}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#1877F2] mb-0.5">{p.area}</div>
                    <p className="text-[13px] text-[#1C1E21] leading-relaxed">{p.finding}</p>
                    {p.why_it_matters && (
                      <p className="text-[11px] text-[#606770] mt-0.5 italic">{p.why_it_matters}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gate card */}
        {!unlocked && (
          <GateCard auditId={data.id} url={data.url} auditor={data.auditor} />
        )}

        {/* Unlocked: agent cards */}
        {unlocked && (
          <>
            {/* 5 Dimensional Analysis */}
            <div className="bg-white border border-[#DDE1E7] rounded-[10px] overflow-hidden">
              <div className="px-[1.1rem] py-3 border-b border-[#DDE1E7] flex justify-between items-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770]">
                  5 Dimensions of Discovery
                </div>
                <div className="text-[11px] text-[#606770]">click each to expand</div>
              </div>
              <div className="p-[1.1rem] space-y-3">
                {orderedAgents.map((agent) => (
                  <AgentCard key={agent.key} agent={agent} />
                ))}
              </div>
            </div>

            {/* Run stats */}
            {/* <div className="bg-white border border-[#DDE1E7] rounded-[10px] px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#606770] mb-3">Run Stats</div>
              <div className="flex gap-6 flex-wrap mb-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#606770]">Total Input</div>
                  <div className="text-[14px] font-bold">{fmt(totalIn)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#606770]">Total Output</div>
                  <div className="text-[14px] font-bold">{fmt(totalOut)}</div>
                </div>
                {data.durationMs && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#606770]">Duration</div>
                    <div className="text-[14px] font-bold">{fmtMs(data.durationMs)}</div>
                  </div>
                )}
                {data.model && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#606770]">Model</div>
                    <div className="text-[12px] font-bold">{data.model}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-4 flex-wrap">
                {orderedAgents.map((ag) => (
                  <div key={ag.key}>
                    <div className="text-[9px] uppercase tracking-wider text-[#606770]">{AGENT_LABELS[ag.key] ?? ag.key}</div>
                    <div className="text-[12px] font-bold">{fmt(ag.inputTokens)}↓ {fmt(ag.outputTokens)}↑</div>
                  </div>
                ))}
                {data.summaryTokens && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#606770]">Summary</div>
                    <div className="text-[12px] font-bold">{fmt(data.summaryTokens.input)}↓ {fmt(data.summaryTokens.output)}↑</div>
                  </div>
                )}
              </div>
            </div> */}
          </>
        )}

      </div>
    </div>
  )
}
