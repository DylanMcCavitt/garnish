# {{PR_TITLE}}

> Garnish PR description. The branch carries the Linear issue id (`LOO-…`), so this
> PR auto-links to the issue and the merge auto-closes it through the Linear/GitHub
> bridge.

Fixes LOO-{{NNN}}

## Summary

What changed and why, in one short paragraph. Use the glossary in
`.agents/envelope/domain.md` (harness, quest, pack, verifier, progression, gate,
tutor).

## Changes

- {{change}}
- {{change}}

## Acceptance criteria

Map each Linear acceptance criterion to where it is satisfied.

- [ ] {{criterion}} — {{how it is met}}

## Proof

Targeted checks run for the changed behavior: `bun run typecheck`, `bun test`
(and `bun run test:e2e` when the harness/CLI surface changed), plus any live
evidence captured.

## Review notes

Risks, trade-offs, follow-ups, and what a reviewer should focus on.
