# Patterns and conventions

How Garnish code is structured and the conventions it follows. These patterns appear across every subsystem.

## Dependency injection with effects interfaces

Command cores and engines never touch the filesystem, child processes, or the network directly. Each subsystem defines an effects interface and accepts it as a dependency. The composition root is the only place that binds to the machine.

- `RuntimeEffects` (`src/adapter/types.ts`) wraps `exists`, `mkdirp`, `installRuntime`, `execFile`.
- `GateConfigEffects` (`src/adapter/gates.ts`) wraps `mkdirp`, `writeFile`, `readFile`.
- `InitFsEffects` (`src/cli/init.ts`) wraps `mkdirp`, `writeFile`, `copyDir`, `appendFile`.
- `Probes` (`src/verifier/index.ts`) wraps `fileExists`, `readFile`, `runCommand`, `mcpHandshake`, `skillValid`, `confirm`.
- `ProgressionStore` (`src/cli/index.ts`) wraps `readEvents`, `appendEvents`.

The real bindings live in `src/cli/real.ts` (CLI side) and `src/extension/entry.ts` (extension side). Tests pass fakes. This is why the command cores in `src/cli/index.ts` run as fast unit tests without a filesystem.

## Zod schemas with branded types

Every domain ID is a Zod-branded type defined in `src/core/ids.ts`:

```ts
export const QuestIdSchema = z.string().min(1).regex(slugPattern, "...").brand<"QuestId">();
```

The branded types (`QuestId`, `LevelId`, `PackId`, `FeatureId`) prevent accidental mixing of ID kinds at compile time. Pack metadata, quest definitions, and progression events all use these schemas for validation at load time. The check DSL is a Zod discriminated union on the `type` field (`src/core/checks.ts`), so unknown check types fail with a clear message listing the valid types.

## Append-only event log as source of truth

State is never mutated in place. The event log at `{agent_dir}/garnish/events.jsonl` is the source of truth. `foldEvents` in `src/progression/index.ts` is a pure function that replays the log into a `ProgressionState`. Unlocks are derived, not stored: `deriveUnlocks` computes which unlock events to append after a quest completion. This makes state crash-safe, auditable, and replayable.

## Monotonic unlocks

Capabilities are only ever added, never removed. Three layers enforce this:

1. `findGateMonotonicityViolations` in `src/adapter/gates.ts` detects regressions across a sequence of rendered configs.
2. `registerLiveUnlocks` in `src/extension/unlocks.ts` tracks applied capabilities in a `Set` and only applies fresh ones.
3. `stockParityConfig` and `compareStockParityConfig` assert that `unlock --all` produces effective parity with a stock install.

## Generated config with stable ordering

`renderGateConfig` in `src/adapter/gates.ts` produces deterministic YAML and JSON. Object keys are sorted alphabetically, arrays are sorted, and a generated header warns against manual edits. Garnish owns specific arrays (listed in the `garnish.generated.arraysReplaceWholesale` marker) and replaces them wholesale on re-render. Non-owned keys (like `providers` with the learner's `apiKeyRef`) are preserved through a read-merge-write path in `writeGateConfig`.

## Try/catch every extension handler

The extension runs in-process and unsandboxed. A Garnish crash is a harness crash. Every event handler in `src/extension/index.ts` wraps in a top-level try/catch. On failure, the extension pauses quests and notifies the learner rather than throwing into the session. `garnish doctor` is the recovery route. The entry composition root in `src/extension/entry.ts` returns `{ active: false, reason }` instead of throwing when the Garnish dir is unprovisioned or corrupt.

## Spike-driven development

Before building against an external API, Garnish runs a research spike to prove the surface. The `spikes/pi-extension-api/` directory holds the LOO-118 spike that captured real omp 16.2.13 event shapes, HUD call signatures, and `setActiveTools` behavior. Code comments reference these captures (e.g. "LOO-118 capture 11", "LOO-139 live walkthrough") when a shape is non-obvious or differs from documentation.

## Synchronous extension initialization

The bundled extension module must initialize synchronously. `src/extension/entry.ts` reads pre-serialized JSON (`graph.json`, `quests.json`, `state.json`) with `readFileSync` instead of async `readFile`. The tutor bridge skips context injection for async stores rather than stalling the model call. This constraint was proven by the LOO-118 spike: async module init loads as nothing.

## Path templates in checks

Quest checks reference paths with `{agent_dir}` and `{sandbox}` placeholders. The verifier resolves these against `EvaluationContext.paths` in `resolveTemplate` (`src/verifier/index.ts`). This keeps packs portable across different Garnish roots.

## Error handling style

Errors are thrown with actionable messages that name the file and the failure. Pack validation errors in `src/loader/index.ts` include the pack ID, the quest file path, and the Zod issue path. Runtime errors in `src/adapter/runtime.ts` tell the learner exactly what to do (e.g. "Set `GARNISH_OMP_SOURCE` to a binary of the certified version to install anyway").

## Naming

- File names: lowercase with hyphens for wiki and docs; `index.ts` barrel files in each source directory.
- Pack directories: `l{N}-{slug}` so lexicographic sort equals level order.
- Quest IDs: lowercase slugs (`install-certified-pi`).
- Feature IDs: lowercase keys with dots or colons (`tool:file`, `context`, `skills`).
- Commit prefixes: `[feat]:`, `[fix]:`, `[docs]:`, `[chore]:` with the Linear issue ID when one exists (`LOO-123`).

See [testing](testing.md) for test patterns and [tooling](tooling.md) for the build system.
