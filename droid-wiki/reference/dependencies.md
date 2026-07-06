# Dependencies

The npm dependencies and external integrations. The dependency count is minimal by design: two runtime dependencies, two dev dependencies, one runtime/toolchain. Garnish makes no network calls in v1.

## NPM dependencies

From `package.json`:

### Runtime

| Dependency | Version | Role |
| --- | --- | --- |
| `zod` | `^4.4.3` | Schemas and branded types for every domain id, the check DSL discriminated union, pack/quest/level metadata, and progression events. |
| `yaml` | `^2.9.0` | Parsing pack metadata (`pack.yml`) and Pi config files (`config.yml`), and stringifying generated config. |

### Dev

| Dependency | Version | Role |
| --- | --- | --- |
| `typescript` | `^6.0.3` | The static gate (`tsc --noEmit`). |
| `@types/bun` | `^1.3.14` | Bun runtime types for the test suite and source. |

The package is `private: true` with `type: "module"` and three exports: `.` (`src/index.ts`, core re-exports), `./cli` (`src/cli.ts`), `./extension` (`src/extension.ts`). See [tooling](../how-to-contribute/tooling.md) for the TypeScript config.

## Runtime and toolchain

**Bun** is both the runtime and the package manager. `bun.lock` is the lockfile; `bunfig.toml` sets the test root to `./tests`. CI uses `bun install --frozen-lockfile`. The extension is bundled with `bun build --target node` into the agent dir for the certified runtime to autoload. See [tooling](../how-to-contribute/tooling.md).

## External integrations

### Pi (omp) v16.2.13 certified runtime

The only harness v1 targets. Garnish installs a certified build into Garnish-owned runtime storage (`runtime/pi/omp-16.2.13/bin/omp`) and launches it by absolute path, ignoring any `omp` on PATH. The certified release is pinned in `src/adapter/runtime.ts`:

```ts
export const certifiedRelease = {
  harness: "pi",
  binary: "omp",
  version: "16.2.13",
  versionOutput: "omp/16.2.13",
  verifiedAt: "2026-07-01",
  evidenceIssue: "LOO-118",
} as const;
```

The adapter contract in `src/adapter/contract.ts` pins the event names, config keys, and isolation facts Garnish relies on. See [Pi adapter](../systems/adapter.md). The v2 direction drops omp in favor of an owned harness; see [v2 direction](../background/v2-direction.md).

### Linear (team Loom)

Issue tracking on team Loom (`LOO`, team id `51c7b3f0-1e03-45b1-8bd6-621db7a5b799`). The GitHub/Linear bridge auto-links issues to PRs via the branch id and auto-closes issues on merge (configured on LOO-117). See [how to contribute](../how-to-contribute/index.md) and the linear map at `.agents/envelope/linear-map.md`.

### GitHub Actions CI

Four workflows in `.github/workflows/`:

- `ci.yml` — typecheck and test on every push and PR.
- `qa.yml` — functional QA via `droid exec` plus `tuistory`, posts a report comment.
- `droid-review.yml` — automatic Droid review on PR open.
- `droid.yml` — `@droid` mention trigger.

See [tooling](../how-to-contribute/tooling.md) for the full workflow details.

### Factory Droid

The `qa.yml` and `droid-review.yml` workflows use the Factory Droid action and CLI for automated review and functional QA. The Droid CLI is installed in CI from `https://app.factory.ai/cli`, and the `droid-control` plugin is installed from the `factory-plugins` marketplace. The `FACTORY_API_KEY` secret authenticates both. See [tooling](../how-to-contribute/tooling.md).

## No network calls in v1

Garnish ships no network calls in v1. The certified runtime is a binary copied from a local source (`GARNISH_OMP_SOURCE` or PATH), not a download driven by the extension. Pack installs are file and git operations the user runs. There is no telemetry backend, no accounts, and no server. See [security](../security.md).

## Dependency count is minimal by design

Two runtime dependencies (zod, yaml), two dev dependencies (typescript, @types/bun), and Bun. The PRD and ARD explicitly avoid a SQLite dependency (the append-only event log plus a pure fold buys the same crash-safety at this scale) and any framework beyond a minimal arg parser for the CLI. See [design decisions](../background/design-decisions.md) (ADR-8) and [cleanup opportunities](../cleanup-opportunities.md) for dependency freshness.

See [tooling](../how-to-contribute/tooling.md) for the build system and CI, and [configuration](configuration.md) for the storage layout these integrations write into.
