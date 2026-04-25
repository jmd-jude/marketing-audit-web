'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AuditHeader } from '@/components/AuditHeader'

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

function scoreColor(s: number): string {
  if (s >= 65) return 'text-lr-green'
  if (s >= 40) return 'text-lr-amber'
  return 'text-lr-red'
}

function scoreCssColor(s: number): string {
  if (s >= 65) return 'var(--lr-green)'
  if (s >= 40) return 'var(--lr-amber)'
  return 'var(--lr-red)'
}

function dimColor(s: number): string {
  if (s >= 7) return 'bg-lr-green'
  if (s >= 4) return 'bg-lr-amber'
  return 'bg-lr-red'
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.42
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const c = scoreCssColor(score)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        style={{ stroke: c, strokeWidth: 5, opacity: 0.15 }}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        style={{ stroke: c, strokeWidth: 5 }}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2 + 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.24}
        style={{ fill: c }}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="400"
      >
        {score}
      </text>
    </svg>
  )
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
  h1: ({ children }: { children?: React.ReactNode }) => <div className="text-[12px] font-bold mt-3 mb-1 pb-0.5 text-lr-ink" style={{ borderBottom: '0.5px solid var(--lr-border-med)' }}>{children}</div>,
  h2: ({ children }: { children?: React.ReactNode }) => <div className="text-[12px] font-bold mt-3 mb-1 pb-0.5 text-lr-ink" style={{ borderBottom: '0.5px solid var(--lr-border-med)' }}>{children}</div>,
  h3: ({ children }: { children?: React.ReactNode }) => <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mt-2 mb-1">{children}</div>,
  p:  ({ children }: { children?: React.ReactNode }) => <p className="text-[12px] text-lr-ink leading-relaxed mb-1.5">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-[12px] text-lr-ink">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-[12px] text-lr-ink">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-lr-ink">{children}</strong>,
  table: ({ children }: { children?: React.ReactNode }) => <table className="w-full border-collapse text-[11px] font-mono mb-2">{children}</table>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="text-left font-bold px-2 py-1 text-lr-stone" style={{ borderBottom: '2px solid var(--lr-border-med)' }}>{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-2 py-1 align-top" style={{ borderBottom: '0.5px solid var(--lr-border)' }}>{children}</td>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="bg-lr-parchment px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
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
    present: { bg: 'rgba(74,122,90,0.08)', border: 'rgba(74,122,90,0.25)', label: 'var(--lr-green)', detail: 'var(--lr-green)' },
    absent:  { bg: 'rgba(200,49,58,0.06)',  border: 'rgba(200,49,58,0.20)', label: 'var(--lr-red)',   detail: 'var(--lr-red)'   },
    partial: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.25)',label: 'var(--lr-amber)', detail: 'var(--lr-amber)' },
  }
  const s = styles[status]
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: s.bg, border: `0.5px solid ${s.border}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: s.label }}>{name}</div>
      <div className="text-[11px]" style={{ color: s.detail }}>{detail}</div>
    </div>
  )
}

// ── Sev badge ─────────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(200,49,58,0.12)',  color: 'var(--lr-red)'   },
    high:     { bg: 'rgba(184,115,51,0.15)', color: 'var(--lr-amber)' },
    medium:   { bg: 'rgba(138,125,110,0.15)',color: 'var(--lr-stone)' },
    low:      { bg: 'rgba(74,122,90,0.10)',  color: 'var(--lr-green)' },
  }
  const s = map[sev?.toLowerCase()] ?? { bg: 'rgba(26,26,26,0.07)', color: 'var(--lr-stone)' }
  return (
    <span
      className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {sev}
    </span>
  )
}

// ── Formatted report renderers ────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
      {children}
    </div>
  )
}

function Dimensions({ dims }: { dims: D[] }) {
  if (!dims?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Dimensions</div>
      <div className="space-y-1.5">
        {dims.map((d) => (
          <div key={d.name}>
            <div className="flex items-center gap-3">
              <span className="w-40 flex-shrink-0 text-[12px] font-medium text-lr-ink">{d.name}</span>
              <div className="flex-1 bg-lr-parchment rounded-full h-[5px]">
                <div className={`h-[5px] rounded-full ${dimColor(d.score)}`} style={{ width: `${d.score * 10}%` }} />
              </div>
              <span className={`w-10 text-right text-[11px] font-bold tabular-nums flex-shrink-0 ${scoreColor(d.score * 10)}`}>
                {d.score}<span className="text-lr-stone font-normal">/10</span>
              </span>
            </div>
            {d.finding && (
              <p className="text-[11px] text-lr-stone mt-0.5 pl-[11rem] leading-snug">{d.finding}</p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function StringList({ items, label, marker, markerClass }: {
  items: string[]
  label: string
  marker: string
  markerClass: string
}) {
  if (!items?.length) return null
  const isGreen = markerClass.includes('green')
  const isRed = markerClass.includes('red')
  const itemStyle: React.CSSProperties = isGreen
    ? { background: 'rgba(74,122,90,0.04)', border: '0.5px solid rgba(74,122,90,0.18)', borderRadius: 8, padding: '10px 14px' }
    : isRed
    ? { background: 'rgba(200,49,58,0.04)', border: '0.5px solid rgba(200,49,58,0.15)', borderRadius: 8, padding: '10px 14px' }
    : { padding: '4px 0' }
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">{label}</div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 text-[13px] text-lr-ink leading-relaxed" style={itemStyle}>
            <span className={`font-bold flex-shrink-0 ${markerClass}`}>{marker}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function BiggestLever({ lever }: { lever: D | string }) {
  if (!lever) return null
  const isObj = typeof lever === 'object' && lever !== null
  const recommendation = isObj ? lever.recommendation : lever
  const why = isObj ? lever.why : null
  if (!recommendation) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Biggest Lever</div>
      <div className="rounded-lg px-3.5 py-3 text-[13px] text-lr-ink leading-relaxed" style={{ background: 'rgba(200,49,58,0.05)', borderLeft: '3px solid var(--lr-red)' }}>
        {recommendation}
        {why && <div className="text-[11px] text-lr-stone mt-1.5">{why}</div>}
      </div>
    </SectionCard>
  )
}

function CopyRewrites({ items }: { items: D[] }) {
  if (!items?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Copy Rewrites</div>
      <div className="space-y-2.5">
        {items.map((ba, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg overflow-hidden">
            <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-lr-stone">
              {ba.element}
            </div>
            <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--lr-border)' }}>
              <div className="px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-lr-red mb-1">Before</div>
                <p className="text-[11px] text-lr-ink leading-relaxed">{ba.before}</p>
              </div>
              <div className="px-3.5 py-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-lr-green mb-1">After</div>
                <p className="text-[11px] text-lr-ink leading-relaxed">{ba.after}</p>
              </div>
            </div>
            {ba.why && (
              <div className="px-3.5 py-2 text-[11px] text-lr-stone italic" style={{ borderTop: '0.5px solid var(--lr-border)' }}>{ba.why}</div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function FunnelLeaks({ leaks }: { leaks: D[] }) {
  if (!leaks?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Funnel Leaks</div>
      <div className="space-y-2">
        {leaks.map((l, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <SevBadge sev={l.severity} />
              <span className="text-[12px] font-semibold text-lr-ink">{l.stage}</span>
            </div>
            <p className="text-[11px] text-lr-stone leading-relaxed mb-1.5">{l.issue}</p>
            {l.fix && (
              <p className="text-[11px] text-lr-ink leading-relaxed">
                <span className="text-lr-green font-bold">→ </span>{l.fix}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function AbTests({ tests }: { tests: D[] }) {
  if (!tests?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">A/B Test Ideas</div>
      <div className="space-y-2">
        {tests.map((t, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg px-3.5 py-3">
            <p className="text-[12px] text-lr-ink italic leading-relaxed mb-1.5">{t.hypothesis}</p>
            <div className="flex gap-4 text-[11px] text-lr-stone">
              {t.metric && <span><span className="font-semibold text-lr-ink">Metric:</span> {t.metric}</span>}
              {t.impact && <span><span className="font-semibold text-lr-ink">Impact:</span> {t.impact}</span>}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function PageSpeed({ ps }: { ps: D }) {
  if (!ps) return null
  function psStyle(v: number) {
    if (v >= 90) return { bg: 'rgba(74,122,90,0.08)', border: 'rgba(74,122,90,0.25)', color: 'var(--lr-green)' }
    if (v >= 50) return { bg: 'rgba(184,115,51,0.08)',border: 'rgba(184,115,51,0.25)',color: 'var(--lr-amber)' }
    return             { bg: 'rgba(200,49,58,0.08)',  border: 'rgba(200,49,58,0.20)', color: 'var(--lr-red)'   }
  }
  const metrics = [
    ['Performance', ps.performance],
    ['Accessibility', ps.accessibility],
    ['SEO', ps.seo],
    ['Best Practices', ps.best_practices],
  ] as [string, number][]
  const cwv = [['LCP', ps.lcp], ['CLS', ps.cls], ['TBT', ps.tbt], ['FCP', ps.fcp]].filter(([, v]) => v) as [string, string][]

  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">PageSpeed</div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {metrics.map(([label, val]) => {
          const s = psStyle(val)
          return (
            <div key={label} className="rounded-lg text-center px-2 py-2.5" style={{ background: s.bg, border: `0.5px solid ${s.border}` }}>
              <div className="font-serif text-base tabular-nums leading-none" style={{ color: s.color }}>{val}</div>
              <div className="text-[9px] text-lr-stone mt-1">{label}</div>
            </div>
          )
        })}
      </div>
      {cwv.length > 0 && (
        <div className="flex gap-4 flex-wrap text-[11px] text-lr-stone">
          {cwv.map(([k, v]) => (
            <span key={k}><span className="font-semibold text-lr-ink">{k}</span> {v}</span>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function TechnicalIssues({ issues }: { issues: D[] }) {
  if (!issues?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Technical Issues</div>
      <div className="space-y-2">
        {issues.map((iss, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <SevBadge sev={iss.severity} />
              <span className="text-[12px] font-semibold text-lr-ink">{iss.issue}</span>
            </div>
            {iss.impact && <p className="text-[11px] text-lr-stone leading-relaxed mb-1.5">{iss.impact}</p>}
            {iss.fix && (
              <p className="text-[11px] text-lr-ink leading-relaxed">
                <span className="text-lr-green font-bold">→ </span>{iss.fix}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function TrackingStatus({ tracking }: { tracking: D[] }) {
  if (!tracking?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Tracking Status</div>
      <div className="space-y-1.5">
        {tracking.map((t, i) => (
          <div key={i} className="flex items-baseline gap-3 text-[12px]">
            <span className="w-32 flex-shrink-0 text-[11px] font-medium text-lr-ink">{t.tool}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={t.present
                ? { background: 'rgba(74,122,90,0.12)', color: 'var(--lr-green)' }
                : { background: 'rgba(200,49,58,0.10)', color: 'var(--lr-red)' }
              }
            >
              {t.present ? 'YES' : 'NO'}
            </span>
            {t.notes && <span className="text-[11px] text-lr-stone">{t.notes}</span>}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function Competitors({ comps }: { comps: D[] }) {
  if (!comps?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Likely Competitors</div>
      <div className="space-y-2">
        {comps.map((c, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg px-3.5 py-3">
            <div className="text-[12px] font-bold text-lr-ink mb-2">{c.name}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-lr-green mb-1">Strength</div>
                <p className="text-[11px] text-lr-ink leading-relaxed">{c.strength}</p>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-lr-red mb-1">Weakness</div>
                <p className="text-[11px] text-lr-ink leading-relaxed">{c.weakness}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function Opportunities({ opps }: { opps: D[] }) {
  if (!opps?.length) return null
  return (
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Opportunities</div>
      <div className="space-y-2">
        {opps.map((o, i) => (
          <div key={i} className="bg-lr-parchment rounded-lg px-3.5 py-3">
            <div className="text-[12px] font-semibold text-lr-ink mb-1">{o.title}</div>
            <p className="text-[11px] text-lr-stone leading-relaxed">{o.description}</p>
          </div>
        ))}
      </div>
    </SectionCard>
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
    <SectionCard>
      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Revenue Opportunities</div>
      {tiers.map(({ key, label }) => {
        const items: D[] = rev[key] ?? []
        if (!items.length) return null
        return (
          <div key={key} className="mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone pb-1 mb-2" style={{ borderBottom: '0.5px solid var(--lr-border)' }}>
              {label}
            </div>
            {items.map((item, i) => (
              <div key={i} className="py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0" style={{ background: 'rgba(26,26,26,0.07)', color: 'var(--lr-stone)' }}>
                    {item.effort}
                  </span>
                  <span className="text-[11px] text-lr-ink leading-relaxed">{item.opportunity}</span>
                </div>
                {item.impact && (
                  <p className="text-[10px] text-lr-stone leading-relaxed pl-9">{item.impact}</p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </SectionCard>
  )
}

function FormattedReport({ agent, skipDimensions }: { agent: D; skipDimensions?: boolean }) {
  const r: D = agent.result ?? {}
  return (
    <div>
      {!skipDimensions && <Dimensions dims={r.dimensions} />}
      <StringList items={r.wins} label="Strengths" marker="+" markerClass="text-lr-green" />
      <StringList items={r.critical_fixes} label="Critical Fixes" marker="!" markerClass="text-lr-red" />
      <CopyRewrites items={r.before_after} />
      <StringList items={r.quick_wins} label="Quick Wins" marker="→" markerClass="text-lr-green" />
      <FunnelLeaks leaks={r.funnel_leaks} />
      <AbTests tests={r.ab_tests} />
      <PageSpeed ps={r.pagespeed} />
      <StringList items={r.seo_quick_wins} label="SEO Quick Wins" marker="→" markerClass="text-lr-green" />
      <TechnicalIssues issues={r.technical_issues} />
      <TrackingStatus tracking={r.tracking_status} />
      <Competitors comps={r.likely_competitors} />
      <Opportunities opps={r.opportunities} />
      <StringList items={r.recommended_actions} label="Recommended Actions" marker="→" markerClass="text-lr-red" />
      <BiggestLever lever={r.biggest_lever} />
      <RevenueOpportunities rev={r.revenue_opportunities} />
      {(r.brand_score != null || r.growth_score != null) && (
        <SectionCard>
          <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Brand &amp; Growth Scores</div>
          <div className="flex gap-6">
            {r.brand_score != null && (
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={r.brand_score} size={64} />
                <div className="text-[9px] uppercase tracking-wider text-lr-stone">Brand</div>
              </div>
            )}
            {r.growth_score != null && (
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={r.growth_score} size={64} />
                <div className="text-[9px] uppercase tracking-wider text-lr-stone">Growth</div>
              </div>
            )}
          </div>
        </SectionCard>
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
      <div className="bg-lr-asphalt rounded-xl px-8 py-8 text-center">
        <div className="max-w-sm mx-auto space-y-2">
          <div className="text-lr-parchment font-semibold text-base">You&apos;re on the list.</div>
          <p className="text-lr-stone text-sm leading-relaxed">
            We&apos;ll send the full report to <span className="text-lr-parchment font-medium">{email}</span> shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-lr-asphalt rounded-xl px-8 py-8 text-center">
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <div className="text-lr-parchment font-semibold text-base mb-1">Get the full recommendations</div>
          <p className="text-lr-stone text-sm leading-relaxed">
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
            className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white text-lr-ink ${
              error ? 'border-2 border-lr-red' : 'border border-transparent'
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-lr-parchment text-lr-ink font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? 'Sending…' : 'Get full report'}
          </button>
        </form>
        {error && <p className="text-lr-red text-xs">Something went wrong — try again.</p>}
        <p className="text-lr-stone/60 text-xs">No account required.</p>
        <p className="text-lr-stone/60 text-xs">
          Curious what the full report looks like?{' '}
          <a href="/sample" className="text-lr-stone hover:text-lr-parchment underline transition-colors">
            See an example →
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ReportSidebar({
  items,
  activeSection,
  onSelect,
}: {
  items: { id: string; label: string; score?: number }[]
  activeSection: string
  onSelect?: (id: string) => void
}) {
  return (
    <nav
      className="bg-white overflow-y-auto"
      style={{
        width: 220,
        flexShrink: 0,
        position: 'fixed',
        top: 64,
        bottom: 0,
        borderRight: '0.5px solid var(--lr-border)',
        zIndex: 20,
      }}
    >
      <div style={{ padding: '20px 0' }}>
        <div className="text-[10px] font-semibold text-lr-stone uppercase tracking-[.07em] px-5 pb-1">Report</div>
        {items.map((item, idx) =>
          onSelect ? (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full flex items-center gap-2 px-5 py-[7px] text-left text-[13px] transition-colors"
              style={
                activeSection === item.id
                  ? { background: 'var(--lr-parchment)', color: 'var(--lr-red)', fontWeight: 500 }
                  : { color: 'var(--lr-ink)' }
              }
              onMouseEnter={(e) => { if (activeSection !== item.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--lr-parchment)' }}
              onMouseLeave={(e) => { if (activeSection !== item.id) (e.currentTarget as HTMLButtonElement).style.background = '' }}
            >
              {item.label}
              {item.score != null && <ScorePill score={item.score} />}
            </button>
          ) : (
            <div
              key={item.id}
              className="w-full flex items-center px-5 py-[7px] text-[13px]"
              style={idx === 0
                ? { background: 'var(--lr-parchment)', color: 'var(--lr-red)', fontWeight: 500 }
                : { color: 'var(--lr-ink)', opacity: 0.35, userSelect: 'none' }
              }
            >
              {item.label}
              {item.score != null && <ScorePill score={item.score} />}
            </div>
          )
        )}
      </div>
    </nav>
  )
}

// ── Score pill (sidebar) ──────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const s = score >= 65
    ? { bg: 'rgba(74,122,90,0.12)',  color: 'var(--lr-green)' }
    : score >= 40
    ? { bg: 'rgba(184,115,51,0.12)', color: 'var(--lr-amber)' }
    : { bg: 'rgba(200,49,58,0.12)',  color: 'var(--lr-red)'   }
  return (
    <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={s}>
      {score}
    </span>
  )
}

// ── Full agent section (unlocked sidebar view) ────────────────────────────────

function AgentSection({ agent }: { agent: D }) {
  const [showBrief, setShowBrief] = useState(false)
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-medium text-lr-ink">{AGENT_LABELS[agent.key] ?? agent.key}</h1>
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <ScoreRing score={agent.score ?? 0} size={44} />
          <div className="text-[8px] uppercase tracking-wider text-lr-stone">Score</div>
        </div>
      </div>

      <Dimensions dims={agent.result?.dimensions} />

      <FormattedReport agent={agent} skipDimensions />

      {/* Input brief — collapsed by default */}
      <div className="mt-6 pt-4" style={{ borderTop: '0.5px solid var(--lr-border)' }}>
        <button
          onClick={() => setShowBrief(!showBrief)}
          className="text-[11px] font-semibold text-lr-stone hover:text-lr-ink transition-colors flex items-center gap-1.5"
        >
          <span className={`text-[9px] transition-transform duration-150 ${showBrief ? 'rotate-180' : ''}`}>▼</span>
          {showBrief ? 'Hide' : 'View'} input brief
        </button>
        {showBrief && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signalPills.map(([name, on]) => (
                <span
                  key={name}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
                  style={on
                    ? { background: 'rgba(74,122,90,0.12)', color: 'var(--lr-green)' }
                    : { background: 'rgba(200,49,58,0.08)', color: 'var(--lr-red)' }
                  }
                >
                  {name}
                </span>
              ))}
            </div>
            <div className="bg-lr-parchment rounded-lg p-3" style={{ border: '0.5px solid var(--lr-border-med)' }}>
              <MdContent>{agent.userMessage ?? ''}</MdContent>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AuditReport({ data, autoUnlock }: { data: D; autoUnlock?: boolean }) {
  const [unlocked, setUnlocked] = useState(autoUnlock ?? false)
  const [activeSection, setActiveSection] = useState('overview')

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

  const m = data.pageMetadata

  // ── Reusable richness grid (shared between locked + overview) ────────────────
  const richnessGrid = (
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
        detail={robotsPresent && sitemapPresent ? 'Both present' : robotsPresent ? 'robots.txt only' : sitemapPresent ? 'sitemap only' : 'Neither present'}
      />
      <RichnessItem status={gscPresent ? 'present' : 'absent'} name="Search Console" detail={gscPresent ? `${(data.gscContext.length / 1000).toFixed(1)}k chars` : 'Not connected'} />
      <RichnessItem status={ga4Present ? 'present' : 'absent'} name="Google Analytics 4" detail={ga4Present ? `${(data.ga4Context.length / 1000).toFixed(1)}k chars` : 'Not connected'} />
      <RichnessItem status={dfRank ? 'present' : 'absent'} name="Domain Ranking" detail={dfRank ? 'Domain rank data included' : 'Not detected in brief'} />
      <RichnessItem status={dfComps ? 'present' : 'absent'} name="Competitor Insights" detail={dfComps ? 'Competitor context data included' : 'Not detected in brief'} />
      <RichnessItem status={pagesFetched.length > 0 ? 'present' : 'absent'} name="Interior Pages" detail={pagesFetched.length > 0 ? `${pagesFetched.length} page${pagesFetched.length !== 1 ? 's' : ''} fetched` : 'None fetched'} />
    </div>
  )

  // ── LOCKED VIEW ───────────────────────────────────────────────────────────────
  if (!unlocked) {
    const lockedNavItems: { id: string; label: string }[] = [
      { id: 'overview', label: 'Overview' },
      ...AGENT_ORDER.map((key) => ({ id: key, label: AGENT_LABELS[key] ?? key })),
      ...(ga4Present  ? [{ id: 'ga4', label: 'GA4 Data' }]       : []),
      ...(gscPresent  ? [{ id: 'gsc', label: 'Search Console' }] : []),
    ]

    return (
      <>
        <AuditHeader url={data.url} auditor={data.auditor} timestamp={data.timestamp} />
        <div className="flex" style={{ minHeight: 'calc(100vh - 64px)' }}>

          <ReportSidebar items={lockedNavItems} activeSection="overview" />

          {/* ── Main content ── */}
          <main style={{ marginLeft: 220, flex: 1, padding: '32px 40px', maxWidth: 1000 }}>

            {/* Score rings row */}
            <div className="flex items-center gap-5 flex-wrap mb-6">
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={compositeScore} size={96} />
                <div className="text-[9px] uppercase tracking-widest text-lr-stone">Composite</div>
              </div>
              <div className="flex gap-4 flex-wrap">
                {orderedAgents.map((a) => (
                  <div key={a.key} className="flex flex-col items-center gap-1">
                    <ScoreRing score={a.score ?? 0} size={64} />
                    <div className="text-[9px] text-lr-stone text-center" style={{ maxWidth: 80 }}>{AGENT_LABELS[a.key]}</div>
                  </div>
                ))}
              </div>
            </div>

          {/* Overall verdict */}
          {summary.overall_verdict && (
            <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Overall Assessment</div>
              <p className="text-[13px] text-lr-ink leading-relaxed">{summary.overall_verdict}</p>
              {summary.biggest_strength && (
                <div className="mt-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(74,122,90,0.06)', border: '0.5px solid rgba(74,122,90,0.2)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-lr-green mb-1">Biggest Strength</div>
                  <p className="text-[13px] text-lr-ink leading-relaxed">{summary.biggest_strength}</p>
                </div>
              )}
            </div>
          )}

          {/* Top findings */}
          {priorities.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Top Findings</div>
              {priorities.map((p: D, i: number) => (
                <div key={p.rank ?? i} className="bg-white rounded-[10px] px-5 py-4 mb-3" style={{ border: '0.5px solid var(--lr-border)', display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12 }}>
                  <div className="font-serif text-[20px] text-lr-red leading-none mt-1">{p.rank ?? i + 1}</div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-1">{p.area}</div>
                    <p className="text-[13px] text-lr-ink leading-relaxed">{p.finding}</p>
                    {p.why_it_matters && <p className="text-[11px] text-lr-stone mt-1 italic">{p.why_it_matters}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data sources */}
          <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Data Sources</div>
            {richnessGrid}
          </div>

          {/* Gate */}
          <GateCard auditId={data.id} url={data.url} auditor={data.auditor} />

          </main>
        </div>
      </>
    )
  }

  // ── UNLOCKED VIEW — sidebar + main ────────────────────────────────────────────

  const navItems: { id: string; label: string; score?: number }[] = [
    { id: 'overview', label: 'Overview', score: compositeScore },
    ...orderedAgents.map((a) => ({ id: a.key, label: AGENT_LABELS[a.key] ?? a.key, score: a.score })),
    ...(ga4Present  ? [{ id: 'ga4', label: 'GA4 Data' }]         : []),
    ...(gscPresent  ? [{ id: 'gsc', label: 'Search Console' }]   : []),
  ]

  return (
    <>
      <AuditHeader url={data.url} auditor={data.auditor} timestamp={data.timestamp} />
      <div className="flex" style={{ minHeight: 'calc(100vh - 64px)' }}>

        <ReportSidebar items={navItems} activeSection={activeSection} onSelect={setActiveSection} />

        {/* ── Main content ── */}
        <main style={{ marginLeft: 220, flex: 1, padding: '32px 40px', maxWidth: 1000 }}>

        {/* Overview section */}
        {activeSection === 'overview' && (
          <div>
            <div className="mb-6">
              <h1 className="text-[20px] font-medium text-lr-ink break-all mb-1">{data.url}</h1>
              <div className="text-[12px] text-lr-stone">
                {formatDate(data.timestamp)}
                {data.auditor && ` · ${data.auditor}`}
              </div>
            </div>

            {/* Score rings row */}
            <div className="flex items-center gap-5 flex-wrap mb-6">
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={compositeScore} size={116} />
                <div className="text-[9px] uppercase tracking-widest text-lr-stone">Composite</div>
              </div>
              <div className="flex gap-5 flex-wrap">
                {orderedAgents.map((a) => (
                  <button key={a.key} onClick={() => setActiveSection(a.key)} className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity">
                    <ScoreRing score={a.score ?? 0} size={80} />
                    <div className="text-[9px] text-lr-stone text-center" style={{ maxWidth: 90 }}>{AGENT_LABELS[a.key]}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => downloadFile(generateMarkdown(data), `audit-${slugFromUrl(data.url)}.md`, 'text/markdown')}
                className="ml-auto self-start text-[10px] font-semibold text-lr-stone rounded px-2 py-1 hover:bg-lr-parchment transition-colors"
                style={{ border: '0.5px solid var(--lr-border-med)' }}
              >
                ↓ Download .md
              </button>
            </div>

            {/* Verdict */}
            {summary.overall_verdict && (
              <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Overall Verdict</div>
                <p className="text-[14px] text-lr-ink leading-relaxed">{summary.overall_verdict}</p>
                {summary.biggest_strength && (
                  <div className="mt-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(74,122,90,0.06)', border: '0.5px solid rgba(74,122,90,0.2)' }}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-lr-green mb-1">Biggest Strength</div>
                    <p className="text-[13px] text-lr-ink leading-relaxed">{summary.biggest_strength}</p>
                  </div>
                )}
              </div>
            )}

            {/* Top priorities */}
            {priorities.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Top Priorities</div>
                {priorities.map((p: D, i: number) => (
                  <div key={p.rank ?? i} className="bg-white rounded-[10px] px-5 py-4 mb-3" style={{ border: '0.5px solid var(--lr-border)', display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12 }}>
                    <div className="font-serif text-[20px] text-lr-red leading-none mt-1">{p.rank ?? i + 1}</div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-1">{p.area}</div>
                      <p className="text-[13px] text-lr-ink leading-relaxed mb-2">{p.finding}</p>
                      {p.action && (
                        <div className="text-[13px] text-lr-ink leading-relaxed px-3 py-2 bg-lr-parchment rounded-lg">
                          <span className="font-bold text-lr-red">→ </span>{p.action}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick wins */}
            {summary.quick_wins?.length > 0 && (
              <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Quick Wins</div>
                <div className="space-y-2">
                  {summary.quick_wins.map((w: string, i: number) => (
                    <div key={i} className="flex gap-2 text-[13px] text-lr-ink leading-relaxed px-3 py-2 rounded-lg" style={{ background: 'rgba(74,122,90,0.04)', border: '0.5px solid rgba(74,122,90,0.18)' }}>
                      <span className="font-bold text-lr-green flex-shrink-0">✓</span>
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data sources */}
            <div className="bg-white rounded-[10px] px-5 py-4 mb-4" style={{ border: '0.5px solid var(--lr-border)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Data Sources</div>
              {richnessGrid}
              {hasPages && (
                <div className="mt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-2">Interior Pages Analyzed</div>
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr>{['URL','Status','Chars','Dimensions'].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-lr-stone px-2.5 py-1.5" style={{ borderBottom: '0.5px solid var(--lr-border-med)' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {data.pagesAnalyzed.map((p: D, i: number) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--lr-border)' }}>
                          <td className="px-2.5 py-1.5 font-mono text-[11px] text-lr-ink">{p.url}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={p.status === 'fetched' ? { background: 'rgba(74,122,90,0.12)', color: 'var(--lr-green)' } : p.status === 'skipped' ? { background: 'rgba(26,26,26,0.07)', color: 'var(--lr-stone)' } : { background: 'rgba(200,49,58,0.10)', color: 'var(--lr-red)' }}>{p.status}</span>
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-[11px] text-lr-stone">{p.chars ? (p.chars / 1000).toFixed(1) + 'k' : '—'}</td>
                          <td className="px-2.5 py-1.5 text-[11px] text-lr-stone">{Array.isArray(p.agents) ? p.agents.join(', ') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Page metadata */}
            {m && (
              <div className="bg-white rounded-[10px] px-5 py-4" style={{ border: '0.5px solid var(--lr-border)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lr-stone mb-3">Page Metadata</div>
                <div className="grid grid-cols-[7rem_1fr] gap-1.5 text-[12px] mb-3">
                  {m.title         && <><span className="text-lr-stone font-medium">Title</span><span className="text-lr-ink">{m.title}</span></>}
                  {m.metaDescription && <><span className="text-lr-stone font-medium">Meta Desc</span><span className="text-lr-ink">{m.metaDescription}</span></>}
                  {m.h1s?.length   && <><span className="text-lr-stone font-medium">H1s</span><span className="text-lr-ink">{m.h1s.join(' / ')}</span></>}
                  {m.canonical     && <><span className="text-lr-stone font-medium">Canonical</span><span className="font-mono text-[11px] text-lr-ink">{m.canonical}</span></>}
                  {m.wordCount     && <><span className="text-lr-stone font-medium">Word count</span><span className="text-lr-ink">~{m.wordCount.toLocaleString()}</span></>}
                  {m.metaRobots    && <><span className="text-lr-stone font-medium">Robots</span><span className="text-lr-ink">{m.metaRobots}</span></>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(['hasStructuredData','hasOgTags','metaDescription','canonical'] as const).map((k) => {
                    const labelMap: Record<string, string> = { hasStructuredData:'Structured Data', hasOgTags:'OG Tags', metaDescription:'Meta Desc', canonical:'Canonical' }
                    return (
                      <span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide" style={!!m[k] ? { background: 'rgba(74,122,90,0.12)', color: 'var(--lr-green)' } : { background: 'rgba(200,49,58,0.08)', color: 'var(--lr-red)' }}>
                        {labelMap[k]}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent sections */}
        {orderedAgents.map((agent) =>
          activeSection === agent.key ? <AgentSection key={agent.key} agent={agent} /> : null
        )}

        {/* GA4 section */}
        {activeSection === 'ga4' && ga4Present && (
          <div>
            <h1 className="text-[22px] font-medium text-lr-ink mb-6">Google Analytics 4</h1>
            <div className="bg-white rounded-[10px] px-5 py-4" style={{ border: '0.5px solid var(--lr-border)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-lr-stone">GA4 Context</span>
                <span className="text-[10px] text-lr-stone">{data.ga4Context.length.toLocaleString()} chars</span>
              </div>
              <MdContent>{data.ga4Context}</MdContent>
            </div>
          </div>
        )}

        {/* GSC section */}
        {activeSection === 'gsc' && gscPresent && (
          <div>
            <h1 className="text-[22px] font-medium text-lr-ink mb-6">Search Console</h1>
            <div className="bg-white rounded-[10px] px-5 py-4" style={{ border: '0.5px solid var(--lr-border)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-lr-stone">Search Console Context</span>
                <span className="text-[10px] text-lr-stone">{data.gscContext.length.toLocaleString()} chars</span>
              </div>
              <MdContent>{data.gscContext}</MdContent>
            </div>
          </div>
        )}

      </main>
    </div>
    </>
  )
}
