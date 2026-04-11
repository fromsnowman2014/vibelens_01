# VibeLens

> **The Reverse-Prompt Git Analyzer for Vibe Coders.**
> Analyze any git repo's commits and reverse-engineer the prompt that likely produced each change — powered by Claude.

VibeLens is a macOS desktop app that opens a git repository, shows its commit history in a three-panel layout, and uses the Anthropic Claude API to reverse-engineer what prompt/intent likely produced each commit. Analyses are cached per-repo in `.vibelens/` so subsequent opens are instant and free.

---

## Features (MVP / Phase 1)

- **Open any local git repository** with `Cmd+O`
- **Three-panel workspace**
  - **Left:** commit timeline with cache status dots (grey = not analyzed, green = cached, blue = analyzing, red = error)
  - **Center:** split-view diff with syntax highlighting (Prism) across tabs for each changed file
  - **Right:** AI analysis panel with reverse-prompted summary, what changed, why it matters, risks, and follow-ups
- **Reverse-prompt analysis** via Anthropic Claude (`claude-sonnet-4-5`)
- **Smart caching** in `.vibelens/` — each commit analyzed once per language
- **Bilingual analyses** — toggle `ko ↔ en` with `Cmd+L`, each language cached separately
- **Secure API key storage** — macOS Keychain via `keytar`, with Electron `safeStorage` fallback
- **First-run privacy consent dialog** — explicit notice about what is sent to Anthropic
- **Optional auto-add `.vibelens/` to the repo's `.gitignore`** — asked once per repo
- **Keyboard shortcuts:** `Cmd+O` open, `Cmd+,` settings, `Cmd+L` toggle language, `Cmd+R` re-analyze, `↑`/`↓` navigate commits

---

## Quick start

### Prerequisites
- macOS (tested on Apple Silicon)
- Node.js 20+ and npm
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Install and run in dev
```bash
npm install
npm run dev
```
HMR is wired up for the renderer; main/preload also auto-reload.

### Build a `.app` (unsigned, demo only)
```bash
npm run pack
open dist/mac-arm64/VibeLens.app
```
On first launch macOS Gatekeeper will warn that the app is from an unidentified developer — right-click the `.app` in Finder → **Open** once, then it's trusted for subsequent launches.

### Typecheck
```bash
npm run typecheck
```

---

## Demo walkthrough

1. Launch VibeLens. Accept the **Privacy notice** (tells you that diffs and commit metadata will be sent to Anthropic).
2. Open Settings (`Cmd+,`) → **API Keys** tab → paste your Claude key → **Save** → **Test Connection**. You should see a green "Verified" badge.
3. `Cmd+O` → select any local git repo (this repo works too).
4. The commit timeline on the left auto-loads the most recent commits. The first commit is auto-selected and its diff appears in the center.
5. Because `autoAnalyze` is on by default, VibeLens immediately asks Claude to reverse-engineer the selected commit and renders the structured analysis in the right panel. Subsequent clicks on that commit are instant from cache.
6. Press `Cmd+L` to toggle Korean ↔ English. Each language is cached independently under `.vibelens/cache/<hash>.{ko,en}.md`.
7. Press `Cmd+R` on any commit to force a fresh analysis (overwrites cache).
8. Use `↑` / `↓` to walk through the timeline.

---

## Architecture

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

### Reverse-Prompting engine

For each commit VibeLens asks Claude (with a strict JSON schema system prompt) to analyze:

```json
{
  "summary":      "1-2 sentence headline",
  "whatChanged":  ["3-6 concrete bullets"],
  "whyItMatters": "intent / user-value paragraph",
  "risks":        ["0-4 bullets"],
  "followUps":    ["0-4 bullets"]
}
```

The response is validated with `zod`. On malformed output we retry once with a "respond with JSON only" reminder, and if that still fails we render the raw response verbatim with an `unparsed` badge — so the demo never shows a blank panel.

Large diffs (>60 KB) are truncated in the middle with an explicit marker. Map-Reduce chunking for very large commits is deferred to Phase 2.

### Cache layout

Per repository, VibeLens writes:

```
<repo>/.vibelens/
├── .gitignore             # "*"  (auto-created)
└── cache/
    ├── <hash>.ko.md       # markdown rendering of the structured analysis
    ├── <hash>.en.md
    └── <hash>.meta.json   # { model, tokensIn, tokensOut, generatedAt, schemaVersion, languagesGenerated }
```

`.vibelens/` is never committed thanks to the nested `.gitignore`. VibeLens also offers (once per repo) to add `.vibelens/` to the parent repo's `.gitignore` for extra safety.

### Privacy

- **Sent to Anthropic:** commit diffs, commit metadata, file paths
- **Never sent:** files outside the diff, `.env` contents, your API key beyond the individual request
- **Stored locally:** analyses in `.vibelens/`, API key in the macOS Keychain

The first-run consent dialog restates this and must be accepted before the app is usable.

---

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron 33 + `electron-vite` + `electron-builder` |
| Frontend | React 18 + TypeScript + Tailwind (dark-only, CSS-variable palette) |
| State | Zustand |
| Diff UI | `react-diff-viewer-continued` + Prism syntax highlighting |
| Markdown | `react-markdown` + `remark-gfm` |
| Git | `simple-git` (shells out to `git`, no native compile pain) |
| LLM | `@anthropic-ai/sdk` (Claude Sonnet 4.5) |
| Keychain | `keytar` with `electron.safeStorage` fallback |
| Settings | `electron-store` |
| Schema validation | `zod` |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Cmd+O` | Open Git repository |
| `Cmd+,` | Open Settings |
| `Cmd+L` | Toggle analysis language (Ko ↔ En) |
| `Cmd+R` | Re-analyze the selected commit (bypasses cache) |
| `↑` / `↓` | Navigate commit timeline |

---

## What's NOT in the MVP (Phase 2 roadmap)

- Embedded terminal panel
- Batch / queue analysis of many commits at once
- Map-Reduce chunking for very large diffs
- OpenAI and Gemini providers (the `LLMProvider` interface is already abstracted — adding one is a single class)
- Light theme (all color tokens are CSS variables, so theme switching is one file)
- Full file explorer tree
- Code signing, notarization, auto-updater
- Windows / Linux support

---

## Project structure

```
src/
├── shared/types.ts              # Types shared by main and renderer
├── main/
│   ├── index.ts                 # Electron entry, BrowserWindow, menu
│   ├── menu.ts
│   ├── ipc/registerIpc.ts       # All ipcMain.handle registrations
│   └── services/
│       ├── gitService.ts        # simple-git wrapper (commits, diff, tree)
│       ├── cacheService.ts      # .vibelens/ I/O, atomic writes, markdown helpers
│       ├── keychainService.ts   # keytar + safeStorage fallback
│       ├── settingsService.ts   # electron-store
│       └── llm/
│           ├── LLMProvider.ts   # interface
│           ├── ClaudeProvider.ts
│           └── prompts.ts       # ko/en system prompts, diff truncation
├── preload/index.ts             # contextBridge → window.vibelens.*
└── renderer/
    ├── index.html
    └── src/
        ├── App.tsx              # assembled application
        ├── stores/              # Zustand stores
        ├── api/client.ts        # unwrap({ok, data|error})
        ├── hooks/useKeyboardShortcuts.ts
        └── components/
            ├── layout/          # TitleBar, ThreePanelLayout, StatusBar
            ├── left/            # LeftPanel, CommitTimeline, CommitRow
            ├── center/          # CenterPanel, DiffViewer
            ├── right/           # AIContextPanel
            ├── modals/          # SettingsModal, FirstRunConsentDialog, GitignoreConsentDialog
            └── primitives/      # Button, Panel, Badge, Spinner, Skeleton, EmptyState, Toast
```

---

## License

MIT
