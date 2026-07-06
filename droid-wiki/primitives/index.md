# Primitives

Primitives are the foundational domain objects defined in `src/core/` that appear across three or more systems. A change to a primitive ripples through every consumer, so they are documented separately from the [systems](../systems/index.md) that use them. Each primitive group has its own page with the key types, how they connect to the systems, and the validation rules.

- [Domain model](domain-model.md): `Quest`, `Level`, `Pack`, and `Check` plus the check DSL as a Zod discriminated union of nine types. These schemas are the shape of every quest, pack, and level in the curriculum, and the verifier evaluates checks against them. Defined in `src/core/quest.ts`, `src/core/level.ts`, `src/core/pack.ts`, and `src/core/checks.ts`.
- [Progression events](progression-events.md): the `ProgressionEvent` discriminated union (`quest_completed`, `unlock`, `xp_award`, `badge_award`, `hint_opened`) that forms the append-only event log. `events.jsonl` is the source of truth and `foldEvents` is the pure fold that rebuilds state. Defined in `src/core/progression.ts`.
- [Domain IDs](ids.md): the branded slug types `QuestId`, `LevelId`, `PackId`, and `FeatureId`. Branding prevents mixing ID kinds at compile time. Defined in `src/core/ids.ts`.

These types appear in core, the adapter, loader, verifier, progression, CLI, and extension. For the cross-cutting capabilities that move these objects around, see [features](../features/index.md).
