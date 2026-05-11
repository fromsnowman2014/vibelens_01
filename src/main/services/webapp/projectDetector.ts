import type {
  CompanionBackend,
  CompanionBackendKind,
  ProjectConfig,
  ProjectType
} from '@shared/types'
import simpleGit, { type SimpleGit } from 'simple-git'

const LOG = '[projectDetector]'

// Subdirectories we'll probe when root has no package.json/index.html.
// Limited list to keep detection fast and predictable.
const CANDIDATE_SUBDIRS = ['frontend', 'web', 'app', 'client', 'apps/web', 'packages/web']

// Companion backend signatures. Order within a kind doesn't matter.
// Sibling-dir entries (no '/') are checked as directories *and* as files —
// both are evidence of a backend living next to the frontend.
interface BackendSignature {
  kind: CompanionBackendKind
  /** Patterns matched against the repo's tree. Use `dir/` to require a directory match. */
  files: string[]
  setupHint: string
}

const BACKEND_SIGNATURES: BackendSignature[] = [
  {
    kind: 'python',
    files: [
      'requirements.txt',
      'pyproject.toml',
      'Pipfile',
      'poetry.lock',
      'setup.py',
      'manage.py',
      'server.py',
      'app.py',
      'main.py'
    ],
    setupHint: 'python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt'
  },
  {
    kind: 'rust',
    files: ['Cargo.toml'],
    setupHint: 'cargo run'
  },
  {
    kind: 'go',
    files: ['go.mod'],
    setupHint: 'go run ./...'
  },
  {
    kind: 'ruby',
    files: ['Gemfile', 'config.ru'],
    setupHint: 'bundle install && bundle exec rails server  # or: ruby <entrypoint>.rb'
  },
  {
    kind: 'jvm',
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
    setupHint: './gradlew bootRun  # or: mvn spring-boot:run'
  },
  {
    kind: 'dotnet',
    files: ['Program.cs', 'Startup.cs', 'global.json'],
    setupHint: 'dotnet run'
  },
  {
    kind: 'php',
    files: ['composer.json', 'artisan'],
    setupHint: 'composer install && php artisan serve  # Laravel; adjust for your framework'
  },
  // Sibling Node backend (e.g. backend/package.json). The frontend dir is
  // excluded by the caller — we only flag a *separate* Node service here.
  {
    kind: 'node',
    files: ['backend/package.json', 'server/package.json', 'api/package.json'],
    setupHint: 'cd <backend-dir> && npm install && npm run dev  # check that dir\'s README'
  }
]

// Sibling directories that strongly suggest a separate backend service even
// without a language file at root. Used as a secondary signal.
const SIBLING_BACKEND_DIRS = ['backend', 'server', 'api', 'services']

interface DetectFromPackageJsonResult {
  type: ProjectType
  devCommand: string | null
  buildCommand: string | null
  devPort: number | null
}

function classifyPackageJson(pkg: any): DetectFromPackageJsonResult {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const scripts = pkg.scripts || {}

  if (deps['next']) {
    return {
      type: 'nextjs',
      devCommand: scripts.dev ? 'npm run dev' : null,
      buildCommand: scripts.build ? 'npm run build' : null,
      devPort: 3000
    }
  }
  if (deps['vite']) {
    return {
      type: 'react-vite',
      devCommand: scripts.dev ? 'npm run dev' : null,
      buildCommand: scripts.build ? 'npm run build' : null,
      devPort: 5173
    }
  }
  if (deps['react-scripts']) {
    return {
      type: 'react-cra',
      devCommand: scripts.start ? 'npm start' : scripts.dev ? 'npm run dev' : null,
      buildCommand: scripts.build ? 'npm run build' : null,
      devPort: 3000
    }
  }
  if (deps['vue']) {
    return {
      type: 'vue',
      devCommand: scripts.dev ? 'npm run dev' : scripts.serve ? 'npm run serve' : null,
      buildCommand: scripts.build ? 'npm run build' : null,
      devPort: 5173
    }
  }
  return { type: 'unknown', devCommand: null, buildCommand: null, devPort: null }
}

async function tryReadAtCommit(
  git: SimpleGit,
  commitHash: string,
  filePath: string
): Promise<string | null> {
  try {
    return await git.show([`${commitHash}:${filePath}`])
  } catch {
    return null
  }
}

interface TreeIndex {
  files: Set<string>
  dirs: Set<string>
}

/**
 * Read the full file/dir listing at a commit in one git call.
 * Used to evaluate companion-backend signatures without spamming `git show`.
 */
async function loadTreeIndex(git: SimpleGit, commitHash: string): Promise<TreeIndex> {
  const files = new Set<string>()
  const dirs = new Set<string>()
  try {
    // -r: recurse, --name-only: just paths, full-tree allows cwd-independent.
    const out = await git.raw(['ls-tree', '-r', '--name-only', '--full-tree', commitHash])
    for (const line of out.split('\n')) {
      const p = line.trim()
      if (!p) continue
      files.add(p)
      // Record every parent directory so dir-existence checks are O(1).
      let idx = p.indexOf('/')
      while (idx !== -1) {
        dirs.add(p.slice(0, idx))
        idx = p.indexOf('/', idx + 1)
      }
    }
  } catch (e) {
    console.warn(
      `${LOG} ls-tree failed for commit=${commitHash.slice(0, 7)}:`,
      e instanceof Error ? e.message : e
    )
  }
  return { files, dirs }
}

function detectCompanionBackend(
  tree: TreeIndex,
  frontendWorkingDir: string
): CompanionBackend | null {
  // Skip files inside the frontend dir — those are the project we *are* running.
  const isInFrontend = (p: string): boolean => {
    if (!frontendWorkingDir) return false
    return p === frontendWorkingDir || p.startsWith(frontendWorkingDir + '/')
  }

  const matchesByKind = new Map<CompanionBackendKind, { signals: Set<string>; hint: string }>()

  for (const sig of BACKEND_SIGNATURES) {
    for (const pattern of sig.files) {
      const isDirPattern = pattern.endsWith('/')
      const target = isDirPattern ? pattern.slice(0, -1) : pattern
      const hit = isDirPattern ? tree.dirs.has(target) : tree.files.has(target)
      if (!hit) continue
      if (isInFrontend(target)) continue
      const entry = matchesByKind.get(sig.kind) ?? { signals: new Set<string>(), hint: sig.setupHint }
      entry.signals.add(pattern)
      matchesByKind.set(sig.kind, entry)
    }
  }

  // Secondary signal: a sibling backend/server/api/services directory exists
  // with anything inside (and isn't the frontend dir itself). If we already
  // matched a kind, attach the dir as an extra signal; otherwise no kind
  // promotion — directory alone is too ambiguous to name a language.
  for (const dir of SIBLING_BACKEND_DIRS) {
    if (!tree.dirs.has(dir) || isInFrontend(dir)) continue
    // Find which kind, if any, has files inside this dir.
    for (const [kind, entry] of matchesByKind) {
      const inDir = [...entry.signals].some((s) => s.startsWith(dir + '/') || tree.files.has(`${dir}/${s}`))
      if (inDir || [...tree.files].some((f) => f.startsWith(dir + '/') && entry.signals.has(f.slice(dir.length + 1)))) {
        entry.signals.add(`${dir}/`)
        matchesByKind.set(kind, entry)
      }
    }
  }

  if (matchesByKind.size === 0) return null

  // If multiple kinds match, prefer the one with the most signals; ties go
  // to a stable order matching BACKEND_SIGNATURES (Python first, etc.).
  let best: { kind: CompanionBackendKind; signals: Set<string>; hint: string } | null = null
  for (const sig of BACKEND_SIGNATURES) {
    const m = matchesByKind.get(sig.kind)
    if (!m) continue
    if (!best || m.signals.size > best.signals.size) {
      best = { kind: sig.kind, signals: m.signals, hint: m.hint }
    }
  }
  if (!best) return null
  return {
    kind: best.kind,
    signals: [...best.signals].sort(),
    setupHint: best.hint
  }
}

interface FoundProject {
  workingDir: string
  classification: DetectFromPackageJsonResult
  staticHtml: boolean
}

async function findProjectInDir(
  git: SimpleGit,
  commitHash: string,
  dir: string
): Promise<FoundProject | null> {
  const pkgPath = dir === '' ? 'package.json' : `${dir}/package.json`
  const pkgContent = await tryReadAtCommit(git, commitHash, pkgPath)
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent)
      const classification = classifyPackageJson(pkg)
      console.log(
        `${LOG} found package.json at "${pkgPath}" (commit=${commitHash.slice(0, 7)}) → type=${classification.type}`
      )
      return { workingDir: dir, classification, staticHtml: false }
    } catch (e) {
      console.warn(
        `${LOG} package.json at "${pkgPath}" failed to parse:`,
        e instanceof Error ? e.message : e
      )
    }
  }

  const htmlPath = dir === '' ? 'index.html' : `${dir}/index.html`
  const html = await tryReadAtCommit(git, commitHash, htmlPath)
  if (html !== null) {
    console.log(`${LOG} found static index.html at "${htmlPath}" (commit=${commitHash.slice(0, 7)})`)
    return {
      workingDir: dir,
      classification: { type: 'static-html', devCommand: null, buildCommand: null, devPort: null },
      staticHtml: true
    }
  }

  return null
}

/**
 * Detects the project type from package.json and other config files.
 * Searches repo root first, then a small list of common subdirectories
 * (e.g. `frontend/`, `apps/web/`) so monorepos are handled.
 */
export async function detectProjectType(
  repoPath: string,
  commitHash: string
): Promise<ProjectConfig> {
  const shortHash = commitHash.slice(0, 7)
  console.log(`${LOG} detecting repoPath=${repoPath} commit=${shortHash}`)
  const git = simpleGit(repoPath)

  const searchDirs = ['', ...CANDIDATE_SUBDIRS]
  let found: FoundProject | null = null
  for (const dir of searchDirs) {
    found = await findProjectInDir(git, commitHash, dir)
    if (found) break
  }

  if (!found) {
    console.log(
      `${LOG} no package.json or index.html in root or known subdirs (${CANDIDATE_SUBDIRS.join(', ')}) → unknown (commit=${shortHash})`
    )
    return {
      type: 'unknown',
      devCommand: null,
      buildCommand: null,
      devPort: null,
      hasEnvTemplate: false,
      requiredEnvVars: [],
      workingDir: '',
      companionBackend: null
    }
  }

  // Look for .env.example next to the project (same workingDir).
  const envPath = found.workingDir === '' ? '.env.example' : `${found.workingDir}/.env.example`
  const envContent = await tryReadAtCommit(git, commitHash, envPath)
  let hasEnvTemplate = false
  let requiredEnvVars: string[] = []
  if (envContent !== null) {
    hasEnvTemplate = true
    requiredEnvVars = envContent
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean)
  }

  // Companion backend detection — single ls-tree call, then signature match.
  const tree = await loadTreeIndex(git, commitHash)
  const companionBackend = detectCompanionBackend(tree, found.workingDir)
  if (companionBackend) {
    console.log(
      `${LOG} companion backend kind=${companionBackend.kind} signals=[${companionBackend.signals.join(', ')}] (commit=${shortHash})`
    )
  }

  const result: ProjectConfig = {
    ...found.classification,
    hasEnvTemplate,
    requiredEnvVars,
    workingDir: found.workingDir,
    companionBackend
  }

  console.log(
    `${LOG} result commit=${shortHash} type=${result.type} workingDir="${result.workingDir}" devCommand=${result.devCommand} envTemplate=${hasEnvTemplate} companion=${companionBackend?.kind ?? 'none'}`
  )
  return result
}
