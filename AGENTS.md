# Garnish — agent guide

Garnish is a terminal game that teaches agentic coding craft fluency with its own
purpose-built harness and TUI (Bun + TypeScript).

## Agent skills

This repo runs the Factorio workflow kit. The per-repo envelope is in
`.agents/envelope/` — read it before planning or building:

- `linear-map.md` — Linear team/project/label/state map + the GitHub bridge.
- `domain.md` — domain glossary.
- `commands.md` — build/test/lint/run + default branch.
- `templates/` — PR/issue/doc templates.

Repo-specific skills and agents live in `.agents/skills/` and `.agents/agents/`.

## Pointers

- Tracker map and planning links: `docs/agents/issue-tracker.md`.
- v1 PRD/ARD: `docs/prd.md`, `docs/ard.md` (ARD §1 and ADR-8/9 are superseded
  for v-next by the standalone-harness decision; see the Garnish Standalone
  project brief in Linear).
- Verify before done: `bun run typecheck` and `bun test`.
