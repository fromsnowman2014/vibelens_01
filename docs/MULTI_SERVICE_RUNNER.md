# Multi-Service Runner — Design Plan

Status: **proposed** (not yet implemented)
Owner: TBD
Last updated: 2026-05-05

## Background

The current WebApp Emulator (Phase 5) runs a single Node-based dev server per
commit. Today the detector locates a `package.json` (root or one of a small
list of subdirs) and `buildManager` runs `npm install` + the framework's dev
command in that working directory.

This breaks for repositories that need **multiple processes** to be useful in
the live preview — most commonly a frontend + a backend in another language:

| Repo | Frontend | Backend | Notes |
|---|---|---|---|
| Manuscript_alert | `frontend/` Next.js | `backend/` Python (FastAPI) via `server.py --dev` on port 8000 | README says to run them side-by-side. |
| (typical) | `apps/web` Next.js | `apps/api` Go service | Sibling Node service. |
| (typical) | `web/` Vite | `server/` Rails | Cross-language stack. |

We already ship a friendly *warning* when a sibling backend is detected
(see `companionBackend` in `ProjectConfig`). The warning is informational —
the user still has to start the backend themselves. This document plans the
follow-up where vibelens runs multiple services itself.

## Goals

- Run a **set of services** declared by a repo (or by a heuristic), not just one.
- Show the user a single live-preview URL (the "primary" service) while
  routing logs from every service into the existing log panel, attributed.
- Lifecycle: starting any service is gated by its dependencies being healthy;
  stopping a session kills every spawned process and cleans up.
- Stay **inside the worktree-per-commit isolation model** that already exists.
  We do not want a multi-service feature to leak state across commits.

## Non-goals

- Auto-installing system-level toolchains (Python, Go, Java). That is the
  scope of `ISOLATED_BUILD_STRATEGY.md`.
- Orchestrating production-shape stacks (Docker Compose feature parity,
  service meshes, etc.). vibelens is a developer-time tool.
- Cross-machine or cloud-hosted service runs.

## Approach: explicit `vibelens.config.json`, with sane fallbacks

Three layers, in priority order:

1. **`vibelens.config.json`** committed at repo root — authoritative if present.
2. **Heuristic auto-config** for well-known shapes (frontend + Python `server.py`,
   monorepo with `apps/web` + `apps/api`, etc.) — best-effort, behind a banner
   that says "auto-detected, click to confirm or edit".
3. **Single-service fallback** — current behavior, unchanged.

Heuristic auto-config exists so common cases work out of the box, but anything
the user wants to be deterministic should be promoted to a checked-in
`vibelens.config.json`.

### Schema sketch

```jsonc
{
  "$schema": "https://vibelens.dev/schema/v1.json",
  "services": [
    {
      "name": "backend",
      "cwd": ".",
      "command": "python server.py --dev",
      "port": 8000,
      "env": {
        "PORT": "8000"
      },
      "healthcheck": {
        "type": "http",
        "url": "http://127.0.0.1:8000/healthz",
        "timeoutMs": 30000
      }
    },
    {
      "name": "frontend",
      "cwd": "frontend",
      "command": "npm run dev",
      "port": 3000,
      "primary": true,
      "dependsOn": ["backend"]
    }
  ]
}
```

Notes:

- `primary: true` marks the service whose port is shown in the live preview.
  Exactly one is required.
- `dependsOn` is a topological-order constraint enforced at startup.
- `healthcheck` can be `http` (probe URL), `port` (TCP open), or `log`
  (regex against stdout/stderr — same mechanism we already use to detect
  "ready" patterns). Default is `port` on the declared `port`.
- `env` is layered on top of `process.env`; `${VAR}` substitution allows the
  config to reference env vars without committing secrets.
- `cwd` is relative to the worktree root (not absolute). Validation must
  reject `..` and absolute paths.

### Lifecycle

```
detect → validate config → topo-sort by dependsOn
       → for each tier, start in parallel and wait for healthcheck
       → when primary is healthy, mark session 'running' and load preview
       → on stop: SIGTERM all in reverse-topo order, then SIGKILL after grace
```

Key behaviors:

- **Port allocation**: each service's declared port is the *preferred* port
  passed to `findFreePort`. We rewrite the per-service `env` (and any
  framework-specific flag like `next dev -p`) to the actual allocated port.
  Inter-service references (e.g. frontend's `NEXT_PUBLIC_API_URL`) should
  use `${PORT_<service-name>}` placeholders that the runner expands.
- **Log multiplexing**: every service gets a colored prefix in the log panel
  (`[backend]`, `[frontend]`). The existing `BuildLog` schema needs a
  `serviceName?: string` field; the panel UI groups/filters by it.
- **Failure handling**: if any service exits non-zero before `running`, the
  whole session goes to `error` and we kill the rest. After `running`, a
  service exit emits a warning but doesn't tear down the others (matches
  user expectation: a backend crash shouldn't kill the frontend preview).

### Heuristic auto-config v1

When no `vibelens.config.json` exists and we currently detect a single
frontend with a companion backend, the runner can synthesize a config:

- Frontend is what the existing detector found.
- Backend is a single service with:
  - `cwd: '.'`
  - `command: <kind-specific default>` — e.g. `python server.py --dev` if
    `server.py` exists, otherwise `python -m <module>` if `pyproject.toml`
    has a script entry, otherwise no command (warn instead of run).
  - `port: <kind-specific default>` — 8000 for Python, 8080 for Java, 3001
    for Node, etc.
  - `healthcheck: { type: 'port' }`

If the synthesized config can't determine a command, the runner downgrades
to today's frontend-only behavior + companion-backend warning.

### Open questions

1. **Working tree for backend processes** — currently the worktree exists for
   the *frontend's* `cwd`. With multi-service, the worktree is the whole repo
   anyway (we already do `worktree add <tempDir> <hash>`). So this is fine.
   Confirm in implementation.
2. **Process tree cleanup** — `proc.kill('SIGTERM')` on a `shell: true` spawn
   doesn't always reach the grandchild. We may need `tree-kill` or
   `detached: true` + `process.kill(-pid, ...)`. Currently a known gap even
   for single-service.
3. **Secrets in config** — `vibelens.config.json` is committed, so it must
   not contain secrets. Document that secrets go in `.env.local` (already
   ignored by git) and are loaded via `${VAR}`.
4. **Schema migration** — version the schema (`"$schema"` URL with v1, v2)
   and reject unknown fields with a friendly error.

## Phasing

- **P0 (this doc):** companion-backend *warning* (already shipped — see
  `projectDetector.detectCompanionBackend`).
- **P1:** read `vibelens.config.json`, run the listed services with topo
  ordering and `port` healthchecks. No env substitution yet, no log prefixing
  in UI (just `[name]` prepended to message strings).
- **P2:** env-var substitution (`${PORT_x}`), HTTP/log healthchecks, log-panel
  filter-by-service.
- **P3:** heuristic auto-config v1 (synthesize backend service from
  `companionBackend`).
- **P4:** schema validation + good error messages, JSON schema published for
  editor autocomplete.

## What doesn't change

- Single-service repos behave exactly as today; the new code path is opt-in
  by the presence of `vibelens.config.json` (and later, by heuristic).
- `projectConfigByHash` cache and the per-commit detect flow stay the same;
  the multi-service config is just an alternative to `ProjectConfig` for
  build/run, not for detect.
- Worktree-per-session isolation stays.
