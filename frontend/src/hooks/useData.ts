import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ModelsData, MonthlyData, GraphData, PricingData, RefreshTarget, RefreshResult } from '../types'
import {
  deriveMetaFromGraph,
  deriveModelsDataFromGraph,
  deriveMonthlyDataFromGraph,
} from '../graph-derived'

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

  const [refreshing, setRefreshing] = useState<RefreshTarget | null>(null)

  const loadData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }))
      const [graph, pricing] = await Promise.all([
        api.getGraph(),
        api.getPricing().catch(() => null),
      ])
      const models = deriveModelsDataFromGraph(graph)
      const monthly = deriveMonthlyDataFromGraph(graph)
      const meta = deriveMetaFromGraph(graph)
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

  const refresh = useCallback(async (target: RefreshTarget = 'all'): Promise<RefreshResult> => {
    setRefreshing(target)
    try {
      const result = await api.refresh(target)
      if (result.success) await loadData()
      return result
    } finally {
      setRefreshing(null)
    }
  }, [loadData])

  return { ...data, refresh, refreshing, reload: loadData }
}
