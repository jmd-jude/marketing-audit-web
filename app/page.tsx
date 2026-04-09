'use client'

import { useState, useRef } from 'react'
import { AGENTS } from '@/lib/agents'
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
  estimatedCostUsd: number
}

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-800',    dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500'  },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200',badge: 'bg-purple-100 text-purple-800',dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200',badge: 'bg-orange-100 text-orange-800',dot: 'bg-orange-500' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-800',      dot: 'bg-red-500'    },
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-green-600'
  if (score >= 55) return 'text-yellow-600'
  return 'text-red-600'
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 35) return 'Weak'
  return 'Critical'
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#16a34a' : score >= 55 ? '#ca8a04' : '#dc2626'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>

function AgentCard({ agent, state }: { agent: typeof AGENTS[0]; state: AgentState }) {
  const [expanded, setExpanded] = useState(false)
  const colors = COLOR_MAP[agent.color]

  const result = state.result as AnyResult | undefined

  return (
    <div className={`rounded-xl border-2 transition-all duration-500 overflow-hidden ${
      state.status === 'complete' ? `${colors.bg} ${colors.border}` :
      state.status === 'running' ? 'bg-gray-50 border-gray-300' :
      'bg-white border-gray-200'
    }`}>
      <div
        className="p-4 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => state.status === 'complete' && setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
          {state.status === 'idle' && (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
            </div>
          )}
          {state.status === 'running' && (
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          )}
          {state.status === 'complete' && (
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {state.status === 'error' && (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-sm font-bold">!</div>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm">{agent.label}</div>
          <div className="text-xs text-gray-500">{Math.round(agent.weight * 100)}% of overall score</div>
        </div>

        {/* Score */}
        {state.status === 'complete' && state.score !== undefined && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xl font-bold ${scoreColor(state.score)}`}>
              {state.score}
            </span>
            <span className="text-gray-400 text-sm">/100</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
              {scoreLabel(state.score)}
            </span>
            <span className="text-gray-400 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
          </div>
        )}

        {state.status === 'running' && (
          <span className="text-xs text-gray-500">Analyzing...</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && result && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-3 space-y-4">
          {/* Dimensions */}
          {Array.isArray(result.dimensions) && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dimension Scores</div>
              <div className="space-y-2">
                {(result.dimensions as Array<{name: string; score: number; finding: string}>).map((d) => (
                  <div key={d.name} className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-36 text-gray-600 flex-shrink-0">{d.name}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${d.score >= 7 ? 'bg-green-500' : d.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${d.score * 10}%` }}
                        />
                      </div>
                      <div className={`w-10 text-xs font-semibold text-right flex-shrink-0 ${d.score >= 7 ? 'text-green-600' : d.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{d.score}/10</div>
                    </div>
                    <div className="text-xs text-gray-500 pl-36">{d.finding}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wins */}
          {Array.isArray(result.wins) && (
            <div>
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Wins</div>
              <ul className="space-y-1">
                {(result.wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5 items-start"><span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical fixes */}
          {Array.isArray(result.critical_fixes) && (
            <div>
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Critical Fixes</div>
              <ul className="space-y-1">
                {(result.critical_fixes as string[]).map((f, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5 items-start"><span className="text-red-500 flex-shrink-0 mt-0.5">→</span>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick wins */}
          {Array.isArray(result.quick_wins) && (
            <div>
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Quick Wins</div>
              <ul className="space-y-1">
                {(result.quick_wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5 items-start"><span className="text-blue-500 flex-shrink-0 mt-0.5">⚡</span>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SEO quick wins */}
          {/* PageSpeed Insights pill strip */}
          {result.pagespeed && (
            <div>
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">PageSpeed Insights (Real Data)</div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {([
                  { label: 'Performance', key: 'performance' },
                  { label: 'Accessibility', key: 'accessibility' },
                  { label: 'SEO', key: 'seo' },
                  { label: 'Best Practices', key: 'best_practices' },
                ] as { label: string; key: string }[]).map(({ label, key }) => {
                  const val = (result.pagespeed as Record<string, unknown>)[key] as number
                  const color = val >= 90 ? 'text-green-600 bg-green-50 border-green-200' : val >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200'
                  return (
                    <div key={key} className={`rounded-lg border px-2 py-1.5 text-center ${color}`}>
                      <div className="text-sm font-bold">{val}</div>
                      <div className="text-xs opacity-70 leading-tight">{label}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {([
                  { label: 'LCP', key: 'lcp' },
                  { label: 'CLS', key: 'cls' },
                  { label: 'TBT', key: 'tbt' },
                  { label: 'FCP', key: 'fcp' },
                ] as { label: string; key: string }[]).map(({ label, key }) => (
                  <span key={key}><span className="font-medium text-gray-700">{label}:</span> {(result.pagespeed as Record<string, unknown>)[key] as string}</span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.seo_quick_wins) && (
            <div>
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">SEO Quick Wins</div>
              <ul className="space-y-1">
                {(result.seo_quick_wins as string[]).map((w, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5 items-start"><span className="text-orange-500 flex-shrink-0 mt-0.5">⚡</span>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Biggest lever */}
          {result.biggest_lever && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-yellow-800 mb-1">Biggest Growth Lever</div>
              <div className="text-xs text-gray-700">{result.biggest_lever as string}</div>
            </div>
          )}

          {/* Opportunities */}
          {Array.isArray(result.opportunities) && (
            <div>
              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Opportunities</div>
              <ul className="space-y-1.5">
                {(result.opportunities as Array<{title: string; description: string}>).map((o, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium text-gray-800">{o.title}:</span>{' '}
                    <span className="text-gray-600">{o.description}</span>
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

            if (event.type === 'start' || event.type === 'fetched') {
              setStatusMsg(event.message)
            }

            if (event.type === 'agent_complete') {
              setAgentStates((prev) => ({
                ...prev,
                [event.key]: {
                  status: 'complete' as AgentStatus,
                  score: event.result.score,
                  result: event.result,
                },
              }))
              setStatusMsg('Agents running...')
            }

            if (event.type === 'complete') {
              setCompositeScore(event.compositeScore)
              setUsageStats(event.usage)
              setAuditModel(event.model)
              setDurationSec(Math.round(event.durationMs / 100) / 10)
              setPhase('done')
              setStatusMsg('Audit complete')
            }
          } catch {
            // skip malformed events
          }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">Marketing Intelligence</h1>
            <p className="text-slate-400 text-xs">5 parallel AI agents · Full-spectrum analysis</p>
          </div>
          {phase !== 'idle' && (
            <button
              onClick={reset}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← New Audit
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {phase === 'idle' && (
          <div className="text-center space-y-10">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold text-white tracking-tight">
                Full Marketing Audit
              </h2>
              <p className="text-slate-400 text-xl max-w-xl mx-auto leading-relaxed">
                Enter any website. Five AI specialists analyze content, conversion, SEO, competitive positioning, and brand strategy — all at once.
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
                  className="flex-1 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-500 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={startAudit}
                  disabled={!url.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-sm whitespace-nowrap"
                >
                  Run Audit
                </button>
              </div>
              <p className="text-slate-500 text-xs">Takes 30–60 seconds. No signup required.</p>
            </div>

            {/* Agent preview dots */}
            <div className="grid grid-cols-5 gap-4 max-w-2xl mx-auto pt-4">
              {AGENTS.map((a) => (
                <div key={a.key} className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white/10 mx-auto flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full ${COLOR_MAP[a.color].dot}`} />
                  </div>
                  <div className="text-slate-400 text-xs leading-tight">{a.label}</div>
                  <div className="text-slate-600 text-xs">{Math.round(a.weight * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(phase === 'running' || phase === 'done') && (
          <div className="space-y-6">
            {/* Score hero */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex items-center gap-6">
              <div className="relative flex-shrink-0">
                {compositeScore !== null ? (
                  <>
                    <ScoreRing score={compositeScore} size={96} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold ${scoreColor(compositeScore)}`}>{compositeScore}</span>
                      <span className="text-slate-400 text-xs">/100</span>
                    </div>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-white font-bold text-xl mb-1">
                  {compositeScore !== null
                    ? `Marketing Score: ${compositeScore}/100 — ${scoreLabel(compositeScore)}`
                    : 'Running Marketing Audit...'}
                </div>
                <div className="text-slate-400 text-sm mb-3">{statusMsg}</div>
                {phase === 'running' && (
                  <div className="space-y-1.5">
                    <div className="text-slate-500 text-xs">{completedAgents}/5 agents complete</div>
                    <div className="bg-white/10 rounded-full h-1.5 w-56">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${(completedAgents / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent cards */}
            <div className="space-y-3">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide px-1">
                Agent Results — click any card to expand
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

            {phase === 'done' && usageStats && (
              <div className="bg-white/5 rounded-xl border border-white/10 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                <span className="font-medium text-slate-300">Run stats</span>
                <span>⏱ {durationSec}s</span>
                <span>🤖 {auditModel}</span>
                <span>↑ {usageStats.inputTokens.toLocaleString()} in</span>
                <span>↓ {usageStats.outputTokens.toLocaleString()} out</span>
                <span>Σ {usageStats.totalTokens.toLocaleString()} tokens</span>
                <span className="text-green-400 font-medium">~${usageStats.estimatedCostUsd.toFixed(4)}</span>
              </div>
            )}

            {phase === 'done' && (
              <div className="text-center pt-2">
                <button
                  onClick={reset}
                  className="bg-white/10 hover:bg-white/20 text-white text-sm px-6 py-2.5 rounded-xl transition-colors"
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
