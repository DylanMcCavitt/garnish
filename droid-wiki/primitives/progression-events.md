# Progression events

Progression events are the append-only event log that is the source of truth for learner state. `ProgressionEvent` is a Zod discriminated union in `src/core/progression.ts` with five members: `quest_completed`, `unlock`, `xp_award`, `badge_award`, and `hint_opened`. The extension and CLI append these to `events.jsonl`, and the progression engine's `foldEvents` is a pure function that replays the log into a `ProgressionState`. State is always reconstructable from the log alone.

## Key types

| Type | File | Description |
|------|------|-------------|
| `ProgressionEvent` | `src/core/progression.ts` | Discriminated union on `type` of the five event members below. |
| `QuestCompletedEvent` | `src/core/progression.ts` | `at`, optional `session_id`, `quest_id` (QuestId), `level_id` (LevelId), `required` (boolean), `xp` (non-negative int). |
| `UnlockEvent` | `src/core/progression.ts` | `at`, optional `session_id`, `target` (UnlockTarget), `reason` (enum), optional `source_quest_id`, optional `source_level_id`. |
| `XpAwardEvent` | `src/core/progression.ts` | `at`, optional `session_id`, optional `quest_id`, `amount` (positive int), optional `total` (non-negative int). |
| `BadgeAwardEvent` | `src/core/progression.ts` | `at`, optional `session_id`, `badge` (Badge), optional `level_id`, optional `quest_id`. |
| `HintOpenedEvent` | `src/core/progression.ts` | `at`, optional `session_id`, `quest_id` (QuestId), `level_id` (LevelId), optional `hint_id`. |
| `UnlockTarget` | `src/core/progression.ts` | Discriminated union on `type`: `{ type: "feature", id: FeatureId }` or `{ type: "level", id: LevelId }`. |
| `Badge` | `src/core/progression.ts` | Enum: `completionist`, `no_hint_clear`, `speedrunner`. |

### Event base shape

Every event shares `eventBaseShape`: an `at` timestamp and an optional `session_id`. The timestamp must match the ISO-8601 regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$`. The `session_id` lets event checks constrain matches to the same session.

### Unlock reasons

The `UnlockEvent.reason` enum records why a capability or level was unlocked:

- `quest_completed`: a level's required quests completed and `deriveUnlocks` appended the event.
- `speedrun`: the learner chose speedrun at onboarding and skipped ahead without XP.
- `cheat`: `garnish unlock --all` (or `/unlock --all`) appended the event.
- `system`: a system-initiated unlock.

The progression fold sets `usedSpeedrunPath` when it sees a `speedrun` or `cheat` reason, which is what gates the `speedrunner` badge (see [progression](../systems/progression.md)).

## How they connect

These event types flow through the system as the durable state layer:

- **Extension** (`src/extension/index.ts`): appends `quest_completed` events when quests pass, then re-folds and appends `unlock` events from `deriveUnlocks`.
- **CLI** (`src/cli/`): `init` appends speedrun `unlock` events; `status` and `quest` fold the log to render state; `unlock` appends `cheat` unlock events.
- **Progression** (`src/progression/index.ts`): `foldEvents` replays the log into `ProgressionState`; `deriveUnlocks` computes the `unlock` events that follow level completions.
- **Verifier** (`src/verifier/index.ts`): event checks with an `after: QuestId` boundary scan for the matching `quest_completed` event.

See [quest verification](../features/quest-verification.md) for the flow that appends these events and [progression](../systems/progression.md) for the fold that consumes them.

## Validation rules

- **Discriminated union**: each event is validated by its `type` branch. Unknown types are rejected.
- **Strict objects**: every event schema uses `z.strictObject`, so unknown keys are rejected.
- **Timestamp format**: `at` must match the ISO-8601 regex above.
- **Branded IDs**: `quest_id`, `level_id`, and feature targets use the branded slug types from `src/core/ids.ts` (see [domain IDs](ids.md)).
- **Positive XP amounts**: `XpAwardEvent.amount` is a positive int; `QuestCompletedEvent.xp` is a non-negative int.
- **Badge enum**: `BadgeAwardEvent.badge` must be one of the three badge names.

## The source-of-truth principle

`events.jsonl` is the log; `foldEvents` is the pure fold; `ProgressionState` is the derived snapshot. Because the fold is deterministic and the log is append-only, state is always reconstructable from the log. This is ADR-4. The progression engine's `replayProgression` self-check folds the same events twice and compares the JSON to verify determinism.

## Key source files

| File | Purpose |
|------|---------|
| `src/core/progression.ts` | `ProgressionEvent` union, all five event schemas, `UnlockTarget`, `Badge`. |
| `src/progression/index.ts` | `foldEvents`, `deriveUnlocks`, `replayProgression` (see [progression](../systems/progression.md)). |
| `src/extension/index.ts` | Appends `quest_completed` and `unlock` events during evaluation. |

Cross-link: [progression](../systems/progression.md), [quest verification](../features/quest-verification.md), [domain IDs](ids.md), [domain model](domain-model.md).
