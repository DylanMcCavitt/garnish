# Linear map — Garnish

## Team

- Team: Loom (`LOO`)
- Team ID: `51c7b3f0-1e03-45b1-8bd6-621db7a5b799`

## Projects

- Default project (v1 delivery): **Garnish**
  - URL: https://linear.app/dylanmccavitt/project/garnish-19ceee7bd725
  - ID: `8605167b-8479-4dcb-b1f7-e6c3dca7eb86`
- Planning home (v-next): **Garnish Standalone — purpose-built harness & TUI**
  - URL: https://linear.app/dylanmccavitt/project/garnish-standalone-purpose-built-harness-and-tui-98f6de260a93
  - ID: `5da7cbc1-889f-453a-a9b1-0fde5da4bf85`
  - State: Planned. Holds the brief/decision record and the v2 PRD/ARD work.
- New ideas for this repo land as **projects** on team Loom (not initiatives).

## Labels

- Group `Mode`: `AFK` (agent-first, implementable without new human decisions),
  `HITL` (needs design/decision/manual review), `Planning` (tracking parent, not
  one-branch implementable).
- Group `Type`: `decision`, `design`, `implementation`, `chore`.
- Group `Harness`: `omp`, `codex`, `claude`, `cross-harness`. For v-next Garnish
  work (own harness, omp dropped) do not tag new issues `omp`; that label marks
  paused v1 fallout only.
- Workspace basics: `Bug`, `Feature`, `Improvement`, `smoke-test`.
- Unrelated tracks (`track:*`, `assets`, `symphony`) are other products; never
  apply them to Garnish issues.

## States (inserter triage map)

Loom workflow states: Triage, Backlog, Todo, In Progress, In Review, Done,
Canceled, Duplicate.

- `needs-triage` -> state `Triage`
- `needs-info` -> state `Triage` + label `HITL`
- `ready-for-agent` -> state `Todo` + label `AFK`
- `ready-for-human` -> state `Todo` + label `HITL`
- `wontfix` -> state `Canceled`

## Bridge (GitHub)

- Repository: https://github.com/DylanMcCavitt/garnish (public)
- Default branch: `main`
- One Linear issue -> one branch -> one PR.
- Branch shape: includes the Linear issue id, e.g. `dylan/loo-123-short-slug`
  (Linear's suggested branch name is fine).
- The PR auto-links the issue via the branch id; merge auto-closes it through the
  Linear/GitHub bridge (configured on LOO-117).
- Commit prefix convention: `[docs]:`, `[fix]:`, `[feat]:` etc.; reference the
  issue id (`LOO-123`) when one exists.
