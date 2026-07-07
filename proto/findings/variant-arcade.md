# Variant: Arcade

## What changed
- Built `proto/tui/variants/arcade/**` as a neon score-attack TUI: pure black background with hot magenta, electric cyan, and laser yellow accents.
- Added score pressure as the main feel: top-right SCORE ticker uses `xp * 1000 + efficiency bonus` from the live scorecard, with a wall-clock-throttled count-up.
- Added pure reducer mechanics for:
  - combo chains from consecutive clean `tool.result` events;
  - combo breaks from denials, blocks, tool errors, and harness errors;
  - quest result ranks from tokens, time, approval judgment, and combo peak.
- Added arcade surfaces: collapsible tabbed side cabinet, stage splash, combo meter, and results card.
- Wrote `scripts/real-demo-arcade.tape` to capture stage splash, tab tour, collapse/expand, denial combo break, approval, and boss results.

## Keys documented in the tape and footer
- Enter: send
- Esc: abort
- Ctrl+C: quit via `onExit`
- `\`: collapse/expand side panel
- `1`-`6`: direct side-panel tabs when the panel is open and input is empty
- `[` / `]`: cycle side-panel tabs when the panel is open and input is empty
- Approval modal: `a` approve once, `p` pattern, `d` deny, `r` deny with reason

## ADR-21 question: does score/rank pressure teach cost judgment or induce golfing?
It teaches cost judgment when the math stays visible, but it does create a golfing risk.

What works:
- The score formula explicitly separates `XP * 1000` from the efficiency bonus, so the player can see that useful progress is still the main source of score.
- Results ranking shows one-line math for tokens, wall time, approvals/blocks, and combo peak. That makes judgment visible instead of hiding it behind a vibes-only grade.
- Combo breaks on denial/block/error make unsafe or unready tool use feel costly without pretending denials are always bad; the denial also appears as an achievement in Hall of Fame so teach-back remains legitimized.

Anti-golfing risk:
- A large always-visible SCORE ticker can make players optimize for fewer tokens or faster wall time at the expense of asking good questions or reading enough context.
- Combo streaks can over-reward “keep tools clean” behavior and make a necessary denial feel like failure.

Mitigation if this graduates:
- Keep the score ticker, but make rank weighting quality-first: failed verification, unproven edits, or unsafe approvals should cap rank regardless of token thrift.
- Keep the visible math lines in RESULTS; do not compress rank to a badge only.
- Treat denial-with-reason as a judgment event, not a pure failure. The prototype currently breaks combo but also records the teach-back achievement; the real version should go further and distinguish “bad denial churn” from “good stop-and-explain.”

## LOO-177: surfaces that earn a place in the real game
1. **RESULTS screen with rank math** — strongest keeper. It connects scorecard numbers to player learning and can carry ADR-21’s quality-over-golfing guardrails.
2. **Tabbed/collapsible side panel** — keeper. It gives the transcript full width when needed while preserving structured game state.
3. **Challenges tab** — keeper if challenges are quality-gated. “Under 25k tokens” is useful only beside “prove it” and “zero unresolved blocks.”
4. **Combo meter** — keeper as spice, not as the core grade. It creates game feel immediately but should never outrank proof quality.
5. **Stage splash** — keeper for quest transitions and boss moments. It adds game identity without obscuring the transcript for long.
6. **Huge SCORE ticker** — optional. It is the most arcade-identifying surface, but it is also the main anti-golfing risk. Use it only if the score formula remains transparent and quality-capped.
