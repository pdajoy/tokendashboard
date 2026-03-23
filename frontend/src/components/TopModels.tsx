import { useTheme } from '../hooks/useTheme'
import type { ModelEntry } from '../types'

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

interface Props {
  entries: ModelEntry[]
}

const RANK_COLORS = [
  'from-amber-500 to-yellow-600',
  'from-slate-300 to-slate-400',
  'from-amber-700 to-amber-800',
]

export function TopModels({ entries }: Props) {
  const { isDark } = useTheme()
  const top = [...entries]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)

  const maxCost = top[0]?.cost ?? 1

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Models by Cost</h3>
      <div className="space-y-3">
        {top.map((entry, i) => {
          const pct = (entry.cost / maxCost) * 100
          return (
            <div key={`${entry.client}-${entry.model}-${i}`} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {i < 3 ? (
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br ${RANK_COLORS[i]} text-white`}>
                      {i + 1}
                    </span>
                  ) : (
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {i + 1}
                    </span>
                  )}
                  <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{entry.model}</span>
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{entry.provider}</span>
                </div>
                <div className="text-right">
                  <span className={`font-semibold text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{formatCost(entry.cost)}</span>
                  <span className={`text-xs ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatNumber(entry.messageCount)} msgs</span>
                </div>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
