import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Filter, X, ChevronDown, ChevronUp, Search, Clock } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { Filters, ModelEntry, Contribution } from '../types'

interface Props {
  entries: ModelEntry[]
  contributions: Contribution[]
  filters: Filters
  onFilterChange: (filters: Filters) => void
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { isDark } = useTheme()
  const [pos, setPos] = useState({ top: 0, left: 0, width: 256 })

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownH = 320
    const openUp = spaceBelow < dropdownH && rect.top > spaceBelow
    const w = Math.max(256, rect.width)
    let left = rect.left
    if (left + w > window.innerWidth - 8) {
      left = rect.right - w
      if (left < 8) left = 8
    }
    setPos({
      top: openUp ? rect.top - Math.min(dropdownH, rect.top - 8) - 4 : rect.bottom + 4,
      left,
      width: w,
    })
  }, [])

  useEffect(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        (!buttonRef.current || !buttonRef.current.contains(target)) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filteredOptions = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`rounded-lg shadow-2xl py-1 max-h-80 overflow-hidden flex flex-col ${
        isDark
          ? 'bg-slate-800 border border-slate-700'
          : 'bg-white border border-slate-200 shadow-lg'
      }`}
    >
      {options.length > 8 && (
        <div className={`px-2 py-1.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full px-2 py-1 rounded border text-xs focus:outline-none focus:border-sky-500 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
            }`}
            autoFocus
          />
        </div>
      )}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <button
          onClick={() => onChange([])}
          className={`text-xs transition ${isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'}`}
        >
          Clear all
        </button>
        <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
        <button
          onClick={() => onChange([...filteredOptions])}
          className={`text-xs transition ${isDark ? 'text-slate-400 hover:text-sky-400' : 'text-slate-500 hover:text-sky-600'}`}
        >
          Select all ({filteredOptions.length})
        </button>
      </div>
      <div className="overflow-y-auto max-h-64">
        {filteredOptions.map(opt => (
          <label
            key={opt}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
              isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={e => {
                onChange(
                  e.target.checked
                    ? [...selected, opt]
                    : selected.filter(s => s !== opt)
                )
              }}
              className={`rounded focus:ring-sky-500 ${
                isDark ? 'border-slate-600 bg-slate-800 text-sky-500' : 'border-slate-300 bg-white text-sky-600'
              }`}
            />
            <span className={`text-sm truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{opt}</span>
          </label>
        ))}
        {filteredOptions.length === 0 && (
          <div className={`px-3 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No matches</div>
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition min-w-[140px] ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
        }`}
      >
        <span className="flex-1 text-left truncate">
          {selected.length === 0 ? label : `${label} (${selected.length})`}
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {dropdown}
    </div>
  )
}

function getQuickDateRange(key: string): { start: string; end: string } | null {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  switch (key) {
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { start: fmt(start), end: fmt(now) }
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { start: fmt(start), end: fmt(now) }
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: fmt(start), end: fmt(now) }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: fmt(start), end: fmt(end) }
    }
    case '6m': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 6)
      return { start: fmt(start), end: fmt(now) }
    }
    case '1y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 1)
      return { start: fmt(start), end: fmt(now) }
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { start: fmt(start), end: fmt(now) }
    }
    case 'last_year': {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      return { start: fmt(start), end: fmt(end) }
    }
    default:
      return null
  }
}

const QUICK_DATES = [
  { key: '7d', label: '7天' },
  { key: '30d', label: '30天' },
  { key: 'this_month', label: '本月' },
  { key: 'last_month', label: '上月' },
  { key: '6m', label: '半年' },
  { key: '1y', label: '一年' },
  { key: 'this_year', label: '今年' },
  { key: 'last_year', label: '去年' },
]

export function FilterPanel({ entries, contributions, filters, onFilterChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { isDark } = useTheme()

  const { allSources, allProviders, allModels } = useMemo(() => {
    const sourcesSet = new Set<string>()
    const providersSet = new Set<string>()
    const modelsSet = new Set<string>()

    for (const e of entries) {
      sourcesSet.add(e.client)
      providersSet.add(e.provider)
      modelsSet.add(e.model)
    }

    for (const c of contributions) {
      if (c.clients) {
        for (const s of c.clients) {
          if (s.client) sourcesSet.add(s.client)
          if (s.providerId) providersSet.add(s.providerId)
          if (s.modelId) modelsSet.add(s.modelId)
        }
      }
    }

    return {
      allSources: [...sourcesSet].sort(),
      allProviders: [...providersSet].sort(),
      allModels: [...modelsSet].sort(),
    }
  }, [entries, contributions])

  const hasFilters = filters.sources.length > 0 || filters.providers.length > 0 ||
    filters.models.length > 0 || !!filters.search || filters.minCost != null ||
    filters.dateRange != null

  function isQuickActive(key: string): boolean {
    const range = getQuickDateRange(key)
    if (!range || !filters.dateRange) return false
    return filters.dateRange.start === range.start && filters.dateRange.end === range.end
  }

  function clearAll() {
    onFilterChange({
      sources: [],
      providers: [],
      models: [],
      dateRange: null,
      minCost: null,
      search: '',
    })
  }

  return (
    <div className="glass rounded-xl animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 transition ${
          isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-100/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Filter className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Advanced Filters</span>
          {hasFilters && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
            }`}>
              Active
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          : <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        }
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Search models, providers..."
                value={filters.search}
                onChange={e => onFilterChange({ ...filters, search: e.target.value })}
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-sky-500 transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            <MultiSelect
              label="Source"
              options={allSources}
              selected={filters.sources}
              onChange={sources => onFilterChange({ ...filters, sources })}
            />
            <MultiSelect
              label="Provider"
              options={allProviders}
              selected={filters.providers}
              onChange={providers => onFilterChange({ ...filters, providers })}
            />
            <MultiSelect
              label="Model"
              options={allModels}
              selected={filters.models}
              onChange={models => onFilterChange({ ...filters, models })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Min cost ($):</span>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={filters.minCost ?? ''}
                onChange={e => {
                  const v = e.target.value ? parseFloat(e.target.value) : null
                  onFilterChange({ ...filters, minCost: v })
                }}
                className={`w-24 px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:border-sky-500 transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearAll}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                  isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                }`}
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Clock className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span className={`text-xs mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quick:</span>
            {QUICK_DATES.map(qd => (
              <button
                key={qd.key}
                onClick={() => {
                  if (isQuickActive(qd.key)) {
                    onFilterChange({ ...filters, dateRange: null })
                  } else {
                    onFilterChange({ ...filters, dateRange: getQuickDateRange(qd.key) })
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                  isQuickActive(qd.key)
                    ? isDark
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                      : 'bg-sky-100 text-sky-600 border-sky-300'
                    : isDark
                      ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {qd.label}
              </button>
            ))}

            <div className={`h-4 w-px mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />

            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>From:</span>
              <input
                type="date"
                value={filters.dateRange?.start ?? ''}
                onChange={e => {
                  const start = e.target.value
                  onFilterChange({
                    ...filters,
                    dateRange: start ? { start, end: filters.dateRange?.end ?? '' } : null,
                  })
                }}
                className={`px-2 py-1 rounded-lg border text-xs focus:outline-none focus:border-sky-500 transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>To:</span>
              <input
                type="date"
                value={filters.dateRange?.end ?? ''}
                onChange={e => {
                  const end = e.target.value
                  onFilterChange({
                    ...filters,
                    dateRange: end ? { start: filters.dateRange?.start ?? '', end } : null,
                  })
                }}
                className={`px-2 py-1 rounded-lg border text-xs focus:outline-none focus:border-sky-500 transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
            {filters.dateRange && (
              <button
                onClick={() => onFilterChange({ ...filters, dateRange: null })}
                className={`text-xs transition ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-500'}`}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
