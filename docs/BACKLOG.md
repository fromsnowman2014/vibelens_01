# VibeLens Backlog — Open Follow-ups

Status: living document
Owner: TBD
Last updated: 2026-05-12

Items here are not committed work. They are deferred follow-ups from
plan documents (`LIVE_PREVIEW_COMPATIBILITY.md`, `MULTI_SERVICE_RUNNER.md`,
`ISOLATED_BUILD_STRATEGY.md`) and from session-by-session notes. Each
entry has enough context that the user can choose the next thing to
work on without re-reading every plan doc.

## How to use this file

- **Priority** column is a recommendation, not a commitment.
- Items grouped by area, not by priority — so related work stays next
  to each other in this file.
- When an item moves into active work, create a task for it and remove
  it from here (or mark as in-progress with a commit reference).

## Live Preview compatibility (`LIVE_PREVIEW_COMPATIBILITY.md`)

| # | Item | Priority | Notes |
|---|---|---|---|
| LP-1 | Replace `<webview>` with `BrowserView` or `WebContentsView` | Low | Only revisit if a real-world repo hits a `<webview>`-specific bug we can't work around. §4.7 of the plan doc kept the option visible. |
| LP-2 | Run matrix verification against more repo shapes (Vite + React, Vue, plain static-html, Next 14 + Next 16) | Medium | §5 of the plan doc. Best done when something else is broken anyway. |
| LP-3 | Decide policy for service workers under non-persistent partition | Low | §8.1 of the plan doc. PWAs re-register every run. Probably fine ("fresh tab" semantics) but unverified. |
| LP-4 | Confirm `webview.openDevTools()` vs `webview.getWebContents().openDevTools()` on current Electron | Low | §8.2 of the plan doc. F3 shipped the former; needs a manual smoke test. |
| LP-5 | Headless integration test (Playwright + Electron) for the preview surface | Medium-High | §8.3 of the plan doc. R1 made the surface testable for the first time. High value as a regression net, moderate-to-high cost to wire up. |

## Multi-service runner (`MULTI_SERVICE_RUNNER.md`)

| # | Item | Priority | Notes |
|---|---|---|---|
| MS-1 | P1: read `vibelens.config.json` and run declared services with topo ordering + port healthcheck | **High** | The unlock for Manuscript_alert and any frontend-plus-backend repo. Largest single piece of remaining product work. |
| MS-2 | P2: env-var substitution (`${PORT_x}`), HTTP/log healthchecks, log-panel filter-by-service | Medium | Polish on top of MS-1. |
| MS-3 | P3: heuristic auto-config when no `vibelens.config.json` is present (synthesize backend service from `companionBackend`) | Medium | The "it works out of the box" experience. Depends on MS-1. |
| MS-4 | P4: JSON schema + validation + editor autocomplete | Low | Quality of life. Nice once we have real `vibelens.config.json` users. |
| MS-5 | Fix process-tree cleanup (SIGTERM via `shell:true` doesn't always reach grandchildren) | Medium | Known gap even for single-service today. `tree-kill` or `detached:true` + `process.kill(-pid)`. Surfaces as orphaned dev servers after Stop. |

## Isolated build strategy (`ISOLATED_BUILD_STRATEGY.md`)

| # | Item | Priority | Notes |
|---|---|---|---|
| IB-1 | Phase 3: Python managed runtime — per-session venv at `<worktree>/.vibelens-venv`, `pip install -r requirements.txt`, behind a consent prompt | **High** | Manuscript_alert was the user-facing pain point. Combined with MS-1, vibelens can run that repo end-to-end. |
| IB-2 | Phase 2: Container mode (Docker/OrbStack) opt-in when repo ships `Dockerfile` / `devcontainer.json` and a runtime is detected on the user's machine | Low | Only revisit when "managed runtime + no system deps" hits a wall (native libs like libpq, openssl). Don't ship Docker as a dependency. |
| IB-3 | Phase 4: Generalize `ToolchainManager` and add Go, Ruby, JVM, etc. on demand | Low | Don't generalize until we have two concrete examples (Node done, Python pending). |
| IB-4 | npm → pnpm for the spawned install, with a hash-keyed `node_modules` reuse cache | Medium | Big cold-start win across commits (Manuscript_alert install was 1m+). Self-contained refactor of buildManager + a new cacheKey helper. |
| IB-5 | Semver range support (`>=18`, `^18`) in `resolveNodeVersion` | Low | Needs a real semver library. Pinned aliases (`lts/iron`, `20`) already covered. |
| IB-6 | Download progress indicator in `RuntimeConsentDialog` (% bar during the actual fetch) | Low | UX polish. Currently the dialog disappears and the user just waits. |

## Cross-cutting

| # | Item | Priority | Notes |
|---|---|---|---|
| X-1 | Surface vibelens's own `electron-store` paths in a Settings → Debug pane | Low | Useful for clearing managed Node cache, runtime consents, etc. without rm -rf. |
| X-2 | Telemetry hook for "build failed" reasons (EADDRINUSE, dep install, ready timeout, chunk-load) — local-only counter | Low | We're throwing a lot of warnings; a small local counter would tell us what's actually hurting users. |

## Item-picking guidance

If the next session is about **making Manuscript_alert actually run**:
do **MS-1** then **IB-1**, in that order. MS-1 alone makes the user able
to point vibelens at a config that names the backend; IB-1 lets vibelens
actually run it without polluting the system.

If the next session is about **making more repos render correctly in
Live Preview**: do **LP-2** (matrix test) first to find concrete bugs,
then triage. LP-1 (BrowserView migration) only after a real LP-2 finding
forces it.

If the next session is about **stopping regressions before they ship**:
do **LP-5** (Playwright + Electron integration test). High value as a
net once the new modular surface is exercised by real navigation.
