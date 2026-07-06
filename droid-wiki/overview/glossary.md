# Glossary

Project-specific terms for Garnish. The authoritative domain glossary also lives at `.agents/envelope/domain.md`.

## Core nouns

- **Harness** — the agent runtime the learner drives. In v1 this is Pi (Oh My Pi, binary `omp`). The v2 direction renames this to Garnish's own purpose-built harness.
- **Quest** — one learnable task with checks. Authored as a Markdown file with YAML frontmatter inside a pack.
- **Quest pack / pack** — a directory of quests plus `pack.yml`. Loaded by the pack loader, which rejects unknown quest IDs and cyclic prereqs.
- **Level (L0 to L7)** — a curriculum arc stage. Each level is a pack in the core pack (`packs/core/l0-tutorial-island`, `l1-first-quest`, `l2-lore`, and planned levels L3 through L7). A level's required quests must pass to unlock the next level.
- **Verifier** — evaluates quest checks against observed behavior. Check kinds: `event`, `file_exists`, `json_path`, `yaml_path`, `command`, `git`, `mcp_handshake`, `skill_valid`, `confirm`.
- **Progression** — the graph of quests and levels, unlock derivation, XP, and badges. Events append to `events.jsonl`; state is a pure fold of the log.
- **Gate** — a capability restriction lifted by progression. The gate catalog maps feature IDs to Pi config surfaces (tools, skills, MCP servers, extensions, providers, approval modes).
- **Tutor** — context injection that lets the agent answer "what's my quest?" from live quest state. Two seams: static framing in `APPEND_SYSTEM.md` and dynamic per-call injection through the Pi `context` event.
- **Check** — a declarative assertion in the closed check DSL. A quest passes when all its checks pass.
- **Certified runtime** — the specific Pi version (v16.2.13) Garnish installs into its own storage and launches by absolute path. The learner's global `omp` is ignored.
- **Version handshake** — a startup check where the extension verifies the running binary reports the certified version. On mismatch, quests pause and `garnish doctor` explains how to repair.
- **Sandbox** — a disposable learning directory where quests operate. Never an existing project by default.
- **Extension** — the in-process Pi module (`src/extension/`) that observes events, renders the HUD, and applies unlocks. Bundled into `$PI_CODING_AGENT_DIR/extensions/garnish/index.js`.
- **Adapter contract** — the pinned set of Pi API facts Garnish relies on (event names, config keys, env vars). Asserted by `assertAdapterContract` in `src/adapter/contract.ts`.

## Domain IDs

Branded types defined in `src/core/ids.ts`:

- **QuestId** — lowercase slug identifying a quest (e.g. `install-certified-pi`).
- **LevelId** — lowercase slug identifying a level (e.g. `tutorial-island`).
- **PackId** — lowercase slug identifying a pack (e.g. `l0-tutorial-island`).
- **FeatureId** — lowercase feature key with dots or colons (e.g. `tool:file`, `context`, `skills`).

## Progression terms

- **XP** — experience points awarded on quest completion. Score and feedback, not a gate.
- **Badge** — a feat marker. Three kinds: `completionist` (all quests in a level or the whole pack), `no_hint_clear` (a level cleared without opening hints), `speedrunner` (skipped in via speedrun, then cleared all required quests).
- **Speedrun mode** — an onboarding choice that unlocks levels ahead without awarding XP. The Speedrunner badge is earnable by later clearing the skipped required quests.
- **Unlock** — a progression event that lifts a gate. Reasons: `quest_completed`, `speedrun`, `cheat`, `system`.
- **UnlockEdge** — a declarative edge from a quest to a feature it unlocks.
- **Unlock set** — the set of features and levels currently unlocked, derived from the event log.
- **Monotonic unlocks** — capabilities are only ever added, never removed. The gate config renderer and live unlock applier enforce this.

## Curriculum theme (gamer-native)

Themed terms always travel with their functional word in the UI:

- **Tutorial Island** = onboarding (L0)
- **First Quest** = core agent loop (L1)
- **Lore** = context (L2)
- **Skill Tree** = skills (L3, planned)
- **Loadout** = MCP and extensions (L4, planned)
- **The Party** = subagents (L5, planned)
- **Macros** = automation (L6, planned)
- **Final Boss** = capstone (L7, planned)
- **Speedrun mode** = skip-ahead at onboarding
- **Cheat code** = `garnish unlock --all` (alias: `garnish cheat`)
- **Credits roll** = finishing L7
- **New Game+** = the v2 Hard Mode expansion (context engineering, contracts, guardrails)

## v2 dead words

The domain glossary marks these as v1-only, not to be used for v-next artifacts: `omp`, `Pi adapter`, `certified runtime`, `omp extension`/`HUD`/`slash commands` (as omp surfaces), `PI_CODING_AGENT_DIR`, `version handshake`, `eject`. They survive only in frozen v1 maintenance context. See [v2 direction](../background/v2-direction.md).
