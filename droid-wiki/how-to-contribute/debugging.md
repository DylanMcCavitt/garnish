# Debugging

Garnish is designed to fail loudly at the static gate and degrade safely at runtime. The extension wraps every event handler in a top-level try/catch and pauses quests rather than crashing the session, so most runtime problems surface as "quests paused" plus a `garnish doctor` hint. This page is the troubleshooting runbook.

## garnish doctor

`garnish doctor` (`src/cli/index.ts`) checks three things and prints a guidance line for each failure:

1. **Certified runtime installed** — `existsSync(binaryPath)` against `runtime/pi/omp-16.2.13/bin/omp` under the Garnish root.
2. **Version handshake ok** — `handshake(reportedVersion())` compares the running binary's reported version to `certifiedVersion` (`16.2.13`).
3. **Isolated Garnish config present** — `config.yml` under the Garnish-owned agent dir.

Each failed check lowers the exit code to 1 and appends a `→` guidance line pointing at `garnish init` or `garnish unlock --level 0`. See [CLI commands](../systems/cli/commands.md) for the full doctor logic.

## Version mismatch

When the installed binary reports a version other than `16.2.13`, `handshake` in `src/adapter/runtime.ts` returns a `paused` status with a doctor message from `runtimeMismatchDoctor`:

```
Garnish quests are paused because Pi reported <version>, but this Garnish release is certified for 16.2.13.
Re-run `garnish init` or `garnish doctor` to reinstall the certified Pi runtime before continuing quests.
Launch Pi through Garnish so it uses the certified binary by absolute path instead of an `omp` found on PATH.
```

The fix is to re-run `garnish init`, which calls `ensureRuntime` with `forceInstall` to reinstall the certified binary, or to launch through Garnish so the session uses the certified binary by absolute path rather than an `omp` found on PATH.

## Pause-on-failure, not session crash

The extension runs in-process and unsandboxed (ADR-1 consequence). A Garnish crash would be a harness crash, so every event handler in `src/extension/index.ts` wraps in a top-level try/catch. On failure, the extension pauses quests and notifies the learner rather than throwing into the session. The entry composition root in `src/extension/entry.ts` returns `{ active: false, reason }` instead of throwing when the Garnish dir is unprovisioned or corrupt. `garnish doctor` is the recovery route from a paused state. See [patterns and conventions](patterns-and-conventions.md) for the try/catch pattern.

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `Garnish is not initialized (missing graph.json)` | The Garnish-owned agent dir has no `garnish/graph.json`; `garnish init` was never run or the storage root was wiped. | Run `garnish init`. |
| `No certified Pi runtime source found` | `ensureRuntime` could not find a binary reporting `16.2.13` to install, and `GARNISH_OMP_SOURCE` is not set. | Install `omp` v16.2.13 on PATH, or set `GARNISH_OMP_SOURCE` to a binary path reporting that version. |
| `Host omp reports X, certified for 16.2.13` | The source binary reports a version other than the certified one. | Install the certified version, or point `GARNISH_OMP_SOURCE` at a binary that reports `16.2.13`. |
| `Runtime path escapes Garnish root` | `assertGarnishOwnedPaths` detected a computed path outside the Garnish root. | This is an internal invariant violation; check `GARNISH_ROOT` and report it. |
| `Gate config path escapes Garnish agent dir` | `assertGateWritePathUnderAgentDir` detected a config write outside the agent dir. | Internal invariant violation; report it. |
| Extension dormant, no HUD or `/quest` | `PI_CODING_AGENT_DIR` is not set, so the certified binary is not loading the Garnish-owned agent dir. | Launch through `garnish init`, which sets `PI_CODING_AGENT_DIR` in the launch spec. |

## Spike captures as a debugging reference

The LOO-118 spike in `spikes/pi-extension-api/` proved the real omp 16.2.13 event shapes. The recorded captures in `spikes/pi-extension-api/captures/` are JSONL files of real events (autoload events and tools, reload command, approval deny and always-ask, isolation probes). When a check fails because an event shape does not match what the verifier expects, compare the live event against the matching capture. Code comments reference these captures (e.g. "LOO-118 capture 11", "LOO-139 live walkthrough") when a shape is non-obvious or differs from the published Pi docs. The LOO-139 live walkthrough found that real event shapes contradicted the docs (`toolName` not `tool`, a `messages[]` array instead of a turn count on `agent_end`); the captures reflect the corrected, observed shapes.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GARNISH_ROOT` | Points Garnish at a different storage root (default `~/.garnish`). Useful for running a second isolated install or for testing. |
| `GARNISH_OMP_SOURCE` | Points `ensureRuntime` at a binary to copy into Garnish-owned storage when no certified binary is already installed. |
| `GARNISH_BIN` | Override for the `garnish` shim location. |
| `PI_CODING_AGENT_DIR` | Set by `createLaunchSpec` in `src/adapter/runtime.ts` to the Garnish-owned agent dir so the certified binary loads isolated config. |
| `OMP_AUTH_BROKER_SNAPSHOT_CACHE` | Set by the launch spec to the Garnish-owned auth snapshot path. |
| `HOME` | Overridden by the launch spec to the Garnish-owned `home/` dir for launched sessions. |

See [configuration](../reference/configuration.md) for the full storage layout and env var reference, and [Pi adapter](../systems/adapter.md) for the runtime and handshake internals.

## Where to look in the source

- Runtime and handshake: `src/adapter/runtime.ts`
- Gate config rendering and write-path assertions: `src/adapter/gates.ts`
- Doctor command: `src/cli/index.ts` (`doctorCommand`)
- Extension event wiring and pause-on-failure: `src/extension/index.ts`
- Extension entry and dormant-state handling: `src/extension/entry.ts`
- Init wizard and provider key handling: `src/cli/init.ts`
