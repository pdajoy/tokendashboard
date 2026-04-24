import path from 'node:path'
import fsp from 'node:fs/promises'
import { DEFAULT_TOKSCALE_SETTINGS } from './data-refresh.mjs'

export const DEFAULT_SETTINGS = {
  tokscale: { ...DEFAULT_TOKSCALE_SETTINGS },
}

function settingsPathFor(dataDir) {
  return path.join(dataDir, 'settings.json')
}

function sanitizeExtraArgs(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function sanitizeRunner(value) {
  if (typeof value !== 'string') return DEFAULT_TOKSCALE_SETTINGS.runner
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_TOKSCALE_SETTINGS.runner
  if (!/^[a-zA-Z0-9._/-]+$/.test(trimmed)) {
    throw new Error(`Invalid runner name: ${value}`)
  }
  return trimmed
}

function sanitizeSpec(value) {
  if (typeof value !== 'string') return DEFAULT_TOKSCALE_SETTINGS.spec
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_TOKSCALE_SETTINGS.spec
  if (/\s/.test(trimmed)) {
    throw new Error(`Invalid tokscale spec (no whitespace allowed): ${value}`)
  }
  return trimmed
}

export function normalizeSettings(raw) {
  const tokscaleRaw = raw?.tokscale ?? {}
  return {
    tokscale: {
      runner: sanitizeRunner(tokscaleRaw.runner ?? DEFAULT_TOKSCALE_SETTINGS.runner),
      spec: sanitizeSpec(tokscaleRaw.spec ?? DEFAULT_TOKSCALE_SETTINGS.spec),
      extraArgs: sanitizeExtraArgs(tokscaleRaw.extraArgs ?? DEFAULT_TOKSCALE_SETTINGS.extraArgs),
    },
  }
}

export async function loadSettings(dataDir) {
  try {
    const content = await fsp.readFile(settingsPathFor(dataDir), 'utf8')
    return normalizeSettings(JSON.parse(content))
  } catch {
    return normalizeSettings({})
  }
}

export async function saveSettings(dataDir, settings) {
  const normalized = normalizeSettings(settings)
  await fsp.mkdir(dataDir, { recursive: true })
  await fsp.writeFile(
    settingsPathFor(dataDir),
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf8'
  )
  return normalized
}
