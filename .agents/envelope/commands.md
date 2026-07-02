# Commands — Garnish

- Default branch: `main`
- Runtime/package manager: Bun (`bun.lock`, `bunfig.toml`)

## Commands (from package.json)

- Install: `bun install`
- Typecheck: `bun run typecheck` (`tsc --noEmit`)
- Test: `bun test`
- E2E tests: `bun run test:e2e` (`bun test tests/e2e/`)
- Run CLI: `bun run garnish` (`bun src/bin.ts`)

## Notes

- No lint script exists; typecheck is the static gate.
- Run typecheck + `bun test` before declaring any change done.
