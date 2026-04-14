import type { AnalysisResult, Commit, Language, ProviderId } from '@shared/types'

export interface AnalyzeCommitInput {
  commit: Commit
  diffText: string
  language: Language
  signal?: AbortSignal
}

export interface ChatResult {
  text: string
  tokensIn: number
  tokensOut: number
}

export interface LLMProvider {
  id: ProviderId
  analyzeCommit(input: AnalyzeCommitInput): Promise<AnalysisResult>
  ping(): Promise<{ ok: boolean; error?: string }>
  chatWithContext(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: string
  ): Promise<ChatResult>
}

