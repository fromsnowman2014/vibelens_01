import fs from 'fs/promises'
import path from 'path'
import type { AnalysisMeta, AnalysisResult, Language } from '@shared/types'
import { SCHEMA_VERSION } from '@shared/types'

const CACHE_DIR_NAME = '.vibelens'
const CACHE_SUB = 'cache'

function cacheRoot(repoPath: string): string {
  return path.join(repoPath, CACHE_DIR_NAME)
}

function cacheDir(repoPath: string): string {
  return path.join(cacheRoot(repoPath), CACHE_SUB)
}

export async function ensureCacheDir(repoPath: string): Promise<void> {
  const root = cacheRoot(repoPath)
  const sub = cacheDir(repoPath)
  await fs.mkdir(sub, { recursive: true })
  const gi = path.join(root, '.gitignore')
  try {
    await fs.access(gi)
  } catch {
    await fs.writeFile(gi, '*\n', 'utf8')
  }
}

function fileForLang(repoPath: string, hash: string, lang: Language) {
  return path.join(cacheDir(repoPath), `${hash}.${lang}.md`)
}
function metaFile(repoPath: string, hash: string) {
  return path.join(cacheDir(repoPath), `${hash}.meta.json`)
}

async function atomicWrite(file: string, contents: string): Promise<void> {
  const tmp = `${file}.tmp-${Date.now()}`
  await fs.writeFile(tmp, contents, 'utf8')
  await fs.rename(tmp, file)
}

export async function readCache(
  repoPath: string,
  hash: string,
  lang: Language
): Promise<AnalysisResult | null> {
  try {
    const md = await fs.readFile(fileForLang(repoPath, hash, lang), 'utf8')
    const metaRaw = await fs.readFile(metaFile(repoPath, hash), 'utf8')
    const meta = JSON.parse(metaRaw) as AnalysisMeta

    if (!meta.languagesGenerated?.includes(lang)) return null

    // The markdown header encodes parsed fields too; we keep the lean approach
    // of storing structured JSON alongside.
    const structured = extractStructuredFromMarkdown(md)
    return {
      commitHash: hash,
      language: lang,
      summary: structured.summary,
      whatChanged: structured.whatChanged,
      whyItMatters: structured.whyItMatters,
      risks: structured.risks,
      followUps: structured.followUps,
      rawMarkdown: md,
      model: meta.model,
      tokensIn: meta.tokensIn,
      tokensOut: meta.tokensOut,
      generatedAt: meta.generatedAt,
      schemaVersion: meta.schemaVersion,
      unparsed: meta.unparsed ?? false
    }
  } catch {
    return null
  }
}

export async function writeCache(
  repoPath: string,
  result: AnalysisResult
): Promise<void> {
  await ensureCacheDir(repoPath)
  const mdPath = fileForLang(repoPath, result.commitHash, result.language)
  await atomicWrite(mdPath, result.rawMarkdown)

  // Merge meta with existing language list
  let meta: AnalysisMeta
  try {
    const existing = await fs.readFile(metaFile(repoPath, result.commitHash), 'utf8')
    meta = JSON.parse(existing)
    const langs = new Set(meta.languagesGenerated || [])
    langs.add(result.language)
    meta = {
      ...meta,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      generatedAt: result.generatedAt,
      schemaVersion: result.schemaVersion,
      unparsed: result.unparsed,
      languagesGenerated: Array.from(langs) as Language[]
    }
  } catch {
    meta = {
      commitHash: result.commitHash,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      generatedAt: result.generatedAt,
      schemaVersion: result.schemaVersion,
      unparsed: result.unparsed,
      languagesGenerated: [result.language]
    }
  }
  await atomicWrite(metaFile(repoPath, result.commitHash), JSON.stringify(meta, null, 2))
}

export async function listCachedHashes(repoPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(cacheDir(repoPath))
    const hashes = new Set<string>()
    for (const e of entries) {
      if (e.endsWith('.meta.json')) hashes.add(e.replace('.meta.json', ''))
    }
    return Array.from(hashes)
  } catch {
    return []
  }
}

export async function clearCache(repoPath: string): Promise<void> {
  try {
    await fs.rm(cacheDir(repoPath), { recursive: true, force: true })
    await fs.mkdir(cacheDir(repoPath), { recursive: true })
  } catch {
    /* noop */
  }
}

export async function isGitignoreMissingEntry(repoPath: string): Promise<boolean> {
  const gi = path.join(repoPath, '.gitignore')
  try {
    const contents = await fs.readFile(gi, 'utf8')
    return !/^\s*\.vibelens\/?\s*$/m.test(contents)
  } catch {
    return true // no .gitignore yet
  }
}

export async function addVibelensToGitignore(repoPath: string): Promise<boolean> {
  const gi = path.join(repoPath, '.gitignore')
  try {
    let existing = ''
    try {
      existing = await fs.readFile(gi, 'utf8')
    } catch {
      existing = ''
    }
    if (/^\s*\.vibelens\/?\s*$/m.test(existing)) return false
    const suffix = existing.endsWith('\n') || existing.length === 0 ? '' : '\n'
    const next = `${existing}${suffix}\n# VibeLens analysis cache\n.vibelens/\n`
    await fs.writeFile(gi, next, 'utf8')
    return true
  } catch {
    return false
  }
}

// --- Markdown structure helpers -----------------------------------------------
// Cached markdown uses a deterministic layout so we can round-trip structured
// fields without storing a second JSON file. Layout:
//
//   # Summary\n<text>\n\n## What changed\n- ...\n\n## Why it matters\n<text>\n\n
//   ## Risks\n- ...\n\n## Follow ups\n- ...\n
//
// If parsing fails (older or "unparsed" fallback entries) we return empty arrays
// and leave the raw markdown visible in the panel.

export function renderAnalysisMarkdown(parsed: {
  summary: string
  whatChanged: string[]
  whyItMatters: string
  risks: string[]
  followUps: string[]
}): string {
  const bullets = (xs: string[]) =>
    xs.length === 0 ? '_None_' : xs.map((x) => `- ${x}`).join('\n')
  return [
    `# Summary`,
    parsed.summary || '_(none)_',
    ``,
    `## What changed`,
    bullets(parsed.whatChanged),
    ``,
    `## Why it matters`,
    parsed.whyItMatters || '_(none)_',
    ``,
    `## Risks`,
    bullets(parsed.risks),
    ``,
    `## Follow ups`,
    bullets(parsed.followUps),
    ``
  ].join('\n')
}

function extractSection(md: string, heading: string): string {
  const re = new RegExp(`^##?\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|^#\\s|\\Z)`, 'mi')
  const match = md.match(re)
  return match ? match[1].trim() : ''
}

function extractBullets(section: string): string[] {
  if (!section || /^_none_$/i.test(section)) return []
  return section
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter((l) => l.length > 0)
}

export function extractStructuredFromMarkdown(md: string): {
  summary: string
  whatChanged: string[]
  whyItMatters: string
  risks: string[]
  followUps: string[]
} {
  const summarySection = extractSection(md, 'Summary')
  const whatSection = extractSection(md, 'What changed')
  const whySection = extractSection(md, 'Why it matters')
  const riskSection = extractSection(md, 'Risks')
  const followSection = extractSection(md, 'Follow ups')
  return {
    summary: summarySection.replace(/^_\(none\)_$/i, ''),
    whatChanged: extractBullets(whatSection),
    whyItMatters: whySection.replace(/^_\(none\)_$/i, ''),
    risks: extractBullets(riskSection),
    followUps: extractBullets(followSection)
  }
}
