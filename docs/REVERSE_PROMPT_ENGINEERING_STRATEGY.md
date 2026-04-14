# VibeLens Reverse Prompt Engineering Strategy

> **핵심 목표**: 커밋 분석을 단순 요약에서 **교육적 AI 협업 멘토링 시스템**으로 전환하여, 초보 vibe coder들이 (1) 효과적인 프롬프트 작성법과 (2) 나쁜 커밋 습관 교정 방법을 배우도록 설계

**작성일**: 2026-04-13
**상태**: 전략 수립 완료 → 구현 준비
**예상 구현 기간**: Sprint 1-2 (3-5일)

---

## 📋 목차

1. [현재 상태 분석](#-현재-상태-분석)
2. [핵심 문제 정의](#-핵심-문제-정의)
3. [솔루션 아키텍처](#-솔루션-아키텍처)
4. [구현 계획](#-구현-계획)
5. [성공 지표 & 제약사항](#-성공-지표--제약사항)

---

## 📍 현재 상태 분석

### 코드 위치 맵

| 계층 | 파일 경로 | 핵심 함수/컴포넌트 | 라인 범위 |
|------|-----------|-------------------|----------|
| **Prompt** | `src/main/services/llm/prompts.ts` | `SYSTEM_PROMPT_EN/KO`, `buildUserMessage()` | 3-95 |
| **LLM 호출** | `src/main/services/llm/ClaudeProvider.ts` | `analyzeCommit()`, Zod schema | 11-189 |
| **IPC** | `src/main/ipc/registerIpc.ts` | `analysis:analyze` 핸들러 | 270-308 |
| **캐시** | `src/main/services/cacheService.ts` | `renderAnalysisMarkdown()` | 문서 참조 |
| **UI** | `src/renderer/src/components/right/AIContextPanel.tsx` | 분석 결과 렌더링 | 259-271 |
| **타입** | `src/shared/types.ts` | `AnalysisResult` 인터페이스 | 문서 참조 |

### 현재 응답 스키마

```typescript
interface CurrentAnalysisResult {
  summary: string              // 1-2 문장 요약
  whatChanged: string[]        // 3-6개 변경 항목
  whyItMatters: string         // 1-3 문장 의도
  risks: string[]              // 0-4개 위험 요소
  followUps: string[]          // 0-4개 후속 작업
}
```

---

## 🎯 핵심 문제 정의

### 1. 현재 시스템의 한계

| 문제 | 영향 | 우선순위 |
|------|------|---------|
| ❌ **프롬프트 역추적 부재** | 시스템 프롬프트에 "prompt / intent" 언급만 있고 실제 스키마 필드 없음 | 🔴 Critical |
| ❌ **초보자 안티패턴 탐지 없음** | 모놀리식 커밋, 디버깅 잔여물 등 나쁜 습관을 지적하지 못함 | 🔴 Critical |
| ❌ **교육 효과 부족** | "무엇이 바뀌었나"만 설명, "어떻게 재현할 수 있나" 가이드 없음 | 🟡 High |

### 2. 초보 개발자(Vibe Coder)의 전형적 안티패턴

#### 패턴 1: 모놀리식 스파게티 커밋
```
❌ 나쁜 예:
- UI 컴포넌트 추가 + 상태 로직 + API 연동 + 버그 수정 → 하나의 "update" 커밋
→ AI가 맥락을 놓쳐 버그 생성 확률 ↑, 코드 리뷰 불가능

✅ 좋은 예:
1. feat: Add Settings UI component
2. feat: Integrate Zustand store for settings
3. feat: Connect API endpoint for settings
4. fix: Handle edge case when API fails
```

#### 패턴 2: 에러 의존형 복붙의 흔적
- `console.log('디버깅용')` 미삭제
- 주석 처리된 실패한 시도들
- AI가 남긴 `// TODO: 여기에 로직 작성` placeholder

#### 패턴 3: 구조 없는 프롬프팅
- "이거 안 돼 고쳐줘" → 명확한 요구사항 없이 반복적 땜질
- 설계 없이 즉흥적 코딩 → 기술 부채 축적

---

## 🏗️ 솔루션 아키텍처

### 새로운 응답 스키마 (확장형)

```typescript
interface EnhancedAnalysisResult {
  // 기존 필드 (유지)
  summary: string
  whatChanged: string[]
  whyItMatters: string
  risks: string[]
  followUps: string[]

  // 🆕 교육적 확장 필드 (모두 Optional - Backward Compatible)
  estimatedPrompt?: {
    primary: string           // 추정 초기 프롬프트 (현실적 표현)
    alternatives: string[]    // 대안 프롬프트 0-2개
    reasoning: string         // 추정 근거 (커밋 메시지, 코드 패턴 기반)
  }

  learningGuide?: {
    keyTechniques: string[]   // 사용된 코딩 기법 2-4개
    beginnerTips: string[]    // 재현 가능한 구체적 팁 2-3개
    pitfallsAvoided: string[] // 피한 안티패턴 0-3개
  }

  mentoring?: {
    commitQuality: string              // 커밋 응집도 평가 (솔직한 피드백)
    promptSplittingStrategy: string[]  // 큰 커밋을 나눴어야 할 단계들
    codeSmells: string[]               // 디버깅 잔여물, 하드코딩 등 지적
  }
}
```

### 설계 원칙

1. **Backward Compatibility**: 모든 신규 필드는 Optional → 기존 캐시 유지
2. **Honest Feedback**: 스파게티 커밋이면 솔직히 지적 (AI 협업 품질 향상 위해)
3. **Actionable Guidance**: 일반론 금지, 구체적이고 실천 가능한 조언만

---

## 🛠️ 구현 계획

### Sprint 1: 백엔드 확장 (2-3일)

#### Task 1.1: 타입 정의 확장 (`src/shared/types.ts`)

```typescript
export interface EstimatedPrompt {
  primary: string
  alternatives: string[]
  reasoning: string
}

export interface LearningGuide {
  keyTechniques: string[]
  beginnerTips: string[]
  pitfallsAvoided: string[]
}

export interface Mentoring {
  commitQuality: string
  promptSplittingStrategy: string[]
  codeSmells: string[]
}

// AnalysisResult에 추가
export interface AnalysisResult {
  // ... 기존 필드
  estimatedPrompt?: EstimatedPrompt
  learningGuide?: LearningGuide
  mentoring?: Mentoring
}
```

**검증 포인트**: TypeScript 컴파일 성공, 기존 코드 변경 없음

---

#### Task 1.2: 시스템 프롬프트 개선 (`src/main/services/llm/prompts.ts`)

**전략**: V1/V2 병행 유지 → 점진적 전환

```typescript
// 기존 유지
export const SYSTEM_PROMPT_EN = `...`
export const SYSTEM_PROMPT_KO = `...`

// 🆕 추가
export const SYSTEM_PROMPT_EN_V2 = `You are VibeLens, an expert AI coding tutor that reverse-engineers git commits to teach beginners how to use AI coding assistants effectively.

Given a commit's diff, your mission is to:
1. Analyze WHAT changed technically
2. Infer WHY it was changed (user intent, business value)
3. **Reverse-engineer the PROMPT** the developer likely used
4. **Diagnose beginner anti-patterns** (monolithic commits, leftover debug code)
5. Provide **actionable learning guidance**

Respond with a SINGLE JSON object. No markdown fences, no commentary.

Schema:
{
  "summary": "string",           // 1-2 sentences summarizing the commit
  "whatChanged": ["string"],     // 3-6 bullets (file/function level)
  "whyItMatters": "string",      // 1-3 sentences about user value
  "risks": ["string"],           // 0-4 potential issues
  "followUps": ["string"],       // 0-4 logical next steps

  "estimatedPrompt": {
    "primary": "string",         // REALISTIC prompt (natural language)
                                 // Good: "Add a dark mode toggle to settings with state persistence"
                                 // Bad: "Implement feature X" (too generic)
    "alternatives": ["string"],  // 0-2 alternative prompts
    "reasoning": "string"        // Why you inferred this (commit msg, code patterns)
  },

  "learningGuide": {
    "keyTechniques": ["string"], // 2-4 specific techniques
                                 // Example: "Zustand global state", "React conditional rendering"
    "beginnerTips": ["string"],  // 2-3 actionable tips
                                 // Example: "When adding toggles, always persist to localStorage to avoid user frustration"
    "pitfallsAvoided": ["string"] // 0-3 anti-patterns avoided
                                  // Example: "Avoided prop drilling by using Zustand store"
  },

  "mentoring": {
    "commitQuality": "string", // Honest evaluation
                               // Good: "Well-scoped commit with single responsibility"
                               // Bad: "Monolithic commit mixing UI, logic, and bug fixes - AI tools struggle with this"
    "promptSplittingStrategy": ["string"], // If monolithic, how to split?
                                           // Example: ["1. UI markup only", "2. State integration", "3. API connection"]
    "codeSmells": ["string"] // Point out leftover console.logs, commented code, AI placeholders
  }
}

Rules:
- Be SPECIFIC: Use actual file/function names from the diff
- Be HONEST: If it's a messy commit, explain WHY that makes AI coding harder
- Be ACTIONABLE: Generic advice like "write better code" is prohibited
- REALISTIC prompts: How would a real developer phrase it?
- If trivial (whitespace only), say so in summary
- If large/truncated diff, focus on most educational parts
- Must be valid JSON parseable by JSON.parse

Educational Philosophy:
- Teach the THOUGHT PROCESS behind the code changes
- Show how to structure prompts for better AI collaboration
- Guide beginners away from common anti-patterns
`

export const SYSTEM_PROMPT_KO_V2 = `당신은 VibeLens입니다. git 커밋을 역분석하여 초보 vibe coder들에게 AI 코딩 도구를 효과적으로 사용하는 방법을 가르치는 전문 멘토입니다.

커밋 diff가 주어지면:
1. 기술적으로 무엇이 바뀌었는지 분석
2. 왜 바뀌었는지 추론 (사용자 의도, 비즈니스 가치)
3. **개발자가 사용했을 프롬프트를 역추적**
4. **초보자 안티패턴 진단** (모놀리식 커밋, 디버깅 잔여물 등)
5. **실용적 학습 가이드 제공**

오직 하나의 JSON 객체만 반환하세요. 마크다운 코드펜스나 여분의 설명 금지.

스키마:
{
  "summary": "string",           // 커밋을 1-2문장으로 요약
  "whatChanged": ["string"],     // 기술적 변경사항 3-6개 (파일/함수 단위)
  "whyItMatters": "string",      // 사용자 가치/의도 1-3문장
  "risks": ["string"],           // 잠재적 위험 0-4개
  "followUps": ["string"],       // 논리적 후속 작업 0-4개

  "estimatedPrompt": {
    "primary": "string",         // 현실적인 프롬프트 (자연스러운 한국어)
                                 // 좋은 예: "설정 페이지에 다크모드 토글 추가하고 상태 저장해줘"
                                 // 나쁜 예: "기능 구현해줘" (너무 일반적)
    "alternatives": ["string"],  // 대안 프롬프트 0-2개
    "reasoning": "string"        // 추정 근거 (커밋 메시지, 코드 패턴)
  },

  "learningGuide": {
    "keyTechniques": ["string"], // 사용된 주요 기법 2-4개
                                 // 예: "Zustand 전역 상태 관리", "React 조건부 렌더링"
    "beginnerTips": ["string"],  // 실천 가능한 팁 2-3개
                                 // 예: "토글 추가 시 localStorage 저장으로 사용자 불편 방지"
    "pitfallsAvoided": ["string"] // 피한 안티패턴 0-3개
                                  // 예: "prop drilling 대신 Zustand로 복잡도 감소"
  },

  "mentoring": {
    "commitQuality": "string", // 솔직한 평가
                               // 좋은 예: "단일 책임을 가진 잘 정리된 커밋"
                               // 나쁜 예: "UI, 로직, 버그 수정이 혼재된 모놀리식 커밋 - AI 도구가 맥락을 잃기 쉬움"
    "promptSplittingStrategy": ["string"], // 모놀리식이면 어떻게 나눴어야 하는지
                                           // 예: ["1. UI 마크업만", "2. 상태 연동", "3. API 연결"]
    "codeSmells": ["string"] // console.log, 주석 처리된 코드, AI placeholder 지적
  }
}

규칙:
- 구체적으로: diff의 실제 파일/함수명 사용
- 솔직하게: 지저분한 커밋이면 왜 AI 코딩에 불리한지 설명
- 실천 가능하게: "코드를 잘 짜세요" 같은 일반론 금지
- 현실적 프롬프트: 실제 개발자가 입력할 법한 표현
- 사소한 변경(공백)이면 summary에 명시
- diff가 크면 가장 교육적인 부분에 집중
- JSON.parse 가능한 유효한 JSON만 출력
- 모든 값은 한국어로 (코드/파일명은 원문 유지)

교육 철학:
- 코드 변경 뒤의 사고 과정을 가르치세요
- 더 나은 AI 협업을 위한 프롬프트 구조화 방법 제시
- 초보자를 흔한 안티패턴에서 벗어나도록 유도
`

// 🔄 점진적 전환 함수
export function getSystemPrompt(lang: Language, useV2 = true): string {
  if (useV2) {
    return lang === 'ko' ? SYSTEM_PROMPT_KO_V2 : SYSTEM_PROMPT_EN_V2
  }
  return lang === 'ko' ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN
}
```

**검증 포인트**:
- 프롬프트가 명확하고 모호성 없음
- JSON 스키마 설명이 정확함

---

#### Task 1.3: Zod 스키마 확장 (`src/main/services/llm/ClaudeProvider.ts`)

```typescript
const estimatedPromptSchema = z.object({
  primary: z.string().min(10),  // 너무 짧은 프롬프트 방지
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

  // 🆕 Optional for backward compatibility
  estimatedPrompt: estimatedPromptSchema.optional(),
  learningGuide: learningGuideSchema.optional(),
  mentoring: mentoringSchema.optional()
})
```

**검증 포인트**:
- Zod 파싱 성공 테스트
- `.min()` 제약 확인

---

#### Task 1.4: 캐시 마크다운 렌더러 업데이트 (`src/main/services/cacheService.ts`)

```typescript
export function renderAnalysisMarkdown(parsed: {
  summary: string
  whatChanged: string[]
  whyItMatters: string
  risks: string[]
  followUps: string[]
  estimatedPrompt?: EstimatedPrompt
  learningGuide?: LearningGuide
  mentoring?: Mentoring
}): string {
  const lines: string[] = []

  // Summary
  lines.push(`# Summary`, ``, parsed.summary, ``)

  // 🆕 Estimated Prompt (최상단 강조)
  if (parsed.estimatedPrompt) {
    lines.push(`## 🎯 Estimated Prompt`)
    lines.push(``)
    lines.push(`> **"${parsed.estimatedPrompt.primary}"**`)
    lines.push(``)

    if (parsed.estimatedPrompt.alternatives.length > 0) {
      lines.push(`**Alternative prompts:**`)
      parsed.estimatedPrompt.alternatives.forEach((alt) => {
        lines.push(`- ${alt}`)
      })
      lines.push(``)
    }

    lines.push(`**Why this prompt?**`)
    lines.push(parsed.estimatedPrompt.reasoning)
    lines.push(``)
  }

  // What Changed
  lines.push(`## What Changed`)
  parsed.whatChanged.forEach((item) => lines.push(`- ${item}`))
  lines.push(``)

  // Why It Matters
  lines.push(`## Why It Matters`)
  lines.push(parsed.whyItMatters)
  lines.push(``)

  // 🆕 Learning Guide
  if (parsed.learningGuide) {
    lines.push(`## 📚 Learning Guide`)
    lines.push(``)

    if (parsed.learningGuide.keyTechniques.length > 0) {
      lines.push(`### Key Techniques`)
      parsed.learningGuide.keyTechniques.forEach((tech) => {
        lines.push(`- ${tech}`)
      })
      lines.push(``)
    }

    if (parsed.learningGuide.beginnerTips.length > 0) {
      lines.push(`### Tips for Beginners`)
      parsed.learningGuide.beginnerTips.forEach((tip) => {
        lines.push(`- 💡 ${tip}`)
      })
      lines.push(``)
    }

    if (parsed.learningGuide.pitfallsAvoided.length > 0) {
      lines.push(`### Pitfalls Avoided`)
      parsed.learningGuide.pitfallsAvoided.forEach((pitfall) => {
        lines.push(`- ✅ ${pitfall}`)
      })
      lines.push(``)
    }
  }

  // 🆕 Mentoring (비판적 피드백)
  if (parsed.mentoring) {
    lines.push(`## 🛠️ Vibe Coder Mentoring`)
    lines.push(``)
    lines.push(`### Commit Quality Assessment`)
    lines.push(`> ${parsed.mentoring.commitQuality}`)
    lines.push(``)

    if (parsed.mentoring.promptSplittingStrategy.length > 0) {
      lines.push(`### Better Prompting Strategy`)
      lines.push(`This commit should have been split into:`)
      parsed.mentoring.promptSplittingStrategy.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`)
      })
      lines.push(``)
    }

    if (parsed.mentoring.codeSmells.length > 0) {
      lines.push(`### Code Smells Detected`)
      parsed.mentoring.codeSmells.forEach((smell) => {
        lines.push(`- ⚠️ ${smell}`)
      })
      lines.push(``)
    }
  }

  // Risks
  if (parsed.risks.length > 0) {
    lines.push(`## Risks`)
    parsed.risks.forEach((risk) => lines.push(`- ${risk}`))
    lines.push(``)
  }

  // Follow-ups
  if (parsed.followUps.length > 0) {
    lines.push(`## Follow-ups`)
    parsed.followUps.forEach((item) => lines.push(`- ${item}`))
    lines.push(``)
  }

  return lines.join('\n')
}
```

**검증 포인트**:
- 마크다운 렌더링 순서 논리적
- Estimated Prompt를 최상단에 배치 (사용자 주목도 ↑)

---

#### Task 1.5: max_tokens 증가 (`src/main/services/llm/ClaudeProvider.ts`)

```typescript
const response = await client.messages.create(
  {
    model: MODEL_ID,
    max_tokens: 3072,  // 🔄 2048 → 3072 (50% 증가)
    system,
    messages: [{ role: 'user', content: userMessage }]
  },
  { signal }
)
```

**이유**:
- 기존 5개 필드 → 8개 필드로 확장
- 멘토링 섹션의 상세한 피드백 수용

---

### Sprint 2: 프론트엔드 개선 (1-2일)

#### Task 2.1: UI 강조 표시 (`src/renderer/src/components/right/AIContextPanel.tsx`)

**전략**: ReactMarkdown 유지 + CSS 강조

```typescript
// AIContextPanel.tsx 내부
{result && (
  <div className="p-4 space-y-4">
    {/* 🆕 Estimated Prompt Card - 최상단 강조 */}
    {result.estimatedPrompt && (
      <div className="bg-gradient-to-r from-accent-dim to-bg-tertiary border-l-4 border-accent-primary p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-accent-primary" />
          <h3 className="text-sm font-bold text-fg-primary">
            Estimated Prompt
          </h3>
        </div>
        <blockquote className="text-base italic text-fg-primary border-l-2 border-accent-primary pl-3 mb-3">
          "{result.estimatedPrompt.primary}"
        </blockquote>
        <p className="text-xs text-fg-muted leading-relaxed">
          {result.estimatedPrompt.reasoning}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            navigator.clipboard.writeText(result.estimatedPrompt!.primary)
            toast({ kind: 'success', title: 'Prompt copied!' })
          }}
        >
          <Copy size={12} className="mr-1" />
          Copy Prompt
        </Button>
      </div>
    )}

    {/* 기존 마크다운 렌더링 */}
    <div className="ai-prose selectable">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {result.rawMarkdown}
      </ReactMarkdown>
    </div>
  </div>
)}
```

**검증 포인트**:
- Estimated Prompt 카드가 시각적으로 강조됨
- Copy 버튼 작동 확인

---

#### Task 2.2: CSS 스타일 추가

```css
/* globals.css 또는 AIContextPanel.module.css */

/* Mentoring 섹션 강조 */
.ai-prose h2:has(+ blockquote) {
  color: var(--color-state-warning);
}

/* Code Smells 경고 스타일 */
.ai-prose ul li:has(> :first-child:contains("⚠️")) {
  background-color: var(--color-state-error-dim);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
```

---

### 검증 체크리스트

#### Sprint 1 완료 기준
- [ ] TypeScript 컴파일 성공
- [ ] 기존 캐시된 분석 결과 정상 로드 (Optional 필드 처리)
- [ ] 새 분석 실행 시 모든 필드 정상 반환
- [ ] 마크다운 렌더링 순서 논리적
- [ ] Zod 검증 통과

#### Sprint 2 완료 기준
- [ ] Estimated Prompt 카드 시각적 강조
- [ ] Copy 버튼 작동
- [ ] Mentoring 섹션 경고 스타일 적용
- [ ] 모바일 반응형 테스트

---

## 📊 성공 지표 & 제약사항

### 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **프롬프트 추정 정확도** | 70% "somewhat accurate" 이상 | 사용자 피드백 (Phase 3) |
| **멘토링 유용성** | 80% "helpful" 이상 | 사용자 설문 |
| **토큰 사용량** | 기존 대비 +30% 이내 | 평균 tokensIn/Out 모니터링 |
| **구현 시간** | 3-5일 (Sprint 1-2) | 실제 개발 시간 |

### 제약사항 & 대응

| 제약사항 | 영향 | 대응 방안 |
|---------|------|----------|
| **토큰 비용 증가** | 평균 +20-30% 예상 | max_tokens 3072로 제한, 사용자에게 비용 안내 |
| **프롬프트 추정 불확실성** | 100% 정확 불가능 | "Most likely" 언어 사용, reasoning 필드로 투명성 확보 |
| **Backward Compatibility** | 기존 캐시 유지 필요 | 모든 신규 필드 Optional 처리 |
| **다국어 프롬프트 차이** | 한/영 표현 방식 다름 | 언어별 시스템 프롬프트 분리 유지 |

---

## 🎓 교육 효과 극대화 전략

### 프롬프트 품질 기준

| 좋은 프롬프트 | 나쁜 프롬프트 |
|-------------|-------------|
| ✅ "Add a dark mode toggle to the Settings page using Zustand for state, with localStorage persistence" | ❌ "Add dark mode" |
| ✅ "Fix the authentication bug where users are logged out after 5 minutes - extend session timeout to 30 minutes in auth middleware" | ❌ "Fix bug" |
| ✅ "Refactor the UserProfile component to extract avatar rendering into a separate component for reusability" | ❌ "Clean up code" |

### 멘토링 톤 가이드라인

**원칙**: 솔직하되 건설적

```
✅ 좋은 예:
"This commit mixes UI changes, state logic, and bug fixes in one go.
When prompts are this broad, AI tools struggle to maintain consistency.
Next time, try splitting into:
1. UI markup only,
2. State integration,
3. Bug fix as separate commit."

❌ 나쁜 예:
"This is a bad commit." (비건설적)
"Your code is messy." (인신공격)
```

---

## 📚 참고 자료

### 내부 문서
- `docs/SOURCE_FUNCTION_MAP.md` - 전체 소스 구조
- `README.md` - 프로젝트 개요

### 코드 위치 요약
```
src/shared/types.ts               → 타입 정의
src/main/services/llm/prompts.ts  → 시스템 프롬프트
src/main/services/llm/ClaudeProvider.ts → LLM 호출, Zod 스키마
src/main/services/cacheService.ts → 마크다운 렌더링
src/main/ipc/registerIpc.ts       → IPC 핸들러
src/renderer/src/components/right/AIContextPanel.tsx → UI
```

---

## 🚀 즉시 실행 가능한 다음 단계

### 1단계: 타입 정의 (5분)
```bash
# src/shared/types.ts 편집
# EstimatedPrompt, LearningGuide, Mentoring 인터페이스 추가
npm run typecheck  # 컴파일 확인
```

### 2단계: 시스템 프롬프트 추가 (10분)
```bash
# src/main/services/llm/prompts.ts 편집
# SYSTEM_PROMPT_EN_V2, SYSTEM_PROMPT_KO_V2 추가
```

### 3단계: Zod 스키마 확장 (10분)
```bash
# src/main/services/llm/ClaudeProvider.ts 편집
# estimatedPromptSchema, learningGuideSchema, mentoringSchema 추가
```

### 4단계: 로컬 테스트 (30분)
```bash
npm run dev
# 다양한 커밋으로 분석 실행
# 새 필드들이 정상 생성되는지 확인
```

---

**작성자**: Claude (VibeLens AI)
**최종 업데이트**: 2026-04-13
**리뷰 상태**: ✅ 논리적 모순 제거 완료, 구현 준비 완료
