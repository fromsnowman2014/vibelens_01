import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { AnalysisResult } from '@shared/types'
import { SCHEMA_VERSION } from '@shared/types'
import { getKey } from '../keychainService'
import { getSystemPrompt, buildUserMessage } from './prompts'
import { logger } from '../../utils/logger'
import { renderAnalysisMarkdown } from '../cacheService'
import type { AnalyzeCommitInput, ChatResult, LLMProvider } from './LLMProvider'

const schema = z.object({
  summary: z.string(),
  whatChanged: z.array(z.string()),
  whyItMatters: z.string(),
  risks: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([])
})

const MODEL_ID = 'claude-sonnet-4-5'

async function makeClient(): Promise<Anthropic> {
  const apiKey = await getKey('claude')
  if (!apiKey) {
    throw new Error(
      'No Claude API key configured. Open Settings and paste your Anthropic API key.'
    )
  }
  return new Anthropic({ apiKey })
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) return fenceMatch[1].trim()
  // Also handle: text that includes prose then a JSON object
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

async function callClaude(
  client: Anthropic,
  system: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const response = await client.messages.create(
    {
      model: MODEL_ID,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userMessage }]
    },
    { signal }
  )
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return {
    text,
    usage: {
      input: response.usage?.input_tokens ?? 0,
      output: response.usage?.output_tokens ?? 0
    }
  }
}

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude' as const

  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = await makeClient()
      await client.messages.create({
        model: MODEL_ID,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { ok: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  }

  async analyzeCommit(input: AnalyzeCommitInput): Promise<AnalysisResult> {
    const client = await makeClient()
    const system = getSystemPrompt(input.language)
    const userMessage = buildUserMessage({
      commit: input.commit,
      diffText: input.diffText,
      language: input.language
    })

    let totalIn = 0
    let totalOut = 0

    // Attempt 1
    let attempt = await callClaude(client, system, userMessage, input.signal)
    totalIn += attempt.usage.input
    totalOut += attempt.usage.output

    let parsedRaw: unknown
    let unparsed = false
    try {
      parsedRaw = JSON.parse(stripJsonFence(attempt.text))
    } catch {
      // Attempt 2 — reminder
      logger.warn('Claude returned non-JSON, retrying once')
      const retryMessage = input.language === 'ko'
        ? `${userMessage}\n\n이전 응답이 유효한 JSON이 아닙니다. 스키마에 맞는 JSON 객체만 반환하세요. 마크다운 펜스 없이. 모든 값은 한국어로.`
        : `${userMessage}\n\nYour previous response was not valid JSON. Respond again with ONLY the JSON object that matches the schema. No markdown fences. No prose.`
      try {
        attempt = await callClaude(client, system, retryMessage, input.signal)
        totalIn += attempt.usage.input
        totalOut += attempt.usage.output
        parsedRaw = JSON.parse(stripJsonFence(attempt.text))
      } catch {
        unparsed = true
      }
    }

    let summary = ''
    let whatChanged: string[] = []
    let whyItMatters = ''
    let risks: string[] = []
    let followUps: string[] = []

    if (!unparsed) {
      const zresult = schema.safeParse(parsedRaw)
      if (zresult.success) {
        summary = zresult.data.summary
        whatChanged = zresult.data.whatChanged
        whyItMatters = zresult.data.whyItMatters
        risks = zresult.data.risks
        followUps = zresult.data.followUps
      } else {
        unparsed = true
      }
    }

    let rawMarkdown: string
    if (unparsed) {
      // Fall back to raw text so the demo never shows a blank panel.
      rawMarkdown = [
        `# Summary`,
        '_(Model returned non-structured output — showing raw text below.)_',
        ``,
        `## Raw model response`,
        '',
        '```',
        attempt.text.slice(0, 8000),
        '```',
        ''
      ].join('\n')
      summary = input.language === 'ko'
        ? '모델이 비정형 응답을 반환했습니다. 아래에 원문이 표시됩니다.'
        : 'Model returned unstructured output. See raw response below.'
    } else {
      rawMarkdown = renderAnalysisMarkdown({
        summary,
        whatChanged,
        whyItMatters,
        risks,
        followUps
      })
    }

    const result: AnalysisResult = {
      commitHash: input.commit.hash,
      language: input.language,
      summary,
      whatChanged,
      whyItMatters,
      risks,
      followUps,
      rawMarkdown,
      model: MODEL_ID,
      tokensIn: totalIn,
      tokensOut: totalOut,
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      unparsed
    }
    return result
  }

  async chatWithContext(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: string
  ): Promise<ChatResult> {
    const client = await makeClient()

    const systemPrompt = context
      ? `You are VibeLens, an AI assistant that helps developers understand git commits and code changes. You have access to the following analysis context from a commit:\n\n${context}\n\nAnswer the user's questions about this commit concisely and helpfully. Use markdown formatting when appropriate.`
      : `You are VibeLens, an AI assistant that helps developers understand git commits and code changes. Answer concisely and helpfully. Use markdown formatting when appropriate.`

    // Build Anthropic messages array
    const anthropicMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages
    })

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    return {
      text,
      tokensIn: response.usage?.input_tokens ?? 0,
      tokensOut: response.usage?.output_tokens ?? 0
    }
  }
}

export const claudeProvider = new ClaudeProvider()

