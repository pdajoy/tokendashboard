import type { GraphData, PricingData, AppSettings, RefreshTarget, RefreshResult } from './types'

const BASE = '/api'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  getGraph: () => fetchJSON<GraphData>('/graph'),

  getPricing: () => fetchJSON<PricingData>('/pricing'),

  getCSVUrl: () => `${BASE}/export/csv`,

  async refresh(target: RefreshTarget = 'all'): Promise<RefreshResult> {
    const res = await fetch(`${BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    return res.json()
  },

  async getSettings(): Promise<{ settings: AppSettings }> {
    const res = await fetch(`${BASE}/settings`)
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
    return res.json()
  },

  async saveSettings(settings: AppSettings): Promise<{ success: boolean; settings: AppSettings; message?: string }> {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    return res.json()
  },
}
