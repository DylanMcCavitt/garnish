# Design decisions

The nine ADRs in `docs/ard.md` shaped v1. Each is summarized here with the decision and rationale. Three are superseded for v-next by the Garnish Standalone decision (see [v2 direction](v2-direction.md)): ARD section 1 (the Pi-only context), ADR-8 (the Bun toolchain stays, but the single-package-three-entry-points shape changes), and ADR-9 (the certified Pi runtime). The rest, the curriculum, verification, progression, gating, and tutor decisions, survive into v2.

## ADR-1: Ship as Pi extension + thin CLI, not a wrapper process

**Decision.** Garnish is two artifacts sharing one core library: a Pi extension (quest engine, verification, HUD, unlock application, everything session-scoped) and a thin `garnish` CLI (init, status, unlock, doctor, everything outside a session).

**Rationale.** The extension API delivers exactly what a tutor needs: pre/post tool events without transcript scraping, per-call context injection without prompt-file races, live tool gating, native UI surfaces, and `reload()` for config-baked changes. A PTY-wrapper or log-tailing sidecar would rebuild all of that with worse fidelity and constant drift risk.

See [extension](../systems/extension/index.md) and [CLI](../systems/cli/index.md). The in-process, unsandboxed consequence is why every handler wraps in try/catch (see [patterns and conventions](../how-to-contribute/patterns-and-conventions.md)).

## ADR-2: HarnessAdapter seam, one implementation

**Decision.** All Pi-specific knowledge (certified runtime install path, config keys, event names, dir layout, `PI_CODING_AGENT_DIR` mechanics) lives behind one interface; curriculum, progression, and verification logic never import it directly.

**Rationale.** The seam costs little now (one implementation, deep interface) and is the difference between "port to another harness" being a v2 feature versus a rewrite. Deletion test: remove it and Pi key names smear across every module.

See [Pi adapter](../systems/adapter.md).

## ADR-3: Event-driven verification with declarative check DSL

**Decision.** Quests declare checks in a small closed DSL; the verification engine evaluates them from live extension events (primary) and on-demand probes (fs, json-path, git, command, mcp-handshake, skill-valid, confirm). No LLM-graded checks in v1.

**Rationale.** Deterministic, testable both directions (pass on genuine completion, fail on absence), no NLP on user behavior. Events give sub-second feedback; probes cover state produced outside a session. The closed set only grows by ADR amendment.

See [verification engine](../systems/verifier.md). The check types are enumerated in `src/core/checks.ts`. The v2 candidates (`usage_stat`, `quiz`) are noted in [v2 direction](v2-direction.md).

## ADR-4: Progression state = snapshot + append-only event log

**Decision.** Under the Garnish-owned agent dir: `garnish/state.json` (derived snapshot) plus `garnish/events.jsonl` (source of truth; every quest event, unlock, XP award appended). The snapshot is a pure fold of the log; corruption or deletion recovers by replay.

**Rationale.** Crash-safe (append-only), auditable, replayable (PRD criterion 9), trivially testable. A SQLite dependency buys nothing at this scale.

See [progression engine](../systems/progression.md) and [data models](../reference/data-models.md).

## ADR-5: Gating = generated config + runtime enforcement, monotonic

**Decision.** Garnish owns the generated config surfaces under its isolated agent dir (config.yml tool toggles, `includeSkills`, mcp.json plus `disabledServers`, `disabledExtensions`). Unlock application rewrites config, then applies live via `setActiveTools` when the feature is runtime-gateable, else offers a one-keypress `reload()`. Unlocks are monotonic; `garnish unlock --all` must produce effective parity with a stock install.

**Rationale.** Because settings arrays replace wholesale across Pi config layers, Garnish must own any array it manages. Generated files carry a header warning; the learner's global Pi config is never read or rewritten. Monotonicity prevents regressions.

See [Pi adapter](../systems/adapter.md) for the gate catalog and renderer, and [capability gating](../features/capability-gating.md) for the feature-level view.

## ADR-6: Quest packs are data; core pack ships in-repo

**Decision.** A pack is a directory: `pack.yml` (id, version, `requires`, level graph) plus one quest `.md` per quest (frontmatter: id, level, xp, required, prereqs, unlocks, checks; body: instructions and hints). Markdown-with-frontmatter deliberately mirrors the skill format. Packs are validated against a published schema at load; invalid packs are rejected with line-level errors, never half-loaded.

**Rationale.** By the time a learner finishes L3 they have already internalized the skill authoring shape. Data, not code, keeps the executable surface minimal.

See [pack loader](../systems/loader.md) and [curriculum](../features/curriculum.md).

## ADR-7: Tutor bridge = static append + dynamic context injection

**Decision.** Two seams, split by change rate. Identity ("Garnish is active; you are also the tutor; never mark quests complete yourself") goes in `APPEND_SYSTEM.md` at provision time. The active quest payload (quest text, checks, hint policy, current progress) is injected per model call by the extension's `context` handler, bounded to roughly 1KB.

**Rationale.** `APPEND_SYSTEM.md` survives everything but changes only on provision; the `context` event changes every quest without touching disk or restarting. The "never self-certify" instruction closes the obvious failure mode of the agent declaring victory.

See [tutor bridge](../systems/extension/tutor.md).

## ADR-8: TypeScript, single package, Bun toolchain

**Decision.** One repo, one package, three entry points (`cli.ts`, `extension.ts`, shared `core/`). TypeScript because the extension API is TS; Bun for test and build (fast, zero-config TS).

**Rationale.** The extension API is TypeScript, so the implementation language is fixed. Bun removes the transpile and test-runner configuration tax.

See [tooling](../how-to-contribute/tooling.md). Superseded for v-next: the single-package-three-entry-points shape changes when the owned harness replaces the Pi extension, though Bun and TypeScript remain.

## ADR-9: Certified Pi runtime, no global dependency

**Decision.** Garnish installs a specific certified Pi version into Garnish-owned runtime storage and launches that binary by absolute path. The learner's global `omp` on PATH is ignored. The installed extension performs a startup handshake against the certified version; on mismatch, quests pause and `garnish doctor` explains how to repair. Garnish releases are the update channel.

**Rationale.** Profile isolation protects config, not binaries. Owning the binary is the only way to prevent unwanted upstream updates from breaking learners mid-curriculum. This makes Garnish behave like a game: the engine version is bundled with the content, and upgrades happen through the launcher.

See [Pi adapter](../systems/adapter.md) and [debugging](../how-to-contribute/debugging.md) for the version mismatch runbook. Superseded for v-next: the owned harness replaces the certified Pi runtime entirely.

## Superseded for v2

The Garnish Standalone decision (Jul 2, 2026) supersedes ARD section 1 (the Pi-only context), ADR-8 (the three-entry-points package shape), and ADR-9 (the certified Pi runtime) for v-next. The surviving ADRs are ADR-2 (the adapter seam, repurposed for the owned harness), ADR-3 (verification), ADR-4 (progression), ADR-5 (gating), ADR-6 (packs as data), and ADR-7 (tutor bridge). See [v2 direction](v2-direction.md) for the full impact and the v1 dead-words list.
