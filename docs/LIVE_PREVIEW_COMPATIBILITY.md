# Live Preview Compatibility & Refactor Plan

Status: **proposed** (planning doc, no code yet)
Owner: TBD
Last updated: 2026-05-11

## 0. The user-visible problem

When VibeLens runs a webapp from a commit (currently using an Electron
`<webview>` tag inside the Live Preview panel), some real-world apps load
the first page but then break on subsequent navigation/interaction:

| Repo | First render | Click button / dynamic import |
|---|---|---|
| Manuscript_alert (Next 16) | OK (404 from missing backend, expected) | n/a — gated on backend |
| AI_pixel_art_editor (Next 14) | OK (page renders) | **ChunkLoadError** on `/_next/static/chunks/app/layout.js`, plus a leading `Uncaught SyntaxError: Invalid or unexpected token`. After ~60s the user sees Next's red Unhandled Runtime Error overlay. |

The same Next 14 app opened in Chrome at `http://localhost:3000` works
correctly: every chunk fetch returns 200, navigation works, buttons work.

So the problem is **not** the dev server, not the repo, not the toolchain,
and not the install. It is a **gap in compatibility between the Electron
`<webview>` environment we host and a normal browser tab**.

## 1. The decisive clue

The stack trace of the runtime error pointed at:

```
file:///private/var/folders/bh/zqqdz8h52mz2j9n16nh50fx80000gn/T/vibelens-webapp/
  <session-uuid>/.next/static/chunks/webpack.js:155:40
```

This URL is wrong in a way that explains everything else. Inside a normal
Next.js dev session, webpack.js is served as
`http://127.0.0.1:3000/_next/static/chunks/webpack.js`, not from a `file://`
URL pointing at the on-disk worktree. That means the webview, at some point,
resolved a chunk to a *local file path* rather than to the dev server's
HTTP origin.

Once webpack runs from a `file://` origin, its `__webpack_public_path__` is
either undefined or `/`, so it tries to fetch follow-on chunks via:

```
fetch(`${publicPath}_next/static/chunks/app/layout.js`)
```

…which resolves against the document's origin. The document's origin is
`http://127.0.0.1:3000` (from our `<webview src>`), but the **inner module
that loaded `webpack.js` from disk** then issued requests in a context that
no longer matches Next's expected origin. The result is requests that hang
until they hit Next's built-in 60s chunk-load timeout — exactly what the
user saw.

The leading `Uncaught SyntaxError: Invalid or unexpected token` is the same
disease: at least one chunk response came back as HTML (Next's dev error
overlay) instead of JS, because the request URL was wrong; the browser tried
to evaluate it as a script and choked on the leading `<`.

### Why this happens in vibelens specifically

Three settings in `src/main/index.ts` make our webview an unusual host:

```ts
webPreferences: {
  webSecurity: false,                  // line 27
  webviewTag: true,                    // line 28
  ...
}
// + in app.whenReady():
session.fromPartition('persist:webapp')
  .webRequest.onHeadersReceived(...)   // rewrites CORS headers globally
```

And in `LivePreview.tsx`:

```tsx
<webview
  src={webviewUrl}                     // http://127.0.0.1:<port>
  partition="persist:webapp"
  webpreferences="allowRunningInsecureContent"
/>
```

These individually look fine, but together they:

1. **Disable web security** at the parent BrowserWindow level — this is a
   blanket flag that affects how the webview behaves even though the
   webview has its own contents. Mixed-content and same-origin rules get
   relaxed in ways Chrome never does.
2. **Use a persistent partition** (`persist:webapp`) that survives across
   sessions. Old service-worker registrations, HTTP caches, and cookies
   from previous repos pollute the next repo. (This is one of the more
   subtle compatibility breakers — a service worker from a previous repo
   can intercept chunk requests for a totally different repo.)
3. **Strip and rewrite CORS headers on every response globally**, including
   responses from the dev server we own. Next.js doesn't expect this, and
   the rewritten headers can confuse it (especially around `Access-Control-
   Allow-Origin: *` colliding with credentialed requests, and around our
   global rewrite breaking dev tooling that *needs* a missing CORS header
   to fall through to its own logic).
4. **Use `allowRunningInsecureContent`** — necessary today only because
   `webSecurity: false` is on. If we fixed that, we wouldn't need this.

In Chrome, the page runs in a vanilla, secure, isolated tab with normal
origin rules and no global CORS rewriting. That's why it works.

## 2. The compatibility goal

We want Live Preview to behave **as much like a vanilla Chromium tab as
possible** for whatever URL we point it at:

- Same-origin rules: stock. We do not relax them.
- HTTPS / HTTP rules: stock. We do not blanket-enable insecure content.
- Cache and storage: **per-session**, not persistent across repos/commits.
- Headers in flight: untouched by us. The dev server's responses go through
  unmodified.
- DevTools (for the webview's contents) easily accessible to the user,
  with a familiar Network/Console experience.
- Stop / restart / navigate are predictable and don't leave file://
  chunks hanging around.

The user's mental model should be: "Live Preview = a Chrome tab embedded
in vibelens, scoped to this one commit's dev server."

## 3. Refactor first, fix second

The current implementation works for the easy cases (Manuscript_alert
frontend, simple Vite apps) but is one config flip away from breaking
again, and the seams aren't clean. Before changing behavior, we
**refactor** so the new behavior has a place to live.

### 3.1 Current shape

```
src/main/index.ts
  - createWindow()        : sets webPreferences for the *main* window
  - app.whenReady()       : configures persist:webapp session globally
                            (CORS rewrites, header handling)

src/main/services/webapp/
  buildManager.ts         : starts/stops dev server processes
  webappService.ts        : detect + start + stop facade
  projectDetector.ts      : detect project shape
  nodeRuntime.ts          : managed Node binaries
  portAllocator.ts        : find a free port
  runtimeConsent.ts       : prompt for download consent
  (no module owns "the webview's session policy")

src/renderer/src/components/center/
  LivePreview.tsx         : a 200-line file that does
                              - reads webapp store
                              - computes URL
                              - manages zoom
                              - wires webview events
                              - renders 4 different states
                              - inlines toolbar UI
```

Problems:

- **The webview's runtime policy is set in two places**: `main/index.ts`
  (session.fromPartition rewrites) and `LivePreview.tsx` (webview tag
  attributes). Neither file is named for that responsibility, so future
  edits get scattered.
- **No abstraction over "the embedded browser surface."** If we later want
  to swap `<webview>` for `<iframe>` or a `BrowserView`, we'd touch
  LivePreview directly.
- **LivePreview does five things.** Toolbar, zoom, lifecycle, event
  forwarding, state-machine rendering. Easy to break one when changing
  another.
- **No "session cleanup" hook on the partition** — stale service workers
  and caches leak across commits.

### 3.2 Target shape

Add a single owner for the embedded preview surface and split LivePreview
into small components.

```
src/main/services/webapp/
  previewSession.ts       (new)
    - getWebappSession(): Session            (resolves the Electron Session)
    - configureWebappSession(): void         (sets request/header policy once)
    - clearWebappSession(): Promise<void>    (clearStorageData, clearCache,
                                              unregister service workers)
  (existing files unchanged in scope but stop owning session policy)

src/renderer/src/components/center/preview/
  LivePreview.tsx          (orchestrator, ~60 lines)
    - reads session state, decides which sub-component to render
  PreviewFrame.tsx         (the embedded browser surface)
    - props: { url, zoom, onConsoleMessage, onFailLoad, onDomReady }
    - hides the choice between <webview> / <iframe> / BrowserView
  PreviewToolbar.tsx       (URL bar, zoom controls, open-in-browser, stop)
  PreviewStates.tsx        (empty / building / error empty-states)
  useWebviewEvents.ts      (custom hook wrapping addEventListener boilerplate)
  useWebviewZoom.ts        (zoom state + setZoomFactor side effect)

src/main/index.ts
  - createWindow() unchanged in shape, but webSecurity is no longer false.
  - app.whenReady() calls previewSession.configureWebappSession() instead
    of setting headers inline.
```

Notes:

- `PreviewFrame` is the only file allowed to import `<webview>` /
  `webPreferences` / `partition` attributes. If we later add a fallback
  for repos that need `BrowserView` (e.g. for service-worker support),
  the change is local to this file.
- `previewSession` is the only file allowed to call `session.fromPartition`
  for the preview partition. Tests can stub it.
- `LivePreview.tsx` becomes a small switch on `session.status`. No
  side effects, no event wiring, no inline UI.

### 3.3 Refactor scope (no behavior change yet)

1. Create `previewSession.ts` and move the session/header logic out of
   `main/index.ts`. **Behavior identical** at this point.
2. Create `PreviewFrame.tsx` wrapping the existing `<webview>` element
   with the same attributes; LivePreview renders `<PreviewFrame>`.
3. Extract `PreviewToolbar.tsx`, `PreviewStates.tsx`,
   `useWebviewEvents.ts`, `useWebviewZoom.ts`.
4. Add a test (smoke) that opens a sample repo, plays a commit, and
   asserts the toolbar URL field shows `http://127.0.0.1:<port>`.
   Mechanical, but pins the shape.

Commit this as one or two PRs before any behavior change.

## 4. Compatibility fixes (after refactor)

Each item is small in isolation. The point of the refactor is that
each item now has exactly one place to live.

### 4.1 Stop running with `webSecurity: false` on the main window

Move from a blanket disable to a webview-scoped policy. Inside the
webview, `webSecurity` is on by default; we don't need to disable it.
The main window has no reason to load mixed content.

**Where:** `src/main/index.ts` `createWindow.webPreferences`. Drop the
`webSecurity: false` and `allowRunningInsecureContent` attributes
(the latter is on the webview tag in LivePreview, also remove).

**Why this matters:** With webSecurity off, the webview's compatibility
profile diverges from Chromium's. Bringing it back gives us the same
JS-execution rules Chrome uses.

### 4.2 Use a non-persistent (or per-session) partition

Persistent `persist:webapp` means service workers from repo A still run
when we open repo B; cached chunks from commit 1 are served to commit 2;
cookies survive across runs. None of this is what a developer wants when
"running this commit from scratch" is the entire pitch.

Two options:

- **(a) Plain `webapp` partition** (non-persistent). All storage dies
  when the partition is unloaded. Simplest correct behavior.
- **(b) Per-session partition** keyed by sessionId. Survives reload-within-
  a-session, but a new commit gets a fresh partition.

Recommend (a) for v1, (b) if we later need to preserve user state across
reloads within one commit.

**Where:** `previewSession.getWebappSession()` and the `partition` attribute
in `PreviewFrame`.

### 4.3 Stop globally rewriting CORS headers

Remove the `onHeadersReceived` override that wildcard-injects
`Access-Control-Allow-Origin: *`. Dev servers handle their own CORS
correctly for `localhost`; the wildcard injection is the kind of fix
that papers over the symptom of #4.1 and adds new surprises (e.g.
breaks any code that depends on a *missing* header).

Keep `onBeforeSendHeaders` as a no-op or remove it entirely.

**Where:** `previewSession.configureWebappSession()`.

### 4.4 Clear storage when starting a new session

Before pointing the webview at a new dev server URL, call:

```ts
await session.clearStorageData({ storages: [
  'serviceworkers', 'cachestorage', 'cookies', 'localstorage',
  'indexdb', 'shadercache'
]})
await session.clearCache()
```

This is the single biggest fix for "weird behavior on the 2nd run" that
isn't bug-shaped but is foot-gun-shaped.

**Where:** `previewSession.clearWebappSession()`, invoked from
`webappService.startWebApp` *before* spawning the dev server (or before
the webview navigates — whichever produces the cleanest test).

### 4.5 Make webview DevTools first-class

A user trying to debug their app should be able to open Chromium DevTools
*for the webview's contents*, not just for the parent renderer. Add a
button in `PreviewToolbar` that calls `webview.openDevTools()`.

**Where:** `PreviewToolbar.tsx`.

### 4.6 Forward `did-fail-load` and `console-message` to vibelens UI

Right now we `console.log` them. We should surface them in the existing
log panel with a `preview` source so they sit next to build logs.

**Where:** `useWebviewEvents.ts` emits to `webappStore`; webappStore
gains a `consoleLogs`/`previewLogs` channel if not already wired.

### 4.7 Decide: keep `<webview>`, or move to `BrowserView`?

`<webview>` is a deprecated-but-supported Electron feature. It has known
edge cases around hot-reload, devtools, and service workers. `BrowserView`
is more powerful but harder to position alongside React UI. `WebContentsView`
is the modern replacement (Electron 30+) but requires careful integration.

For now: **keep `<webview>`** to constrain the blast radius of this
refactor. Capture the decision in this doc so the option is visible if
we later hit a problem `<webview>` can't solve.

## 5. Verification plan

After 3.x refactor + 4.1–4.4 fixes, validate against these repos:

| Repo | Expected |
|---|---|
| AI_pixel_art_editor (Next 14) | No ChunkLoadError on navigation. Click button → goes to editor screen. |
| Manuscript_alert frontend (Next 16) | Same as today: page renders, 404s on backend calls (expected). No new errors. |
| A Vite + React sample | Page renders, HMR triggers a clean reload, no chunk errors. |
| A static-html repo | Renders. |

Add a manual checklist to `DEVELOPMENT_PROTOCOL.md` (see §6) covering
these four shapes.

## 6. Update the developer-protocol docs

The refactor introduces new modules and conventions. We update two
existing docs:

### 6.1 `docs/SOURCE_FUNCTION_MAP.md`

Add a new section under "Main Process" for `previewSession.ts` and under
"Renderer" for the split `preview/` directory. Specifically:

- New entry: `src/main/services/webapp/previewSession.ts` —
  `getWebappSession()`, `configureWebappSession()`, `clearWebappSession()`.
- Replace the one-line `LivePreview.tsx` entry with the new file tree
  (`preview/LivePreview.tsx`, `PreviewFrame.tsx`, `PreviewToolbar.tsx`,
  `PreviewStates.tsx`, hooks).
- Add a new "WebApp Live Preview Flow" entry under "주요 플로우" showing
  the end-to-end path: detect → port → spawn dev server → clear session
  → webview src=URL → preview events → log panel.
- Update the "Last Updated" line.

### 6.2 `docs/DEVELOPMENT_PROTOCOL.md`

- Add a **"Live Preview troubleshooting"** subsection under "버그 수정"
  with the canonical checklist: (1) does Chrome at the same URL work?
  (2) check `webPreferences` on main window — webSecurity must be on,
  (3) check the partition — non-persistent for fresh state, (4) clear
  storage if behavior is sticky across commits.
- Add a **"Adding a new webview event/policy"** subsection under "기능
  추가" naming `previewSession.ts` as the single file to touch. This
  prevents the future regression where someone adds a header rewrite
  in `main/index.ts` again.
- Add a one-line rule: "Never set `webSecurity: false` on the main
  window. The webview gets its compatibility from being a webview, not
  from the parent's security flags."
- Update the "필수 문서" list to include
  `docs/LIVE_PREVIEW_COMPATIBILITY.md` (this file).

## 7. Phasing

| Phase | What | Risk |
|---|---|---|
| R1 (refactor) | §3.3 — extract previewSession + split LivePreview | Low. No behavior change. |
| F1 | §4.1 + §4.2 — drop webSecurity:false, switch to non-persistent partition | Medium. May surface previously-masked CSP issues; mitigated by §4.4 cleanup and existing webview defaults. |
| F2 | §4.3 + §4.4 — stop CORS rewrite, clear storage on session start | Low. |
| F3 | §4.5 + §4.6 — DevTools button + preview log forwarding | Low. UI-only. |
| D1 (docs) | §6 — SOURCE_FUNCTION_MAP and DEVELOPMENT_PROTOCOL updates | Trivial. |

R1 + F1 are the unlock; F2/F3 are polish. D1 happens at the end of R1
and is revisited after F1 if the public surface changes.

## 8. Open questions

1. **Service workers.** Some dev setups (Vite with PWA plugins, Next with
   custom SW) register a service worker. If we move to a non-persistent
   partition, SWs get re-registered every run. Is that acceptable? (We
   think yes — matches "fresh tab" semantics.)
2. **DevTools accessibility today.** The parent renderer opens DevTools
   automatically in dev (`main/index.ts:48`). Confirm that
   `webview.openDevTools()` is the right call for the embedded contents,
   not `webview.getWebContents().openDevTools()`.
3. **Headless tests.** Worth wiring a Playwright/Electron-test that
   actually loads a sample app and clicks something. R1 should make this
   tractable since the surface is finally testable.

## 9. What this doc is not

- Not a plan to support arbitrary URLs (we still only point at our
  spawned dev server).
- Not a plan to add a full address bar (`PreviewToolbar` keeps a
  read-only URL display).
- Not a plan to ship our own browser engine. We rely on Electron's
  Chromium; this work is about *not getting in its way*.
