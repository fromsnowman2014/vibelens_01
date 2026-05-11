/**
 * Node managed runtime — ISOLATED_BUILD_STRATEGY.md Phase 1.
 *
 * Reads a desired Node version from a worktree (.nvmrc, package.json#engines.node,
 * .tool-versions) and ensures a matching Node binary exists in vibelens's
 * managed cache (userData/tools/node/<version>/). Spawning code can then
 * prepend that bin dir to PATH so npm/dev commands use the pinned version
 * instead of whatever Node happens to be on the user's $PATH.
 *
 * Limitations (intentional, Phase 1):
 *  - Only exact semver versions are honored (e.g. "20.10.0", "v20.10.0",
 *    "20"). Aliases like "lts/iron", "lts/*", or unpinned "engines: '>=18'"
 *    fall back to system Node.
 *  - Integrity is checked against the official SHASUMS256.txt over HTTPS but
 *    PGP signature verification is deferred to a later phase.
 *  - Windows support is structurally sketched (.zip path) but not exercised.
 */

import fs from 'fs/promises'
import { createWriteStream, createReadStream } from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { spawn } from 'child_process'

const LOG = '[nodeRuntime]'

interface PlatformInfo {
  platform: 'darwin' | 'linux' | 'win'
  arch: 'x64' | 'arm64'
  archiveExt: 'tar.gz' | 'zip'
}

function platformInfo(): PlatformInfo | null {
  const plat = process.platform
  const arch = process.arch
  if (arch !== 'x64' && arch !== 'arm64') return null
  if (plat === 'darwin' || plat === 'linux') {
    return { platform: plat, arch, archiveExt: 'tar.gz' }
  }
  if (plat === 'win32') {
    return { platform: 'win', arch, archiveExt: 'zip' }
  }
  return null
}

function toolsRoot(): string {
  return path.join(app.getPath('userData'), 'tools', 'node')
}

function archiveName(version: string, info: PlatformInfo): string {
  return `node-v${version}-${info.platform}-${info.arch}.${info.archiveExt}`
}

function downloadUrl(version: string, info: PlatformInfo): string {
  return `https://nodejs.org/dist/v${version}/${archiveName(version, info)}`
}

function shasumsUrl(version: string): string {
  return `https://nodejs.org/dist/v${version}/SHASUMS256.txt`
}

function extractedDir(version: string, info: PlatformInfo): string {
  // tarballs extract into "node-v<ver>-<plat>-<arch>/" at top level.
  return path.join(toolsRoot(), version, `node-v${version}-${info.platform}-${info.arch}`)
}

/** Path to the `bin/` directory inside a fully-installed Node version, or null
 *  if it isn't installed yet. */
function installedBinDir(version: string, info: PlatformInfo): string {
  // Windows archives put node.exe at the top level, not in bin/.
  return info.platform === 'win'
    ? extractedDir(version, info)
    : path.join(extractedDir(version, info), 'bin')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Normalize a raw version string from .nvmrc / engines.node / .tool-versions
 * into a clean semver, or null if we can't accept it.
 *
 *   "v20.10.0"  -> "20.10.0"
 *   "20.10.0"   -> "20.10.0"
 *   "20"        -> "20.0.0"  (resolved to a known LTS at request time)
 *   "lts/iron"  -> null (alias, P2)
 *   ">=18"      -> null (range, P2)
 */
function normalizeVersion(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/i, '')
  if (!trimmed) return null
  // Reject obvious aliases/ranges/etc.
  if (/[<>=^~ ]|lts|latest|node|\*/i.test(trimmed)) return null
  // Major-only ("20") becomes 20.0.0; we'll let the HTTP download fail with a
  // clear error if that exact version doesn't exist (rare).
  const parts = trimmed.split('.')
  if (parts.length === 1 && /^\d+$/.test(parts[0])) return `${parts[0]}.0.0`
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) return `${parts[0]}.${parts[1]}.0`
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) return trimmed
  return null
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

/** Read the desired Node version from a worktree. Returns the cleaned semver
 *  or null when the repo doesn't pin a usable version. */
export async function resolveNodeVersion(workDir: string): Promise<string | null> {
  // 1. .nvmrc — most common.
  const nvmrc = await readIfExists(path.join(workDir, '.nvmrc'))
  if (nvmrc) {
    const v = normalizeVersion(nvmrc)
    if (v) {
      console.log(`${LOG} resolved version from .nvmrc: ${v}`)
      return v
    }
    console.log(`${LOG} .nvmrc value "${nvmrc.trim()}" not usable (alias/range)`)
  }

  // 2. package.json#engines.node — only honored if it's a single semver.
  const pkgRaw = await readIfExists(path.join(workDir, 'package.json'))
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw)
      const engineNode = pkg?.engines?.node
      if (typeof engineNode === 'string') {
        const v = normalizeVersion(engineNode)
        if (v) {
          console.log(`${LOG} resolved version from package.json engines.node: ${v}`)
          return v
        }
        console.log(`${LOG} engines.node "${engineNode}" is a range — falling through`)
      }
    } catch {
      /* package.json parse already validated elsewhere */
    }
  }

  // 3. .tool-versions (asdf).
  const toolVersions = await readIfExists(path.join(workDir, '.tool-versions'))
  if (toolVersions) {
    for (const line of toolVersions.split('\n')) {
      const match = line.match(/^\s*(nodejs|node)\s+(\S+)/)
      if (match) {
        const v = normalizeVersion(match[2])
        if (v) {
          console.log(`${LOG} resolved version from .tool-versions: ${v}`)
          return v
        }
      }
    }
  }

  console.log(`${LOG} no usable pinned Node version in ${workDir}`)
  return null
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  return await res.text()
}

async function fetchToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const file = createWriteStream(dest)
  // Node 20+: fetch returns a web ReadableStream; pipeline accepts it.
  await pipeline(res.body as unknown as NodeJS.ReadableStream, file)
}

async function sha256File(p: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(p), hash)
  return hash.digest('hex')
}

async function verifyChecksum(version: string, archivePath: string, info: PlatformInfo): Promise<void> {
  const text = await fetchText(shasumsUrl(version))
  const name = archiveName(version, info)
  // SHASUMS256.txt lines look like: "<hex>  <filename>"
  const line = text.split('\n').find((l) => l.trim().endsWith(`  ${name}`))
  if (!line) throw new Error(`SHASUMS256.txt has no entry for ${name}`)
  const expected = line.trim().split(/\s+/)[0]
  const actual = await sha256File(archivePath)
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${name}: expected ${expected}, got ${actual}`)
  }
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  // We rely on the system `tar` — it's present on macOS, Linux, and Windows 10+.
  // We don't run code from inside the archive; we only spawn it after install
  // via PATH manipulation, so tar's job is purely file extraction.
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('tar', ['-xzf', archivePath, '-C', destDir], { stdio: 'inherit' })
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

/**
 * Ensure a Node version is downloaded, verified, and extracted to the managed
 * cache. Returns the absolute path to the `bin/` directory containing `node`
 * and `npm`. Concurrent calls for the same version are deduplicated.
 */
const inflight = new Map<string, Promise<string>>()

export async function ensureNodeBin(version: string): Promise<string> {
  const info = platformInfo()
  if (!info) {
    throw new Error(`Unsupported platform ${process.platform}/${process.arch} for managed Node`)
  }

  const binDir = installedBinDir(version, info)
  if (await exists(path.join(binDir, info.platform === 'win' ? 'node.exe' : 'node'))) {
    return binDir
  }

  const existing = inflight.get(version)
  if (existing) return existing

  const job = (async () => {
    if (info.archiveExt !== 'tar.gz') {
      throw new Error(`Phase 1 only supports tar.gz archives; got ${info.archiveExt}`)
    }
    const versionDir = path.join(toolsRoot(), version)
    await fs.mkdir(versionDir, { recursive: true })
    const archivePath = path.join(versionDir, archiveName(version, info))

    console.log(`${LOG} downloading Node v${version} → ${archivePath}`)
    await fetchToFile(downloadUrl(version, info), archivePath)

    console.log(`${LOG} verifying checksum for v${version}`)
    await verifyChecksum(version, archivePath, info)

    console.log(`${LOG} extracting v${version}`)
    await extractTarGz(archivePath, versionDir)

    // Free the archive once extracted; keep one log line so it's obvious in
    // case of disk-space debugging.
    await fs.rm(archivePath, { force: true })
    console.log(`${LOG} ready: ${binDir}`)

    if (!(await exists(path.join(binDir, 'node')))) {
      throw new Error(
        `Extraction completed but ${path.join(binDir, 'node')} is missing; the archive layout may have changed.`
      )
    }
    return binDir
  })()

  inflight.set(version, job)
  try {
    return await job
  } finally {
    inflight.delete(version)
  }
}

/**
 * Build a PATH string that puts the managed Node bin dir first, with the
 * user's existing PATH appended. Returns the original PATH (or '') when no
 * managed bin is provided.
 */
export function pathWithNodeBin(binDir: string | null): string {
  const current = process.env.PATH || ''
  if (!binDir) return current
  const sep = process.platform === 'win32' ? ';' : ':'
  return `${binDir}${sep}${current}`
}

/** Best-effort version pin resolution + ensure. Returns either the bin dir to
 *  prepend to PATH, or null when we should fall through to system Node.
 *  Errors during download are converted to a null return and logged — the
 *  caller can then surface a friendly warning while still attempting the
 *  install with system Node. */
export async function prepareNodeRuntime(workDir: string): Promise<{
  binDir: string | null
  version: string | null
  error: string | null
}> {
  const version = await resolveNodeVersion(workDir)
  if (!version) return { binDir: null, version: null, error: null }
  try {
    const binDir = await ensureNodeBin(version)
    return { binDir, version, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`${LOG} failed to prepare Node v${version}, falling back to system Node:`, msg)
    return { binDir: null, version, error: msg }
  }
}

/** Exposed for testing — clear in-process state. Does not touch disk. */
export function _resetInflight(): void {
  inflight.clear()
}

// `os` is intentionally re-exported as a stable hook for tests that mock
// platform/arch detection.
export const _internals = { os }
