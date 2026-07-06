---
name: qa-garnish-pi-extension
description: >
  Functional QA for the Garnish Pi/OMP extension harness, including HUD,
  slash command behavior, live unlocks, and tutor framing.
---

# Garnish Pi Extension QA

Use this sub-skill when changes touch `src/extension/**`, `src/adapter/**`, `src/cli/init.ts`, packs, or E2E extension fixtures.

Use the `droid-control` skill for all `tuistory` interactions.

## App Notes

- Extension entrypoint: `src/extension/entry.ts`.
- Public exports: `src/extension.ts`.
- Installed runtime path: `$PI_CODING_AGENT_DIR/extensions/garnish/index.js`.
- Extension state is read from `$PI_CODING_AGENT_DIR/garnish/graph.json`, `quests.json`, and `state.json`.
- Always use isolated temp dirs and a hermetic runtime/stub.

## Flow Menu

Select only flows relevant to the diff.

### Flow A: Extension Install and Load

1. Run the init flow with isolated env vars.
2. Verify `extensions/garnish/index.js` exists under the isolated Pi agent dir.
3. Import or trigger the installed extension entrypoint.
4. Verify it loads synchronously without async module initialization failures.

### Flow B: HUD Rendering

1. Prepare a state snapshot with an active level and quest graph.
2. Trigger the HUD/status rendering path.
3. Verify level, XP, active quest, and next action are visible.
4. Capture terminal or text evidence of the rendered HUD content.

### Flow C: Slash Commands

1. Trigger `/quest`.
2. Verify it renders the active quest and checks.
3. Trigger `/quest check`.
4. Verify completion status or actionable missing-check output.
5. Trigger `/unlock --level 1` when relevant.
6. Verify unlocked feature state and user-facing notification.

### Flow D: Live Unlocks and Gate Config

1. Start from locked L0 state.
2. Apply relevant progression events.
3. Verify unlocked features update active tool/gate config output.
4. Verify reload or refresh guidance is visible when required.

### Flow E: Tutor Framing

1. Run init into an isolated agent dir.
2. Verify tutor framing is appended through `APPEND_SYSTEM.md`.
3. Verify it does not replace default runtime instructions.

## Evidence

- Prefer text snapshots of rendered HUD, slash command output, and generated config snippets.
- Include exact temp paths used for isolation.
- If behavior depends on Pi/OMP runtime availability, record whether a certified runtime or stub was used.

## Known Failure Modes

1. **No certified Pi/OMP runtime or hermetic stub.** Runtime-driven flows are BLOCKED; pure import/render checks may still proceed.
2. **Extension loaded from wrong agent dir.** If `$PI_CODING_AGENT_DIR` is unset, stop and report BLOCKED.
3. **Async entrypoint regression.** If extension import requires async module work, report FAIL because the current harness expects synchronous startup.
