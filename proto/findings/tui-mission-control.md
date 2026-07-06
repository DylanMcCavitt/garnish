# TUI Mission Control findings

## Layout cost

- The Mission Control cutover stayed local to `proto/tui/`: `app.tsx` now owns the dashboard shell, `questlog.tsx` owns the right rail, `transcript.tsx` keeps the reducer and chat rendering, `juice.ts` carries the small status/progress reducers, and `index.ts` only widened `StartTuiOpts` with optional `meta`.
- The highest cost was not drawing panels; it was making state visible in the right place without adding a second event model. Status, transcript rows, progress moments, quest/check counters, and verb counters all derive from existing `HarnessEvent`s plus the already-polled `questView()`, `gateViews()`, and `scorecard()` views.
- The previous XP/new-verb overlay was the wrong game-feel for a chat-first demo because it hid the conversation. Replacing it with a sidebar accent flash plus inline transcript celebration rows kept the juice while preserving the transcript as the main surface.
- Header metrics are intentionally lightweight: level/XP derive from scorecard output/diff bytes, tokens are input+output, and provider/workspace render from optional `meta` with placeholders when the integrator has not wired them yet.

## What OpenTUI made easy

- Flex columns/rows made the requested shell cheap: one header row, a 65/35 main split, bottom status/input bar, and one hotkey row.
- Existing border/title primitives were enough for thin panel framing and dim panel titles; no custom renderer was needed.
- The centered approval modal remained straightforward with absolute positioning and `zIndex`, so approval stays interruptive by design while the rest of Mission Control remains event-driven.
- The self-driving `dev.tsx` fake bus is a good demo seam: scripted `turn.start`, deltas, tool call/result, approval request/resolution, blocked tools, unlocks, file edits, and quest completion exercise every visible panel without touching the real wire/main integration.

## What OpenTUI made hard

- Sticky-scroll is not exposed as a first-class obvious prop in the current usage. The practical prototype solution is to render the newest bounded rows (`slice(-30)`) so the transcript behaves like bottom-stuck chat for the demo. A production version should either confirm the scrollbox API has a follow-tail primitive or wrap one at the transcript component boundary.
- Inline status + input works, but the input component controls most of its own visual behavior. The status word can sit beside it cleanly, but deeper chatbox styling would need more OpenTUI-specific investigation.
- Percent-width flex works for the intended terminal size, but very narrow terminals still compress aggressively. The right rail has a `minWidth` to protect quest/verb readability; the transcript is allowed to give ground first.
- OpenTUI alternate-screen behavior is environment-sensitive. In this harness, `bun proto/tui/dev.tsx` completed but reported PTY unavailable, so the captured output is a compressed terminal frame rather than a faithful interactive screenshot.

## LOO-166 / LOO-168 implications

- LOO-166 should treat Mission Control as the canonical demo layout: transcript is the left main pane, quest/verbs/progress are the right rail, input is bottom-fixed, and approval remains a centered modal. Any recorded demo script should avoid the old top-transcript framing.
- LOO-166 should call out that `StartTuiOpts.meta` is now the integration seam for workspace/provider/model. `wire.ts`/`main.ts` should pass real values, but the TUI remains safe with placeholders when absent.
- LOO-168 should include a repository-standard “real demo” path that launches the scripted TUI and records the mp4 after `vhs` is available. The TUI script now exercises all Mission Control surfaces, so it is suitable as the default tape target.
- LOO-168 should not depend on an overlay celebration moment for proof. The proof points are now durable transcript lines plus Progress Log entries for quest completion, verb unlocks, blocks, and approvals.

## Proof run locally

- `bun test ./proto/tui` passed: 4 tests, 20 expects.
- `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep proto/tui` produced no output.
- `bun proto/tui/dev.tsx` ran its scripted sequence to completion in this harness; PTY was unavailable, so the capture was a compressed non-interactive frame.

## Integrator addendum (post-recording verification)

Recording the mp4 and inspecting frames caught four defects the dev-capture
missed (no real PTY in agent harnesses — screenshot-the-mp4 is the reliable
verification loop):

1. **Yoga defaults to `flexDirection: column`** — every horizontal band
   (header, middle row, status+input, stat rows) needed an explicit
   `flexDirection: "row"` or text nodes interleave garbled and the sidebar
   stacks under the transcript. Worth a lint/convention note for LOO-166.
2. **Sticky scroll is opt-in**: `scrollbox` needs `stickyScroll` +
   `stickyStart="bottom"` or the chat freezes at the top once it overflows.
3. **Timeline `onUpdate` fires per frame**, not per cycle — per-tick TTL decay
   killed Progress Log entries in <1s; decay must be wall-clock throttled.
4. **Focused `<input>` swallows keys while the approval modal is open** —
   modal keystrokes leaked into the chat input and got sent as player
   messages. `focused={modal === null}` fixes it; the spec's approval-modal
   issue (LOO-167) should require exclusive key focus.

Also: the interactive script must include a moderate+ command or the modal
never appears at post-L1 tiers (same graduation-lag lesson as the headless
demo, now proven in the TUI too).
