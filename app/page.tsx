'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENTS, WEIGHTS } from '@/lib/agents'
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

function scoreLabel(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Average'
  if (score >= 50) return 'Below Average'
  if (score >= 35) return 'Weak'
  return 'Critical'
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
  }

  const targetUrl = url.startsWith('http') ? url : `https://${url}`

  return (
    <div className="min-h-screen bg-[#F4F2EF]">
      <header className="bg-white border-b border-[#E8E4DC] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-6 py-14">

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
                Digital Marketing Audit
              </h2>
              <p className="text-[#6B6560] text-lg max-w-xl mx-auto leading-relaxed">
                Enter any website. Five dimension analysis — content, conversion, SEO, positioning, and brand strategy.
              </p>
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

            <div className="border-t border-[#E8E4DC] pt-8 grid grid-cols-5 gap-4 max-w-2xl mx-auto">
              {AGENTS.map((a) => (
                <div key={a.key} className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-full border border-[#E8E4DC] bg-white mx-auto flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#2D4A6E]/25" />
                  </div>
                  <div className="text-[#6B6560] text-xs leading-tight">{a.label}</div>
                  <div className="text-[#C4BFB8] text-xs">{Math.round(WEIGHTS[a.key] * 100)}%</div>
                </div>
              ))}
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
                <div className="font-display text-[#1A1918] text-xl mb-1.5">
                  {scoreLabel(compositeScore)} — {compositeScore}/100
                </div>
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
            <div className="bg-[#F0F4FA] border border-[#BFCFE8] rounded-xl px-6 py-5">
              <div className="text-sm font-semibold text-[#1A1918] mb-1.5">Your full report is ready.</div>
              <p className="text-sm text-[#4A5A72] leading-relaxed">
                The score and findings above come from a complete analysis across five dimensions. The full report has the specific recommendations, priority actions, and quick wins for each one. Expect it from us shortly.
              </p>
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
