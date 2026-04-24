import fs from 'node:fs/promises'

const COST_PRECISION = 1e12

export function roundCost(value) {
  return Math.round((Number(value) + Number.EPSILON) * COST_PRECISION) / COST_PRECISION
}

export async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

export async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function splitProviders(providerId = '') {
  return String(providerId)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

export function calculateCostFromPricing(tokens, pricing) {
  if (!pricing) return 0

  return roundCost(
    ((tokens?.input ?? 0) * (pricing.inputPer1M ?? 0)) / 1_000_000 +
    ((tokens?.output ?? 0) * (pricing.outputPer1M ?? 0)) / 1_000_000 +
    ((tokens?.cacheRead ?? 0) * (pricing.cacheReadPer1M ?? 0)) / 1_000_000 +
    ((tokens?.cacheWrite ?? 0) * (pricing.cacheWritePer1M ?? 0)) / 1_000_000
  )
}

function calculateContributionTokens(contribution) {
  return (contribution?.tokenBreakdown?.input ?? 0) +
    (contribution?.tokenBreakdown?.output ?? 0) +
    (contribution?.tokenBreakdown?.cacheRead ?? 0) +
    (contribution?.tokenBreakdown?.cacheWrite ?? 0) +
    (contribution?.tokenBreakdown?.reasoning ?? 0)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function applyLocalCostCorrectionsToGraph(graph, pricingPayload) {
  const correctedGraph = clone(graph)
  const pricingModels = pricingPayload?.models ?? {}
  const correctedModels = new Set()
  const affectedDays = new Set()
  let affectedEntries = 0
  let totalDelta = 0

  correctedGraph.contributions = (correctedGraph.contributions ?? []).map(contribution => {
    let contributionChanged = false

    const correctedClients = (contribution.clients ?? []).map(client => {
      const pricing = pricingModels[client.modelId]
      if (!pricing || pricing.source !== 'Local Override') {
        return client
      }

      const nextCost = calculateCostFromPricing(client.tokens, pricing)
      const prevCost = Number(client.cost ?? 0)
      const delta = roundCost(nextCost - prevCost)

      correctedModels.add(client.modelId)
      if (Math.abs(delta) > 0) {
        affectedEntries += 1
        totalDelta = roundCost(totalDelta + delta)
        affectedDays.add(contribution.date)
        contributionChanged = true
      }

      return {
        ...client,
        cost: nextCost,
      }
    })

    const totals = {
      ...contribution.totals,
      tokens: calculateContributionTokens(contribution),
      cost: roundCost(correctedClients.reduce((sum, client) => sum + Number(client.cost ?? 0), 0)),
      messages: correctedClients.reduce((sum, client) => sum + Number(client.messages ?? 0), 0),
    }

    if (!contributionChanged && totals.cost === contribution.totals.cost && totals.messages === contribution.totals.messages) {
      return contribution
    }

    return {
      ...contribution,
      clients: correctedClients,
      totals,
    }
  })

  const contributions = correctedGraph.contributions ?? []
  const totalTokens = contributions.reduce((sum, contribution) => sum + Number(contribution.totals?.tokens ?? 0), 0)
  const totalCost = roundCost(contributions.reduce((sum, contribution) => sum + Number(contribution.totals?.cost ?? 0), 0))
  const totalDays = contributions.length
  const activeDays = contributions.filter(contribution =>
    Number(contribution.totals?.tokens ?? 0) > 0 || Number(contribution.totals?.messages ?? 0) > 0
  ).length
  const maxCostInSingleDay = roundCost(
    contributions.reduce((max, contribution) => Math.max(max, Number(contribution.totals?.cost ?? 0)), 0)
  )

  correctedGraph.summary = {
    ...correctedGraph.summary,
    totalTokens,
    totalCost,
    totalDays,
    activeDays,
    averagePerDay: activeDays > 0 ? roundCost(totalCost / activeDays) : 0,
    maxCostInSingleDay,
  }

  correctedGraph.years = (correctedGraph.years ?? []).map(year => {
    const yearContributions = contributions.filter(contribution => contribution.date?.startsWith(`${year.year}-`))
    return {
      ...year,
      totalTokens: yearContributions.reduce((sum, contribution) => sum + Number(contribution.totals?.tokens ?? 0), 0),
      totalCost: roundCost(yearContributions.reduce((sum, contribution) => sum + Number(contribution.totals?.cost ?? 0), 0)),
    }
  })

  correctedGraph.meta = {
    ...correctedGraph.meta,
    localCostCorrection: {
      appliedAt: new Date().toISOString(),
      affectedEntries,
      affectedDays: affectedDays.size,
      correctedModels: [...correctedModels].sort(),
      totalDelta,
    },
  }

  return {
    graph: correctedGraph,
    summary: correctedGraph.meta.localCostCorrection,
  }
}

export function deriveModelsDataFromGraph(graph) {
  const byKey = new Map()

  for (const contribution of graph?.contributions ?? []) {
    for (const client of contribution.clients ?? []) {
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
        existing.cost += Number(client.cost ?? 0)
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
        cost: Number(client.cost ?? 0),
      })
    }
  }

  const entries = [...byKey.values()]
    .map(({ providers, ...entry }) => ({
      ...entry,
      provider: [...providers].sort().join(', '),
      cost: roundCost(entry.cost),
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
    totalCost: roundCost(entries.reduce((sum, entry) => sum + entry.cost, 0)),
    processingTimeMs: 0,
  }
}

export function deriveMonthlyDataFromGraph(graph) {
  const byMonth = new Map()

  for (const contribution of graph?.contributions ?? []) {
    const month = String(contribution.date ?? '').slice(0, 7)
    const existing = byMonth.get(month) ?? {
      models: new Set(),
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
    existing.cost += Number(contribution.totals.cost ?? 0)
    for (const client of contribution.clients ?? []) {
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
      cost: roundCost(entry.cost),
    }))

  return {
    entries,
    totalCost: roundCost(entries.reduce((sum, entry) => sum + entry.cost, 0)),
    processingTimeMs: 0,
  }
}

export function deriveMetaFromGraph(graph) {
  return {
    updatedAt: graph?.meta?.generatedAt ?? '',
  }
}

export function modelsToCsv(modelsData) {
  const escapeCell = value => {
    const text = String(value ?? '')
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`
    }
    return text
  }

  const lines = [
    [
      'Source', 'Model', 'Provider', 'Input Tokens', 'Output Tokens',
      'Cache Read', 'Cache Write', 'Reasoning', 'Messages', 'Cost ($)',
    ].join(','),
  ]

  for (const entry of modelsData.entries ?? []) {
    lines.push([
      entry.client,
      entry.model,
      entry.provider,
      entry.input,
      entry.output,
      entry.cacheRead,
      entry.cacheWrite,
      entry.reasoning,
      entry.messageCount,
      entry.cost.toFixed(4),
    ].map(escapeCell).join(','))
  }

  return `${lines.join('\n')}\n`
}
