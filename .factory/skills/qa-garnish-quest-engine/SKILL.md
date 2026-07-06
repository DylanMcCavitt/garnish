---
name: qa-garnish-quest-engine
description: >
  Functional QA for Garnish quest loading, verification, progression folding,
  and core pack behavior.
---

# Garnish Quest Engine QA

Use this sub-skill when changes touch `src/core/**`, `src/loader/**`, `src/progression/**`, `src/verifier/**`, or `packs/core/**`.

Use the `droid-control` skill for any terminal interactions. This surface is mostly library behavior, so QA should verify behavior through the CLI or a small Bun one-liner only when direct user-facing commands cannot expose the changed behavior.

## App Notes

- Core pack path: `packs/core/**`.
- Loader entrypoint: `src/loader/index.ts`.
- Verifier entrypoint: `src/verifier/index.ts`.
- Progression folding entrypoint: `src/progression/index.ts`.
- User-facing proof should prefer `garnish status`, `garnish quest`, and unlock behavior over internal assertions.

## Flow Menu

Select only flows relevant to the diff.

### Flow A: Pack Load and Display

1. Load core packs through the normal CLI/init path or a minimal Bun harness.
2. Verify all expected L0, L1, and L2 packs load.
3. Verify `garnish quest` shows active quest text and checks from the loaded packs.

### Flow B: Invalid Pack Rejection

1. Use fixture-like invalid pack data when the diff touches loader/schema behavior.
2. Verify broken packs fail atomically.
3. Verify error output identifies the invalid pack or quest without partial state writes.

### Flow C: Progression Folding

1. Prepare event streams for session start, assistant reply, file/tool checks, and unlock events.
2. Verify XP, completed quests, completed levels, badges, and unlock set fold correctly.
3. Verify skipped/speedrun unlocks do not award XP.

### Flow D: Verifier Checks

1. Exercise changed check types through real quest definitions.
2. Verify file, YAML, JSON, command, git, event, or wildcard checks pass and fail as intended.
3. Include one negative check proving false positives are rejected.

### Flow E: Pack Content Regression

1. Display changed quest content through `garnish quest` or a loader harness.
2. Verify descriptions, XP, required flags, and checks match the intended learning path.
3. Confirm downstream status/unlock behavior remains coherent.

## Evidence

- Capture CLI output for `status`, `quest`, and unlock behavior when possible.
- For library-only checks, include the Bun command or harness output and explain why no CLI-visible path exists.
- Include negative-test evidence for schema or verifier changes.

## Known Failure Modes

1. **Library-only diff with no terminal-visible behavior.** Use a minimal Bun harness and mark the app as quest-engine, not CLI smoke.
2. **Fixture path drift.** If a fixture moved or was renamed, report BLOCKED with the missing path and the closest current fixture path.
3. **Pack schema failures.** Treat schema failures as FAIL if caused by changed pack content, BLOCKED only if the QA harness cannot locate the intended fixture.
