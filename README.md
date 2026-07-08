# Garnish

Garnish is a gamified onboarding layer for agentic coding harnesses. It starts a learner in a deliberately small standalone harness, then unlocks tools, skills, MCP servers, subagents, and automation as they complete verified quests.

Status: planning / pre-M0.

## Docs

- [PRD](docs/prd.md) — product scope, curriculum, acceptance criteria
- [ARD](docs/ard.md) — architecture requirements and decisions
- [Quest Inventory](docs/quests.md) — v1 core-pack quest list, XP, and check types

## Current decisions

- v1 target harness: standalone Garnish harness
- Distribution: Garnish state is provisioned by the standalone harness; the portable CLI reads that state
- Tracker: Linear
- Verification: deterministic checks only in v1; no LLM-graded quest completion
- Theme: gamer-native — Tutorial Island, Skill Tree, Loadout, The Party, Macros, Final Boss

## License

MIT — see [LICENSE](LICENSE).
