'use client'

import { useState } from 'react'

interface DataSource {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'coming_soon'
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'html',
    name: 'Page Content',
    description: 'Homepage HTML, meta tags, copy, structure',
    status: 'active',
  },
  {
    id: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Real Lighthouse scores, Core Web Vitals',
    status: 'active',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'Real traffic, conversion rates, channel breakdown, audience behavior',
    status: 'inactive',
  },
  {
    id: 'gsc',
    name: 'Search Console',
    description: 'Keyword rankings, impressions, CTR, index coverage',
    status: 'inactive',
  },
  {
    id: 'dataforseo_labs',
    name: 'Competitor Intelligence',
    description: 'Organic traffic estimates, keyword rankings, top competitor domain overlap',
    status: 'inactive',
  },
  {
    id: 'dataforseo_backlinks',
    name: 'Backlinks & Authority',
    description: 'Referring domains, authority score, link profile health',
    status: 'coming_soon',
  },
  {
    id: 'dataforseo_keywords',
    name: 'Keyword Gap Analysis',
    description: "Keywords your competitors rank for that you don't — ranked by opportunity",
    status: 'coming_soon',
  },
  {
    id: 'email_platform',
    name: 'Email Platform',
    description: 'List size, open rates, flow revenue, campaign performance',
    status: 'coming_soon',
  },
]

export function DataSourcesPanel({
  hasPageSpeed,
  googleConnected = false,
  competitiveConnected = false,
  pagesAnalyzed = [],
}: {
  hasPageSpeed: boolean
  googleConnected?: boolean
  competitiveConnected?: boolean
  pagesAnalyzed?: Array<{ url: string; status: string }>
}) {
  const [expanded, setExpanded] = useState(false)

  const sources = DATA_SOURCES.map((s) => {
    if (s.id === 'pagespeed') return { ...s, status: hasPageSpeed ? 'active' : 'inactive' as DataSource['status'] }
    if ((s.id === 'ga4' || s.id === 'gsc') && googleConnected) return { ...s, status: 'active' as DataSource['status'] }
    if (s.id === 'dataforseo_labs' && competitiveConnected) return { ...s, status: 'active' as DataSource['status'] }
    return s
  })

  const activeSources = sources.filter((s) => s.status === 'active')

  return (
    <div className="bg-white rounded-lg border border-[#E8E4DC] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#F8F6F2] transition-colors"
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-semibold text-[#6B6560]">Data Sources</span>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
            {activeSources.length} active
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          {activeSources.map((s) => (
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
              {activeSources.map((s) => (
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
            <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-2.5">Roadmap</div>
            <div className="space-y-2">
              {sources.filter((s) => s.status === 'coming_soon').map((s) => (
                <div key={s.id} className="flex items-start gap-3 opacity-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4BFB8] flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#6B6560] font-medium">{s.name}</span>
                    <span className="text-xs text-[#9C9690] ml-2">{s.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pagesAnalyzed.length > 0 && (
            <div className="pt-1 border-t border-[#F0EDE8]">
              <div className="text-xs font-semibold text-[#9C9690] uppercase tracking-widest mb-1.5">Pages analyzed</div>
              <div className="text-xs text-[#6B6560]">
                homepage{pagesAnalyzed.filter((p) => p.status === 'fetched').map((p) => `, ${p.url}`).join('')}
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-[#F0EDE8] text-xs text-[#C4BFB8]">
            GA4 and Search Console data loads automatically when our google service account access has been granted.
          </div>
        </div>
      )}
    </div>
  )
}
