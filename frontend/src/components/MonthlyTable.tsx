import { Fragment, useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react'
import { format, parse } from 'date-fns'
import { useTheme } from '../hooks/useTheme'
import type { Contribution, MonthlyData } from '../types'

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

type SortKey = 'month' | 'tokens' | 'cost' | 'messageCount' | 'input' | 'output' | 'cacheRead'

interface Row {
  month: string
  monthLabel: string
  tokens: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  messageCount: number
  cost: number
  modelCount: number
}

interface ModelBreakdown {
  client: string
  modelId: string
  providerId: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  messages: number
  cost: number
}

interface Props {
  monthly: MonthlyData | null
  contributions?: Contribution[]
}

function buildBreakdown(contributions: Contribution[], month: string): ModelBreakdown[] {
  const byKey = new Map<string, ModelBreakdown>()
  for (const c of contributions) {
    if (!c.date?.startsWith(month)) continue
    for (const client of c.clients) {
      const key = `${client.client}\u0000${client.modelId}\u0000${client.providerId}`
      const existing = byKey.get(key)
      if (existing) {
        existing.input += client.tokens.input
        existing.output += client.tokens.output
        existing.cacheRead += client.tokens.cacheRead
        existing.cacheWrite += client.tokens.cacheWrite
        existing.reasoning += client.tokens.reasoning
        existing.messages += client.messages
        existing.cost += client.cost
      } else {
        byKey.set(key, {
          client: client.client,
          modelId: client.modelId,
          providerId: client.providerId,
          input: client.tokens.input,
          output: client.tokens.output,
          cacheRead: client.tokens.cacheRead,
          cacheWrite: client.tokens.cacheWrite,
          reasoning: client.tokens.reasoning,
          messages: client.messages,
          cost: client.cost,
        })
      }
    }
  }
  return [...byKey.values()]
    .filter(row => row.cost > 0 || row.messages > 0)
    .sort((a, b) => b.cost - a.cost)
}

export function MonthlyTable({ monthly, contributions = [] }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('month')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const { isDark } = useTheme()

  const rows = useMemo((): Row[] => {
    if (!monthly?.entries) return []
    return monthly.entries.map(e => {
      const d = parse(e.month, 'yyyy-MM', new Date())
      return {
        month: e.month,
        monthLabel: format(d, 'yyyy-MM (MMM)'),
        tokens: e.input + e.output + e.cacheRead + e.cacheWrite,
        input: e.input,
        output: e.output,
        cacheRead: e.cacheRead,
        cacheWrite: e.cacheWrite,
        messageCount: e.messageCount,
        cost: e.cost,
        modelCount: e.models.length,
      }
    })
  }, [monthly])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp: number
      if (sortKey === 'month') cmp = a.month.localeCompare(b.month)
      else cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
    return sortDir === 'asc'
      ? <ArrowUp className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
      : <ArrowDown className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
  }

  if (!rows.length) return null

  const totalTokens = rows.reduce((s, r) => s + r.tokens, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalMsgs = rows.reduce((s, r) => s + r.messageCount, 0)

  const cols: [SortKey, string][] = [
    ['month', 'Month'],
    ['tokens', 'Total Tokens'],
    ['input', 'Input'],
    ['output', 'Output'],
    ['cacheRead', 'Cache Read'],
    ['messageCount', 'Messages'],
    ['cost', 'Cost'],
  ]

  const canExpand = contributions.length > 0

  return (
    <div className="glass rounded-xl animate-fade-in overflow-hidden">
      <div className={`p-5 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Monthly Summary</h3>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {rows.length} months &middot; {fmtNum(totalTokens)} tokens &middot; {fmtCost(totalCost)} total &middot; {fmtNum(totalMsgs)} messages
          {canExpand && <> &middot; Click a row to see model breakdown</>}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-200'}>
              {canExpand && <th className="w-6" />}
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
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Models</th>
            </tr>
          </thead>
          <tbody className={isDark ? 'divide-y divide-slate-700/30' : 'divide-y divide-slate-200'}>
            {sorted.map(r => {
              const isExpanded = expandedMonth === r.month
              const breakdown = canExpand && isExpanded ? buildBreakdown(contributions, r.month) : []
              return (
                <Fragment key={r.month}>
                  <tr
                    className={`transition-colors ${
                      canExpand ? 'cursor-pointer' : ''
                    } ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/50'}`}
                    onClick={() => canExpand && setExpandedMonth(isExpanded ? null : r.month)}
                  >
                    {canExpand && (
                      <td className={`pl-3 py-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {r.modelCount > 0 && (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                    )}
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.monthLabel}</td>
                    <td className={`px-4 py-3 tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(r.tokens)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(r.input)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(r.output)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(r.cacheRead)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(r.messageCount)}</td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(r.cost)}</td>
                    <td className={`px-4 py-3 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.modelCount}</td>
                  </tr>
                  {canExpand && isExpanded && breakdown.length > 0 && (
                    <tr>
                      <td colSpan={cols.length + 2} className="px-0 py-0">
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
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cache Write</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Messages</th>
                                <th className={`px-4 py-2 text-right font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cost</th>
                              </tr>
                            </thead>
                            <tbody className={isDark ? 'divide-y divide-slate-700/20' : 'divide-y divide-slate-200/50'}>
                              {breakdown.map((row, i) => (
                                <tr key={i} className={isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-100'}>
                                  <td className={`px-6 py-1.5 capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.client}</td>
                                  <td className={`px-4 py-1.5 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.modelId}</td>
                                  <td className={`px-4 py-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{row.providerId}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(row.input)}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(row.output)}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(row.cacheRead)}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtNum(row.cacheWrite)}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.messages}</td>
                                  <td className={`px-4 py-1.5 text-right tabular-nums font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(row.cost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={isDark ? 'border-t-2 border-slate-600 bg-slate-800/30' : 'border-t-2 border-slate-300 bg-slate-100/50'}>
              {canExpand && <td />}
              <td className={`px-4 py-3 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtNum(totalTokens)}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(rows.reduce((s, r) => s + r.input, 0))}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(rows.reduce((s, r) => s + r.output, 0))}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(rows.reduce((s, r) => s + r.cacheRead, 0))}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtNum(totalMsgs)}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(totalCost)}</td>
              <td className={`px-4 py-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>&mdash;</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
