import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import type { AnalysisResult } from '@shared/types'
import { SCHEMA_VERSION } from '@shared/types'
import { getKey } from '../keychainService'
import { getSystemPrompt, buildUserMessage } from './prompts'
import { logger } from '../../utils/logger'
import { renderAnalysisMarkdown } from '../cacheService'
import type { AnalyzeCommitInput, ChatResult, LLMProvider } from './LLMProvider'

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

const estimatedPromptSchema = z.object({
  primary: z.string().min(10),
  alternatives: z.array(z.string()).default([]),
  reasoning: z.string().min(20)
})

const learningGuideSchema = z.object({
  keyTechniques: z.array(z.string()).default([]),
  beginnerTips: z.array(z.string()).default([]),
  pitfallsAvoided: z.array(z.string()).default([])
})

const mentoringSchema = z.object({
  commitQuality: z.string().min(20),
  promptSplittingStrategy: z.array(z.string()).default([]),
  codeSmells: z.array(z.string()).default([])
})

const schema = z.object({
  summary: z.string(),
  whatChanged: z.array(z.string()),
  whyItMatters: z.string(),
  risks: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  estimatedPrompt: estimatedPromptSchema.optional(),
  learningGuide: learningGuideSchema.optional(),
  mentoring: mentoringSchema.optional()
})

async function makeClient(): Promise<GoogleGenerativeAI> {
  const apiKey = await getKey('gemini')
  if (!apiKey) {
    throw new Error(
      'No Gemini API key configured. Open Settings and paste your Google AI API key.'
    )
  }
  return new GoogleGenerativeAI(apiKey)
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) return fenceMatch[1].trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

async function callGemini(
  client: GoogleGenerativeAI,
  system: string,
  userMessage: string,
  modelId: string,
  signal?: AbortSignal
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const model = client.getGenerativeModel({
    model: modelId,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 3072
    }
  })

  // Gemini SDK doesn't natively support AbortSignal; wire it manually.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const resultPromise = model.generateContent(userMessage)

  if (signal) {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
      signal.addEventListener('abort', onAbort, { once: true })
      resultPromise
        .then((r) => {
          signal.removeEventListener('abort', onAbort)
          const text = r.response.text()
          const meta = r.response.usageMetadata
          resolve({
            text,
            usage: {
              input: meta?.promptTokenCount ?? 0,
              output: meta?.candidatesTokenCount ?? 0
            }
          })
        })
        .catch((e) => {
          signal.removeEventListener('abort', onAbort)
          reject(e)
        })
    })
  }

  const r = await resultPromise
  const text = r.response.text()
  const meta = r.response.usageMetadata
  return {
    text,
    usage: {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0
    }
  }
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const

  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = await makeClient()
      const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL })
      await model.generateContent('ping')
      return { ok: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  }

  async analyzeCommit(input: AnalyzeCommitInput): Promise<AnalysisResult> {
    const modelId = input.model ?? DEFAULT_GEMINI_MODEL
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
    let attempt = await callGemini(client, system, userMessage, modelId, input.signal)
    totalIn += attempt.usage.input
    totalOut += attempt.usage.output

    let parsedRaw: unknown
    let unparsed = false
    try {
      parsedRaw = JSON.parse(stripJsonFence(attempt.text))
    } catch {
      logger.warn('Gemini returned non-JSON, retrying once')
      const retryMessage =
        input.language === 'ko'
          ? `${userMessage}\n\n이전 응답이 유효한 JSON이 아닙니다. 스키마에 맞는 JSON 객체만 반환하세요. 마크다운 펜스 없이. 모든 값은 한국어로.`
          : `${userMessage}\n\nYour previous response was not valid JSON. Respond again with ONLY the JSON object that matches the schema. No markdown fences. No prose.`
      try {
        attempt = await callGemini(client, system, retryMessage, modelId, input.signal)
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
    let estimatedPrompt: import('@shared/types').EstimatedPrompt | undefined
    let learningGuide: import('@shared/types').LearningGuide | undefined
    let mentoring: import('@shared/types').Mentoring | undefined

    if (!unparsed) {
      const zresult = schema.safeParse(parsedRaw)
      if (zresult.success) {
        summary = zresult.data.summary
        whatChanged = zresult.data.whatChanged
        whyItMatters = zresult.data.whyItMatters
        risks = zresult.data.risks
        followUps = zresult.data.followUps
        estimatedPrompt = zresult.data.estimatedPrompt
        learningGuide = zresult.data.learningGuide
        mentoring = zresult.data.mentoring
      } else {
        unparsed = true
      }
    }

    let rawMarkdown: string
    if (unparsed) {
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
      summary =
        input.language === 'ko'
          ? '모델이 비정형 응답을 반환했습니다. 아래에 원문이 표시됩니다.'
          : 'Model returned unstructured output. See raw response below.'
    } else {
      rawMarkdown = renderAnalysisMarkdown({
        summary,
        whatChanged,
        whyItMatters,
        risks,
        followUps,
        estimatedPrompt,
        learningGuide,
        mentoring
      })
    }

    return {
      commitHash: input.commit.hash,
      language: input.language,
      summary,
      whatChanged,
      whyItMatters,
      risks,
      followUps,
      rawMarkdown,
      model: modelId,
      tokensIn: totalIn,
      tokensOut: totalOut,
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      unparsed,
      estimatedPrompt,
      learningGuide,
      mentoring
    }
  }

  async chatWithContext(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context?: string,
    model?: string
  ): Promise<ChatResult> {
    const modelId = model ?? DEFAULT_GEMINI_MODEL
    const client = await makeClient()

    const systemPrompt = context
      ? `You are VibeLens, an AI assistant that helps developers understand git commits and code changes. You have access to the following analysis context from a commit:\n\n${context}\n\nAnswer the user's questions about this commit concisely and helpfully. Use markdown formatting when appropriate.`
      : `You are VibeLens, an AI assistant that helps developers understand git commits and code changes. Answer concisely and helpfully. Use markdown formatting when appropriate.`

    const geminiModel = client.getGenerativeModel({
      model: modelId,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 2048 }
    })

    // Build conversation history (all but last message) + last user turn
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = geminiModel.startChat({ history })
    const result = await chat.sendMessage(lastMessage?.content ?? '')
    const text = result.response.text()
    const meta = result.response.usageMetadata

    return {
      text,
      tokensIn: meta?.promptTokenCount ?? 0,
      tokensOut: meta?.candidatesTokenCount ?? 0
    }
  }
}

export const geminiProvider = new GeminiProvider()
