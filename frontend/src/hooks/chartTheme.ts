import type { CSSProperties } from 'react'

export interface ChartTheme {
  tooltip: CSSProperties
  grid: string
  axis: string
  tick: string
  tickAccent: string
  tickGreen: string
  labelFill: string
  labelAccentFill: string
  pieLabelStroke: string
}

export function chartTheme(isDark: boolean): ChartTheme {
  return {
    tooltip: {
      background: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '8px',
      color: isDark ? '#f1f5f9' : '#1e293b',
    },
    grid: isDark ? '#1e293b' : '#e2e8f0',
    axis: isDark ? '#334155' : '#cbd5e1',
    tick: isDark ? '#94a3b8' : '#64748b',
    tickAccent: isDark ? '#fbbf24' : '#d97706',
    tickGreen: isDark ? '#34d399' : '#059669',
    labelFill: isDark ? '#e2e8f0' : '#334155',
    labelAccentFill: isDark ? '#fbbf24' : '#d97706',
    pieLabelStroke: isDark ? '#475569' : '#94a3b8',
  }
}
