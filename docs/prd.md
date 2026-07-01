# PRD — Garnish: a gamified harness for learning coding agents

> Status: draft v1 · Greenfield · 2026-07-01
> Companion: [ARD](./ard.md)

## Problem

Coding-agent harnesses (Pi, Claude Code, Codex CLI, and peers) are deep tools with a
brutal discovery curve. A new user installs one, connects a model, asks a few chat
questions — and plateaus there. The features that make harnesses actually powerful
(skills, context files, MCP servers, plugins, subagents, workflows, automation loops)
are invisible, undocumented-in-flow, and intimidating. There is no path from "I
installed it" to "I orchestrate agents." Docs explain features; nothing sequences them,
verifies you learned them, or tells you what to reach for next.

The result: most users operate a Formula 1 car in first gear, churn on the plateau, and
either quit or never discover 90% of the tool.

## Solution

**Garnish** wraps a real harness in a progression system. The user starts in a
deliberately bare harness — agent chat and nothing else — and levels up by completing
quests that are verified against reality (live harness events, config files, git state,
command results), not self-reported checkboxes. Completing quests unlocks the next tier
of harness features, which physically appear in the harness as they unlock.

Three properties make it work:

1. **Real, not simulated.** Quests run through a real Garnish-owned Pi harness against
   real files in a disposable sandbox first. After credits roll, `garnish eject` lets
   the learner copy the loadout they built (config, skills, MCP setup) into a standalone
   Pi setup if they want to leave the managed runtime.
2. **The agent is the tutor.** The active quest is injected into the harness's own
   context, so the agent the user is learning to use is also the guide explaining the
   quest, giving hints, and celebrating completion. The tool teaches itself.
3. **Earned complexity.** Feature gating keeps the surface area matched to the user's
   competence. No 40-tool wall on day one; no artificial ceiling on day thirty — an
   escape hatch (`garnish unlock`) lets experienced users skip ahead at any time.

The user knows it changed because: they run one install command, answer ~4 onboarding
prompts, and land in a working harness with a visible quest log ("Tutorial Island —
Level 0: 3 quests"); each completed quest fires a celebration and visibly unlocks
capability; `garnish status` shows the tree of what's unlocked and what's next.

## User stories

1. As a **developer new to coding agents**, I want a guided, ordered path from install
   to competence, so that I learn by doing instead of drowning in docs.
2. As a **new user**, I want the harness to start minimal and grow as I learn, so that
   I'm never staring at features I don't understand.
3. As a **learner**, I want quests verified from what I actually did (live harness
   events, files, commits), so that progress reflects real skill, not clicked-through checkboxes.
4. As a **learner**, I want to ask the agent itself "what's my current quest?" and get
   help with it, so that learning happens inside the loop I'm building.
5. As an **experienced agent user**, I want to skip or bulk-unlock levels, so that
   gating never insults my time.
6. As a **team lead**, I want to point new hires at one install command that produces a
   consistently configured harness plus the skills to use it, so that onboarding is
   self-serve.
7. As a **curriculum author**, I want to write quest packs as declarative files (the
   same authoring muscle as writing a skill), so that the community can extend the
   curriculum to new harnesses, stacks, and team-specific workflows.
8. As a **returning user**, I want streak-free, low-pressure progression with a clear
   "resume here" pointer, so that a two-week gap doesn't reset anything.

## Curriculum (v1 core pack)

**Theme: gamer-native.** No borrowed metaphor — the vocabulary developers already
speak: levels, skill trees, loadouts, co-op, cheat codes. Rule: a themed term never
travels alone; UI pairs it with the functional word ("Loadout — MCP & plugins"), and
CLI verbs stay functional (`garnish unlock --all` is the documented name; `garnish
cheat` ships as an alias). Each level = 3–6 quests; a level's *required* quests must
pass to unlock the next.

| Lvl | Name | Teaches | Sample quests | Unlocks |
|---|---|---|---|---|
| 0 | Tutorial Island | Onboarding | Install harness; connect a model/API key; get first agent reply | Chat |
| 1 | First Quest | Core agent loop | Have the agent create+edit a file; run a command through it; make it explain a diff; revert something | File tools, shell |
| 2 | Lore | Context | Create AGENTS.md the agent respects; teach it a project convention; resume a prior session | Context files, sessions |
| 3 | Skill Tree | Skills | Use a bundled skill; author a skill with valid frontmatter; trigger it organically | Skills dir, skill authoring |
| 4 | Loadout | Extensions | Connect an MCP server; use one of its tools in a task; install a plugin | MCP config, plugins |
| 5 | The Party | Delegation | Delegate a task to a subagent; run two subagents in parallel; review a subagent's diff | Subagents, task fanout |
| 6 | Macros | Automation | Run the harness headless on a scripted task; build a review loop; wire a scheduled/CI run | Headless mode, workflows |
| 7 | Final Boss | Capstone | Ship a small real project using skills + MCP + subagents; checklist-verified | Credits roll: everything unlocked, New Game+ |

Vocabulary map (themed ↔ functional): quest packs = **expansion packs**; skip-ahead at
onboarding = **speedrun mode**; `unlock --all` = the **cheat code**; the scaffolded
practice repo = **the sandbox**; approval-mode always-ask = **assist mode**, `yolo` =
**hardcore mode**; finishing L7 = **credits roll**, after which **New Game+** = same
harness, no gates, XP kept. Badges for feats: **Completionist** (every optional quest),
**No-Hint Clear** (level without hints), **Speedrunner** (skipped in, then cleared the
levels anyway). XP per quest, quest log, per-level completion stats. No leaderboards,
no dark-pattern streaks (opt-in only).

The full v1 quest inventory lives in [Quest Inventory](./quests.md). The inventory is
part of the spec, not implementation detail: it dogfoods the check DSL before M0
freezes the schema.

## New Game+ — Hard Mode (v2, captured now)

After credits roll, the game changes subject: from *using* the harness to
**harness engineering** — context engineering, not just long prompts; contracts,
not vibes. A v2 expansion pack (not v1 scope), captured here so the curriculum has a
destination. Topics kept are the ones a learner can *exercise inside a harness*;
inference-infra topics are explicitly out (below).

| Chapter | Teaches | Sample quest shape | Verified by |
|---|---|---|---|
| NG+1 Context Engineering | Context layout & budgets, compaction, cache-aware prompt structure (prompt-caching awareness via real usage stats) | Restructure a bloated context; rerun the same task; show cached-token delta | usage stats, artifact |
| NG+2 Contracts | Structured-output failure handling: schema validation, repair loops, fallback chains; tool contracts: argument validation, idempotency | Author a custom tool with a validated schema + repair loop; prove idempotency by replaying the same call | artifact, event |
| NG+3 Guardrails | Loop budgets, tool budgets, termination conditions, permission boundaries | Configure budgets so a deliberately runaway task self-terminates; capture the stop | event, config |
| NG+4 Routing & Retrieval | Model roles and routing, graceful fallback, degraded-mode UX; retrieval *for agents* (memory/search seams; in-context vs retrieval decision) | Wire smol/default/slow roles; kill the primary provider mid-task and show graceful degrade; add a retrieval seam and show grounded answers | config, event, artifact |
| NG+5 Evals & Observability | Golden sets, regression evals for agent workflows, LLM-as-judge (as a taught topic), traces/tokens/latency/cost attribution per workflow | Build a golden-set eval for your L6 workflow; inject a regression; eval catches it | command, artifact |
| NG+6 Defense | Prompt-injection defense, data-leakage prevention, permission boundaries in practice | Red-team your own sandbox agent with a planted injection; then configure the harness so the same attack is contained | event, artifact |
| Boss Rush | Production failure modes: hallucinated tool calls, malformed JSON, stale retrieval, runaway agents | Diagnose N rigged scenarios from recorded traces; name the failure mode, fix the config/contract | scenario fixtures, quiz |

Two additions to the check DSL when this ships (v2, ARD-noted): `usage_stat`
(assert on real session token/cache/cost counters) and `quiz` (deterministic
knowledge check, fixed answer set — reserved for the few irreducibly conceptual
items; never LLM-graded).

**Explicitly dropped from the source list** (inference-/serving-infra, not harness
skills — wrong classroom): KV-cache management/eviction, prefill-vs-decode latency,
continuous batching, paged attention, speculative decoding, quantization
(INT8/INT4/FP8/AWQ/GPTQ), distillation, semantic-caching infrastructure,
multi-tenant isolation and cross-user cache contamination. If a future pack wants
these, it's a separate "Ops" expansion with its own doctrine — not Hard Mode.

Foreshadowing in v1 (no scope change): L4–L6 optional quests may reference budgets,
approval boundaries, and model roles where Pi exposes them natively; Hard Mode is
where they become the subject.

## Decisions

The decisions this spec encodes (rationale and alternatives in the ARD):

- **Extension + CLI, never a fork.** Garnish is (a) a Pi *extension* (in-process quest
  engine: observes live `tool_call`/`tool_result`/session events, renders a HUD widget
  and status line, registers `/quest` and `/unlock` commands) plus (b) a thin `garnish`
  CLI for onboarding/status outside a session. Both drive a stock harness through its
  public extension API and config files — verified against Pi's documented surface.
  A versioned `HarnessAdapter` seam isolates Pi-specifics so the curriculum core stays
  harness-agnostic.
- **Verification against reality.** A quest passes when declarative checks pass against
  real state: live harness events (tool calls, session lifecycle), config
  presence/shape, git predicates, command exit codes, MCP handshakes. No transcript
  scraping — the extension observes events in-process. Verification is deterministic
  everywhere, capstone included: it decomposes into the same check types plus
  self-confirmed checklist items. No LLM-judged checks in v1.
- **Progression engine owns truth.** Local-first state: one JSON state file plus an
  append-only event log under the agent dir. Unlocks are pure functions of completed
  quests; state is reconstructable from the log.
- **Hard gating via config + runtime, soft gating via HUD.** All v1 gates are
  hard-expressible in Pi: per-tool config toggles and live `setActiveTools` for tools;
  an `includeSkills` allowlist for skills; `mcp.json` ownership plus `disabledServers`
  for MCP; `disabledExtensions` for plugins/extensions. Unlocks apply live where the
  runtime allows and via session `reload()` where config is baked at session start
  (e.g. the skills list). `garnish unlock [--all|--level N]` is the always-available
  escape hatch.
- **Certified Pi distribution + full isolation.** Garnish installs and launches its own
  certified Pi build instead of relying on whatever `omp` is on the learner's PATH.
  Runtime files live under Garnish-owned storage; sessions/config use
  `PI_CODING_AGENT_DIR` so the user's real harness config is never touched. Learners
  only move to a newer Pi when a Garnish release certifies it; the extension performs a
  startup version handshake and pauses quests with `garnish doctor` guidance on mismatch.
  `garnish eject` is the post-credits path for copying the learned loadout into a real
  standalone Pi setup.
- **Onboarding provider scope.** v1's wizard has first-class paths for Anthropic and
  OpenAI API-key env vars, plus a manual "local/other" path. Quest verification remains
  provider-agnostic: a valid first assistant reply completes "connect your agent"
  regardless of provider.
- **Quest packs are data.** Curriculum ships as markdown-with-frontmatter files
  (deliberately the same format family as skills — authoring a pack *is* practicing
  the skill format). Packs declare quests, verifiers, hints, unlock edges.
- **Tutor bridge, two seams.** Static framing ("you are also a tutor; Garnish is
  running") lands in `APPEND_SYSTEM.md`, which appends to the system prompt without
  displacing defaults. The *active quest* (text, checks, hint policy) is injected
  per-call by the extension via the `context` event, so the agent always answers from
  the current quest without restarts.

## Non-goals (v1)

- **No hosted service.** No accounts, no server, no telemetry backend. Local-first.
- **No multiple harness adapters.** Pi only; the adapter seam exists, but proving
  portability is v2.
- **No leaderboards or social features.** Solo progression only.
- **No forked or patched harness.** If a gate can't be expressed through public
  config/extension surfaces, it degrades to soft gating rather than patching.
- **No LLM-judged verification.** Deterministic checks only, capstone included; an
  LLM-graded capstone rubric is a v2 candidate.
- **No teaching prompt-engineering theory.** Quests teach the harness; the tutor may
  give tips, but the curriculum verifies harness mechanics, not prose style.
- **No new model/API brokering.** Bring-your-own key; Garnish never proxies model calls.

## Acceptance criteria

- [ ] `garnish init` on a machine without Pi: interactive onboarding (≤5 prompts)
      installs a certified Pi build into Garnish-owned storage, writes isolated config
      via `PI_CODING_AGENT_DIR`, and lands the user in the harness with Tutorial Island
      active — under 5 minutes on a clean macOS/Linux box.
- [ ] Completing "connect your agent" (valid key + one successful agent reply)
      auto-completes the quest within 10 seconds of the reply, with visible feedback —
      no manual "mark done".
- [ ] Every core-pack quest is verified by declarative checks that pass on genuine
      completion and fail on absence — demonstrated by fixture-driven tests for both
      directions.
- [ ] While a feature is locked, its harness surface is absent (config-level gate) or
      inactive (runtime gate); unlocking applies live where the runtime allows, else
      via an automatic session reload — never a manual config edit.
- [ ] `garnish status` renders level, XP, per-quest state, and next-quest pointer;
      `garnish quest` shows the active quest's full text and its checks.
- [ ] `garnish unlock --all` produces a fully unlocked harness config identical in
      effect to a stock full install.
- [ ] Inside the harness, asking the agent about the current quest yields a grounded
      answer that includes the quest's actual acceptance checks (via tutor bridge).
- [ ] A third-party quest pack in a directory validates against the pack schema, loads,
      and its quests appear in the progression — no Garnish code changes.
- [ ] State survives crash/reinstall: deleting the state file and replaying the event
      log reproduces identical progression.

## Proof plan

Highest seam first: end-to-end through the real CLI + a real Garnish-owned Pi install
wherever cheap. Hermetic runs use `PI_CODING_AGENT_DIR` pointed at a temp dir — no host
config touched.

- **E2E happy path (scripted):** temp agent dir, run `garnish init` non-interactively
  (answers piped), assert the certified Pi build is installed, config generated, L0
  active; complete quests by producing the real artifacts (key config, recorded
  extension-event fixtures), assert auto-verification, unlock, and status output. This
  one test covers criteria 1, 2, 4, 5.
- **Verifier unit matrix:** each verifier type (event/file/json-path/exit-code/
  git/mcp-handshake) against positive and negative fixtures. Covers criterion 3.
- **Gate diff test:** render adapter config at each level; snapshot-diff shows locked
  features absent and monotonically appearing; `unlock --all` output equals stock
  config. Covers criteria 4, 6.
- **Tutor bridge test:** assert `APPEND_SYSTEM.md` framing present after init; unit-test
  the `context`-event injection with a fake message list; one live-agent smoke asking
  "what's my quest" (manual or recorded). Covers criterion 7.
- **Pack conformance:** load a fixture third-party pack; schema-validate; quests appear
  in `status`. Covers criterion 8.
- **Replay test:** run a scripted progression, snapshot state, delete state file,
  replay log, compare. Covers criterion 9.
- **Adapter contract pin:** the Pi adapter's assumptions (event names, config keys,
  extension API shape) asserted against the pinned Pi version in CI, so harness drift
  fails loudly instead of silently breaking quests.

## Open questions

1. ~~**Pi extension surface fidelity**~~ — *resolved by surface audit (see ARD §2):*
   all v1 gates are hard-expressible (tool toggles + `setActiveTools`, `includeSkills`,
   `disabledServers`/`mcp.json`, `disabledExtensions`).
2. ~~**Restart ergonomics**~~ — *resolved:* tool unlocks apply live via
   `setActiveTools`; config-baked changes (skills list) apply via the extension calling
   `reload()` — automatic either way.
3. ~~**Capstone rubric**~~ — *resolved:* deterministic checklist for v1. The capstone
   decomposes into existing check types (`skill_valid` + skill-read event, `git`
   commit predicates, `command` run-check, `mcp_handshake`, `task`-tool event) plus
   explicitly self-confirmed items. LLM-graded rubric deferred to v2.
4. ~~**Naming/theme**~~ — *resolved:* **gamer-native** (kitchen and borrowed-metaphor
   themes rejected). Vocabulary map lives in the Curriculum section. Standing rule: a
   themed term never travels alone — UI pairs it with the functional word; CLI verbs
   stay functional with themed aliases.

None open. Next unresolved decisions will be logged here.
