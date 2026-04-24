import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from '../hooks/useTheme'
import { chartTheme } from '../hooks/chartTheme'
import type { ModelEntry } from '../types'

const COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171',
  '#a78bfa', '#fb923c', '#2dd4bf', '#e879f9', '#f472b6',
]

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

interface Props {
  entries: ModelEntry[]
  groupBy: 'provider' | 'source'
  title: string
}

export function ProviderChart({ entries, groupBy, title }: Props) {
  const { isDark } = useTheme()
  const ct = chartTheme(isDark)

  if (!entries.length) return null

  const grouped = entries.reduce<Record<string, number>>((acc, e) => {
    const key = groupBy === 'provider' ? e.provider : e.client
    acc[key] = (acc[key] ?? 0) + e.cost
    return acc
  }, {})

  const data = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(1)}%)`}
              labelLine={{ stroke: ct.pieLabelStroke }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={ct.tooltip}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any) => formatCost(Number(value ?? 0))) as any}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
