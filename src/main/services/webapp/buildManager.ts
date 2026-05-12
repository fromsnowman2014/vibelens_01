import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type { WebAppSession, ProjectConfig } from '@shared/types'
import { randomUUID } from 'crypto'
import { findFreePort } from './portAllocator'
import { prepareNodeRuntime, pathWithNodeBin } from './nodeRuntime'
import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import simpleGit from 'simple-git'

interface BuildSession {
  session: WebAppSession
  process: ChildProcess | null
  emitter: EventEmitter
  tempDir: string
}

// Active sessions map
const sessions = new Map<string, BuildSession>()

/**
 * Build and run a webapp from a specific commit
 * @param repoPath - Path to the repository
 * @param commitHash - Commit hash to build
 * @param config - Project configuration
 * @returns WebAppSession
 */
export async function buildAndRun(
  repoPath: string,
  commitHash: string,
  config: ProjectConfig
): Promise<WebAppSession> {
  // 1. Create temp directory (isolated environment)
  const tempDir = path.join(tmpdir(), 'vibelens-webapp', randomUUID())
  await fs.mkdir(tempDir, { recursive: true })

  // 2. Git worktree: checkout commit to temp directory (no impact on main repo)
  const git = simpleGit(repoPath)
  try {
    await git.raw(['worktree', 'add', tempDir, commitHash])
  } catch (error: any) {
    throw new Error(`Failed to create worktree: ${error.message}`)
  }

  // 3. Allocate port
  const port = await findFreePort(config.devPort || 3000)

  const sessionId = randomUUID()
  const session: WebAppSession = {
    sessionId,
    commitHash,
    repoPath,
    port,
    status: 'building',
    startedAt: Date.now()
  }

  const emitter = new EventEmitter()
  sessions.set(sessionId, {
    session,
    process: null,
    emitter,
    tempDir
  })

  // 4. Resolve working directory (handles monorepos where package.json lives in a subdir)
  const workDir = config.workingDir ? path.join(tempDir, config.workingDir) : tempDir
  console.log(
    `[buildManager] session=${sessionId.slice(0, 8)} commit=${commitHash.slice(0, 7)} type=${config.type} workingDir="${config.workingDir}" cwd=${workDir} port=${port}`
  )

  // 5. Start build process (async)
  startBuildProcess(sessionId, workDir, config, port, emitter).catch((error) => {
    const sessionData = sessions.get(sessionId)
    if (sessionData) {
      sessionData.session.status = 'error'
      emitter.emit('log', {
        level: 'error',
        message: `Build failed: ${error.message}`,
        source: 'build'
      })
    }
  })

  return session
}

/**
 * Start the build process for a session
 */
async function startBuildProcess(
  sessionId: string,
  workDir: string,
  config: ProjectConfig,
  port: number,
  emitter: EventEmitter
): Promise<void> {
  const sessionData = sessions.get(sessionId)
  if (!sessionData) return

  try {
    // 1. Companion backend warning (emitted before install so users see it early).
    if (config.companionBackend) {
      const cb = config.companionBackend
      const lines: string[] = [
        `This repo contains a ${cb.kind} backend alongside the frontend (signals: ${cb.signals.join(', ')}).`,
        `Vibelens only runs the frontend dev server — it does not start ${cb.kind} services because that would require installing a ${cb.kind} toolchain and the repo's dependencies on your machine, which vibelens cannot do safely without your consent (tracking issue: docs/ISOLATED_BUILD_STRATEGY.md).`,
        `Expect frontend API calls (e.g. /api/*) to return 404 until you start the backend yourself.`,
        `To run the backend:  ${cb.setupHint}`
      ]
      if (config.backendEnvHints.length > 0) {
        lines.push(
          `Once the backend is up, point the frontend at it by setting: ${config.backendEnvHints.join(', ')}  (e.g. NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1). Set the var in the environment that launches vibelens — the spawned dev server inherits it.`
        )
      }
      emitter.emit('warning', {
        type: 'companion-backend',
        message: lines.join('\n'),
        severity: 'warning'
      })
    }

    // 2. Resolve a pinned Node version (if the repo specifies one) and ensure
    //    it's downloaded to the managed cache. Falls through to system Node
    //    on any failure.
    const node = await prepareNodeRuntime(workDir)
    if (node.version && node.binDir) {
      emitter.emit('log', {
        level: 'info',
        message: `Using managed Node v${node.version} (${node.binDir})`,
        source: 'build'
      })
    } else if (node.version && node.error) {
      emitter.emit('warning', {
        type: 'missing-dependency',
        message: `Could not prepare managed Node v${node.version}: ${node.error}. Falling back to system Node — if you see version-related errors, install Node v${node.version} manually.`,
        severity: 'warning'
      })
    }
    const managedEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: pathWithNodeBin(node.binDir)
    }

    // 3. npm install
    emitter.emit('log', {
      level: 'info',
      message: `Installing dependencies in ${workDir}...`,
      source: 'build'
    })
    await runCommand('npm', ['install'], workDir, emitter, managedEnv)

    // 4. Check environment variables
    if (config.hasEnvTemplate && config.requiredEnvVars.length > 0) {
      emitter.emit('warning', {
        type: 'missing-env',
        message: `Missing environment variables: ${config.requiredEnvVars.join(', ')}. Some features may not work.`,
        severity: 'warning'
      })
    }

    // 5. Start dev server
    emitter.emit('log', {
      level: 'info',
      message: `Starting dev server on port ${port}...`,
      source: 'build'
    })

    // Bind the dev server to 127.0.0.1 (loopback only) and have the webview
    // connect to the same address. Earlier versions bound to 0.0.0.0 because
    // the legacy webSecurity:false webview could not otherwise reach the
    // server; that's no longer required, and 0.0.0.0 actively causes problems
    // with Next.js dev: when the server thinks it's on 0.0.0.0 it classifies
    // 127.0.0.1 requests as cross-origin, blocks dynamic chunk loads, and the
    // page hangs on a ChunkLoadError after a 60–120s webpack timeout.
    // See docs/LIVE_PREVIEW_COMPATIBILITY.md.
    let devCommand = config.devCommand || 'npm run dev'

    if (config.type === 'nextjs') {
      devCommand = `npx next dev -p ${port} -H 127.0.0.1`
    } else if (config.type === 'react-vite') {
      devCommand = `npx vite --port ${port} --host 127.0.0.1`
    }

    const [cmd, ...args] = devCommand.split(' ')
    const proc = spawn(cmd, args, {
      cwd: workDir,
      env: {
        ...managedEnv,
        NODE_ENV: 'development',
        PORT: String(port),
        VITE_PORT: String(port),
        // Match the -H/--host flags above. Frameworks that read HOST/HOSTNAME
        // (e.g. some Vue/Vite setups) need the same loopback origin so they
        // don't classify webview requests as cross-origin.
        HOST: '127.0.0.1',
        HOSTNAME: '127.0.0.1'
      },
      shell: true
    })

    sessionData.process = proc
    sessionData.session.pid = proc.pid

    // Wait for server to be ready before emitting 'running' status
    // This prevents webview from connecting too early
    let serverReady = false
    let portConflictReported = false

    const checkPortConflict = (output: string) => {
      if (portConflictReported) return
      // Next.js / Node prints "EADDRINUSE" or "address already in use".
      if (/EADDRINUSE|address already in use/i.test(output)) {
        portConflictReported = true
        emitter.emit('warning', {
          type: 'port-conflict',
          message: `Port ${port} is already in use. Another dev server (or a stale vibelens session) is holding it. Run \`lsof -nP -iTCP:${port} -sTCP:LISTEN\` to find the process, then kill it and try again.`,
          severity: 'error'
        })
      }
    }

    proc.stdout?.on('data', (data) => {
      const output = data.toString()

      // Emit build log
      emitter.emit('log', {
        level: 'info',
        message: output,
        source: 'build'
      })

      checkPortConflict(output)

      // Detect when dev server is ready by scanning stdout for common patterns
      if (!serverReady) {
        const readyPatterns = [
          /ready in/i,           // Vite: "ready in 2.5s"
          /compiled successfully/i,  // Next.js: "Compiled successfully"
          /ready on/i,           // "Ready on http://..."
          /local:.*http/i        // "Local: http://..."
        ]

        if (readyPatterns.some(pattern => pattern.test(output))) {
          serverReady = true
          sessionData.session.status = 'running'

          // Emit status change - webview can now connect safely
          emitter.emit('status-change', { status: 'running', sessionId })

          emitter.emit('log', {
            level: 'info',
            message: '✅ Dev server ready - webapp can be accessed',
            source: 'build'
          })
        }
      }
    })

    proc.stderr?.on('data', (data) => {
      const output = data.toString()
      emitter.emit('log', {
        level: 'error',
        message: output,
        source: 'build'
      })
      checkPortConflict(output)
    })

    proc.on('exit', (code) => {
      if (code !== 0) {
        sessionData.session.status = 'error'
        emitter.emit('status-change', { status: 'error', sessionId })
        emitter.emit('log', {
          level: 'error',
          message: `Dev server process exited with code ${code}`,
          source: 'build'
        })
      }
    })
  } catch (error: any) {
    sessionData.session.status = 'error'
    emitter.emit('status-change', { status: 'error', sessionId })
    emitter.emit('log', {
      level: 'error',
      message: `Build failed: ${error.message}`,
      source: 'build'
    })
  }
}

/**
 * Run a command and stream output
 */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  emitter: EventEmitter,
  env?: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, env: env ?? process.env })

    proc.stdout?.on('data', (data) => {
      emitter.emit('log', {
        level: 'info',
        message: data.toString(),
        source: 'build'
      })
    })

    proc.stderr?.on('data', (data) => {
      emitter.emit('log', {
        level: 'warn',
        message: data.toString(),
        source: 'build'
      })
    })

    proc.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command "${cmd} ${args.join(' ')}" failed with code ${code}`))
      }
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Stop a session and cleanup
 * @param sessionId - Session ID to stop
 */
export function stopSession(sessionId: string): void {
  const sessionData = sessions.get(sessionId)
  if (!sessionData) return

  // Kill process
  if (sessionData.process) {
    sessionData.process.kill('SIGTERM')
  }

  // Remove git worktree and temp directory
  const git = simpleGit(sessionData.session.repoPath)
  git
    .raw(['worktree', 'remove', sessionData.tempDir, '--force'])
    .catch(() => {
      // Ignore errors - directory might already be removed
    })

  // Cleanup temp directory manually if worktree removal failed
  fs.rm(sessionData.tempDir, { recursive: true, force: true }).catch(() => {
    // Ignore errors
  })

  sessions.delete(sessionId)
}

/**
 * Get session emitter for log streaming
 * @param sessionId - Session ID
 * @returns EventEmitter or null
 */
export function getSessionEmitter(sessionId: string): EventEmitter | null {
  return sessions.get(sessionId)?.emitter || null
}

/**
 * Get session status
 * @param sessionId - Session ID
 * @returns WebAppSession or null
 */
export function getSession(sessionId: string): WebAppSession | null {
  return sessions.get(sessionId)?.session || null
}

/**
 * Cleanup all sessions (called on app exit)
 */
export function cleanupAllSessions(): void {
  for (const sessionId of sessions.keys()) {
    stopSession(sessionId)
  }
}
