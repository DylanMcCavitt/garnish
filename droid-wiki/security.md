# Security

Garnish is local-first with no network calls in v1, no accounts, and no telemetry backend. The security posture is built on isolation, secret-by-reference, sandbox-first quest targets, and packs-as-data. The trust boundaries, secret handling, input validation, and isolation mechanisms are documented here.

## Trust boundaries

| Boundary | What crosses it | Control |
| --- | --- | --- |
| Garnish-owned storage vs. learner's real config | The certified binary, agent config, event log, state | `PI_CODING_AGENT_DIR`, `HOME`, `OMP_AUTH_BROKER_SNAPSHOT_CACHE` set in the launch spec; `assertGarnishOwnedPaths` and `assertGateWritePathUnderAgentDir` enforce path containment |
| Quest pack data vs. harness process | Pack files loaded into the extension process | Packs are data, not code; the only executable surface is the `command` check; core pack only in v1; third-party packs get a load-time warning |
| Sandbox dir vs. learner's real projects | Quest operations (file edits, git, commands) | Quests target a scaffolded sandbox dir, never an existing project by default |
| Provider key material vs. Garnish storage | The API key that powers the agent | Referenced by env-var name only; raw keys are never persisted |

## Secrets handling

Garnish never persists raw provider keys. The `garnish init` wizard in `src/cli/init.ts` asks for a provider (anthropic, openai, or `other:<ENV_VAR>`) and stores only the env-var reference in the generated `config.yml`:

```yaml
providers:
  anthropic:
    apiKeyRef: ANTHROPIC_API_KEY
```

The `apiKeyRef` field holds the variable name, not the key. Pi's own `${VAR}` indirection in `mcp.json` resolves the env var at runtime. This is a PRD house rule and non-goal: Garnish never proxies model calls and never persists raw keys.

The LOO-118 spike probe (`spikes/pi-extension-api/index.js`) redacts secret-like keys when recording event captures. The `isSecretKey` function matches `token`, `secret`, `api[-_]?key`, `authorization`, `password`, `credential`, `cookie` (case-insensitive), and `safeJson` replaces matching values with `[REDACTED_BY_SPIKE]` before writing to the JSONL log. This keeps the recorded captures in `spikes/pi-extension-api/captures/` safe to commit.

## Sandbox-first

Quests target a disposable sandbox directory, not the learner's real projects. `garnish init` scaffolds a sandbox dir (default `<garnish root>/sandbox`) and launches the certified binary with `cwd` set to it. Approval-mode lessons and destructive-command mistakes land in disposable territory. The learner opts out only by explicitly pointing the sandbox elsewhere.

## Isolation

Garnish never touches the learner's real harness config. All state lives under a Garnish-owned storage root (default `~/.garnish`, overridable via `GARNISH_ROOT`). `createLaunchSpec` in `src/adapter/runtime.ts` sets three env vars on every launched session:

- `PI_CODING_AGENT_DIR` — points the certified binary at the Garnish-owned agent dir (config, extensions, auth stores).
- `HOME` — overridden to the Garnish-owned `home/` dir.
- `OMP_AUTH_BROKER_SNAPSHOT_CACHE` — pointed at the Garnish-owned auth snapshot path.

The learner's real `~/.omp` is never read or rewritten. Two path-escape assertions enforce containment:

- `assertGarnishOwnedPaths` in `src/adapter/runtime.ts` verifies every computed runtime, agent, home, and auth path stays under the Garnish root.
- `assertGateWritePathUnderAgentDir` in `src/adapter/gates.ts` verifies every config write stays under the agent dir.

See [Pi adapter](systems/adapter.md) for the runtime and gate internals, and [configuration](reference/configuration.md) for the storage layout.

## Packs are data, not code

A pack is a directory of YAML and Markdown files, validated against Zod schemas at load. The only executable surface a pack touches is the `command` check, which runs a pack-declared command. In v1, only the core pack ships in-repo, so every `command` check is trusted. Third-party packs get a load-time warning listing every `command` check before first activation (ADR-3 consequence). Arbitrary JS verifiers in packs were rejected as an alternative because they would run unsandboxed third-party code inside the harness process.

See [pack loader](systems/loader.md) for the validation and cycle detection, and [design decisions](background/design-decisions.md) (ADR-3) for the rationale.

## Extension is unsandboxed by platform design

The Pi extension runs in-process and unsandboxed (ADR-1 consequence). A Garnish crash would be a harness crash. The mitigation is structural: every event handler in `src/extension/index.ts` wraps in a top-level try/catch; verification work is queued off the hot path; failure degrades to "quests paused" rather than throwing into the session. The entry composition root in `src/extension/entry.ts` returns `{ active: false, reason }` instead of throwing when the Garnish dir is unprovisioned or corrupt. See [patterns and conventions](how-to-contribute/patterns-and-conventions.md) and [debugging](how-to-contribute/debugging.md).

## No network calls in v1

Garnish ships no network calls at all in v1. Pack installs are file and git operations the user runs. The certified runtime is a binary copied from a local source (`GARNISH_OMP_SOURCE` or PATH), not a download driven by the extension. There is no telemetry backend, no accounts, and no server. See [dependencies](reference/dependencies.md) for the external integrations.

## Input validation

Pack files are validated against Zod schemas at load time. The check DSL is a Zod discriminated union on the `type` field (`src/core/checks.ts`), so unknown check types fail with a clear message listing the valid types. Pack validation errors in `src/loader/index.ts` include the pack ID, the quest file path, and the Zod issue path. The adapter contract in `src/adapter/contract.ts` pins the Pi surface facts (event names, config keys, isolation boundaries) and `assertAdapterContract` fails fast if a refactor drifts from the certified surface.

## Generated config containment

Garnish owns specific arrays in the generated config (listed in the `garnish.generated.arraysReplaceWholesale` marker: `disabledExtensions`, `disabledProviders`, `skills.includeSkills`, `mcp.disabledServers`) and replaces them wholesale on re-render. Non-owned keys (like `providers` with the learner's `apiKeyRef`) are preserved through a read-merge-write path in `writeGateConfig`. Generated files carry a `# Generated by Garnish` header warning against manual edits. The learner's global Pi config is never read or rewritten. See [Pi adapter](systems/adapter.md) and [design decisions](background/design-decisions.md) (ADR-5).

## Cross-references

- [Pi adapter](systems/adapter.md) — runtime isolation, path assertions, generated config.
- [Design decisions](background/design-decisions.md) — ADR-3 (packs as data, no LLM grading), ADR-5 (generated config, monotonic gating), ADR-9 (certified runtime, isolation).
- [Configuration](reference/configuration.md) — storage layout, env vars, generated config structure.
- [Debugging](how-to-contribute/debugging.md) — recovery from paused states.
