# Background

Garnish went from an empty directory to a working M2 build with three quest packs in four days (Jul 1 to Jul 4, 2026). This section documents the design history: the architecture decisions that shaped v1, and the v2 direction that supersedes parts of it.

The v1 decisions are recorded as nine ADRs in `docs/ard.md`. The v2 direction is recorded in `.agents/envelope/domain.md` and the Garnish Standalone project brief in Linear, captured on Jul 2, 2026.

## Pages

- [Design decisions](design-decisions.md) — ADR-1 through ADR-9, each with the decision and rationale, plus which ADRs are superseded for v2.
- [v2 direction](v2-direction.md) — the Garnish Standalone decision to build a purpose-built harness and TUI, the v1 dead words, the bounded contexts that survive and those that are replaced, and what this means for contributors working on v1 code today.

For the narrative history of when things landed, see [lore](../lore.md). For the v1 PRD and ARD in full, see `docs/prd.md` and `docs/ard.md`.
