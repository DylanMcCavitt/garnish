# Quest Inventory — Garnish Core Pack

> Status: draft v1 · Feeds PRD M0/M3 schema work.
> Theme: gamer-native. Functional names stay visible beside themed names.

## Economy rules

- **Required quests unlock levels.** XP is score/feedback, not a gate.
- **Optional quests award badges.** Completionist = all optional quests in the core pack.
- **Speedrun mode** skips gates but does not auto-award XP; a Speedrunner badge is earned
  only if the user later clears skipped required quests.
- **No-Hint Clear** applies per level when all required quests pass without opening hints.

Suggested score scale:

| Quest type | XP |
|---|---:|
| Setup / awareness | 10 |
| Core mechanical action | 15 |
| Authored artifact or integration | 20–25 |
| Automation / multi-step workflow | 25–35 |
| Final Boss | 100 |

## Check notation

This inventory uses the v1 check DSL from the ARD:

- `event` — match extension-observed event(s): session, turn, tool call/result, command,
  approval, subagent/job where Pi exposes it.
- `file_exists` — path exists under the sandbox or Garnish agent dir.
- `json_path` / `yaml_path` — structured config assertion.
- `command` — deterministic command exit/stdout check.
- `git` — clean tree, commit count, branch, diff state.
- `mcp_handshake` — MCP server responds to test/list.
- `skill_valid` — `SKILL.md` frontmatter and discovery check.
- `confirm` — explicit user confirmation for checklist items no artifact can prove.

## L0 — Tutorial Island (Onboarding)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `install-certified-pi` | Install the game engine | Yes | 10 | Garnish owns a certified Pi runtime; learner's global `omp` is ignored | `event(session_start)`, `json_path({agent_dir}/garnish/state.json $.runtime.certifiedVersion)` |
| `connect-agent` | Player 1 connected | Yes | 20 | Provider/key setup; first model round trip | `event(agent_end minAssistantTurns=1)`, `yaml_path(config.yml provider key ref exists)` |
| `second-turn` | Continue from save | Yes | 10 | Sessions preserve conversation context | `event(turn_start count>=2 sameSession=true)` |
| `status-screen` | Open the menu | Optional | 10 | `garnish status` / `/quest` surfaces | `event(command name=/quest) OR command(garnish status exit=0)` |

## L1 — First Quest (Core agent loop)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `first-file` | Loot drop: first file | Yes | 15 | Ask the agent to create a sandbox file | `event(tool_result tool=write success=true)`, `file_exists({sandbox}/first-file.*)` |
| `first-edit` | Patch the item | Yes | 15 | Ask the agent to edit an existing file | `event(tool_result tool=edit success=true)`, `git(diffContains={sandbox}/first-file.*)` |
| `run-command` | Press the action button | Yes | 15 | Agent runs a command and reads output | `event(tool_result tool=bash exitCode=0)` |
| `explain-diff` | Read the quest log | Optional | 10 | Ask for an explanation before accepting changes | `git(dirty=true)`, `event(agent_end after gitDirty=true)` |
| `revert-change` | Undo potion | Yes | 15 | Revert an unwanted change instead of piling fixes on top | `event(tool_result tool=edit success=true)`, `git(cleanTree=true OR fileRestored=true)` |
| `deny-once` | Assist mode | Optional | 10 | Approval boundaries; learner can say no | `event(approval_denied)`; fallback `confirm` if Pi approval-denied event is unavailable in spike |

## L2 — Lore (Context)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `project-lore-file` | Write the lore book | Yes | 20 | Create a project context file the agent can discover | `file_exists({sandbox}/AGENTS.md)`, `command(regex checks required convention text)` |
| `follow-a-rule` | Canon becomes gameplay | Yes | 20 | Agent follows a convention encoded in context | `event(tool_result tool=write OR edit)`, `command(assert generated file matches convention)` |
| `resume-run` | Load saved game | Yes | 15 | Resume/switch a prior session | `event(session_start resumed=true OR session_switch)` |
| `context-diet` | Inventory management | Optional | 10 | Trim bloated context before it becomes noise | `confirm`, `event(context sizeReduced=true)` if usage surface exists; otherwise optional confirm only |

## L3 — Skill Tree (Skills)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `use-starter-skill` | Equip a starter skill | Yes | 15 | Use a bundled/core skill deliberately | `event(read path matches skill://garnish-starter OR skills/garnish-starter/SKILL.md)` |
| `author-skill` | Unlock a node | Yes | 25 | Write a valid skill with name + description frontmatter | `skill_valid(path={agent_dir}/skills/*/SKILL.md)` |
| `trigger-own-skill` | Proc the skill | Yes | 20 | Skill triggers organically during a matching task | `event(read path matches authored SKILL.md during agent turn)` |
| `skill-command` | Hotkey the skill | Optional | 10 | Use `/skill:<name>` where enabled | `event(command name matches /skill:*)` |

## L4 — Loadout (MCP + extensions)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `add-safe-mcp` | Equip a tool | Yes | 20 | Add a safe MCP server through config or `/mcp add` | `mcp_handshake(server=garnish-demo OR configuredSafeServer)` |
| `use-mcp-tool` | Use the equipped item | Yes | 20 | Invoke an MCP-provided tool during a real task | `event(tool_call source=mcp server=configuredSafeServer)` |
| `env-var-secret` | Hidden stats | Optional | 15 | Configure secret references by env-var name, not raw values | `json_path(mcp.json env contains variable name)`, `command(assert no secret literal pattern)` |
| `install-extension` | Install a mod | Optional | 15 | Install/enable a Pi extension or plugin | `yaml_path(config.yml extensions includes safe extension)`, `event(session_start extensionLoaded=true)` |

## L5 — The Party (Subagents)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `first-delegation` | Invite a party member | Yes | 20 | Delegate one bounded task to a subagent | `event(tool_call tool=task tasks.length=1)`, `event(tool_result tool=task success=true)` |
| `parallel-party` | Co-op run | Yes | 25 | Run two independent subagents in one fanout | `event(tool_call tool=task tasks.length>=2)` |
| `integrate-party-work` | Don't AFK the party | Yes | 15 | Review subagent output and apply/decline it deliberately | `event(tool_result tool=task)`, `event(tool_result tool=edit OR write after taskResult sameSession=true)` |
| `cancel-or-redirect` | Party wipe recovery | Optional | 10 | Cancel or redirect a bad async job | `event(tool_call tool=job action=cancel OR irc/send correction)` |

## L6 — Macros (Automation)

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `headless-run` | Run a macro | Yes | 20 | Launch a scripted/headless harness task | `command(garnish run fixture exits 0)`, `event(ui noop headless=true)` |
| `review-loop` | Build a loop | Yes | 25 | Run agent → validate artifact → rerun/fix on failure | `file_exists({sandbox}/scripts/agent-loop.*)`, `command(script exits 0)` |
| `budget-stop` | Mana budget | Yes | 20 | Configure a tool/loop budget so runaway work terminates | `yaml_path(config budget exists)`, `event(session_stop reason=budget OR tool_budget_exceeded)` |
| `ci-hook` | Daily quest | Optional | 15 | Wire a harness task into CI or a git hook | `file_exists(.github/workflows/* OR .git/hooks/*)`, `command(validate config)` |

## L7 — Final Boss (Capstone)

One required capstone quest, checklist-verified. No LLM grading in v1.

| ID | Name | Req | XP | Teaches | Checks |
|---|---|---:|---:|---|---|
| `final-boss` | Ship the build | Yes | 100 | Compose skills + MCP + subagents + automation into a small working project | `skill_valid`, `event(read authored skill during capstone)`, `event(tool_call source=mcp)`, `event(tool_call tool=task)`, `command(project run exits 0)`, `git(commit_count>=5)`, `file_exists(README.md)`, `confirm(usefulSkillKept=true)`, `confirm(subagentOutputReviewed=true)` |

## DSL findings from inventory

These findings feed M0 before the schema freezes:

1. **Event ordering is enough; no full workflow language.** Some quests need "event B
after event A in the same session" (`integrate-party-work`, `explain-diff`). Add simple
`after:` / `sameSession:` predicates to `event`; do not add arbitrary scripts.
2. **Approval-denied visibility is spike-gated.** `deny-once` is optional until the Pi
extension spike confirms whether approval denial is observable. If not, keep it as a
`confirm` quest.
3. **Usage/context stats are not v1-critical.** `context-diet` remains optional and can
degrade to `confirm`. Hard Mode owns precise `usage_stat` checks later.
4. **Capstone composition remains deterministic.** The Final Boss proves composition by
co-occurrence of real artifacts/events in one capstone session, plus two explicit
self-confirmed checklist items. No LLM judge.
