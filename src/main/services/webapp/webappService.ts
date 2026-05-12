import type { ProjectConfig, WebAppSession } from '@shared/types'
import { detectProjectType } from './projectDetector'
import { buildAndRun, stopSession, getSession } from './buildManager'
import { clearWebappSession } from './previewSession'

/**
 * Detect project type from repository
 */
export async function detectProject(
  repoPath: string,
  commitHash: string
): Promise<ProjectConfig> {
  return await detectProjectType(repoPath, commitHash)
}

/**
 * Start webapp session
 */
export async function startWebApp(
  repoPath: string,
  commitHash: string
): Promise<WebAppSession> {
  // 1. Detect project type
  const config = await detectProjectType(repoPath, commitHash)

  if (config.type === 'unknown') {
    throw new Error('This repository does not appear to be a web application')
  }

  // 2. Clear the preview webview's storage so a previous repo's service
  //    workers / caches / cookies cannot intercept this session. Best-effort:
  //    we don't want a clearStorageData hiccup to block the build.
  await clearWebappSession().catch((e) => {
    console.warn('[webappService] clearWebappSession failed (continuing):', e)
  })

  // 3. Build and run
  return await buildAndRun(repoPath, commitHash, config)
}

/**
 * Stop webapp session
 */
export async function stopWebApp(sessionId: string): Promise<void> {
  stopSession(sessionId)
}

/**
 * Get webapp session status
 */
export async function getStatus(sessionId: string): Promise<WebAppSession | null> {
  return getSession(sessionId)
}
