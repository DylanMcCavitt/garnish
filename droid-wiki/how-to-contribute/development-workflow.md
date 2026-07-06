# Development workflow

The cycle from a Linear issue to a merged PR. Garnish uses the Factorio workflow kit, so the per-repo envelope in `.agents/envelope/` is the source of truth for branch shape, commit prefixes, and the tracker bridge. Read `.agents/envelope/linear-map.md` and `.agents/envelope/commands.md` before starting.

## One issue, one branch, one PR

The unit of work is one Linear issue to one branch to one PR. Pick an issue from team Loom (`LOO`), move it to In Progress, and create a branch off `main` (the default branch) that includes the issue id:

```
dylan/loo-123-short-slug
```

Linear's suggested branch name follows this shape and is fine to use. The GitHub/Linear bridge auto-links the issue to the PR via the branch id, and merging the PR auto-closes the issue. The bridge was configured on LOO-117.

## Code

Source lives in `src/`, tests mirror the structure in `tests/`. Quest packs live in `packs/core/`, one directory per level. The codebase follows dependency injection throughout: command cores and engines take effects interfaces and never touch the filesystem or child processes directly. The composition roots (`src/cli/real.ts`, `src/extension/entry.ts`) are the only places that bind to the machine. See [patterns and conventions](patterns-and-conventions.md) for the full set of cross-cutting patterns.

When adding a quest, create a `.md` file with YAML frontmatter in an existing pack directory. New frontmatter fields require a schema change in `src/core/` first. When adding a gate surface, add an entry to `v1GateCatalog` in `src/adapter/gates.ts`. See the per-system pages under [systems](../systems/index.md) for the entry points for modification in each module.

## Test

There is no separate build step for the library. Typecheck is the static gate:

```bash
bun run typecheck
```

Run the full unit suite:

```bash
bun test
```

Run only the scripted E2E happy path when the harness, CLI, or extension surface changed:

```bash
bun run test:e2e
```

The test-to-source ratio is near 1:1 (4850 test lines against 5481 source lines), reflecting the fixture-driven proof plan in `docs/prd.md`. See [testing](testing.md) for the frameworks, the dependency-injection fakes, and the hermetic E2E approach.

## Commit

Keep commits small and focused, one logical change per commit. Use the bracketed prefix convention and reference the Linear issue id when one exists:

- `[feat]: LOO-123 add yaml_path check type`
- `[fix]: LOO-140 correct agent_end turn counter`
- `[docs]: link v2 PRD/ARD Linear docs in issue tracker`
- `[chore]: add droid-review workflow`

Review the staged diff for secrets before every commit. The `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), local Garnish runtime state, and build output.

## Pull request

Open the PR against `main`. The template at `.github/pull_request_template.md` asks for:

- **Summary** — what changed and why, in one short paragraph.
- **Changes** — a bullet list.
- **Acceptance criteria** — checkboxes from the issue.
- **Proof** — `bun run typecheck`, `bun test` (and `bun run test:e2e` when the harness/CLI surface changed), plus any live evidence captured.
- **Review notes** — risks, trade-offs, follow-ups, and what a reviewer should focus on.

CI runs on the PR: `ci.yml` runs typecheck and tests, `droid-review.yml` triggers an automatic Factory Droid review, and `qa.yml` runs functional QA and posts a report comment. See [tooling](tooling.md) for the workflows.

## Merge

Merging the PR auto-closes the Linear issue through the bridge. Do not merge, push, or close tracker issues without explicit instruction (per the global agent guidelines and the repo's standing convention). The default branch is `main`.

## Verify before done

Both `AGENTS.md` and `.agents/envelope/commands.md` state the gate: run `bun run typecheck` and `bun test` before declaring any change done. Add `bun run test:e2e` when the harness or CLI surface changed. See [testing](testing.md) and [tooling](tooling.md).
