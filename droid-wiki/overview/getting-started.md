# Getting started

## Prerequisites

- **Bun** (the runtime and package manager). Install from <https://bun.sh>.
- **Pi (omp) v16.2.13** on PATH, or set `GARNISH_OMP_SOURCE` to a binary path reporting that version. `garnish init` copies this binary into Garnish-owned storage and verifies it with a version handshake. The learner's global `omp` is ignored at runtime.
- **A provider API key** referenced by environment variable (e.g. `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`). Garnish stores env-var references, never raw keys.

## Install

```bash
git clone https://github.com/DylanMcCavitt/garnish.git
cd garnish
bun install
```

## Build and verify

There is no separate build step for the library. Typecheck is the static gate:

```bash
bun run typecheck
```

Run the full test suite:

```bash
bun test
```

Run only the scripted E2E happy path (init through L0 completion to unlock):

```bash
bun run test:e2e
```

## Run the CLI

```bash
bun run garnish --help
```

Available commands:

| Command | Purpose |
| --- | --- |
| `garnish init` | Onboarding wizard: install certified runtime, configure provider, scaffold sandbox, launch |
| `garnish status` | Show level, XP, badges, and per-quest progress |
| `garnish quest` | Show the active quest's full text and checks |
| `garnish unlock --all` | Unlock everything (escape hatch; no XP awarded) |
| `garnish unlock --level N` | Unlock one level by id or order |
| `garnish cheat` | Alias for `unlock` |
| `garnish doctor` | Diagnose runtime, version handshake, and gated config |

## First-run onboarding

```bash
bun run garnish init
```

The wizard asks at most five prompts:

1. **Provider** (anthropic / openai / other:ENV_VAR)
2. **Speedrun mode** (n / all / a level order to skip ahead)
3. **Sandbox directory** (default: the Garnish root under `sandbox/`)

After init, the certified Pi binary launches in an isolated sandbox with the Garnish extension autoloaded. The HUD shows "Tutorial Island, Level 0" and the first quest.

## Hermetic testing

The E2E test in `tests/e2e/happy-path.test.ts` runs the full flow without a real `omp` on PATH. It writes a stub shell script that reports `omp/16.2.13`, sets `GARNISH_OMP_SOURCE` to it, and drives the bundled extension with recorded event fixtures from `tests/e2e/fixtures/l0-session.jsonl`. This keeps CI hermetic: no host-global omp dependency, no network, no real model calls.

## Project layout conventions

- Source lives in `src/`, tests mirror the structure in `tests/`.
- Quest packs live in `packs/core/`, one directory per level (`l0-tutorial-island/`, `l1-first-quest/`, `l2-lore/`).
- The test root is `tests/` (configured in `bunfig.toml`).
- No lint script exists; `bun run typecheck` is the static gate. Run typecheck and `bun test` before declaring any change done.

See [development workflow](../how-to-contribute/development-workflow.md) for the branch-and-PR cycle and [testing](../how-to-contribute/testing.md) for test patterns.
