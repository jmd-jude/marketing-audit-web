'use client'

import { useState } from 'react'

interface DataSource {
  id: string
  name: string
  description: string
  tier: 'standard' | 'connected' | 'agency'
  status: 'active' | 'available' | 'coming_soon'
  unlocksText: string
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'html',
    name: 'Page Content',
    description: 'Homepage HTML, meta tags, copy, structure',
    tier: 'standard',
    status: 'active',
    unlocksText: 'Always included',
  },
  {
    id: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Real Lighthouse scores, Core Web Vitals',
    tier: 'standard',
    status: 'active',
    unlocksText: 'Always included',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'Real traffic, conversion rates, channel breakdown, audience behavior',
    tier: 'connected',
    status: 'available',
    unlocksText: 'Unlocks real traffic and conversion data',
  },
  {
    id: 'gsc',
    name: 'Search Console',
    description: 'Keyword rankings, impressions, CTR, index coverage',
    tier: 'connected',
    status: 'available',
    unlocksText: 'Unlocks real organic search performance',
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads Library',
    description: 'Active ad creative, paid social signals, spend indicators',
    tier: 'standard',
    status: 'coming_soon',
    unlocksText: 'Adds paid media analysis dimension',
  },
  {
    id: 'semrush',
    name: 'SEMrush / Ahrefs',
    description: 'Backlinks, keyword gaps, domain authority, competitor traffic',
    tier: 'agency',
    status: 'coming_soon',
    unlocksText: 'Unlocks deep competitive and SEO intelligence',
  },
  {
    id: 'klaviyo',
    name: 'Email Platform',
    description: 'List size, open rates, flow revenue, campaign performance',
    tier: 'agency',
    status: 'coming_soon',
    unlocksText: 'Unlocks retention and email channel data',
  },
]

const TIER_CONFIG = {
  standard: { label: 'Standard' },
  connected: { label: 'Connected' },
  agency: { label: 'Agency' },
}

function ConnectModal({ source, onClose }: { source: DataSource; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 max-w-sm w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-1">{TIER_CONFIG[source.tier].label} tier</div>
        <h3 className="text-[#1A1918] font-semibold text-base mb-1">Connect {source.name}</h3>
        <p className="text-[#6B6560] text-sm mb-4">{source.unlocksText}</p>

        {source.id === 'ga4' || source.id === 'gsc' ? (
          <>
            <div className="bg-[#F4F2EF] border border-[#E8E4DC] rounded-lg p-4 mb-4 text-xs text-[#6B6560] space-y-2">
              <div className="font-semibold text-[#1A1918]">How to enable</div>
              <ol className="space-y-1.5 list-decimal list-inside">
                {source.id === 'ga4' ? (
                  <>
                    <li>In GA4, go to Admin → Account Access Management</li>
                    <li>Add our service account email as a Viewer</li>
                    <li>Future audits on this domain will automatically include real traffic and conversion data</li>
                  </>
                ) : (
                  <>
                    <li>In Search Console, go to Settings → Users and Permissions</li>
                    <li>Add our service account email as a Full User</li>
                    <li>Future audits on this domain will automatically include keyword and ranking data</li>
                  </>
                )}
              </ol>
              <p className="pt-1 text-[#9C9690]">Contact your account manager for the service account email address.</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#F4F2EF] border border-[#E8E4DC] rounded-lg p-4 mb-4 text-xs text-[#6B6560]">
              This integration is on the roadmap.
            </div>
            <button
              disabled
              className="w-full bg-[#F4F2EF] border border-[#E8E4DC] text-[#9C9690] font-semibold py-2.5 rounded-lg text-sm cursor-not-allowed"
            >
              Coming Soon
            </button>
          </>
        )}

        <button onClick={onClose} className="w-full text-[#9C9690] hover:text-[#6B6560] text-xs mt-3 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

export function DataSourcesPanel({ hasPageSpeed, googleConnected = false }: { hasPageSpeed: boolean; googleConnected?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null)

  const sources = DATA_SOURCES.map((s) => {
    if (s.id === 'pagespeed') return { ...s, status: hasPageSpeed ? 'active' : 'coming_soon' as DataSource['status'] }
    if ((s.id === 'ga4' || s.id === 'gsc') && googleConnected) return { ...s, status: 'active' as DataSource['status'] }
    return s
  })

  const availableSources = sources.filter((s) => s.status === 'available')
  const activeCount = sources.filter((s) => s.status === 'active').length

  return (
    <>
      <div className="bg-white rounded-lg border border-[#E8E4DC] overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#F8F6F2] transition-colors"
        >
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-[#6B6560]">Data Sources</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
              {activeCount} active
            </span>
            {availableSources.length > 0 && (
              <span className="text-xs bg-[#F4F2EF] text-[#6B6560] border border-[#E8E4DC] px-1.5 py-0.5 rounded font-medium">
                {availableSources.length} available to connect
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-4">
            {sources.filter((s) => s.status === 'active').map((s) => (
              <span key={s.id} className="text-xs text-[#9C9690] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                {s.name}
              </span>
            ))}
          </div>
          <span className="text-[#C4BFB8] text-xs">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="border-t border-[#F0EDE8] px-5 py-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2.5">Active — used in this audit</div>
              <div className="space-y-2">
                {sources.filter((s) => s.status === 'active').map((s) => (
                  <div key={s.id} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                    <div>
                      <span className="text-sm text-[#1A1918] font-medium">{s.name}</span>
                      <span className="text-xs text-[#9C9690] ml-2">{s.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2.5">Available — connect to unlock</div>
              <div className="space-y-2">
                {sources.filter((s) => s.status === 'available').map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 group cursor-pointer"
                    onClick={() => setSelectedSource(s)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2D4A6E]/30 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#6B6560] font-medium group-hover:text-[#1A1918] transition-colors">{s.name}</span>
                      <span className="text-xs text-[#C4BFB8] ml-2">{s.unlocksText}</span>
                    </div>
                    <button className="text-xs text-[#2D4A6E] border border-[#2D4A6E]/30 hover:border-[#2D4A6E] px-2.5 py-1 rounded transition-colors flex-shrink-0">
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2.5">Roadmap</div>
              <div className="space-y-2">
                {sources.filter((s) => s.status === 'coming_soon').map((s) => (
                  <div key={s.id} className="flex items-start gap-3 opacity-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C4BFB8] flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#6B6560] font-medium">{s.name}</span>
                      <span className="text-xs text-[#9C9690] ml-2">{s.description}</span>
                    </div>
                    <span className="text-xs text-[#9C9690] border border-[#E8E4DC] px-2 py-0.5 rounded flex-shrink-0">
                      {TIER_CONFIG[s.tier].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1 border-t border-[#F0EDE8] text-xs text-[#C4BFB8]">
              GA4 and Search Console data loads automatically when access has been granted. No login required.
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
