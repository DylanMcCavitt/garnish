# Testing

Garnish uses `bun:test` with a fixture-driven proof plan. The test suite is nearly as large as the source (4850 test lines against 5481 source lines, a 0.89:1 ratio), reflecting the verifier matrix and the hermetic E2E happy path that proves the PRD acceptance criteria. The test root is `tests/`, configured in `bunfig.toml`.

## How to run

```bash
bun test                  # full unit suite
bun run test:e2e          # scripted E2E happy path only (bun test tests/e2e/)
bun run typecheck         # static gate (tsc --noEmit)
```

There is no separate command for adapter, loader, or progression suites; `bun test` runs everything under `tests/`. To run one file, pass the path: `bun test tests/core/checks.test.ts`.

## Test layout

The unit tests mirror the source structure under `src/`:

| Test directory | Covers |
| --- | --- |
| `tests/core/` | `src/core/` schemas, the check DSL discriminated union, type-level assertions |
| `tests/adapter/` | `src/adapter/` runtime, gates, contract |
| `tests/loader/` | `src/loader/` pack discovery, frontmatter parsing, graph building, cycle detection |
| `tests/verifier/` | `src/verifier/` check evaluation, JSONPath, predicates, scheduler |
| `tests/progression/` | `src/progression/` fold scenarios, unlock derivation, badge computation, determinism |
| `tests/cli/` | `src/cli/` command cores (status, quest, unlock, doctor, init) |
| `tests/extension/` | `src/extension/` event wiring, HUD, unlocks, tutor |
| `tests/packs/` | the shipped core packs (L0, L1, L2) against the loader |
| `tests/e2e/` | the scripted E2E happy path |
| `tests/smoke.test.ts` | core entry point smoke (the placeholder version export) |

## Dependency injection makes cores testable

The reason the command cores and engines run as fast unit tests is dependency injection. Each subsystem defines an effects interface and accepts it as a dependency; tests pass fakes. The composition roots (`src/cli/real.ts`, `src/extension/entry.ts`) are the only places that bind to the real filesystem and child processes.

- `CliDeps` (`src/cli/index.ts`) — the dependency slice for `status`, `quest`, `unlock`: graph, quests, store, now, catalog, runtimePaths, gateEffects.
- `Probes` (`src/verifier/index.ts`) — wraps `fileExists`, `readFile`, `runCommand`, `mcpHandshake`, `skillValid`, `confirm`.
- `RuntimeEffects` (`src/adapter/types.ts`) — wraps `exists`, `mkdirp`, `installRuntime`, `execFile`.
- `GateConfigEffects` (`src/adapter/gates.ts`) — wraps `mkdirp`, `writeFile`, and an optional `readFile` for non-owned key preservation.
- `InitFsEffects` (`src/cli/init.ts`) — wraps `mkdirp`, `writeFile`, `copyDir`, `appendFile`.
- `ProgressionStore` (`src/cli/index.ts`) — wraps `readEvents`/`appendEvents`.

See [patterns and conventions](patterns-and-conventions.md) for the full effects inventory.

## Hermetic E2E

The scripted E2E happy path at `tests/e2e/happy-path.test.ts` runs the full flow, init through L0 completion to unlock, without a real `omp` on PATH and without network or real model calls. It:

1. Creates a fresh temp agent dir (never touches `~/.omp`).
2. Writes a stub shell script that reports `omp/16.2.13` and sets `GARNISH_OMP_SOURCE` to it, so `ensureRuntime` installs a "certified" binary without a real download.
3. Runs `garnish init` non-interactively through a `queuedPrompter` (answers piped).
4. Drives the bundled extension with a fake `Pi` (event emitter plus recorded `ctx.ui` calls) fed by recorded event fixtures from `tests/e2e/fixtures/l0-session.jsonl`.
5. Asserts auto-verification, unlock application, and status/quest output.

This keeps CI hermetic: no host-global omp dependency, no network, no real model calls. The recorded fixtures keep the fake Pi honest about real event shapes.

## PRD acceptance criterion proof pattern

The E2E test names the PRD acceptance criterion that regressed on failure. A small helper at the top of `tests/e2e/happy-path.test.ts` wraps each assertion:

```ts
type PrdCriterion = "AC-1" | "AC-2" | "AC-4" | "AC-5";

function prove(ac: PrdCriterion, detail: string, condition: boolean): void {
  if (!condition) {
    throw new Error(`PRD ${ac} regressed: ${detail}`);
  }
}
```

This single test covers PRD AC-1 (init on a clean machine), AC-2 (auto-complete within 10s), AC-4 (locked features absent until unlock), and AC-5 (`status` rendering).

## Type-level assertions

`tests/core/checks.test.ts` verifies that the TypeScript domain types match the Zod schemas at compile time. A pair of conditional types, `Equal` and `Assert`, produce a compile error if a schema drifts from its inferred type:

```ts
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
  ? (<T>() => T extends Right ? 1 : 2) extends <T>() => T extends Left ? 1 : 2
    ? true
    : false
  : false;

type Assert<T extends true> = T;

type CheckTypeMatchesSchema = Assert<Equal<Check, z.infer<typeof CheckSchema>>>;
type QuestTypeMatchesSchema = Assert<Equal<Quest, z.infer<typeof QuestSchema>>>;
type LevelTypeMatchesSchema = Assert<Equal<Level, z.infer<typeof LevelSchema>>>;
type PackTypeMatchesSchema = Assert<Equal<Pack, z.infer<typeof PackSchema>>>;
type ProgressionEventTypeMatchesSchema = Assert<Equal<ProgressionEvent, z.infer<typeof ProgressionEventSchema>>>;
```

If someone changes a Zod schema without updating the exported type (or vice versa), `tsc --noEmit` fails. This is why typecheck is the static gate.

## Verifier matrix

The verifier tests exercise each check type (`event`, `file_exists`, `json_path`, `yaml_path`, `command`, `git`, `mcp_handshake`, `skill_valid`, `confirm`) against positive and negative fixtures. A check must pass on genuine completion and fail on absence, per PRD AC-3. The closed check DSL is documented in [patterns and conventions](patterns-and-conventions.md) and the check types are enumerated in `src/core/checks.ts`.

## Replay and determinism

The progression tests include a replay check: run a scripted progression, snapshot the state, delete the state file, replay the event log, and compare. `replayProgression` in `src/progression/index.ts` folds the same events twice and compares the JSON as a self-check that the fold is deterministic. This proves PRD AC-9 (state survives crash/reinstall).

## Gate parity and monotonicity

The adapter gate tests render config at each level and snapshot-diff to show locked features absent and monotonically appearing. `stockParityConfig` and `compareStockParityConfig` in `src/adapter/gates.ts` assert that `unlock --all` produces effective parity with a stock install. `findGateMonotonicityViolations` verifies across a sequence of renders that capabilities are only ever added, never removed.

See [patterns and conventions](patterns-and-conventions.md) for the cross-cutting patterns and [tooling](tooling.md) for the CI workflows that run these tests on every push and PR.
