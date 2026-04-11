import type { Commit, Language } from '@shared/types'

export const SYSTEM_PROMPT_EN = `You are VibeLens, an expert code reviewer that reverse-engineers a git commit.
Given a single commit's diff, explain WHAT changed, WHY it likely matters, and what the original
prompt / intent may have looked like — assuming the author used an AI coding assistant.

Respond with a SINGLE JSON object and NOTHING ELSE. No markdown fences, no commentary.
Schema:
{
  "summary":      string,   // 1-2 sentences, non-trivial
  "whatChanged":  string[], // 3-6 bullets, file-level or logical
  "whyItMatters": string,   // 1-3 sentences about intent / user value
  "risks":        string[], // 0-4 bullets; empty array if none
  "followUps":    string[]  // 0-4 bullets of sensible next steps
}

Rules:
- Do not invent APIs or files not in the diff.
- Prefer concrete file and function names over generalities.
- If the diff is trivial (whitespace, rename-only) say so honestly in summary.
- If the diff is extremely large or truncated, focus on the most impactful parts.
- Output must be valid JSON parseable by JSON.parse.`

export const SYSTEM_PROMPT_KO = `당신은 VibeLens입니다. 하나의 git 커밋의 diff를 분석해
"무엇이 바뀌었는지", "왜 바뀌었을지", "작성자가 사용했을 원본 프롬프트/의도"를 역추적하는
전문가입니다. 작성자가 AI 코딩 도구를 사용했다고 가정합니다.

오직 하나의 JSON 객체만 반환하세요. 마크다운 코드펜스나 여분의 설명은 금지입니다.
스키마:
{
  "summary":      string,   // 1~2문장, 평이하지 않게
  "whatChanged":  string[], // 3~6개 항목 (파일/논리 단위)
  "whyItMatters": string,   // 의도/사용자 가치 1~3문장
  "risks":        string[], // 0~4개, 없으면 빈 배열
  "followUps":    string[]  // 0~4개, 합리적인 후속 작업
}

규칙:
- diff에 없는 API나 파일을 지어내지 마세요.
- 일반론보다 구체적 파일·함수명을 선호하세요.
- 사소한 변경(공백, 이름 변경만 등)이면 summary에 솔직히 기술하세요.
- diff가 매우 크거나 잘려있으면 임팩트 큰 부분 위주로 기술하세요.
- JSON.parse 가능한 유효한 JSON만 출력하세요.`

const MAX_DIFF_CHARS = 60_000

export function truncateDiff(diff: string): { text: string; truncated: boolean } {
  if (diff.length <= MAX_DIFF_CHARS) return { text: diff, truncated: false }
  const half = Math.floor(MAX_DIFF_CHARS / 2) - 200
  const head = diff.slice(0, half)
  const tail = diff.slice(-half)
  return {
    text: `${head}\n\n...\n[DIFF TRUNCATED FOR MVP — ${diff.length - MAX_DIFF_CHARS} characters omitted]\n...\n\n${tail}`,
    truncated: true
  }
}

export function buildUserMessage(args: {
  commit: Commit
  diffText: string
  language: Language
}): string {
  const { commit, diffText, language } = args
  const { text, truncated } = truncateDiff(diffText)
  const header =
    language === 'ko'
      ? `# 커밋 메타데이터
- hash: ${commit.shortHash}
- author: ${commit.author}
- date: ${commit.date}
- message: ${commit.subject}

${truncated ? '⚠️ diff가 커서 중간이 생략되었습니다.\n' : ''}
# 통합 diff (unified diff)
\`\`\`diff
${text}
\`\`\``
      : `# Commit metadata
- hash: ${commit.shortHash}
- author: ${commit.author}
- date: ${commit.date}
- message: ${commit.subject}

${truncated ? '⚠️ The diff is large and has been truncated in the middle.\n' : ''}
# Unified diff
\`\`\`diff
${text}
\`\`\``
  return header
}

export function getSystemPrompt(lang: Language): string {
  return lang === 'ko' ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN
}
