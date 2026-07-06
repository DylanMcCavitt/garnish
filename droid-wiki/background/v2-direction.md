# v2 direction

On Jul 2, 2026, the project direction shifted from wrapping Pi (omp) to building Garnish's own purpose-built harness and TUI. This is the Garnish Standalone decision. It is captured in `.agents/envelope/domain.md`, the Garnish Standalone project brief in Linear (project id `5da7cbc1-889f-453a-a9b1-0fde5da4bf85`), and the accepted v2 PRD and ARD stamped in the tracker (LOO-155 through LOO-179). It is not yet in the code: the v1 implementation targets Pi and is at M2.

## The decision

Garnish will own its agent runtime (agent loop, provider integration, tool execution, approvals, session persistence, sandbox safety, and the game loop) and its game-first TUI, instead of wrapping a third-party harness. The thesis "real, not simulated" still holds: the learner drives an actual agent. What changed is that the agent is Garnish's own, not Pi underneath. omp is dropped.

This supersedes for v-next:

- **ARD section 1** (the Pi-only context and constraints).
- **ADR-8** (the single-package-three-entry-points shape; Bun and TypeScript remain, but the CLI/extension/core split changes).
- **ADR-9** (the certified Pi runtime; the owned harness replaces it).

See [design decisions](design-decisions.md) for the ADRs and which survive.

## v1 dead words

The domain glossary at `.agents/envelope/domain.md` marks these as v1-only, not to be used in v-next artifacts:

- `omp`
- `Pi adapter`
- `certified runtime`
- `omp extension` / `HUD` / `slash commands` (as omp surfaces)
- `PI_CODING_AGENT_DIR`
- `version handshake`
- `eject`

These survive only in frozen v1 maintenance context. The successor mechanic to `garnish eject` is "graduation / portable-loadout export"; the exact shape is a blueprint decision, and "eject" should not be used in new artifacts.

## Bounded contexts: what survives

Two bounded contexts are portable across the harness rewrite:

- **Curriculum/content**: packs, quests, checks, levels. The quest and pack file formats, the check DSL, and the level arc carry over. Event names in checks need reauthoring against Garnish's own harness events, but the structure and the closed check set stay.
- **Engine**: verifier, progression, gates, tutor context. This is the surviving main bus. `foldEvents`, `deriveUnlocks`, the check evaluators, the gate catalog concept, and the tutor bridge all continue.

## Bounded contexts: what is replaced

- **Harness/TUI**: v-next builds Garnish's own agent loop and terminal interface. This supersedes the Pi adapter (`src/adapter/`), the Pi extension (`src/extension/`), the certified runtime install and version handshake, and the `PI_CODING_AGENT_DIR` isolation mechanism. Investment in those modules has a finite horizon.

## v1 maintenance issues

Three v1 issues are paused or cancelled, holding the dead-words context:

- **LOO-148** — paused/cancelled v1 fallout.
- **LOO-149** — paused/cancelled v1 fallout.
- **LOO-150** — paused/cancelled v1 fallout.

These are tagged with the `omp` label, which marks paused v1 fallout only. Do not tag new v-next issues `omp`.

## New Game+ Hard Mode curriculum

The v2 expansion is the Hard Mode curriculum, captured in `docs/prd.md` under "New Game+ — Hard Mode." After credits roll (finishing L7), the game changes subject from using the harness to harness engineering. The chapters:

| Chapter | Teaches |
| --- | --- |
| NG+1 Context Engineering | Context layout, budgets, compaction, cache-aware prompt structure |
| NG+2 Contracts | Structured-output failure handling, schema validation, repair loops, tool contracts |
| NG+3 Guardrails | Loop budgets, tool budgets, termination conditions, permission boundaries |
| NG+4 Routing & Retrieval | Model roles and routing, graceful fallback, retrieval for agents |
| NG+5 Evals & Observability | Golden sets, regression evals, LLM-as-judge (as a taught topic), traces and cost attribution |
| NG+6 Defense | Prompt-injection defense, data-leakage prevention, permission boundaries in practice |
| Boss Rush | Diagnosing rigged production failure modes from recorded traces |

Inference- and serving-infra topics (KV-cache management, batching, quantization, distillation, semantic-caching infrastructure, multi-tenant isolation) are explicitly out: they are not harness skills and belong in a separate "Ops" expansion if ever wanted.

## Planned v2 check types

Two check types are added when Hard Mode ships, noted in ADR-3 as deliberately absent from v1:

- **`usage_stat`** — assert on real session token, cache, or cost counters. Needs an adapter seam for the harness's usage surface.
- **`quiz`** — deterministic knowledge check with a fixed answer set, reserved for the few irreducibly conceptual items. Never LLM-graded.

The closed check set only grows by ADR amendment. See [design decisions](design-decisions.md) (ADR-3) and the check types in `src/core/checks.ts`.

## What this means for v1 contributors today

The v1 code is the working, tested implementation. The v2 direction is planning docs, not code. If you are working on v1:

- The **curriculum** (`packs/`) and **engine** (`src/verifier/`, `src/progression/`, `src/loader/`, `src/core/`) modules survive the rewrite. Work here has lasting value, though check event names will need reauthoring against the owned harness's events.
- The **adapter** (`src/adapter/`) and **extension** (`src/extension/`) modules are replaced in v2. Work here is v1 maintenance only, with a finite horizon.
- Do not use the dead words in new artifacts. Use "harness" and "TUI" for v-next surfaces, not "wrapper," "adapter," "omp," or "Pi."
- The v1 definition of done still applies: `bun run typecheck` and `bun test` must pass. See [how to contribute](../how-to-contribute/index.md).

See [glossary](../overview/glossary.md) for the v2 dead-words list and surviving vocabulary, [lore](../lore.md) for when the decision landed, and [curriculum](../features/curriculum.md) for the v1 level arc and the Hard Mode chapters.
