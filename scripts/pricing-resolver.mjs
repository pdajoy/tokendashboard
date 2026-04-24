import path from 'node:path'
import fsp from 'node:fs/promises'

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const LITELLM_CACHE_NAME = '.litellm-cache.json'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_CACHE_NAME = '.openrouter-cache.json'
const PRICING_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const EXCLUDED_LITELLM_PREFIXES = ['github_copilot/']

const KNOWN_PROVIDER_PREFIXES = [
  'openai/',
  'anthropic/',
  'google/',
  'x-ai/',
  'xai/',
  'meta-llama/',
  'mistralai/',
  'deepseek/',
  'qwen/',
  'cohere/',
  'perplexity/',
  'z-ai/',
  'moonshotai/',
]

// Cursor-specific pricing for models that LiteLLM has not yet catalogued. Values
// are USD per token. Mirrors tokscale-core::pricing::PricingService::build_cursor_overrides().
const CURSOR_OVERRIDES = {
  'gpt-5.3': { input: 1.75e-6, output: 1.4e-5, cacheRead: 1.75e-7 },
  'gpt-5.3-codex': { input: 1.75e-6, output: 1.4e-5, cacheRead: 1.75e-7 },
  'gpt-5.3-codex-spark': { input: 1.75e-6, output: 1.4e-5, cacheRead: 1.75e-7 },
  'composer-1': { input: 1.25e-6, output: 1e-5, cacheRead: 1.25e-7 },
  'composer-1.5': { input: 3.5e-6, output: 1.75e-5, cacheRead: 3.5e-7 },
  'composer-2': { input: 5e-7, output: 2.5e-6, cacheRead: 2e-7 },
  'composer-2-fast': { input: 1.5e-6, output: 7.5e-6, cacheRead: 3.5e-7 },
  'code-supernova': { input: 0, output: 0, cacheRead: 0 },
  'code-supernova-1-million': { input: 0, output: 0, cacheRead: 0 },
  'cursor-small': { input: 0, output: 0, cacheRead: 0 },
}

// Hardcoded baseline prices from Cursor's published API pricing table
// (https://cursor.com/docs/models-and-pricing). Used as an authoritative fallback
// so fast-mode variants get exactly the rates Cursor lists, not just a 2x estimate,
// and to cover a few Cursor-specific IDs (e.g. -1m context variants) that neither
// LiteLLM nor OpenRouter catalogue directly.
const CURSOR_PRICING_TABLE = {
  'claude-4-6-opus': { input: 5e-6, output: 2.5e-5, cacheRead: 5e-7, cacheWrite: 6.25e-6 },
  'claude-4-6-opus-fast': { input: 3e-5, output: 1.5e-4, cacheRead: 3e-6, cacheWrite: 3.75e-5 },
  'claude-4-6-sonnet': { input: 3e-6, output: 1.5e-5, cacheRead: 3e-7, cacheWrite: 3.75e-6 },
  'claude-4-7-opus': { input: 5e-6, output: 2.5e-5, cacheRead: 5e-7, cacheWrite: 6.25e-6 },
  // `-1m` denotes Cursor's 1M-context tier; Anthropic charges 2x base rates above 200k.
  'claude-4-sonnet-1m': { input: 6e-6, output: 2.25e-5, cacheRead: 6e-7, cacheWrite: 7.5e-6 },
  'gpt-5-fast': { input: 2.5e-6, output: 2e-5, cacheRead: 2.5e-7 },
}

const LOCAL_OVERRIDE_LABEL = 'Local Override'

// Manual patches for models where we always want local control (claude-opus-4-7 variants).
export const LOCAL_PRICING_OVERRIDES = {
  'claude-opus-4-7': {
    matchedKey: 'claude-opus-4-7',
    source: LOCAL_OVERRIDE_LABEL,
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    cacheWritePer1M: 6.25,
  },
  'claude-opus-4-7-thinking-high': {
    matchedKey: 'claude-opus-4-7',
    source: LOCAL_OVERRIDE_LABEL,
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    cacheWritePer1M: 6.25,
  },
  'claude-opus-4-7-thinking-max': {
    matchedKey: 'claude-opus-4-7',
    source: LOCAL_OVERRIDE_LABEL,
    inputPer1M: 5,
    outputPer1M: 25,
    cacheReadPer1M: 0.5,
    cacheWritePer1M: 6.25,
  },
}

// Cursor's "fast" priority tier multipliers (https://cursor.com/docs/models-and-pricing).
// Applied on top of the base-model lookup so reasoning-effort variants like
// gpt-5.4-xhigh-fast still receive the 2x (or 6x for Claude Opus) adjustment.
const FAST_MULTIPLIER_RULES = [
  { pattern: /^claude-[0-9]+(?:[-.][0-9]+)?-opus(?:-.*)?-fast$/, multiplier: 6 },
  { pattern: /^claude-opus-[0-9]+(?:[-.][0-9]+)?(?:-.*)?-fast$/, multiplier: 6 },
  { pattern: /^gpt-5(?:[-.].*)?-fast$/, multiplier: 2 },
]

// Reasoning-effort / modifier suffixes that do not alter per-token pricing.
// Only the trailing segment is compared; lookup never blindly strips arbitrary tokens.
const STRIPPABLE_SUFFIXES = new Set([
  'high',
  'low',
  'medium',
  'xhigh',
  'minimal',
  'none',
  'thinking',
  'max',
  'preview',
  'exp',
])

async function pathExists(target) {
  try {
    await fsp.access(target)
    return true
  } catch {
    return false
  }
}

async function readJsonSafe(target) {
  try {
    const content = await fsp.readFile(target, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function filterLitellmDataset(raw) {
  const filtered = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key === 'sample_spec') continue
    if (!value || typeof value !== 'object') continue
    const lower = key.toLowerCase()
    if (EXCLUDED_LITELLM_PREFIXES.some(prefix => lower.startsWith(prefix))) continue
    if (value.input_cost_per_token == null && value.output_cost_per_token == null) continue
    filtered[key] = value
  }
  return filtered
}

// For a dataset, build a secondary map that lets us locate models whose upstream
// key carries a trailing date suffix (e.g. `claude-4-sonnet-20250514`) by their
// bare base id. The map only records date-looking tails so we never collapse
// semantically distinct models (like `claude-sonnet-4` vs `claude-sonnet-4-5`).
function buildDatedSuffixMap(index) {
  const map = new Map()
  for (const [lowerKey, originalKey] of index) {
    const slashIndex = lowerKey.indexOf('/')
    const prefix = slashIndex > 0 ? lowerKey.slice(0, slashIndex + 1) : ''
    const body = slashIndex > 0 ? lowerKey.slice(slashIndex + 1) : lowerKey
    // Match either `-YYYYMMDD`, `-YYYY-MM-DD`, `-MM-DD`, or `@YYYYMMDD` trailing segments.
    const match = body.match(/^(.+?)(?:[-@](?:\d{8}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}))(?:[-@][\w-]*)?$/)
    if (!match) continue
    const base = match[1]
    if (base.length < 3) continue
    const baseLower = prefix + base
    if (!map.has(baseLower) || originalKey.length < map.get(baseLower).length) {
      map.set(baseLower, originalKey)
    }
    if (prefix && (!map.has(base) || originalKey.length < (map.get(base) ?? '').length)) {
      map.set(base, originalKey)
    }
  }
  return map
}

function buildLookupIndex(dataset) {
  const lowerToKey = new Map()
  for (const key of Object.keys(dataset)) {
    lowerToKey.set(key.toLowerCase(), key)
  }
  return lowerToKey
}

async function readCachedDataset(cachePath) {
  if (!(await pathExists(cachePath))) return null
  try {
    const stat = await fsp.stat(cachePath)
    if (Date.now() - stat.mtimeMs >= PRICING_CACHE_TTL_MS) return null
    const cached = await readJsonSafe(cachePath)
    if (!cached || typeof cached !== 'object') return null
    return cached
  } catch {
    return null
  }
}

async function readStaleDataset(cachePath) {
  if (!(await pathExists(cachePath))) return null
  return readJsonSafe(cachePath)
}

async function persistDataset(cachePath, dataset, { logger } = {}) {
  try {
    await fsp.writeFile(cachePath, `${JSON.stringify(dataset)}\n`, 'utf8')
  } catch (error) {
    logger?.(`    [warn] Could not persist cache to ${cachePath}: ${error.message}`)
  }
}

export async function loadLitellmDataset(cacheDir, { log } = {}) {
  const logger = typeof log === 'function' ? log : () => {}
  const cachePath = cacheDir ? path.join(cacheDir, LITELLM_CACHE_NAME) : null

  if (cachePath) {
    const cached = await readCachedDataset(cachePath)
    if (cached) {
      const index = buildLookupIndex(cached)
      return { dataset: cached, index, datedIndex: buildDatedSuffixMap(index), fromCache: true }
    }
  }

  logger('    Fetching LiteLLM pricing dataset (single HTTP request)...')
  let dataset = null
  try {
    const res = await fetch(LITELLM_URL, {
      headers: { 'User-Agent': 'tokscale-dashboard' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    const raw = await res.json()
    dataset = filterLitellmDataset(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger(`    [warn] LiteLLM fetch failed: ${message}`)

    if (cachePath) {
      const stale = await readStaleDataset(cachePath)
      if (stale) {
        logger('    [warn] Reusing stale LiteLLM cache')
        const index = buildLookupIndex(stale)
        return { dataset: stale, index, datedIndex: buildDatedSuffixMap(index), fromCache: true }
      }
    }

    throw new Error(`Failed to load LiteLLM pricing: ${message}`)
  }

  if (cachePath) await persistDataset(cachePath, dataset, { logger })

  const index = buildLookupIndex(dataset)
  return { dataset, index, datedIndex: buildDatedSuffixMap(index), fromCache: false }
}

function parsePriceString(value) {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value).trim())
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

function filterOpenRouterDataset(raw) {
  const filtered = {}
  const list = Array.isArray(raw?.data) ? raw.data : []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const id = typeof item.id === 'string' ? item.id : null
    if (!id) continue
    const promptCost = parsePriceString(item.pricing?.prompt)
    const completionCost = parsePriceString(item.pricing?.completion)
    if (promptCost == null && completionCost == null) continue
    filtered[id] = {
      input_cost_per_token: promptCost,
      output_cost_per_token: completionCost,
      cache_read_input_token_cost: parsePriceString(item.pricing?.input_cache_read),
      cache_creation_input_token_cost: parsePriceString(item.pricing?.input_cache_write),
    }
  }
  return filtered
}

export async function loadOpenRouterDataset(cacheDir, { log } = {}) {
  const logger = typeof log === 'function' ? log : () => {}
  const cachePath = cacheDir ? path.join(cacheDir, OPENROUTER_CACHE_NAME) : null

  if (cachePath) {
    const cached = await readCachedDataset(cachePath)
    if (cached) {
      const index = buildLookupIndex(cached)
      return { dataset: cached, index, datedIndex: buildDatedSuffixMap(index), fromCache: true }
    }
  }

  logger('    Fetching OpenRouter pricing dataset (single HTTP request)...')
  let dataset = null
  try {
    const res = await fetch(OPENROUTER_URL, {
      headers: {
        'User-Agent': 'tokscale-dashboard',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    const raw = await res.json()
    dataset = filterOpenRouterDataset(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger(`    [warn] OpenRouter fetch failed: ${message}`)

    if (cachePath) {
      const stale = await readStaleDataset(cachePath)
      if (stale) {
        logger('    [warn] Reusing stale OpenRouter cache')
        const index = buildLookupIndex(stale)
        return { dataset: stale, index, datedIndex: buildDatedSuffixMap(index), fromCache: true }
      }
    }

    // OpenRouter miss is non-fatal — LiteLLM still provides most models.
    return { dataset: {}, index: new Map(), datedIndex: new Map(), fromCache: false, skipped: true }
  }

  if (cachePath) await persistDataset(cachePath, dataset, { logger })

  const index = buildLookupIndex(dataset)
  return { dataset, index, datedIndex: buildDatedSuffixMap(index), fromCache: false }
}

export async function loadPricingDatasets(cacheDir, { log } = {}) {
  const [litellm, openrouter] = await Promise.all([
    loadLitellmDataset(cacheDir, { log }),
    loadOpenRouterDataset(cacheDir, { log }),
  ])
  return { litellm, openrouter }
}

function normalizeVersionSeparator(modelId) {
  // Turn "gpt-5-4" style names into "gpt-5.4" for LiteLLM matching when the
  // current id does not already contain a dotted version number.
  if (modelId.includes('.')) return null
  const match = modelId.match(/^([a-z]+(?:-[a-z]+)*)-(\d+)-(\d+)(?=$|-)/)
  if (!match) return null
  const [full, family, major, minor] = match
  return `${family}-${major}.${minor}${modelId.slice(full.length)}`
}

function swapClaudeVariantOrder(modelId) {
  // Cursor labels Claude models as "claude-<major>-<minor>-<family>[...]" while LiteLLM
  // uses "claude-<family>-<major>-<minor>[...]". Emit both variants so the lookup can match
  // regardless of which ordering the upstream dataset uses.
  const match = modelId.match(/^claude-(\d+)-(\d+)-(opus|sonnet|haiku)(.*)$/)
  if (match) {
    const [, major, minor, family, rest] = match
    return `claude-${family}-${major}-${minor}${rest}`
  }
  const reverse = modelId.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)(.*)$/)
  if (reverse) {
    const [, family, major, minor, rest] = reverse
    return `claude-${major}-${minor}-${family}${rest}`
  }
  return null
}

const GENERATE_PREVIEW_PATTERNS = [/^gemini-\d+(?:\.\d+)?(?:-[a-z]+){0,2}$/]

function withPreviewSuffix(modelId) {
  // LiteLLM frequently catalogues Gemini models under "-preview" until the model
  // leaves preview. If the bare name misses, try appending "-preview" to recover.
  if (!GENERATE_PREVIEW_PATTERNS.some(rx => rx.test(modelId))) return null
  if (modelId.endsWith('-preview')) return null
  return `${modelId}-preview`
}

// Explicit Cursor-to-upstream aliases for a handful of model ids whose natural
// upstream keys carry a non-date trailing segment (e.g. `-terminus`) that the
// heuristic matchers cannot infer. Keys are lowercase Cursor ids; values are
// upstream keys that MUST already exist in the LiteLLM or OpenRouter datasets.
const EXPLICIT_UPSTREAM_ALIASES = {
  'deepseek-v3.1': 'deepseek/deepseek-v3.1-terminus',
  'qwen3.5-plus': 'qwen/qwen3.5-plus-02-15',
}

function lookupExplicitAlias(modelId, datasets) {
  const alias = EXPLICIT_UPSTREAM_ALIASES[modelId.toLowerCase()]
  if (!alias) return null
  const lower = alias.toLowerCase()
  const litellm = datasets?.litellm
  if (litellm?.index) {
    const key = litellm.index.get(lower)
    if (key) return { key, record: litellm.dataset[key], source: 'LiteLLM' }
  }
  const openrouter = datasets?.openrouter
  if (openrouter?.index) {
    const key = openrouter.index.get(lower)
    if (key) return { key, record: openrouter.dataset[key], source: 'OpenRouter' }
  }
  return null
}

function tryLookup(lowerId, index, datedIndex) {
  const direct = index.get(lowerId)
  if (direct) return direct
  for (const prefix of KNOWN_PROVIDER_PREFIXES) {
    const prefixed = prefix + lowerId
    const candidate = index.get(prefixed)
    if (candidate) return candidate
  }
  if (datedIndex) {
    const dated = datedIndex.get(lowerId)
    if (dated) return dated
    for (const prefix of KNOWN_PROVIDER_PREFIXES) {
      const datedPrefixed = datedIndex.get(prefix + lowerId)
      if (datedPrefixed) return datedPrefixed
    }
  }
  return null
}

function lookupVariants(modelId) {
  const variants = [modelId]
  const normalized = normalizeVersionSeparator(modelId)
  if (normalized) variants.push(normalized)

  const claudeSwap = swapClaudeVariantOrder(modelId)
  if (claudeSwap) {
    variants.push(claudeSwap)
    const claudeSwapNorm = normalizeVersionSeparator(claudeSwap)
    if (claudeSwapNorm) variants.push(claudeSwapNorm)
  }

  const preview = withPreviewSuffix(modelId)
  if (preview) variants.push(preview)

  return variants
}

function lookupDataset(modelId, dataset, index, datedIndex) {
  const lower = modelId.toLowerCase()
  for (const variant of lookupVariants(lower)) {
    const key = tryLookup(variant, index, datedIndex)
    if (key) return { key, record: dataset[key] }
  }

  const segments = lower.split('-')
  let allowUnknownStrip = true
  for (let sliceEnd = segments.length - 1; sliceEnd >= 2; sliceEnd--) {
    const trailing = segments[sliceEnd]
    const isKnown = STRIPPABLE_SUFFIXES.has(trailing) || /^\d+$/.test(trailing)
    if (!isKnown) {
      if (!allowUnknownStrip) break
      allowUnknownStrip = false
    }
    const candidate = segments.slice(0, sliceEnd).join('-')
    if (candidate.length < 3) break

    for (const variant of lookupVariants(candidate)) {
      const key = tryLookup(variant, index, datedIndex)
      if (key) return { key, record: dataset[key] }
    }
  }

  return null
}

function perMillion(value) {
  if (value == null || !Number.isFinite(value)) return undefined
  return Math.round(value * 1_000_000 * 1_000_000) / 1_000_000
}

function toEntryFromRemote(matchedKey, record, sourceLabel) {
  const entry = {
    matchedKey,
    source: sourceLabel,
    inputPer1M: perMillion(record.input_cost_per_token),
    outputPer1M: perMillion(record.output_cost_per_token),
  }
  const cacheRead = perMillion(record.cache_read_input_token_cost)
  if (cacheRead != null) entry.cacheReadPer1M = cacheRead
  const cacheWrite = perMillion(record.cache_creation_input_token_cost)
  if (cacheWrite != null) entry.cacheWritePer1M = cacheWrite
  return entry
}

function toEntryFromLocalSource(matchedKey, record, sourceLabel) {
  const entry = {
    matchedKey,
    source: sourceLabel,
    inputPer1M: perMillion(record.input),
    outputPer1M: perMillion(record.output),
  }
  if (record.cacheRead != null) entry.cacheReadPer1M = perMillion(record.cacheRead)
  if (record.cacheWrite != null) entry.cacheWritePer1M = perMillion(record.cacheWrite)
  return entry
}

function lookupCursorOverrides(modelId) {
  const lower = modelId.toLowerCase()
  if (CURSOR_OVERRIDES[lower]) {
    return toEntryFromLocalSource(lower, CURSOR_OVERRIDES[lower], 'Cursor')
  }

  const segments = lower.split('-')
  for (let sliceEnd = segments.length - 1; sliceEnd >= 2; sliceEnd--) {
    const candidate = segments.slice(0, sliceEnd).join('-')
    if (CURSOR_OVERRIDES[candidate]) {
      return toEntryFromLocalSource(candidate, CURSOR_OVERRIDES[candidate], 'Cursor')
    }
  }
  return null
}

function lookupCursorOfficialTable(modelId) {
  const lower = modelId.toLowerCase()
  const record = CURSOR_PRICING_TABLE[lower]
  if (!record) return null
  return toEntryFromLocalSource(lower, record, LOCAL_OVERRIDE_LABEL)
}

export function detectFastMultiplier(modelId) {
  const lower = modelId.toLowerCase()
  if (!lower.endsWith('-fast')) {
    return { isFast: false, multiplier: 1, baseId: modelId }
  }
  for (const rule of FAST_MULTIPLIER_RULES) {
    if (rule.pattern.test(lower)) {
      return {
        isFast: true,
        multiplier: rule.multiplier,
        baseId: modelId.slice(0, -'-fast'.length),
      }
    }
  }
  return { isFast: false, multiplier: 1, baseId: modelId }
}

function applyMultiplierToEntry(entry, multiplier) {
  if (multiplier === 1) return entry
  const scale = value => (value == null ? value : Math.round(value * multiplier * 1_000_000) / 1_000_000)
  return {
    ...entry,
    inputPer1M: scale(entry.inputPer1M),
    outputPer1M: scale(entry.outputPer1M),
    ...(entry.cacheReadPer1M != null ? { cacheReadPer1M: scale(entry.cacheReadPer1M) } : {}),
    ...(entry.cacheWritePer1M != null ? { cacheWritePer1M: scale(entry.cacheWritePer1M) } : {}),
  }
}

function lookupBaseEntry(modelId, datasets) {
  const cursorOverride = lookupCursorOverrides(modelId)
  if (cursorOverride) return cursorOverride

  const cursorTable = lookupCursorOfficialTable(modelId)
  if (cursorTable) return cursorTable

  const explicit = lookupExplicitAlias(modelId, datasets)
  if (explicit) return toEntryFromRemote(explicit.key, explicit.record, explicit.source)

  const litellm = datasets?.litellm
  if (litellm?.dataset && litellm?.index) {
    const result = lookupDataset(modelId, litellm.dataset, litellm.index, litellm.datedIndex)
    if (result) return toEntryFromRemote(result.key, result.record, 'LiteLLM')
  }

  const openrouter = datasets?.openrouter
  if (openrouter?.dataset && openrouter?.index) {
    const result = lookupDataset(modelId, openrouter.dataset, openrouter.index, openrouter.datedIndex)
    if (result) return toEntryFromRemote(result.key, result.record, 'OpenRouter')
  }

  return null
}

// Accept either the unified `{ litellm, openrouter }` shape (preferred) or the
// legacy `{ dataset, index }` shape used by earlier tests/callers.
function normalizeDatasets(datasets) {
  if (!datasets) return {}
  if (datasets.litellm || datasets.openrouter) return datasets
  if (datasets.dataset && datasets.index) {
    return { litellm: datasets }
  }
  return {}
}

export function resolveModelPricing(modelId, datasets = {}) {
  const normalized = normalizeDatasets(datasets)

  if (LOCAL_PRICING_OVERRIDES[modelId]) {
    return { ...LOCAL_PRICING_OVERRIDES[modelId] }
  }

  const fast = detectFastMultiplier(modelId)

  // Prefer the explicit Cursor entry for this exact id so gpt-5-fast (and similar)
  // resolves to Cursor's listed $2.5/$20 rather than a computed multiple.
  if (fast.isFast) {
    const cursorExact = lookupCursorOfficialTable(modelId)
    if (cursorExact) {
      return { ...cursorExact, source: LOCAL_OVERRIDE_LABEL, matchedKey: modelId.toLowerCase() }
    }
  }

  const lookupId = fast.isFast ? fast.baseId : modelId
  const base = lookupBaseEntry(lookupId, normalized)
  if (!base) return null

  if (!fast.isFast) return base

  const scaled = applyMultiplierToEntry(base, fast.multiplier)
  return {
    ...scaled,
    matchedKey: base.matchedKey,
    source: LOCAL_OVERRIDE_LABEL,
  }
}

export function describeFastVariantRules() {
  return FAST_MULTIPLIER_RULES.map(rule => ({
    pattern: String(rule.pattern),
    multiplier: rule.multiplier,
  }))
}
