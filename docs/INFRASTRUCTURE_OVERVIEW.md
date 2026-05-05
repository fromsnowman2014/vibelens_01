# VibeLens — Infrastructure Overview

> 다른 사람에게 VibeLens를 소개할 때 사용할 수 있는 한 장짜리 아키텍처/인프라 가이드입니다.
> 코드 구조, 프로세스 분리, 데이터 흐름, 외부 의존성, 보안/저장소 모델까지 한 번에 훑을 수 있도록 정리했습니다.

---

## 1. VibeLens 한 줄 소개

**VibeLens는 macOS 데스크탑 앱으로, 임의의 Git 리포지토리를 열어 각 커밋의 diff를 LLM(Anthropic Claude)에 보내서 "이 커밋을 만들어냈을 법한 프롬프트/의도"를 역추론(reverse-prompt)하고, 더 나아가 그 커밋의 결과물을 격리된 환경에서 실제로 빌드/실행해 미리보는 도구입니다.**

핵심 가치는 세 가지입니다:

1. **Reverse-Prompting** — 커밋 메시지가 빈약해도, diff만 보고 LLM이 "왜 이걸 했나"를 구조화해서 설명.
2. **Per-commit WebApp Emulator** — 특정 커밋 시점의 앱을 git worktree로 격리 체크아웃해 dev 서버를 띄우고 webview로 미리보기.
3. **로컬 캐시 우선** — 한 번 분석한 커밋은 `.vibelens/` 아래에 마크다운+메타로 저장되어 두 번째 열람부터는 즉시·무료.

---

## 2. 큰 그림 (High-Level Architecture)

VibeLens는 단일 Electron 앱이며, Electron의 표준적인 **Main / Preload / Renderer** 3-프로세스 모델을 그대로 따릅니다.

```
┌─────────────────────────── Electron App (macOS .app) ──────────────────────────┐
│                                                                                │
│  ┌───────────────── Renderer Process (Chromium + React 18) ─────────────────┐  │
│  │                                                                          │  │
│  │   TitleBar │ LeftPanel (Commit Timeline) │ CenterPanel (Diff /          │  │
│  │            │                              │  Live Preview <webview>)    │  │
│  │            │                              │ RightPanel (AI Context /    │  │
│  │            │                              │  Chat / WebApp Status / Log)│  │
│  │                                                                          │  │
│  │   Zustand stores: repo · analysis · settings · chat · webapp · ui       │  │
│  │   ──────── window.vibelens.* (typed bridge) ───────────                 │  │
│  └────────────────────────────────┬─────────────────────────────────────────┘  │
│                                   │ IPC (ipcRenderer ⇄ ipcMain)                │
│  ┌────────────── Preload (contextBridge, sandboxed) ────────────────────────┐  │
│  │   exposes a single, typed `vibelens` object: repo / git / analysis /    │  │
│  │   cache / settings / keychain / app / chat / webapp                     │  │
│  └────────────────────────────────┬─────────────────────────────────────────┘  │
│                                   │                                            │
│  ┌────────────── Main Process (Node.js, full privileges) ───────────────────┐  │
│  │                                                                          │  │
│  │  IPC Layer (registerIpc.ts)                                              │  │
│  │     repo:* · git:* · analysis:* · cache:* · settings:* ·                 │  │
│  │     keychain:* · chat:* · webapp:* · menu:*                              │  │
│  │                                                                          │  │
│  │  Services                                                                │  │
│  │   ├ gitService      — simple-git wrapper (commits, diff, worktree)      │  │
│  │   ├ cacheService    — .vibelens/cache atomic writes, markdown render    │  │
│  │   ├ keychainService — keytar (primary) → safeStorage (fallback)         │  │
│  │   ├ settingsService — electron-store (JSON in app userData)             │  │
│  │   ├ llm/                                                                 │  │
│  │   │   ├ LLMProvider.ts   — interface (analyzeCommit / chat / ping)      │  │
│  │   │   ├ ClaudeProvider   — @anthropic-ai/sdk + zod 검증, 1회 재시도     │  │
│  │   │   └ prompts.ts       — ko/en system prompts, diff 절단              │  │
│  │   └ webapp/                                                              │  │
│  │       ├ projectDetector — package.json 분석 (next/vite/cra/vue/static) │  │
│  │       ├ portAllocator   — 빈 포트 탐색                                  │  │
│  │       ├ buildManager    — git worktree, npm install, dev 서버 spawn    │  │
│  │       └ webappService   — 위 셋의 thin facade                           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
                  │                                  │                  │
                  ▼                                  ▼                  ▼
         macOS Keychain                        Anthropic API      Local git CLI
         (또는 safeStorage)                    api.anthropic.com   (`git` binary)
```

---

## 3. 프로세스/레이어 책임 분리

### 3.1 Main Process (`src/main/`)

Node 풀권한으로 동작하며, **모든 외부 I/O는 여기서만** 일어납니다. Renderer는 직접 파일/네트워크에 접근할 수 없습니다.

| 파일 | 역할 |
|---|---|
| `index.ts` | `BrowserWindow` 생성, 메뉴 빌드, IPC 등록, `webview` 세션의 CORS 우회 설정 |
| `menu.ts` | 네이티브 macOS 메뉴 (Open / Open Recent / Settings / Toggle Language …) |
| `ipc/registerIpc.ts` | 모든 `ipcMain.handle` 등록, `wrap()`으로 결과를 `{ok, data\|error}`로 표준화 |
| `services/gitService.ts` | `simple-git`을 통해 `git log`, diff, `git show`, clone, worktree 호출 |
| `services/cacheService.ts` | `.vibelens/cache/<hash>.{ko,en}.md` + `<hash>.meta.json` 원자적 쓰기 |
| `services/keychainService.ts` | API 키 안전 저장 (keytar → safeStorage 폴백) |
| `services/settingsService.ts` | `electron-store`로 `~/Library/Application Support/...`에 설정 영속화 |
| `services/llm/ClaudeProvider.ts` | Claude Sonnet 4.5 호출, JSON 응답 zod 검증, 실패 시 1회 재시도 |
| `services/webapp/buildManager.ts` | git worktree → npm install → dev 서버 spawn, stdout 패턴으로 ready 감지 |
| `utils/logger.ts` | 콘솔 기반 단순 로거 |

### 3.2 Preload (`src/preload/index.ts`)

Sandbox 모드에서 동작하며 `contextBridge.exposeInMainWorld('vibelens', api)`로 **타입이 정의된 단일 API 객체**만 Renderer에 노출합니다. 이 외에 Node 모듈은 Renderer에 닿지 않습니다.

노출되는 도메인은 다음과 같이 구성됩니다:

```
window.vibelens
  ├─ repo.*        (open / clone / selectDirectory / validate / getBranches / openInFinder)
  ├─ git.*         (listCommits / getDiff / getFileAtCommit)
  ├─ analysis.*    (getCached / analyze / cancel)       ← AbortController 지원
  ├─ cache.*       (ensureDir / listHashes / clear / shouldAskGitignore / addToGitignore)
  ├─ settings.*    (get / set)
  ├─ keychain.*    (save / has / delete / test / getAllStatus)
  ├─ app.*         (openExternal / readme)
  ├─ chat.*        (send)                               ← 분석 결과를 컨텍스트로 받는 후속 채팅
  ├─ webapp.*      (detect / start / stop / getStatus / subscribeLogs) ← 이벤트 스트림
  ├─ on / send     (raw 메뉴 이벤트 등)
```

### 3.3 Renderer (`src/renderer/src/`)

React 18 + TypeScript + Tailwind. 다크 전용, CSS 변수 기반 팔레트.

- **레이아웃**: `ThreePanelLayout` — 좌(타임라인)/중앙(diff·라이브 프리뷰)/우(AI 컨텍스트·채팅·로그)
- **상태**: Zustand 스토어 6개로 분할
  - `repoStore` — 현재 리포지토리, 브랜치, 커밋 페이지, 선택 커밋, diff
  - `analysisStore` — 분석 결과 in-memory 캐시(`{hash:lang → result}`), prefetch/cancel
  - `settingsStore` — settings + 키 보유 여부
  - `chatStore` — AI 채팅 메시지 큐
  - `webappStore` — WebApp 세션, 빌드/콘솔 로그, 워닝
  - `uiStore` — 드로어/탭 등 UI 단편
- **API 어댑터**: `api/client.ts`의 `unwrap()`이 `{ok,data}` 결과를 throw 패턴으로 변환

---

## 4. 핵심 데이터 플로우

### 4.1 "커밋 하나를 분석한다"

```
User 클릭(commit row, Renderer)
  ↓ Zustand action (analysisStore.analyzeSelected)
  ↓ window.vibelens.analysis.analyze(path, commit, lang)
  ↓ ipcRenderer.invoke('analysis:analyze')
  ↓
[Main] cacheService.readCache → 있으면 즉시 return
                             → 없으면 ↓
[Main] gitService.getUnifiedDiffText(repo, hash)        ← simple-git
[Main] ClaudeProvider.analyzeCommit({commit, diffText, language, signal})
  ├─ getKey('claude') from keychainService              ← keytar / safeStorage
  ├─ Anthropic.messages.create(...) with AbortSignal    ← api.anthropic.com
  ├─ stripJsonFence + JSON.parse
  ├─ zod schema.safeParse → 실패 시 1회 재시도("respond JSON only")
  └─ 실패 확정 시 raw text를 'unparsed' 플래그로 그대로 보존
[Main] cacheService.writeCache → .vibelens/cache/<hash>.{lang}.md + .meta.json (원자적)
  ↓ IpcResult<AnalysisResult>
[Renderer] analysisStore에 저장 → AIContextPanel 렌더
```

핵심 보장:
- 60KB 초과 diff는 가운데를 자르고 마커를 삽입 (Map-Reduce 청킹은 Phase 2 보류).
- 호출 단위로 `AbortController`를 키(`repo::hash::lang`)에 묶어 두고 `analysis:cancel`로 중단.
- 분석 결과의 마크다운 렌더링은 **main 쪽 `cacheService.renderAnalysisMarkdown()` 한 곳에서만** 처리해, 캐시 파일과 화면 출력이 항상 동일.

### 4.2 "특정 커밋의 앱을 실제로 띄워본다" (WebApp Emulator, Phase 5)

```
[Renderer] CenterPanel에서 LivePreview 탭 진입
  ↓ webappStore.startWebApp(commitHash)
  ↓ window.vibelens.webapp.start(repoPath, commitHash)
  ↓
[Main] projectDetector.detectProjectType
  ├─ git show <hash>:package.json      → next/vite/react-scripts/vue 분기
  ├─ 없으면 git show <hash>:index.html → static-html
  └─ git show <hash>:.env.example      → required env vars 추출
[Main] buildManager.buildAndRun
  ├─ os.tmpdir()/vibelens-webapp/<uuid>  생성
  ├─ git worktree add <tempDir> <hash>   ← 메인 워킹트리 영향 0
  ├─ portAllocator.findFreePort(devPort || 3000)
  ├─ runCommand('npm install', tempDir)  ← stdout/stderr 이벤트 emit
  └─ spawn(devCommand, { HOST: '0.0.0.0', PORT: <port> }, shell:true)
       ├─ Next.js  → npx next dev -p <port> -H 0.0.0.0
       └─ Vite     → npx vite --port <port> --host 0.0.0.0
  ↓ EventEmitter('log' / 'warning' / 'status-change')
[Main] index.ts 의 'persist:webapp' 세션이 응답에 CORS 헤더(`*`) 주입
[Renderer] <webview> src=http://localhost:<port>  로 라이브 프리뷰
[Renderer] webapp:subscribeLogs 채널로 빌드/런타임 로그 실시간 수신 → WebAppLog
```

종료 시 `git worktree remove --force` + `fs.rm(tempDir, {recursive:true})`로 격리 환경을 깨끗하게 되돌립니다. 메인 리포에는 **아무 변화도 남지 않습니다.**

### 4.3 키 저장 / 인증

- **저장**: `keychainService.saveKey()`가 우선 `keytar.setPassword('VibeLens', 'claude', key)` 시도 → 네이티브 모듈 로드 실패 시 `electron.safeStorage.encryptString()`으로 암호화해서 `electron-store`(`vibelens-keys.json`)에 base64로 보관.
- **사용**: 모든 Claude 호출 직전에 `getKey('claude')`로 그때그때 가져옴. 키는 메모리에 장시간 캐시되지 않음.
- **검증**: `keychain:test` IPC가 `provider.ping()`을 호출 → Anthropic에 토큰 8짜리 요청을 던져 200/401을 확인.

---

## 5. 영속화/저장소 (Storage Layout)

VibeLens가 디스크에 남기는 데이터는 정확히 다음 세 곳에 한정됩니다.

### 5.1 리포지토리 별 캐시 — `<repo>/.vibelens/`
```
<repo>/.vibelens/
├── .gitignore             # "*"  → 캐시 디렉터리 자체가 git에 커밋되는 일을 차단
└── cache/
    ├── <hash>.ko.md       # 한국어 분석 마크다운
    ├── <hash>.en.md       # 영어 분석 마크다운
    └── <hash>.meta.json   # { model, tokensIn, tokensOut, generatedAt,
                           #   schemaVersion, languagesGenerated, unparsed? }
```
또한 부모 리포의 `.gitignore`에 `.vibelens/`를 추가할지 **레포당 단 1회** 사용자에게 묻습니다 (`gitignoreAsked` 플래그가 settings에 저장).

### 5.2 사용자 설정 — `electron-store`
`~/Library/Application Support/vibelens/vibelens-settings.json`
```ts
Settings = {
  theme: 'dark',
  language: 'ko' | 'en',
  consentAccepted: boolean,
  gitignoreAsked: { [repoPath]: true },
  recentRepos: RecentRepo[],            // 최대 10개, 마지막 열람순
  claudeModel: 'claude-sonnet-4-5',
  autoAnalyze: boolean,
  activeProvider: 'claude' | 'gemini' | 'openai',
  activeModel: string
}
```

### 5.3 자격증명
- **1순위**: macOS Keychain (`keytar`, service=`VibeLens`, account=`<providerId>`)
- **폴백**: `~/Library/Application Support/vibelens/vibelens-keys.json` (safeStorage 암호화)

### 5.4 임시 빌드 환경 (휘발성)
`os.tmpdir()/vibelens-webapp/<uuid>/` — git worktree로 만들어졌다가 세션 종료 시 즉시 제거.

---

## 6. 외부 의존성 / 트러스트 바운더리

| 외부 시스템 | 호출 주체 | 무엇을 보내는가 | 무엇을 받는가 |
|---|---|---|---|
| `api.anthropic.com` (Claude Sonnet 4.5) | Main / `ClaudeProvider` | system prompt + commit metadata + unified diff(최대 60KB로 절단) | 구조화된 JSON 분석 결과 |
| 로컬 `git` 바이너리 | Main / `simple-git` | 표준 git 명령(`log`, `show`, `diff`, `clone`, `worktree`) | stdout 텍스트 |
| 로컬 `npm` + node_modules | Main / `buildManager` | `npm install`, `npx vite/next dev` | dev 서버 (localhost:port) |
| macOS Keychain | Main / `keytar` | 서비스명+계정명+secret | secret |

**민감 정보가 외부로 나가는 경로는 정확히 두 개뿐입니다:** Anthropic API에 보내는 diff/메타데이터, 그리고 Keychain에 저장되는 API 키. 그 외에는 전부 로컬에 머무릅니다.

---

## 7. 빌드/배포 인프라

| 도구 | 역할 |
|---|---|
| `electron-vite` | 개발 시 HMR(Renderer) + main/preload 자동 리빌드, 프로덕션 번들링 |
| `vite` + `@vitejs/plugin-react` | Renderer 번들 |
| `electron-builder` | macOS arm64 `.app` 패키징, `keytar`는 `asarUnpack`으로 풀어둠 |
| TypeScript 프로젝트 분리 | `tsconfig.node.json` (main/preload) + `tsconfig.web.json` (renderer) |
| Tailwind 3 + PostCSS | 다크 전용 토큰 시스템 |

빌드 결과:
```
out/main/index.js        ← Main 번들
out/preload/index.js     ← Preload 번들
out/renderer/...         ← Renderer (index.html + assets)
dist/mac-arm64/VibeLens.app  ← electron-builder 결과 (서명/공증 없음 — 데모 전용)
```

스크립트:
- `npm run dev` — electron-vite dev (HMR + main/preload watch)
- `npm run build` — 모든 번들 생성
- `npm run pack` — 위 + `.app` 디렉토리 패키징
- `npm run dist` — 위 + DMG 등 distributable
- `npm run typecheck` — node/web 양쪽 tsc 체크

`electron-builder.yml` 핵심 설정:
- `appId: com.vibelens.app`, `productName: VibeLens`
- `mac.target = dir`, `arch = arm64` (Apple Silicon 전용 데모)
- `identity: null`, `hardenedRuntime: false`, `gatekeeperAssess: false` — **코드 서명/공증 없음** (Phase 2 로드맵에 포함)

---

## 8. 보안/프라이버시 자세

- **renderer는 sandboxed** (`contextIsolation: true`, `nodeIntegration: false`).
- 단, **localhost dev 서버를 webview에서 띄워야 하므로** `webSecurity: false` + `webviewTag: true`. 이 트레이드오프를 보완하기 위해 webview 전용 세션(`persist:webapp`)에서 응답 헤더에 `Access-Control-Allow-Origin: *`를 강제 주입해, Electron 본체 컨텍스트와 분리합니다.
- 첫 실행 시 **명시적 동의 다이얼로그**: "diff와 커밋 메타데이터가 Anthropic에 전송됨"을 알리고 수락 전까지 분석 기능을 잠금.
- API 키는 **요청 단위로만** 메모리에 머무르고, 디스크에는 평문으로 절대 쓰지 않음.

---

## 9. 폴더 구조 한눈에

```
vibelens_01/
├─ src/
│  ├─ shared/types.ts          ← Main↔Renderer 공통 타입(외부 의존성 0)
│  ├─ main/
│  │  ├─ index.ts              ← Electron 부트스트랩
│  │  ├─ menu.ts
│  │  ├─ ipc/registerIpc.ts    ← 모든 ipcMain.handle
│  │  ├─ services/
│  │  │  ├─ gitService.ts
│  │  │  ├─ cacheService.ts
│  │  │  ├─ keychainService.ts
│  │  │  ├─ settingsService.ts
│  │  │  ├─ llm/{LLMProvider,ClaudeProvider,prompts}.ts
│  │  │  └─ webapp/{projectDetector,portAllocator,buildManager,webappService}.ts
│  │  └─ utils/logger.ts
│  ├─ preload/index.ts         ← contextBridge → window.vibelens
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ App.tsx
│        ├─ api/client.ts
│        ├─ stores/            ← repo / analysis / settings / chat / webapp / ui
│        ├─ hooks/useKeyboardShortcuts.ts
│        ├─ lib/
│        ├─ styles/globals.css
│        └─ components/
│           ├─ layout/   (TitleBar, ThreePanelLayout, StatusBar)
│           ├─ left/     (CommitTimeline, CommitDetailDrawer, LeftPanel)
│           ├─ center/   (CenterPanel, DiffViewer, LivePreview)
│           ├─ right/    (AIContextPanel, AIChatbox, WebAppStatus, WebAppLog)
│           ├─ modals/   (Settings, FirstRunConsent, GitignoreConsent, CloneRepo)
│           ├─ welcome/  (WelcomeScreen, RecentReposList, ActionCard)
│           └─ primitives/ (Button, Panel, Badge, Drawer, Toast, …)
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tailwind.config.ts
├─ tsconfig.{json,node.json,web.json}
└─ package.json
```

---

## 10. 확장 포인트

| 무엇을 추가할 때 | 손대야 할 곳 |
|---|---|
| **새 LLM 프로바이더(Gemini/OpenAI)** | `services/llm/` 아래에 `LLMProvider` 인터페이스를 구현한 클래스 추가 + `registerIpc.getActiveProvider()` 분기 추가. UI는 이미 `activeProvider` 설정으로 분기됨. |
| **새 프로젝트 타입(예: SvelteKit)** | `webapp/projectDetector.ts`의 분기 + `buildManager.ts`의 호스트 바인딩 분기. |
| **새 IPC 도메인** | (1) `registerIpc.ts`에 `ipcMain.handle` (2) `preload/index.ts`의 `api` 객체에 타입 안전한 호출 추가 (3) Renderer 스토어/컴포넌트에서 `window.vibelens.*` 호출. |
| **새 분석 필드(ex. risks 옆에 securityNotes 추가)** | `shared/types.ts` 스키마 + `ClaudeProvider`의 zod 스키마 + `prompts.ts` system prompt + `cacheService.renderAnalysisMarkdown()` + Renderer의 `AIContextPanel`. `SCHEMA_VERSION`도 bump. |

---

## 11. Phase 2 로드맵에 남아있는 것

- 임베디드 터미널 패널
- 다중 커밋 일괄/큐 분석
- 매우 큰 diff에 대한 Map-Reduce 청킹
- OpenAI / Gemini 프로바이더 구현 (인터페이스는 이미 존재)
- 라이트 테마(토큰만 바꾸면 됨)
- 전체 파일 익스플로러 트리
- 코드 서명, 공증, 자동 업데이터
- Windows / Linux 지원

---

## 부록 A. 한 화면 요약

- **앱 타입**: Electron 33 데스크탑 앱 (현재 macOS arm64만)
- **주요 기술**: TypeScript, React 18 + Tailwind, Zustand, simple-git, `@anthropic-ai/sdk`, zod, electron-store, keytar
- **프로세스 모델**: 표준 Electron Main/Preload/Renderer; Renderer는 sandbox + contextIsolation
- **주요 외부 호출**: Anthropic API (Claude Sonnet 4.5), 로컬 git CLI, 로컬 npm
- **저장소**: `.vibelens/cache/`(레포별), `electron-store`(설정), Keychain/safeStorage(키)
- **격리 모델**: WebApp 빌드는 `git worktree` + `os.tmpdir()`로 메인 작업트리 무손상
- **차별점**: 커밋 → reverse prompt(LLM) + per-commit live preview를 한 앱에서
