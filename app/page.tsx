'use client'

import { useState, useRef } from 'react'
import { AGENTS, WEIGHTS } from '@/lib/agents'
import { DataSourcesPanel } from '@/components/DataSourcesPanel'

type AgentStatus = 'idle' | 'running' | 'complete' | 'error'

interface AgentState {
  status: AgentStatus
  score?: number
  result?: Record<string, unknown>
}

type AgentResults = Record<string, AgentState>

interface UsageStats {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-700'
  if (score >= 55) return 'text-amber-600'
  return 'text-red-700'
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 35) return 'Weak'
  return 'Critical'
}

function generateMarkdownReport(
  auditUrl: string,
  compositeScore: number,
  agentStates: AgentResults,
  usageStats: UsageStats,
  auditModel: string,
  durationSec: number,
): string {
  const lines: string[] = []
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  lines.push('# Marketing Audit Report')
  lines.push(`**URL:** ${auditUrl}  `)
  lines.push(`**Date:** ${date}  `)
  lines.push(`**Overall Score:** ${compositeScore}/100 — ${scoreLabel(compositeScore)}  `)
  lines.push(`**Model:** ${auditModel} | **Duration:** ${durationSec}s | **Tokens:** ${usageStats.totalTokens.toLocaleString()}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const agent of AGENTS) {
    const state = agentStates[agent.key]
    if (!state || state.status !== 'complete') continue
    const result = state.result as AnyResult

    lines.push(`## ${agent.label}`)
    lines.push(`**Score:** ${state.score}/100 — ${scoreLabel(state.score!)} | **Weight:** ${Math.round(WEIGHTS[agent.key] * 100)}% of overall`)
    lines.push('')

    if (Array.isArray(result.dimensions)) {
      lines.push('### Dimension Scores')
      for (const d of result.dimensions as Array<{ name: string; score: number; finding: string }>) {
        lines.push(`- **${d.name}** (${d.score}/10): ${d.finding}`)
      }
      lines.push('')
    }

    if (Array.isArray(result.wins) && result.wins.length > 0) {
      lines.push('### Strengths')
      for (const w of result.wins as string[]) lines.push(`- ${w}`)
      lines.push('')
    }

    if (Array.isArray(result.critical_fixes) && result.critical_fixes.length > 0) {
      lines.push('### Priority Fixes')
      for (const f of result.critical_fixes as string[]) lines.push(`- ${f}`)
      lines.push('')
    }

    if (Array.isArray(result.quick_wins) && result.quick_wins.length > 0) {
      lines.push('### Quick Wins')
      for (const w of result.quick_wins as string[]) lines.push(`- ${w}`)
      lines.push('')
    }

    if (Array.isArray(result.seo_quick_wins) && result.seo_quick_wins.length > 0) {
      lines.push('### SEO Quick Wins')
      for (const w of result.seo_quick_wins as string[]) lines.push(`- ${w}`)
      lines.push('')
    }

    if (result.biggest_lever) {
      lines.push('### Biggest Opportunity')
      lines.push(result.biggest_lever as string)
      lines.push('')
    }

    if (Array.isArray(result.opportunities) && result.opportunities.length > 0) {
      lines.push('### Opportunities')
      for (const o of result.opportunities as Array<{ title: string; description: string }>) {
        lines.push(`- **${o.title}:** ${o.description}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#15803d' : score >= 55 ? '#b45309' : '#b91c1c'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8E4DC" strokeWidth="5" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

function AgentCard({ agent, state }: { agent: typeof AGENTS[0]; state: AgentState }) {
  const [expanded, setExpanded] = useState(false)
  const result = state.result as AnyResult | undefined

  return (
    <div className={`bg-white rounded-lg border border-[#E8E4DC] transition-all duration-300 overflow-hidden ${
      state.status === 'complete' ? 'border-l-[3px] border-l-[#2D4A6E]' : ''
    }`}>
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => state.status === 'complete' && setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div className="flex-shrink-0 w-5 flex items-center justify-center">
          {state.status === 'idle' && <div className="w-2 h-2 rounded-full bg-[#D4CFC8]" />}
          {state.status === 'running' && (
            <div className="w-4 h-4 rounded-full border-2 border-[#E8E4DC] border-t-[#2D4A6E] animate-spin" />
          )}
          {state.status === 'complete' && (
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {state.status === 'error' && (
            <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold">!</div>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#1A1918] text-sm">{agent.label}</div>
          <div className="text-xs text-[#6B6560] mt-0.5">{Math.round(WEIGHTS[agent.key] * 100)}% of overall</div>
        </div>

        {/* Score */}
        {state.status === 'complete' && state.score !== undefined && (
          <div className="flex items-baseline gap-1.5 flex-shrink-0">
            <span className={`text-xl font-bold tabular-nums ${scoreColor(state.score)}`}>
              {state.score}
            </span>
            <span className="text-[#C4BFB8] text-sm">/100</span>
            <span className={`text-xs font-medium ml-1 ${scoreColor(state.score)}`}>
              {scoreLabel(state.score)}
            </span>
            <span className="text-[#C4BFB8] text-xs ml-2">{expanded ? '▲' : '▼'}</span>
          </div>
        )}

        {state.status === 'running' && (
          <span className="text-xs text-[#6B6560]">Analyzing...</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && result && (
        <div className="px-5 pb-5 border-t border-[#F0EDE8] pt-4 space-y-4">

          {Array.isArray(result.dimensions) && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-3">Dimension Scores</div>
              <div className="space-y-2.5">
                {(result.dimensions as Array<{name: string; score: number; finding: string}>).map((d) => (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="w-40 text-[#6B6560] flex-shrink-0">{d.name}</div>
                      <div className="flex-1 bg-[#F0EDE8] rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${d.score >= 7 ? 'bg-emerald-600' : d.score >= 5 ? 'bg-amber-500' : 'bg-red-600'}`}
                          style={{ width: `${d.score * 10}%` }}
                        />
                      </div>
                      <div className={`w-10 text-xs font-semibold text-right flex-shrink-0 tabular-nums ${d.score >= 7 ? 'text-emerald-700' : d.score >= 5 ? 'text-amber-600' : 'text-red-700'}`}>{d.score}/10</div>
                    </div>
                    <div className="text-xs text-[#3D3936] pl-[11rem]">{d.finding}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.wins) && result.wins.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2">Strengths</div>
              <ul className="space-y-1.5">
                {(result.wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-[#1A1918] flex gap-2 items-start">
                    <svg className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.critical_fixes) && result.critical_fixes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2">Priority Fixes</div>
              <ul className="space-y-1.5">
                {(result.critical_fixes as string[]).map((f, i) => (
                  <li key={i} className="text-xs text-[#1A1918] flex gap-2 items-start">
                    <span className="text-red-700 flex-shrink-0 font-bold leading-none mt-0.5 select-none">—</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.quick_wins) && result.quick_wins.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2">Quick Wins</div>
              <ul className="space-y-1.5">
                {(result.quick_wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-[#1A1918] flex gap-2 items-start">
                    <span className="text-[#2D4A6E] flex-shrink-0 font-semibold leading-none mt-0.5 select-none">+</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.seo_quick_wins) && result.seo_quick_wins.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2">SEO Quick Wins</div>
              <ul className="space-y-1.5">
                {(result.seo_quick_wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-[#1A1918] flex gap-2 items-start">
                    <span className="text-[#2D4A6E] flex-shrink-0 font-semibold leading-none mt-0.5 select-none">+</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.pagespeed && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-3">PageSpeed Insights</div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {([
                  { label: 'Performance', key: 'performance' },
                  { label: 'Accessibility', key: 'accessibility' },
                  { label: 'SEO', key: 'seo' },
                  { label: 'Best Practices', key: 'best_practices' },
                ] as { label: string; key: string }[]).map(({ label, key }) => {
                  const val = (result.pagespeed as Record<string, unknown>)[key] as number
                  const colorClass = val >= 90 ? 'text-emerald-700' : val >= 50 ? 'text-amber-600' : 'text-red-700'
                  const bgClass = val >= 90 ? 'bg-emerald-50 border-emerald-200' : val >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                  return (
                    <div key={key} className={`rounded border px-2 py-2 text-center ${bgClass}`}>
                      <div className={`text-sm font-bold tabular-nums ${colorClass}`}>{val}</div>
                      <div className="text-xs text-[#9C9690] leading-tight mt-0.5">{label}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#6B6560]">
                {([
                  { label: 'LCP', key: 'lcp' },
                  { label: 'CLS', key: 'cls' },
                  { label: 'TBT', key: 'tbt' },
                  { label: 'FCP', key: 'fcp' },
                ] as { label: string; key: string }[]).map(({ label, key }) => (
                  <span key={key}><span className="font-medium text-[#6B6560]">{label}</span> {(result.pagespeed as Record<string, unknown>)[key] as string}</span>
                ))}
              </div>
            </div>
          )}

          {result.biggest_lever && (
            <div className="bg-[#F8F6F2] border border-[#E8E4DC] rounded-lg p-3">
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-1.5">Biggest Opportunity</div>
              <div className="text-xs text-[#1A1918] leading-relaxed">{result.biggest_lever as string}</div>
            </div>
          )}

          {Array.isArray(result.opportunities) && result.opportunities.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2">Opportunities</div>
              <ul className="space-y-2">
                {(result.opportunities as Array<{title: string; description: string}>).map((o, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-semibold text-[#1A1918]">{o.title}:</span>{' '}
                    <span className="text-[#6B6560]">{o.description}</span>
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

export default function Home() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [agentStates, setAgentStates] = useState<AgentResults>({})
  const [compositeScore, setCompositeScore] = useState<number | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [auditModel, setAuditModel] = useState<string>('')
  const [durationSec, setDurationSec] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const startAudit = async () => {
    if (!url.trim()) return
    const targetUrl = url.startsWith('http') ? url : `https://${url}`
    setPhase('running')
    setStatusMsg('Connecting...')
    setCompositeScore(null)
    setUsageStats(null)
    setAuditModel('')
    setDurationSec(null)
    setAgentStates(
      Object.fromEntries(AGENTS.map((a) => [a.key, { status: 'running' as AgentStatus }]))
    )
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/audit?url=${encodeURIComponent(targetUrl)}`, {
        signal: abortRef.current.signal,
      })
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
            if (event.type === 'start' || event.type === 'fetched') setStatusMsg(event.message)
            if (event.type === 'agent_complete') {
              setAgentStates((prev) => ({
                ...prev,
                [event.key]: { status: 'complete' as AgentStatus, score: event.result.score, result: event.result },
              }))
              setStatusMsg('Agents running...')
            }
            if (event.type === 'complete') {
              setCompositeScore(event.compositeScore)
              setUsageStats(event.usage)
              setAuditModel(event.model)
              setDurationSec(Math.round(event.durationMs / 100) / 10)
              setPhase('done')
              setStatusMsg('Analysis complete')
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

  const downloadReport = () => {
    if (compositeScore === null || !usageStats || durationSec === null) return
    const auditUrl = url.startsWith('http') ? url : `https://${url}`
    const md = generateMarkdownReport(auditUrl, compositeScore, agentStates, usageStats, auditModel, durationSec)
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const hostname = new URL(auditUrl).hostname.replace(/^www\./, '')
    a.download = `marketing-audit-${hostname}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setAgentStates({})
    setCompositeScore(null)
    setStatusMsg('')
    setUsageStats(null)
    setAuditModel('')
    setDurationSec(null)
    setUrl('')
  }

  const completedAgents = Object.values(agentStates).filter((a) => a.status === 'complete').length

  return (
    <div className="min-h-screen bg-[#F4F2EF]">
      {/* Header */}
      <header className="bg-white border-b border-[#E8E4DC] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-[#1A1918] text-lg tracking-tight">Marketing Intelligence</h1>
            {phase === 'idle'
              ? <p className="text-[#6B6560] text-xs mt-0.5">Five-dimension website analysis</p>
              : <p className="text-[#3D3936] text-xs mt-0.5 font-medium">{url.startsWith('http') ? url : `https://${url}`}</p>
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
        {phase === 'idle' && (
          <div className="text-center space-y-10">
            <div className="space-y-4">
              <h2 className="font-display text-[#1A1918]" style={{ fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)', lineHeight: 1.1 }}>
                Full Marketing Review
              </h2>
              <p className="text-[#6B6560] text-lg max-w-xl mx-auto leading-relaxed">
                Enter any website. Five specialist analyses — content, conversion, SEO, competitive positioning, and brand strategy — delivered simultaneously.
              </p>
            </div>

            <div className="max-w-lg mx-auto space-y-3">
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
                  disabled={!url.trim()}
                  className="bg-[#2D4A6E] hover:bg-[#243D5C] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-7 py-3.5 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  Run Audit
                </button>
              </div>
              <p className="text-[#9C9690] text-xs">Takes 30–60 seconds. No account required.</p>
            </div>

            {/* Agent preview */}
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

        {(phase === 'running' || phase === 'done') && (
          <div className="space-y-4">
            {/* Score hero */}
            <div className="bg-white rounded-xl border border-[#E8E4DC] p-6 flex items-center gap-6">
              <div className="relative flex-shrink-0">
                {compositeScore !== null ? (
                  <>
                    <ScoreRing score={compositeScore} size={96} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold tabular-nums ${scoreColor(compositeScore)}`}>{compositeScore}</span>
                      <span className="text-[#9C9690] text-xs">/100</span>
                    </div>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-[#E8E4DC] border-t-[#2D4A6E] animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-display text-[#1A1918] text-xl mb-1">
                  {compositeScore !== null
                    ? `Marketing Score: ${compositeScore}/100 — ${scoreLabel(compositeScore)}`
                    : 'Running Analysis...'}
                </div>
                <div className="text-[#6B6560] text-sm mb-3">{statusMsg}</div>
                {phase === 'running' && (
                  <div className="space-y-1.5">
                    <div className="text-[#6B6560] text-xs">{completedAgents} of 5 agents complete</div>
                    <div className="bg-[#F0EDE8] rounded-full h-1 w-48">
                      <div
                        className="bg-[#2D4A6E] h-1 rounded-full transition-all duration-700"
                        style={{ width: `${(completedAgents / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent cards */}
            <div className="space-y-2">
              <div className="text-[#9C9690] text-xs font-semibold uppercase tracking-widest px-1 pt-2">
                Analysis Results
              </div>
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.key}
                  agent={agent}
                  state={agentStates[agent.key] ?? { status: 'idle' }}
                />
              ))}
            </div>

            {(phase === 'running' || phase === 'done') && (
              <DataSourcesPanel hasPageSpeed={!!Object.values(agentStates).find(
                (s) => s.result && (s.result as Record<string, unknown>).pagespeed
              )} />
            )}

            {phase === 'done' && (
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={downloadReport}
                  className="bg-white border border-[#E8E4DC] hover:border-[#2D4A6E] text-[#1A1918] hover:text-[#2D4A6E] text-sm px-6 py-2.5 rounded-lg transition-colors"
                >
                  Download Report
                </button>
                <button
                  onClick={reset}
                  className="bg-white border border-[#E8E4DC] hover:border-[#2D4A6E] text-[#1A1918] hover:text-[#2D4A6E] text-sm px-6 py-2.5 rounded-lg transition-colors"
                >
                  Audit Another Site
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}