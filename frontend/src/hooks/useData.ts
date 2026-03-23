import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ModelsData, MonthlyData, GraphData, PricingData } from '../types'

interface DashboardData {
  models: ModelsData | null
  monthly: MonthlyData | null
  graph: GraphData | null
  meta: { updatedAt: string } | null
  pricing: PricingData | null
  loading: boolean
  error: string | null
}

export function useData() {
  const [data, setData] = useState<DashboardData>({
    models: null,
    monthly: null,
    graph: null,
    meta: null,
    pricing: null,
    loading: true,
    error: null,
  })

  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }))
      const [models, monthly, graph, meta, pricing] = await Promise.all([
        api.getModels(),
        api.getMonthly(),
        api.getGraph(),
        api.getMeta(),
        api.getPricing().catch(() => null),
      ])
      setData({ models, monthly, graph, meta, pricing, loading: false, error: null })
    } catch (err) {
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data',
      }))
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await api.refresh()
      if (result.success) {
        await loadData()
      }
      return result
    } finally {
      setRefreshing(false)
    }
  }, [loadData])

  return { ...data, refresh, refreshing }
}
