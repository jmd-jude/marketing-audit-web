'use client'

import { useState, useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>

const AGENT_LABELS: Record<string, string> = {
  content:     'Content & Messaging',
  conversion:  'Conversion Optimization',
  technical:   'SEO & Technical',
  strategy:    'Brand & Growth Strategy',
  competitive: 'Competitive Positioning',
}

const AGENT_ORDER = ['content', 'conversion', 'technical', 'strategy', 'competitive']

const NAV_SECTIONS = [
  { id: 'section-recommendations', label: 'Overview' },
  { id: 'section-content',         label: 'Content' },
  { id: 'section-conversion',      label: 'Conversion' },
  { id: 'section-technical',       label: 'SEO & Technical' },
  { id: 'section-strategy',        label: 'Strategy' },
  { id: 'section-competitive',     label: 'Competitive' },
]

function scoreColor(s: number) {
  if (s >= 75) return 'text-emerald-700'
  if (s >= 55) return 'text-amber-600'
  return 'text-red-700'
}

function scoreBg(s: number) {
  if (s >= 75) return 'bg-emerald-50 border-emerald-200'
  if (s >= 55) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}


function dimColor(s: number) {
  if (s >= 7) return 'bg-emerald-500'
  if (s >= 4) return 'bg-amber-400'
  return 'bg-red-500'
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

// ─── small primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-3">
      {children}
    </div>
  )
}

function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high:     'bg-amber-100 text-amber-800',
    medium:   'bg-blue-100 text-blue-800',
    low:      'bg-green-100 text-green-800',
  }
  const cls = map[sev?.toLowerCase()] ?? 'bg-[#F0EDE8] text-[#6B6560]'
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {sev}
    </span>
  )
}

function DocSectionTitle({ title, score }: { title: string; score?: number }) {
  return (
    <div className="flex items-baseline justify-between pb-3 border-b border-[#E8E4DC] mb-5">
      <h2 className="font-serif text-lg font-semibold text-[#1A1918]">{title}</h2>
      {score != null && (
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-black tabular-nums ${scoreColor(score)}`}>{score}</span>
          {/* <span className={`text-xs font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</span> */}
        </div>
      )}
    </div>
  )
}

// ─── free zone sections ───────────────────────────────────────────────────────

function AgentScoreStrip({ agents }: { agents: D[] }) {
  const ordered = AGENT_ORDER
    .map((key) => agents.find((a) => a.key === key))
    .filter((a): a is D => Boolean(a))

  return (
    <div className="grid grid-cols-5 divide-x divide-[#E8E4DC] border-t border-[#E8E4DC]">
      {ordered.map((agent) => (
        <div key={agent.key} className="py-4 flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9690] text-center leading-tight px-1">
            {AGENT_LABELS[agent.key]?.split(' ')[0]}
          </span>
          <span className={`text-2xl font-black tabular-nums ${scoreColor(agent.score)}`}>
            {agent.score}
          </span>
        </div>
      ))}
    </div>
  )
}

function WhatWeAnalyzed({ data }: { data: D }) {
  const parts: string[] = []

  parts.push('Homepage HTML')
  if (data.pagesAnalyzed?.length) {
    parts.push(`${data.pagesAnalyzed.length} interior page${data.pagesAnalyzed.length !== 1 ? 's' : ''}`)
  }
  if (data.connected) parts.push('Google Search Console + GA4')

  const hasCompetitive = data.agents?.find((a: D) => a.key === 'competitive')?.result?.likely_competitors?.length
  if (hasCompetitive) parts.push('Competitive intelligence')

  const hasPageSpeed = data.agents?.find((a: D) => a.key === 'technical')?.result?.pagespeed
  if (hasPageSpeed) parts.push('PageSpeed Insights')

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
      <SectionLabel>What We Analyzed</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {parts.map((p) => (
          <span
            key={p}
            className="text-xs font-medium bg-[#F0EDE8] text-[#4A4540] px-2.5 py-1 rounded-full"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  )
}

function TopFindings({ priorities }: { priorities: D[] }) {
  if (!priorities.length) return null
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
      <SectionLabel>Top Findings</SectionLabel>
      <div className="space-y-5">
        {priorities.map((p: D, i: number) => (
          <div key={p.rank ?? i} className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0EDE8] flex items-center justify-center text-xs font-bold text-[#6B6560] mt-0.5">
              {p.rank ?? i + 1}
            </div>
            <div>
              <div className="text-xs font-semibold text-[#2D4A6E] uppercase tracking-wide mb-1">
                {p.area}
              </div>
              <p className="text-sm text-[#1A1918] leading-relaxed">{p.finding}</p>
              {p.why_it_matters && (
                <p className="text-xs text-[#6B6560] mt-1 leading-relaxed italic">{p.why_it_matters}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── gate ─────────────────────────────────────────────────────────────────────

function GateCard({
  auditId,
  url,
  auditor,
}: {
  auditId: string
  url: string
  auditor?: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
          <div className="text-white font-semibold text-base mb-1">
            Get the full recommendations
          </div>
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

// ─── gated zone sections ──────────────────────────────────────────────────────

function PriorityActions({ priorities }: { priorities: D[] }) {
  const withActions = priorities.filter((p) => p.action)
  if (!withActions.length) return null
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
      <SectionLabel>Priority Actions</SectionLabel>
      <div className="space-y-5">
        {priorities.map((p: D, i: number) => (
          <div key={p.rank ?? i} className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0EDE8] flex items-center justify-center text-xs font-bold text-[#6B6560] mt-0.5">
              {p.rank ?? i + 1}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[#2D4A6E] uppercase tracking-wide mb-1">
                {p.area}
              </div>
              <p className="text-sm text-[#1A1918] leading-relaxed">{p.finding}</p>
              {p.action && (
                <div className="mt-2 bg-[#F4F2EF] rounded-lg px-3 py-2 text-sm text-[#1A1918] leading-relaxed">
                  <span className="font-semibold text-xs uppercase tracking-wide text-[#2D4A6E]">Action — </span>
                  {p.action}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickWins({ wins }: { wins: string[] }) {
  if (!wins.length) return null
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
      <SectionLabel>Quick Wins</SectionLabel>
      <ul className="space-y-2">
        {wins.map((w, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-[#1A1918] leading-relaxed">
            <span className="text-emerald-600 font-bold flex-shrink-0 mt-0.5">→</span>
            {w}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── agent deep-dive sections ─────────────────────────────────────────────────

function Dimensions({ dims }: { dims: D[] }) {
  if (!dims?.length) return null
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Dimensions</div>
      {dims.map((d) => (
        <div key={d.name}>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-44 flex-shrink-0 text-[#1A1918] font-medium text-xs">{d.name}</span>
            <div className="flex-1 bg-[#F0EDE8] rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${dimColor(d.score)}`}
                style={{ width: `${d.score * 10}%` }}
              />
            </div>
            <span className={`w-10 text-right text-xs font-bold tabular-nums ${scoreColor(d.score * 10)}`}>
              {d.score}<span className="text-[#9C9690] font-normal">/10</span>
            </span>
          </div>
          {d.finding && (
            <p className="text-xs text-[#6B6560] mt-0.5 leading-relaxed pl-[11.5rem]">{d.finding}</p>
          )}
        </div>
      ))}
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
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">{label}</div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 text-sm text-[#1A1918] leading-relaxed">
          <span className={`flex-shrink-0 font-bold ${markerClass}`}>{marker}</span>
          {item}
        </div>
      ))}
    </div>
  )
}

function FunnelLeaks({ leaks }: { leaks: D[] }) {
  if (!leaks?.length) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Funnel Leaks</div>
      {leaks.map((l, i) => (
        <div key={i} className="bg-[#F4F2EF] rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <SevBadge sev={l.severity} />
            <span className="text-sm font-semibold text-[#1A1918]">{l.stage}</span>
          </div>
          <p className="text-xs text-[#6B6560] leading-relaxed mb-1.5">{l.issue}</p>
          {l.fix && (
            <p className="text-xs text-[#1A1918] leading-relaxed">
              <span className="text-emerald-600 font-bold">→ </span>{l.fix}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function AbTests({ tests }: { tests: D[] }) {
  if (!tests?.length) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">A/B Test Ideas</div>
      {tests.map((t, i) => (
        <div key={i} className="bg-[#F4F2EF] rounded-lg px-4 py-3">
          <p className="text-sm text-[#1A1918] italic leading-relaxed mb-1.5">{t.hypothesis}</p>
          <div className="flex gap-4 text-xs text-[#6B6560]">
            {t.metric && <span><span className="font-semibold text-[#1A1918]">Metric:</span> {t.metric}</span>}
            {t.impact && <span><span className="font-semibold text-[#1A1918]">Impact:</span> {t.impact}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function CopyRewrites({ items }: { items: D[] }) {
  if (!items?.length) return null
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Copy Rewrites</div>
      {items.map((ba, i) => (
        <div key={i} className="border border-[#E8E4DC] rounded-lg overflow-hidden">
          <div className="bg-[#F4F2EF] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
            {ba.element}
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#E8E4DC]">
            <div className="px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1.5">Before</div>
              <p className="text-xs text-[#1A1918] leading-relaxed">{ba.before}</p>
            </div>
            <div className="px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1.5">After</div>
              <p className="text-xs text-[#1A1918] leading-relaxed">{ba.after}</p>
            </div>
          </div>
          {ba.why && (
            <div className="border-t border-[#E8E4DC] px-4 py-2 text-xs text-[#6B6560] italic leading-relaxed">
              {ba.why}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PageSpeed({ ps }: { ps: D }) {
  if (!ps) return null
  function psColor(v: number) {
    if (v >= 90) return { bg: 'bg-emerald-50 border-emerald-200', num: 'text-emerald-700' }
    if (v >= 50) return { bg: 'bg-amber-50 border-amber-200', num: 'text-amber-600' }
    return { bg: 'bg-red-50 border-red-200', num: 'text-red-700' }
  }
  const metrics = [
    ['Performance', ps.performance],
    ['Accessibility', ps.accessibility],
    ['SEO', ps.seo],
    ['Best Practices', ps.best_practices],
  ] as [string, number][]

  const cwv = [['LCP', ps.lcp], ['CLS', ps.cls], ['TBT', ps.tbt], ['FCP', ps.fcp]]
    .filter(([, v]) => v) as [string, string][]

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">PageSpeed Insights</div>
      <div className="grid grid-cols-4 gap-2">
        {metrics.map(([label, val]) => {
          const c = psColor(val)
          return (
            <div key={label} className={`border rounded-lg text-center px-2 py-2.5 ${c.bg}`}>
              <div className={`text-lg font-black tabular-nums leading-none ${c.num}`}>{val}</div>
              <div className="text-[10px] text-[#9C9690] mt-1">{label}</div>
            </div>
          )
        })}
      </div>
      {cwv.length > 0 && (
        <div className="flex gap-4 flex-wrap text-xs text-[#6B6560]">
          {cwv.map(([k, v]) => (
            <span key={k}><span className="font-semibold text-[#1A1918]">{k}</span> {v}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function TechnicalIssues({ issues }: { issues: D[] }) {
  if (!issues?.length) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Technical Issues</div>
      {issues.map((iss, i) => (
        <div key={i} className="bg-[#F4F2EF] rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <SevBadge sev={iss.severity} />
            <span className="text-sm font-semibold text-[#1A1918]">{iss.issue}</span>
          </div>
          {iss.impact && <p className="text-xs text-[#6B6560] leading-relaxed mb-1.5">{iss.impact}</p>}
          {iss.fix && (
            <p className="text-xs text-[#1A1918] leading-relaxed">
              <span className="text-emerald-600 font-bold">→ </span>{iss.fix}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function TrackingStatus({ tracking }: { tracking: D[] }) {
  if (!tracking?.length) return null
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Tracking Status</div>
      {tracking.map((t, i) => (
        <div key={i} className="flex items-baseline gap-3 text-sm">
          <span className="w-32 flex-shrink-0 text-xs font-medium text-[#1A1918]">{t.tool}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
            t.present ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}>
            {t.present ? 'Present' : 'Missing'}
          </span>
          {t.notes && <span className="text-xs text-[#6B6560] leading-relaxed">{t.notes}</span>}
        </div>
      ))}
    </div>
  )
}

function Competitors({ comps }: { comps: D[] }) {
  if (!comps?.length) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Likely Competitors</div>
      {comps.map((c, i) => (
        <div key={i} className="bg-[#F4F2EF] rounded-lg px-4 py-3">
          <div className="text-sm font-semibold text-[#1A1918] mb-2">{c.name}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">Strength</div>
              <p className="text-xs text-[#1A1918] leading-relaxed">{c.strength}</p>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Weakness</div>
              <p className="text-xs text-[#1A1918] leading-relaxed">{c.weakness}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Opportunities({ opps }: { opps: D[] }) {
  if (!opps?.length) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Opportunities</div>
      {opps.map((o, i) => (
        <div key={i} className="bg-[#F4F2EF] rounded-lg px-4 py-3">
          <div className="text-sm font-semibold text-[#1A1918] mb-1">{o.title}</div>
          <p className="text-xs text-[#6B6560] leading-relaxed">{o.description}</p>
        </div>
      ))}
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
    <div className="space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Revenue Opportunities</div>
      {tiers.map(({ key, label }) => {
        const items: D[] = rev[key] ?? []
        if (!items.length) return null
        return (
          <div key={key}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9690] border-b border-[#E8E4DC] pb-1 mb-2">
              {label}
            </div>
            {items.map((item, i) => (
              <div key={i} className="py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold bg-[#F0EDE8] text-[#6B6560] px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
                    {item.effort}
                  </span>
                  <span className="text-xs text-[#1A1918] leading-relaxed">{item.opportunity}</span>
                </div>
                {item.impact && (
                  <p className="text-[10px] text-[#9C9690] leading-relaxed pl-9">{item.impact}</p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function BiggestLever({ lever }: { lever: string }) {
  if (!lever) return null
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690]">Biggest Lever</div>
      <div className="bg-[#EEF2F8] border border-[#BFCFE8] rounded-lg px-4 py-3 text-sm text-[#1A1918] leading-relaxed">
        {lever}
      </div>
    </div>
  )
}


// ─── sticky nav bar (unlocked only) ──────────────────────────────────────────

function StickyBar({
  activeSection,
  onNav,
  url,
}: {
  activeSection: string
  onNav: (id: string) => void
  url: string
}) {
  const hostname = (() => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') }
    catch { return url }
  })()

  return (
    <div className="sticky top-[57px] z-20 bg-white border-b border-[#E8E4DC] shadow-sm">
      <div className="max-w-[900px] mx-auto px-6 h-12 flex items-center gap-4">
        <span className="flex-shrink-0 text-sm font-medium text-[#6B6560] truncate max-w-[200px]">{hostname}</span>
        <div className="flex-1 flex items-center justify-center gap-0.5 overflow-x-auto">
          {NAV_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-md transition-colors ${
                activeSection === id
                  ? 'bg-[#EEF2F8] text-[#2D4A6E] font-bold'
                  : 'text-[#9C9690] hover:text-[#1A1918]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AuditReport({ data, autoUnlock }: { data: D; autoUnlock?: boolean }) {
  const [unlocked, setUnlocked] = useState(autoUnlock ?? false)
  const [activeSection, setActiveSection] = useState('section-recommendations')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('full') === '1') setUnlocked(true)
  }, [])

  const summary: D = data.summary ?? {}
  const agents: D[] = data.agents ?? []
  const compositeScore: number = data.compositeScore ?? 0
  const priorities: D[] = summary.top_priorities ?? []

  const orderedAgents = AGENT_ORDER
    .map((key) => agents.find((a) => a.key === key))
    .filter((a): a is D => Boolean(a))

  function navTo(id: string) {
    setActiveSection(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeAgent = orderedAgents.find((a) => `section-${a.key}` === activeSection)

  return (
    <div className="pb-12 px-4">

      {unlocked && (
        <StickyBar
          activeSection={activeSection}
          onNav={navTo}
          url={data.url ?? ''}
        />
      )}

      <div className="mx-auto space-y-4 max-w-[900px] pt-8">

        {/* Free state: score block, assessment, what we analyzed, findings, gate */}
        {!unlocked && (
          <>
            <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
              <div className="px-6 py-6 flex items-center justify-between gap-6">
                <div>
                  <div className="font-serif text-2xl text-[#6B6560] break-all">{data.url}</div>
                  <div className="text-xs text-[#9C9690] mt-1">{formatDate(data.timestamp)}</div>
                </div>
                <div className={`flex-shrink-0 border-2 rounded-2xl px-6 py-4 text-center ${scoreBg(compositeScore)}`}>
                  <div className={`text-5xl font-black tabular-nums leading-none ${scoreColor(compositeScore)}`}>
                    {compositeScore}
                  </div>
                  <div className="text-[10px] text-[#9C9690] uppercase tracking-widest mt-1.5">/ 100</div>
                </div>
              </div>
              <AgentScoreStrip agents={agents} />
            </div>

            {summary.overall_verdict && (
              <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                <SectionLabel>Overall Assessment</SectionLabel>
                <p className="text-sm text-[#1A1918] leading-relaxed">{summary.overall_verdict}</p>
              </div>
            )}

            <WhatWeAnalyzed data={data} />
            <TopFindings priorities={priorities} />
            <GateCard
              auditId={data.id}
              url={data.url}
              auditor={data.auditor}
            />
          </>
        )}

        {/* Unlocked state: tab content */}
        {unlocked && (
          <div className="pt-2">

            {activeSection === 'section-recommendations' && (
              <div className="space-y-4">

                {/* Score block — re-orients the reader on open */}
                <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                  <div className="px-6 py-6 flex items-center justify-between gap-6">
                    <div>
                      <div className="font-serif text-2xl text-[#6B6560] break-all">{data.url}</div>
                      <div className="text-xs text-[#9C9690] mt-1">{formatDate(data.timestamp)}</div>
                    </div>
                    <div className={`flex-shrink-0 border-2 rounded-2xl px-6 py-4 text-center ${scoreBg(compositeScore)}`}>
                      <div className={`text-5xl font-black tabular-nums leading-none ${scoreColor(compositeScore)}`}>
                        {compositeScore}
                      </div>
                      <div className="text-[10px] text-[#9C9690] uppercase tracking-widest mt-1.5">/ 100</div>
                    </div>
                  </div>
                  <AgentScoreStrip agents={agents} />
                </div>

                {summary.overall_verdict && (
                  <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                    <SectionLabel>Overall Assessment</SectionLabel>
                    <p className="text-sm text-[#1A1918] leading-relaxed">{summary.overall_verdict}</p>
                  </div>
                )}

                <WhatWeAnalyzed data={data} />
                <PriorityActions priorities={priorities} />
                <QuickWins wins={summary.quick_wins ?? []} />
                {summary.biggest_strength && (
                  <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                    <SectionLabel>Biggest Strength</SectionLabel>
                    <p className="text-sm text-[#1A1918] leading-relaxed">{summary.biggest_strength}</p>
                  </div>
                )}
              </div>
            )}

            {activeAgent && (() => {
              const r: D = activeAgent.result ?? {}
              return (
                <div className="space-y-4">
                  <DocSectionTitle title={AGENT_LABELS[activeAgent.key]} score={activeAgent.score} />
                  <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-6 space-y-6">
                    <Dimensions dims={r.dimensions} />
                    <StringList items={r.wins} label="Strengths" marker="+" markerClass="text-emerald-600" />
                    <StringList items={r.critical_fixes} label="Critical Fixes" marker="!" markerClass="text-red-600" />
                    <CopyRewrites items={r.before_after} />
                    <StringList items={r.quick_wins} label="Conversion Quick Wins" marker="→" markerClass="text-emerald-600" />
                    <FunnelLeaks leaks={r.funnel_leaks} />
                    <AbTests tests={r.ab_tests} />
                    <PageSpeed ps={r.pagespeed} />
                    <StringList items={r.seo_quick_wins} label="SEO Quick Wins" marker="→" markerClass="text-emerald-600" />
                    <TechnicalIssues issues={r.technical_issues} />
                    <TrackingStatus tracking={r.tracking_status} />
                    <Competitors comps={r.likely_competitors} />
                    <Opportunities opps={r.opportunities} />
                    <StringList items={r.recommended_actions} label="Recommended Actions" marker="→" markerClass="text-[#2D4A6E]" />
                    {(r.brand_score != null || r.growth_score != null) && (
                      <div className="flex gap-6">
                        {r.brand_score != null && (
                          <div className="text-center">
                            <div className={`text-2xl font-black tabular-nums ${scoreColor(r.brand_score)}`}>{r.brand_score}</div>
                            <div className="text-[10px] text-[#9C9690] uppercase tracking-widest mt-0.5">Brand</div>
                          </div>
                        )}
                        {r.growth_score != null && (
                          <div className="text-center">
                            <div className={`text-2xl font-black tabular-nums ${scoreColor(r.growth_score)}`}>{r.growth_score}</div>
                            <div className="text-[10px] text-[#9C9690] uppercase tracking-widest mt-0.5">Growth</div>
                          </div>
                        )}
                      </div>
                    )}
                    <BiggestLever lever={r.biggest_lever} />
                    <RevenueOpportunities rev={r.revenue_opportunities} />
                  </div>
                </div>
              )
            })()}

          </div>
        )}

      </div>
    </div>
  )
}
