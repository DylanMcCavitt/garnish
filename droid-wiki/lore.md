# Lore

Garnish went from an empty directory to a working M2 build with three quest packs in four days. This page is the narrative history, dated from the git log and planning docs. For the decisions behind these events, see [design decisions](background/design-decisions.md); for where the project goes next, see [v2 direction](background/v2-direction.md).

## Era 1: Scaffold and core schemas (Jul 1, 2026)

The repo opened with planning docs (`20c525b`, `0c07318`) and a stamped Linear issue map covering LOO-116 through LOO-144 (`6c59a59`). The MIT license landed the same day (`39fe8ef`, closing LOO-116).

Then the code. `4fe7d33` scaffolded the TypeScript Bun package. In a single day the core landed: domain schemas for pack, quest, level, checks, ids, and progression events (`ca6f0e7`, `src/core/`), the certified Pi runtime adapter (`b1d857f`, `src/adapter/runtime.ts`), the progression event fold (`a03d75c`, `src/progression/index.ts`), the pack loader (`277db45`, `src/loader/index.ts`), the verifier engine (`74d55bf`, `src/verifier/index.ts`), and the Pi gate config renderer (`a51bcc7`, `src/adapter/gates.ts`). M0 was complete by end of day (`e8c200a`).

The LOO-118 spike findings were pinned the same day (`194fc95`), capturing real omp 16.2.13 event shapes that the adapter contract now rests on.

## Era 2: CLI and first quest packs (Jul 2, 2026)

Jul 2 opened with content and the out-of-session surface. `98cf77a` added the L0 Tutorial Island pack, `7c18322` the `garnish status`, `quest`, `unlock`, and `doctor` CLI, and `e5f7de7` the L1 First Quest pack. Then the in-session surface: `4fa0206` wired the Pi extension core events, `1bd925a` added the `garnish init` onboarding wizard, `f62fcbe` the HUD widget and status line with `/quest` commands, `136c32c` live unlock application and the reload flow, and `ec63474` the tutor bridge with context injection. M0 and M1 were complete, with 18 of 29 issues done (`527ba2d`).

## Era 3: L2 Lore and E2E proof (Jul 2, 2026)

Still on Jul 2, `e92243d` added the L2 Lore quest pack (context quests), and `be256a0` added the scripted E2E happy path test at `tests/e2e/happy-path.test.ts` covering init through L0 unlock to status. Wave 6 shipped (`b3fed26`).

## Era 4: Live walkthrough fixes (Jul 2, 2026)

A live walkthrough exposed that real omp 16.2.13 event shapes contradicted the published docs. `2cb1521` (LOO-139) fixed them: `toolName` not `tool`, a `messages[]` array instead of a turn count on `agent_end`, command spec objects instead of bare functions, stdin handoff to the launched TUI, and the native provider staying ungated. A runtime blocker resolved first (`778c655`, certified 16.2.13 source rebuilt). M2 was complete, 21 of 29 issues done (`38066f3`).

## Era 5: v2 planning and tooling (Jul 2-3, 2026)

The project's direction shifted. `91ef766` mapped the Garnish Standalone prospect (own harness and TUI) in the tracker. `3cc97f2` recorded the standalone-harness decision: own loop and TUI, omp dropped. `f207f29` recorded the standalone repo and v1-fate decisions. CI grew with `droid-review.yml` (`2e1a988`) and `droid.yml` (`17ff211`), merged via PR #20 (`0e39702`). The repo envelope and `AGENTS.md` agent strap were stamped (`ce89d79`), and the research spike doc was linked in the tracker (`32848df`). On Jul 3, the accepted v2 PRD and ARD were linked (`c9c96b3`) and stamped with LOO-155 through LOO-179 in the issue tracker (`9456e5d`).

## Longest-standing features

The core schemas from Jul 1 survive unchanged in shape: `src/core/ids.ts` (branded `QuestId`, `LevelId`, `PackId`, `FeatureId`), `src/core/checks.ts` (the closed check DSL), `src/core/quest.ts`, and `src/core/pack.ts`. The progression fold in `src/progression/index.ts` and the closed set of check types (`event`, `file_exists`, `json_path`, `yaml_path`, `command`, `git`, `mcp_handshake`, `skill_valid`, `confirm`) have not changed since M0.

## Deprecated features

`garnish eject` (post-credits loadout export) was specified in the v1 PRD and ARD but never implemented. v2 renames it "graduation / portable-loadout export" and marks "eject" a dead word in `.agents/envelope/domain.md`. The `omp`/Pi adapter itself is marked for deprecation in v2, superseded by Garnish's own harness. The dead-words list there (`omp`, `Pi adapter`, `certified runtime`, `omp extension`, `PI_CODING_AGENT_DIR`, `version handshake`, `eject`) survives only in frozen v1 maintenance context (LOO-148, LOO-149, LOO-150, paused or cancelled).

## Major rewrites

None yet. The repo is greenfield and four days old, so every module is on its first implementation. The v2 standalone-harness decision (Jul 2) will be the first major rewrite when it lands: it replaces the Pi adapter and extension with an owned agent loop and TUI.

## Growth trajectory

One contributor, 41 commits, four days. The pack count grew L0, then L0 and L1, then L0, L1, and L2. CI grew from one workflow (`ci.yml`) to four (`ci`, `qa`, `droid-review`, `droid`). The issue tracker moved from initial planning (LOO-116) through v1 delivery (LOO-139) into v2 planning (LOO-155 through LOO-179).
