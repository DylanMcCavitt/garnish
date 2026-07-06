# Garnish overview

Garnish is a gamified onboarding layer for agentic coding harnesses. A learner starts in a deliberately bare harness with agent chat and nothing else, then levels up by completing quests that are verified against real behavior (live harness events, config files, git state, command results) rather than self-reported checkboxes. Completing quests unlocks the next tier of harness features, which physically appear in the harness as they unlock.

The v1 implementation targets the Pi harness (Oh My Pi, binary `omp`). Garnish ships as two artifacts sharing one core library: a Pi extension (in-process quest engine that observes live events, renders a HUD, and applies unlocks) and a thin `garnish` CLI for onboarding and status outside a session. Both drive a stock Pi harness through its public extension API and config files.

Three properties define the experience:

1. **Real, not simulated.** Quests run through a Garnish-owned certified Pi runtime against real files in a disposable sandbox. The learner drives an actual agent.
2. **The agent is the tutor.** The active quest is injected into the harness context, so the agent the learner is using is also the guide explaining the quest and celebrating completion.
3. **Earned complexity.** Feature gating keeps the surface area matched to competence. No 40-tool wall on day one; an escape hatch (`garnish unlock`) lets experienced users skip ahead.

## Tech stack

- **Runtime:** Bun (TypeScript, single package, three entry points)
- **Schemas:** Zod with branded types for domain IDs
- **Config parsing:** `yaml` for pack metadata and Pi config files
- **Tests:** `bun:test` (unit + scripted E2E)
- **Target harness:** Pi (omp) v16.2.13, certified and isolated under Garnish-owned storage

## Repository shape

```
src/
  core/         domain schemas (pack, quest, level, checks, progression events)
  adapter/      Pi harness adapter (certified runtime, gates, isolation)
  cli/          garnish CLI (init wizard, status/quest/unlock/doctor)
  extension/    Pi extension (events, HUD, live unlocks, tutor bridge)
  loader/       pack loader (discovery, frontmatter parsing, graph build)
  verifier/     check verification engine (event matching, probes, scheduler)
  progression/  progression engine (event fold, unlock derivation, badges)
packs/core/     v1 core quest packs (L0 Tutorial Island, L1 First Quest, L2 Lore)
spikes/         research spikes (Pi extension API probe)
tests/          unit + E2E tests mirroring src/ structure
docs/           PRD, ARD, quest inventory, issue tracker
```

## Quick links

- [Architecture](architecture.md) — system architecture and component model
- [Getting started](getting-started.md) — prerequisites, install, build, test, run
- [Glossary](glossary.md) — project-specific terms and domain vocabulary
- [By the numbers](../by-the-numbers.md) — codebase statistics snapshot
- [Design decisions](../background/design-decisions.md) — ADR-1 through ADR-9

## Status

The README marks the project "planning / pre-M0," but the codebase has reached M2: the extension is wired, L0 through L2 quest packs ship, and a scripted E2E happy path proves the full init-to-unlock flow. A v2 direction (Garnish Standalone: purpose-built harness and TUI, omp dropped) is captured in planning docs and the [domain glossary](https://github.com/DylanMcCavitt/garnish/blob/main/.agents/envelope/domain.md) but is not yet in the code. See [v2 direction](../background/v2-direction.md) for what that means for the current code.
