# Domain glossary — Garnish

Garnish teaches **agentic coding craft fluency** through a real, working terminal
harness on real repos, files, tools, and model calls. "Real, not simulated" means
the learner drives an actual agent; it does not mean wrapping a third-party
harness (that thesis is dead as of 2026-07-02).

## Core nouns

- **Harness** — Garnish's own agent runtime: agent loop, provider integration,
  tool execution, approvals, session persistence, sandbox safety, and the game
  loop. v-next owns all of it; there is no external harness underneath. Avoid
  "wrapper" and "adapter" for v-next surfaces.
- **TUI** — the game-first terminal interface Garnish renders. Owned by Garnish.
- **Quest** — one learnable task with checks; authored as Markdown + front matter
  inside a pack.
- **Quest pack / pack** — a directory of quests plus `pack.yml` (see `packs/`).
  Loaded by the **pack loader**, which rejects unknown quest ids.
- **Level (L0–L7)** — curriculum arc stages; each level is a pack in the core
  pack (`packs/core/l0-tutorial-island`, `l1-first-quest`, `l2-lore`, ...).
- **Verifier** — evaluates quest **checks** against observed behavior. Check
  kinds: `event`, `file`, `yaml`, `command`, `git`. No OR in the check DSL.
- **Progression** — the graph of quests/levels, **unlock** derivation, **XP**,
  and **badges**; events append to `events.jsonl`.
- **Gate** — a capability restriction lifted by progression (gate catalog).
- **Tutor** — context injection that lets the agent answer "what's my quest?"
  from live quest state.
- **Graduation / portable-loadout export** — the successor mechanic to v1
  `garnish eject`; exact shape is a blueprint decision. Do not call it "eject"
  in new artifacts.

## Bounded contexts

- **Curriculum/content**: packs, quests, checks, levels — portable across the
  harness rewrite; reauthor event names against Garnish's own harness events.
- **Engine**: verifier, progression, gates, tutor context — the surviving main
  bus.
- **Harness/TUI**: v-next build; supersedes ARD §1, ADR-8, ADR-9.

## Dead words (v1-only, do not use for v-next)

`omp`, `Pi adapter`, `certified runtime`, `omp extension`/`HUD`/`slash
commands` (as omp surfaces), `PI_CODING_AGENT_DIR`, `version handshake`,
`eject`. These survive only in frozen v1 maintenance context (LOO-148/149/150,
currently paused/cancelled).
