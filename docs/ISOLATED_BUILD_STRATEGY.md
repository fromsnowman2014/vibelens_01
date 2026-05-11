# Isolated Build Strategy — Running Repos Without Polluting the User's System

Status: **proposed** (research / decision doc, no code yet)
Owner: TBD
Last updated: 2026-05-05

## The problem

Vibelens lets a user point at any repo and run a webapp from any commit. We
already isolate the **filesystem** (each session gets its own git worktree
under `tmpdir/vibelens-webapp/<uuid>`) and the **port** (per-session
allocation). What we **don't** isolate is the **toolchain**:

- `npm install` runs against the user's globally-installed Node.
- A `requirements.txt` requires Python + pip on PATH.
- `cargo run` requires the Rust toolchain.
- Each repo can demand different versions of these tools.

Concrete user pain we've already hit (Manuscript_alert, 2026-05-05):

```
$ pip install -r requirements.txt
zsh: command not found: pip

$ python server.py --dev
ModuleNotFoundError: No module named 'fastapi'
```

The user had Python (`python` worked) but not `pip`, and definitely not the
project's deps. To make the live preview work end-to-end the user had to
manually install a toolchain *they didn't have*. Doing this for every repo
is the wrong UX.

This document lays out approaches and recommends a path.

## Constraints / values

- **No silent installs into the user's home or system.** We may install into
  vibelens-managed scratch space, never into `~/.local`, `/usr/local`, etc.,
  without explicit consent.
- **Repos are untrusted code.** A repo's install scripts run *something* the
  repo author wrote. The isolation story has to bound the blast radius.
- **Cold-start time matters.** Users expect to hit Play and see a preview in
  a reasonable time. A 5-minute cold start is acceptable once per repo;
  doing that for every commit is not.
- **The user's machine is macOS-first today** but vibelens already builds
  for darwin, and Linux/Windows must remain plausible.

## Approaches considered

### A. Do nothing — require the user to bring their own toolchain

**What:** What we have today. Document the requirement; show the
companion-backend warning we just shipped.

- ✅ Zero implementation cost.
- ✅ Fastest run when the toolchain is already installed.
- ❌ Useless on a fresh machine or a casually-clicked unfamiliar repo,
  which is half of vibelens's pitch.
- ❌ The user has to learn each ecosystem (`pip`, `bundler`, `cargo`) just
  to look at a preview.

**Use as:** the *fallback* path when nothing else applies.

### B. Per-tool managed runtime (Node-only today, extended)

**What:** Vibelens itself ships or downloads pinned tool binaries into a
managed cache (`~/.vibelens/tools/<tool>/<version>/`) and prepends that to
the spawned process's `PATH`. Read the tool version from repo files
(`.nvmrc`, `.python-version`, `rust-toolchain.toml`, `.tool-versions`).

- ✅ True isolation from the user's system.
- ✅ Correct version per repo, per commit (you can preview an old commit
  that needed Python 3.9 even if the user has only 3.12).
- ✅ Reproducible — every machine running vibelens gets the same binaries.
- ❌ We become a tool-version manager (asdf-lite). Not infinite scope but
  not trivial either: download URLs, signature verification, mirror
  policy, cache eviction, Apple Silicon vs Intel, glibc on Linux, etc.
- ❌ Still doesn't sandbox what the install scripts do (they can shell out,
  open network sockets, write to `~`). Bounding-but-not-eliminating.

**Use as:** the **recommended primary path**. See *Recommendation* below for
why we still want it even with C available.

### C. Containers (Docker / Podman / OrbStack)

**What:** Each session runs the dev server inside an ephemeral container.
The repo gets mounted (or copied) into the container; the container image
provides the toolchain. We pick a base image per detected stack (`node:20`,
`python:3.12`, `rust:1.81`) or, when present, use the repo's own
`Dockerfile` / `devcontainer.json`.

- ✅ Strong isolation: filesystem, network namespace, deps.
- ✅ Cleanup is "remove container" — true zero-residue.
- ✅ Naturally cross-platform once a container runtime is present.
- ✅ Solves the "8 different language ecosystems" problem with one
  abstraction.
- ❌ Hard requirement on Docker/Podman/OrbStack on the user's machine.
  Big install, big background daemon, license questions on macOS.
- ❌ Filesystem performance on macOS volume mounts is historically bad
  (Docker Desktop). OrbStack helps. Vite/Next dev with HMR over a
  bind-mount is a known foot-gun.
- ❌ Running an Electron-managed Docker daemon for a casual user is a
  meaningful behavioral change. We must not silently install Docker.

**Use as:** an *opt-in* mode for users who already run Docker, plus
automatic activation when the repo ships a `Dockerfile` or
`devcontainer.json` and the user has a runtime.

### D. WASM / language-specific embedded runtimes

**What:** For some stacks there are embeddable runtimes:
- Python via Pyodide (WASM) — stdlib + a curated set of pure-Python deps
  works in-browser; native deps don't.
- Node via QuickJS or Node embedded — already implicit since vibelens is
  Electron.

- ✅ Zero external install; runs in our process.
- ❌ Almost nothing real-world works without C extensions. FastAPI relies on
  Pydantic v2 (Rust ext), Starlette (pure Python OK), uvicorn (C ext for
  performance, falls back). Realistic backends will not load.
- ❌ Per-language work; doesn't generalize.

**Use as:** not viable as a general strategy. Maybe relevant *much* later
for read-only "see what this script outputs" sandboxes.

### E. Lazy / on-demand toolchain prompts

**What:** When detect surfaces a stack we can't run, show a one-click
"Install <tool> for vibelens" button that triggers approach B (download to
managed cache). Don't auto-install on first run.

- ✅ Consent-based; matches the values above.
- ✅ Cold start moves from "doesn't work" to "two clicks".
- ❌ Still requires implementing B.

**Use as:** the **UX wrapper** around B and C.

## Recommendation

Implement in this order:

1. **Phase 1 — Node-only managed runtime** (extend B for Node).
   We already shell out `npm install` and `node`. Pin a Node version per
   repo by reading `.nvmrc` / `engines.node` / `volta` field; download to
   `~/.vibelens/tools/node/<version>/` if missing; prepend to spawned
   PATH. Zero new ecosystems, immediate value (a Mac without Node still
   works).
2. **Phase 2 — Container mode, opt-in.** When the repo has a `Dockerfile`
   or `devcontainer.json` *and* the user has a container runtime, offer
   "Run in container" as a session toggle. No auto-install of Docker.
3. **Phase 3 — Python managed runtime.** Same shape as Phase 1, plus
   per-session venv created inside the worktree (`<worktree>/.vibelens-venv`),
   `pip install -r requirements.txt` into it. Activates only when a
   companion-backend Python is detected and the user clicks "Install
   backend deps".
4. **Phase 4 — Generalize the manager.** Extract the Node-specific code from
   Phase 1 into a `ToolchainManager` interface; add Go, Ruby, etc. on
   demand.

We deliberately do **not** lead with containers (C) because:
- Forcing every vibelens user to install Docker is a regression in the
  zero-friction promise.
- macOS bind-mount HMR is a real dev-time foot-gun.
- The 80% case is "user has Node, sometimes Python, occasionally something
  else" — manageable without containers.

## Caching and per-commit performance

The naive read of "use a worktree per commit" implies `npm install` per
commit, which is expensive (e.g. Manuscript_alert took 1m for `npm install`).
Mitigations, in increasing complexity:

1. **Shared `node_modules` cache via npm cache** — already happens; npm
   caches the *tarballs*, not the install. Cuts download but not link
   step.
2. **Use a content-addressed package manager** (pnpm or bun). pnpm
   maintains a global store and links — same `package.json` across
   commits gets near-instant installs. Recommended.
3. **Hash-keyed `node_modules` reuse** — vibelens computes a hash of
   `package-lock.json` (or equivalent) and, if it matches a previous
   session, symlinks the existing `node_modules` into the new worktree.
   Implementable on top of either npm or pnpm.
4. **Reuse worktree per repo+lockfile-hash** — go further and reuse the
   *whole* worktree directory across sessions when the lockfile hash
   matches; only `git checkout` when files change. Higher risk
   (build artifacts can leak between sessions).

Recommended: implement (3) and use pnpm under the hood to make (2) free.

For Python: per-session venv is fine cold-start cost (~10–30s for typical
deps); cache by `requirements.txt` hash and reuse the venv across sessions
on the same repo.

## Failure modes and answers

- **"User has no Node at all."** Phase 1 covers it.
- **"Repo needs system libs (libpq, openssl-dev)."** Out of scope for the
  managed-runtime model. Container mode (Phase 2) is the answer here.
  Document the limitation.
- **"Install scripts in `package.json` do something hostile."** Same risk
  as today. Container mode (Phase 2) is the only real mitigation; managed
  runtimes don't fix this. Document.
- **"User's company forbids downloading binaries."** Provide a setting:
  managed-runtime cache path + offline mode + ability to point to a
  pre-staged binary directory.

## Decision points needed before implementing

1. Is "vibelens downloads Node binaries" acceptable to ship by default, or
   do we require an explicit user opt-in on first use?
2. Cache location: `~/.vibelens/` (XDG-ish) vs Electron's `app.getPath('userData')`?
   Recommended: `userData` so it follows app uninstall.
3. pnpm vs npm: are we OK switching the package manager we drive? (We
   never run the *user's* package manager; we drive whichever one we choose
   from inside the worktree. Switching to pnpm is internal.)
4. Container mode in P2: support Docker and Podman, or Docker only? OrbStack
   on macOS is wire-compatible with Docker, so "Docker socket" covers it.

## Why this doc exists

A user asked: "do I have to `pip install` every repo? Is there a way to do
this without polluting my system?" The honest answer is "today yes; we
plan to fix it; here's how." This doc is the plan.
