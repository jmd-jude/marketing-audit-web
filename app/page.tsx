'use client'

import { useState, useRef, useEffect } from 'react'

import { DataSourcesPanel } from '@/components/DataSourcesPanel'

interface ExecutiveSummary {
  overall_verdict: string
  top_priorities: Array<{
    rank: number
    area: string
    finding: string
    why_it_matters: string
    action: string
  }>
  biggest_strength: string
  quick_wins: string[]
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-700'
  if (score >= 55) return 'text-amber-600'
  return 'text-red-700'
}


function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r

  if (score === null) {
    return (
      <div
        className="rounded-full border-4 border-t-[#2D4A6E] border-[#E8E4DC] animate-spin flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  const dash = (score / 100) * circ
  const color = score >= 75 ? '#15803d' : score >= 55 ? '#b45309' : '#b91c1c'

  return (
    <svg width={size} height={size} className="flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E4DC" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

const RUN_LIMIT = 2

export default function Home() {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [agentsComplete, setAgentsComplete] = useState(0)
  const [compositeScore, setCompositeScore] = useState<number | null>(null)
  const [summaryResult, setSummaryResult] = useState<ExecutiveSummary | null>(null)
  const [savedCode, setSavedCode] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [auditCount, setAuditCount] = useState(0)
  const [dataConnected, setDataConnected] = useState(false)
  const [dataCompetitive, setDataCompetitive] = useState(false)
  const [hasPageSpeed, setHasPageSpeed] = useState(false)
  const [pagesAnalyzed, setPagesAnalyzed] = useState<Array<{ url: string; status: string }>>([])
  const [auditId, setAuditId] = useState<string | null>(null)
  const [gateEmail, setGateEmail] = useState('')
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [gateSubmitted, setGateSubmitted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const code = localStorage.getItem('invite_code')
    const count = parseInt(localStorage.getItem('audit_count') ?? '0', 10)
    setSavedCode(code)
    setAuditCount(count)
  }, [])

  const startAudit = async () => {
    if (!url.trim()) return
    const targetUrl = url.startsWith('http') ? url : `https://${url}`
    const codeToUse = savedCode ?? inviteCode.trim()
    setInviteError('')
    setPhase('running')
    setStatusMsg('Connecting...')
    setCompositeScore(null)
    setAgentsComplete(0)
    setSummaryResult(null)
    setDataConnected(false)
    setDataCompetitive(false)
    setHasPageSpeed(false)
    setPagesAnalyzed([])
    setAuditId(null)
    setGateEmail('')
    setGateSubmitting(false)
    setGateSubmitted(false)
    abortRef.current = new AbortController()

    try {
      const res = await fetch(
        `/api/audit?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(name)}&company=${encodeURIComponent(company)}&inviteCode=${encodeURIComponent(codeToUse)}`,
        { signal: abortRef.current.signal }
      )
      if (res.status === 401) {
        setInviteError('Invalid invite code. Please check and try again.')
        setPhase('idle')
        return
      }
      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false

      while (!done) {
        const { done: streamDone, value } = await reader.read()
        done = streamDone
        if (value) buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'start') {
              setStatusMsg(event.message)
            }
            if (event.type === 'fetched') {
              setStatusMsg(event.message)
              if (event.connected) setDataConnected(true)
              if (event.competitive) setDataCompetitive(true)
              if (event.pageSpeed) setHasPageSpeed(true)
              if (event.pagesAnalyzed) setPagesAnalyzed(event.pagesAnalyzed)
            }
            if (event.type === 'agent_complete') {
              setAgentsComplete((n) => n + 1)
              setStatusMsg('Analysis compiling...')
            }
            if (event.type === 'summary_running') {
              setStatusMsg(event.message)
            }
            if (event.type === 'summary_complete') {
              setSummaryResult(event.result as ExecutiveSummary)
            }
            if (event.type === 'complete') {
              setCompositeScore(event.compositeScore)
              if (event.auditId) setAuditId(event.auditId)
              setPhase('done')
              setStatusMsg('Analysis complete')
              if (!savedCode && inviteCode.trim()) {
                localStorage.setItem('invite_code', inviteCode.trim())
                setSavedCode(inviteCode.trim())
              }
              setAuditCount((prev) => {
                const next = prev + 1
                localStorage.setItem('audit_count', String(next))
                return next
              })
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStatusMsg('Connection error. Please try again.')
        setPhase('idle')
      }
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setCompositeScore(null)
    setStatusMsg('')
    setAgentsComplete(0)
    setSummaryResult(null)
    setUrl('')
    setName('')
    setCompany('')
    setDataConnected(false)
    setDataCompetitive(false)
    setHasPageSpeed(false)
    setPagesAnalyzed([])
    setAuditId(null)
    setGateEmail('')
    setGateSubmitting(false)
    setGateSubmitted(false)
  }

  const targetUrl = url.startsWith('http') ? url : `https://${url}`

  return (
    <div className="min-h-screen bg-[#F4F2EF]">
      <header className="bg-white border-b border-[#E8E4DC] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-[#1A1918] text-lg tracking-tight">Marketing Intelligence</h1>
            {phase === 'idle'
              ? <p className="text-[#6B6560] text-xs mt-0.5">Digital Audits at Digital Speeds</p>
              : <p className="text-[#3D3936] text-xs mt-0.5 font-medium">{targetUrl}</p>
            }
          </div>
          {phase !== 'idle' && (
            <button onClick={reset} className="text-[#6B6560] hover:text-[#1A1918] text-sm transition-colors">
              New Audit
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">

        {/* ── IDLE: run limit hit ── */}
        {phase === 'idle' && auditCount >= RUN_LIMIT && (
          <div className="text-center space-y-6 max-w-lg mx-auto">
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#E8E4DC] mx-auto flex items-center justify-center">
                <svg className="w-6 h-6 text-[#6B6560]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="font-display text-[#1A1918] text-2xl">Complimentary audits used</h2>
              <p className="text-[#6B6560] text-sm leading-relaxed">
                You&apos;ve used your {RUN_LIMIT} complimentary audits. Get in touch to discuss ongoing access or a full agency engagement.
              </p>
            </div>
            <a
              href="mailto:jude.hoffner@gmail.com?subject=Marketing Intelligence Access"
              className="inline-block bg-[#2D4A6E] hover:bg-[#243D5C] text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-sm"
            >
              Get in Touch
            </a>
          </div>
        )}

        {/* ── IDLE: form ── */}
        {phase === 'idle' && auditCount < RUN_LIMIT && (
          <div className="text-center space-y-10">
            <div className="space-y-4">
              <h2 className="font-display text-[#1A1918]" style={{ fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)', lineHeight: 1.1 }}>
                Digital Marketing Audits
              </h2>
              <p className="text-[#6B6560] text-lg max-w-xl mx-auto leading-relaxed">
                Enter any website URL. Receive a scored report with specific findings and action steps across 5 dimensions: content, conversion, SEO, competitive positioning, and brand strategy.
              </p>
              <p className="text-[#9C9690] text-md">See first findings in about two minutes. No account required.</p>
            </div>

            <div className="max-w-lg mx-auto space-y-3">
              {!savedCode && (
                <div>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value); setInviteError('') }}
                    placeholder="Invite code"
                    className={`w-full rounded-lg bg-white border text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors ${inviteError ? 'border-red-300' : 'border-[#E8E4DC]'}`}
                  />
                  {inviteError && <p className="text-red-600 text-xs mt-1.5 text-left">{inviteError}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors"
                />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company (optional)"
                  className="rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startAudit()}
                  placeholder="https://yourwebsite.com"
                  className="flex-1 rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors"
                />
                <button
                  onClick={startAudit}
                  disabled={!url.trim() || !name.trim() || (!savedCode && !inviteCode.trim())}
                  className="bg-[#2D4A6E] hover:bg-[#243D5C] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-7 py-3.5 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  Run Audit
                </button>
              </div>
              {auditCount > 0 && (
                <p className="text-[#9C9690] text-xs">{RUN_LIMIT - auditCount} of {RUN_LIMIT} complimentary audits remaining.</p>
              )}
            </div>

            <p className="text-[#9C9690] text-md">
              Not sure what to expect?{' '}
              <a href="/sample" className="text-[#2D4A6E] hover:underline">See a sample report →</a>
            </p>

            {/* ── Scope + preview section ── */}
            <div className="border-t border-[#E8E4DC] pt-10 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                {/* Left: five dimensions + data inputs */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                  <div className="divide-y divide-[#E8E4DC]">
                    {[
                      { label: 'Content & Messaging', desc: 'Headline strength, value prop clarity, copy specificity, and whether your pages communicate what you do and why it matters.' },
                      { label: 'Conversion', desc: 'CTA structure, friction points, funnel integrity, and the gaps between visitor intent and the actions you need them to take.' },
                      { label: 'SEO & Technical', desc: 'Page speed, Core Web Vitals, crawlability, on-page signals, and the technical health Google uses to rank and index.' },
                      { label: 'Brand & Strategy', desc: 'Positioning clarity, differentiation strength, audience alignment, and where your growth signals point.' },
                      { label: 'Competitive Positioning', desc: 'How you compare to likely competitors on keyword territory, organic traffic, and market messaging.' },
                    ].map(({ label, desc }) => (
                      <div key={label} className="px-5 py-3.5 flex gap-4 items-baseline">
                        <span className="text-xs font-semibold text-[#2D4A6E] w-40 flex-shrink-0">{label}</span>
                        <p className="text-xs text-[#6B6560] leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#E8E4DC] px-5 py-3.5 bg-[#F9F7F5]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">What we pull in</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {[
                        'Homepage + interior pages',
                        'Google PageSpeed Insights',
                        'Robots.txt + sitemap',
                        'Google Search Console¹',
                        'Google Analytics 4¹',
                        'Competitive intelligence',
                      ].map((source) => (
                        <span key={source} className="text-xs text-[#4A4540]">{source}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#9C9690] mt-2">¹ When access is granted</p>
                  </div>
                </div>

                {/* Right: report card mockup */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                    <div className="px-5 py-4 flex items-center gap-4 border-b border-[#E8E4DC]">
                      <div className="flex-shrink-0 border-2 rounded-xl px-4 py-2.5 text-center bg-amber-50 border-amber-200">
                        <div className="text-3xl font-black tabular-nums text-amber-600 leading-none">58</div>
                        <div className="text-[9px] text-[#9C9690] uppercase tracking-widest mt-1">/ 100</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-amber-600">www.example.com</div>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#9C9690]">Top Findings</div>
                      {[
                        { area: 'Content', finding: 'Homepage headline doesn\'t communicate the core offer — visitors can\'t immediately tell what you do or who it\'s for.' },
                        { area: 'Conversion', finding: 'No clear primary CTA above the fold. Purchase intent has nowhere to land on first contact.' },
                        { area: 'SEO', finding: 'Core Web Vitals flagged — LCP above the 4s threshold, which is suppressing organic rankings.' },
                      ].map(({ area, finding }) => (
                        <div key={area} className="flex gap-2.5">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0EDE8] flex items-center justify-center mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#9C9690]" />
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[#2D4A6E] mb-0.5">{area}</div>
                            <p className="text-[11px] text-[#1A1918] leading-relaxed">{finding}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 bg-[#F4F2EF] border-t border-[#E8E4DC] flex items-center justify-between">
                      <span className="text-[10px] text-[#6B6560]">Full report includes priority actions + quick wins</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── RUNNING ── */}
        {phase === 'running' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-[#E8E4DC] p-8 flex flex-col items-center gap-6 text-center">
              <ScoreRing score={null} size={80} />
              <div>
                <div className="font-display text-[#1A1918] text-lg">Analyzing your site</div>
                <div className="text-[#6B6560] text-sm mt-1">{statusMsg}</div>
              </div>
              <div className="w-full space-y-1.5">
                <div className="text-[#9C9690] text-xs">{agentsComplete} of 5 dimensions complete</div>
                <div className="bg-[#F0EDE8] rounded-full h-1 w-full">
                  <div
                    className="bg-[#2D4A6E] h-1 rounded-full transition-all duration-700"
                    style={{ width: `${(agentsComplete / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && compositeScore !== null && (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Score hero */}
            <div className="bg-white rounded-xl border border-[#E8E4DC] p-6 flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <ScoreRing score={compositeScore} size={96} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold tabular-nums ${scoreColor(compositeScore)}`}>{compositeScore}</span>
                  <span className="text-[#9C9690] text-xs">/100</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {summaryResult?.overall_verdict && (
                  <p className="text-sm text-[#6B6560] leading-relaxed">{summaryResult.overall_verdict}</p>
                )}
              </div>
            </div>

            {/* Top priorities — findings and business impact, no actions */}
            {summaryResult?.top_priorities && summaryResult.top_priorities.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-4">Top Priorities</div>
                <div className="space-y-4">
                  {summaryResult.top_priorities.slice(0, 3).map((p) => (
                    <div key={p.rank} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0EDE8] flex items-center justify-center text-xs font-bold text-[#6B6560]">
                        {p.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#2D4A6E] uppercase tracking-wide mb-0.5">{p.area}</div>
                        <p className="text-sm text-[#1A1918] leading-relaxed">{p.finding}</p>
                        {p.why_it_matters && (
                          <p className="text-xs text-[#6B6560] mt-1 leading-relaxed">{p.why_it_matters}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teaser close */}
            <div className="bg-[#2D4A6E] rounded-xl px-6 py-6">
              {gateSubmitted ? (
                <div className="text-center space-y-1">
                  <div className="text-white font-semibold text-sm">You&apos;re on the list.</div>
                  <p className="text-[#A8C0D8] text-sm">We&apos;ll send the full report to <span className="text-white font-medium">{gateEmail}</span> shortly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-white font-semibold text-sm mb-1">Get the full report</div>
                    <p className="text-[#A8C0D8] text-sm leading-relaxed">
                      Specific recommendations, priority actions, and quick wins for each dimension. We&apos;ll send it to you.
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!gateEmail.trim() || !auditId) return
                      setGateSubmitting(true)
                      try {
                        await fetch('/api/gate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: gateEmail.trim(),
                            auditId,
                            url: targetUrl,
                            auditor: name || undefined,
                          }),
                        })
                        setGateSubmitted(true)
                      } finally {
                        setGateSubmitting(false)
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      value={gateEmail}
                      onChange={(e) => setGateEmail(e.target.value)}
                      placeholder="Your email address"
                      required
                      className="flex-1 rounded-lg px-3 py-2.5 text-sm bg-white text-[#1A1918] placeholder-[#C4BFB8] outline-none"
                    />
                    <button
                      type="submit"
                      disabled={gateSubmitting || !gateEmail.trim()}
                      className="bg-white text-[#2D4A6E] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[#F0EDE8] transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {gateSubmitting ? 'Sending…' : 'Send my report'}
                    </button>
                  </form>
                  <p className="text-[#7A9AB8] text-xs">No spam. Just your report.</p>
                </div>
              )}
            </div>

            <DataSourcesPanel
              hasPageSpeed={hasPageSpeed}
              googleConnected={dataConnected}
              competitiveConnected={dataCompetitive}
              pagesAnalyzed={pagesAnalyzed}
            />

            <div className="flex justify-center pt-2">
              <button
                onClick={reset}
                className="bg-white border border-[#E8E4DC] hover:border-[#2D4A6E] text-[#1A1918] hover:text-[#2D4A6E] text-sm px-6 py-2.5 rounded-lg transition-colors"
              >
                Audit Another Site
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  )
}
