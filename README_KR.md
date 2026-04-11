# VibeLens

> **바이브 코더(Vibe Coders)를 위한 역프롬프트 깃 분석기.**
> 클로드(Claude) API를 통해 모든 깃 저장소의 커밋을 분석하고, 각 변경 사항을 만들어냈을 가능성이 가장 높은 프롬프트를 역추적합니다.

VibeLens는 macOS 데스크톱 앱으로, 깃 저장소를 열어 3패널 레이아웃으로 커밋 히스토리를 보여주고 Anthropic Claude API를 사용하여 각 커밋을 생성했을 법한 프롬프트/의도를 역분석합니다. 분석 결과는 저장소별로 `.vibelens/` 디렉토리에 캐시되므로, 이후에는 즉시 무료로 확인할 수 있습니다.

---

## 주요 기능 (MVP / 1단계)

- **로컬 깃 저장소 열기**: `Cmd+O` 단축키 지원
- **3패널 작업 환경**
  - **왼쪽:** 캐시 상태 표시 점이 포함된 커밋 타임라인 (회색 = 분석 전, 초록 = 캐시됨, 파랑 = 분석 중, 빨강 = 오류)
  - **중앙:** 변경된 파일별 탭과 구문 강조(Prism)가 포함된 분할 뷰 디프(diff)
  - **오른쪽:** 역프롬프트 요약, 변경 사항, 중요도, 위험 요소, 후속 조치를 포함한 AI 분석 패널
- **역프롬프트 분석**: Anthropic Claude (`claude-sonnet-4-5`) 기반
- **스마트 캐싱**: `.vibelens/`에 저장 — 각 커밋은 언어별로 한 번만 분석
- **이국어 분석 지원**: `Cmd+L`로 `ko ↔ en` 언어 전환 가능, 언어별로 별도 캐싱
- **보안 API 키 저장**: macOS Keychain(`keytar`) 사용 및 Electron `safeStorage` 백백 지원
- **첫 실행 개인정보 동의**: Anthropic으로 전송되는 데이터에 대한 명확한 고지
- **`.vibelens/` 자동 .gitignore 추가 옵션**: 저장소별로 최초 1회 확인
- **단축키 지원**: `Cmd+O` 열기, `Cmd+,` 설정, `Cmd+L` 언어 전환, `Cmd+R` 재분석, `↑`/`↓` 커밋 이동

---

## 빠른 시작

### 준비 사항
- macOS (Apple Silicon에서 테스트됨)
- Node.js 20 이상 및 npm
- Anthropic API 키 — [console.anthropic.com](https://console.anthropic.com/settings/keys)에서 발급 가능

### 설치 및 개발 모드 실행
```bash
npm install
npm run dev
```
렌더러 프로세스에는 HMR이 설정되어 있으며, 메인/프리로드 프로세스도 자동으로 다시 로드됩니다.

### `.app` 생성 (미서명, 데모용)
```bash
npm run pack
open dist/mac-arm64/VibeLens.app
```
최초 실행 시 macOS Gatekeeper가 확인되지 않은 개발자 앱 경고를 표시할 수 있습니다. Finder에서 `.app` 파일을 우클릭하고 **열기**를 선택하면 이후에는 정상적으로 실행됩니다.

### 타입 체크
```bash
npm run typecheck
```

---

## 데모 가이드

1. VibeLens를 실행하고 **개인정보 고지**를 수락합니다 (디프 및 커밋 메타데이터가 Anthropic으로 전송됨을 고지).
2. 설정(`Cmd+,`) → **API Keys** 탭 → Claude API 키 붙여넣기 → **Save** → **Test Connection**을 클릭합니다. 초록색 "Verified" 배지가 표시되어야 합니다.
3. `Cmd+O` → 로컬 깃 저장소를 선택합니다 (현재 저장소도 가능).
4. 왼쪽 커밋 타임라인에 최신 커밋들이 로드됩니다. 첫 번째 커밋이 자동으로 선택되고 중앙에 디프가 표시됩니다.
5. `autoAnalyze`가 기본으로 켜져 있어, VibeLens는 즉시 Claude에게 분석을 요청하고 오른쪽 패널에 구조화된 분석 결과를 렌더링합니다. 이후 같은 커밋을 클릭하면 캐시로부터 즉시 표시됩니다.
6. `Cmd+L`을 눌러 한국어 ↔ 영어로 전환해 보세요. 각 언어는 `.vibelens/cache/<hash>.<언어>.md` 파일로 독립적으로 캐싱됩니다.
7. 특정 커밋에서 `Cmd+R`을 누르면 캐시를 무시하고 새로 분석합니다.
8. `↑` / `↓` 방향키로 타임라인을 탐색합니다.

---

## 아키텍처

```
┌───────────────────── Electron Shell ────────────────────────┐
│                                                             │
│  ┌─────────────── React Renderer (Vite + HMR) ───────────┐  │
│  │  TitleBar  ·  LeftPanel  ·  CenterPanel  ·  RightPanel│  │
│  │  Zustand stores: repo / analysis / settings           │  │
│  │  window.vibelens.*  (contextBridge)                   │  │
│  └──────────┬────────────────────────────────────────────┘  │
│             │  IPC                                           │
│  ┌──────────▼──────── Main (Node) ───────────────────────┐  │
│  │  Services:                                            │  │
│  │    gitService         — simple-git                    │  │
│  │    cacheService       — .vibelens/ atomic writes      │  │
│  │    keychainService    — keytar + safeStorage fallback │  │
│  │    settingsService    — electron-store                │  │
│  │    llm/ClaudeProvider — @anthropic-ai/sdk + zod       │  │
│  │  IPC handlers: repo / git / analysis / cache /        │  │
│  │                settings / keychain                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 역프롬프트 엔진

각 커밋에 대해 VibeLens는 Claude에게 엄격한 JSON 스키마 시스템 프롬프트를 사용하여 분석을 요청합니다.

```json
{
  "summary":      "1-2개 문장 요약",
  "whatChanged":  ["3-6개의 구체적인 불렛 포인트"],
  "whyItMatters": "의도 / 사용자 가치에 대한 설명",
  "risks":        ["0-4개의 위험 요소"],
  "followUps":    ["0-4개의 후속 조치"]
}
```

응답은 `zod`로 검증됩니다. 형식이 맞지 않을 경우 "JSON으로만 응답"하라는 메시지와 함께 한 번 더 재시도하며, 그래도 실패할 경우 `unparsed` 배지와 함께 원문 응답을 렌더링하여 빈 화면이 나오지 않도록 합니다.

대형 디프(60 KB 초과)는 중간 부분을 생략하고 마커를 표시합니다. 초대형 커밋을 위한 Map-Reduce 방식의 청킹은 2단계 로드맵에 포함되어 있습니다.

### 캐시 구조

각 저장소별로 VibeLens는 다음을 생성합니다:

```
<repo>/.vibelens/
├── .gitignore             # "*" (자동 생성)
└── cache/
    ├── <hash>.ko.md       # 구조화된 분석의 마크다운 렌더링
    ├── <hash>.en.md
    └── <hash>.meta.json   # { model, tokensIn, tokensOut, generatedAt, schemaVersion, languagesGenerated }
```

`.vibelens/` 내부에 별도의 `.gitignore`가 있어 저장소에 커밋되지 않습니다. 또한 VibeLens는 더 확실한 보호를 위해 부모 저장소의 `.gitignore`에 자동 추가하는 기능도 제공합니다.

### 개인정보 보호

- **Anthropic으로 전송되는 정보:** 커밋 디프, 커밋 메타데이터, 파일 경로
- **전송되지 않는 정보:** 디프 외의 파일 내용, `.env` 내용, 요청 이외의 API 키
- **로컬 저장 정보:** `.vibelens/` 내의 분석 결과, macOS Keychain 내의 API 키

앱 사용 전 첫 실행 동의 대화상자에서 이 내용을 다시 한 번 고지합니다.

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 쉘 | Electron 33 + `electron-vite` + `electron-builder` |
| 프론트엔드 | React 18 + TypeScript + Tailwind (다크 모드 전용, CSS 변수 팔레트) |
| 상태 관리 | Zustand |
| 디프 UI | `react-diff-viewer-continued` + Prism 구문 강조 |
| 마크다운 | `react-markdown` + `remark-gfm` |
| 깃 | `simple-git` (git 명령어를 직접 호출하므로 네이티브 컴파일 이슈 없음) |
| LLM | `@anthropic-ai/sdk` (Claude Sonnet 4.5) |
| 보안 저장소 | `keytar` 및 `electron.safeStorage` 백백 |
| 설정 저장소 | `electron-store` |
| 스키마 검증 | `zod` |

---

## 단축키

| 단축키 | 동작 |
|---|---|
| `Cmd+O` | 깃 저장소 열기 |
| `Cmd+,` | 설정 열기 |
| `Cmd+L` | 분석 언어 전환 (한국어 ↔ 영어) |
| `Cmd+R` | 선택한 커밋 재분석 (캐시 무시) |
| `↑` / `↓` | 커밋 타임라인 탐색 |

---

## 로드맵 (MVP 이후 작업 예정)

- 내장 터미널 패널
- 여러 커밋 동시 분석 또는 대기열 처리
- 초대형 디프를 위한 Map-Reduce 청킹
- OpenAI 및 Gemini 연동 (`LLMProvider` 인터페이스가 추상화되어 있어 추가가 용이함)
- 라이트 모드 (모든 색상 토큰은 CSS 변수로 관리됨)
- 대용량 파일 탐색기 트리
- 코드 서명, 공증, 자동 업데이트 지원
- Windows / Linux 지원

---

## 프로젝트 구조

```
src/
├── shared/types.ts              # 메인과 렌더러 간 공유되는 타입
├── main/
│   ├── index.ts                 # Electron 진입점, BrowserWindow, 메뉴
│   ├── menu.ts
│   ├── ipc/registerIpc.ts       # 모든 ipcMain.handle 등록
│   └── services/
│       ├── gitService.ts        # simple-git 래퍼 (커밋, 디프, 트리)
│       ├── cacheService.ts      # .vibelens/ 입출력, 원자적 쓰기 도와주는 마크다운 헬퍼
│       ├── keychainService.ts   # keytar + safeStorage 래퍼
│       ├── settingsService.ts   # electron-store 래퍼
│       └── llm/
│           ├── LLMProvider.ts   # 인터페이스
│           ├── ClaudeProvider.ts
│           └── prompts.ts       # 한/영 시스템 프롬프트, 디프 절단
├── preload/index.ts             # contextBridge → window.vibelens.*
└── renderer/
    ├── index.html
    └── src/
        ├── App.tsx              # 앱 전체 조립
        ├── stores/              # Zustand 스토어
        ├── api/client.ts        # API 호출 및 오류 처리
        ├── hooks/useKeyboardShortcuts.ts
        └── components/
            ├── layout/          # TitleBar, ThreePanelLayout, StatusBar
            ├── left/            # LeftPanel, CommitTimeline, CommitRow
            ├── center/          # CenterPanel, DiffViewer
            ├── right/           # AIContextPanel
            ├── modals/          # 설정, 동의 대화상자 등
            └── primitives/      # 버튼, 패널, 배지, 스피너 등 공통 컴포넌트
```

---

## 라이선스

MIT
