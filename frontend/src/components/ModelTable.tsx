import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { ModelEntry, Filters } from '../types'

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  return '$' + n.toFixed(4)
}

type SortKey = 'cost' | 'model' | 'source' | 'provider' | 'input' | 'output' | 'cacheRead' | 'messageCount' | 'totalTokens'

function totalTokens(e: ModelEntry): number {
  return e.input + e.output + e.cacheRead + e.cacheWrite + e.reasoning
}

interface Props {
  entries: ModelEntry[]
  filters: Filters
}

export function ModelTable({ entries, filters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const { isDark } = useTheme()

  const filtered = useMemo(() => {
    let result = entries
    if (filters.sources.length > 0) {
      result = result.filter(e => filters.sources.includes(e.client))
    }
    if (filters.providers.length > 0) {
      result = result.filter(e => filters.providers.includes(e.provider))
    }
    if (filters.models.length > 0) {
      result = result.filter(e => filters.models.includes(e.model))
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(e =>
        e.model.toLowerCase().includes(q) ||
        e.provider.toLowerCase().includes(q) ||
        e.client.toLowerCase().includes(q)
      )
    }
    if (filters.minCost != null) {
      result = result.filter(e => e.cost >= filters.minCost!)
    }
    return result
  }, [entries, filters])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'model': cmp = a.model.localeCompare(b.model); break
        case 'source': cmp = a.client.localeCompare(b.client); break
        case 'provider': cmp = a.provider.localeCompare(b.provider); break
        case 'totalTokens': cmp = totalTokens(a) - totalTokens(b); break
        default: cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(sorted.length / pageSize)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
    return sortDir === 'asc'
      ? <ArrowUp className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
      : <ArrowDown className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
  }

  const providerColors: Record<string, string> = isDark
    ? {
        anthropic: 'bg-orange-500/20 text-orange-300',
        openai: 'bg-emerald-500/20 text-emerald-300',
        google: 'bg-blue-500/20 text-blue-300',
        deepseek: 'bg-violet-500/20 text-violet-300',
        xai: 'bg-rose-500/20 text-rose-300',
      }
    : {
        anthropic: 'bg-orange-100 text-orange-700',
        openai: 'bg-emerald-100 text-emerald-700',
        google: 'bg-blue-100 text-blue-700',
        deepseek: 'bg-violet-100 text-violet-700',
        xai: 'bg-rose-100 text-rose-700',
      }

  const totalCost = filtered.reduce((s, e) => s + e.cost, 0)
  const totalMsgs = filtered.reduce((s, e) => s + e.messageCount, 0)
  const totalTokenSum = filtered.reduce((s, e) => s + totalTokens(e), 0)

  return (
    <div className="glass rounded-xl animate-fade-in overflow-hidden">
      <div className={`p-5 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'} flex items-center justify-between`}>
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Model Breakdown</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {sorted.length} models &middot; {formatNumber(totalTokenSum)} tokens &middot; {formatCost(totalCost)} total &middot; {formatNumber(totalMsgs)} messages
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}>
              {([
                ['model', 'Model'],
                ['source', 'Source'],
                ['provider', 'Provider'],
                ['totalTokens', 'Total Tokens'],
                ['input', 'Input'],
                ['output', 'Output'],
                ['cacheRead', 'Cache Read'],
                ['messageCount', 'Messages'],
                ['cost', 'Cost'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none ${
                    isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => toggleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isDark ? 'divide-y divide-slate-700/30' : 'divide-y divide-slate-200'}>
            {paged.map((e, i) => (
              <tr key={`${e.client}-${e.model}-${i}`} className={`transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/50'}`}>
                <td className={`px-4 py-3 font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>{e.model}</td>
                <td className={`px-4 py-3 capitalize ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{e.client}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${providerColors[e.provider] ?? (isDark ? 'bg-slate-600/30 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                    {e.provider}
                  </span>
                </td>
                <td className={`px-4 py-3 tabular-nums font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatNumber(totalTokens(e))}</td>
                <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatNumber(e.input)}</td>
                <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatNumber(e.output)}</td>
                <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatNumber(e.cacheRead)}</td>
                <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatNumber(e.messageCount)}</td>
                <td className={`px-4 py-3 font-medium tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{formatCost(e.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={`p-4 flex items-center justify-between ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`px-3 py-1 rounded-md text-sm disabled:opacity-30 transition ${
                isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={`px-3 py-1 rounded-md text-sm disabled:opacity-30 transition ${
                isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
