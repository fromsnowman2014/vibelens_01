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
import { requestConsent } from './runtimeConsent'

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
 * Try to interpret a raw version string as an exact semver. Returns the
 * canonical "X.Y.Z" form, or null if the input is anything else (alias,
 * range, major-only). Aliases and major-only are handled by `resolveAlias`
 * against the nodejs.org index.
 */
function exactSemver(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/i, '')
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) return null
  return trimmed
}

interface DistRelease {
  version: string // "v22.11.0"
  date: string
  files: string[]
  lts: false | string // false or LTS codename, e.g. "Jod"
}

/** Disk + memory cache of nodejs.org/dist/index.json. */
const DIST_INDEX_TTL_MS = 24 * 60 * 60 * 1000 // 24h
let distIndexMemo: { fetchedAt: number; releases: DistRelease[] } | null = null

function distIndexCachePath(): string {
  return path.join(toolsRoot(), 'index.json')
}

async function loadDistIndex(): Promise<DistRelease[]> {
  const now = Date.now()
  if (distIndexMemo && now - distIndexMemo.fetchedAt < DIST_INDEX_TTL_MS) {
    return distIndexMemo.releases
  }
  const cachePath = distIndexCachePath()
  try {
    const stat = await fs.stat(cachePath)
    if (now - stat.mtimeMs < DIST_INDEX_TTL_MS) {
      const txt = await fs.readFile(cachePath, 'utf8')
      const releases = JSON.parse(txt) as DistRelease[]
      distIndexMemo = { fetchedAt: stat.mtimeMs, releases }
      return releases
    }
  } catch {
    /* no usable on-disk cache */
  }

  console.log(`${LOG} fetching nodejs.org/dist/index.json`)
  const text = await fetchText('https://nodejs.org/dist/index.json')
  const releases = JSON.parse(text) as DistRelease[]
  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, text, 'utf8')
  distIndexMemo = { fetchedAt: now, releases }
  return releases
}

/**
 * Resolve a non-exact version spec against the nodejs.org index.
 * Handles:
 *   "latest"       — newest release.
 *   "lts" / "lts/*" — newest LTS release.
 *   "lts/iron"     — newest release tagged with that LTS codename.
 *   "20" / "20.10" — newest release in that major / major.minor line.
 *   "node" (asdf alias for latest) — newest release.
 * Returns null for ranges (">=18", "^18", etc.) — those require a semver
 * library and are deferred.
 */
async function resolveAlias(raw: string): Promise<string | null> {
  const lower = raw.trim().toLowerCase().replace(/^v/, '')
  if (!lower) return null

  // Ranges are out of scope for P2 — needs a semver library.
  if (/[<>=^~]|\s|\*/.test(lower)) {
    console.log(`${LOG} alias "${raw}" is a range, not supported`)
    return null
  }

  const releases = await loadDistIndex().catch((e) => {
    console.warn(`${LOG} failed to load dist index: ${e instanceof Error ? e.message : e}`)
    return null
  })
  if (!releases || releases.length === 0) return null

  // index.json is newest-first. We just take the first match.
  const pick = (predicate: (r: DistRelease) => boolean): string | null => {
    const hit = releases.find(predicate)
    return hit ? hit.version.replace(/^v/, '') : null
  }

  if (lower === 'latest' || lower === 'node' || lower === 'stable') {
    return pick(() => true)
  }
  if (lower === 'lts' || lower === 'lts/*') {
    return pick((r) => r.lts !== false)
  }
  if (lower.startsWith('lts/')) {
    const codename = lower.slice(4)
    return pick((r) => typeof r.lts === 'string' && r.lts.toLowerCase() === codename)
  }
  if (/^\d+$/.test(lower)) {
    // Major only — newest release in this major.
    return pick((r) => r.version.startsWith(`v${lower}.`))
  }
  if (/^\d+\.\d+$/.test(lower)) {
    return pick((r) => r.version.startsWith(`v${lower}.`))
  }
  return null
}

/**
 * Resolve a raw version string from .nvmrc / engines.node / .tool-versions
 * into a clean semver. Tries exact match first, then alias resolution
 * against nodejs.org/dist/index.json. Returns null if neither path applies
 * (e.g. ranges like ">=18").
 */
async function resolveVersionSpec(raw: string): Promise<string | null> {
  const exact = exactSemver(raw)
  if (exact) return exact
  const aliased = await resolveAlias(raw)
  if (aliased) {
    console.log(`${LOG} alias "${raw.trim()}" resolved to ${aliased}`)
    return aliased
  }
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
    const v = await resolveVersionSpec(nvmrc)
    if (v) {
      console.log(`${LOG} resolved version from .nvmrc: ${v}`)
      return v
    }
    console.log(`${LOG} .nvmrc value "${nvmrc.trim()}" not usable (range/unrecognized)`)
  }

  // 2. package.json#engines.node — only honored if it's a single semver or alias.
  const pkgRaw = await readIfExists(path.join(workDir, 'package.json'))
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw)
      const engineNode = pkg?.engines?.node
      if (typeof engineNode === 'string') {
        const v = await resolveVersionSpec(engineNode)
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
        const v = await resolveVersionSpec(match[2])
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

  // Before downloading anything, get the user's blessing. Cached decisions
  // are honored silently inside requestConsent.
  const granted = await requestConsent({ kind: 'node', version, approxSizeMB: 30 })
  if (!granted) {
    throw new Error(
      `User declined to download managed Node v${version}. Falling back to system Node.`
    )
  }

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
