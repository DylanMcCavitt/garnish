# Factory sameItem finding

- Engine fit: clean additive v1 DSL change. Core/verifier implementation was 31 added lines (`src/core/checks.ts` + `src/verifier/index.ts`); smoke coverage adds a focused 139-line test file.
- Final API shape: event checks may specify `sameItem?: boolean` as a sibling of `after` and `sameSession`:
  `{ type: "event", match: { event: "touch.recorded", count: 0 }, sameItem: true }`.
- Evaluation context anchor: `EvaluationContext.currentItemId?: string`.
- Anchor semantics: without `after`, `sameItem` scopes matches to `ctx.currentItemId`; with `after`, it scopes to the boundary event's `payload.itemId`. Missing, null, or non-string item ids are no anchor/no match. Missing anchor fails loudly with `sameItem requested but no item anchor was available`.
- Surprises: none; the sameSession path mirrored directly and existing unscoped event behavior remains unchanged.
