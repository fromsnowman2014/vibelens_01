# Cursor-like Interface 구현 계획

**작성일**: 2026-04-12  
**최종 업데이트**: 2026-04-12 (비판적 분석 반영 v2)  
**목적**: Cursor IDE와 유사한 사용자 인터페이스를 VibeLens에 구현하여 사용자 경험 개선

> ⚠️ **주의**: 이 문서의 모든 UI 구현은 기존 Catppuccin Mocha 기반 디자인 시스템(`globals.css` + `tailwind.config.ts`)을 따릅니다.

---

## 📸 Cursor 인터페이스 분석

### Cursor의 핵심 UI 요소

1. **중앙 대형 로고 및 브랜딩**
   - Cursor 로고 중앙 배치
   - "Free Plan · Upgrade" 정보 표시

2. **3가지 주요 액션 버튼 (카드 형식)**
   - 📁 **Open project** - 프로젝트 열기
   - 📋 **Clone repo** - Repository Clone

3. **Recent projects 목록**
   - 최근 열었던 프로젝트 목록 (5개 표시)
   - "View all (23)" 링크로 전체 보기
   - 프로젝트명과 경로 표시

4. **하단 CTA**
   - "Try a new window for running parallel agents" - 새로운 기능 프로모션

5. **상단 바**
   - Search 기능
   - Agents Window, Settings 등 유틸리티 아이콘

---

## 🎯 VibeLens 현재 상태 vs Cursor 인터페이스

### ✅ VibeLens에 이미 구현된 기능

| Cursor 기능 | VibeLens 상태 | 파일 위치 |
|------------|--------------|----------|
| Open project | ✅ 구현됨 | `TitleBar.tsx` - Open 버튼 |
| Clone repo | ✅ 구현됨 | `TitleBar.tsx` - Clone 버튼 |
| Recent repos | ✅ 구현됨 | `settingsService.ts` - recentRepos 배열 |

### ❌ VibeLens에 없는 기능

| Cursor 기능 | VibeLens 상태 | 필요성 검토 |
|------------|--------------|------------|
| Connect via SSH | ❌ 없음 | ❌ **불필요** - VibeLens 용도상 제외 확정 |
| Welcome Screen | ❌ 없음 | ✅ **필요** - 첫 실행 시 안내 및 Recent 표시 |
| Search (global) | ❌ 없음 | ✅ **필요** - Commit, 변경사항, 기능 등 검색 필수 |
| Upgrade/Plan info | ❌ 없음 | ❌ **불필요** - VibeLens는 무료 오픈소스 |

---

## 🎨 구현 계획: Welcome Screen

### Phase 1: Welcome Screen 기본 구조

VibeLens의 Welcome Screen을 Cursor와 유사하게 구현합니다.

#### 1.1 Welcome Screen 표시 조건

**표시 시점:**
- 앱 시작 시 열린 Repository가 없는 경우
- 모든 Repository를 닫은 경우

**숨김 시점:**
- Repository를 열었을 때
- Clone이 완료된 후

#### 1.2 Welcome Screen 레이아웃

```
┌─────────────────────────────────────────────┐
│                                             │
│              [VibeLens Logo]                │
│         AI-Powered Git Commit               │
│            Analysis Tool                    │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 📁 Open  │ │ 📋 Clone │ │ ⚙️ Setup │   │
│  │Repository│ │   Repo   │ │  API Key │   │
│  └──────────┘ └──────────┘ │ [✅ Saved] │   │
│                            └──────────┘   │
│                                             │
│  Recent Repositories                        │
│  ────────────────────────────────────       │
│  ● vibelens_01        ~/Desktop/github/... │
│  ● my-project         ~/Projects/...       │
│  ● sample-repo        ~/Desktop/...        │
│                                             │
│                       View all (5) →        │
│                                             │
│  💡 Tip: Press ⌘O to open a repository     │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Phase 2: 상세 설계

#### 2.1 새 컴포넌트: `WelcomeScreen.tsx`

**위치**: `src/renderer/src/components/welcome/WelcomeScreen.tsx`

**Props**: 없음 (자체적으로 store 구독)

**주요 기능**:
1. VibeLens 로고 및 태그라인 표시
2. 3가지 주요 액션 카드:
   - **Open Repository**: `repoStore.openRepo()` 호출
   - **Clone Repository**: Clone 모달 열기
   - **Setup API Key**: Settings 모달 열기 (API Key 탭)
     * 요구사항: 기존에 저장된 키가 있는지, 혹은 새로 입력해야 하는지 식별 가능한 뱃지/표시 추가 (예: `✅ Saved`, `⚠️ Required`)
     * 구현 참고: `settingsStore.ts`에 `hasClaudeKey: boolean`이 이미 존재하므로 추가 IPC 불필요. `useSettingsStore((s) => s.hasClaudeKey)`로 즉시 사용 가능.
3. Recent Repositories 목록 (최대 5개)
   - 클릭 시 해당 Repository 열기
   - "View all" 클릭 시 전체 목록 모달 표시
4. 하단 Tip 또는 Getting Started 링크

#### 2.2 수정할 컴포넌트: `App.tsx`

**변경 사항**:
- `path` (현재 열린 Repository)가 `null`일 때 `WelcomeScreen` 표시
- `path`가 있을 때 기존 `ThreePanelLayout` 표시

**로직**:
```typescript
const repoPath = useRepoStore((s) => s.path)

return (
  <div className="flex flex-col h-full">
    <TitleBar ... />

    {!repoPath ? (
      <WelcomeScreen />
    ) : (
      <ThreePanelLayout ... />
    )}

    <StatusBar />
    {/* Modals */}
  </div>
)
```

#### 2.3 Recent Repositories 관리

**현재 상태**:
- `settingsService.ts`에 `recentRepos: string[]` 배열 존재
- `addRecentRepo(path)` 함수로 추가 (최대 10개)

**개선 사항**:
1. Recent Repos에 메타 정보 추가:
   ```typescript
   interface RecentRepo {
     path: string
     name: string
     lastOpened: number // timestamp
     branch?: string
   }
   ```

2. `settingsStore`에 getter 추가:
   ```typescript
   getRecentRepos(): RecentRepo[]
   ```

3. Repository 열 때마다 `lastOpened` 업데이트

#### 2.4 Global Menu Bar Architecture (Native Menu)

VibeLens의 메뉴 바를 확장하여 Cursor IDE와 같이 주요 기능을 빠르게 실행할 수 있도록 합니다.

**⚠️ 구현 시 필수 변경 사항 (SOURCE_FUNCTION_MAP.md 참조):**
1. `MenuActions` 인터페이스에 `closeRepo`, `cloneRepo` 추가 (`src/main/menu.ts`)
2. `repoStore.ts`에 `closeRepo()` 액션 추가 → `set({ path: null, commits: [], diff: null, selectedCommitHash: null })`
3. `src/main/index.ts`에서 `mainWindow.webContents.send('menu:closeRepo')` 및 `menu:cloneRepo` 연결
4. `App.tsx`에서 `api.on('menu:closeRepo')` / `api.on('menu:cloneRepo')` 리스너 추가

**Phase 1 — File Menu (기본):**
- **Open Repository...** (`Cmd+O`) — 기존
- **Clone Repository...** (`Cmd+Shift+O`) — *신규*
- **Close Repository** — *신규* (`path` → `null` → Welcome Screen)
- (Separator)
- **Close Window** (`Cmd+W`) — 기존

**Phase 2 — File Menu (확장):**
- **Open Recent** (Submenu) — *Phase 2에서 구현*
  - ⚠️ 동적 메뉴 빌드 필요: 레포 열 때마다 `Menu.setApplicationMenu(buildAppMenu(..., recentRepos))` 재호출
  - `buildAppMenu()` 시그니처에 `recentRepos: RecentRepo[]` 매개변수 추가 필요

**View Menu:**
- 기존 항목 유지 (Reload, DevTools, Zoom 등)

**Analysis Menu:**
- **Refresh Analysis** (`Cmd+Alt+R`) — 단축키 변경 (기존 `Cmd+R`은 Reload와 충돌)
- **Toggle Language (Ko/En)** (`Cmd+L`) — 기존

---

### Phase 3: 통합 검색 기능 (Search) — 2단계 접근

**Cursor의 용도**: 프로젝트 전체에서 파일/코드 검색

**VibeLens 적용 방향**: ✅ **필수 적용 (단, 2단계로 분리)**

#### Phase 3-A: 프론트엔드 필터링 (난이도: 낮음)
- 커밋 메시지, 해시, 작성자 검색
- 이미 메모리에 로드된 `commits: Commit[]` 배열에서 `Array.filter()` 수행
- 성능 영향 없음

#### Phase 3-B: Git pickaxe 검색 (난이도: 중)
- 변경사항(Diff) 내용 검색 및 특정 기능/키워드 검색
- ⚠️ **주의**: 모든 커밋의 diff를 프론트엔드에서 로드하면 80개 커밋 × 5개 파일 = 400회 `git show` 호출로 성능 병목 발생
- **대안**: `git log -S "keyword"` (pickaxe) 또는 `git log --grep="keyword"` 활용
- `gitService.ts`에 `searchCommits(repoPath, query, type)` 함수 추가
- IPC 채널 `git:searchCommits` 신설 필요

**구현 방안**:
1. `LeftPanel` 내에 검색 입력 필드 추가
2. Phase 3-A: 프론트엔드 `commits.filter()` 기반 즉시 필터
3. Phase 3-B: 백엔드 `git log -S` 기반 딥 검색 + 결과 하이라이팅

---

### Phase 4: AI 대화형 채팅 인터페이스 (AI Chat) — 2단계 접근

**Cursor의 용도**: 코드에 대해 AI에게 질의응답 (Cmd+K / Cmd+L)

**VibeLens 적용 방향**: ✅ **신규 기능 추가**

> ⚠️ **난이도 경고**: 현재 `ClaudeProvider.ts`는 단일 요청-응답(`analyzeCommit()`) 패턴만 지원합니다.
> 채팅 기능은 다중 턴 대화, 새 IPC 채널(3개 이상), Zustand store 신규 생성, 스트리밍 등이 필요합니다.

#### Phase 4-A: 단순 Q&A (난이도: 중, 4-5시간)
- 스트리밍 없이 단일 요청-응답 방식
- 기존 `callClaude()` 함수 재활용
- 유저 질문 입력 → 로딩 → 전체 응답 표시
- 기존 분석 결과 + diff를 컨텍스트로 포함

#### Phase 4-B: 스트리밍 + 고급 (난이도: 높음, 6-8시간)
- `client.messages.stream()` 기반 실시간 응답
- Electron IPC 스트리밍 패턴 (`webContents.send()`로 청크 전달)
- 토큰 윈도우 관리 (대화가 길어지면 이전 메시지 요약/삭제)

**필수 변경 사항:**
- 새 IPC 채널: `chat:send`, `chat:stream-chunk`, `chat:cancel`
- `preload/index.ts`에 `window.vibelens.chat.*` API 추가
- 새 Store: `src/renderer/src/stores/chatStore.ts` (대화 히스토리, 로딩 상태)
- 새 컴포넌트: `src/renderer/src/components/right/AIChatbox.tsx`

**주요 기능**:
1. 현재 분석된 커밋 내용을 Context로 유지
2. 추가 분석, 상세한 코드 리뷰, 구체적인 설명 등의 질의응답
3. 채팅 UI 구성 (메시지 입력, 대화 히스토리 출력)

**권장**: Phase 4-A만으로도 충분히 유용합니다. 유저 피드백 후 4-B 결정.

---

### Phase 5: 다중 LLM 지원 및 모델 선택 UI (Multi-LLM Support)

**목적**: 향후 Gemini, OpenAI 지원을 위해 확장성 있는 구조를 만들고, AI Analysis 패널 내에서 직관적으로 LLM과 모델을 전환할 수 있는 드롭다운 UI 제공.

**VibeLens 적용 방향**: ✅ **향후 확장성 및 사용성 강화를 위해 필수**

**설계 방향**:
1. **직관적인 UI (Dropdown)**: Settings 창에 들어가지 않고도 AI Context Panel 상단(아이콘/액션 영역)에서 현재 모델을 표시하고 전환할 수 있는 `<select>` 또는 커스텀 Dropdown 메뉴 제공.
2. **설정 관리 추상화**: `hasClaudeKey` 중심의 로직을 `activeProvider`, `activeModel`, `keys: Record<Provider, boolean>` 구조로 리팩토링.
3. **UX 방어 로직**: 사용자가 키가 없는 제공자(Provider)를 선택할 경우, 패널 중앙에 "API Key 설정 필요" EmptyState를 표시하여 바로 Settings로 유도.
4. **아키텍처 확장**: `keychainService.ts`의 `ProviderId` 확장 및 `LLMProvider` 인터페이스 기반 팩토리 패턴 도입.

---

## 📋 구현 순서 및 작업 항목

### Phase 1: Welcome Screen + Close Repository (5-6시간)

#### Task 1.1: WelcomeScreen 컴포넌트 생성
**예상 시간**: 1.5시간

**작업 내용**:
1. `src/renderer/src/components/welcome/WelcomeScreen.tsx` 생성
2. 레이아웃 및 스타일링 — **기존 Tailwind 토큰 사용** (`bg-bg-primary`, `bg-bg-secondary`, `text-fg-primary` 등)
3. 3가지 액션 카드 구현 (API Key 카드에 `hasClaudeKey` 상태 뱃지 포함)
4. VibeLens 로고 및 브랜딩 요소

**파일**:
- 새로 생성: `src/renderer/src/components/welcome/WelcomeScreen.tsx`

---

#### Task 1.2: Recent Repositories 목록 표시
**예상 시간**: 1시간

**작업 내용**:
1. `settingsStore`에서 `recentRepos` 읽기
2. 최근 5개 표시
3. 클릭 시 `repoStore.openRepoByPath()` 호출
4. "View all" 링크 (나중에 모달 연결)

**파일**:
- 수정: `src/renderer/src/components/welcome/WelcomeScreen.tsx`
- 참조: `src/renderer/src/stores/settingsStore.ts`

---

#### Task 1.3: App.tsx 통합 + closeRepo 구현
**예상 시간**: 1.5시간

**작업 내용**:
1. `repoPath`가 `null`일 때 `WelcomeScreen` 표시
2. `repoPath`가 있을 때 `ThreePanelLayout` 표시
3. `repoStore.ts`에 `closeRepo()` 액션 추가:
   ```typescript
   closeRepo: () => set({ path: null, name: null, commits: [], diff: null, selectedCommitHash: null, cachedHashes: new Set() })
   ```
4. `MenuActions` 인터페이스에 `closeRepo`, `cloneRepo` 추가 (`src/main/menu.ts`)
5. `src/main/menu.ts` File 메뉴에 Close Repository / Clone Repository 항목 추가
6. `src/main/index.ts`에서 `mainWindow.webContents.send('menu:closeRepo')` 연결
7. `App.tsx`에서 `api.on('menu:closeRepo')` / `api.on('menu:cloneRepo')` 리스너 추가
8. ⚠️ **Open Recent 네이티브 메뉴는 Phase 2로 이동** (동적 메뉴 재빌드 필요)

**파일** (DEVELOPMENT_PROTOCOL: IPC 추가 시 3개 파일 동시 업데이트):
- 수정: `src/renderer/src/App.tsx`
- 수정: `src/renderer/src/stores/repoStore.ts` (`closeRepo` 추가)
- 수정: `src/main/menu.ts` (MenuActions 확장 + 메뉴 항목)
- 수정: `src/main/index.ts` (IPC 연결)
- 업데이트 필수: `docs/SOURCE_FUNCTION_MAP.md`

---

#### Task 1.4: 스타일링 및 UX 개선
**예상 시간**: 1시간

**작업 내용**:
1. 반응형 레이아웃
2. 호버 효과
3. 트랜지션 애니메이션
4. 다크 테마 최적화

**파일**:
- 수정: `src/renderer/src/components/welcome/WelcomeScreen.tsx`

---

### Phase 2: Recent Repositories 개선 + Native 메뉴 확장 (3-4시간)

#### Task 2.1: RecentRepo 타입 확장
**예상 시간**: 1시간

**작업 내용**:
1. `Settings` 타입에서 `recentRepos` 확장:
   ```typescript
   recentRepos: Array<{
     path: string
     name: string
     lastOpened: number
     branch?: string
   }>
   ```
2. Migration 로직 (기존 `string[]` → 새 형식):
   ```typescript
   // addRecentRepo에서 호환성 처리
   const normalized = current.recentRepos.map(r =>
     typeof r === 'string'
       ? { path: r, name: basename(r), lastOpened: 0 }
       : r
   )
   ```
3. `addRecentRepo(path, branch?)` 수정

**파일**:
- 수정: `src/shared/types.ts`
- 수정: `src/main/services/settingsService.ts`
- 업데이트 필수: `docs/SOURCE_FUNCTION_MAP.md` (타입 섹션)

---

#### Task 2.2: Recent Repos 정렬 및 표시 개선
**예상 시간**: 1시간

**작업 내용**:
1. `lastOpened` 기준 정렬
2. Repository 이름 추출 개선
3. 상대 시간 표시 ("2 hours ago", "Yesterday" 등)

**파일**:
- 수정: `src/renderer/src/components/welcome/WelcomeScreen.tsx`

---

#### Task 2.3: Native 메뉴 Open Recent 서브메뉴 구현
**예상 시간**: 1.5시간

**작업 내용**:
1. `buildAppMenu()` 시그니처 변경: `(actions, recentRepos: RecentRepo[])` 추가
2. File Menu에 Open Recent 서브메뉴 동적 생성
3. 레포 열 때마다 `Menu.setApplicationMenu(buildAppMenu(...))` 재호출
4. `src/main/index.ts`에서 recentRepos 변경 감지 → 메뉴 리빌드

**파일**:
- 수정: `src/main/menu.ts`
- 수정: `src/main/index.ts`

---

### Phase 3: 선택적 개선 사항 (3-4시간)

#### Task 3.1: View All Repositories 모달
**예상 시간**: 1.5시간

**작업 내용**:
1. `RecentReposModal` 컴포넌트 생성
2. 전체 목록 표시 (페이징 또는 스크롤)
3. 검색 필터
4. 삭제 버튼

**파일**:
- 새로 생성: `src/renderer/src/components/modals/RecentReposModal.tsx`

---

#### Task 3.2: Getting Started / Tips
**예상 시간**: 1시간

**작업 내용**:
1. WelcomeScreen 하단에 팁 표시
2. 키보드 단축키 안내
3. Quick start 링크

**파일**:
- 수정: `src/renderer/src/components/welcome/WelcomeScreen.tsx`

---

#### Task 3.3-A: 커밋 메시지/해시/작성자 필터 (프론트엔드)
**예상 시간**: 1.5시간

**작업 내용**:
1. `LeftPanel`에 검색 입력 필드 추가
2. 메모리 내 `commits.filter(c => c.message.includes(query) || c.hash.includes(query) || c.author.includes(query))` 기반
3. 검색 결과 하이라이트

**파일**:
- 수정: `src/renderer/src/components/left/LeftPanel.tsx`
- 수정: `src/renderer/src/stores/repoStore.ts` (searchQuery 상태 추가)

---

#### Task 3.3-B: Git pickaxe 딥 검색 (백엔드)
**예상 시간**: 2시간

**작업 내용**:
1. `gitService.ts`에 `searchCommits(repoPath, query, type)` 함수 추가
   - `type: 'message' | 'content'`
   - `content` 타입: `git log -S "keyword" --oneline` 활용
2. IPC 채널 `git:searchCommits` 신설
3. `preload/index.ts`에 API 노출
4. `repoStore.ts`에 `searchCommits()` 액션 추가

**파일**:
- 수정: `src/main/services/gitService.ts`
- 수정: `src/main/ipc/registerIpc.ts`
- 수정: `src/preload/index.ts`
- 수정: `src/renderer/src/stores/repoStore.ts`
- 업데이트 필수: `docs/SOURCE_FUNCTION_MAP.md`

---

### Phase 4: AI 대화형 채팅 기능 추가 (10-14시간)

#### Task 4-A: 단순 Q&A 채팅 (4-5시간)
**예상 시간**: 5시간

**작업 내용**:
1. `AIChatbox.tsx` 컴포넌트 생성 (입력창 + 메시지 목록 UI)
2. `AIContextPanel` 내부에 분석 결과 / 채팅 탭 전환 또는 하단 분할
3. `chatStore.ts` 생성 (대화 히스토리, 로딩 상태)
4. `ClaudeProvider.ts`에 `chatWithContext()` 메서드 추가 (기존 `callClaude()` 재활용)
5. IPC 채널 `chat:send` 신설
6. `preload/index.ts`에 `window.vibelens.chat.*` API 추가

**파일**:
- 새로 생성: `src/renderer/src/components/right/AIChatbox.tsx`
- 새로 생성: `src/renderer/src/stores/chatStore.ts`
- 수정: `src/renderer/src/components/right/AIContextPanel.tsx`
- 수정: `src/main/services/llm/ClaudeProvider.ts`
- 수정: `src/main/ipc/registerIpc.ts`
- 수정: `src/preload/index.ts`

---

#### Task 4-B: 스트리밍 응답 + 고급 기능 (6-8시간)
**예상 시간**: 7시간

> ⚠️ **Phase 4-A 완료 및 유저 피드백 후 진행 여부 결정**

**작업 내용**:
1. `client.messages.stream()` 기반 실시간 응답
2. Electron IPC 스트리밍 패턴 (`webContents.send('chat:stream-chunk')` + `ipcMain.on` 패턴)
3. 토큰 윈도우 관리 (대화 길어질 때 이전 메시지 요약/삭제)
4. 취소 지원 (`AbortController` + `chat:cancel` IPC)

**파일**:
- 수정: `src/main/services/llm/ClaudeProvider.ts` (스트리밍 메서드)
- 수정: `src/main/ipc/registerIpc.ts` (스트리밍 IPC)
- 수정: `src/renderer/src/stores/chatStore.ts` (청크 수신 로직)
- 업데이트 필수: `docs/SOURCE_FUNCTION_MAP.md`

---

### Phase 5: 다중 LLM 모델 선택 인터페이스 (4-5시간)

#### Task 5.1: LLM/Model 선택 UI 추가
**예상 시간**: 1.5시간

**작업 내용**:
1. `AIContextPanel` 상단 Action Bar에 모델 선택 Dropdown 컴포넌트 추가
2. 선택 시 `settingsStore`의 `activeProvider` 및 `activeModel` 업데이트
3. 키가 없는 모델 선택 시 `EmptyState`에서 "Settings 열기" 버튼 표시되도록 수정

**파일**:
- 수정: `src/renderer/src/components/right/AIContextPanel.tsx`
- 수정: `src/renderer/src/stores/settingsStore.ts`

#### Task 5.2: LLM 상태 및 서비스 리팩토링
**예상 시간**: 3시간

**작업 내용**:
1. `Settings` 타입 구조 개선 (`claudeModel` → `activeProvider`, `model`)
2. `keychainService.ts` 지원 프로바이더 타입 확장 (`claude` | `gemini` | `openai`)
3. 프론트엔드에서 여러 키 상태(`hasKeys: { claude: boolean, gemini: boolean... }`) 관리
4. 향후 제공자(Provider) 파일 생성을 위한 LLM Factory 구조 마련

**파일**:
- 수정: `src/shared/types.ts`
- 수정: `src/main/services/keychainService.ts`
- 수정: `src/main/services/settingsService.ts`
- 수정: `src/renderer/src/components/modals/SettingsModal.tsx`

---

## 🎨 디자인 가이드

> ⚠️ **중요**: Welcome Screen을 포함한 모든 새 UI는 **기존 Catppuccin Mocha 기반 디자인 시스템**을 따릅니다.
> 별도의 Cursor 팔레트를 사용하면 화면 전환 시 시각적 불일치가 발생합니다.

### 색상 팔레트 — 기존 CSS 변수 사용 (`globals.css`)

| 용도 | Tailwind 클래스 | CSS 변수 | HEX 참고값 |
|------|----------------|----------|------------|
| 배경 (메인) | `bg-bg-primary` | `--bg-primary` | `#1E1E2E` |
| 배경 (카드) | `bg-bg-secondary` | `--bg-secondary` | `#262637` |
| 배경 (호버) | `bg-bg-elevated` | `--bg-elevated` | — |
| 텍스트 (강조) | `text-fg-primary` | `--fg-primary` | `#CDD6F4` |
| 텍스트 (보조) | `text-fg-secondary` | `--fg-secondary` | `#A6ADC8` |
| 텍스트 (약함) | `text-fg-muted` | `--fg-muted` | — |
| 액센트 | `text-accent` | `--accent` | `#89B4FA` |
| 테두리 | `border-border` | `--border` | `#45475A` |
| 성공 뱃지 | `text-state-success` | `--state-success` | `#A6E3A1` |
| 경고 뱃지 | `text-state-warning` | `--state-warning` | `#F9E2AF` |

### 타이포그래피 — 기존 `tailwind.config.ts` 폰트 사용

```css
/* 로고/제목 */
font-family: theme('fontFamily.sans');  /* -apple-system, SF Pro Display 등 */
font-size: 32px;
font-weight: 600;

/* 액션 카드 */
font-size: 14px;
font-weight: 500;

/* Recent Repos */
font-size: 13px;  /* 기존 body와 동일 */
font-weight: 400;
```

### 레이아웃 간격

- 액션 카드 간격: `gap-4` (16px)
- 섹션 간격: `space-y-12` (48px)
- 패딩: `py-8` (32px), `px-12` (48px)

### 애니메이션 — 기존 Tailwind 키프레임 활용
- 카드 등장: `animate-fadeIn` (0.2s ease-out)
- 모달 스케일: `animate-scaleIn` (0.22s ease-out)
- 패널 그림자: `shadow-panel`

---

## 🚫 구현하지 않을 기능

### 1. Connect via SSH
- **이유**: VibeLens는 로컬 Git 분석 도구, SSH는 불필요
- **대안**: 없음

### 2. Upgrade to Pro
- **이유**: 무료 오픈소스 프로젝트
- **대안**: GitHub Sponsors 링크 (선택사항)

### 3. Agents Window
- **이유**: Cursor의 AI 기능, VibeLens와 무관
- **대안**: 없음

### 4. Remote Development
- **이유**: 복잡도 대비 효용성 낮음
- **대안**: 없음

---

## 📊 우선순위 (수정된 예상 시간 포함)

### High Priority — Phase 1 (5-6시간)
1. ✅ Welcome Screen 기본 레이아웃 + API Key 상태 뱃지
2. ✅ 3가지 액션 카드 (Open/Clone/Setup)
3. ✅ Recent Repositories 목록 (간단 버전, 프론트엔드)
4. ✅ App.tsx 통합 + `closeRepo()` + 메뉴 기본 확장

### Medium Priority — Phase 2 (3-4시간)
5. ✅ RecentRepo 타입 확장 + 마이그레이션
6. ✅ Native 메뉴 Open Recent 서브메뉴 (동적 빌드)

### Search Priority — Phase 3 (3.5-4시간)
7. ✅ 3-A: 프론트엔드 커밋 필터링 (1.5시간)
8. ✅ 3-B: Git pickaxe 딥 검색 (2시간)

### AI Chat Priority — Phase 4 (10-14시간)
9. 🚀 4-A: 단순 Q&A 채팅 (5시간) — **먼저 구현**
10. 🚀 4-B: 스트리밍 + 고급 (7시간) — **유저 피드백 후 결정**

### Multi-LLM Priority — Phase 5 (4-5시간)
11. 🚀 직관적인 모델 선택 Dropdown UI 및 아키텍처 리팩토링

### Low Priority
12. 🔽 View All Repositories 모달
13. 🔽 Getting Started 팁
---

## 📁 파일 구조 (전체 Phase 반영)

```
src/renderer/src/
├── components/
│   ├── welcome/
│   │   ├── WelcomeScreen.tsx          [Phase 1 - 새로 생성]
│   │   ├── ActionCard.tsx             [Phase 1 - 새로 생성]
│   │   └── RecentReposList.tsx        [Phase 1 - 새로 생성]
│   ├── right/
│   │   ├── AIContextPanel.tsx         [Phase 4 - 수정 (채팅 탭 추가)]
│   │   └── AIChatbox.tsx              [Phase 4-A - 새로 생성]
│   ├── modals/
│   │   └── RecentReposModal.tsx       [Phase 3 - 새로 생성]
│   └── ...
├── stores/
│   ├── settingsStore.ts               [Phase 1 - 수정]
│   ├── repoStore.ts                   [Phase 1 - 수정 (closeRepo 추가)]
│   └── chatStore.ts                   [Phase 4-A - 새로 생성]
└── App.tsx                            [Phase 1 - 수정]

src/shared/
└── types.ts                           [Phase 2 - 수정 (RecentRepo 타입)]

src/main/
├── menu.ts                            [Phase 1 - 수정 (MenuActions 확장)]
├── index.ts                           [Phase 1 - 수정 (IPC 연결)]
├── ipc/registerIpc.ts                 [Phase 3-B, 4 - 수정 (새 IPC 채널)]
└── services/
    ├── settingsService.ts             [Phase 2 - 수정]
    ├── gitService.ts                  [Phase 3-B - 수정 (searchCommits)]
    └── llm/ClaudeProvider.ts          [Phase 4-A - 수정 (chatWithContext)]

src/preload/
└── index.ts                           [Phase 3-B, 4 - 수정 (새 API)]

docs/
└── SOURCE_FUNCTION_MAP.md             [모든 Phase - 업데이트 필수]
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 첫 실행
1. VibeLens 첫 실행
2. Welcome Screen 표시 확인
3. Recent Repositories 목록 비어있음
4. "Open Repository" 클릭 → 정상 동작
5. Repository 열린 후 Welcome Screen 숨겨짐

### 시나리오 2: Recent Repos 있는 경우
1. VibeLens 실행
2. Welcome Screen에 최근 레포 5개 표시
3. Recent Repo 클릭 → 해당 레포 열림
4. "View all" 클릭 → 전체 목록 모달 (Phase 3)

### 시나리오 3: Repository 닫기
1. Repository 열려있는 상태
2. File → Close Repository (메뉴 추가 필요)
3. Welcome Screen 다시 표시

---

## 🎯 성공 기준

### Phase 1 완료 조건
- [x] Welcome Screen이 Repository 없을 때 표시됨
- [x] Open/Clone/Setup 버튼이 정상 동작함
- [x] Recent Repositories 최근 5개 표시됨
- [x] Recent Repo 클릭 시 해당 레포가 열림
- [x] File 메뉴에 Clone/Close Repository 기능이 추가됨
- [x] API Key 상태 뱃지(✅ Saved / ⚠️ Required)가 Setup 카드에 표시됨

### Phase 2 완료 조건
- [x] RecentRepo에 메타 정보 포함됨 (path, name, lastOpened, branch)
- [x] 기존 `string[]` 데이터 마이그레이션 정상 동작
- [x] 최근 열은 순서대로 정렬됨
- [x] Repository 이름이 올바르게 표시됨
- [ ] Native 메뉴 Open Recent 서브메뉴 동작

### Phase 3 완료 조건
- [x] 3-A: 커밋 메시지/해시/작성자 필터가 LeftPanel에서 동작함
- [ ] 3-B: `git log -S` 기반 딥 검색이 정상 작동함
- [ ] View All 모달이 동작함
- [ ] Getting Started 팁이 표시됨

### Phase 4-A 완료 조건
- [ ] AI Analysis 패널에서 채팅 입력창이 표시됨
- [ ] 유저 질문 → 로딩 → 전체 응답 표시 플로우 정상 동작
- [ ] 기존 커밋 분석 결과가 컨텍스트로 포함됨

### Phase 4-B 완료 조건 (선택적)
- [ ] 실시간 스트리밍 응답이 타이핑 효과로 표시됨
- [ ] 긴 대화 시 토큰 윈도우 관리가 정상 동작함

### Phase 5 완료 조건
- [ ] AI Analysis 패널에 모델 선택 드롭다운이 추가됨
- [ ] 선택한 모델에 맞춰 API 요청이 처리되는 구조 완성
- [ ] SettingsModal에서 다중 API Key 관리가 가능하도록 UI 리팩토링

---

## 📚 참고 자료

### Cursor 인터페이스
- 제공된 스크린샷 참조
- 중앙 정렬 레이아웃
- 카드 기반 액션 버튼
- Recent projects 목록

### VibeLens 기존 컴포넌트
- `TitleBar.tsx` - 버튼 스타일
- `Modal.tsx` - 모달 베이스
- `Button.tsx`, `Badge.tsx` - Primitive 컴포넌트

### 디자인 시스템
- Tailwind CSS
- Lucide React Icons
- 다크 테마 기반

---

## 🔄 다음 단계

### 📌 검토 및 확정 (완료)

유저 피드백이 전면 반영되어 사양이 확정되었습니다:
1. ✅ **Welcome Screen**: 구현 방향 확정
2. ✅ **액션 버튼(Setup API Key)**: 상태 표시(Saved/Required) 반영 확정
3. ✅ **Recent Repos 메타 정보**: 기능 확장 확정 
4. ❌ **SSH 기능**: 완전히 제외됨.
5. ✅ **검색 기능 (Phase 3)**: 커밋, 변화, 기능 등을 폭넓게 커버할 수 있도록 강화
6. ✅ **[신규] Phase 4 (AI Chat)**: 추가 질의/분석을 위한 인터랙티브 챗 인터페이스 구현 계획 확정!

---

**상기 계획을 토대로 바로 구현 프로세스에 착수할 준비가 되었습니다.**

> 📋 **DEVELOPMENT_PROTOCOL 및 SOURCE_FUNCTION_MAP 관련**: 
> - 모든 Phase에서 새 IPC 채널, 함수, 컴포넌트 추가 시 `docs/SOURCE_FUNCTION_MAP.md`를 반드시 동시 업데이트합니다.
> - 특히 Phase 5 리팩토링 시, 기존 `claudeProvider` 구조 변경 등에 대해 `SOURCE_FUNCTION_MAP.md`의 통일성을 유지해야 합니다. 

**마지막 업데이트**: 2026-04-12 (다중 LLM 선택 UI 플랜 반영)
