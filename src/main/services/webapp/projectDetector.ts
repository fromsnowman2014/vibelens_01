import type { ProjectConfig, ProjectType } from '@shared/types'
import simpleGit, { type SimpleGit } from 'simple-git'

const LOG = '[projectDetector]'

// Subdirectories we'll probe when root has no package.json/index.html.
// Limited list to keep detection fast and predictable.
const CANDIDATE_SUBDIRS = ['frontend', 'web', 'app', 'client', 'apps/web', 'packages/web']

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
      workingDir: ''
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

  const result: ProjectConfig = {
    ...found.classification,
    hasEnvTemplate,
    requiredEnvVars,
    workingDir: found.workingDir
  }

  console.log(
    `${LOG} result commit=${shortHash} type=${result.type} workingDir="${result.workingDir}" devCommand=${result.devCommand} envTemplate=${hasEnvTemplate}`
  )
  return result
}
