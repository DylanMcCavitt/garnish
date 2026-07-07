# Variant: Expedition

## What changed
- Built `proto/tui/variants/expedition` as the clean-vivid Mission Control evolution: deep navy/slate surfaces, electric cyan primary, coral/amber objectives, mint success states, and magenta celebration/approval accents.
- Added a right-side tabbed deck with `[1]Quests [2]Verbs [3]Progress [4]Unlocks [5]Challenges [6]Achievements`, number switching, `[`/`]` cycling, and `\` collapse.
- Collapse keeps a narrow glyph rail so transcript gets the width while hidden-tab alert dots still show new progress/unlock/achievement activity.
- Kept the shared harness seam and pure reducers; local code derives deck pages, challenges, achievements, XP block-eighth bar, hidden news, and toasts.

## LOO-174/177 input

### Is the tabbed deck the right default shape?
Yes. For the professional mission-console pole, tabs are the strongest default because the deck turns “game systems” into explicit instrument pages instead of stacking a tall sidebar. Quests, Verbs, Progress, Unlocks, Challenges, and Achievements are semantically different enough that one-at-a-time focus feels calmer and more executive than a dense quest log. The always-visible tab bar also teaches the game loop: objective → capability → telemetry → reward → challenge → trophy.

The only caveat: the default selected tab should stay Quests at boot. It anchors the player’s next action and prevents achievements/challenges from feeling like vanity dashboards before the user has done anything.

### Collapse ergonomics
`\` is good for collapse because it is unlikely to conflict with prose input and is easy to tap as a “panel slash.” The glyph rail is necessary; full disappearance made the console feel less game-like and made hidden progress invisible. Alert dots on the rail are the right minimum signal: they preserve focus without demanding a toast for every event.

The rail should remain 1 visual column plus dot padding, not a mini-sidebar. If it grows labels, it defeats the purpose of collapse.

### Challenges/Achievements: meaningful vs filler
Meaningful:
- “Zero denials” works because it reflects clean approval planning, but it becomes more interesting once paired with the approval teach-back achievement so denials are not treated as always bad.
- “Under 25k tokens” is meaningful for harness discipline and Founder feedback about information density; it is easy to understand live.
- “No blocked loops” is the most useful challenge because blocked tool calls are a real learning/pacing signal.
- “Edit + approval” is meaningful in the boss flow because it ties game completion to proof-producing work, not just chatting.
- Achievements for first unlock, first edit, approval captain, denial teach-back, and boss slain all map to real player milestones.

Filler/risky:
- Pure counts without a threshold (“3 moments seen”) felt like noise and were not included.
- Celebrating every approval denial would teach the wrong behavior; the included “Denial teach-back” only fires once and frames the denial as a learning moment.
- Any challenge based only on wall time was avoided because tape/demo pacing would make it arbitrary.

## Tape
`scripts/real-demo-expedition.tape` records to `demo/garnish-demo-expedition.mp4`, uses `bun run proto:expedition`, tours tabs, collapses/expands the deck, and exercises deny-with-reason then approve.
