# Tooling

The build system, static gate, code generators, and CI. Garnish runs on Bun with a TypeScript config tuned for the extension bundling path. There is no lint script; typecheck is the static gate.

## Bun toolchain

- `bun.lock` — the lockfile.
- `bunfig.toml` — sets the test root to `./tests`.
- `bun install` — install dependencies (CI uses `bun install --frozen-lockfile`).
- `bun test` — run the test suite.
- `bun src/bin.ts` — run the CLI (exposed as `bun run garnish`).

Bun is both the runtime and the package manager. It compiles TypeScript natively, so there is no separate transpile step for the library. See [dependencies](../reference/dependencies.md) for the package versions.

## TypeScript config

`tsconfig.json` targets ES2022 with ESNext modules and Bundler resolution. Key flags:

| Flag | Value | Why |
| --- | --- | --- |
| `target` | `ES2022` | Modern JS feature set. |
| `module` | `ESNext` | Native ESM. |
| `moduleResolution` | `Bundler` | Matches the Bun bundler's import resolution. |
| `moduleDetection` | `force` | Every file treated as a module. |
| `strict` | `true` | Full strict type checking. |
| `isolatedModules` | `true` | Each file transpiles independently (required by Bun and the bundler). |
| `verbatimModuleSyntax` | `true` | Enforces `import type` for type-only imports. |
| `types` | `["bun-types"]` | Bun runtime types. |
| `skipLibCheck` | `true` | Skip lib type checks for speed. |

The `include` covers `src/**/*.ts` and `tests/**/*.ts`. The static gate is `bun run typecheck` (`tsc --noEmit`). There is no lint script; typecheck plus the type-level assertions in `tests/core/checks.test.ts` are the static check surface.

## Extension bundling

The Pi extension is bundled for the certified runtime to autoload. `garnish init` calls `installExtension`, which bundles `src/extension/entry.ts` with `bun build --target node` into `$PI_CODING_AGENT_DIR/extensions/garnish/index.js`. The bundled entry reads pre-serialized JSON (`graph.json`, `quests.json`, `state.json`) with `readFileSync` at session start, because the LOO-118 spike proved that async module init loads as nothing. See [extension](../systems/extension/index.md) for the composition root.

## garnish shim generation

`garnish init` writes a `garnish` shim into the Garnish-owned `bin/` dir for in-session use. The shim lets the learner run `garnish status` and `garnish quest` from within a launched session without needing the dev install on PATH. See [configuration](../reference/configuration.md) for the storage layout.

## CI workflows

Four GitHub Actions workflows live in `.github/workflows/`:

### ci.yml

Runs on every push and pull request. One job on `ubuntu-latest`: checkout, set up Bun, `bun install --frozen-lockfile`, `bun run typecheck`, `bun test`. This is the base gate.

### qa.yml

Runs on pull requests and via `workflow_dispatch`. Concurrency group cancels in-progress runs for the same PR. The job:

1. Checks out with `fetch-depth: 0`, sets up Bun and Node 22, installs dependencies.
2. Installs `imagemagick` and `tuistory` (the TUI testing tool) for evidence capture.
3. Installs the Droid CLI and the `droid-control` plugin.
4. Runs `droid exec --auto high` with a non-interactive prompt that runs the `qa` skill, writes evidence under `qa-results/`, and writes `qa-results/report.md`.
5. Uploads `qa-results/` as an artifact (14-day retention).
6. Posts the report as a PR comment, updating the same comment (matched by the `<!-- qa-report -->` marker) on reruns.
7. Enforces that the QA step completed successfully, failing the job otherwise.

This is functional QA (driving the CLI and extension through real terminal interaction), not typecheck or unit tests. See [development workflow](development-workflow.md) for when it runs.

### droid-review.yml

Triggers on `pull_request` events of type `opened`, `ready_for_review`, and `reopened` (skips drafts). Runs `Factory-AI/droid-action@main` with `automatic_review: true`, `automatic_security_review: true`, and `review_depth: shallow`. This is the automated code review on every PR.

### droid.yml

Triggers on `@droid` mentions in issue comments, PR review comments, PR reviews, issue bodies/titles, and PR bodies/titles. Runs `Factory-AI/droid-action@main`. This is the on-demand Droid invocation from a comment.

## Factory Droid integration

The `qa.yml` and `droid-review.yml` workflows use the Factory Droid action and CLI. The Droid CLI is installed in CI via `curl -fsSL https://app.factory.ai/cli | sh`, and the `droid-control` plugin is installed from the `factory-plugins` marketplace. The `FACTORY_API_KEY` secret authenticates both.

## Factorio workflow kit

The repo runs the Factorio workflow kit. The per-repo envelope in `.agents/envelope/` holds `linear-map.md`, `domain.md`, `commands.md`, and `templates/`. Repo-specific skills and agents live in `.agents/skills/` and `.agents/agents/`. The `AGENTS.md` at the repo root is the agent strap that points to the envelope. See [development workflow](development-workflow.md) for how the kit shapes the branch-and-PR cycle.

## QA skills

The functional QA workflow runs the `qa` skill, which routes to three sub-skills in `.factory/skills/`:

- `qa-garnish-cli` — first-run setup, doctor/status/quest, unlock commands, terminal-facing progression.
- `qa-garnish-pi-extension` — HUD, slash command behavior, live unlocks, tutor framing.
- `qa-garnish-quest-engine` — quest loading, verification, progression folding, core pack behavior.

These skills drive the CLI and extension through `tuistory` and capture terminal evidence under `qa-results/`. The workflow posts the report as a PR comment.

See [development workflow](development-workflow.md) for the PR cycle and [testing](testing.md) for the unit and E2E test patterns.
