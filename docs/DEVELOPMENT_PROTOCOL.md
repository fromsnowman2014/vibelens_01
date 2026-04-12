# VibeLens Development Protocol

## 🎯 핵심 규칙: SOURCE_FUNCTION_MAP.md 우선 참조

**모든 AI 코딩 세션 시작 시 필수 프로토콜**

```
1. docs/SOURCE_FUNCTION_MAP.md 파일을 먼저 읽습니다
2. 작업할 파일 및 함수의 정확한 위치를 확인합니다
3. 불필요한 파일 탐색 및 검색을 하지 않습니다
4. Map에 명시된 경로를 직접 사용하여 작업을 시작합니다
```

---

## 📖 프로젝트 구조 이해하기

### 필수 문서
- **`docs/SOURCE_FUNCTION_MAP.md`** - 전체 소스 구조 및 함수 맵 (이 문서를 항상 먼저 참조)
- **`README.md`** - 프로젝트 개요 및 설치 가이드
- **`README_KR.md`** - 한국어 프로젝트 문서

### 주요 디렉토리
```
src/
├── main/           # Electron 메인 프로세스 (Node.js)
├── renderer/       # React UI (Renderer 프로세스)
├── preload/        # IPC 브릿지
└── shared/         # 공유 타입
```

---

## 🔧 작업 유형별 가이드

### 1. 버그 수정 (Bug Fix)

**프로토콜**:
```
1. SOURCE_FUNCTION_MAP.md → "주요 플로우" 섹션 확인
2. 버그가 발생한 플로우 찾기
3. 관련 파일 경로 확인 (예: src/main/services/gitService.ts:getDiff())
4. 해당 파일만 Read 도구로 열기
5. 버그 수정
6. (선택) Map 파일에 주석 추가 (알려진 이슈였다면)
```

**예시**:
```
문제: "커밋 분석이 실패합니다"
→ SOURCE_FUNCTION_MAP.md → "커밋 분석 플로우" 확인
→ src/renderer/src/stores/analysisStore.ts:analyzeSelected() 확인
→ src/main/services/llm/ClaudeProvider.ts:analyzeCommit() 확인
→ 에러 핸들링 로직 수정
```

---

### 2. 기능 추가 (Feature Development)

**프로토콜**:
```
1. SOURCE_FUNCTION_MAP.md → "핵심 모듈 및 함수 맵" 확인
2. 관련 서비스/컴포넌트 위치 파악
3. 기존 함수 시그니처 확인
4. 새 기능 구현
5. IPC 채널 추가 시 registerIpc.ts, preload/index.ts, types.ts 동시 업데이트
6. SOURCE_FUNCTION_MAP.md 업데이트 (새 함수/IPC 채널 추가)
```

**예시**:
```
기능: "브랜치 비교 기능 추가"
→ SOURCE_FUNCTION_MAP.md → "Git Service" 확인
→ src/main/services/gitService.ts 에 compareBranches() 함수 추가
→ src/main/ipc/registerIpc.ts 에 git:compareBranches 핸들러 추가
→ src/preload/index.ts 에 API 노출
→ src/renderer/src/stores/repoStore.ts 에 compareBranches 액션 추가
→ SOURCE_FUNCTION_MAP.md 업데이트
```

---

### 3. 성능 최적화 (Performance)

**프로토콜**:
```
1. SOURCE_FUNCTION_MAP.md → "주요 개선 포인트 참조" 확인
2. 병목 지점 확인 (예: getDiff(), loadCommits())
3. 해당 함수만 Read로 열기
4. 프로파일링 (필요 시 console.time 추가)
5. 최적화 적용
6. SOURCE_FUNCTION_MAP.md 의 "주요 개선 포인트" 섹션 업데이트
```

---

### 4. 에러 핸들링 개선

**프로토콜**:
```
1. SOURCE_FUNCTION_MAP.md → "에러 핸들링" 섹션 확인
2. 전역 에러 핸들러 위치 확인:
   - 메인: src/main/ipc/registerIpc.ts:wrap()
   - 렌더러: src/renderer/src/api/client.ts:unwrap()
3. 에러 타입별 처리 로직 추가
4. Toast/로그 추가
```

---

## 🚀 효율적인 작업 흐름

### ✅ 권장 워크플로우 (Vibe Coding)

```
[작업 시작]
  ↓
[docs/SOURCE_FUNCTION_MAP.md 읽기] ← 항상 첫 단계
  ↓
[관련 파일 경로 확인]
  ↓
[해당 파일만 Read로 열기]
  ↓
[코드 수정/추가]
  ↓
[필요 시 Map 파일 업데이트]
  ↓
[완료]
```

### ❌ 비효율적인 워크플로우 (피할 것)

```
[작업 시작]
  ↓
[tree 명령으로 전체 소스 탐색] ← 토큰 낭비
  ↓
[grep으로 여러 파일 검색] ← 토큰 낭비
  ↓
[관련 없는 파일까지 Read] ← 토큰 낭비
  ↓
[컨텍스트 오버플로우로 재시작] ← 시간 낭비
```

---

## 📝 Map 파일 업데이트 규칙

**다음 경우 `docs/SOURCE_FUNCTION_MAP.md` 업데이트 필수**:

### 반드시 업데이트해야 하는 경우
- ✅ 새로운 서비스 파일 추가 (`src/main/services/*.ts`)
- ✅ IPC 채널 추가/삭제 (`registerIpc.ts`)
- ✅ 주요 함수 추가/시그니처 변경
- ✅ 새로운 Zustand Store 추가
- ✅ 주요 플로우 변경
- ✅ 새로운 컴포넌트 카테고리 추가

### 업데이트 방법
```typescript
// 예시: 새 IPC 채널 추가 시
1. registerIpc.ts 에 핸들러 추가
2. SOURCE_FUNCTION_MAP.md 열기
3. "2.2 IPC Handlers" → "IPC 채널 목록" 섹션 찾기
4. 해당 카테고리에 새 채널 추가:
   - `git:compareBranches` - 두 브랜치의 diff 비교
5. "Last Updated" 날짜 갱신
```

---

## 🎵 Vibe Coding = 토큰 효율성

### 토큰 사용량 비교

**기존 방식** (전체 탐색):
```
tree 명령어: 500 토큰
grep 검색: 1000 토큰
관련 없는 파일 Read: 2000 토큰
실제 작업: 1500 토큰
---
총 5000 토큰
```

**Vibe Coding** (Map 우선 참조):
```
SOURCE_FUNCTION_MAP.md 읽기: 800 토큰
필요한 파일만 Read: 1000 토큰
실제 작업: 1500 토큰
---
총 3300 토큰 (34% 절감)
```

---

## 🔍 빠른 참조 인덱스

### 자주 수정하는 파일

| 작업 유형 | 파일 경로 | 주요 함수 |
|---------|----------|---------|
| Git 작업 | `src/main/services/gitService.ts` | `getDiff()`, `listCommits()` |
| IPC 추가 | `src/main/ipc/registerIpc.ts` | `registerIpc()`, `wrap()` |
| AI 프롬프트 | `src/main/services/llm/prompts.ts` | `SYSTEM_PROMPT_EN`, `buildUserMessage()` |
| 상태 관리 | `src/renderer/src/stores/*.ts` | Zustand stores |
| UI 컴포넌트 | `src/renderer/src/components/**/*.tsx` | React components |
| 타입 정의 | `src/shared/types.ts` | 공유 타입 |

---

## 🛡️ 체크리스트

### 작업 시작 전
- [ ] `docs/SOURCE_FUNCTION_MAP.md` 읽음
- [ ] 작업할 파일 경로 확인
- [ ] 관련 함수 시그니처 확인
- [ ] 불필요한 파일 탐색 하지 않음

### 작업 완료 후
- [ ] 주요 함수 추가/변경 시 Map 파일 업데이트
- [ ] IPC 채널 추가 시 3개 파일 동시 업데이트 (registerIpc.ts, preload/index.ts, types.ts)
- [ ] 플로우 변경 시 "주요 플로우" 섹션 업데이트
- [ ] "Last Updated" 날짜 갱신

---

## 💡 팁 & 트릭

### 빠른 파일 접근
```typescript
// Map 파일에서 복사 가능한 형식
src/main/services/gitService.ts:getDiff()
→ Read 도구에서 직접 사용
```

### IPC 변경 시 3개 파일 동시 업데이트
```typescript
1. src/main/ipc/registerIpc.ts - 핸들러 구현
2. src/preload/index.ts - API 노출
3. src/shared/types.ts - 타입 정의 (필요 시)
```

### 플로우 추적
```
SOURCE_FUNCTION_MAP.md → "주요 플로우" 섹션
→ 화살표(→)를 따라 흐름 파악
→ 각 단계의 파일:함수 확인
```

---

**이 프로토콜을 따르면 VibeLens의 모든 개발 작업이 Vibe Coding처럼 빠르고 효율적으로 진행됩니다. 🎵**
