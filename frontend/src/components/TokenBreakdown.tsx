import { useMemo, useState } from 'react'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
  LabelList,
} from 'recharts'
import type { MonthlyData } from '../types'
import { format, parse } from 'date-fns'
import { BarChart3, Layers } from 'lucide-react'
import { useTheme, chartTheme } from '../hooks/useTheme'

function formatTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

type ChartMode = 'stacked' | 'grouped'

interface Props {
  monthly: MonthlyData | null
}

export function TokenBreakdown({ monthly }: Props) {
  const [mode, setMode] = useState<ChartMode>('stacked')
  const { isDark } = useTheme()
  const ct = chartTheme(isDark)

  if (!monthly?.entries?.length) return null

  const data = useMemo(() => monthly.entries.map(e => {
    const d = parse(e.month, 'yyyy-MM', new Date())
    const totalTokens = e.input + e.output + e.cacheRead + e.cacheWrite
    return {
      month: format(d, 'MMM yy'),
      input: e.input,
      output: e.output,
      cacheRead: e.cacheRead,
      cacheWrite: e.cacheWrite,
      totalTokens,
      cost: e.cost,
    }
  }), [monthly])

  const grandTotalTokens = data.reduce((s, d) => s + d.totalTokens, 0)
  const grandTotalCost = data.reduce((s, d) => s + d.cost, 0)
  const grandInput = data.reduce((s, d) => s + d.input, 0)
  const grandOutput = data.reduce((s, d) => s + d.output, 0)
  const grandCacheRead = data.reduce((s, d) => s + d.cacheRead, 0)

  const stackId = mode === 'stacked' ? 'a' : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderTopLabel(props: any) {
    const { x, y, width, index } = props
    if (!data || !data[index]) return null
    const d = data[index]
    const tokenText = formatTokens(d.totalTokens)
    const costText = formatCost(d.cost)
    return (
      <g>
        <text x={x + width / 2} y={y - 18} fill={ct.labelFill} textAnchor="middle" fontSize={10} fontWeight={600}>
          {tokenText}
        </text>
        <text x={x + width / 2} y={y - 6} fill={ct.labelAccentFill} textAnchor="middle" fontSize={9}>
          {costText}
        </text>
      </g>
    )
  }

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Token Breakdown by Month</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Total: <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatTokens(grandTotalTokens)}</span> tokens
            &middot; <span className={`font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{formatCost(grandTotalCost)}</span> cost
          </p>
        </div>
        <div className={`flex items-center gap-1 rounded-lg p-0.5 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`}>
          <button
            onClick={() => setMode('stacked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'stacked'
              ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Stacked"
          >
            <Layers className="w-3.5 h-3.5" />
            Stacked
          </button>
          <button
            onClick={() => setMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'grouped'
              ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Grouped"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Grouped
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Tokens', value: formatTokens(grandTotalTokens), color: isDark ? 'text-white' : 'text-slate-900' },
          { label: 'Input', value: formatTokens(grandInput), color: isDark ? 'text-sky-400' : 'text-sky-600' },
          { label: 'Output', value: formatTokens(grandOutput), color: isDark ? 'text-violet-400' : 'text-violet-600' },
          { label: 'Cache Read', value: formatTokens(grandCacheRead), color: isDark ? 'text-emerald-400' : 'text-emerald-600' },
          { label: 'Total Cost', value: formatCost(grandTotalCost), color: isDark ? 'text-amber-400' : 'text-amber-600' },
        ].map(item => (
          <div key={item.label} className={`rounded-lg px-3 py-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</div>
            <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 30, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="month" tick={{ fill: ct.tick, fontSize: 12 }} axisLine={{ stroke: ct.axis }} />
            <YAxis
              yAxisId="tokens"
              tick={{ fill: ct.tick, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={formatTokens}
            />
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={{ fill: ct.tickAccent, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={formatCost}
            />
            <Tooltip
              contentStyle={ct.tooltip}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const v = Number(value ?? 0)
                if (name === 'Cost') return [formatCost(v), name]
                if (name === 'Total Tokens') return [formatTokens(v), name]
                return [formatTokens(v), name ?? '']
              }) as any}
            />
            <Legend wrapperStyle={{ color: ct.tick, fontSize: 12 }} />

            <Bar yAxisId="tokens" dataKey="input" name="Input" stackId={stackId} fill="#38bdf8" />
            <Bar yAxisId="tokens" dataKey="output" name="Output" stackId={stackId} fill="#818cf8" />
            <Bar yAxisId="tokens" dataKey="cacheRead" name="Cache Read" stackId={stackId} fill="#34d399" />
            <Bar yAxisId="tokens" dataKey="cacheWrite" name="Cache Write" stackId={stackId} fill="#fbbf24" radius={[4, 4, 0, 0]}>
              {mode === 'stacked' && (
                <LabelList
                  dataKey="cacheWrite"
                  position="top"
                  content={(props) => renderTopLabel({ ...props })}
                />
              )}
            </Bar>

            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="cost"
              name="Cost"
              stroke="#f87171"
              strokeWidth={2.5}
              dot={{ fill: '#f87171', r: 3 }}
            />
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="totalTokens"
              name="Total Tokens"
              stroke={ct.labelFill}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
