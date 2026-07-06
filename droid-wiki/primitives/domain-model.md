# Domain model

The domain model is the set of Zod schemas in `src/core/` that define the shape of every quest, level, pack, and check in Garnish. `Quest`, `Level`, and `Pack` describe the curriculum data; the `Check` discriminated union is the closed check DSL the verifier evaluates. These schemas are the contract between pack authors, the loader that parses them, and the verifier and progression engine that act on them. Every type carries a branded ID from [domain IDs](ids.md).

## Key types

### Curriculum schemas

| Type | File | Description |
|------|------|-------------|
| `Quest` | `src/core/quest.ts` | `id` (QuestId), `level` (LevelId), `title`, `description`, `xp` (non-negative int), `required` (boolean), `prereqs` (QuestId[], default `[]`), `unlocks` (FeatureId[], default `[]`), `checks` (at least one Check). |
| `Level` | `src/core/level.ts` | `id` (LevelId), `title`, optional `description`, `order` (non-negative int), `quests` (QuestId[], default `[]`), `unlocks` (FeatureId[], default `[]`). |
| `PackMetadata` | `src/core/pack.ts` | `id` (PackId), `title`, optional `description`, `version` (semver), `requires` (PackRequires, default pi adapter, no features), `levels` (at least one Level). |
| `Pack` | `src/core/pack.ts` | `PackMetadata` extended with `quests` (Quest[], default `[]`). |
| `PackRequires` | `src/core/pack.ts` | `adapters` (defaults to `["pi"]`), `features` (FeatureId[], default `[]`). |
| `UnlockEdge` | `src/core/pack.ts` | `{ quest: QuestId, feature: FeatureId }`, a declarative edge from a quest to a feature it unlocks. |

### The check DSL

`Check` is a Zod discriminated union on the `type` field with nine members, defined in `src/core/checks.ts`. The `CHECK_TYPES` constant lists them and `UNKNOWN_CHECK_TYPE_MESSAGE` is the error string the union emits for an unknown type.

| Check type | Key fields | Description |
|------------|------------|-------------|
| `event` | `match` (EventMatch), `after` (EventAfter, optional), `sameSession` (boolean, optional) | Match on a recorded tool or session event. |
| `file_exists` | `path` (path template) | A file exists on disk. |
| `json_path` | `file`, `path` (JSONPath), `assert` (Assertion) | A JSONPath assertion against a JSON file. |
| `yaml_path` | `file`, `path` (JSONPath), `assert` (Assertion) | A JSONPath assertion against a YAML file. |
| `command` | `command` (string or string[]), `exit_code`, `stdout`, `stderr`, `timeout_ms` | A shell command with exit code and stdout/stderr predicates. |
| `git` | `repo`, `commit_count`, `clean_tree`, `branch_exists`, `dirty`, `diff_contains`, `file_restored` | Git state predicates (at least one required). |
| `mcp_handshake` | `server` (StringPredicate), `timeout_ms` | An MCP server handshake succeeds. |
| `skill_valid` | `path`, `discovery` (boolean, optional) | A skill file has valid frontmatter and discovery. |
| `confirm` | `id`, `prompt`, `expected` (literal true) | Explicit learner self-confirmation; the only check that can return `pending`. |

### Predicate and matcher types

| Type | File | Description |
|------|------|-------------|
| `StringMatcher` | `src/core/checks.ts` | `{ equals, contains, starts_with, ends_with, regex, one_of }`, all optional but at least one required (superRefine). |
| `StringPredicate` | `src/core/checks.ts` | Union of a non-empty string (literal equality) or a `StringMatcher`. |
| `IntPredicate` | `src/core/checks.ts` | Union of a non-negative int (literal equality) or `{ equals, min, max }` (at least one required, `min` <= `max`). |
| `Assertion` | `src/core/checks.ts` | Union of `exists`, `missing`, `non_empty`, `{ equals }`, `{ contains }`, `{ matches }` (regex). Used by `json_path` and `yaml_path` checks. |
| `EventMatch` | `src/core/checks.ts` | The match spec for an `event` check: `event`, plus optional `tool`, `source`, `server`, `name`, `path`, `success`, `approved`, `exit_code`, `count`, `min_assistant_turns`, `resumed`, `extension_loaded`, `size_reduced`, `reason`, `headless`, and `tasks.length`. |
| `EventAfter` | `src/core/checks.ts` | Union of a `QuestId` (the event after which that quest completed) or `{ ref, event }` resolved against event refs. Sets the boundary an event check scans from. |
| `Checks` | `src/core/checks.ts` | `z.array(CheckSchema).min(1)`, enforcing at least one check per quest. |

## How they connect

These schemas are imported across the codebase:

- **Loader** (`src/loader/index.ts`): parses pack `pack.yml` and quest `.md` frontmatter against `PackSchema`, `QuestSchema`, and `CheckSchema`.
- **Verifier** (`src/verifier/index.ts`): `evaluateCheck` dispatches on `check.type`; the event evaluator consumes `EventMatch` and `EventAfter`.
- **Progression** (`src/progression/index.ts`): folds quests and levels from the graph to compute completion, XP, and unlocks.
- **Adapter** (`src/adapter/gates.ts`): renders gate config from the `FeatureId` unlocks carried on quests and levels.
- **CLI** (`src/cli/`): `init` assembles the progression graph from loaded packs; `status` and `quest` render quest state.
- **Extension** (`src/extension/index.ts`): evaluates active quests against the `Check` list.

See [verifier](../systems/verifier.md), [loader](../systems/loader.md), and [curriculum](../features/curriculum.md) for the system-level views.

## Validation rules

- **At least one predicate**: `StringMatcher`, the object form of `IntPredicate`, and `GitCheck` each use `superRefine` to reject a spec that declares no predicate. `StringMatcher` also requires at least one of its six matcher keys.
- **`min` <= `max`**: the object form of `IntPredicate` rejects `min > max`.
- **Semver version**: `PackMetadata.version` must match `^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$`.
- **At least one level**: `PackMetadata.levels` is `z.array(LevelSchema).min(1)`.
- **At least one check per quest**: `ChecksSchema` is `z.array(CheckSchema).min(1)`.
- **JSONPath shape**: `json_path` and `yaml_path` paths must start with `$`.
- **Branded IDs**: `id`, `level`, and `pack` fields use the branded slug schemas from `src/core/ids.ts` (see [domain IDs](ids.md)).
- **Strict objects**: every schema uses `z.strictObject`, so unknown keys are rejected. This keeps pack authoring honest and the loader's error messages precise.

## Key source files

| File | Purpose |
|------|---------|
| `src/core/quest.ts` | `QuestSchema` and `Quest`. |
| `src/core/level.ts` | `LevelSchema` and `Level`. |
| `src/core/pack.ts` | `PackSchema`, `PackMetadataSchema`, `PackRequiresSchema`, `UnlockEdgeSchema`. |
| `src/core/checks.ts` | The `Check` discriminated union, all nine check schemas, `StringMatcher`, `StringPredicate`, `IntPredicate`, `Assertion`, `EventMatch`, `EventAfter`, `CHECK_TYPES`, `UNKNOWN_CHECK_TYPE_MESSAGE`. |
| `src/core/index.ts` | Re-exports the core module. |

Cross-link: [verifier](../systems/verifier.md), [loader](../systems/loader.md), [curriculum](../features/curriculum.md), [domain IDs](ids.md), [progression events](progression-events.md).
