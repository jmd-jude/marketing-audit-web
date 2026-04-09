'use client'

import { useState } from 'react'

interface DataSource {
  id: string
  name: string
  description: string
  tier: 'standard' | 'connected' | 'agency'
  status: 'active' | 'available' | 'coming_soon'
  icon: string
  unlocksText: string
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'html',
    name: 'Page Content',
    description: 'Homepage HTML, meta tags, copy, structure',
    tier: 'standard',
    status: 'active',
    icon: '🌐',
    unlocksText: 'Always included',
  },
  {
    id: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Real Lighthouse scores, Core Web Vitals',
    tier: 'standard',
    status: 'active',
    icon: '⚡',
    unlocksText: 'Always included',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'Real traffic, conversion rates, channel breakdown, audience behavior',
    tier: 'connected',
    status: 'available',
    icon: '📊',
    unlocksText: 'Unlocks real traffic & conversion data',
  },
  {
    id: 'gsc',
    name: 'Search Console',
    description: 'Keyword rankings, impressions, CTR, index coverage',
    tier: 'connected',
    status: 'available',
    icon: '🔍',
    unlocksText: 'Unlocks real organic search performance',
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads Library',
    description: 'Active ad creative, paid social signals, spend indicators',
    tier: 'standard',
    status: 'coming_soon',
    icon: '📱',
    unlocksText: 'Adds paid media analysis dimension',
  },
  {
    id: 'semrush',
    name: 'SEMrush / Ahrefs',
    description: 'Backlinks, keyword gaps, domain authority, competitor traffic',
    tier: 'agency',
    status: 'coming_soon',
    icon: '📈',
    unlocksText: 'Unlocks deep competitive & SEO intelligence',
  },
  {
    id: 'klaviyo',
    name: 'Email Platform',
    description: 'List size, open rates, flow revenue, campaign performance',
    tier: 'agency',
    status: 'coming_soon',
    icon: '✉️',
    unlocksText: 'Unlocks retention & email channel data',
  },
]

const TIER_CONFIG = {
  standard: { label: 'Standard', color: 'text-slate-400', badge: 'bg-slate-700 text-slate-300' },
  connected: { label: 'Connected', color: 'text-blue-400', badge: 'bg-blue-900/60 text-blue-300' },
  agency: { label: 'Agency', color: 'text-purple-400', badge: 'bg-purple-900/60 text-purple-300' },
}

function ConnectModal({ source, onClose }: { source: DataSource; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-2xl mb-3">{source.icon}</div>
        <h3 className="text-white font-bold text-lg mb-1">Connect {source.name}</h3>
        <p className="text-slate-400 text-sm mb-4">{source.unlocksText}</p>

        {source.id === 'ga4' || source.id === 'gsc' ? (
          <>
            <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl p-4 mb-4 text-xs text-blue-200 space-y-2">
              <div className="font-semibold text-blue-100">How it works:</div>
              <ol className="space-y-1.5 list-decimal list-inside text-slate-300">
                <li>Your client adds our service account as a <strong>Viewer</strong> on their {source.id === 'ga4' ? 'GA4 property' : 'Search Console'}</li>
                <li>Click Connect below to authenticate</li>
                <li>Future audits on this domain include real {source.id === 'ga4' ? 'traffic & conversion' : 'keyword & ranking'} data</li>
              </ol>
            </div>
            <button
              disabled
              className="w-full bg-white/10 text-slate-400 font-semibold py-2.5 rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
              </svg>
              Connect Google Account
              <span className="text-xs bg-blue-800/60 text-blue-300 px-1.5 py-0.5 rounded">Coming soon</span>
            </button>
            <p className="text-slate-600 text-xs text-center mt-2">Part of the Connected tier</p>
          </>
        ) : (
          <>
            <div className="bg-slate-700/50 rounded-xl p-4 mb-4 text-xs text-slate-300">
              This integration is on the roadmap. We&apos;ll notify you when it&apos;s available.
            </div>
            <button
              disabled
              className="w-full bg-white/5 text-slate-500 font-semibold py-2.5 rounded-xl text-sm cursor-not-allowed"
            >
              Coming Soon
            </button>
          </>
        )}

        <button onClick={onClose} className="w-full text-slate-500 hover:text-slate-400 text-xs mt-3 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

export function DataSourcesPanel({ hasPageSpeed }: { hasPageSpeed: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null)

  const activeSources = DATA_SOURCES.filter((s) => s.status === 'active')
  const availableSources = DATA_SOURCES.filter((s) => s.status === 'available')
  const comingSoonSources = DATA_SOURCES.filter((s) => s.status === 'coming_soon')

  // Reflect actual PageSpeed availability
  const sources = DATA_SOURCES.map((s) =>
    s.id === 'pagespeed' ? { ...s, status: hasPageSpeed ? 'active' : 'coming_soon' as DataSource['status'] } : s
  )
  const activeCount = sources.filter((s) => s.status === 'active').length

  return (
    <>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        {/* Header row — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs font-semibold text-slate-300">Data Sources</span>
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-800/40 px-1.5 py-0.5 rounded font-medium">
              {activeCount} active
            </span>
            {availableSources.length > 0 && (
              <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/30 px-1.5 py-0.5 rounded font-medium">
                {availableSources.length} available
              </span>
            )}
          </div>
          {/* Active source pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {sources.filter((s) => s.status === 'active').map((s) => (
              <span key={s.id} className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {s.name}
              </span>
            ))}
          </div>
          <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-white/10 px-5 py-4 space-y-4">
            {/* Active */}
            <div>
              <div className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-2">Active — used in this audit</div>
              <div className="space-y-2">
                {sources.filter((s) => s.status === 'active').map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-lg w-6 flex-shrink-0">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white font-medium">{s.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{s.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available to connect */}
            <div>
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Available — connect to unlock</div>
              <div className="space-y-2">
                {sources.filter((s) => s.status === 'available').map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 group cursor-pointer"
                    onClick={() => setSelectedSource(s)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
                    <span className="text-lg w-6 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">{s.name}</span>
                      <span className="text-xs text-slate-600 ml-2">{s.unlocksText}</span>
                    </div>
                    <button className="text-xs bg-blue-900/50 hover:bg-blue-800/60 text-blue-300 border border-blue-800/40 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0">
                      Connect →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming soon */}
            <div>
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Roadmap</div>
              <div className="space-y-1.5">
                {sources.filter((s) => s.status === 'coming_soon').map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 opacity-50 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => setSelectedSource(s)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                    <span className="text-lg w-6 flex-shrink-0">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-500 font-medium">{s.name}</span>
                      <span className="text-xs text-slate-700 ml-2">{s.description}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${TIER_CONFIG[s.tier].badge}`}>
                      {TIER_CONFIG[s.tier].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1 border-t border-white/5 text-xs text-slate-600">
              Connect GA4 + Search Console to upgrade analysis quality. Client grants viewer access — no credentials shared.
            </div>
          </div>
        )}
      </div>

      {selectedSource && (
        <ConnectModal source={selectedSource} onClose={() => setSelectedSource(null)} />
      )}
    </>
  )
}
