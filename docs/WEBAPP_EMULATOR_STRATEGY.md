# VibeLens WebApp Emulator Strategy

> **핵심 목표**: Git 커밋을 선택하면 해당 시점의 웹 애플리케이션을 프로그램 내부에서 실시간으로 빌드하고 실행하여 사용자가 코드 변경사항을 직접 테스트할 수 있는 통합 개발 환경 제공

**작성일**: 2026-04-22
**상태**: 🟡 **PLANNING** - 구현 전 아키텍처 설계 단계
**우선순위**: 🔵 **High** - 차별화된 사용자 경험 제공

---

## 📋 목차

1. [현재 상태 분석](#-현재-상태-분석)
2. [핵심 문제 정의 및 요구사항](#-핵심-문제-정의-및-요구사항)
3. [솔루션 아키텍처](#-솔루션-아키텍처)
4. [구현 계획](#-구현-계획)
5. [기술적 도전 과제 및 해결 방안](#-기술적-도전-과제-및-해결-방안)
6. [성공 지표 및 검증](#-성공-지표-및-검증)

---

## 📍 현재 상태 분석

### 현재 Center Panel 구조

| 컴포넌트 | 파일 경로 | 현재 기능 |
|---------|----------|---------|
| **CenterPanel** | `src/renderer/src/components/center/CenterPanel.tsx` | Diff Viewer만 표시 (탭 기반 파일 네비게이션) |
| **DiffViewer** | `src/renderer/src/components/center/DiffViewer.tsx` | react-diff-viewer로 코드 변경사항 시각화 |
| **ThreePanelLayout** | `src/renderer/src/components/layout/ThreePanelLayout.tsx` | 3-panel 레이아웃 (리사이즈 가능) |

### 현재 제약사항

1. ❌ **정적 코드 보기만 가능** - diff 텍스트만 보고 실제 동작 확인 불가
2. ❌ **컨텍스트 부족** - 변경사항이 실제 UX에 미치는 영향 파악 어려움
3. ❌ **피드백 루프 느림** - 코드 변경 → 로컬 체크아웃 → 빌드 → 테스트 과정 수동 진행

---

## 🎯 핵심 문제 정의 및 요구사항

### 사용자 시나리오

**As a developer**, I want to:
- **커밋 옆의 Play 버튼을 클릭하여 즉시 웹앱 실행** (한 번의 클릭으로 빌드 & 미리보기)
- API 키나 백엔드 의존성이 없을 때 명확한 경고 메시지 확인
- 브라우저 콘솔 로그를 VibeLens 내부에서 직접 보기
- Diff 보기와 Live Preview 사이를 탭으로 쉽게 전환

### UX 디자인 원칙

#### Modern & Consistent Interface
- ✅ **커밋 리스트에 Play 버튼 통합** - 기존 Drawer 버튼 옆에 배치하여 일관성 유지
- ✅ **Hover 시에만 표시** - CommitRow hover 시 Play/Stop 버튼 표시 (Drawer 패턴과 동일)
- ✅ **상태 인디케이터** - 실행 중인 커밋은 Play 버튼이 Stop 버튼으로 변경
- ✅ **스피너 애니메이션** - 빌드 중일 때 Play 버튼이 스피너로 변경
- ✅ **키보드 단축키** - `Cmd+Shift+P` (Play/Stop toggle)

### 기능 요구사항

#### 1. Left Panel - CommitTimeline 개선 (Play 버튼 추가)

```
[Commit Row]
┌─────────────────────────────────────────────────────────┐
│ ● [abc123] 2 hours ago                [▶] [>]           │  ← Play & Drawer 버튼
│   feat: add dark mode toggle                            │
│   John Doe                                              │
└─────────────────────────────────────────────────────────┘
  ↑                                        ↑   ↑
  Cache indicator                      Play  Drawer

Hover States:
- 기본: Play/Drawer 버튼 opacity-0
- Hover: Play/Drawer 버튼 opacity-100 (fade-in)
- Running: Play → Stop 버튼으로 변경 (빨간색)
- Building: Play → Spinner 애니메이션
```

#### 2. Center Panel 탭 확장 (기존 유지)

```
[Center Panel]
┌─────────────────────────────────────┐
│ 📄 Diff  |  🌐 Live Preview       ◀─ 탭 추가 (변경 없음)
├─────────────────────────────────────┤
│                                     │
│  Diff Mode: 기존 DiffViewer         │
│  Live Preview Mode: Embedded WebView│
│                                     │
└─────────────────────────────────────┘
```

#### 2. Right Panel 탭 확장

```
[Right Panel]
┌─────────────────────────────────────┐
│ 🤖 Analysis | 💬 Chat | 📊 Status | 📜 Log  ◀─ 새로운 탭 추가
├─────────────────────────────────────┤
│                                     │
│ Status Tab:                         │
│  - 빌드 상태 (Building/Running/Error)│
│  - API 키 누락 경고                  │
│  - 포트 충돌 경고                    │
│                                     │
│ Log Tab:                            │
│  - 빌드 로그 (stdout/stderr)        │
│  - 브라우저 콘솔 로그                │
│  - 네트워크 요청 실패 로그            │
│                                     │
└─────────────────────────────────────┘
```

#### 3. WebApp 실행 워크플로우 (개선된 UX)

```
[User clicks Play button on commit row]
    ↓
[Instant Feedback]
  - Play button → Spinner (빌드 중)
  - Right panel "Log" 탭 자동 활성화
  - Center panel "Live Preview" 탭 자동 활성화
    ↓
[Detect project type]
  - package.json? → Node.js/React/Vue/Next.js
  - index.html? → Static HTML
  - No web stack? → Show warning in Status tab
    ↓
[Build & Run]
  - Git checkout to temp directory
  - npm install (with cache)
  - npm run dev/build (detect script)
  - Start dev server
    ↓
[Embed in WebView]
  - Electron BrowserView or <webview>
  - Capture console.log via IPC
  - Inject error boundary
    ↓
[Status/Log 업데이트]
  - Spinner → Stop button (실행 중)
  - Real-time build progress
  - Runtime errors
  - Missing dependencies warnings
    ↓
[User clicks Stop button]
  - Kill dev server
  - Cleanup temp directory
  - Stop button → Play button
```

---

## 🏗️ 솔루션 아키텍처

### 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        VibeLens Main Process                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          WebAppService (새로 추가)                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  - detectProjectType(repoPath, commitHash)               │  │
│  │  - buildAndRun(repoPath, commitHash, port?)              │  │
│  │  - stopServer(sessionId)                                 │  │
│  │  - getStatus(sessionId)                                  │  │
│  │  - getLogs(sessionId)                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          BuildManager (새로 추가)                         │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  - Child process orchestration                           │  │
│  │  - stdout/stderr streaming                               │  │
│  │  - Port allocation (find free port)                      │  │
│  │  - Session lifecycle management                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      VibeLens Renderer Process                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   CenterPanel (Modified)                                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Tab 1: Diff (기존 DiffViewer)                           │  │
│  │  Tab 2: Live Preview (새로 추가)                         │  │
│  │    - <webview> or Electron BrowserView                   │  │
│  │    - Loading state (빌드 중)                             │  │
│  │    - Error boundary (빌드 실패)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   RightPanel (Modified)                                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Tab 1: Analysis (기존 AIContextPanel)                   │  │
│  │  Tab 2: Chat (기존 AIChatbox)                            │  │
│  │  Tab 3: Status (새로 추가 - WebAppStatusPanel)           │  │
│  │  Tab 4: Log (새로 추가 - WebAppLogPanel)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   useWebAppStore (새로 추가 - Zustand)                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  State:                                                   │  │
│  │    - sessionId: string | null                            │  │
│  │    - status: 'idle'|'building'|'running'|'error'         │  │
│  │    - port: number | null                                 │  │
│  │    - buildLogs: string[]                                 │  │
│  │    - consoleLogs: ConsoleLog[]                           │  │
│  │    - warnings: Warning[]                                 │  │
│  │  Actions:                                                 │  │
│  │    - startWebApp(commit)                                 │  │
│  │    - stopWebApp()                                        │  │
│  │    - appendLog(log)                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 새로운 폴더 구조 (기존 코드와 분리)

```
src/
├── main/
│   └── services/
│       └── webapp/                    ← 새로운 폴더 (기존 코드와 분리)
│           ├── webappService.ts       (프로젝트 타입 감지, IPC 핸들러)
│           ├── buildManager.ts        (빌드 프로세스 관리)
│           ├── portAllocator.ts       (포트 자동 할당)
│           └── projectDetector.ts     (package.json/vite.config/next.config 분석)
│
├── renderer/src/
│   ├── components/
│   │   ├── left/
│   │   │   ├── CommitTimeline.tsx     (수정 - Play/Stop 버튼 추가)
│   │   │   └── CommitRow.tsx          (수정 - 버튼 레이아웃)
│   │   │
│   │   ├── center/
│   │   │   ├── CenterPanel.tsx        (수정 - 탭 추가, 자동 전환)
│   │   │   ├── DiffViewer.tsx         (기존 유지)
│   │   │   └── LivePreviewPanel.tsx   ← 새로 추가
│   │   │
│   │   └── right/
│   │       ├── AIContextPanel.tsx     (기존 유지)
│   │       ├── AIChatbox.tsx          (기존 유지)
│   │       ├── WebAppStatusPanel.tsx  ← 새로 추가
│   │       └── WebAppLogPanel.tsx     ← 새로 추가
│   │
│   └── stores/
│       └── webappStore.ts             ← 새로 추가 (Zustand + 탭 자동 전환)
│
└── shared/
    └── types.ts                        (수정 - WebApp 관련 타입 추가)
```

---

## 🛠️ 구현 계획

### Phase 1: 기반 구조 (2-3일)

#### Task 1.1: 타입 정의 (`src/shared/types.ts`)

```typescript
// WebApp 관련 타입
export type WebAppStatus = 'idle' | 'detecting' | 'building' | 'running' | 'error'

export type ProjectType =
  | 'react-vite'
  | 'react-cra'
  | 'nextjs'
  | 'vue'
  | 'static-html'
  | 'unknown'

export interface ProjectConfig {
  type: ProjectType
  devCommand: string | null  // "npm run dev", "npm start" 등
  buildCommand: string | null
  devPort: number | null
  hasEnvTemplate: boolean    // .env.example 존재 여부
  requiredEnvVars: string[]  // API_KEY 등
}

export interface WebAppSession {
  sessionId: string
  commitHash: string
  repoPath: string
  port: number
  status: WebAppStatus
  startedAt: number
  pid?: number
}

export interface BuildLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  source: 'build' | 'runtime'
}

export interface ConsoleLog {
  id: string
  timestamp: number
  level: 'log' | 'warn' | 'error'
  args: string[]
  source: string  // file:line
}

export interface WebAppWarning {
  type: 'missing-env' | 'port-conflict' | 'missing-dependency' | 'api-error'
  message: string
  severity: 'warning' | 'error'
}
```

**검증**: TypeScript 컴파일 성공, 기존 타입과 충돌 없음

---

#### Task 1.2: Main Process - Project Detector (`src/main/services/webapp/projectDetector.ts`)

```typescript
import fs from 'fs/promises'
import path from 'path'
import type { ProjectConfig, ProjectType } from '@shared/types'

export async function detectProjectType(
  repoPath: string,
  commitHash: string
): Promise<ProjectConfig> {
  // 1. package.json 확인
  const pkgPath = path.join(repoPath, 'package.json')
  let pkg: any = null

  try {
    const content = await fs.readFile(pkgPath, 'utf-8')
    pkg = JSON.parse(content)
  } catch {
    // package.json 없음 → static HTML 체크
    const indexPath = path.join(repoPath, 'index.html')
    const hasIndex = await fs.access(indexPath).then(() => true).catch(() => false)

    if (hasIndex) {
      return {
        type: 'static-html',
        devCommand: null,
        buildCommand: null,
        devPort: null,
        hasEnvTemplate: false,
        requiredEnvVars: []
      }
    }

    return {
      type: 'unknown',
      devCommand: null,
      buildCommand: null,
      devPort: null,
      hasEnvTemplate: false,
      requiredEnvVars: []
    }
  }

  // 2. 프로젝트 타입 감지
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  let type: ProjectType = 'unknown'
  let devCommand: string | null = null
  let buildCommand: string | null = null
  let devPort: number | null = null

  if (deps['next']) {
    type = 'nextjs'
    devCommand = 'npm run dev'
    buildCommand = 'npm run build'
    devPort = 3000
  } else if (deps['vite']) {
    type = 'react-vite'
    devCommand = 'npm run dev'
    buildCommand = 'npm run build'
    devPort = 5173
  } else if (deps['react-scripts']) {
    type = 'react-cra'
    devCommand = 'npm start'
    buildCommand = 'npm run build'
    devPort = 3000
  } else if (deps['vue']) {
    type = 'vue'
    devCommand = 'npm run dev'
    buildCommand = 'npm run build'
    devPort = 5173
  }

  // 3. .env.example 체크
  const envExamplePath = path.join(repoPath, '.env.example')
  const hasEnvTemplate = await fs.access(envExamplePath).then(() => true).catch(() => false)

  let requiredEnvVars: string[] = []
  if (hasEnvTemplate) {
    const envContent = await fs.readFile(envExamplePath, 'utf-8')
    requiredEnvVars = envContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim())
  }

  return {
    type,
    devCommand,
    buildCommand,
    devPort,
    hasEnvTemplate,
    requiredEnvVars
  }
}
```

**검증**: 다양한 프로젝트 타입에 대해 정확한 감지 확인

---

#### Task 1.3: Main Process - Build Manager (`src/main/services/webapp/buildManager.ts`)

```typescript
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type { WebAppSession, WebAppStatus } from '@shared/types'
import { v4 as uuid } from 'uuid'
import { findFreePort } from './portAllocator'
import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'

interface BuildSession {
  session: WebAppSession
  process: ChildProcess | null
  emitter: EventEmitter
  tempDir: string
}

const sessions = new Map<string, BuildSession>()

export async function buildAndRun(
  repoPath: string,
  commitHash: string,
  config: ProjectConfig
): Promise<WebAppSession> {
  // 1. Temp directory 생성 (격리된 환경)
  const tempDir = path.join(tmpdir(), 'vibelens-webapp', uuid())
  await fs.mkdir(tempDir, { recursive: true })

  // 2. Git worktree로 해당 커밋 체크아웃 (기존 레포에 영향 없음)
  const git = simpleGit(repoPath)
  await git.raw(['worktree', 'add', tempDir, commitHash])

  // 3. Port 할당
  const port = await findFreePort(config.devPort || 3000)

  const sessionId = uuid()
  const session: WebAppSession = {
    sessionId,
    commitHash,
    repoPath,
    port,
    status: 'building',
    startedAt: Date.now()
  }

  const emitter = new EventEmitter()
  sessions.set(sessionId, {
    session,
    process: null,
    emitter,
    tempDir
  })

  // 4. Build 프로세스 시작 (비동기)
  startBuildProcess(sessionId, tempDir, config, port, emitter)

  return session
}

async function startBuildProcess(
  sessionId: string,
  tempDir: string,
  config: ProjectConfig,
  port: number,
  emitter: EventEmitter
) {
  const sessionData = sessions.get(sessionId)
  if (!sessionData) return

  try {
    // 1. npm install
    emitter.emit('log', { level: 'info', message: 'Installing dependencies...' })
    await runCommand('npm', ['install'], tempDir, emitter)

    // 2. 환경변수 체크
    if (config.hasEnvTemplate && config.requiredEnvVars.length > 0) {
      emitter.emit('warning', {
        type: 'missing-env',
        message: `Missing environment variables: ${config.requiredEnvVars.join(', ')}. Some features may not work.`,
        severity: 'warning'
      })
    }

    // 3. Dev server 실행
    emitter.emit('log', { level: 'info', message: `Starting dev server on port ${port}...` })

    const [cmd, ...args] = (config.devCommand || 'npm run dev').split(' ')
    const proc = spawn(cmd, args, {
      cwd: tempDir,
      env: { ...process.env, PORT: String(port) },
      shell: true
    })

    sessionData.process = proc
    sessionData.session.pid = proc.pid
    sessionData.session.status = 'running'

    proc.stdout?.on('data', (data) => {
      emitter.emit('log', { level: 'info', message: data.toString(), source: 'build' })
    })

    proc.stderr?.on('data', (data) => {
      emitter.emit('log', { level: 'error', message: data.toString(), source: 'build' })
    })

    proc.on('exit', (code) => {
      if (code !== 0) {
        sessionData.session.status = 'error'
        emitter.emit('log', { level: 'error', message: `Process exited with code ${code}` })
      }
    })

  } catch (error: any) {
    sessionData.session.status = 'error'
    emitter.emit('log', { level: 'error', message: error.message })
  }
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  emitter: EventEmitter
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true })

    proc.stdout?.on('data', (data) => {
      emitter.emit('log', { level: 'info', message: data.toString() })
    })

    proc.stderr?.on('data', (data) => {
      emitter.emit('log', { level: 'warn', message: data.toString() })
    })

    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with code ${code}`))
    })
  })
}

export function stopSession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return

  // 프로세스 종료
  if (session.process) {
    session.process.kill('SIGTERM')
  }

  // Temp directory 삭제 (git worktree 제거)
  const git = simpleGit(session.session.repoPath)
  git.raw(['worktree', 'remove', session.tempDir, '--force'])

  sessions.delete(sessionId)
}

export function getSessionEmitter(sessionId: string): EventEmitter | null {
  return sessions.get(sessionId)?.emitter || null
}

export function getSession(sessionId: string): WebAppSession | null {
  return sessions.get(sessionId)?.session || null
}
```

**검증**:
- 빌드 프로세스가 격리된 환경에서 실행됨
- 로그가 실시간으로 스트리밍됨
- 기존 레포에 영향 없음

---

#### Task 1.4: Port Allocator (`src/main/services/webapp/portAllocator.ts`)

```typescript
import net from 'net'

export async function findFreePort(preferredPort: number): Promise<number> {
  let port = preferredPort

  while (!(await isPortFree(port))) {
    port++
    if (port > 65535) throw new Error('No free ports available')
  }

  return port
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port)
  })
}
```

---

#### Task 1.5: IPC Handlers (`src/main/ipc/registerIpc.ts` 수정)

```typescript
// 기존 IPC 핸들러에 추가

import * as webappService from '../services/webapp/webappService'

// WebApp 관련 IPC 채널
ipcMain.handle('webapp:detect', wrap(async (_, repoPath: string, commitHash: string) => {
  return await webappService.detectProject(repoPath, commitHash)
}))

ipcMain.handle('webapp:start', wrap(async (_, repoPath: string, commitHash: string) => {
  return await webappService.startWebApp(repoPath, commitHash)
}))

ipcMain.handle('webapp:stop', wrap(async (_, sessionId: string) => {
  return await webappService.stopWebApp(sessionId)
}))

ipcMain.handle('webapp:getStatus', wrap(async (_, sessionId: string) => {
  return await webappService.getStatus(sessionId)
}))

// Log streaming (이벤트 기반)
ipcMain.on('webapp:subscribeLogs', (event, sessionId: string) => {
  const emitter = buildManager.getSessionEmitter(sessionId)
  if (!emitter) return

  const logHandler = (log: any) => {
    event.sender.send('webapp:log', { sessionId, log })
  }

  const warningHandler = (warning: any) => {
    event.sender.send('webapp:warning', { sessionId, warning })
  }

  emitter.on('log', logHandler)
  emitter.on('warning', warningHandler)

  // Cleanup on disconnect
  event.sender.once('destroyed', () => {
    emitter.off('log', logHandler)
    emitter.off('warning', warningHandler)
  })
})
```

---

### Phase 2: Renderer UI (3-4일)

#### Task 2.0: CommitRow에 Play/Stop 버튼 추가 (`src/renderer/src/components/left/CommitTimeline.tsx`)

**디자인 목표**:
- Drawer 버튼 패턴과 일관성 유지
- Hover 시 자연스러운 fade-in 애니메이션
- 빌드 상태를 시각적으로 명확히 표시
- 키보드 단축키 지원 (`Cmd+Shift+P`)

```typescript
import { useWebAppStore } from '@renderer/stores/webappStore'
import { Play, Square, Loader2 } from 'lucide-react'

function CommitRow({
  commit,
  selected,
  onSelect,
  onOpenDetail
}: {
  commit: Commit
  selected: boolean
  onSelect: () => void
  onOpenDetail: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const { session, startWebApp, stopWebApp } = useWebAppStore()

  // 현재 커밋이 실행 중인지 확인
  const isRunning = session?.commitHash === commit.hash
  const status = isRunning ? session.status : 'idle'

  const handlePlayStop = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isRunning) {
      // Stop 버튼 클릭
      await stopWebApp()
    } else {
      // Play 버튼 클릭
      // 1. 커밋 선택 (diff 로드)
      onSelect()

      // 2. WebApp 시작
      await startWebApp(repoPath, commit.hash)

      // 3. Center panel "Live Preview" 탭으로 자동 전환
      // 4. Right panel "Log" 탭으로 자동 전환 (useWebAppStore에서 처리)
    }
  }

  // 버튼 상태 결정
  const buttonIcon = {
    idle: <Play size={14} />,
    detecting: <Loader2 size={14} className="animate-spin" />,
    building: <Loader2 size={14} className="animate-spin" />,
    running: <Square size={14} />,
    error: <Play size={14} />
  }[status]

  const buttonColor = {
    idle: 'text-fg-muted hover:text-accent-primary',
    detecting: 'text-accent',
    building: 'text-accent',
    running: 'text-state-error hover:text-state-error',
    error: 'text-fg-muted hover:text-accent-primary'
  }[status]

  const buttonTitle = {
    idle: 'Run webapp (⌘⇧P)',
    detecting: 'Detecting project type...',
    building: 'Building... (click to stop)',
    running: 'Stop webapp',
    error: 'Retry'
  }[status]

  return (
    <div
      className={cx(
        'relative w-full px-3 py-2 border-l-2 flex items-start gap-2.5 transition-colors group',
        selected ? 'bg-accent/10 border-accent' : 'border-transparent hover:bg-bg-elevated hover:border-border-strong'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main clickable area for selection */}
      <button onClick={onSelect} className="absolute inset-0" aria-label="Select commit" />

      <CacheDot hash={commit.hash} />
      <div className="min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-fg-muted font-mono">{commit.shortHash}</code>
          <span className="text-[11px] text-fg-muted">{commit.relativeDate}</span>
        </div>
        <div className="text-[12.5px] text-fg-primary truncate mt-0.5">{commit.subject}</div>
        <div className="text-[11px] text-fg-muted truncate mt-0.5">{commit.author}</div>
      </div>

      {/* Action buttons - Play/Stop & Drawer */}
      <div className="flex items-center gap-1">
        {/* Play/Stop button */}
        <button
          onClick={handlePlayStop}
          className={cx(
            'relative z-10 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
            buttonColor,
            'hover:bg-bg-tertiary transition-all duration-200',
            // 빌드 중이거나 실행 중이면 항상 표시, 아니면 hover 시에만
            status !== 'idle' ? 'opacity-100' : (isHovered || selected ? 'opacity-100' : 'opacity-0')
          )}
          aria-label={buttonTitle}
          title={buttonTitle}
          disabled={status === 'detecting'}
        >
          {buttonIcon}
        </button>

        {/* Drawer button (기존) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetail()
          }}
          className={cx(
            'relative z-10 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
            'text-fg-muted hover:text-fg-primary hover:bg-bg-tertiary',
            'transition-all duration-200',
            isHovered || selected ? 'opacity-100' : 'opacity-0'
          )}
          aria-label="View commit details"
          title="View full commit details"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
```

**검증 포인트**:
- ✅ Play 버튼이 Drawer 버튼과 동일한 디자인 언어 사용
- ✅ Hover 시 자연스럽게 나타남 (opacity transition)
- ✅ 빌드 중/실행 중 상태가 명확히 구분됨
- ✅ 키보드 단축키 tooltips 표시

---

### Phase 2: Renderer UI (3-4일)

#### Task 2.1: WebApp Store (`src/renderer/src/stores/webappStore.ts`)

```typescript
import { create } from 'zustand'
import type {
  WebAppSession,
  WebAppStatus,
  BuildLog,
  ConsoleLog,
  WebAppWarning,
  ProjectConfig
} from '@shared/types'
import { api } from '@renderer/api/client'

interface WebAppState {
  // Session
  session: WebAppSession | null
  projectConfig: ProjectConfig | null

  // Logs
  buildLogs: BuildLog[]
  consoleLogs: ConsoleLog[]
  warnings: WebAppWarning[]

  // UI State (자동 탭 전환)
  autoSwitchToPreview: boolean
  autoSwitchToLog: boolean

  // Actions
  startWebApp: (repoPath: string, commitHash: string) => Promise<void>
  stopWebApp: () => Promise<void>
  appendBuildLog: (log: BuildLog) => void
  appendConsoleLog: (log: ConsoleLog) => void
  addWarning: (warning: WebAppWarning) => void
  clearLogs: () => void
}

export const useWebAppStore = create<WebAppState>((set, get) => ({
  session: null,
  projectConfig: null,
  buildLogs: [],
  consoleLogs: [],
  warnings: [],
  autoSwitchToPreview: false,
  autoSwitchToLog: false,

  startWebApp: async (repoPath: string, commitHash: string) => {
    // 🆕 탭 자동 전환 플래그 설정
    set({
      autoSwitchToPreview: true,
      autoSwitchToLog: true,
      buildLogs: [],
      warnings: []
    })

    // 1. 프로젝트 타입 감지
    const config = await api.webapp.detect(repoPath, commitHash)
    set({ projectConfig: config })

    if (config.type === 'unknown') {
      set({
        warnings: [{
          type: 'missing-dependency',
          message: 'This commit does not appear to be a web application.',
          severity: 'error'
        }],
        autoSwitchToPreview: false,
        autoSwitchToLog: false
      })
      return
    }

    // 2. 세션 시작
    const session = await api.webapp.start(repoPath, commitHash)
    set({ session })

    // 3. Log streaming 구독
    api.webapp.subscribeLogs(session.sessionId, (log) => {
      get().appendBuildLog(log)
    }, (warning) => {
      get().addWarning(warning)
    })
  },

  stopWebApp: async () => {
    const { session } = get()
    if (!session) return

    await api.webapp.stop(session.sessionId)
    set({
      session: null,
      buildLogs: [],
      consoleLogs: [],
      warnings: [],
      autoSwitchToPreview: false,
      autoSwitchToLog: false
    })
  },

  appendBuildLog: (log) => {
    set(state => ({ buildLogs: [...state.buildLogs, log] }))
  },

  appendConsoleLog: (log) => {
    set(state => ({ consoleLogs: [...state.consoleLogs, log] }))
  },

  addWarning: (warning) => {
    set(state => ({ warnings: [...state.warnings, warning] }))
  },

  clearLogs: () => {
    set({ buildLogs: [], consoleLogs: [], warnings: [] })
  }
}))
```

---

#### Task 2.2: Center Panel 수정 - 자동 탭 전환 (`src/renderer/src/components/center/CenterPanel.tsx`)

```typescript
import { Panel } from '@renderer/components/primitives/Panel'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useWebAppStore } from '@renderer/stores/webappStore'
import { DiffViewer } from './DiffViewer'
import { LivePreviewPanel } from './LivePreviewPanel'
import { FileDiff, Globe } from 'lucide-react'
import { cx } from '@renderer/lib/cx'
import { useState, useEffect } from 'react'

type CenterTab = 'diff' | 'preview'

export function CenterPanel() {
  const { diff, diffLoading, selectedCommitHash, path } = useRepoStore()
  const { autoSwitchToPreview } = useWebAppStore()
  const [activeTab, setActiveTab] = useState<CenterTab>('diff')

  // 🆕 Play 버튼 클릭 시 자동으로 Live Preview 탭으로 전환
  useEffect(() => {
    if (autoSwitchToPreview) {
      setActiveTab('preview')
    }
  }, [autoSwitchToPreview])

  return (
    <Panel
      title={
        <>
          <FileDiff size={13} />
          <span>Code Changes</span>
        </>
      }
      bodyClassName="p-0 flex flex-col"
    >
      {/* Tab Navigation */}
      <div className="flex border-b border-border bg-bg-secondary/60">
        <button
          onClick={() => setActiveTab('diff')}
          className={cx(
            'flex items-center gap-2 px-4 h-9 text-xs font-medium',
            activeTab === 'diff'
              ? 'border-b-2 border-accent-primary text-fg-primary bg-bg-panel'
              : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary'
          )}
        >
          <FileDiff size={12} />
          Diff
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={cx(
            'flex items-center gap-2 px-4 h-9 text-xs font-medium',
            activeTab === 'preview'
              ? 'border-b-2 border-accent-primary text-fg-primary bg-bg-panel'
              : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary'
          )}
        >
          <Globe size={12} />
          Live Preview
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'diff' ? (
          <DiffViewer />
        ) : (
          <LivePreviewPanel commitHash={selectedCommitHash} repoPath={path} />
        )}
      </div>
    </Panel>
  )
}
```

---

#### Task 2.3: Live Preview Panel (`src/renderer/src/components/center/LivePreviewPanel.tsx`)

```typescript
import { useWebAppStore } from '@renderer/stores/webappStore'
import { useEffect, useState } from 'react'
import { Spinner } from '@renderer/components/primitives/Spinner'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { Globe, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'

interface Props {
  commitHash: string | null
  repoPath: string | null
}

export function LivePreviewPanel({ commitHash, repoPath }: Props) {
  const { session, projectConfig, warnings, startWebApp, stopWebApp } = useWebAppStore()
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    // 커밋이 변경되면 기존 세션 종료
    return () => {
      if (session) stopWebApp()
    }
  }, [commitHash])

  const handleStart = async () => {
    if (!commitHash || !repoPath) return
    setIsStarting(true)
    try {
      await startWebApp(repoPath, commitHash)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    await stopWebApp()
  }

  const handleRestart = async () => {
    await handleStop()
    await handleStart()
  }

  // No commit selected
  if (!commitHash || !repoPath) {
    return (
      <EmptyState
        icon={<Globe size={32} />}
        title="No commit selected"
        description="Select a commit to preview the webapp at that point in time."
      />
    )
  }

  // Session not started
  if (!session && !isStarting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Globe size={48} className="text-accent-primary" />
        <h3 className="text-lg font-semibold">Live Preview</h3>
        <p className="text-sm text-fg-muted text-center max-w-md">
          Run the webapp from this commit in an isolated environment.
          Build logs and console output will appear in the right panel.
        </p>
        <Button onClick={handleStart} size="lg">
          <Globe size={16} className="mr-2" />
          Start Preview
        </Button>
      </div>
    )
  }

  // Building
  if (session?.status === 'building' || isStarting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-fg-muted">Building and starting dev server...</p>
        <p className="text-xs text-fg-muted">Check the Log tab for details</p>
      </div>
    )
  }

  // Error
  if (session?.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertTriangle size={48} className="text-state-error" />
        <h3 className="text-lg font-semibold">Build Failed</h3>
        <p className="text-sm text-fg-muted">Check the Log tab for error details.</p>
        <div className="flex gap-2">
          <Button onClick={handleRestart} variant="secondary">
            <RefreshCw size={14} className="mr-2" />
            Retry
          </Button>
          <Button onClick={handleStop} variant="ghost">
            Close
          </Button>
        </div>
      </div>
    )
  }

  // Running - show webview
  if (session?.status === 'running') {
    const url = `http://localhost:${session.port}`

    return (
      <div className="flex flex-col h-full">
        {/* Warnings banner */}
        {warnings.length > 0 && (
          <div className="bg-state-warning-dim border-b border-state-warning p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-state-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="text-fg-primary">{w.message}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary/40 text-xs">
          <span className="flex-1 font-mono truncate text-fg-secondary">{url}</span>
          <Button onClick={handleRestart} size="sm" variant="ghost">
            <RefreshCw size={12} />
          </Button>
          <Button onClick={handleStop} size="sm" variant="ghost">
            Stop
          </Button>
        </div>

        {/* WebView */}
        <webview
          src={url}
          className="flex-1 w-full h-full bg-white"
          preload="path/to/webview-preload.js"  // Console.log capture
        />
      </div>
    )
  }

  return null
}
```

---

#### Task 2.4: Right Panel - Status Tab (`src/renderer/src/components/right/WebAppStatusPanel.tsx`)

```typescript
import { useWebAppStore } from '@renderer/stores/webappStore'
import { AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react'
import { cx } from '@renderer/lib/cx'

export function WebAppStatusPanel() {
  const { session, projectConfig, warnings } = useWebAppStore()

  if (!session && !projectConfig) {
    return (
      <div className="p-4 text-sm text-fg-muted">
        No webapp session active. Start a preview from the center panel.
      </div>
    )
  }

  const statusIcon = {
    idle: <XCircle size={16} className="text-fg-muted" />,
    detecting: <Loader size={16} className="animate-spin text-accent" />,
    building: <Loader size={16} className="animate-spin text-accent" />,
    running: <CheckCircle size={16} className="text-state-success" />,
    error: <XCircle size={16} className="text-state-error" />
  }[session?.status || 'idle']

  const statusLabel = {
    idle: 'Idle',
    detecting: 'Detecting project type...',
    building: 'Building...',
    running: 'Running',
    error: 'Error'
  }[session?.status || 'idle']

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Status */}
      <div>
        <h3 className="text-xs font-semibold text-fg-muted mb-2">Status</h3>
        <div className="flex items-center gap-2 p-3 bg-bg-tertiary rounded border border-border">
          {statusIcon}
          <span className="font-medium">{statusLabel}</span>
        </div>
      </div>

      {/* Project Info */}
      {projectConfig && (
        <div>
          <h3 className="text-xs font-semibold text-fg-muted mb-2">Project</h3>
          <div className="space-y-2 p-3 bg-bg-tertiary rounded border border-border text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Type:</span>
              <span className="font-mono">{projectConfig.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Dev Command:</span>
              <span className="font-mono">{projectConfig.devCommand || 'N/A'}</span>
            </div>
            {session && (
              <div className="flex justify-between">
                <span className="text-fg-muted">Port:</span>
                <span className="font-mono">{session.port}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-fg-muted mb-2">Warnings</h3>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cx(
                  'flex items-start gap-2 p-3 rounded border text-xs',
                  w.severity === 'error'
                    ? 'bg-state-error-dim border-state-error'
                    : 'bg-state-warning-dim border-state-warning'
                )}
              >
                <AlertTriangle
                  size={14}
                  className={cx(
                    'mt-0.5 flex-shrink-0',
                    w.severity === 'error' ? 'text-state-error' : 'text-state-warning'
                  )}
                />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

#### Task 2.5: Right Panel - Log Tab (`src/renderer/src/components/right/WebAppLogPanel.tsx`)

```typescript
import { useWebAppStore } from '@renderer/stores/webappStore'
import { useEffect, useRef } from 'react'
import { Terminal, AlertCircle, Info } from 'lucide-react'
import { cx } from '@renderer/lib/cx'

export function WebAppLogPanel() {
  const { buildLogs } = useWebAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [buildLogs])

  if (buildLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-fg-muted">
        <Terminal size={32} />
        <p className="text-sm mt-2">No logs yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px] bg-[#1e1e1e]">
        {buildLogs.map((log) => (
          <div
            key={log.id}
            className={cx(
              'flex items-start gap-2 px-2 py-1',
              log.level === 'error' && 'text-red-400',
              log.level === 'warn' && 'text-yellow-400',
              log.level === 'info' && 'text-gray-300'
            )}
          >
            {log.level === 'error' && <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
            {log.level === 'warn' && <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
            {log.level === 'info' && <Info size={12} className="mt-0.5 flex-shrink-0" />}
            <span className="flex-1 break-words">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
```

---

#### Task 2.6: Right Panel 자동 탭 전환 (`App.tsx` 또는 `RightPanel.tsx`)

**목표**: Play 버튼 클릭 시 Right Panel이 자동으로 "Log" 탭으로 전환

```typescript
// App.tsx 또는 별도의 RightPanelContainer 컴포넌트에서
import { useWebAppStore } from '@renderer/stores/webappStore'
import { useState, useEffect } from 'react'

type RightTab = 'analysis' | 'chat' | 'status' | 'log'

function RightPanel() {
  const { autoSwitchToLog } = useWebAppStore()
  const [activeTab, setActiveTab] = useState<RightTab>('analysis')

  // 🆕 Play 버튼 클릭 시 자동으로 Log 탭으로 전환
  useEffect(() => {
    if (autoSwitchToLog) {
      setActiveTab('log')
    }
  }, [autoSwitchToLog])

  return (
    <Panel>
      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')}>
          Analysis
        </TabButton>
        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
          Chat
        </TabButton>
        <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')}>
          Status
        </TabButton>
        <TabButton active={activeTab === 'log'} onClick={() => setActiveTab('log')}>
          Log
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && <AIContextPanel />}
      {activeTab === 'chat' && <AIChatbox />}
      {activeTab === 'status' && <WebAppStatusPanel />}
      {activeTab === 'log' && <WebAppLogPanel />}
    </Panel>
  )
}
```

---

#### Task 2.7: 키보드 단축키 (`src/renderer/src/hooks/useKeyboardShortcuts.ts`)

**새로운 단축키 추가**:
- `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux): Play/Stop WebApp toggle

```typescript
// useKeyboardShortcuts.ts 수정
import { useWebAppStore } from '@renderer/stores/webappStore'
import { useRepoStore } from '@renderer/stores/repoStore'

export function useKeyboardShortcuts() {
  const { session, startWebApp, stopWebApp } = useWebAppStore()
  const { selectedCommitHash, path } = useRepoStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // 🆕 Cmd/Ctrl + Shift + P: Play/Stop WebApp
      if (cmdOrCtrl && e.shiftKey && e.key === 'P') {
        e.preventDefault()

        if (session) {
          // Stop
          stopWebApp()
        } else if (selectedCommitHash && path) {
          // Play
          startWebApp(path, selectedCommitHash)
        }
        return
      }

      // ... 기존 단축키 (Cmd+R, Cmd+L 등)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session, selectedCommitHash, path, startWebApp, stopWebApp])
}
```

---

### Phase 3: Console Capture & Advanced Features (2-3일)

#### Task 3.1: WebView Preload Script (Console.log capture)

```typescript
// src/main/webview-preload.ts
import { ipcRenderer } from 'electron'

// Intercept console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
}

console.log = (...args: any[]) => {
  originalConsole.log(...args)
  ipcRenderer.send('webapp:console', { level: 'log', args: args.map(String) })
}

console.warn = (...args: any[]) => {
  originalConsole.warn(...args)
  ipcRenderer.send('webapp:console', { level: 'warn', args: args.map(String) })
}

console.error = (...args: any[]) => {
  originalConsole.error(...args)
  ipcRenderer.send('webapp:console', { level: 'error', args: args.map(String) })
}

// Intercept network errors
window.addEventListener('error', (event) => {
  ipcRenderer.send('webapp:console', {
    level: 'error',
    args: [`Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}`]
  })
})
```

#### Task 3.2: Browser DevTools Integration (Optional - 고급 기능)

- Electron의 `webContents.openDevTools()` 호출하여 별도 DevTools 창 열기
- 우클릭 컨텍스트 메뉴에 "Inspect Element" 추가

---

### Phase 4: 문서 업데이트 및 테스트 (1-2일)

#### Task 4.1: SOURCE_FUNCTION_MAP.md 업데이트

```markdown
## WebApp Emulator (Phase 5)

### Main Process Services

**WebApp Service** (`src/main/services/webapp/webappService.ts`)
- `detectProject(repoPath, commitHash)` - 프로젝트 타입 감지
- `startWebApp(repoPath, commitHash)` - 웹앱 세션 시작
- `stopWebApp(sessionId)` - 세션 종료

**Build Manager** (`src/main/services/webapp/buildManager.ts`)
- `buildAndRun(repoPath, commitHash, config)` - 빌드 및 실행
- `stopSession(sessionId)` - 세션 정리
- `getSessionEmitter(sessionId)` - 로그 스트리밍 emitter

**Project Detector** (`src/main/services/webapp/projectDetector.ts`)
- `detectProjectType(repoPath, commitHash)` - package.json 분석

**Port Allocator** (`src/main/services/webapp/portAllocator.ts`)
- `findFreePort(preferredPort)` - 사용 가능한 포트 찾기

### Renderer Components

**LivePreviewPanel** (`src/renderer/src/components/center/LivePreviewPanel.tsx`)
- WebView 기반 미리보기
- 빌드 상태 표시
- 에러 핸들링

**WebAppStatusPanel** (`src/renderer/src/components/right/WebAppStatusPanel.tsx`)
- 세션 상태 표시
- 경고 메시지 표시

**WebAppLogPanel** (`src/renderer/src/components/right/WebAppLogPanel.tsx`)
- 빌드 로그 스트리밍
- 콘솔 로그 캡처

### Stores

**useWebAppStore** (`src/renderer/src/stores/webappStore.ts`)
- State: session, projectConfig, buildLogs, consoleLogs, warnings
- Actions: startWebApp(), stopWebApp(), appendBuildLog()
```

#### Task 4.2: REVERSE_PROMPT_ENGINEERING_STRATEGY.md 업데이트

- WebApp Emulator 기능이 추가되었으므로 "Learning by Doing" 섹션 추가
- "프롬프트로 구현 → 실시간 미리보기" 워크플로우 설명

---

## 🔥 기술적 도전 과제 및 해결 방안

### Challenge 1: Git Worktree 관리

**문제**: 동일 커밋을 여러 번 빌드하면 temp 디렉토리가 쌓임

**해결**:
- Session ID 기반으로 temp 디렉토리 관리
- 세션 종료 시 자동으로 `git worktree remove` 실행
- 앱 종료 시 모든 worktree cleanup

### Challenge 2: 빌드 캐싱 (node_modules)

**문제**: 매번 `npm install` 실행 시 시간 소요

**해결 (Phase 3)**:
- `package-lock.json` 해시 기반 캐싱
- 이전 빌드의 `node_modules`를 복사 후 `npm ci` 실행
- 캐시 디렉토리: `~/.vibelens/build-cache/{repo-name}/{lock-hash}/`

### Challenge 3: 환경변수 처리

**문제**: API 키 등이 없어 기능이 동작 안 함

**해결**:
- `.env.example` 파싱하여 필수 변수 목록 추출
- Status 탭에 경고 표시
- 향후: 사용자가 VibeLens 내부에서 env 값 입력 가능하도록 UI 제공 (Phase 4)

### Challenge 4: 포트 충돌

**문제**: 기본 포트(3000, 5173)가 이미 사용 중

**해결**:
- `portAllocator.ts`로 사용 가능한 포트 자동 탐색
- 3000번부터 순차 탐색 (65535까지)

### Challenge 5: WebView vs BrowserView

**비교**:

| 특징 | `<webview>` (태그) | `BrowserView` (API) |
|------|-------------------|-------------------|
| 통합 난이도 | ⭐⭐ 쉬움 (HTML 태그) | ⭐⭐⭐ 중간 (Electron API) |
| DevTools | preload 스크립트 필요 | 내장 지원 |
| Console Capture | IPC 필요 | `webContents.on('console-message')` |
| 보안 | Sandboxed | Sandboxed |
| CSS 제어 | 쉬움 (flex-1 등) | 수동 위치 계산 필요 |

**선택**: `<webview>` 태그 (Phase 1-2), BrowserView는 Phase 3에서 고려

---

## 📊 성공 지표 및 검증

### 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **빌드 성공률** | 80% 이상 (React/Next.js 프로젝트) | 자동 테스트 |
| **빌드 시간** | 2분 이내 (node_modules 캐싱 전) | 평균 측정 |
| **UI 응답성** | 빌드 중에도 UI 반응 | 메인 스레드 블로킹 없음 확인 |
| **로그 스트리밍 지연** | 1초 이내 | 실시간 측정 |

### 검증 시나리오

#### Scenario 1: React Vite 프로젝트

```
1. VibeLens에서 React Vite 프로젝트 열기
2. 특정 커밋 선택 (UI 변경 포함)
3. Live Preview 탭 열기 → "Start Preview" 클릭
4. Status 탭에서 "Building..." 확인
5. Log 탭에서 실시간 빌드 로그 확인
6. 빌드 완료 후 WebView에서 앱 실행 확인
7. 브라우저 콘솔 로그가 Log 탭에 나타나는지 확인
```

**예상 결과**:
- ✅ 빌드 성공
- ✅ WebView에서 앱 정상 작동
- ✅ 콘솔 로그 캡처됨

#### Scenario 2: 환경변수 누락 프로젝트

```
1. .env.example에 API_KEY 정의된 프로젝트 열기
2. Live Preview 시작
3. Status 탭에서 경고 메시지 확인:
   "Missing environment variables: API_KEY. Some features may not work."
```

**예상 결과**:
- ✅ 빌드는 성공하지만 경고 표시
- ✅ API 호출 실패 로그가 Log 탭에 나타남

#### Scenario 3: 빌드 실패 프로젝트

```
1. TypeScript 에러가 있는 커밋 선택
2. Live Preview 시작
3. Status: "Error" 표시
4. Log 탭에서 TypeScript 에러 메시지 확인
```

**예상 결과**:
- ✅ 에러 상태 표시
- ✅ 에러 메시지 명확히 출력

---

## 🚀 Phase별 우선순위

### Phase 1 (MVP) - 2-3일
- ✅ Project detection
- ✅ Basic build & run (React Vite/Next.js)
- ✅ WebView integration
- ✅ Status/Log tabs

### Phase 2 (기능 확장) - 2-3일
- ✅ Console.log capture
- ✅ Environment variable warnings
- ⏳ CRA/Vue 지원

### Phase 3 (최적화) - 2-3일
- ⏳ node_modules 캐싱
- ⏳ BrowserView 전환 (DevTools 통합)
- ⏳ 사용자 환경변수 입력 UI

### Phase 4 (고급 기능) - 선택적
- ⏳ Hot Module Replacement 지원
- ⏳ Network request inspector
- ⏳ Performance profiling

---

## 📚 참고 자료

### 내부 문서
- `docs/SOURCE_FUNCTION_MAP.md` - 소스 구조 맵
- `docs/REVERSE_PROMPT_ENGINEERING_STRATEGY.md` - AI 분석 전략

### 외부 기술 문서
- [Electron WebView](https://www.electronjs.org/docs/latest/api/webview-tag)
- [Electron BrowserView](https://www.electronjs.org/docs/latest/api/browser-view)
- [Git Worktree](https://git-scm.com/docs/git-worktree)
- [Vite Dev Server API](https://vitejs.dev/guide/api-javascript.html)

---

## 🎨 UX 개선 요약

### Before (기존 설계)
```
1. 커밋 선택
2. Center Panel에서 "Live Preview" 탭 클릭
3. "Start Preview" 버튼 클릭
4. Right Panel에서 "Log" 탭으로 수동 전환
```
**총 4단계** - 클릭이 너무 많고 번거로움

### After (개선된 설계)
```
1. 커밋 row의 Play 버튼 클릭 (hover 시 표시)
   → 자동으로:
     - Center Panel: "Live Preview" 탭 활성화
     - Right Panel: "Log" 탭 활성화
     - 빌드 진행 상황 실시간 표시
```
**총 1단계** - 한 번의 클릭으로 모든 것 자동 처리

### 핵심 UX 원칙

1. **일관성 (Consistency)**
   - Play 버튼 디자인이 Drawer 버튼과 동일한 패턴
   - Hover → Fade-in 애니메이션 일관성 유지

2. **접근성 (Accessibility)**
   - 커밋 리스트에서 바로 실행 가능
   - 키보드 단축키 지원 (`Cmd+Shift+P`)
   - Tooltip으로 기능 안내

3. **피드백 (Feedback)**
   - Play → Spinner → Stop 버튼 상태 전환
   - 빌드 로그 실시간 스트리밍
   - 에러 발생 시 명확한 메시지

4. **효율성 (Efficiency)**
   - 1-click 워크플로우
   - 자동 탭 전환으로 사용자 인지 부하 감소

---

## 🔄 다음 단계

### 즉시 실행 가능한 작업 (Phase 1 시작)

1. **타입 정의** (30분)
   ```bash
   # src/shared/types.ts 편집
   # WebAppStatus, ProjectConfig, WebAppSession 타입 추가
   npm run typecheck
   ```

2. **Project Detector 구현** (2시간)
   ```bash
   # src/main/services/webapp/projectDetector.ts 생성
   # package.json 파싱 로직 작성
   # 단위 테스트 작성
   ```

3. **IPC 핸들러 추가** (1시간)
   ```bash
   # src/main/ipc/registerIpc.ts 수정
   # webapp:detect, webapp:start, webapp:stop 핸들러 추가
   ```

4. **WebApp Store 생성 (자동 탭 전환 포함)** (2시간)
   ```bash
   # src/renderer/src/stores/webappStore.ts 생성
   # Zustand 스토어 구조 작성 (autoSwitchToPreview, autoSwitchToLog)
   ```

5. **CommitRow에 Play/Stop 버튼 추가** (2시간)
   ```bash
   # src/renderer/src/components/left/CommitTimeline.tsx 수정
   # Play/Stop 버튼 UI 구현
   # Hover state, 상태 애니메이션 추가
   ```

---

**작성자**: Claude (VibeLens AI)
**최종 업데이트**: 2026-04-22 (UX 개선 반영)
**리뷰 상태**: ✅ 아키텍처 설계 완료, Modern UX 패턴 적용, 구현 준비 완료
