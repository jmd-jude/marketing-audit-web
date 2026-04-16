'use client'

import { useState } from 'react'

const AGENT_LABELS: Record<string, string> = {
  content: 'Content & Messaging',
  conversion: 'Conversion',
  technical: 'SEO & Technical',
  strategy: 'Brand & Growth',
  competitive: 'Competitive',
}

const AGENT_ORDER = ['content', 'conversion', 'technical', 'strategy', 'competitive']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditData = Record<string, any>

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

function scoreLabel(s: number) {
  if (s >= 80) return 'Strong'
  if (s >= 65) return 'Average'
  if (s >= 50) return 'Below Average'
  return 'Needs Work'
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function AgentScoreStrip({ agents }: { agents: AuditData[] }) {
  const ordered = AGENT_ORDER.map((key) => agents.find((a) => a.key === key)).filter((a): a is AuditData => Boolean(a))
  return (
    <div className="grid grid-cols-5 divide-x divide-[#E8E4DC] border-t border-[#E8E4DC]">
      {ordered.map((agent) => (
        <div key={agent.key} className="py-4 flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9690]">
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

function LockedSection({ label, description }: { label: string; description: string }) {
  return (
    <div className="border border-dashed border-[#D8D4CE] rounded-lg px-5 py-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F0EDE8] flex items-center justify-center">
        <svg className="w-4 h-4 text-[#9C9690]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <div className="text-sm font-semibold text-[#1A1918]">{label}</div>
        <div className="text-xs text-[#9C9690] mt-0.5">{description}</div>
      </div>
    </div>
  )
}

function UnlockGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validCodes = (process.env.NEXT_PUBLIC_UNLOCK_CODES ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    if (validCodes.includes(code.trim())) {
      onUnlock()
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 text-center space-y-4">
      <div className="w-10 h-10 rounded-full bg-[#F0EDE8] flex items-center justify-center mx-auto">
        <svg className="w-5 h-5 text-[#6B6560]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <div className="font-display text-[#1A1918] font-semibold text-base">Full report is locked</div>
        <div className="text-sm text-[#6B6560] mt-1">
          Enter your access code to unlock priority actions, quick wins, and full agent analysis.
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
            error
              ? 'border-red-400 bg-red-50'
              : 'border-[#E8E4DC] focus:border-[#2D4A6E]'
          }`}
        />
        <button
          type="submit"
          className="bg-[#2D4A6E] hover:bg-[#1A2E45] text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Unlock
        </button>
      </form>
      {error && <p className="text-red-600 text-xs">Invalid code — try again.</p>}
      <p className="text-xs text-[#9C9690]">
        Don&apos;t have a code?{' '}
        <a
          href="mailto:jude.hoffner@gmail.com"
          className="text-[#2D4A6E] hover:underline"
        >
          Get in touch to discuss your findings.
        </a>
      </p>
    </div>
  )
}

export default function AuditReport({ data }: { data: AuditData }) {
  const [unlocked, setUnlocked] = useState(false)

  const summary = data.summary ?? {}
  const agents: AuditData[] = data.agents ?? []
  const compositeScore: number = data.compositeScore ?? 0
  const topPriorities: AuditData[] = summary.top_priorities ?? []
  const firstPriority = topPriorities[0]
  const restPriorities = topPriorities.slice(1)

  return (
    <div className="min-h-screen bg-[#F4F2EF] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-serif text-2xl font-bold text-[#1A1918] tracking-tight">
            Marketing Audit
          </div>
          <div className="text-sm text-[#9C9690] mt-1">
            Powered by AI — {formatDate(data.timestamp)}
          </div>
        </div>

        {/* Score card */}
        <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-serif text-lg font-bold text-[#1A1918] break-all">
                {data.url}
              </div>
              <div className={`text-sm font-semibold mt-1 ${scoreColor(compositeScore)}`}>
                {scoreLabel(compositeScore)}
              </div>
            </div>
            <div className={`flex-shrink-0 border rounded-xl px-5 py-3 text-center ${scoreBg(compositeScore)}`}>
              <div className={`text-4xl font-black tabular-nums leading-none ${scoreColor(compositeScore)}`}>
                {compositeScore}
              </div>
              <div className="text-[10px] text-[#9C9690] uppercase tracking-widest mt-1">/ 100</div>
            </div>
          </div>
          <AgentScoreStrip agents={agents} />
        </div>

        {/* Overall verdict */}
        {summary.overall_verdict && (
          <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">
              Overall Assessment
            </div>
            <p className="text-sm text-[#1A1918] leading-relaxed">{summary.overall_verdict}</p>
          </div>
        )}

        {/* Biggest strength */}
        {summary.biggest_strength && (
          <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">
              Biggest Strength
            </div>
            <p className="text-sm text-[#1A1918] leading-relaxed">{summary.biggest_strength}</p>
          </div>
        )}

        {/* Top priority #1 — finding only */}
        {firstPriority && (
          <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-3">
              Top Priority
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0EDE8] flex items-center justify-center text-xs font-bold text-[#6B6560]">
                1
              </div>
              <div>
                <div className="text-xs font-semibold text-[#2D4A6E] uppercase tracking-wide mb-1">
                  {firstPriority.area}
                </div>
                <p className="text-sm text-[#1A1918] leading-relaxed">{firstPriority.finding}</p>
                {firstPriority.why_it_matters && (
                  <p className="text-xs text-[#6B6560] mt-1 leading-relaxed">{firstPriority.why_it_matters}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Locked or unlocked content */}
        {!unlocked ? (
          <div className="space-y-3">
            <LockedSection
              label={`${restPriorities.length > 0 ? restPriorities.length + ' more' : ''} priority actions`}
              description="Ranked by business impact, each with a specific next step"
            />
            <LockedSection
              label="Quick wins"
              description="Changes actionable this week with clear expected impact"
            />
            <LockedSection
              label="Full agent analysis"
              description="Content, conversion, SEO, strategy, and competitive deep-dives"
            />
            <UnlockGate onUnlock={() => setUnlocked(true)} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Remaining priorities */}
            {restPriorities.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-3">
                  Priority Actions
                </div>
                <div className="space-y-4">
                  {restPriorities.map((p: AuditData) => (
                    <div key={p.rank} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0EDE8] flex items-center justify-center text-xs font-bold text-[#6B6560]">
                        {p.rank}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#2D4A6E] uppercase tracking-wide mb-1">
                          {p.area}
                        </div>
                        <p className="text-sm text-[#1A1918] leading-relaxed">{p.finding}</p>
                        {p.why_it_matters && (
                          <p className="text-xs text-[#6B6560] mt-1 leading-relaxed">{p.why_it_matters}</p>
                        )}
                        {p.action && (
                          <div className="mt-2 bg-[#F4F2EF] rounded-lg px-3 py-2 text-xs text-[#1A1918] leading-relaxed">
                            <span className="font-semibold">Action: </span>{p.action}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins */}
            {summary.quick_wins?.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8E4DC] px-6 py-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-3">
                  Quick Wins
                </div>
                <ul className="space-y-2">
                  {summary.quick_wins.map((w: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-[#1A1918] leading-relaxed">
                      <span className="text-emerald-600 font-bold flex-shrink-0">→</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Agent cards */}
            {AGENT_ORDER.map((key) => {
              const agent = agents.find((a) => a.key === key)
              if (!agent) return null
              const result = agent.result ?? {}
              const dims: AuditData[] = result.dimensions ?? []
              const wins: string[] = result.wins ?? []
              const fixes: string[] = result.critical_fixes ?? []

              return (
                <AgentCard
                  key={key}
                  label={AGENT_LABELS[key]}
                  score={agent.score}
                  dims={dims}
                  wins={wins}
                  fixes={fixes}
                />
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[#9C9690] pt-2 pb-6">
          Questions about this report?{' '}
          <a href="mailto:jude.hoffner@gmail.com" className="text-[#2D4A6E] hover:underline">
            jude.hoffner@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}

function AgentCard({
  label, score, dims, wins, fixes,
}: {
  label: string
  score: number
  dims: AuditData[]
  wins: string[]
  fixes: string[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#FAFAF8] transition-colors"
      >
        <span className="text-sm font-semibold text-[#1A1918]">{label}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-lg font-black tabular-nums ${scoreColor(score)}`}>{score}</span>
          <svg
            className={`w-4 h-4 text-[#9C9690] transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#E8E4DC] px-6 py-4 space-y-4">
          {dims.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">
                Dimensions
              </div>
              <div className="space-y-2">
                {dims.map((d) => (
                  <div key={d.name}>
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-[#1A1918]">{d.name}</span>
                      <span className={`font-bold tabular-nums ${scoreColor(d.score * 10)}`}>
                        {d.score}
                        <span className="text-xs text-[#9C9690] font-normal">/10</span>
                      </span>
                    </div>
                    {d.finding && (
                      <p className="text-xs text-[#6B6560] mt-0.5 leading-relaxed">{d.finding}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {wins.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">
                Wins
              </div>
              <ul className="space-y-1">
                {wins.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#1A1918] leading-relaxed">
                    <span className="text-emerald-600 font-bold flex-shrink-0">+</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fixes.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9C9690] mb-2">
                Critical Fixes
              </div>
              <ul className="space-y-1">
                {fixes.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#1A1918] leading-relaxed">
                    <span className="text-red-600 font-bold flex-shrink-0">!</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
