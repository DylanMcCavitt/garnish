# Data models

The durable file schemas under the Garnish-owned agent dir. The event log is the source of truth; the state, graph, and quests files are derived or pre-serialized snapshots the extension reads synchronously at session start. Pack and quest files are the human-authored source. All schemas are Zod definitions in `src/core/`.

## events.jsonl

The append-only event log at `{agent_dir}/garnish/events.jsonl` is the source of truth. One `ProgressionEvent` per line, JSON-encoded. Five event types, discriminated by `type` (defined in `src/core/progression.ts`):

### quest_completed

```json
{
  "at": "2026-07-02T12:00:00Z",
  "type": "quest_completed",
  "quest_id": "connect-agent",
  "level_id": "tutorial-island",
  "required": true,
  "xp": 20
}
```

Optional: `session_id`. `xp` is a non-negative integer.

### unlock

```json
{
  "at": "2026-07-02T12:00:00Z",
  "type": "unlock",
  "target": { "type": "feature", "id": "tool:file" },
  "reason": "quest_completed",
  "source_quest_id": "status-screen",
  "source_level_id": "tutorial-island"
}
```

`target` is either `{ "type": "feature", "id": <FeatureId> }` or `{ "type": "level", "id": <LevelId> }`. `reason` is one of `quest_completed`, `speedrun`, `cheat`, `system`. Optional: `session_id`, `source_quest_id`, `source_level_id`.

### xp_award

```json
{
  "at": "2026-07-02T12:00:00Z",
  "type": "xp_award",
  "amount": 20,
  "total": 40
}
```

`amount` is a positive integer. Optional: `quest_id` (when absent, the award is standalone), `total`, `session_id`.

### badge_award

```json
{
  "at": "2026-07-02T12:00:00Z",
  "type": "badge_award",
  "badge": "completionist",
  "level_id": "tutorial-island"
}
```

`badge` is one of `completionist`, `no_hint_clear`, `speedrunner`. Optional: `level_id`, `quest_id`, `session_id`.

### hint_opened

```json
{
  "at": "2026-07-02T12:00:00Z",
  "type": "hint_opened",
  "quest_id": "first-edit",
  "level_id": "first-quest"
}
```

Optional: `hint_id`, `session_id`.

Every `at` is an ISO-8601 timestamp matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/`. `foldEvents` in `src/progression/index.ts` replays the log into state. See [progression events](../primitives/progression-events.md) and [progression engine](../systems/progression.md).

## state.json

The derived snapshot at `{agent_dir}/garnish/state.json`. Written by `garnish init` and reconstructable by replaying the event log. The init-written shape:

```json
{
  "activeLevel": "tutorial-island",
  "packs": ["l0-tutorial-island", "l1-first-quest", "l2-lore"],
  "runtime": { "certifiedVersion": "16.2.13" },
  "sandboxDir": "/Users/example/.garnish/sandbox"
}
```

The folded `ProgressionState` (produced by `foldEvents`) adds `completedQuests`, `xpTotal`, `completedLevels`, `currentLevel`, `unlockSet` (features and levels), `badges`, `hintsOpened`, `levelCompletions`, and `usedSpeedrunPath`. The CLI and extension fold the log to get the full state; the snapshot on disk is the init baseline. See [CLI state](../systems/cli/state.ts) and [progression engine](../systems/progression.md).

## graph.json

The progression graph at `{agent_dir}/garnish/graph.json`, serialized by `toGraphJSON` in `src/loader/index.ts` with sorted keys and no `undefined` values. Shape:

```json
{
  "levels": [
    {
      "id": "tutorial-island",
      "order": 0,
      "quests": ["install-certified-pi", "connect-agent", "second-turn", "status-screen"],
      "unlocks": ["tool:file", "tool:shell"]
    }
  ],
  "quests": [
    { "id": "connect-agent", "level": "tutorial-island", "required": true, "xp": 20, "unlocks": [] }
  ],
  "unlockEdges": []
}
```

`levels` are sorted by `order` then `id`; `quests` are sorted by `id`; `unlockEdges` by endpoint ids. The extension reads this synchronously at session start to drive quest evaluation. See [pack loader](../systems/loader.md).

## quests.json

The full quest definitions at `{agent_dir}/garnish/quests.json`. An array of `Quest` objects (the same `QuestSchema` from `src/core/quest.ts`), including the `checks` array and the prose `description`. The extension reads this synchronously to render quest text and run checks. See [pack loader](../systems/loader.md).

## pack.yml

The pack metadata file at the root of a pack directory. Validated by `PackMetadataSchema` in `src/core/pack.ts`. Example from `packs/core/l0-tutorial-island/pack.yml`:

```yaml
id: l0-tutorial-island
title: Tutorial Island (Onboarding)
description: First-run learner path — certified runtime, first reply, session continuity, status surfaces.
version: 0.1.0
requires:
  adapters: [pi]
  features: []
levels:
  - id: tutorial-island
    title: Tutorial Island
    description: Level 0 — onboarding. Completing required quests unlocks the core file and shell tools.
    order: 0
    quests: [install-certified-pi, connect-agent, second-turn, status-screen]
    unlocks: ["tool:file", "tool:shell"]
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `PackId` | Lowercase slug, branded. |
| `title` | string | Min length 1. |
| `description` | string | Optional. |
| `version` | semver string | Matches `/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/`. |
| `requires.adapters` | `["pi"]` | Defaults to `["pi"]`. |
| `requires.features` | `FeatureId[]` | Defaults to `[]`. |
| `levels` | `Level[]` | Min length 1. Each level has `id`, `title`, `order`, `quests`, `unlocks`, optional `description`. |

A metadata file is one of `pack.yml`, `pack.yaml`, or `pack.json`; having more than one in a directory is an error. See [pack loader](../systems/loader.md) and [domain model](../primitives/domain-model.md).

## Quest .md frontmatter

Each quest is a Markdown file with a leading YAML frontmatter block delimited by `---` lines. The prose body after the frontmatter is the quest `description`. Validated by `QuestSchema` in `src/core/quest.ts`. Example from `packs/core/l0-tutorial-island/connect-agent.md`:

```yaml
---
id: connect-agent
level: tutorial-island
title: Player 1 connected
xp: 20
required: true
prereqs: [install-certified-pi]
unlocks: []
checks:
  - type: event
    match: { event: agent_end, min_assistant_turns: 1 }
  - type: yaml_path
    file: "{agent_dir}/config.yml"
    path: "$.providers[*].apiKeyRef"
    assert: non_empty
---
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `QuestId` | Lowercase slug, branded. |
| `level` | `LevelId` | Must reference a known level in the pack. |
| `title` | string | Min length 1. |
| `description` | string | The prose body. Min length 1. |
| `xp` | non-negative integer | XP awarded on completion. |
| `required` | boolean | Required quests must pass to unlock the next level. |
| `prereqs` | `QuestId[]` | Defaults to `[]`. Must reference known quests; cycles are rejected. |
| `unlocks` | `FeatureId[]` | Defaults to `[]`. Feature ids unlocked by completing this quest. |
| `checks` | `Check[]` | The closed check DSL (`src/core/checks.ts`). |

The check DSL is a Zod discriminated union on `type` with nine kinds: `event`, `file_exists`, `json_path`, `yaml_path`, `command`, `git`, `mcp_handshake`, `skill_valid`, `confirm`. Unknown types fail with `UNKNOWN_CHECK_TYPE_MESSAGE` listing the valid types. See [patterns and conventions](../how-to-contribute/patterns-and-conventions.md) and [verification engine](../systems/verifier.md).

## Cross-references

- [Progression events](../primitives/progression-events.md) — the event schema primitives.
- [Domain model](../primitives/domain-model.md) — the pack, quest, level, and check schema primitives.
- [CLI state](../systems/cli/state.ts) — the fs-backed `ProgressionStore` that reads and appends events.
- [Progression engine](../systems/progression.md) — `foldEvents` and `deriveUnlocks`.
- [Configuration](configuration.md) — where these files live in the storage layout.
