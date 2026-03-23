import { DollarSign, MessageSquare, Zap, Calendar, TrendingUp, Activity } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { ModelsData, GraphData } from '../types'

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function formatCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

interface CardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}

function Card({ icon, label, value, sub, color }: CardProps) {
  const { isDark } = useTheme()
  return (
    <div className={`glass rounded-xl p-5 animate-fade-in transition-all ${isDark ? 'hover:border-slate-600' : 'hover:border-slate-300'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</div>}
    </div>
  )
}

interface Props {
  models: ModelsData | null
  graph: GraphData | null
}

export function SummaryCards({ models, graph }: Props) {
  const totalCost = models?.totalCost ?? 0
  const totalMessages = models?.totalMessages ?? 0
  const totalTokens = (models?.totalInput ?? 0) + (models?.totalOutput ?? 0) +
    (models?.totalCacheRead ?? 0) + (models?.totalCacheWrite ?? 0)
  const activeDays = graph?.summary?.activeDays ?? 0
  const avgPerDay = graph?.summary?.averagePerDay ?? 0
  const maxDay = graph?.summary?.maxCostInSingleDay ?? 0
  const uniqueModels = models ? new Set(models.entries.map(e => e.model)).size : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card
        icon={<DollarSign className="w-5 h-5" />}
        label="Total Cost"
        value={formatCost(totalCost)}
        sub={`Avg ${formatCost(avgPerDay)}/day`}
        color="bg-sky-500/20 text-sky-400"
      />
      <Card
        icon={<Zap className="w-5 h-5" />}
        label="Total Tokens"
        value={formatNumber(totalTokens)}
        sub={`${formatNumber(models?.totalInput ?? 0)} in / ${formatNumber(models?.totalOutput ?? 0)} out`}
        color="bg-violet-500/20 text-violet-400"
      />
      <Card
        icon={<MessageSquare className="w-5 h-5" />}
        label="Messages"
        value={formatNumber(totalMessages)}
        sub={`${uniqueModels} models used`}
        color="bg-emerald-500/20 text-emerald-400"
      />
      <Card
        icon={<Calendar className="w-5 h-5" />}
        label="Active Days"
        value={String(activeDays)}
        sub={`of ${graph?.summary?.totalDays ?? 0} total`}
        color="bg-amber-500/20 text-amber-400"
      />
      <Card
        icon={<TrendingUp className="w-5 h-5" />}
        label="Peak Day"
        value={formatCost(maxDay)}
        sub="Highest single day"
        color="bg-rose-500/20 text-rose-400"
      />
      <Card
        icon={<Activity className="w-5 h-5" />}
        label="Cache Tokens"
        value={formatNumber(models?.totalCacheRead ?? 0)}
        sub={`${formatNumber(models?.totalCacheWrite ?? 0)} written`}
        color="bg-teal-500/20 text-teal-400"
      />
    </div>
  )
}
