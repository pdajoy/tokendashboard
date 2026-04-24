import type { Contribution, GraphData, ModelEntry, ModelsData, MonthlyData } from './types'

function splitProviders(providerId: string): string[] {
  return providerId
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

export function deriveModelsDataFromGraph(graph: GraphData | null): ModelsData | null {
  if (!graph) return null

  const byKey = new Map<string, ModelEntry & { providers: Set<string> }>()

  for (const contribution of graph.contributions) {
    for (const client of contribution.clients) {
      const key = `${client.client}\u0000${client.modelId}`
      const existing = byKey.get(key)

      if (existing) {
        splitProviders(client.providerId).forEach(provider => existing.providers.add(provider))
        existing.input += client.tokens.input
        existing.output += client.tokens.output
        existing.cacheRead += client.tokens.cacheRead
        existing.cacheWrite += client.tokens.cacheWrite
        existing.reasoning += client.tokens.reasoning
        existing.messageCount += client.messages
        existing.cost += client.cost
        continue
      }

      byKey.set(key, {
        client: client.client,
        mergedClients: null,
        model: client.modelId,
        provider: client.providerId,
        providers: new Set(splitProviders(client.providerId)),
        input: client.tokens.input,
        output: client.tokens.output,
        cacheRead: client.tokens.cacheRead,
        cacheWrite: client.tokens.cacheWrite,
        reasoning: client.tokens.reasoning,
        messageCount: client.messages,
        cost: client.cost,
      })
    }
  }

  const entries: ModelEntry[] = [...byKey.values()]
    .map(({ providers, ...entry }) => ({
      ...entry,
      provider: [...providers].sort().join(', '),
    }))
    .sort((a, b) => b.cost - a.cost || a.client.localeCompare(b.client) || a.model.localeCompare(b.model))

  return {
    groupBy: 'client,model',
    entries,
    totalInput: entries.reduce((sum, entry) => sum + entry.input, 0),
    totalOutput: entries.reduce((sum, entry) => sum + entry.output, 0),
    totalCacheRead: entries.reduce((sum, entry) => sum + entry.cacheRead, 0),
    totalCacheWrite: entries.reduce((sum, entry) => sum + entry.cacheWrite, 0),
    totalMessages: entries.reduce((sum, entry) => sum + entry.messageCount, 0),
    totalCost: entries.reduce((sum, entry) => sum + entry.cost, 0),
    processingTimeMs: 0,
  }
}

export function deriveMonthlyDataFromContributions(contributions: Contribution[]): MonthlyData | null {
  if (!contributions.length) return null

  const byMonth = new Map<string, {
    models: Set<string>
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    messageCount: number
    cost: number
  }>()

  for (const contribution of contributions) {
    const month = contribution.date.substring(0, 7)
    const existing = byMonth.get(month) ?? {
      models: new Set<string>(),
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      messageCount: 0,
      cost: 0,
    }

    existing.input += contribution.tokenBreakdown.input
    existing.output += contribution.tokenBreakdown.output
    existing.cacheRead += contribution.tokenBreakdown.cacheRead
    existing.cacheWrite += contribution.tokenBreakdown.cacheWrite
    existing.messageCount += contribution.totals.messages
    existing.cost += contribution.totals.cost
    for (const client of contribution.clients) {
      existing.models.add(client.modelId)
    }

    byMonth.set(month, existing)
  }

  const entries = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => ({
      month,
      models: [...entry.models].sort(),
      input: entry.input,
      output: entry.output,
      cacheRead: entry.cacheRead,
      cacheWrite: entry.cacheWrite,
      messageCount: entry.messageCount,
      cost: entry.cost,
    }))

  return {
    entries,
    totalCost: entries.reduce((sum, entry) => sum + entry.cost, 0),
    processingTimeMs: 0,
  }
}

export function deriveMonthlyDataFromGraph(graph: GraphData | null): MonthlyData | null {
  if (!graph) return null
  return deriveMonthlyDataFromContributions(graph.contributions)
}

export function deriveMetaFromGraph(graph: GraphData | null): { updatedAt: string } | null {
  if (!graph?.meta?.generatedAt) return null
  return { updatedAt: graph.meta.generatedAt }
}
