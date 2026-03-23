import type { ModelsData, MonthlyData, GraphData, PricingData } from './types'

const BASE = '/api'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  getModels: () => fetchJSON<ModelsData>('/models'),
  getMonthly: () => fetchJSON<MonthlyData>('/monthly'),
  getGraph: () => fetchJSON<GraphData>('/graph'),
  getMeta: () => fetchJSON<{ updatedAt: string }>('/meta'),

  async refresh(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE}/refresh`, { method: 'POST' })
    return res.json()
  },

  getPricing: () => fetchJSON<PricingData>('/pricing'),
  getCSVUrl: () => `${BASE}/export/csv`,
}
