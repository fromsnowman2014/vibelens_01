import simpleGit, { SimpleGit } from 'simple-git'
import type {
  BranchInfo,
  Commit,
  DiffFile,
  DiffResult,
  FileChangeStatus
} from '@shared/types'
import path from 'path'
import fs from 'fs/promises'

function git(repoPath: string): SimpleGit {
  return simpleGit({
    baseDir: repoPath,
    binary: 'git',
    maxConcurrentProcesses: 4
  })
}

export async function cloneRepo(url: string, destPath: string): Promise<void> {
  const g = simpleGit()
  await g.clone(url, destPath, ['--progress'])
}

export async function checkIsRepo(repoPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(repoPath, '.git'))
    if (!stat) return false
  } catch {
    return false
  }
  try {
    return await git(repoPath).checkIsRepo()
  } catch {
    return false
  }
}

export async function getBranches(repoPath: string): Promise<BranchInfo> {
  const g = git(repoPath)
  const result = await g.branch(['--list'])
  const all = Object.keys(result.branches).sort()
  return { current: result.current || 'HEAD', all }
}

export async function listCommits(
  repoPath: string,
  branch: string,
  limit: number,
  offset: number
): Promise<Commit[]> {
  const g = git(repoPath)
  const ref = branch && branch !== 'HEAD' ? branch : 'HEAD'

  const format = [
    '%H', // hash
    '%h', // short
    '%s', // subject
    '%B', // full message
    '%an',
    '%ae',
    '%aI', // ISO strict
    '%ar',
    '%P' // parents
  ].join('%x1f')

  const args = [
    'log',
    ref,
    `--pretty=format:${format}%x1e`,
    `--max-count=${limit}`,
    `--skip=${offset}`
  ]

  let raw: string
  try {
    raw = await g.raw(args)
  } catch (e) {
    // Empty repo or unknown ref
    return []
  }

  const records = raw.split('\x1e').map((r) => r.trim()).filter(Boolean)
  const commits: Commit[] = records.map((rec) => {
    const [hash, shortHash, subject, message, author, email, date, relativeDate, parents] =
      rec.split('\x1f')
    return {
      hash,
      shortHash,
      subject,
      message: (message || subject || '').trim(),
      author,
      email,
      date,
      relativeDate,
      parents: parents ? parents.split(' ').filter(Boolean) : []
    }
  })
  return commits
}

function parseStatus(code: string): FileChangeStatus {
  const c = code[0]?.toUpperCase()
  switch (c) {
    case 'A':
      return 'added'
    case 'M':
      return 'modified'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'T':
      return 'type-changed'
    default:
      return 'unknown'
  }
}

const MAX_FILE_LINES = 2000

function detectLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    sql: 'sql'
  }
  return map[ext]
}

export async function getFileAtCommit(
  repoPath: string,
  commitHash: string,
  filePath: string
): Promise<string> {
  if (!commitHash || !filePath) return ''
  try {
    return await git(repoPath).show([`${commitHash}:${filePath}`])
  } catch {
    return ''
  }
}

export async function getDiff(
  repoPath: string,
  commitHash: string
): Promise<DiffResult> {
  const g = git(repoPath)

  // Determine parent; root commits have no parent. Use empty tree SHA for diff.
  const parentsRaw = await g.raw(['rev-list', '--parents', '-n', '1', commitHash])
  const parts = parentsRaw.trim().split(/\s+/)
  const parent = parts[1] || '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // empty tree

  // Numstat + status gives additions/deletions + rename detection
  const numstatRaw = await g.raw([
    'diff',
    '--numstat',
    '--find-renames',
    `${parent}`,
    commitHash
  ])
  const nameStatusRaw = await g.raw([
    'diff',
    '--name-status',
    '--find-renames',
    `${parent}`,
    commitHash
  ])

  type PerFile = {
    status: FileChangeStatus
    path: string
    oldPath?: string
    additions: number
    deletions: number
    isBinary: boolean
  }
  const files = new Map<string, PerFile>()

  // --numstat format: <add>\t<del>\t<path>  (binary: "- -")
  for (const line of numstatRaw.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [addStr, delStr, ...rest] = parts
    const rawPath = rest.join('\t')
    const isBinary = addStr === '-' && delStr === '-'
    // renames may appear as "old => new"; we'll rely on name-status below for clean path
    const additions = isBinary ? 0 : parseInt(addStr, 10) || 0
    const deletions = isBinary ? 0 : parseInt(delStr, 10) || 0
    const cleanPath = rawPath.includes('=>')
      ? rawPath.replace(/.*=>\s*/, '').replace(/[{}]/g, '')
      : rawPath
    files.set(cleanPath, {
      status: 'modified',
      path: cleanPath,
      additions,
      deletions,
      isBinary
    })
  }

  // --name-status gives R100\told\tnew etc.
  for (const line of nameStatusRaw.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split('\t')
    const code = parts[0]
    const status = parseStatus(code)
    if (status === 'renamed' || status === 'copied') {
      const oldP = parts[1]
      const newP = parts[2]
      const existing = files.get(newP) || {
        status,
        path: newP,
        additions: 0,
        deletions: 0,
        isBinary: false
      }
      existing.status = status
      existing.oldPath = oldP
      files.set(newP, existing)
    } else {
      const p = parts[1]
      if (!p) continue
      const existing = files.get(p) || {
        status,
        path: p,
        additions: 0,
        deletions: 0,
        isBinary: false
      }
      existing.status = status
      files.set(p, existing)
    }
  }

  const diffFiles: DiffFile[] = []
  let totalAdds = 0
  let totalDels = 0

  for (const f of files.values()) {
    totalAdds += f.additions
    totalDels += f.deletions

    const language = detectLanguage(f.path)

    if (f.isBinary) {
      diffFiles.push({
        path: f.path,
        oldPath: f.oldPath,
        status: f.status,
        additions: 0,
        deletions: 0,
        isBinary: true,
        isTooLarge: false,
        oldContent: '',
        newContent: '',
        language
      })
      continue
    }

    const isLarge = f.additions + f.deletions > MAX_FILE_LINES

    let oldContent = ''
    let newContent = ''

    // Always fetch content regardless of size (UI will show warning for large files)
    if (f.status !== 'added') {
      oldContent = await getFileAtCommit(
        repoPath,
        parent,
        f.oldPath || f.path
      )
    }
    if (f.status !== 'deleted') {
      newContent = await getFileAtCommit(repoPath, commitHash, f.path)
    }

    diffFiles.push({
      path: f.path,
      oldPath: f.oldPath,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      isBinary: false,
      isTooLarge: isLarge,
      oldContent,
      newContent,
      language
    })
  }

  // Sort: changed files with most impact first
  diffFiles.sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions)
  )

  return {
    commitHash,
    files: diffFiles,
    totalAdditions: totalAdds,
    totalDeletions: totalDels
  }
}

export async function getUnifiedDiffText(
  repoPath: string,
  commitHash: string
): Promise<string> {
  const g = git(repoPath)
  try {
    return await g.raw([
      'show',
      '--format=',
      '--patch',
      '--no-color',
      '--find-renames',
      commitHash
    ])
  } catch {
    return ''
  }
}
