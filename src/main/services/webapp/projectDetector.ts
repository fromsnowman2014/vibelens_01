import fs from 'fs/promises'
import path from 'path'
import type { ProjectConfig, ProjectType } from '@shared/types'
import simpleGit from 'simple-git'

/**
 * Detects the project type from package.json and other config files
 * @param repoPath - Path to the repository
 * @param commitHash - Commit hash to read package.json from
 * @returns ProjectConfig with detected project type and dev commands
 */
export async function detectProjectType(
  repoPath: string,
  commitHash: string
): Promise<ProjectConfig> {
  // 1. Check for package.json at the specific commit
  let pkg: any = null
  const git = simpleGit(repoPath)

  try {
    // Read package.json from the specific commit using git show
    const content = await git.show([`${commitHash}:package.json`])
    pkg = JSON.parse(content)
  } catch {
    // No package.json → check for static HTML in commit
    try {
      await git.show([`${commitHash}:index.html`])
      return {
        type: 'static-html',
        devCommand: null,
        buildCommand: null,
        devPort: null,
        hasEnvTemplate: false,
        requiredEnvVars: []
      }
    } catch {
      // Not a webapp
      return {
        type: 'unknown',
        devCommand: null,
        buildCommand: null,
        devPort: null,
        hasEnvTemplate: false,
        requiredEnvVars: []
      }
    }
  }

  // 2. Detect project type from dependencies
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const scripts = pkg.scripts || {}

  let type: ProjectType = 'unknown'
  let devCommand: string | null = null
  let buildCommand: string | null = null
  let devPort: number | null = null

  if (deps['next']) {
    type = 'nextjs'
    // Always use npm run format to ensure node_modules/.bin is in PATH
    devCommand = scripts.dev ? 'npm run dev' : null
    buildCommand = scripts.build ? 'npm run build' : null
    devPort = 3000
  } else if (deps['vite']) {
    type = 'react-vite'
    devCommand = scripts.dev ? 'npm run dev' : null
    buildCommand = scripts.build ? 'npm run build' : null
    devPort = 5173
  } else if (deps['react-scripts']) {
    type = 'react-cra'
    // CRA uses 'start' instead of 'dev'
    devCommand = scripts.start ? 'npm start' : (scripts.dev ? 'npm run dev' : null)
    buildCommand = scripts.build ? 'npm run build' : null
    devPort = 3000
  } else if (deps['vue']) {
    type = 'vue'
    // Vue can use 'dev' or 'serve'
    devCommand = scripts.dev ? 'npm run dev' : (scripts.serve ? 'npm run serve' : null)
    buildCommand = scripts.build ? 'npm run build' : null
    devPort = 5173
  }

  // 3. Check for .env.example in the commit
  let hasEnvTemplate = false
  let requiredEnvVars: string[] = []

  try {
    const envContent = await git.show([`${commitHash}:.env.example`])
    hasEnvTemplate = true
    requiredEnvVars = envContent
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean)
  } catch {
    // .env.example doesn't exist in this commit
    hasEnvTemplate = false
  }

  return {
    type,
    devCommand,
    buildCommand,
    devPort,
    hasEnvTemplate,
    requiredEnvVars
  }
}
