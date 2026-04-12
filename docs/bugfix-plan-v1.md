# VibeLens v2.0 — Bugfix & Improvement Plan (v1)

> Created: 2026-04-11  
> Status: **Planning**

---

## Issue Summary

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1 | Online clone 불가 — 오프라인 로컬 폴더만 열 수 있음 | Feature gap | New feature |
| 2 | KO 선택 후 분석 시 영어로만 결과 반환 | Bug | Prompt fix |
| 3 | 대형 파일 diff 미표시 (`isTooLarge` 차단) | UX issue | Limit 제거/가상화 |
| 4 | 한 번 analyze 후 모든 커밋 자동 분석됨 (autoAnalyze 제어 없음) | Bug/UX | Logic + UI |
| 5 | 위 내용 docs에 plan으로 저장 | Process | 이 문서 |

---

## 1. Git Clone from URL (New Feature)

### Root Cause
`repo:open` IPC는 `dialog.showOpenDialog`로 로컬 폴더만 선택 가능.  
URL 입력 및 `git clone` 실행 경로가 전혀 없음.

### Solution
- TitleBar에 "Clone" 버튼 추가 (Open 버튼 옆)
- 새 모달: `CloneRepoDialog.tsx` — URL 입력 + 저장 경로 선택 + progress
- Main process에 `repo:clone` IPC 핸들러 추가 — `simple-git`의 `clone()` 사용
- Clone 완료 후 자동으로 해당 repo open

### Files to Modify

| File | Action | Detail |
|------|--------|--------|
| `src/main/ipc/registerIpc.ts` | **Edit** | `repo:clone` 핸들러 추가 (simpleGit().clone) |
| `src/main/services/gitService.ts` | **Edit** | `cloneRepo(url, destPath)` 함수 추가 |
| `src/preload/index.ts` | **Edit** | `repo.clone(url, dest)` API 추가 |
| `src/renderer/src/components/modals/CloneRepoDialog.tsx` | **Create** | URL 입력 + 경로 선택 + 진행상태 모달 |
| `src/renderer/src/components/layout/TitleBar.tsx` | **Edit** | Clone 버튼 추가 |
| `src/renderer/src/App.tsx` | **Edit** | CloneRepoDialog 상태 관리 + clone 완료 시 openRepo 연동 |

### Todo
- [x] `gitService.ts`에 `cloneRepo(url: string, dest: string)` 추가
- [x] `registerIpc.ts`에 `repo:clone` 핸들러 등록
- [x] `preload/index.ts`에 `repo.clone` 노출
- [x] `CloneRepoDialog.tsx` 생성 (URL input, directory picker, progress/error state)
- [x] `TitleBar.tsx`에 Clone 버튼 배치
- [x] `App.tsx`에 cloneDialog 상태 추가 + clone 성공 시 자동 repo open

---

## 2. Korean (KO) 분석 결과가 영어로 출력되는 문제

### Root Cause
`SYSTEM_PROMPT_KO`는 JSON 스키마 설명만 한국어로 작성되어 있고,  
**"모든 값(value)을 한국어로 작성하라"는 명시적 지시가 없음.**  
Claude는 diff 내용이 영어이므로 기본적으로 영어 값을 반환.

또한 retry 메시지(`ClaudeProvider.ts` line 114)가 항상 영어:
```
"Your previous response was not valid JSON. Respond again with ONLY the JSON object..."
```

### Solution
- `SYSTEM_PROMPT_KO`에 **"모든 JSON 값(value)은 반드시 한국어로 작성"** 규칙 명시 추가
- Retry message도 한국어 버전 분기

### Files to Modify

| File | Action | Detail |
|------|--------|--------|
| `src/main/services/llm/prompts.ts` | **Edit** | KO system prompt에 한국어 작성 규칙 추가 |
| `src/main/services/llm/ClaudeProvider.ts` | **Edit** | Retry 메시지 language 분기 |

### Todo
- [x] `SYSTEM_PROMPT_KO`에 `"- 모든 JSON 값(summary, whatChanged 등)은 반드시 한국어로 작성하세요."` 규칙 추가
- [x] `ClaudeProvider.ts` retry 메시지를 language에 따라 KO/EN 분기

---

## 3. 대형 파일 Diff 미표시 문제

### Root Cause
`gitService.ts` line 117: `MAX_FILE_LINES = 2000`  
additions + deletions > 2000이면 `isTooLarge = true`로 마킹하고 **oldContent/newContent를 아예 fetch하지 않음.**  
`DiffViewer.tsx` line 88-94에서 `isTooLarge`면 "Diff too large" 메시지만 표시.

### Solution
`MAX_FILE_LINES` 제한을 **제거** (또는 매우 높은 값으로). 모든 파일의 content를 fetch.  
단, 렌더링 성능을 위해 `react-diff-viewer`에 매우 큰 파일은 경고 배너를 표시하되 diff는 보여줌.

### Files to Modify

| File | Action | Detail |
|------|--------|--------|
| `src/main/services/gitService.ts` | **Edit** | `MAX_FILE_LINES` 제거 또는 극대화, `isTooLarge` 로직 수정 → 항상 content fetch |
| `src/renderer/src/components/center/DiffViewer.tsx` | **Edit** | `isTooLarge` 차단 제거, 대신 경고 배너 + diff 표시 |

### Todo
- [x] `gitService.ts`: `isTooLarge` 판정을 제거하거나 content fetch를 항상 수행하도록 변경
- [x] `DiffViewer.tsx`: `isTooLarge` 일 때도 diff를 렌더링, 상단에 "Large file" 경고만 표시

---

## 4. Auto-Analyze 제어 기능 부재

### Root Cause
`App.tsx` line 77-99: `selectedHash` 변경 시 `settings.autoAnalyze === true`이면 무조건 분석 호출.  
**문제**: `autoAnalyze` 설정값이 기본 `true`이고, UI에서 이를 토글할 수 있는 컨트롤이 없음.  
사용자가 한 번 analyze 버튼을 누른 후 다른 커밋을 클릭하면 자동 분석이 연속 실행됨 (autoAnalyze가 true이므로).

### Solution
1. `autoAnalyze` 기본값을 `false`로 변경
2. AIContextPanel 상단에 "Auto" 체크박스 추가 (새로고침 버튼 옆)
3. 체크박스 토글 시 `settings.autoAnalyze` 업데이트

### Files to Modify

| File | Action | Detail |
|------|--------|--------|
| `src/main/services/settingsService.ts` | **Edit** | `autoAnalyze` 기본값 `false`로 변경 |
| `src/renderer/src/components/right/AIContextPanel.tsx` | **Edit** | Auto 체크박스 UI 추가 (RefreshCw 버튼 옆) |
| `src/renderer/src/stores/settingsStore.ts` | **Edit** | `toggleAutoAnalyze()` action 추가 |

### Todo
- [x] `settingsService.ts`: `autoAnalyze` default → `false`
- [x] `settingsStore.ts`: `toggleAutoAnalyze()` 추가
- [x] `AIContextPanel.tsx`: 새로고침 버튼 옆에 "Auto" 체크박스 + 토글 로직

---

## Execution Order (추천 순서)

효율성을 위해 의존성이 없는 것부터:

1. **Issue #2** (Prompt fix) — 2개 파일, 가장 단순
2. **Issue #4** (Auto-analyze toggle) — 3개 파일, UI + default 변경
3. **Issue #3** (Large diff display) — 2개 파일, 제한 해제
4. **Issue #1** (Git clone) — 6개 파일, 가장 복잡 (새 모달 + IPC)

---

## Full File Access Map

```
수정 대상 파일 총 11개 (중복 제거):

src/main/services/llm/prompts.ts          — #2
src/main/services/llm/ClaudeProvider.ts    — #2
src/main/services/gitService.ts            — #1, #3
src/main/services/settingsService.ts       — #4
src/main/ipc/registerIpc.ts               — #1
src/preload/index.ts                      — #1
src/renderer/src/App.tsx                  — #1
src/renderer/src/stores/settingsStore.ts  — #4
src/renderer/src/components/layout/TitleBar.tsx         — #1
src/renderer/src/components/center/DiffViewer.tsx       — #3
src/renderer/src/components/right/AIContextPanel.tsx    — #4

신규 생성 1개:
src/renderer/src/components/modals/CloneRepoDialog.tsx  — #1
```

---

## Verification Checklist

- [ ] KO 선택 후 analyze → 결과가 한국어로 표시되는지 확인 (requires runtime test with API key)
- [ ] Auto 체크박스 off 상태에서 커밋 클릭 → 자동 분석 안 됨 확인
- [ ] Auto 체크박스 on 상태에서 커밋 클릭 → 자동 분석 됨 확인
- [ ] 4000+ 라인 diff 파일 → diff 내용이 정상 표시되는지 확인
- [ ] Clone dialog에서 GitHub URL 입력 → clone + 자동 open 확인
- [x] `npm run typecheck` 클린 통과
- [x] `npm run build` 성공
