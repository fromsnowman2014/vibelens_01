# VibeLens Source & Function Map

> **목적**: 문제 분석, 개선, 기능 추가 시 전체 소스 구조를 매번 검색하지 않고, 이 맵 파일을 통해 해당 파일 및 함수에 직접 접근하여 토큰을 효율적으로 사용하고 vibe coding을 가능하게 합니다.

**Last Updated**: 2026-04-13 (Phase 2/3-A - 검색 필터, Recent Repos 개선)

---

## 📁 프로젝트 구조 개요

```
vibelens_01/
├── src/
│   ├── main/           # Electron 메인 프로세스
│   ├── renderer/       # React 렌더러 프로세스 (UI)
│   ├── preload/        # Preload 스크립트 (IPC 브릿지)
│   └── shared/         # 공유 타입 정의
├── docs/               # 문서
├── .vibelens/          # 로컬 분석 캐시
└── dist/               # 빌드 출력
```

---

## 🎯 핵심 모듈 및 함수 맵

### 1. **Shared Types** (`src/shared/types.ts`)

**목적**: 메인/렌더러 프로세스 간 공유되는 타입 정의

#### 주요 타입
- `Commit` - 커밋 메타데이터 (hash, author, message 등)
- `DiffFile` - 파일 변경 정보 (path, status, additions/deletions)
- `DiffResult` - 커밋의 전체 diff 결과
- `AnalysisResult` - AI 분석 결과 (summary, whatChanged, risks 등)
- `RecentRepo` - 최근 저장소 정보 (path, name, lastOpened?, branch?) **[Phase 1 추가]**
- `Settings` - 앱 설정 (language, theme, API key 유무, recentRepos 등)
- `IpcResult<T>` - IPC 통신 결과 래퍼 타입

#### 상수
- `DEFAULT_CLAUDE_MODEL` = `'claude-sonnet-4-5'`
- `SCHEMA_VERSION` = `1`

---

### 2. **Main Process** (`src/main/`)

#### 2.1 Entry Point (`src/main/index.ts`)

**주요 함수**:
- `createWindow()` - BrowserWindow 생성 및 설정
- `app.whenReady()` - Electron 앱 초기화 핸들러

**주요 설정**:
- Window: 1440x900, minWidth 1000, hiddenInset titleBar
- Preload: `../preload/index.js`
- Security: contextIsolation=true, nodeIntegration=false

---

#### 2.2 IPC Handlers (`src/main/ipc/registerIpc.ts`)

**목적**: 렌더러 프로세스와 메인 프로세스 간 통신 핸들러 등록

**주요 함수**:
- `registerIpc()` - 모든 IPC 핸들러 등록
- `wrap<T>(fn)` - try/catch 래퍼로 에러 핸들링 통일

**IPC 채널 목록**:

**Repository**:
- `repo:open` - 디렉토리 선택 다이얼로그 → 레포 열기
- `repo:clone` - Git clone 실행
- `repo:selectDirectory` - 클론 대상 디렉토리 선택
- `repo:validate` - 경로가 유효한 Git 레포인지 확인
- `repo:getBranches` - 브랜치 목록 조회
- `repo:openInFinder` - Finder에서 레포 열기

**Git**:
- `git:listCommits` - 커밋 목록 페이징 조회 (limit, offset)
- `git:getDiff` - 특정 커밋의 diff 조회
- `git:getFileAtCommit` - 커밋의 특정 파일 내용 조회

**Settings**:
- `settings:get` - 설정 조회
- `settings:set` - 설정 업데이트 (부분 패치)

**Keychain**:
- `keychain:save` - API 키 저장 (macOS Keychain 또는 safeStorage)
- `keychain:has` - API 키 존재 여부 확인
- `keychain:delete` - API 키 삭제
- `keychain:test` - Claude API 핑 테스트

**Cache**:
- `cache:ensureDir` - `.vibelens/cache` 디렉토리 생성
- `cache:listHashes` - 캐시된 커밋 해시 목록
- `cache:clear` - 캐시 전체 삭제
- `cache:shouldAskGitignore` - .gitignore 추가 여부 물어볼지 확인
- `cache:addToGitignore` - `.vibelens/` 를 .gitignore에 추가

**Analysis**:
- `analysis:getCached` - 디스크 캐시에서 분석 결과 조회
- `analysis:analyze` - Claude API 호출하여 커밋 분석 (force 옵션)
- `analysis:cancel` - 진행 중인 분석 취소

**App**:
- `app:openExternal` - 외부 브라우저에서 URL 열기
- `app:readme` - README.md 파일 읽기

---

#### 2.3 Menu (`src/main/menu.ts`)

**주요 함수**:
- `buildAppMenu(actions: MenuActions)` - macOS 메뉴 바 구축

**메뉴 액션**:
- File → Open Repository (⌘O)
- File → Clone Repository (⌘⇧O) **[Phase 1 추가]**
- File → Close Repository **[Phase 1 추가]**
- Analysis → Refresh Analysis (⌘R)
- Analysis → Toggle Language (⌘L)
- Settings (⌘,)

---

#### 2.4 Services

##### Git Service (`src/main/services/gitService.ts`)

**핵심 함수**:
- `cloneRepo(url, destPath)` - Git clone 실행
- `checkIsRepo(repoPath)` - .git 디렉토리 확인
- `getBranches(repoPath)` - 브랜치 목록 반환 (`BranchInfo`)
- `listCommits(repoPath, branch, limit, offset)` - 커밋 로그 페이징
  - format: `%H %h %s %B %an %ae %aI %ar %P` (구분자 `\x1f`, `\x1e`)
- `getDiff(repoPath, commitHash)` - diff 파싱 (`DiffResult`)
  - `--numstat`, `--name-status`, `--find-renames` 사용
  - 파일별 additions/deletions, status, language 추출
- `getFileAtCommit(repoPath, commitHash, filePath)` - 특정 커밋의 파일 내용
- `getUnifiedDiffText(repoPath, commitHash)` - 통합 diff 텍스트 (LLM 입력용)

**헬퍼 함수**:
- `parseStatus(code)` - git status 코드 → `FileChangeStatus` 매핑
- `detectLanguage(filePath)` - 파일 확장자 → 언어 매핑

---

##### Cache Service (`src/main/services/cacheService.ts`)

**핵심 함수**:
- `ensureCacheDir(repoPath)` - `.vibelens/cache/` 생성 + .gitignore 설정
- `readCache(repoPath, hash, lang)` - 캐시된 분석 결과 조회 (`AnalysisResult | null`)
- `writeCache(repoPath, result)` - 분석 결과를 마크다운 + 메타 JSON으로 저장
  - 파일 형식: `{hash}.{lang}.md`, `{hash}.meta.json`
- `listCachedHashes(repoPath)` - 캐시된 커밋 해시 목록
- `clearCache(repoPath)` - 캐시 디렉토리 전체 삭제
- `isGitignoreMissingEntry(repoPath)` - `.vibelens/` 가 .gitignore에 없는지 확인
- `addVibelensToGitignore(repoPath)` - .gitignore에 `.vibelens/` 추가

**마크다운 헬퍼**:
- `renderAnalysisMarkdown(parsed)` - 구조화된 데이터 → 마크다운 변환
- `extractStructuredFromMarkdown(md)` - 마크다운 → 구조화된 데이터 파싱

**상수**:
- `CACHE_DIR_NAME` = `'.vibelens'`
- `CACHE_SUB` = `'cache'`

---

##### Settings Service (`src/main/services/settingsService.ts`)

**핵심 함수**:
- `getSettings()` - 현재 설정 반환 (`Settings`) + 마이그레이션 로직 **[Phase 1 업데이트]**
- `setSettings(patch)` - 설정 부분 업데이트
- `addRecentRepo(path)` - 최근 레포 목록에 추가 (최대 10개, RecentRepo 타입으로 저장) **[Phase 1 업데이트]**
- `markGitignoreAsked(repoPath)` - .gitignore 물어봤다고 기록

**기본값**:
```typescript
{
  theme: 'dark',
  language: 'en',
  consentAccepted: false,
  gitignoreAsked: {},
  recentRepos: [],  // RecentRepo[] 타입 (Phase 1에서 string[]에서 변경)
  claudeModel: DEFAULT_CLAUDE_MODEL,
  autoAnalyze: false
}
```

**마이그레이션**:
- 기존 `string[]` 형식의 recentRepos를 자동으로 `RecentRepo[]`로 변환

---

##### Keychain Service (`src/main/services/keychainService.ts`)

**핵심 함수**:
- `saveKey(provider, key)` - API 키 저장 (keytar → safeStorage 폴백)
- `getKey(provider)` - API 키 조회
- `deleteKey(provider)` - API 키 삭제
- `hasKey(provider)` - API 키 존재 여부

**ProviderId**: `'claude'`

**저장 방식**:
1. keytar (native macOS Keychain) 우선
2. 실패 시 Electron safeStorage (암호화된 Store)

---

##### LLM Provider (`src/main/services/llm/`)

###### ClaudeProvider (`ClaudeProvider.ts`)

**클래스**: `ClaudeProvider implements LLMProvider`

**주요 메서드**:
- `ping()` - Claude API 연결 테스트 (8 토큰 메시지)
- `analyzeCommit(input: AnalyzeCommitInput)` - 커밋 분석 실행
  - 시스템 프롬프트 + 사용자 메시지 생성
  - JSON 응답 파싱 (Zod 스키마 검증)
  - 파싱 실패 시 1회 재시도
  - 완전 실패 시 `unparsed: true` + 원본 텍스트 반환

**헬퍼 함수**:
- `makeClient()` - Anthropic SDK 클라이언트 생성
- `callClaude(client, system, userMessage, signal)` - API 호출 (AbortSignal 지원)
- `stripJsonFence(text)` - 마크다운 코드펜스 제거

**모델**: `'claude-sonnet-4-5'`
**Max tokens**: 2048

---

###### Prompts (`prompts.ts`)

**주요 함수**:
- `getSystemPrompt(lang: Language)` - 언어별 시스템 프롬프트 반환
- `buildUserMessage({ commit, diffText, language })` - 사용자 메시지 생성
- `truncateDiff(diff)` - 60K 문자 초과 시 중간 생략

**프롬프트 상수**:
- `SYSTEM_PROMPT_EN` - 영어 시스템 프롬프트 (VibeLens 전문가 페르소나)
- `SYSTEM_PROMPT_KO` - 한국어 시스템 프롬프트

**응답 스키마**:
```json
{
  "summary": "string",
  "whatChanged": ["string"],
  "whyItMatters": "string",
  "risks": ["string"],
  "followUps": ["string"]
}
```

---

#### 2.5 Utils

##### Logger (`src/main/utils/logger.ts`)

**위치**: `src/main/utils/logger.ts`

**주요 메서드**:
- `logger.info(msg, ...args)`
- `logger.warn(msg, ...args)`
- `logger.error(msg, ...args)`

---

### 3. **Preload** (`src/preload/index.ts`)

**목적**: Renderer와 Main 프로세스 간 안전한 IPC 브릿지

**주요 함수**:
- `invoke<T>(channel, args)` - IPC 호출 래퍼
- `contextBridge.exposeInMainWorld('vibelens', api)` - `window.vibelens` API 노출

**노출된 API**:
- `window.vibelens.repo.*`
- `window.vibelens.git.*`
- `window.vibelens.analysis.*`
- `window.vibelens.cache.*`
- `window.vibelens.settings.*`
- `window.vibelens.keychain.*`
- `window.vibelens.app.*`
- `window.vibelens.on(channel, callback)` - 이벤트 리스너

---

### 4. **Renderer (React UI)** (`src/renderer/src/`)

#### 4.1 Entry Point

##### `main.tsx`
- React 앱 마운트
- `App.tsx` 렌더링

##### `App.tsx`

**주요 기능**:
- 전역 레이아웃 구성 (TitleBar, WelcomeScreen/ThreePanelLayout, StatusBar) **[Phase 1 업데이트]**
- 조건부 렌더링: `repoPath`가 없으면 WelcomeScreen, 있으면 ThreePanelLayout **[Phase 1 추가]**
- 모달 관리 (Settings, FirstRunConsent, GitignoreConsent, CloneRepo)
- 메뉴 이벤트 리스너 (`menu:openRepo`, `menu:cloneRepo`, `menu:closeRepo`, etc.) **[Phase 1 업데이트]**
- 커밋 선택 시 자동 캐시 로드 + autoAnalyze 실행

**주요 훅**:
- `useSettingsStore()` - 설정 상태
- `useRepoStore()` - 레포/커밋 상태
- `useAnalysisStore()` - 분석 상태
- `useKeyboardShortcuts()` - 키보드 단축키

---

#### 4.2 API Client (`src/renderer/src/api/client.ts`)

**주요 함수**:
- `unwrap<T>(p: Promise<Result<T>>)` - IPC 결과 언래핑 (에러 시 throw)
- `export const api = window.vibelens` - Preload API 재익스포트

---

#### 4.3 Stores (Zustand)

##### Settings Store (`stores/settingsStore.ts`)

**상태**:
- `settings: Settings | null`
- `hasClaudeKey: boolean`
- `loaded: boolean`

**액션**:
- `load()` - 초기 설정 로드
- `acceptConsent()` - 첫 실행 동의 처리
- `setLanguage(lang)` - 언어 변경
- `toggleLanguage()` - 한/영 토글
- `saveClaudeKey(key)` - API 키 저장
- `deleteClaudeKey()` - API 키 삭제
- `toggleAutoAnalyze()` - 자동 분석 토글
- `refreshKeyPresence()` - API 키 유무 새로고침

---

##### Repo Store (`stores/repoStore.ts`)

**상태**:
- `path: string | null` - 레포 경로
- `name: string | null` - 레포 이름
- `branches: BranchInfo | null`
- `currentBranch: string | null`
- `commits: Commit[]` - 커밋 목록
- `commitsLoading: boolean`
- `commitsHasMore: boolean` - 페이징 여부
- `selectedCommitHash: string | null`
- `diff: DiffResult | null`
- `diffLoading: boolean`
- `selectedFileIdx: number` - 선택된 파일 인덱스
- `cachedHashes: Set<string>` - 캐시된 커밋 해시

**액션**:
- `openRepo()` - 레포 선택 다이얼로그 열기
- `openRepoByPath(repoPath)` - 경로로 레포 열기
- `closeRepo()` - 레포 닫기 (상태 초기화) **[Phase 1 추가]**
- `switchBranch(branch)` - 브랜치 변경
- `loadCommits(reset?)` - 커밋 페이징 로드 (PAGE_SIZE=80)
- `selectCommit(hash)` - 커밋 선택 + diff 로드
- `selectFile(idx)` - 파일 선택
- `refreshCachedHashes()` - 캐시 해시 목록 새로고침
- `markCached(hash)` - 캐시에 해시 추가

**상수**:
- `PAGE_SIZE` = `80`

---

##### Analysis Store (`stores/analysisStore.ts`)

**상태**:
- `cache: Record<string, AnalysisResult>` - 키: `{hash}:{lang}`
- `status: Record<string, Status>` - `'idle' | 'loading' | 'done' | 'error'`
- `errors: Record<string, string>`
- `totalTokensIn: number`
- `totalTokensOut: number`

**액션**:
- `analyzeSelected(force?)` - 선택된 커밋 분석 실행
  - 캐시 확인 → 디스크 확인 → API 호출
  - force=true 시 캐시 무시
- `prefetchCached(commit)` - 디스크 캐시만 미리 로드
- `cancelSelected()` - 진행 중인 분석 취소
- `clearForRepo()` - 레포 변경 시 전체 클리어

**헬퍼 함수**:
- `keyFor(hash, lang)` - 캐시 키 생성 (`{hash}:{lang}`)

---

#### 4.4 Components

##### Layout

**TitleBar** (`components/layout/TitleBar.tsx`)
- 커스텀 타이틀 바 (hiddenInset 스타일)
- 레포 열기, 클론, 설정 버튼

**ThreePanelLayout** (`components/layout/ThreePanelLayout.tsx`)
- 3단 레이아웃 (Left: 커밋 타임라인, Center: Diff 뷰어, Right: AI 패널)

**StatusBar** (`components/layout/StatusBar.tsx`)
- 하단 상태 표시 (브랜치, 커밋 개수, 캐시 상태 등)

---

##### Welcome Screen **[Phase 1 추가]**

**WelcomeScreen** (`components/welcome/WelcomeScreen.tsx`)
- 레포가 없을 때 표시되는 환영 화면
- 3가지 주요 액션 카드: Open Repository, Clone Repository, Setup API Key
- Recent Repositories 목록 표시
- 플랫폼별 키보드 단축키 힌트

**ActionCard** (`components/welcome/ActionCard.tsx`)
- 재사용 가능한 액션 카드 컴포넌트
- 아이콘, 제목, 설명, 뱃지 지원
- 호버 효과 및 스케일 애니메이션

**RecentReposList** (`components/welcome/RecentReposList.tsx`)
- 최근 열었던 레포 목록 표시 (최대 5개)
- **[Phase 2]** `lastOpened` 기준 정렬 (최신 우선)
- **[Phase 2]** 상대 시간 표시 (`formatRelativeTime()` — "Just now", "2m ago", "Yesterday" 등)
- **[Phase 2]** 경로 축약 (`shortenPath()` — `/Users/name/...` → `~/...`)
- **[Phase 2]** 브랜치 뱃지 (chip 스타일)
- 클릭 시 해당 레포 열기
- "View all" 링크 (`onViewAll` prop)

---

##### Left Panel

**LeftPanel** (`components/left/LeftPanel.tsx`)
- 레포 선택, 브랜치 선택, 커밋 타임라인 통합
- **[Phase 3-A]** 커밋 검색 필터: `searchQuery` 상태 및 `useMemo` 기반 `commits.filter()` (message/subject/hash/author)
- 필터링 시 매칭 카운트 표시 (`N/total`)

**CommitTimeline** (`components/left/CommitTimeline.tsx`)
- 커밋 목록 (페이징 + 무한 스크롤)
- 캐시 여부 뱃지 표시
- **[Phase 3-A]** `filteredCommits?: Commit[]` prop 수신 → 필터링된 목록 렌더링
- 검색 결과 없을 때 `EmptyState` 표시

---

##### Center Panel

**CenterPanel** (`components/center/CenterPanel.tsx`)
- 파일 탭 + 선택된 파일의 DiffViewer

**DiffViewer** (`components/center/DiffViewer.tsx`)
- `react-diff-viewer-continued` 기반 diff 렌더링
- 문법 하이라이팅 (prismjs)
- Binary/TooLarge 파일 처리

---

##### Right Panel

**AIContextPanel** (`components/right/AIContextPanel.tsx`)
- 분석 결과 표시 (Summary, What changed, Why it matters, Risks, Follow-ups)
- 분석 시작/재분석/취소 버튼
- 언어 토글 (한/영)
- 토큰 사용량 표시

---

##### Modals

**SettingsModal** (`components/modals/SettingsModal.tsx`)
- Claude API 키 관리 (입력, 테스트, 삭제)
- 언어 선택
- 자동 분석 토글
- 캐시 클리어

**FirstRunConsentDialog** (`components/modals/FirstRunConsentDialog.tsx`)
- 첫 실행 시 동의 화면

**GitignoreConsentDialog** (`components/modals/GitignoreConsentDialog.tsx`)
- `.vibelens/` 를 .gitignore에 추가할지 물어보는 다이얼로그

**CloneRepoDialog** (`components/modals/CloneRepoDialog.tsx`)
- Git clone URL 입력 + 대상 디렉토리 선택

---

##### Primitives

**Button** (`components/primitives/Button.tsx`)
- 기본 버튼 컴포넌트 (variant, size)

**Badge** (`components/primitives/Badge.tsx`)
- 뱃지 컴포넌트 (status, language 등)

**Toast** (`components/primitives/Toast.tsx`)
- 토스트 알림 시스템 (`toast({ kind, title, description })`)

**Spinner** (`components/primitives/Spinner.tsx`)
- 로딩 스피너

**Skeleton** (`components/primitives/Skeleton.tsx`)
- 스켈레톤 로더

**EmptyState** (`components/primitives/EmptyState.tsx`)
- 빈 상태 UI (아이콘 + 메시지)

**Panel** (`components/primitives/Panel.tsx`)
- 패널 컨테이너 (border, padding)

**Modal** (`components/modals/Modal.tsx`)
- 모달 베이스 컴포넌트

---

#### 4.5 Hooks

**useKeyboardShortcuts** (`hooks/useKeyboardShortcuts.ts`)
- 키보드 단축키 핸들러
- ⌘, → Settings
- ⌘R → Refresh Analysis
- ⌘L → Toggle Language

---

#### 4.6 Lib

**cx** (`lib/cx.ts`)
- `clsx` + `tailwind-merge` 래퍼
- 조건부 클래스네임 합성

---

## 🔍 주요 플로우

### 1. 레포 열기 플로우

```
[LeftPanel] openRepo()
  → [RepoStore] openRepo()
  → [API] repo:open (다이얼로그)
  → [Main] dialog.showOpenDialog()
  → [Main] checkIsRepo()
  → [Main] getBranches()
  → [RepoStore] loadCommits()
  → [API] git:listCommits
  → [Main] gitService.listCommits()
  → [RepoStore] commits 업데이트
  → [LeftPanel] CommitTimeline 렌더링
```

---

### 2. 커밋 분석 플로우

```
[CommitTimeline] 커밋 클릭
  → [RepoStore] selectCommit(hash)
  → [API] git:getDiff
  → [Main] gitService.getDiff()
  → [RepoStore] diff 업데이트
  → [CenterPanel] DiffViewer 렌더링
  → [App] useEffect (selectedHash)
  → [AnalysisStore] prefetchCached()
  → [API] analysis:getCached
  → 캐시 없으면 autoAnalyze=true 시
  → [AnalysisStore] analyzeSelected()
  → [API] analysis:analyze
  → [Main] ClaudeProvider.analyzeCommit()
  → [Main] Anthropic API 호출
  → [Main] writeCache()
  → [AnalysisStore] cache 업데이트
  → [AIContextPanel] 분석 결과 렌더링
```

---

### 3. 설정 변경 플로우

```
[SettingsModal] 입력
  → [SettingsStore] saveClaudeKey(key)
  → [API] keychain:save
  → [Main] keychainService.saveKey()
  → [Main] keytar 또는 safeStorage
  → [SettingsStore] hasClaudeKey=true
  → [SettingsModal] 테스트 버튼 활성화
```

---

## 🛠️ 빌드 & 개발

**스크립트**:
- `npm run dev` - 개발 모드 (hot reload)
- `npm run build` - 프로덕션 빌드
- `npm run dist` - macOS 배포 빌드
- `npm run typecheck` - TypeScript 타입 체크

**설정 파일**:
- `electron.vite.config.ts` - Vite 빌드 설정
- `electron-builder.yml` - 패키징 설정
- `tailwind.config.ts` - Tailwind CSS 설정
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` - TypeScript 설정

---

## 📦 주요 의존성

**Main**:
- `electron` - 데스크톱 앱 프레임워크
- `simple-git` - Git 작업
- `@anthropic-ai/sdk` - Claude API 클라이언트
- `electron-store` - 설정 저장
- `keytar` - macOS Keychain (optional)

**Renderer**:
- `react` + `react-dom` - UI 프레임워크
- `zustand` - 상태 관리
- `react-diff-viewer-continued` - Diff 렌더링
- `react-markdown` + `remark-gfm` - 마크다운 렌더링
- `prismjs` - 문법 하이라이팅
- `lucide-react` - 아이콘
- `tailwindcss` - 스타일링

---

## 📝 파일 명명 규칙

**캐시 파일**:
- `.vibelens/cache/{hash}.{lang}.md` - 분석 결과 마크다운
- `.vibelens/cache/{hash}.meta.json` - 메타데이터 (토큰, 모델, 언어 등)

**설정 파일**:
- `~/Library/Application Support/vibelens-settings/config.json` (macOS)
- `~/Library/Application Support/vibelens-keys/config.json` (fallback keychain)

---

## 🚀 주요 개선 포인트 참조 (앞으로 작업 시 직접 접근)

### 성능 최적화
- `src/main/services/gitService.ts:getDiff()` - diff 파싱 최적화
- `src/renderer/src/stores/repoStore.ts:loadCommits()` - 커밋 페이징 개선

### 에러 핸들링
- `src/main/ipc/registerIpc.ts:wrap()` - 전역 에러 핸들러
- `src/renderer/src/api/client.ts:unwrap()` - IPC 에러 처리

### 캐시 관리
- `src/main/services/cacheService.ts` - 캐시 TTL, 용량 제한 추가
- `src/renderer/src/stores/analysisStore.ts` - 메모리 캐시 LRU 적용

### AI 분석 품질
- `src/main/services/llm/prompts.ts` - 프롬프트 개선
- `src/main/services/llm/ClaudeProvider.ts:analyzeCommit()` - 재시도 로직 개선

### UI/UX
- `src/renderer/src/components/center/DiffViewer.tsx` - 대용량 파일 가상 스크롤
- `src/renderer/src/components/left/CommitTimeline.tsx` - 무한 스크롤 개선

---

## 📄 라이센스 & 메타

- **라이센스**: MIT
- **작성자**: VibeLens
- **버전**: 0.1.0 (MVP Phase 1)
- **Electron**: 33.0.2
- **React**: 18.3.1
- **Claude Model**: claude-sonnet-4-5

---

**마지막 업데이트**: 2026-04-13 (Phase 1 - Welcome Screen 추가)

이 문서는 VibeLens 프로젝트의 모든 주요 함수와 파일 위치를 정리하여, 개발자가 빠르게 코드베이스를 탐색하고 수정할 수 있도록 돕습니다.

---

## 📝 Phase 1 변경 사항 (2026-04-13)

### 새로 추가된 컴포넌트
- `WelcomeScreen.tsx` - 레포가 없을 때 표시되는 환영 화면
- `ActionCard.tsx` - 재사용 가능한 액션 카드
- `RecentReposList.tsx` - 최근 레포 목록 표시

### 타입 변경
- `RecentRepo` 타입 추가 (path, name, lastOpened?, branch?)
- `Settings.recentRepos` 타입 변경: `string[]` → `RecentRepo[]`

### 새로운 기능
- File 메뉴에 Clone Repository, Close Repository 추가
- `repoStore.closeRepo()` 액션 추가
- `settingsService.addRecentRepo()` 업데이트 (RecentRepo 타입 지원)
- 자동 마이그레이션 로직 (기존 string[] → RecentRepo[])

### UI 개선
- 플랫폼별 키보드 단축키 표시 (⌘ / Ctrl)
- Lucide React 아이콘 사용
- Catppuccin Mocha 디자인 시스템 준수
