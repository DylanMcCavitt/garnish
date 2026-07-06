---
name: qa-garnish-cli
description: >
  Functional QA for the Garnish CLI. Tests first-run setup, doctor/status/quest,
  unlock commands, and terminal-facing progression behavior with tuistory.
---

# Garnish CLI QA

Use this sub-skill when changes touch `src/bin.ts`, `src/cli/**`, `src/adapter/**`, core progression paths, packs, or E2E fixtures.

Use the `droid-control` skill for all `tuistory` interactions.

## App Notes

- Runtime: Bun + TypeScript.
- Command: `bun run garnish`.
- Isolate all QA state with temp dirs:
  - `GARNISH_ROOT`
  - `PI_CODING_AGENT_DIR`
  - `HOME`
  - `OMP_AUTH_BROKER_SNAPSHOT_CACHE`
- Never use the user's real `~/.garnish` or `~/.omp`.
- In CI, prefix interactive launches with `env -u CI FACTORY_DISABLE_KEYRING=true`.

## Flow Menu

Select only flows relevant to the diff.

### Flow A: Usage and Unknown Command

1. Launch `bun run garnish` with no command.
2. Verify usage lists `status`, `quest`, `unlock`, `cheat`, and `doctor`.
3. Run an unknown command.
4. Verify exit code `2` and usage output.

### Flow B: Doctor Before and After Setup

1. Use a fresh isolated `GARNISH_ROOT`.
2. Run `bun run garnish -- doctor`.
3. Verify missing runtime/config guidance is actionable.
4. If a hermetic OMP source is available, complete init and rerun doctor.
5. Verify doctor reports installed runtime, version handshake, and isolated config status.

### Flow C: First-run Init

1. Launch `bun run garnish -- init`.
2. Answer provider, speedrun, and sandbox prompts.
3. Verify no more than five prompts are needed.
4. Verify the generated config stores provider env var references only, never raw keys.
5. Verify packs and extension files are installed under the isolated Garnish-owned agent dir.

### Flow D: Status and Quest

1. Run `bun run garnish -- status`.
2. Verify current level, XP, badges, level sections, next marker, and completed markers.
3. Run `bun run garnish -- quest`.
4. Verify active quest title, XP, description, and checks render.

### Flow E: Unlock and Cheat

1. Run `bun run garnish -- unlock` without options.
2. Verify exit code `2` and the message requiring `--all` or `--level`.
3. Run `bun run garnish -- unlock --level 1`.
4. Verify the unlock summary and no-XP speedrun warning.
5. Run `bun run garnish -- cheat --all`.
6. Verify `cheat` behaves as an unlock alias.

### Flow F: L0 Happy Path Replay

1. Use a fresh temp state and the `tests/e2e/fixtures/l0-session.jsonl` event stream as behavioral reference.
2. Simulate session start, first assistant reply, second turn, status check, and unlock application.
3. Verify L0 progress, XP, and unlock behavior match the expected Tutorial Island path.
4. Verify no user-owned Pi/OMP state is touched.

## Evidence

- Capture terminal snapshots after each command that verifies behavior.
- Include exit codes and relevant state file paths in notes.
- Screenshots are optional unless layout rendering changed.

## Known Failure Modes

1. **Missing tuistory.** Report BLOCKED and instruct `npm install -g tuistory`.
2. **No hermetic OMP runtime or stub.** Init and doctor-after-setup flows are BLOCKED. Other CLI flows may still run if they do not require runtime installation.
3. **State contamination risk.** If temp env vars are not set, stop and report BLOCKED rather than touching real user state.
