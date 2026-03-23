import { useState, useMemo } from 'react'
import {
  RefreshCw, Download, Satellite, ExternalLink, Loader2, CheckCircle2, AlertCircle,
  Sun, Moon,
} from 'lucide-react'
import { useData } from './hooks/useData'
import { useTheme } from './hooks/useTheme'
import { api } from './api'
import { SummaryCards } from './components/SummaryCards'
import { MonthlyChart } from './components/MonthlyChart'
import { MonthlyTable } from './components/MonthlyTable'
import { ProviderChart } from './components/ProviderChart'
import { ModelTable } from './components/ModelTable'
import { ContributionHeatmap } from './components/ContributionHeatmap'
import { TopModels } from './components/TopModels'
import { FilterPanel } from './components/FilterPanel'
import { TokenBreakdown } from './components/TokenBreakdown'
import { DailyChart } from './components/DailyChart'
import { DailyTable } from './components/DailyTable'
import { ShareCard } from './components/ShareCard'
import { PricingTable } from './components/PricingTable'
import type { Filters, ModelEntry, Contribution, MonthlyData, MonthlyEntry } from './types'

type Tab = 'overview' | 'models' | 'monthly' | 'daily' | 'analytics' | 'pricing' | 'share'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'models', label: 'Models' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'daily', label: 'Daily' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'share', label: 'Share' },
]

function buildMonthlyFromContributions(contributions: Contribution[]): MonthlyData {
  const byMonth = new Map<string, {
    input: number; output: number; cacheRead: number; cacheWrite: number
    messageCount: number; cost: number; models: Set<string>
  }>()

  for (const c of contributions) {
    const month = c.date.substring(0, 7)
    let entry = byMonth.get(month)
    if (!entry) {
      entry = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messageCount: 0, cost: 0, models: new Set() }
      byMonth.set(month, entry)
    }
    for (const cl of c.clients) {
      entry.input += cl.tokens.input
      entry.output += cl.tokens.output
      entry.cacheRead += cl.tokens.cacheRead
      entry.cacheWrite += cl.tokens.cacheWrite
      entry.cost += cl.cost
      entry.messageCount += cl.messages
      entry.models.add(cl.modelId)
    }
  }

  const entries: MonthlyEntry[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      models: [...data.models],
      input: data.input,
      output: data.output,
      cacheRead: data.cacheRead,
      cacheWrite: data.cacheWrite,
      messageCount: data.messageCount,
      cost: data.cost,
    }))

  return {
    entries,
    totalCost: entries.reduce((s, e) => s + e.cost, 0),
    processingTimeMs: 0,
  }
}

function App() {
  const { models, graph, pricing, loading, error, refresh, refreshing, meta } = useData()
  const { isDark, toggleTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('overview')
  const [filters, setFilters] = useState<Filters>({
    sources: [],
    providers: [],
    models: [],
    dateRange: null,
    minCost: null,
    search: '',
  })
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const filteredEntries = useMemo((): ModelEntry[] => {
    if (!models?.entries) return []
    let result = models.entries
    if (filters.sources.length > 0)
      result = result.filter(e => filters.sources.includes(e.client))
    if (filters.providers.length > 0)
      result = result.filter(e => filters.providers.includes(e.provider))
    if (filters.models.length > 0)
      result = result.filter(e => filters.models.includes(e.model))
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(e =>
        e.model.toLowerCase().includes(q) ||
        e.provider.toLowerCase().includes(q) ||
        e.client.toLowerCase().includes(q)
      )
    }
    if (filters.minCost != null)
      result = result.filter(e => e.cost >= filters.minCost!)
    return result
  }, [models, filters])

  const filteredContributions = useMemo((): Contribution[] => {
    if (!graph?.contributions) return []
    let result = graph.contributions

    if (filters.dateRange?.start) {
      result = result.filter(c => c.date >= filters.dateRange!.start)
    }
    if (filters.dateRange?.end) {
      result = result.filter(c => c.date <= filters.dateRange!.end)
    }

    const needSourceFilter = filters.sources.length > 0 || filters.providers.length > 0 ||
      filters.models.length > 0 || !!filters.search

    if (needSourceFilter) {
      result = result.map(c => {
        let filteredClients = c.clients

        if (filters.sources.length > 0) {
          filteredClients = filteredClients.filter(s => filters.sources.includes(s.client))
        }
        if (filters.providers.length > 0) {
          filteredClients = filteredClients.filter(s => filters.providers.includes(s.providerId))
        }
        if (filters.models.length > 0) {
          filteredClients = filteredClients.filter(s => filters.models.includes(s.modelId))
        }
        if (filters.search) {
          const q = filters.search.toLowerCase()
          filteredClients = filteredClients.filter(s =>
            s.modelId.toLowerCase().includes(q) ||
            s.providerId.toLowerCase().includes(q) ||
            s.client.toLowerCase().includes(q)
          )
        }

        const newCost = filteredClients.reduce((s, cl) => s + cl.cost, 0)
        const newMessages = filteredClients.reduce((s, cl) => s + cl.messages, 0)
        const newInput = filteredClients.reduce((s, cl) => s + cl.tokens.input, 0)
        const newOutput = filteredClients.reduce((s, cl) => s + cl.tokens.output, 0)
        const newCacheRead = filteredClients.reduce((s, cl) => s + cl.tokens.cacheRead, 0)
        const newCacheWrite = filteredClients.reduce((s, cl) => s + cl.tokens.cacheWrite, 0)
        const newReasoning = filteredClients.reduce((s, cl) => s + cl.tokens.reasoning, 0)
        const newTokens = newInput + newOutput + newCacheRead + newCacheWrite + newReasoning

        return {
          ...c,
          clients: filteredClients,
          totals: { tokens: newTokens, cost: newCost, messages: newMessages },
          tokenBreakdown: {
            input: newInput, output: newOutput,
            cacheRead: newCacheRead, cacheWrite: newCacheWrite, reasoning: newReasoning,
          },
        }
      })
    }

    return result
  }, [graph, filters])

  const filteredMonthly = useMemo((): MonthlyData | null => {
    if (!filteredContributions.length) return null
    return buildMonthlyFromContributions(filteredContributions)
  }, [filteredContributions])

  async function handleRefresh() {
    setRefreshMsg(null)
    const result = await refresh()
    if (result) {
      setRefreshMsg({ ok: result.success, text: result.message })
      setTimeout(() => setRefreshMsg(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-xl p-8 text-center max-w-md">
          <p className="text-rose-400 text-lg font-medium mb-2">Failed to load data</p>
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 glass ${isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}`}>
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Satellite className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
              Tokscale Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <nav className={`hidden md:flex items-center gap-1 rounded-lg p-1 ${
              isDark ? 'bg-slate-800/50' : 'bg-slate-200/60'
            }`}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t.id
                    ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition ${
                  isDark
                    ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <a
                href={api.getCSVUrl()}
                download
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </a>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
                  isDark
                    ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
                    : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Updating...' : 'Update Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden px-4 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-md text-sm whitespace-nowrap ${tab === t.id
                ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Refresh notification */}
      {refreshMsg && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm animate-fade-in ${
            refreshMsg.ok
              ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              : isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'
          }`}>
            {refreshMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {refreshMsg.text}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {meta?.updatedAt && (
          <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Last updated: {new Date(meta.updatedAt).toLocaleString()}
          </p>
        )}

        <SummaryCards models={models} graph={graph} />

        <FilterPanel
          entries={models?.entries ?? []}
          contributions={graph?.contributions ?? []}
          filters={filters}
          onFilterChange={setFilters}
        />

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MonthlyChart monthly={filteredMonthly} />
              </div>
              <TopModels entries={filteredEntries} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProviderChart entries={filteredEntries} groupBy="provider" title="Cost by Provider" />
              <ProviderChart entries={filteredEntries} groupBy="source" title="Cost by Source" />
            </div>
            <ContributionHeatmap contributions={filteredContributions} />
          </>
        )}

        {tab === 'models' && (
          <ModelTable entries={models?.entries ?? []} filters={filters} />
        )}

        {tab === 'monthly' && (
          <>
            <MonthlyChart monthly={filteredMonthly} />
            <MonthlyTable monthly={filteredMonthly} />
            <TokenBreakdown monthly={filteredMonthly} />
          </>
        )}

        {tab === 'daily' && (
          <>
            <DailyChart contributions={filteredContributions} days={60} />
            <DailyTable contributions={filteredContributions} />
            <ContributionHeatmap contributions={filteredContributions} />
          </>
        )}

        {tab === 'analytics' && (
          <>
            <TokenBreakdown monthly={filteredMonthly} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProviderChart entries={filteredEntries} groupBy="provider" title="Cost by Provider" />
              <TopModels entries={filteredEntries} />
            </div>
            <DailyChart contributions={filteredContributions} days={90} />
          </>
        )}

        {tab === 'pricing' && (
          <PricingTable entries={filteredEntries} pricing={pricing} />
        )}

        {tab === 'share' && (
          <ShareCard entries={filteredEntries} contributions={filteredContributions} />
        )}
      </main>

      {/* Footer */}
      <footer className={`mt-12 ${isDark ? 'border-t border-slate-800/50' : 'border-t border-slate-200'}`}>
        <div className={`max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          <span>Tokscale Dashboard &middot; Powered by <a href="https://github.com/junhoyeo/tokscale" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 transition ${isDark ? 'text-slate-500 hover:text-sky-400' : 'text-slate-500 hover:text-sky-600'}`}>tokscale <ExternalLink className="w-3 h-3" /></a></span>
          <span>Data from Cursor IDE, Codex CLI, and more</span>
        </div>
      </footer>
    </div>
  )
}

export default App
