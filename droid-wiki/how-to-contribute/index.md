# How to contribute

Garnish is a solo greenfield project, four days old as of this snapshot, tracking work on Linear team Loom (`LOO`) and shipping through GitHub. This page covers how work is picked up, how pull requests move through review, and what "done" means. The branch and PR conventions live in `.agents/envelope/linear-map.md`; the build and test commands live in `.agents/envelope/commands.md`.

## Work pickup

This repo runs the Factorio workflow kit. The per-repo envelope in `.agents/envelope/` is the agent guide: it holds the Linear map, the domain glossary, the build/test commands, and the PR/issue/doc templates. Read it before planning or building.

The unit of work is one Linear issue to one branch to one PR. Issues are triaged into Loom workflow states (Triage, Backlog, Todo, In Progress, In Review, Done, Canceled) and tagged with label groups `Mode` (`AFK` for agent-first work, `HITL` for work needing a human decision, `Planning` for tracking parents), `Type` (`decision`, `design`, `implementation`, `chore`), and `Harness` (`omp`, `codex`, `claude`, `cross-harness`). For v-next Garnish work (own harness, omp dropped) do not tag new issues `omp`; that label marks paused v1 fallout only. See [v2 direction](../background/v2-direction.md) for which surfaces are v1-only.

## Branch and commit conventions

The branch shape includes the Linear issue id, e.g. `dylan/loo-123-short-slug`. Linear's suggested branch name is fine. The PR auto-links the issue via the branch id, and merging the PR auto-closes the issue through the Linear/GitHub bridge configured on LOO-117.

Commit messages use bracketed prefixes and reference the issue id when one exists:

- `[feat]:` new features
- `[fix]:` bug fixes
- `[docs]:` documentation and tracker updates
- `[chore]:` tooling, CI, envelope maintenance

Example: `[feat]: LOO-123 add yaml_path check type`. Keep commits small and focused; one logical change per commit.

## Pull request process

The PR template at `.github/pull_request_template.md` asks for a summary, a changes list, acceptance criteria, proof, and review notes. The proof section expects `bun run typecheck`, `bun test`, and `bun run test:e2e` when the harness or CLI surface changed, plus any live evidence captured.

Four GitHub Actions workflows run against pull requests:

- `ci.yml` runs typecheck and the full test suite on every push and PR.
- `droid-review.yml` triggers an automatic Factory Droid review (shallow depth, with security review) when a PR opens, leaves ready-for-review, or is reopened.
- `qa.yml` runs functional QA through `droid exec` plus `tuistory`, writes evidence under `qa-results/`, and posts the report as a PR comment (updating the same comment on reruns).
- `droid.yml` triggers on `@droid` mentions in issue comments, PR review comments, and PR bodies.

See [tooling](tooling.md) for the full CI and Droid integration details.

## Definition of done

A change is done when:

1. `bun run typecheck` passes (this is the static gate; there is no lint script).
2. `bun test` passes (the unit suite).
3. `bun run test:e2e` passes when the harness, CLI, or extension surface changed.
4. The PR template is filled out with summary, changes, acceptance criteria, and proof.
5. The commit messages follow the prefix convention and reference the Linear issue id.

Both `AGENTS.md` and `.agents/envelope/commands.md` state the same gate: run typecheck and `bun test` before declaring any change done.

## Sub-pages

- [Development workflow](development-workflow.md) — the branch, code, test, PR, merge cycle.
- [Testing](testing.md) — frameworks, patterns, how to run, mock, and cover.
- [Debugging](debugging.md) — logs, common errors, troubleshooting runbook.
- [Patterns and conventions](patterns-and-conventions.md) — code structure, DI, Zod schemas, event log, generated config.
- [Tooling](tooling.md) — build system, linters, code generators, CI.

For the project-wide conventions that cut across contribution (dependency injection, Zod schemas, the append-only event log, monotonic unlocks), see [patterns and conventions](patterns-and-conventions.md). That page already exists and documents the cross-cutting patterns.
