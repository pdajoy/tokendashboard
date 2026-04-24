#!/usr/bin/env node

import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  deriveMetaFromGraph,
  deriveModelsDataFromGraph,
  deriveMonthlyDataFromGraph,
  modelsToCsv,
  readJson,
} from './data-utils.mjs'
import { runRefreshTarget } from './data-refresh.mjs'
import { loadSettings, saveSettings } from './settings.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const scriptsDir = __dirname
const projectDir = path.dirname(scriptsDir)
const isPublishedInstall = scriptsDir.split(path.sep).includes('node_modules')
const apiOnly = process.env.API_ONLY === '1'

function defaultDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR
  if (isPublishedInstall) {
    return path.join(os.homedir(), '.tokscale-dashboard', 'data')
  }
  return path.join(projectDir, 'data')
}

function defaultFrontendDir() {
  if (process.env.FRONTEND_DIR) return process.env.FRONTEND_DIR
  return path.join(projectDir, 'frontend', 'dist')
}

const dataDir = defaultDataDir()
const frontendDir = defaultFrontendDir()

let refreshInProgress = false
let refreshLog = []

function parsePort() {
  const argv = process.argv.slice(2)
  const portIndex = argv.findIndex(arg => arg === '--port')
  if (portIndex >= 0 && argv[portIndex + 1]) return argv[portIndex + 1]
  return process.env.PORT || '8787'
}

const port = parsePort()

function printHelp() {
  console.log(`Tokscale Dashboard

Usage:
  tokscale-dashboard [--port 8787]
  npx tokscale-dashboard
  bunx tokscale-dashboard

Options:
  --port <number>   HTTP port (default: 8787)
  --help, -h        Show this help

Environment:
  PORT              HTTP port (default: 8787)
  DATA_DIR          Data directory (default: ${defaultDataDir()})
  FRONTEND_DIR      Built frontend directory (default: ${defaultFrontendDir()})
  API_ONLY          Set to 1 to serve API only (for Vite dev mode)
`)
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function newestMtime(targetPath) {
  const stat = await fsp.stat(targetPath)
  if (!stat.isDirectory()) return stat.mtimeMs

  let latest = stat.mtimeMs
  for (const entry of await fsp.readdir(targetPath, { withFileTypes: true })) {
    const childPath = path.join(targetPath, entry.name)
    const childLatest = await newestMtime(childPath)
    if (childLatest > latest) latest = childLatest
  }
  return latest
}

async function frontendNeedsBuild() {
  const distIndexPath = path.join(frontendDir, 'index.html')
  if (!(await pathExists(distIndexPath))) return true

  const distMtime = (await fsp.stat(distIndexPath)).mtimeMs
  const watchedPaths = [
    path.join(projectDir, 'frontend', 'index.html'),
    path.join(projectDir, 'frontend', 'package.json'),
    path.join(projectDir, 'frontend', 'vite.config.ts'),
    path.join(projectDir, 'frontend', 'src'),
  ]

  for (const watchedPath of watchedPaths) {
    if (!(await pathExists(watchedPath))) continue
    if ((await newestMtime(watchedPath)) > distMtime) return true
  }

  return false
}

function commandFailed(result, label) {
  if (result.status === 0) return
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  throw new Error(`${label} failed${output ? `\n${output}` : ''}`)
}

async function ensureFrontendBuilt() {
  if (apiOnly) return
  if (isPublishedInstall) {
    // When installed via npm, the dist must have been bundled in the package.
    // If it's missing we surface a friendly error.
    if (!(await pathExists(path.join(frontendDir, 'index.html')))) {
      throw new Error(`Published frontend assets missing at ${frontendDir}. Reinstall the package.`)
    }
    return
  }

  if (!(await frontendNeedsBuild())) return

  console.log('==> Building React frontend...')
  commandFailed(
    spawnSync('npm', ['--prefix', path.join(projectDir, 'frontend'), 'install'], {
      cwd: projectDir,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    }),
    'npm install'
  )
  commandFailed(
    spawnSync('npm', ['--prefix', path.join(projectDir, 'frontend'), 'run', 'build'], {
      cwd: projectDir,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    }),
    'npm run build'
  )
}

async function ensureDataPresent() {
  if (await pathExists(path.join(dataDir, 'graph.json'))) return

  console.log('==> Collecting initial data...')
  const settings = await loadSettings(dataDir)
  try {
    await runRefreshTarget('all', {
      dataDir,
      settings: settings.tokscale,
      log: line => console.log(line),
    })
  } catch (error) {
    console.warn('==> Initial data collection failed:', error instanceof Error ? error.message : String(error))
    console.warn('    Open the dashboard and use Settings → Refresh to retry.')
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res, statusCode, payload) {
  setCors(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(`${JSON.stringify(payload)}\n`)
}

function sendText(res, statusCode, contentType, payload) {
  res.writeHead(statusCode, { 'Content-Type': `${contentType}; charset=utf-8` })
  res.end(payload)
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html'
    case '.js': return 'application/javascript'
    case '.css': return 'text/css'
    case '.json': return 'application/json'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.ico': return 'image/x-icon'
    case '.map': return 'application/json'
    default: return 'application/octet-stream'
  }
}

async function loadGraph() {
  return readJson(path.join(dataDir, 'graph.json'))
}

async function loadPricing() {
  return readJson(path.join(dataDir, 'pricing.json'))
}

async function readRequestJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

async function serveStatic(req, res) {
  if (apiOnly) {
    sendText(res, 404, 'text/plain', 'API-only mode: static frontend is served by Vite dev server.\n')
    return
  }

  if (!(await pathExists(frontendDir))) {
    sendText(
      res,
      200,
      'text/html',
      `<html><body><h1>Tokscale Dashboard API</h1>
<p>Frontend not built yet. Run <code>npm --prefix "${path.join(projectDir, 'frontend')}" run build</code></p>
<ul>
<li><a href="/api/health">/api/health</a></li>
<li><a href="/api/models">/api/models</a></li>
<li><a href="/api/monthly">/api/monthly</a></li>
<li><a href="/api/graph">/api/graph</a></li>
<li><a href="/api/pricing">/api/pricing</a></li>
<li><a href="/api/export/csv">/api/export/csv</a></li>
</ul></body></html>`
    )
    return
  }

  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname)
  const requestedPath = urlPath === '/' ? '/index.html' : urlPath
  const resolvedPath = path.join(frontendDir, requestedPath)

  try {
    const stat = await fsp.stat(resolvedPath)
    if (stat.isDirectory()) {
      const indexPath = path.join(resolvedPath, 'index.html')
      const content = await fsp.readFile(indexPath)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(content)
      return
    }

    const content = await fsp.readFile(resolvedPath)
    res.writeHead(200, { 'Content-Type': getMimeType(resolvedPath) })
    res.end(content)
  } catch {
    const indexPath = path.join(frontendDir, 'index.html')
    const content = await fsp.readFile(indexPath)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(content)
  }
}

async function handleSettings(req, res) {
  if (req.method === 'GET') {
    const settings = await loadSettings(dataDir)
    sendJson(res, 200, { settings })
    return
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await readRequestJson(req)
    try {
      const saved = await saveSettings(dataDir, body?.settings ?? body)
      sendJson(res, 200, { success: true, settings: saved })
    } catch (error) {
      sendJson(res, 400, { success: false, message: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  sendJson(res, 405, { success: false, message: 'Method not allowed' })
}

async function handleRefresh(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' })
    return
  }

  if (refreshInProgress) {
    sendJson(res, 200, { success: false, message: 'Refresh already in progress' })
    return
  }

  const body = await readRequestJson(req).catch(() => ({}))
  const rawTarget = typeof body?.target === 'string' ? body.target.toLowerCase() : 'all'
  const target = ['all', 'graph', 'tokens', 'pricing'].includes(rawTarget) ? rawTarget : 'all'

  refreshInProgress = true
  refreshLog = []
  const captureLog = line => {
    refreshLog.push(line)
    console.log(line)
  }

  try {
    const settings = await loadSettings(dataDir)
    await runRefreshTarget(target, {
      dataDir,
      settings: settings.tokscale,
      log: captureLog,
    })

    const graph = await loadGraph().catch(() => null)
    sendJson(res, 200, {
      success: true,
      message: `Data refreshed (${target})`,
      target,
      updatedAt: graph ? deriveMetaFromGraph(graph).updatedAt : null,
      log: refreshLog.join('\n'),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 500, {
      success: false,
      target,
      message: `Refresh failed: ${message}`,
      log: refreshLog.join('\n'),
    })
  } finally {
    refreshInProgress = false
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    setCors(res)
    res.writeHead(200)
    res.end()
    return
  }

  try {
    if (pathname === '/api/graph') {
      sendJson(res, 200, await loadGraph())
      return
    }

    if (pathname === '/api/pricing') {
      sendJson(res, 200, await loadPricing())
      return
    }

    if (pathname === '/api/models') {
      sendJson(res, 200, deriveModelsDataFromGraph(await loadGraph()))
      return
    }

    if (pathname === '/api/monthly') {
      sendJson(res, 200, deriveMonthlyDataFromGraph(await loadGraph()))
      return
    }

    if (pathname === '/api/meta') {
      sendJson(res, 200, deriveMetaFromGraph(await loadGraph()))
      return
    }

    if (pathname === '/api/export/csv') {
      const graph = await loadGraph()
      const csv = modelsToCsv(deriveModelsDataFromGraph(graph))
      setCors(res)
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=tokscale-usage.csv',
      })
      res.end(csv)
      return
    }

    if (pathname === '/api/settings') {
      await handleSettings(req, res)
      return
    }

    if (pathname === '/api/refresh') {
      await handleRefresh(req, res)
      return
    }

    if (pathname === '/api/health') {
      const files = {}
      let healthy = true

      for (const file of [
        { name: 'graph.json', required: true },
        { name: 'pricing.json', required: false },
        { name: 'settings.json', required: false },
      ]) {
        const filePath = path.join(dataDir, file.name)
        try {
          const stat = await fsp.stat(filePath)
          files[file.name] = {
            exists: true,
            required: file.required,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          }
        } catch {
          files[file.name] = { exists: false, required: file.required }
          if (file.required) healthy = false
        }
      }

      sendJson(res, 200, {
        healthy,
        dataDir,
        files,
        platform: `${process.platform}/${process.arch}`,
      })
      return
    }

    sendJson(res, 404, { success: false, message: 'Not found' })
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp()
    return
  }

  await fsp.mkdir(dataDir, { recursive: true })
  await ensureFrontendBuilt()
  await ensureDataPresent()

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      sendJson(res, 400, { success: false, message: 'Missing URL' })
      return
    }

    if (req.url.startsWith('/api/')) {
      await handleApi(req, res)
      return
    }

    await serveStatic(req, res)
  })

  server.listen(Number(port), () => {
    const suffix = apiOnly ? ' (API-only)' : ''
    console.log(`==> Tokscale Dashboard${suffix} listening on http://localhost:${port}`)
    console.log(`    Data directory: ${dataDir}`)
    if (!apiOnly) console.log(`    Frontend directory: ${frontendDir}`)
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => process.exit(0))
    })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
