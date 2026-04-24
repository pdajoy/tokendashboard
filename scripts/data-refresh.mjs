import path from 'node:path'
import fsp from 'node:fs/promises'
import { spawn } from 'node:child_process'
import {
  applyLocalCostCorrectionsToGraph,
  readJson,
  writeJson,
} from './data-utils.mjs'
import {
  loadPricingDatasets,
  resolveModelPricing,
  LOCAL_PRICING_OVERRIDES,
} from './pricing-resolver.mjs'

const PRICING_SOURCE_LABEL = 'tokscale graph + LiteLLM + OpenRouter + Cursor official rates'
const PRICING_NOTE =
  'Prices in USD per 1M tokens. LiteLLM is the primary upstream source; OpenRouter fills in remaining model ids. Cursor fast-mode multipliers (2x GPT, 6x Claude Opus) are applied locally and the matching graph costs are corrected during refresh.'

const SKIP_MODELS = new Set(['<synthetic>'])
const SKIP_PROVIDERS = new Set(['cursor'])

export const DEFAULT_TOKSCALE_SETTINGS = {
  runner: 'bunx',
  spec: 'tokscale@latest',
  extraArgs: [],
}

function asLogger(log) {
  if (!log) return () => {}
  if (typeof log === 'function') return log
  return message => log.write(`${message}\n`)
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true })
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath)
    return true
  } catch {
    return false
  }
}

function buildTokscaleCommand(settings, args) {
  const runner = settings?.runner || DEFAULT_TOKSCALE_SETTINGS.runner
  const spec = settings?.spec || DEFAULT_TOKSCALE_SETTINGS.spec
  const extra = Array.isArray(settings?.extraArgs) ? settings.extraArgs : []
  return { runner, runnerArgs: [spec, ...extra, ...args] }
}

function spawnTokscale(settings, args, { onData } = {}) {
  const { runner, runnerArgs } = buildTokscaleCommand(settings, args)

  return new Promise((resolve, reject) => {
    const child = spawn(runner, runnerArgs, {
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      const text = String(chunk)
      stdout += text
      onData?.(text)
    })
    child.stderr.on('data', chunk => {
      const text = String(chunk)
      stderr += text
      onData?.(text)
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        const reason = [stderr, stdout].filter(Boolean).join('\n').trim()
        reject(new Error(reason || `${runner} exited with ${code}`))
      }
    })
  })
}

function mergeProvider(existing, incoming) {
  if (SKIP_PROVIDERS.has(existing) && !SKIP_PROVIDERS.has(incoming)) {
    return incoming
  }
  return existing || incoming
}

async function collectModelsFromGraph(graphPath) {
  const graphData = await readJson(graphPath)
  const modelProviders = new Map()

  for (const contribution of graphData.contributions ?? []) {
    for (const client of contribution.clients ?? []) {
      const model = client.modelId
      const provider = client.providerId ?? ''
      if (!model) continue
      modelProviders.set(model, mergeProvider(modelProviders.get(model) ?? '', provider))
    }
  }

  return modelProviders
}

export async function refreshGraph({ dataDir, settings, log } = {}) {
  const logger = asLogger(log)
  await ensureDir(dataDir)
  const graphPath = path.join(dataDir, 'graph.json')

  logger('==> Fetching graph/contributions data via tokscale...')

  await spawnTokscale(settings, ['graph', '--no-spinner', '--output', graphPath], {
    onData: chunk => logger(chunk.replace(/\s+$/, '')),
  })

  logger(`    Wrote ${graphPath}`)
  return { graphPath }
}

export async function refreshPricing({ dataDir, log } = {}) {
  const logger = asLogger(log)
  await ensureDir(dataDir)
  const graphPath = path.join(dataDir, 'graph.json')
  const pricingPath = path.join(dataDir, 'pricing.json')

  if (!(await pathExists(graphPath))) {
    throw new Error(`Cannot refresh pricing: ${graphPath} not found. Refresh token data first.`)
  }

  const modelProviders = await collectModelsFromGraph(graphPath)

  const publicModels = [...modelProviders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([model, provider]) => {
      if (!model || SKIP_MODELS.has(model)) return false
      return !SKIP_PROVIDERS.has(provider)
    })
    .map(([model]) => model)

  const skippedModels = [...modelProviders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([model, provider]) => {
      if (!model || SKIP_MODELS.has(model)) return true
      return SKIP_PROVIDERS.has(provider)
    })
    .map(([model]) => model)

  logger(`==> Pricing sync for ${publicModels.length} public models`)
  if (skippedModels.length > 0) {
    logger(`    Skipping platform-internal models: ${skippedModels.join(', ')}`)
  }

  const started = Date.now()
  const { litellm, openrouter } = await loadPricingDatasets(dataDir, { log: logger })
  logger(
    `    LiteLLM dataset ${litellm.fromCache ? 'loaded from cache' : 'fetched'} (${Object.keys(litellm.dataset).length} entries)` +
      (openrouter?.skipped
        ? ', OpenRouter unavailable'
        : ` + OpenRouter ${openrouter.fromCache ? 'cache' : 'fetched'} (${Object.keys(openrouter.dataset).length} entries)`) +
      ` in ${Date.now() - started}ms`
  )

  const pricingModels = {}
  const errors = []
  let refreshed = 0
  let failed = 0

  for (const model of publicModels) {
    try {
      const entry = resolveModelPricing(model, { litellm, openrouter })
      if (!entry) {
        errors.push(model)
        failed += 1
        logger(`    [warn] ${model}: no match in LiteLLM/OpenRouter/Cursor tables`)
        continue
      }
      pricingModels[model] = entry
      refreshed += 1
      logger(`    [ok] ${model} -> ${entry.matchedKey} (${entry.source})`)
    } catch (error) {
      errors.push(model)
      failed += 1
      const msg = error instanceof Error ? error.message : String(error)
      logger(`    [warn] ${model}: ${msg}`)
    }
  }

  await writeJson(pricingPath, {
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    source: PRICING_SOURCE_LABEL,
    note: PRICING_NOTE,
    errors: [...new Set(errors)].sort(),
    models: Object.fromEntries(
      Object.keys(pricingModels).sort().map(key => [key, pricingModels[key]])
    ),
  })

  logger(`==> Pricing sync complete: ${pricingPath} (${refreshed} ok, ${failed} failed)`)
  return { pricingPath, refreshed, failed, total: publicModels.length }
}

export async function applyCostCorrections({ dataDir, log } = {}) {
  const logger = asLogger(log)
  await ensureDir(dataDir)
  const graphPath = path.join(dataDir, 'graph.json')
  const pricingPath = path.join(dataDir, 'pricing.json')

  if (!(await pathExists(graphPath))) {
    throw new Error(`Cannot correct graph costs: ${graphPath} not found.`)
  }
  if (!(await pathExists(pricingPath))) {
    logger('    Skipping cost correction: no pricing.json yet')
    return { skipped: true }
  }

  const graph = await readJson(graphPath)
  const pricing = await readJson(pricingPath)
  const { graph: correctedGraph, summary } = applyLocalCostCorrectionsToGraph(graph, pricing)

  await writeJson(graphPath, correctedGraph)

  const correctedModels = summary.correctedModels.length > 0 ? summary.correctedModels.join(', ') : 'none'
  logger('==> Local graph cost correction complete')
  logger(`    Corrected models: ${correctedModels}`)
  logger(`    Affected entries: ${summary.affectedEntries}`)
  logger(`    Affected days: ${summary.affectedDays}`)
  logger(`    Total delta: ${summary.totalDelta}`)

  return summary
}

export async function refreshAll({ dataDir, settings, log } = {}) {
  const logger = asLogger(log)
  logger('==> Refreshing everything...')
  await refreshGraph({ dataDir, settings, log })
  await refreshPricing({ dataDir, log })
  await applyCostCorrections({ dataDir, log })
  logger('==> All data refreshed')
}

export async function runRefreshTarget(target, options) {
  switch (target) {
    case 'graph':
    case 'tokens':
      await refreshGraph(options)
      await applyCostCorrections(options)
      return
    case 'pricing':
      await refreshPricing(options)
      await applyCostCorrections(options)
      return
    case 'all':
    default:
      await refreshAll(options)
  }
}

export { LOCAL_PRICING_OVERRIDES }
