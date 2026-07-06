# Systems

Garnish is a single TypeScript package whose deployable artifacts (a `garnish` CLI and a Pi extension) compose the same core modules. This section documents the internal building blocks under `src/`, each as its own page with the module's purpose, layout, abstractions, control flow, and modification entry points.

Core domain schemas (pack, quest, level, checks, IDs, progression events) are foundational types shared across every system. They are documented under [primitives](../primitives/index.md) rather than here, since a change to a primitive ripples through every consumer. Cross-cutting capabilities that span systems, such as capability gating and the curriculum, are documented under [features](../features/index.md).

- [Pi adapter](adapter.md): the only module that knows Pi specifics. Certified runtime install and version handshake (`src/adapter/runtime.ts`), gate config rendering (`src/adapter/gates.ts`), and the adapter contract assertions (`src/adapter/contract.ts`).
- [Pack loader](loader.md): discovers packs, parses markdown frontmatter, validates against Zod schemas, and builds the quest graph with cycle detection (`src/loader/index.ts`).
- [Verification engine](verifier.md): evaluates the check DSL against live events and on-demand probes, with a debounced scheduler (`src/verifier/index.ts`).
- [Progression engine](progression.md): folds the append-only event log into state and derives unlocks, XP, and badges (`src/progression/index.ts`).
- [CLI](cli/index.md): the `garnish` CLI, onboarding wizard, status, unlock escape hatch, and doctor (`src/cli/`).
- [Extension](extension/index.md): the Pi extension, event wiring, HUD, live unlocks, and tutor bridge (`src/extension/`).

For the architecture that connects these systems and the data flows between them, see [architecture](../overview/architecture.md).
