# Cleanup opportunities

Actionable maintenance work, reported honestly against what actually exists in the repo. The codebase is four days old as of this snapshot, greenfield, and on its first implementation of every module, so most cleanup categories (legacy debt, accumulated cruft, stale dependencies) do not apply yet.

## Complexity hotspot: the verifier

`src/verifier/index.ts` is the largest source file at 936 lines and the main refactoring candidate. It holds several distinct responsibilities in one module:

- Check evaluation (dispatching each check type to its evaluator)
- JSONPath parsing
- String and integer predicate matching
- Event field alias resolution (mapping live Pi event fields to the shapes checks expect)
- The debounced scheduler (queueing evaluation on `turn_end` with an immediate path on `agent_end` and `tool_result`)

A split into separate modules (for example, a `predicates.ts` for the matchers, a `jsonpath.ts` for the path parser, an `aliases.ts` for event field resolution, and a `scheduler.ts` for the debounce logic) would let the evaluation dispatcher shrink and make each piece independently testable. This is the highest-value internal refactor available today. See [verification engine](systems/verifier.md).

## v1-to-v2 transition debt

The `.agents/envelope/domain.md` dead-words list marks the omp and Pi-adapter surfaces as v1-only: `omp`, `Pi adapter`, `certified runtime`, `omp extension`/`HUD`/`slash commands`, `PI_CODING_AGENT_DIR`, `version handshake`, `eject`. The v2 rewrite (Garnish Standalone) will replace the adapter (`src/adapter/`) and extension (`src/extension/`) entirely with an owned harness and TUI, so investment in those modules has a finite horizon. See [v2 direction](background/v2-direction.md).

The curriculum (`packs/`) and engine modules (`src/verifier/`, `src/progression/`, `src/loader/`, `src/core/`) survive the rewrite, so cleanup work there has lasting value. The one caveat is that check event names in packs will need reauthoring against the owned harness's events when v2 lands.

The v1 maintenance issues (LOO-148, LOO-149, LOO-150) are paused or cancelled, holding the dead-words context. There is no active v1 maintenance burden beyond keeping `bun run typecheck` and `bun test` green.

## No TODO, FIXME, or HACK comments

A search of `src/` and `tests/` for `TODO`, `FIXME`, `HACK`, and `XXX` markers returns zero matches. The repo is four days old, so this is expected. There is no accumulated comment debt to triage.

## Dependency freshness

The dependency count is minimal by design (two runtime, two dev). All are recent:

| Dependency | Version | Role |
| --- | --- | --- |
| `zod` | `^4.4.3` | Schemas and branded types |
| `yaml` | `^2.9.0` | Pack and config parsing |
| `typescript` | `^6.0.3` | Static gate (`tsc --noEmit`) |
| `@types/bun` | `^1.3.14` | Bun runtime types |

No dependency is stale or needs a refresh. See [dependencies](reference/dependencies.md).

## What does not exist yet

There are no major rewrites to report (every module is on its first implementation), no dead code to remove (the codebase is small and actively used), and no lint debt (there is no lint script; typecheck is the static gate). The cleanup surface is the verifier split and the v1-to-v2 transition planning.
