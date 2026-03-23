export interface ModelEntry {
  client: string          // 原 source，已改名为 client
  mergedClients: string[] | null
  model: string
  provider: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  messageCount: number
  cost: number
}

export interface ModelsData {
  groupBy: string
  entries: ModelEntry[]
  totalInput: number
  totalOutput: number
  totalCacheRead: number
  totalCacheWrite: number
  totalMessages: number
  totalCost: number
  processingTimeMs: number
}

export interface MonthlyEntry {
  month: string
  models: string[]
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  messageCount: number
  cost: number
}

export interface MonthlyData {
  entries: MonthlyEntry[]
  totalCost: number
  processingTimeMs: number
}

// graph.json contribution 中的 client 子项（原名 ContributionSource）
export interface ContributionClient {
  client: string          // 原 source
  modelId: string
  providerId: string
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning: number
  }
  cost: number
  messages: number
}

export interface Contribution {
  date: string
  totals: {
    tokens: number
    cost: number
    messages: number
  }
  intensity: number
  tokenBreakdown: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning: number
  }
  clients: ContributionClient[]   // 原 sources
}

export interface GraphData {
  meta: {
    generatedAt: string
    version: string
    dateRange: { start: string; end: string }
  }
  summary: {
    totalTokens: number
    totalCost: number
    totalDays: number
    activeDays: number
    averagePerDay: number
    maxCostInSingleDay: number
    clients: string[]             // 原 sources
    models: string[]
  }
  years: Array<{
    year: string
    totalTokens: number
    totalCost: number
    range: { start: string; end: string }
  }>
  contributions: Contribution[]
}

export interface Filters {
  sources: string[]       // UI 中仍叫 "Source"，对应 entry.client
  providers: string[]
  models: string[]
  dateRange: { start: string; end: string } | null
  minCost: number | null
  search: string
}

export interface ModelPricing {
  matchedKey: string
  source: string
  inputPer1M: number
  outputPer1M: number
  cacheReadPer1M?: number
  cacheWritePer1M?: number
}

export interface PricingData {
  generatedAt: string
  source: string
  note: string
  errors: string[]
  models: Record<string, ModelPricing>
}
