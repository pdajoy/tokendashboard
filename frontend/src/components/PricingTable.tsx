import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ArrowUpDown, AlertCircle, ExternalLink } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { ModelEntry, PricingData } from '../types'

interface Props {
  entries: ModelEntry[]
  pricing: PricingData | null
}

type SortKey = 'model' | 'provider' | 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'actualCost' | 'estCost' | 'ratio'
type SortDir = 'asc' | 'desc'

function fmtCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  if (n >= 1) return '$' + n.toFixed(2)
  if (n >= 0.01) return '$' + n.toFixed(3)
  return '$' + n.toFixed(4)
}

function fmtTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

export function PricingTable({ entries, pricing }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('estCost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { isDark } = useTheme()

  const rows = useMemo(() => {
    const byModel = new Map<string, {
      model: string; provider: string
      input: number; output: number; cacheRead: number; cacheWrite: number
      actualCost: number; messages: number
    }>()

    for (const e of entries) {
      const key = e.model
      let row = byModel.get(key)
      if (!row) {
        row = { model: e.model, provider: e.provider, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, actualCost: 0, messages: 0 }
        byModel.set(key, row)
      }
      row.input += e.input
      row.output += e.output
      row.cacheRead += e.cacheRead
      row.cacheWrite += e.cacheWrite
      row.actualCost += e.cost
      row.messages += e.messageCount
    }

    return [...byModel.values()].map(row => {
      const p = pricing?.models[row.model]
      const estCost = p
        ? (row.input * p.inputPer1M / 1e6) +
          (row.output * p.outputPer1M / 1e6) +
          (row.cacheRead * (p.cacheReadPer1M ?? 0) / 1e6) +
          (row.cacheWrite * (p.cacheWritePer1M ?? 0) / 1e6)
        : null
      const ratio = estCost != null && estCost > 0 ? row.actualCost / estCost : null

      return {
        ...row,
        pricing: p ?? null,
        estCost,
        ratio,
      }
    })
  }, [entries, pricing])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'model': cmp = a.model.localeCompare(b.model); break
        case 'provider': cmp = a.provider.localeCompare(b.provider); break
        case 'input': cmp = (a.pricing?.inputPer1M ?? 0) - (b.pricing?.inputPer1M ?? 0); break
        case 'output': cmp = (a.pricing?.outputPer1M ?? 0) - (b.pricing?.outputPer1M ?? 0); break
        case 'cacheRead': cmp = (a.pricing?.cacheReadPer1M ?? 0) - (b.pricing?.cacheReadPer1M ?? 0); break
        case 'cacheWrite': cmp = (a.pricing?.cacheWritePer1M ?? 0) - (b.pricing?.cacheWritePer1M ?? 0); break
        case 'actualCost': cmp = a.actualCost - b.actualCost; break
        case 'estCost': cmp = (a.estCost ?? 0) - (b.estCost ?? 0); break
        case 'ratio': cmp = (a.ratio ?? 0) - (b.ratio ?? 0); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [rows, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const totalActual = rows.reduce((s, r) => s + r.actualCost, 0)
  const totalEst = rows.reduce((s, r) => s + (r.estCost ?? 0), 0)
  const hasEstimates = rows.some(r => r.estCost != null)
  const modelsWithPricing = rows.filter(r => r.pricing != null).length
  const modelsWithout = rows.filter(r => r.pricing == null).length

  const thClass = `px-3 py-3 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap ${
    isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
  }`
  const tdClass = `px-3 py-2.5 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`
  const tdNum = `px-3 py-2.5 text-sm text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`glass rounded-xl p-4 ${isDark ? '' : ''}`}>
          <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Platform Cost</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{fmtCost(totalActual)}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Actual billed by Cursor</div>
        </div>
        <div className={`glass rounded-xl p-4`}>
          <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Est. API Cost</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{hasEstimates ? fmtCost(totalEst) : 'N/A'}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Based on public API pricing</div>
        </div>
        <div className={`glass rounded-xl p-4`}>
          <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cost Ratio</div>
          <div className={`text-2xl font-bold ${
            totalEst > 0
              ? totalActual / totalEst < 1
                ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                : isDark ? 'text-amber-400' : 'text-amber-600'
              : isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {totalEst > 0 ? (totalActual / totalEst).toFixed(2) + 'x' : 'N/A'}
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {totalEst > 0 && totalActual < totalEst ? 'Saving vs direct API' : 'Platform vs API'}
          </div>
        </div>
        <div className={`glass rounded-xl p-4`}>
          <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Coverage</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{modelsWithPricing}/{modelsWithPricing + modelsWithout}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Models with pricing data</div>
        </div>
      </div>

      {/* Info banner */}
      {pricing && (
        <div className={`flex items-start gap-3 rounded-xl p-4 ${
          isDark ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-sky-50 border border-sky-200'
        }`}>
          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
          <div className={`text-xs leading-relaxed ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
            <p className="font-medium mb-1">Pricing from {pricing.source}</p>
            <p className={isDark ? 'text-sky-400/70' : 'text-sky-600/80'}>
              {pricing.note}
              {pricing.errors.length > 0 && (
                <> · Missing: {pricing.errors.join(', ')}</>
              )}
            </p>
          </div>
        </div>
      )}

      {!pricing && (
        <div className={`flex items-center gap-3 rounded-xl p-4 ${
          isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
        }`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            Pricing data not available. Run the pricing script to generate <code className="px-1 py-0.5 rounded bg-black/10">data/pricing.json</code>.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'bg-slate-800/50 border-b border-slate-700/50' : 'bg-slate-50 border-b border-slate-200'}>
                <th className={thClass} onClick={() => handleSort('model')}>
                  <span className="flex items-center gap-1">Model <SortIcon col="model" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('provider')}>
                  <span className="flex items-center gap-1">Provider <SortIcon col="provider" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('input')}>
                  <span className="flex items-center gap-1 justify-end">Input/1M <SortIcon col="input" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('output')}>
                  <span className="flex items-center gap-1 justify-end">Output/1M <SortIcon col="output" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('cacheRead')}>
                  <span className="flex items-center gap-1 justify-end">Cache R/1M <SortIcon col="cacheRead" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('cacheWrite')}>
                  <span className="flex items-center gap-1 justify-end">Cache W/1M <SortIcon col="cacheWrite" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('actualCost')}>
                  <span className="flex items-center gap-1 justify-end">Actual <SortIcon col="actualCost" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('estCost')}>
                  <span className="flex items-center gap-1 justify-end">Est. API <SortIcon col="estCost" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('ratio')}>
                  <span className="flex items-center gap-1 justify-end">Ratio <SortIcon col="ratio" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.model} className={`border-b transition ${
                  isDark ? 'border-slate-800/30 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'
                }`}>
                  <td className={`${tdClass} font-medium max-w-[220px] truncate`}>
                    <span className={isDark ? 'text-white' : 'text-slate-900'}>{row.model}</span>
                    {row.pricing && (
                      <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        → {row.pricing.matchedKey}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>{row.provider}</span>
                  </td>
                  <td className={tdNum}>
                    {row.pricing ? <span className={isDark ? 'text-sky-400' : 'text-sky-600'}>${row.pricing.inputPer1M.toFixed(2)}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                  <td className={tdNum}>
                    {row.pricing ? <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>${row.pricing.outputPer1M.toFixed(2)}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                  <td className={tdNum}>
                    {row.pricing?.cacheReadPer1M != null ? <span className={isDark ? 'text-violet-400' : 'text-violet-600'}>${row.pricing.cacheReadPer1M.toFixed(2)}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                  <td className={tdNum}>
                    {row.pricing?.cacheWritePer1M != null ? <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>${row.pricing.cacheWritePer1M.toFixed(2)}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                  <td className={tdNum}>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtCost(row.actualCost)}</span>
                    <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtTokens(row.input + row.output + row.cacheRead + row.cacheWrite)} tok</span>
                  </td>
                  <td className={tdNum}>
                    {row.estCost != null
                      ? <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>{fmtCost(row.estCost)}</span>
                      : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
                    }
                  </td>
                  <td className={tdNum}>
                    {row.ratio != null ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        row.ratio < 0.8
                          ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                          : row.ratio < 1.2
                            ? isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
                            : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {row.ratio.toFixed(2)}x
                      </span>
                    ) : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={isDark ? 'bg-slate-800/50 border-t border-slate-700/50' : 'bg-slate-50 border-t border-slate-200'}>
                <td className={`${tdClass} font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} colSpan={2}>
                  Total ({sorted.length} models)
                </td>
                <td colSpan={4} />
                <td className={`${tdNum} font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtCost(totalActual)}</td>
                <td className={`${tdNum} font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{hasEstimates ? fmtCost(totalEst) : '—'}</td>
                <td className={tdNum}>
                  {totalEst > 0 && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      totalActual / totalEst < 1
                        ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                        : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {(totalActual / totalEst).toFixed(2)}x
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className={`text-xs flex flex-wrap gap-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <span>Ratio = Platform Cost / Est. API Cost</span>
        <span>&lt;1.0x = platform cheaper than direct API</span>
        <span>&gt;1.0x = platform more expensive</span>
        <span>
          <a href="https://github.com/junhoyeo/tokscale" target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 ${isDark ? 'text-slate-400 hover:text-sky-400' : 'text-slate-500 hover:text-sky-600'}`}
          >
            Data from tokscale CLI <ExternalLink className="w-3 h-3" />
          </a>
        </span>
      </div>
    </div>
  )
}
