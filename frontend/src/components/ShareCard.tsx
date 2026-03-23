import { useRef, useState, useMemo } from 'react'
import { toPng } from 'html-to-image'
import { Download, Loader2, LayoutGrid, BarChart3, Activity, Trophy, CalendarDays, PieChart, Layers, Flame, BadgeCheck } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { ModelEntry, Contribution } from '../types'

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

const HEATMAP_LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353', '#52d366']
const MONTH_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#f5572f']
const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32', '#818cf8', '#34d399', '#f87171', '#f5572f']
const TOP_COUNT = 6

type CardType = 'overview' | 'compact' | 'models' | 'activity' | 'monthly' | 'providers' | 'tokens' | 'streak' | 'badge'

const CARD_TYPES: { id: CardType; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', desc: 'Full stats + rankings + heatmap', icon: <LayoutGrid className="w-5 h-5" /> },
  { id: 'compact', label: 'Compact', desc: 'Key stats summary', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'models', label: 'Top Models', desc: 'Model cost ranking', icon: <Trophy className="w-5 h-5" /> },
  { id: 'activity', label: 'Activity', desc: 'Heatmap + daily stats', icon: <Activity className="w-5 h-5" /> },
  { id: 'monthly', label: 'Monthly', desc: 'Monthly cost bars', icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'providers', label: 'Providers', desc: 'Cost by provider', icon: <PieChart className="w-5 h-5" /> },
  { id: 'tokens', label: 'Tokens', desc: 'Token type breakdown', icon: <Layers className="w-5 h-5" /> },
  { id: 'streak', label: 'Streak', desc: 'Daily coding streaks', icon: <Flame className="w-5 h-5" /> },
  { id: 'badge', label: 'Badge', desc: 'Social profile badge', icon: <BadgeCheck className="w-5 h-5" /> },
]

interface Props {
  entries: ModelEntry[]
  contributions: Contribution[]
}

// Shared card styles
const cardBase: React.CSSProperties = {
  padding: 32,
  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
  borderRadius: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#f1f5f9',
}

const headerStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 700,
  background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
}

const footerStyle: React.CSSProperties = {
  marginTop: 20, paddingTop: 16,
  borderTop: '1px solid rgba(148,163,184,0.1)',
  display: 'flex', justifyContent: 'space-between',
  fontSize: 11, color: '#475569',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#94a3b8',
  marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1,
}

const statBox: React.CSSProperties = {
  background: 'rgba(30,41,59,0.6)', borderRadius: 10,
  padding: '12px 14px', border: '1px solid rgba(148,163,184,0.1)',
}

function ProgressBar({ pct, gradient }: { pct: number; gradient: string }) {
  return (
    <div style={{ height: 3, background: '#1e293b', borderRadius: 2 }}>
      <div style={{ height: 3, borderRadius: 2, width: `${pct}%`, background: gradient }} />
    </div>
  )
}

// Card: Overview (full)
function OverviewCard({ entries, contributions }: Props) {
  const topModels = [...entries].sort((a, b) => b.cost - a.cost).slice(0, TOP_COUNT)
  const recentContribs = contributions.slice(-91)

  const byMonth = new Map<string, { cost: number; tokens: number; messages: number }>()
  for (const c of contributions) {
    const month = c.date.substring(0, 7)
    let e = byMonth.get(month)
    if (!e) { e = { cost: 0, tokens: 0, messages: 0 }; byMonth.set(month, e) }
    e.cost += c.totals.cost; e.tokens += c.totals.tokens; e.messages += c.totals.messages
  }
  const topMonths = [...byMonth.entries()].map(([m, d]) => ({ month: m, ...d })).sort((a, b) => b.cost - a.cost).slice(0, TOP_COUNT)

  const totalCost = entries.reduce((s, e) => s + e.cost, 0)
  const totalMessages = entries.reduce((s, e) => s + e.messageCount, 0)
  const totalTokens = entries.reduce((s, e) => s + e.input + e.output + e.cacheRead + e.cacheWrite, 0)
  const activeDays = contributions.filter(c => c.totals.cost > 0 || c.totals.messages > 0).length
  const uniqueModels = [...new Set(entries.map(e => e.model))].length
  const uniqueProviders = [...new Set(entries.map(e => e.provider))].length
  const maxCost = recentContribs.length > 0 ? Math.max(...recentContribs.map(c => c.totals.cost)) : 1
  const dateRange = contributions.length > 0 ? { start: contributions[0]?.date, end: contributions[contributions.length - 1]?.date } : null

  function getLevel(cost: number): number {
    if (cost === 0) return 0
    const ratio = cost / maxCost
    if (ratio < 0.15) return 1
    if (ratio < 0.35) return 2
    if (ratio < 0.6) return 3
    return 4
  }

  return (
    <div style={{ ...cardBase, width: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={headerStyle}>Tokscale Stats</div>
        {dateRange && <div style={{ fontSize: 12, color: '#64748b' }}>{dateRange.start} ~ {dateRange.end}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Cost', value: fmtCost(totalCost), color: '#38bdf8' },
          { label: 'Total Tokens', value: fmtNum(totalTokens), color: '#818cf8' },
          { label: 'Messages', value: fmtNum(totalMessages), color: '#34d399' },
          { label: 'Active Days', value: String(activeDays), color: '#fbbf24' },
          { label: 'Models Used', value: String(uniqueModels), color: '#f87171' },
          { label: 'Providers', value: String(uniqueProviders), color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={statBox}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={sectionTitle}>Top Models</div>
          {topModels.map((m, i) => {
            const pct = (m.cost / (topModels[0]?.cost || 1)) * 100
            return (
              <div key={`${m.model}-${i}`} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: 8, background: RANK_COLORS[i], alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0f172a' }}>{i + 1}</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: 11 }}>{fmtCost(m.cost)}</span>
                </div>
                <ProgressBar pct={pct} gradient="linear-gradient(90deg, #38bdf8, #818cf8)" />
              </div>
            )
          })}
        </div>
        <div>
          <div style={sectionTitle}>Top Months</div>
          {topMonths.map((m, i) => {
            const pct = (m.cost / (topMonths[0]?.cost || 1)) * 100
            return (
              <div key={m.month} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: 8, background: MONTH_COLORS[i], alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0f172a' }}>{i + 1}</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{m.month}</span>
                  </span>
                  <span style={{ fontWeight: 600, color: MONTH_COLORS[i], fontSize: 11 }}>{fmtNum(m.tokens)}/{fmtCost(m.cost)}</span>
                </div>
                <ProgressBar pct={pct} gradient={`linear-gradient(90deg, ${MONTH_COLORS[i]}88, ${MONTH_COLORS[i]})`} />
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div style={sectionTitle}>Last 90 Days</div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {recentContribs.map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: 1.5, background: HEATMAP_LEVELS[getLevel(c.totals.cost)] }} />
          ))}
        </div>
      </div>

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>github.com/junhoyeo/tokscale</span>
      </div>
    </div>
  )
}

// Card: Compact
function CompactCard({ entries, contributions }: Props) {
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)
  const totalTokens = entries.reduce((s, e) => s + e.input + e.output + e.cacheRead + e.cacheWrite, 0)
  const totalMessages = entries.reduce((s, e) => s + e.messageCount, 0)
  const activeDays = contributions.filter(c => c.totals.cost > 0).length
  const uniqueModels = [...new Set(entries.map(e => e.model))].length
  const dateRange = contributions.length > 0 ? { start: contributions[0]?.date, end: contributions[contributions.length - 1]?.date } : null

  return (
    <div style={{ ...cardBase, width: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ ...headerStyle, fontSize: 20 }}>Tokscale Stats</div>
        {dateRange && <div style={{ fontSize: 11, color: '#64748b' }}>{dateRange.start} ~ {dateRange.end}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Total Cost</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#38bdf8', lineHeight: 1.1 }}>{fmtCost(totalCost)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Tokens', value: fmtNum(totalTokens), color: '#818cf8' },
          { label: 'Messages', value: fmtNum(totalMessages), color: '#34d399' },
          { label: 'Active Days', value: String(activeDays), color: '#fbbf24' },
          { label: 'Models', value: String(uniqueModels), color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={statBox}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>github.com/junhoyeo/tokscale</span>
      </div>
    </div>
  )
}

// Card: Top Models
function ModelsCard({ entries }: { entries: ModelEntry[] }) {
  const topModels = [...entries].sort((a, b) => b.cost - a.cost).slice(0, 10)
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)

  return (
    <div style={{ ...cardBase, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={headerStyle}>Top Models</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{fmtCost(totalCost)} total</div>
      </div>

      {topModels.map((m, i) => {
        const pct = (m.cost / (topModels[0]?.cost || 1)) * 100
        return (
          <div key={`${m.model}-${i}`} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-flex', width: 20, height: 20, borderRadius: 10,
                  background: i < 3 ? RANK_COLORS[i] : '#475569',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#0f172a',
                }}>{i + 1}</span>
                <span style={{ fontWeight: 600, color: '#f1f5f9', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{m.provider}</span>
              </span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>{fmtCost(m.cost)}</span>
            </div>
            <ProgressBar pct={pct} gradient="linear-gradient(90deg, #38bdf8, #818cf8)" />
          </div>
        )
      })}

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>{entries.length} models tracked</span>
      </div>
    </div>
  )
}

// Card: Activity (heatmap focus)
function ActivityCard({ entries, contributions }: Props) {
  const recentContribs = contributions.slice(-91)
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)
  const totalTokens = entries.reduce((s, e) => s + e.input + e.output + e.cacheRead + e.cacheWrite, 0)
  const activeDays = contributions.filter(c => c.totals.cost > 0).length
  const maxCost = recentContribs.length > 0 ? Math.max(...recentContribs.map(c => c.totals.cost)) : 1
  const dateRange = contributions.length > 0 ? { start: contributions[0]?.date, end: contributions[contributions.length - 1]?.date } : null

  function getLevel(cost: number): number {
    if (cost === 0) return 0
    const ratio = cost / maxCost
    if (ratio < 0.15) return 1
    if (ratio < 0.35) return 2
    if (ratio < 0.6) return 3
    if (ratio < 0.85) return 4
    return 5
  }

  return (
    <div style={{ ...cardBase, width: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={headerStyle}>Activity Overview</div>
        {dateRange && <div style={{ fontSize: 12, color: '#64748b' }}>{dateRange.start} ~ {dateRange.end}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Cost', value: fmtCost(totalCost), color: '#38bdf8' },
          { label: 'Total Tokens', value: fmtNum(totalTokens), color: '#818cf8' },
          { label: 'Active Days', value: String(activeDays), color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} style={statBox}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={sectionTitle}>Last 90 Days Activity</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {recentContribs.map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: HEATMAP_LEVELS[getLevel(c.totals.cost)] }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: '#64748b' }}>
          <span>Less</span>
          {HEATMAP_LEVELS.map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>github.com/junhoyeo/tokscale</span>
      </div>
    </div>
  )
}

// Card: Monthly breakdown
function MonthlyCard({ contributions }: { contributions: Contribution[] }) {
  const byMonth = new Map<string, { cost: number; tokens: number; messages: number }>()
  for (const c of contributions) {
    const month = c.date.substring(0, 7)
    let e = byMonth.get(month)
    if (!e) { e = { cost: 0, tokens: 0, messages: 0 }; byMonth.set(month, e) }
    e.cost += c.totals.cost; e.tokens += c.totals.tokens; e.messages += c.totals.messages
  }
  const months = [...byMonth.entries()]
    .map(([m, d]) => ({ month: m, ...d }))
    .sort((a, b) => a.month.localeCompare(b.month))
  const maxCost = Math.max(...months.map(m => m.cost), 1)
  const totalCost = months.reduce((s, m) => s + m.cost, 0)

  return (
    <div style={{ ...cardBase, width: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={headerStyle}>Monthly Costs</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{fmtCost(totalCost)} total</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {months.map((m, i) => {
          const pct = (m.cost / maxCost) * 100
          const color = MONTH_COLORS[i % MONTH_COLORS.length]
          return (
            <div key={m.month}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{m.month}</span>
                <span style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>{fmtNum(m.tokens)} tokens</span>
                  <span style={{ fontWeight: 700, color, minWidth: 60, textAlign: 'right' }}>{fmtCost(m.cost)}</span>
                </span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3 }}>
                <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.5s' }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>{months.length} months tracked</span>
      </div>
    </div>
  )
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d4a27f', openai: '#10a37f', google: '#4285f4', deepseek: '#7c6bff',
  cursor: '#38bdf8', xai: '#e5e7eb', meta: '#0668e1', mistral: '#ff7000',
}

function getProviderColor(p: string): string {
  return PROVIDER_COLORS[p.toLowerCase()] || '#94a3b8'
}

// Card: Providers
function ProvidersCard({ entries }: { entries: ModelEntry[] }) {
  const byProvider = new Map<string, { cost: number; tokens: number; models: Set<string>; messages: number }>()
  for (const e of entries) {
    let p = byProvider.get(e.provider)
    if (!p) { p = { cost: 0, tokens: 0, models: new Set(), messages: 0 }; byProvider.set(e.provider, p) }
    p.cost += e.cost
    p.tokens += e.input + e.output + e.cacheRead + e.cacheWrite
    p.models.add(e.model)
    p.messages += e.messageCount
  }
  const sorted = [...byProvider.entries()]
    .map(([name, d]) => ({ name, ...d, modelCount: d.models.size }))
    .sort((a, b) => b.cost - a.cost)
  const totalCost = sorted.reduce((s, p) => s + p.cost, 0)
  const maxCost = sorted[0]?.cost || 1

  return (
    <div style={{ ...cardBase, width: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={headerStyle}>Provider Breakdown</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{fmtCost(totalCost)} total</div>
      </div>

      {/* Donut-like visual */}
      <div style={{ display: 'flex', gap: 8, height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
        {sorted.map(p => (
          <div key={p.name} style={{
            flex: p.cost / totalCost,
            background: getProviderColor(p.name),
            minWidth: 4,
          }} />
        ))}
      </div>

      {sorted.map(p => {
        const pct = (p.cost / maxCost) * 100
        const share = ((p.cost / totalCost) * 100).toFixed(1)
        const color = getProviderColor(p.name)
        return (
          <div key={p.name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: '#f1f5f9', textTransform: 'capitalize' as const }}>{p.name}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{p.modelCount} models · {fmtNum(p.messages)} msgs</span>
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{share}%</span>
                <span style={{ fontWeight: 700, color, minWidth: 60, textAlign: 'right' as const }}>{fmtCost(p.cost)}</span>
              </span>
            </div>
            <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
              <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
            </div>
          </div>
        )
      })}

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>{sorted.length} providers</span>
      </div>
    </div>
  )
}

// Card: Token Breakdown
function TokensCard({ entries }: { entries: ModelEntry[] }) {
  const input = entries.reduce((s, e) => s + e.input, 0)
  const output = entries.reduce((s, e) => s + e.output, 0)
  const cacheRead = entries.reduce((s, e) => s + e.cacheRead, 0)
  const cacheWrite = entries.reduce((s, e) => s + e.cacheWrite, 0)
  const reasoning = entries.reduce((s, e) => s + e.reasoning, 0)
  const total = input + output + cacheRead + cacheWrite + reasoning

  const segments = [
    { label: 'Cache Read', value: cacheRead, color: '#818cf8' },
    { label: 'Cache Write', value: cacheWrite, color: '#a78bfa' },
    { label: 'Input', value: input, color: '#38bdf8' },
    { label: 'Output', value: output, color: '#34d399' },
    { label: 'Reasoning', value: reasoning, color: '#fbbf24' },
  ].filter(s => s.value > 0)
  const maxVal = Math.max(...segments.map(s => s.value))

  return (
    <div style={{ ...cardBase, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={headerStyle}>Token Breakdown</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{fmtNum(total)} total</div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
        {segments.map(s => (
          <div key={s.label} style={{
            flex: s.value / total,
            background: s.color,
            minWidth: s.value > 0 ? 3 : 0,
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {segments.map(s => (
          <div key={s.label} style={statBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{fmtNum(s.value)}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{((s.value / total) * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>

      {/* Per-segment bars */}
      {segments.map(s => (
        <div key={s.label} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: '#94a3b8' }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: s.color }}>{fmtNum(s.value)}</span>
          </div>
          <div style={{ height: 3, background: '#1e293b', borderRadius: 2 }}>
            <div style={{ height: 3, borderRadius: 2, width: `${(s.value / maxVal) * 100}%`, background: s.color }} />
          </div>
        </div>
      ))}

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>{entries.length} model entries</span>
      </div>
    </div>
  )
}

// Card: Streak
function StreakCard({ entries, contributions }: Props) {
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)
  const activeDays = contributions.filter(c => c.totals.cost > 0 || c.totals.messages > 0).length
  const totalDays = contributions.length
  const totalMessages = entries.reduce((s, e) => s + e.messageCount, 0)

  // Compute streaks
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  for (let i = contributions.length - 1; i >= 0; i--) {
    const isActive = contributions[i].totals.cost > 0 || contributions[i].totals.messages > 0
    if (i === contributions.length - 1 || i === contributions.length - 2) {
      if (isActive) currentStreak++
      else if (i === contributions.length - 1) currentStreak = 0
      else break
    }
  }
  for (const c of contributions) {
    if (c.totals.cost > 0 || c.totals.messages > 0) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  // Daily average cost
  const avgDailyCost = activeDays > 0 ? totalCost / activeDays : 0
  const avgDailyMessages = activeDays > 0 ? totalMessages / activeDays : 0

  // Find peak day
  let peakDay = { date: '', cost: 0 }
  for (const c of contributions) {
    if (c.totals.cost > peakDay.cost) {
      peakDay = { date: c.date, cost: c.totals.cost }
    }
  }

  // Weekly pattern (last 28 days)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = new Array(7).fill(0)
  const dayCount = new Array(7).fill(0)
  const recent = contributions.slice(-28)
  for (const c of recent) {
    const d = new Date(c.date).getDay()
    dayOfWeek[d] += c.totals.cost
    if (c.totals.cost > 0) dayCount[d]++
  }
  const maxWeekday = Math.max(...dayOfWeek)

  return (
    <div style={{ ...cardBase, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={headerStyle}>Coding Streaks</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{activeDays}/{totalDays} active days</div>
      </div>

      {/* Big streak numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ ...statBox, textAlign: 'center' as const }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Current Streak</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#f87171', lineHeight: 1.1 }}>{currentStreak}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>days</div>
        </div>
        <div style={{ ...statBox, textAlign: 'center' as const }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Longest Streak</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24', lineHeight: 1.1 }}>{longestStreak}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>days</div>
        </div>
      </div>

      {/* Daily averages */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={statBox}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Avg/Day Cost</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>{fmtCost(avgDailyCost)}</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Avg/Day Msgs</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>{Math.round(avgDailyMessages)}</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Peak Day</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>{fmtCost(peakDay.cost)}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>{peakDay.date}</div>
        </div>
      </div>

      {/* Weekly pattern */}
      <div>
        <div style={sectionTitle}>Weekly Pattern (Last 4 Weeks)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {weekDays.map((day, i) => (
            <div key={day} style={{ flex: 1, textAlign: 'center' as const }}>
              <div style={{
                height: 60,
                display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end',
              }}>
                <div style={{
                  height: `${maxWeekday > 0 ? (dayOfWeek[i] / maxWeekday) * 100 : 0}%`,
                  minHeight: dayOfWeek[i] > 0 ? 4 : 0,
                  background: 'linear-gradient(180deg, #38bdf8, #818cf8)',
                  borderRadius: '3px 3px 0 0',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{day}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{dayCount[i]}d</div>
            </div>
          ))}
        </div>
      </div>

      <div style={footerStyle}>
        <span>Generated by Tokscale Dashboard</span>
        <span>github.com/junhoyeo/tokscale</span>
      </div>
    </div>
  )
}

// Card: Badge (social profile card)
function BadgeCard({ entries, contributions }: Props) {
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)
  const totalTokens = entries.reduce((s, e) => s + e.input + e.output + e.cacheRead + e.cacheWrite, 0)
  const totalMessages = entries.reduce((s, e) => s + e.messageCount, 0)
  const uniqueModels = [...new Set(entries.map(e => e.model))].length
  const activeDays = contributions.filter(c => c.totals.cost > 0).length
  const topModel = [...entries].sort((a, b) => b.cost - a.cost)[0]
  const recentContribs = contributions.slice(-42)
  const maxCost = recentContribs.length > 0 ? Math.max(...recentContribs.map(c => c.totals.cost)) : 1

  function getLevel(cost: number): number {
    if (cost === 0) return 0
    const ratio = cost / maxCost
    if (ratio < 0.2) return 1
    if (ratio < 0.5) return 2
    if (ratio < 0.8) return 3
    return 4
  }

  // Determine "rank" based on total cost
  let rank = { label: 'Starter', color: '#94a3b8', emoji: '' }
  if (totalCost >= 2000) rank = { label: 'Legend', color: '#fbbf24', emoji: '🏆' }
  else if (totalCost >= 1000) rank = { label: 'Master', color: '#a78bfa', emoji: '💎' }
  else if (totalCost >= 500) rank = { label: 'Expert', color: '#38bdf8', emoji: '⚡' }
  else if (totalCost >= 200) rank = { label: 'Advanced', color: '#34d399', emoji: '🔥' }
  else if (totalCost >= 50) rank = { label: 'Regular', color: '#fb923c', emoji: '✨' }

  return (
    <div style={{
      ...cardBase, width: 400,
      background: 'linear-gradient(135deg, #0f172a 0%, #1a1033 40%, #0f172a 100%)',
      position: 'relative' as const, overflow: 'hidden',
    }}>
      {/* Decorative glow */}
      <div style={{
        position: 'absolute' as const, top: -60, right: -60,
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${rank.color}22, transparent 70%)`,
      }} />

      <div style={{ position: 'relative' as const }}>
        {/* Header with rank */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 4 }}>AI USAGE RANK</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: rank.color }}>{rank.emoji} {rank.label}</div>
          </div>
          <div style={{
            width: 50, height: 50, borderRadius: 12,
            background: `linear-gradient(135deg, ${rank.color}33, ${rank.color}11)`,
            border: `2px solid ${rank.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {rank.emoji}
          </div>
        </div>

        {/* Big cost */}
        <div style={{ textAlign: 'center' as const, marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>TOTAL SPENT</div>
          <div style={{
            fontSize: 48, fontWeight: 900, lineHeight: 1.1,
            background: `linear-gradient(90deg, #38bdf8, ${rank.color})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{fmtCost(totalCost)}</div>
        </div>

        {/* Compact stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Tokens', value: fmtNum(totalTokens), color: '#818cf8' },
            { label: 'Messages', value: fmtNum(totalMessages), color: '#34d399' },
            { label: 'Models', value: String(uniqueModels), color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' as const, padding: '8px 4px', borderRadius: 8, background: 'rgba(30,41,59,0.5)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mini heatmap (6 weeks) */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 16 }}>
          {recentContribs.map((c, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: 1.5, background: HEATMAP_LEVELS[getLevel(c.totals.cost)] }} />
          ))}
        </div>

        {/* Favorite model */}
        {topModel && (
          <div style={{
            textAlign: 'center' as const, fontSize: 11, color: '#64748b',
            padding: '8px 0', borderTop: '1px solid rgba(148,163,184,0.1)',
          }}>
            Favorite: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{topModel.model}</span>
            <span style={{ color: '#94a3b8' }}> · {activeDays} active days</span>
          </div>
        )}
      </div>

      <div style={{ ...footerStyle, marginTop: 12 }}>
        <span>tokscale.dev</span>
        <span>{new Date().toISOString().split('T')[0]}</span>
      </div>
    </div>
  )
}

export function ShareCard({ entries, contributions }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [cardType, setCardType] = useState<CardType>('overview')
  const { isDark } = useTheme()

  const cardContent = useMemo(() => {
    switch (cardType) {
      case 'overview': return <OverviewCard entries={entries} contributions={contributions} />
      case 'compact': return <CompactCard entries={entries} contributions={contributions} />
      case 'models': return <ModelsCard entries={entries} />
      case 'activity': return <ActivityCard entries={entries} contributions={contributions} />
      case 'monthly': return <MonthlyCard contributions={contributions} />
      case 'providers': return <ProvidersCard entries={entries} />
      case 'tokens': return <TokensCard entries={entries} />
      case 'streak': return <StreakCard entries={entries} contributions={contributions} />
      case 'badge': return <BadgeCard entries={entries} contributions={contributions} />
    }
  }, [cardType, entries, contributions])

  async function handleDownload() {
    if (!cardRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0f172a',
      })
      const link = document.createElement('a')
      link.download = `tokscale-${cardType}-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to generate image:', err)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Card type selector */}
      <div className="glass rounded-xl p-5">
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Choose Card Style</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CARD_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setCardType(ct.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                cardType === ct.id
                  ? isDark
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-sky-500 bg-sky-50 text-sky-600'
                  : isDark
                    ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              {ct.icon}
              <span className="text-sm font-semibold">{ct.label}</span>
              <span className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ct.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview + Download */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Preview</h3>
          <button
            onClick={handleDownload}
            disabled={generating}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Download PNG'}
          </button>
        </div>

        <div className="flex justify-center overflow-x-auto py-4">
          <div ref={cardRef}>
            {cardContent}
          </div>
        </div>
      </div>
    </div>
  )
}
