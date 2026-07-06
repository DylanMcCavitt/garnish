# Domain IDs

Domain IDs are the branded slug types that identify quests, levels, packs, and features throughout Garnish. `QuestId`, `LevelId`, `PackId`, and `FeatureId` are defined in `src/core/ids.ts` as Zod schemas with `.brand<"...">()`. Branding gives each ID kind a distinct nominal type at compile time, so a `QuestId` cannot be passed where a `LevelId` is expected even though both are strings at runtime. These IDs appear in every subsystem.

## Key types

| Type | File | Pattern | Description |
|------|------|---------|-------------|
| `QuestId` | `src/core/ids.ts` | `slugPattern`: `^[a-z0-9]+(?:-[a-z0-9]+)*$` | Lowercase slug identifying a quest (e.g. `install-certified-pi`). |
| `LevelId` | `src/core/ids.ts` | `slugPattern` | Lowercase slug identifying a level (e.g. `tutorial-island`). |
| `PackId` | `src/core/ids.ts` | `slugPattern` | Lowercase slug identifying a pack (e.g. `l0-tutorial-island`). |
| `FeatureId` | `src/core/ids.ts` | `featurePattern`: `^[a-z][a-z0-9]*(?:(?:-|:|\.)[a-z0-9]+)*$` | Lowercase feature key with dots, colons, or hyphens (e.g. `tool:file`, `context`, `skills`). |

### The Zod brand pattern

Each schema is `z.string().min(1).regex(pattern).brand<"Kind">()`. The `brand` call wraps the inferred TypeScript type in a nominal brand, so `z.infer<typeof QuestIdSchema>` is `{ readonly [brand]: "QuestId" } & string` rather than plain `string`. This means a function typed to take a `LevelId` will refuse a `QuestId` value at compile time, even though both validate against the same slug regex. The runtime validation is identical; the brand is a compile-time guard against mixing ID kinds.

### The regex patterns

`slugPattern` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) accepts lowercase alphanumeric segments joined by single hyphens. `featurePattern` (`^[a-z][a-z0-9]*(?:(?:-|:|\.)[a-z0-9]+)*$`) is broader: it allows dots and colons as separators so feature keys like `tool:file` and `tool:shell` validate, while still requiring a lowercase letter first and lowercase alphanumeric segments. Both patterns reject uppercase, leading or trailing hyphens, and consecutive separators.

## How they connect

These IDs appear across the codebase:

- **Domain model** (`src/core/`): `Quest.id` is a `QuestId`, `Quest.level` is a `LevelId`, `Quest.unlocks` and `Level.unlocks` are `FeatureId[]`, `Pack.id` is a `PackId`. See [domain model](domain-model.md).
- **Progression events** (`src/core/progression.ts`): `quest_completed` carries `QuestId` and `LevelId`; `unlock` targets a `FeatureId` or `LevelId`. See [progression events](progression-events.md).
- **Adapter** (`src/adapter/gates.ts`): `FeatureId` is the gate key, the catalog key that maps to Pi config surfaces. See [capability gating](../features/capability-gating.md).
- **Loader** (`src/loader/index.ts`): validates quest, level, and pack IDs against these schemas and builds the quest graph keyed by them.
- **Verifier** (`src/verifier/index.ts`): `EventAfter` can be a `QuestId` (the boundary an event check scans from).
- **CLI and extension**: render and match IDs when displaying state and routing unlocks.

## Validation rules

- **Min length 1**: every schema requires at least one character.
- **Slug pattern**: `QuestId`, `LevelId`, and `PackId` must match `slugPattern`.
- **Feature pattern**: `FeatureId` must match `featurePattern`.
- **Brand**: each schema brands its output, so the inferred type is nominally distinct from plain `string` and from the other ID kinds.
- **Strict reuse**: because the same `QuestIdSchema` validates `Quest.id`, `Quest.prereqs` entries, and `EventAfter` quest references, a typo in a prereq or `after` reference fails validation at load time rather than at evaluation time.

## Key source files

| File | Purpose |
|------|---------|
| `src/core/ids.ts` | `QuestIdSchema`, `LevelIdSchema`, `PackIdSchema`, `FeatureIdSchema`, `slugPattern`, `featurePattern`, and the branded types. |
| `src/core/index.ts` | Re-exports the ID schemas and types. |

Cross-link: [domain model](domain-model.md), [progression events](progression-events.md), [capability gating](../features/capability-gating.md), [Pi adapter](../systems/adapter.md).
