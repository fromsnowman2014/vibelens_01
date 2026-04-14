// Shared types used by both main and renderer processes.
// Keep this file dependency-free (no Node/Electron imports).

export type Language = 'ko' | 'en'
export type ProviderId = 'claude' | 'gemini' | 'openai'

export interface RecentRepo {
  path: string
  name: string
  lastOpened?: number // Phase 2: timestamp
  branch?: string // Phase 2: last viewed branch
}

export interface Commit {
  hash: string
  shortHash: string
  message: string
  subject: string
  author: string
  email: string
  date: string // ISO
  relativeDate: string
  parents: string[]
}

export type FileChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'type-changed'
  | 'unknown'

export interface DiffFile {
  path: string
  oldPath?: string
  status: FileChangeStatus
  additions: number
  deletions: number
  isBinary: boolean
  isTooLarge: boolean
  oldContent: string
  newContent: string
  language?: string
}

export interface DiffResult {
  commitHash: string
  files: DiffFile[]
  totalAdditions: number
  totalDeletions: number
}

export interface BranchInfo {
  current: string
  all: string[]
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: TreeNode[]
}

export interface AnalysisResult {
  commitHash: string
  language: Language
  summary: string
  whatChanged: string[]
  whyItMatters: string
  risks: string[]
  followUps: string[]
  rawMarkdown: string
  model: string
  tokensIn: number
  tokensOut: number
  generatedAt: string // ISO
  schemaVersion: number
  unparsed: boolean
}

export interface AnalysisMeta {
  commitHash: string
  model: string
  tokensIn: number
  tokensOut: number
  generatedAt: string
  schemaVersion: number
  languagesGenerated: Language[]
  unparsed?: boolean
}

export interface Settings {
  theme: 'dark'
  language: Language
  consentAccepted: boolean
  gitignoreAsked: Record<string, boolean> // repoPath → asked flag
  recentRepos: RecentRepo[]
  claudeModel: string
  autoAnalyze: boolean
  activeProvider: ProviderId
  activeModel: string
}

export interface OpenRepoResult {
  path: string
  valid: boolean
  reason?: string
}

export interface IpcError {
  ok: false
  error: string
  code?: string
}
export type IpcOk<T> = { ok: true; data: T }
export type IpcResult<T> = IpcOk<T> | IpcError

export interface AnalyzeArgs {
  repoPath: string
  commit: Commit
  diffText: string
  language: Language
  force?: boolean
}

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5'
export const SCHEMA_VERSION = 1

// Chat types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Multi-LLM model definitions
export interface ModelDef {
  id: string
  name: string
  default?: boolean
}

export const LLM_MODELS: Record<ProviderId, ModelDef[]> = {
  claude: [
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', default: true },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' }
  ],
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', default: true }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', default: true }
  ]
}
