# Fun facts

A few things from the Garnish source tree that are more interesting than the averages suggest.

## Spike archaeology

The LOO-118 spike at `spikes/pi-extension-api/index.js` is a full probe extension that exercises HUD calls, `setActiveTools` round-trips, `appendEntry`, and reload. Its `safeJson` serializer (line 28) redacts secret-like keys via the regex at line 25 (`token`, `secret`, `apiKey`, `authorization`, `password`, `credential`, `cookie`) and truncates long strings, which is why every capture shows `"[REDACTED_BY_SPIKE]"` in token fields. The captures in `spikes/pi-extension-api/captures/` recorded real omp 16.2.13 behavior that contradicted the published docs: `toolName` (not `tool`) on `tool_call` and `tool_result`, and a `messages[]` array on `agent_end` instead of a turn count. Those findings are pinned in the repo (`194fc95`) and referenced throughout the adapter and extension code. The full LOO-139 story is in [lore](lore.md).

## Naming origins

"Garnish" is a garnish on a dish, a layer on top of the main course, which is the harness. The gamer theme (Tutorial Island, Skill Tree, Loadout, The Party, Final Boss, cheat codes, speedrun mode) was chosen because developers already speak that vocabulary, so no borrowed metaphor is needed. The standing rule in `docs/prd.md`: a themed term never travels alone, the UI pairs it with the functional word ("Loadout, MCP and plugins"), and CLI verbs stay functional. `garnish unlock --all` is the documented name; `garnish cheat` ships as an alias.

## The 10-line HUD limit

omp caps HUD widget content at 10 lines. `renderHudLines` in `src/extension/hud.ts` slices its output to 10 lines (`return lines.slice(0, 10)` at line 100). The module comment at line 10 records the live discovery from LOO-139: the old `{ placement, lines }` content object rendered nothing on real 16.2.13. The real signature wants a string array plus a trailing options object, so the call at line 140 is `setWidget(WIDGET_ID, lastWidgetLines, { placement: "aboveEditor" })`.

## Zero TODOs

The codebase has no `TODO`, `FIXME`, or `HACK` comments in `src/` or `packs/`. Either remarkable discipline, or a very young repo. It is four days old.

## The longest file

`src/verifier/index.ts` is 936 lines, the largest file in the repo. It contains the entire check evaluation engine, the JSONPath parser, string and int predicate matchers, event field alias resolution, and the debounced scheduler. A gentle refactoring hint: the parser, the predicate matchers, and the scheduler are independent enough to split into sibling modules under `src/verifier/`. The component layout is in [architecture](overview/architecture.md).
