import type { AnalysisResult, Commit, Language } from '@shared/types'

export interface AnalyzeCommitInput {
  commit: Commit
  diffText: string
  language: Language
  signal?: AbortSignal
}

export interface LLMProvider {
  id: 'claude'
  analyzeCommit(input: AnalyzeCommitInput): Promise<AnalysisResult>
  ping(): Promise<{ ok: boolean; error?: string }>
}
