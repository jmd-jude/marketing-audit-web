'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const RUN_LIMIT = 2

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [conversionGoal, setConversionGoal] = useState('')
  const [targetCustomer, setTargetCustomer] = useState('')
  const [phase, setPhase] = useState<'idle' | 'running'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [agentsComplete, setAgentsComplete] = useState(0)
  const [savedCode, setSavedCode] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [auditCount, setAuditCount] = useState(0)
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
    setAgentsComplete(0)
    abortRef.current = new AbortController()

    try {
      const res = await fetch(
        `/api/audit?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(name)}&company=${encodeURIComponent(company)}&inviteCode=${encodeURIComponent(codeToUse)}&businessType=${encodeURIComponent(businessType)}&conversionGoal=${encodeURIComponent(conversionGoal)}&targetCustomer=${encodeURIComponent(targetCustomer)}`,
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
            if (event.type === 'start') setStatusMsg(event.message)
            if (event.type === 'fetched') setStatusMsg(event.message)
            if (event.type === 'agent_complete') {
              setAgentsComplete((n) => n + 1)
              setStatusMsg('Analysis compiling...')
            }
            if (event.type === 'summary_running') setStatusMsg(event.message)
            if (event.type === 'complete') {
              if (!savedCode && inviteCode.trim()) {
                localStorage.setItem('invite_code', inviteCode.trim())
                setSavedCode(inviteCode.trim())
              }
              setAuditCount((prev) => {
                const next = prev + 1
                localStorage.setItem('audit_count', String(next))
                return next
              })
              if (event.auditId) router.push(`/audit/${event.auditId}`)
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

  return (
    <div>
      <div className="max-w-5xl mx-auto px-6 py-14">

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
              <p className="text-[#9C9690] text-sm">See first findings in about two minutes. No account required.</p>
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
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors appearance-none"
                style={{ color: businessType ? '#1A1918' : '#C4BFB8' }}
              >
                <option value="" disabled>Business type</option>
                <option value="Consultative / Professional Services">Consultative / Professional Services</option>
                <option value="E-commerce / Retail">E-commerce / Retail</option>
                <option value="SaaS / Subscription">SaaS / Subscription</option>
                <option value="Local Services">Local Services</option>
                <option value="Informational / Blog">Informational / Blog</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="text"
                value={conversionGoal}
                onChange={(e) => setConversionGoal(e.target.value)}
                placeholder="Primary conversion goal — e.g. book a discovery call, start a free trial"
                maxLength={80}
                className="w-full rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors"
              />
              <input
                type="text"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                placeholder="Target customer (optional) — e.g. marketing directors at mid-size B2B companies"
                maxLength={120}
                className="w-full rounded-lg bg-white border border-[#E8E4DC] text-[#1A1918] placeholder-[#C4BFB8] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A6E]/20 focus:border-[#2D4A6E] transition-colors"
              />
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
                  disabled={!url.trim() || !name.trim() || !businessType || !conversionGoal.trim() || (!savedCode && !inviteCode.trim())}
                  className="bg-[#2D4A6E] hover:bg-[#243D5C] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-7 py-3.5 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  Run Audit
                </button>
              </div>
              {auditCount > 0 && (
                <p className="text-[#9C9690] text-xs">{RUN_LIMIT - auditCount} of {RUN_LIMIT} complimentary audits remaining.</p>
              )}
            </div>

            <p className="text-[#9C9690] text-sm">
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
                    <div className="px-5 py-3 bg-[#F4F2EF] border-t border-[#E8E4DC]">
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
              <div
                className="rounded-full border-4 border-t-[#2D4A6E] border-[#E8E4DC] animate-spin flex-shrink-0"
                style={{ width: 80, height: 80 }}
              />
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

      </div>
    </div>
  )
}
