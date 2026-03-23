import { useMemo, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import type { Contribution } from '../types'
import { format, parseISO, startOfWeek, addDays, differenceInWeeks } from 'date-fns'

const CELL_SIZE = 13
const CELL_GAP = 3
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LEVELS_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
const LEVELS_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

interface Props {
  contributions: Contribution[]
}

export function ContributionHeatmap({ contributions }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: Contribution } | null>(null)
  const { isDark } = useTheme()
  const LEVELS = isDark ? LEVELS_DARK : LEVELS_LIGHT

  const { grid, weeks, monthLabels } = useMemo(() => {
    if (!contributions.length) return { grid: [], weeks: 0, monthLabels: [] }

    const costMap = new Map(contributions.map(c => [c.date, c]))
    const startDate = parseISO(contributions[0].date)
    const endDate = parseISO(contributions[contributions.length - 1].date)
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 })
    const totalWeeks = differenceInWeeks(endDate, weekStart) + 2

    const grid: (Contribution | null)[][] = []
    const monthLabels: { label: string; week: number }[] = []
    let lastMonth = -1

    for (let w = 0; w < totalWeeks; w++) {
      const week: (Contribution | null)[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, w * 7 + d)
        const key = format(date, 'yyyy-MM-dd')
        const contrib = costMap.get(key) ?? null

        if (date.getMonth() !== lastMonth && w > 0) {
          monthLabels.push({ label: MONTHS[date.getMonth()], week: w })
          lastMonth = date.getMonth()
        }
        if (w === 0 && d === 0) lastMonth = date.getMonth()

        week.push(contrib)
      }
      grid.push(week)
    }

    return { grid, weeks: totalWeeks, monthLabels }
  }, [contributions])

  if (!contributions.length) return null

  const maxCost = Math.max(...contributions.map(c => c.totals.cost))

  function getLevel(cost: number): number {
    if (cost === 0) return 0
    const ratio = cost / maxCost
    if (ratio < 0.15) return 1
    if (ratio < 0.35) return 2
    if (ratio < 0.6) return 3
    return 4
  }

  const svgWidth = weeks * (CELL_SIZE + CELL_GAP) + 40
  const svgHeight = 7 * (CELL_SIZE + CELL_GAP) + 30

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Daily Activity</h3>
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight}>
          {monthLabels.map(({ label, week }, i) => (
            <text
              key={i}
              x={week * (CELL_SIZE + CELL_GAP) + 30}
              y={10}
              fontSize={10}
              fill={isDark ? '#94a3b8' : '#64748b'}
            >
              {label}
            </text>
          ))}

          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, i) => (
            <text
              key={i}
              x={0}
              y={20 + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
              fontSize={9}
              fill={isDark ? '#64748b' : '#94a3b8'}
            >
              {day}
            </text>
          ))}

          {grid.map((week, w) =>
            week.map((contrib, d) => {
              const cost = contrib?.totals.cost ?? 0
              const level = getLevel(cost)
              return (
                <rect
                  key={`${w}-${d}`}
                  x={w * (CELL_SIZE + CELL_GAP) + 30}
                  y={d * (CELL_SIZE + CELL_GAP) + 18}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={LEVELS[level]}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={e => {
                    if (contrib) {
                      const rect = (e.target as SVGRectElement).getBoundingClientRect()
                      setTooltip({ x: rect.left, y: rect.top - 60, data: contrib })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          )}
        </svg>

        <div className={`flex items-center gap-2 mt-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>Less</span>
          {LEVELS.map((color, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ background: color }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 glass rounded-lg px-3 py-2 text-xs pointer-events-none shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {format(parseISO(tooltip.data.date), 'MMM d, yyyy')}
          </div>
          <div className={`font-bold ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>${tooltip.data.totals.cost.toFixed(2)}</div>
          <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>{tooltip.data.totals.messages} messages</div>
        </div>
      )}
    </div>
  )
}
