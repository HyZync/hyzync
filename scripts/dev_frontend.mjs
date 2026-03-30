import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontendPort = Number(process.env.VITE_PORT || process.env.DEV_FRONTEND_PORT || '5173')
const preferredHost = process.env.DEV_FRONTEND_HOST || process.env.DEV_FRONTEND_PROBE_HOST || 'localhost'
const viteHost = preferredHost
const backendPort = Number(process.env.VITE_BACKEND_PORT || process.env.DEV_BACKEND_PORT || '8000')
const backendTarget = process.env.VITE_BACKEND_TARGET || `http://127.0.0.1:${backendPort}`
const waitForBackend = (process.env.DEV_FRONTEND_WAIT_FOR_BACKEND || 'true').toLowerCase() !== 'false'
const backendWaitTimeoutMs = Number(process.env.DEV_FRONTEND_BACKEND_TIMEOUT_MS || '20000')
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const reuseMarkers = ['Hyzync | AI-Powered Customer Intelligence', '/src/main.jsx']
const candidateHosts = Array.from(new Set([preferredHost, 'localhost', '127.0.0.1']))

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      resolve(false)
    })
  })
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        resolve(body)
      })
    })
    req.setTimeout(2000, () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', reject)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function backendIsHealthy() {
  try {
    const healthUrl = new URL('/api/health', backendTarget).toString()
    const body = await fetchText(healthUrl)
    return body.includes('"service"') && body.includes('hyzync-api')
  } catch {
    return false
  }
}

async function waitForLocalBackendReadiness() {
  if (!waitForBackend) {
    return
  }

  let targetUrl
  try {
    targetUrl = new URL(backendTarget)
  } catch {
    return
  }

  if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(targetUrl.hostname)) {
    return
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < backendWaitTimeoutMs) {
    if (await backendIsHealthy()) {
      return
    }
    await sleep(500)
  }

  console.warn(
    `[dev-frontend] Backend at ${backendTarget} did not report healthy within ` +
    `${backendWaitTimeoutMs}ms. Starting Vite anyway.`
  )
}

async function existingFrontendIsHyzync(host) {
  try {
    const html = await fetchText(`http://${host}:${frontendPort}/`)
    return reuseMarkers.every((marker) => html.includes(marker))
  } catch {
    return false
  }
}

async function holdReusedProcess(host) {
  console.log(
    `[dev-frontend] Reusing existing Hyzync frontend at http://${host}:${frontendPort}`
  )
  await new Promise((resolve) => {
    const stop = () => resolve()
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
  console.log('[dev-frontend] Reuse sentinel stopped.')
}

async function main() {
  await waitForLocalBackendReadiness()

  for (const host of candidateHosts) {
    if (!(await isPortOpen(host, frontendPort))) {
      continue
    }
    if (await existingFrontendIsHyzync(host)) {
      await holdReusedProcess(host)
      return
    }
    console.error(
      `[dev-frontend] Port ${frontendPort} is already in use on ${host} by a different process. ` +
      'Stop that process or set DEV_FRONTEND_PORT/VITE_PORT to another port.'
    )
    process.exitCode = 1
    return
  }

  const child = spawn(
    process.execPath,
    [viteBin, '--host', viteHost, '--port', String(frontendPort), '--strictPort'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    }
  )

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error('[dev-frontend] Failed to start frontend:', error)
  process.exit(1)
})
