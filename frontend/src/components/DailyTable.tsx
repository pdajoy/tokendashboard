import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useTheme } from '../hooks/useTheme'
import type { Contribution } from '../types'

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  if (n < 0.01 && n > 0) return '$' + n.toFixed(4)
  return '$' + n.toFixed(2)
}

type SortKey = 'date' | 'tokens' | 'cost' | 'messages' | 'input' | 'output'

interface Props {
  contributions: Contribution[]
}

export function DailyTable({ contributions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 30
  const { isDark } = useTheme()

  const activeDays = useMemo(() =>
    contributions.filter(c => c.totals.cost > 0 || c.totals.messages > 0),
    [contributions]
  )

  const sorted = useMemo(() => {
    return [...activeDays].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'tokens': cmp = a.totals.tokens - b.totals.tokens; break
        case 'cost': cmp = a.totals.cost - b.totals.cost; break
        case 'messages': cmp = a.totals.messages - b.totals.messages; break
        case 'input': cmp = a.tokenBreakdown.input - b.tokenBreakdown.input; break
        case 'output': cmp = a.tokenBreakdown.output - b.tokenBreakdown.output; break
        default: cmp = 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [activeDays, sortKey, sortDir])

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

  if (!activeDays.length) return null

  const totalCost = activeDays.reduce((s, c) => s + c.totals.cost, 0)
  const totalTokens = activeDays.reduce((s, c) => s + c.totals.tokens, 0)
  const totalMsgs = activeDays.reduce((s, c) => s + c.totals.messages, 0)

  const cols: [SortKey, string][] = [
    ['date', 'Date'],
    ['tokens', 'Total Tokens'],
    ['input', 'Input'],
    ['output', 'Output'],
    ['messages', 'Messages'],
    ['cost', 'Cost'],
  ]

  return (
    <div className="glass rounded-xl animate-fade-in overflow-hidden">
      <div className={`p-5 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Daily Detail</h3>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {activeDays.length} active days &middot; {fmtNum(totalTokens)} tokens &middot; {fmtCost(totalCost)} total &middot; {fmtNum(totalMsgs)} messages
          &middot; Click a row to see model breakdown
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}>
              <th className="w-6" />
              {cols.map(([key, label]) => (
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
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cache Read</th>
            </tr>
          </thead>
          <tbody className={isDark ? 'divide-y divide-slate-700/30' : 'divide-y divide-slate-200'}>
            {paged.map(c => {
              const isExpanded = expandedDate === c.date
              return (
                <>
                  <tr
                    key={c.date}
                    className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/50'}`}
                    onClick={() => setExpandedDate(isExpanded ? null : c.date)}
                  >
                    <td className={`pl-3 py-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {c.clients.length > 0 && (
                        isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {format(parseISO(c.date), 'yyyy-MM-dd (EEE)')}
                    </td>
                    <td className={`px-4 py-3 tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(c.totals.tokens)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(c.tokenBreakdown.input)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(c.tokenBreakdown.output)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{c.totals.messages}</td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(c.totals.cost)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(c.tokenBreakdown.cacheRead)}</td>
                  </tr>
                  {isExpanded && c.clients.length > 0 && (
                    <tr key={`${c.date}-detail`}>
                      <td colSpan={8} className="px-0 py-0">
                        <div className={isDark ? 'bg-slate-800/40 border-y border-slate-700/30' : 'bg-slate-50 border-y border-slate-200'}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className={`px-6 py-2 text-left font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Source</th>
                                <th className={`px-4 py-2 text-left font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Model</th>
                                <th className={`px-4 py-2 text-left font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Provider</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Input</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Output</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cache Read</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Messages</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cost</th>
                              </tr>
                            </thead>
                            <tbody className={isDark ? 'divide-y divide-slate-700/20' : 'divide-y divide-slate-200/50'}>
                              {c.clients
                                .filter(s => s.cost > 0 || s.messages > 0)
                                .sort((a, b) => b.cost - a.cost)
                                .map((s, i) => (
                                  <tr key={i} className={isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-100'}>
                                    <td className={`px-6 py-1.5 capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.client}</td>
                                    <td className={`px-4 py-1.5 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.modelId}</td>
                                    <td className={`px-4 py-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.providerId}</td>
                                    <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(s.tokens.input)}</td>
                                    <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(s.tokens.output)}</td>
                                    <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(s.tokens.cacheRead)}</td>
                                    <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.messages}</td>
                                    <td className={`px-4 py-1.5 text-right tabular-nums font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(s.cost)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={isDark ? 'border-t-2 border-slate-600 bg-slate-800/30' : 'border-t-2 border-slate-300 bg-slate-100/50'}>
              <td />
              <td className={`px-4 py-3 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total ({activeDays.length} days)</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtNum(totalTokens)}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(activeDays.reduce((s, c) => s + c.tokenBreakdown.input, 0))}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(activeDays.reduce((s, c) => s + c.tokenBreakdown.output, 0))}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtNum(totalMsgs)}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(totalCost)}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(activeDays.reduce((s, c) => s + c.tokenBreakdown.cacheRead, 0))}</td>
            </tr>
          </tfoot>
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
