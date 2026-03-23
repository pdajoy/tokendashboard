import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, Line, ComposedChart, Legend,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { useTheme, chartTheme } from '../hooks/useTheme'
import type { Contribution } from '../types'

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

function formatTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

interface Props {
  contributions: Contribution[]
  days?: number
}

export function DailyChart({ contributions, days = 60 }: Props) {
  const { isDark } = useTheme()
  const ct = chartTheme(isDark)

  if (!contributions.length) return null

  const cutoff = subDays(new Date(), days)
  const recent = contributions.filter(c => parseISO(c.date) >= cutoff)

  const data = recent.map(c => ({
    date: format(parseISO(c.date), 'MMM d'),
    cost: c.totals.cost,
    tokens: c.totals.tokens,
    messages: c.totals.messages,
  }))

  const totalCost = recent.reduce((s, c) => s + c.totals.cost, 0)
  const totalTokens = recent.reduce((s, c) => s + c.totals.tokens, 0)

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Daily Cost & Tokens (Last {days} Days)</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Period total: <span className={`font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{formatCost(totalCost)}</span> cost
            &middot; <span className={`font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatTokens(totalTokens)}</span> tokens
          </p>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="dailyCostGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis
              dataKey="date"
              tick={{ fill: ct.tick, fontSize: 10 }}
              axisLine={{ stroke: ct.axis }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              yAxisId="cost"
              tick={{ fill: ct.tick, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={formatCost}
            />
            <YAxis
              yAxisId="tokens"
              orientation="right"
              tick={{ fill: ct.tickGreen, fontSize: 12 }}
              axisLine={{ stroke: ct.axis }}
              tickFormatter={formatTokens}
            />
            <Tooltip
              contentStyle={ct.tooltip}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const v = Number(value ?? 0)
                if (name === 'Cost') return [formatCost(v), name]
                if (name === 'Total Tokens') return [formatTokens(v), name]
                return [v, name ?? '']
              }) as any}
            />
            <Legend wrapperStyle={{ color: ct.tick, fontSize: 12 }} />
            <Area
              yAxisId="cost"
              type="monotone"
              dataKey="cost"
              name="Cost"
              stroke="#818cf8"
              fill="url(#dailyCostGrad)"
              strokeWidth={2}
            />
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="tokens"
              name="Total Tokens"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
