#!/usr/bin/env node

import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.dirname(__dirname)
const frontendDir = path.join(projectDir, 'frontend')

function spawnChild(label, command, args, { cwd = projectDir, env = {} } = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const prefix = `[${label}]`
  child.stdout.on('data', chunk => process.stdout.write(`${prefix} ${chunk}`))
  child.stderr.on('data', chunk => process.stderr.write(`${prefix} ${chunk}`))

  return child
}

const apiPort = process.env.PORT || '8787'
const api = spawnChild(
  'api',
  process.execPath,
  [path.join(__dirname, 'server.mjs')],
  {
    env: {
      API_ONLY: '1',
      PORT: apiPort,
    },
  }
)

const viteBin = path.join(frontendDir, 'node_modules', '.bin', 'vite')
const frontend = spawnChild('web', viteBin, [], {
  cwd: frontendDir,
  env: { FORCE_COLOR: '1' },
})

function shutdown() {
  for (const child of [api, frontend]) {
    if (child && !child.killed) child.kill('SIGTERM')
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

for (const [name, child] of [['api', api], ['web', frontend]]) {
  child.on('close', code => {
    console.log(`[${name}] exited with code ${code}`)
    shutdown()
  })
}

console.log('')
console.log('  Dashboard (dev): http://localhost:5173')
console.log(`  API server:      http://localhost:${apiPort}`)
console.log('')
console.log('  Press Ctrl+C to stop')
console.log('')
