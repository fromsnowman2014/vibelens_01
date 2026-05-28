# LLM Model Lineup Update Plan

**작성일:** 2026-05-27  
**목적:** 현재 모델 드롭다운에 등록된 구형 모델들을 각 API 공급사의 최신 중저가 모델로 교체한다.

---

## 1. 현황 분석

### 현재 등록된 모델 (`src/shared/types.ts`)

| Provider | Model ID | Name | 문제 |
|----------|----------|------|------|
| claude | `claude-sonnet-4-5` | Claude Sonnet 4.5 | 구형 (2025-09) |
| claude | `claude-haiku-3-5` | Claude Haiku 3.5 | 매우 구형 (Claude 3 세대) |
| gemini | `gemini-2.5-pro` | Gemini 2.5 Pro | Pro = 최고급, 중저가 옵션 없음 |
| openai | `gpt-5-mini` | GPT-5-mini | 중급이지만 신형 |

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/shared/types.ts` L171-182 | `LLM_MODELS` 상수 — 드롭다운 소스 |
| `src/shared/types.ts` L153 | `DEFAULT_CLAUDE_MODEL` 상수 |
| `src/main/services/llm/ClaudeProvider.ts` L43 | `MODEL_ID` 하드코딩 (설정 무시 버그) |
| `src/main/services/llm/LLMProvider.ts` | `AnalyzeCommitInput` 인터페이스 |
| `src/main/ipc/registerIpc.ts` L48-65 | provider 선택 + `analyzeCommit` 호출 |
| `src/main/services/settingsService.ts` L14-15 | 기본 provider/model 설정 |

---

## 2. 각 API 공급사 최신 모델 조사 결과

### 2-1. Anthropic (Claude)

**공식 문서:** https://docs.anthropic.com/en/docs/about-claude/models/overview  
**조회일:** 2026-05-27

| Tier | Model ID | Name | 가격 (input/output per MTok) |
|------|----------|------|------------------------------|
| 고급 | `claude-opus-4-7` | Claude Opus 4.7 | $5 / $25 |
| **중급** | **`claude-sonnet-4-6`** | **Claude Sonnet 4.6** | **$3 / $15** |
| **저급** | **`claude-haiku-4-5`** | **Claude Haiku 4.5** | **$1 / $5** |

- Haiku 3.5 (`claude-haiku-3-5`)는 **Claude 3 세대** → Claude 4.x 세대로 전면 교체 필요
- Sonnet 4.5 → Sonnet 4.6으로 업그레이드 (동일 가격, 성능 향상)
- Haiku 4.5 API alias: `claude-haiku-4-5` (내부 ID: `claude-haiku-4-5-20251001`)

### 2-2. Google (Gemini)

**공식 문서:** https://ai.google.dev/gemini-api/docs/models  
**조회일:** 2026-05-27

| Tier | Model ID | Name | 특징 |
|------|----------|------|------|
| 고급 (참고) | `gemini-2.5-pro` | Gemini 2.5 Pro | 최고급, 고비용 — 이번 PR 제외 |
| **중급 (선택)** | **`gemini-2.5-flash`** | **Gemini 2.5 Flash** | 속도·비용 균형, 안정 검증 버전 |
| **저급 (선택)** | **`gemini-3.1-flash-lite`** | **Gemini 3.1 Flash-Lite** | 속도·비용 최적화 |
| 참고 | `gemini-2.5-flash-lite` | Gemini 2.5 Flash-Lite | 2.5 패밀리 최저가 |
| 참고 | `gemini-3.5-flash` | Gemini 3.5 Flash | 최신 frontier급 (안정성 미검증) |

> **왜 이전 검색에서 구 모델만 보였나?**  
> 코드에 `gemini-2.5-pro`만 등록되어 있었고, Flash/Flash-Lite 계열은 처음부터 추가되지 않았음.  
> `gemini-2.5-flash`는 검증된 중급 옵션으로 default 선택.  
> `gemini-3.1-flash-lite`는 저급 선택 (Gemini 3.x 계열 중 유일하게 안정성 검증 완료).  
> `gemini-2.0-flash-lite`는 **2026-06-01 deprecation** 예정 → 신규 사용 금지.

**선택 모델:** `gemini-2.5-flash` (중급 default) + `gemini-3.1-flash-lite` (저급)

### 2-3. OpenAI

**공식 문서:** https://platform.openai.com/docs/models  
**조회일:** 2026-05-27

| Tier | Model ID | Name | 특징 |
|------|----------|------|------|
| 고급 (참고) | `gpt-4o` | GPT-4o | flagship, 고비용 — 이번 PR 제외 |
| **중급 (선택, default)** | **`gpt-4o-mini`** | **GPT-4o mini** | 검증된 중급, 기존 유지 |
| **중급 (선택, 신형)** | **`gpt-4.1-mini`** | **GPT-4.1 mini** | 1M context, 비용 효율 (2025-04 출시) |
| 저급 (미포함) | `gpt-4.1-nano` | GPT-4.1 nano | 가장 빠르고 저렴 (추후 PR에서 추가) |

> **왜 GPT-4o만 있었나?**  
> 코드 작성 당시 GPT-4.1 시리즈가 없었거나 추가되지 않은 것. GPT-4.1 mini/nano는 2025년 4월 출시됨.  
> `gpt-4.1-mini-2025-04-14`, `gpt-4.1-nano-2025-04-14` snapshot도 사용 가능.  
> `gpt-4o-mini`는 기존에 검증된 모델로 default 유지. GPT-5 계열은 안정성 검증 후 추후 추가.

**선택 모델:** `gpt-4o-mini` (중급 default, 검증됨) + `gpt-4.1-mini` (중급 신형)

---

## 3. 변경 후 모델 라인업

```typescript
export const LLM_MODELS: Record<ProviderId, ModelDef[]> = {
  claude: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', default: true },  // 중급
    { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5' }                   // 저급
  ],
  gemini: [
    { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash', default: true }, // 중급
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' }            // 저급
  ],
  openai: [
    { id: 'gpt-4o-mini',   name: 'GPT-4o mini', default: true }, // 중급 (검증됨)
    { id: 'gpt-4.1-mini',  name: 'GPT-4.1 mini' }                // 중급 (신형)
  ]
}
```

---

## 4. 버그 수정: ClaudeProvider MODEL_ID 하드코딩

### 문제

`ClaudeProvider.ts` L43에 `const MODEL_ID = 'claude-sonnet-4-5'`가 하드코딩되어 있어,  
사용자가 UI에서 모델을 변경해도 **실제 API 호출은 항상 Sonnet 4.5로 고정**된다.

### 해결 방법

`AnalyzeCommitInput`과 `chatWithContext`에 `model` 필드를 추가하고,  
`registerIpc.ts`에서 `settings.activeModel`을 주입하는 방식으로 수정한다.

#### 4-1. `LLMProvider.ts` 수정

```typescript
export interface AnalyzeCommitInput {
  commit: Commit
  diffText: string
  language: Language
  model?: string        // 추가
  signal?: AbortSignal
}
```

`LLMProvider` 인터페이스의 `chatWithContext`도 model 파라미터 추가:

```typescript
chatWithContext(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context?: string,
  model?: string        // 추가
): Promise<ChatResult>
```

#### 4-2. `ClaudeProvider.ts` 수정

```typescript
// 제거: const MODEL_ID = 'claude-sonnet-4-5'

// callClaude 함수에 modelId 파라미터 추가
async function callClaude(
  client: Anthropic,
  system: string,
  userMessage: string,
  modelId: string,
  signal?: AbortSignal
): Promise<...>

// analyzeCommit에서 input.model 사용
const modelId = input.model ?? DEFAULT_CLAUDE_MODEL

// chatWithContext에서 model 파라미터 사용
async chatWithContext(..., model?: string) {
  const modelId = model ?? DEFAULT_CLAUDE_MODEL
  ...
}
```

#### 4-3. `registerIpc.ts` 수정

```typescript
// analyzeCommit 호출 시 activeModel 주입
const settings = getSettings()
provider.analyzeCommit({
  ...input,
  model: settings.activeModel
})
```

#### 4-4. `settingsService.ts` 기본값 확인

```typescript
// DEFAULT_CLAUDE_MODEL이 새 모델 ID로 업데이트됐는지 확인
activeModel: DEFAULT_CLAUDE_MODEL  // → 'claude-sonnet-4-6'
```

---

## 5. 작업 순서 (구현 체크리스트)

- [ ] **Step 1** — `src/shared/types.ts`
  - `DEFAULT_CLAUDE_MODEL` → `'claude-sonnet-4-6'`
  - `LLM_MODELS` 전체 교체 (위 3번 참조)

- [ ] **Step 2** — `src/main/services/llm/LLMProvider.ts`
  - `AnalyzeCommitInput`에 `model?: string` 추가
  - `chatWithContext` 시그니처에 `model?: string` 추가

- [ ] **Step 3** — `src/main/services/llm/ClaudeProvider.ts`
  - `MODEL_ID` 상수 제거
  - `callClaude` 함수에 `modelId: string` 파라미터 추가
  - `analyzeCommit`에서 `input.model ?? DEFAULT_CLAUDE_MODEL` 사용
  - `chatWithContext`에서 `model ?? DEFAULT_CLAUDE_MODEL` 사용
  - result 객체의 `model` 필드도 실제 사용 모델 ID로 변경

- [ ] **Step 4** — `src/main/ipc/registerIpc.ts`
  - `analyzeCommit` 호출 시 `model: getSettings().activeModel` 주입
  - chat IPC 핸들러도 동일하게 model 주입

- [ ] **Step 5** — `src/main/services/settingsService.ts`
  - 기본값 `activeModel` 확인 (types.ts의 `DEFAULT_CLAUDE_MODEL`을 따라가므로 자동 반영)

- [ ] **Step 6** — 동작 검증
  - 드롭다운에서 각 모델 선택 후 분석 실행
  - 결과 카드의 `model` 표시가 선택한 모델과 일치하는지 확인

---

## 6. 범위 외 (이번 PR에서 제외)

- Gemini / OpenAI Provider 실제 구현 (registerIpc.ts에 TODO로 남아있음)
- `gpt-4.1-nano` 추가 (안정성 검증 후 추후 PR)
- GPT-5 계열(`gpt-5-mini` 등) 추가 (안정성 검증 후 추후 PR)
- 모델별 max_tokens 차이 대응 (Haiku 4.5: 200k context vs Sonnet 4.6: 1M)

---

## 참고 문서

- [Anthropic Models Overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [OpenAI Models](https://platform.openai.com/docs/models)
- [GPT-4.1 mini](https://platform.openai.com/docs/models/gpt-4.1-mini)
- [GPT-4.1 nano](https://platform.openai.com/docs/models/gpt-4.1-nano)
