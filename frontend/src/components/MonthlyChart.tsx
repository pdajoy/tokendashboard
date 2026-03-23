import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Area,
} from 'recharts'
import { format, parse } from 'date-fns'
import { useTheme, chartTheme } from '../hooks/useTheme'
import type { MonthlyData } from '../types'

interface Props {
  monthly: MonthlyData | null
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

function formatTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

export function MonthlyChart({ monthly }: Props) {
  const { isDark } = useTheme()
  const ct = chartTheme(isDark)

  if (!monthly?.entries?.length) return null

  const data = monthly.entries.map(e => {
    const d = parse(e.month, 'yyyy-MM', new Date())
    return {
      month: format(d, 'MMM yy'),
      cost: e.cost,
      messages: e.messageCount,
      tokens: e.input + e.output + e.cacheRead + e.cacheWrite,
      input: e.input,
      output: e.output,
      cacheRead: e.cacheRead,
    }
  })

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Monthly Cost Trend</h3>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="month" tick={{ fill: ct.tick, fontSize: 12 }} axisLine={{ stroke: ct.axis }} />
            <YAxis
              yAxisId="cost"
              tick={{ fill: ct.tick, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={formatCost}
            />
            <YAxis
              yAxisId="msgs"
              orientation="right"
              tick={{ fill: ct.tick, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={(v: number) => String(v)}
            />
            <Tooltip
              contentStyle={ct.tooltip}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const v = Number(value ?? 0)
                if (name === 'cost') return [formatCost(v), 'Cost']
                if (name === 'messages') return [v, 'Messages']
                return [formatTokens(v), name]
              }) as any}
            />
            <Area yAxisId="cost" type="monotone" dataKey="cost" fill="url(#costGrad)" stroke="#38bdf8" strokeWidth={2} />
            <Line yAxisId="msgs" type="monotone" dataKey="messages" stroke="#818cf8" strokeWidth={2} dot={{ fill: '#818cf8', r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
