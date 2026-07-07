# Dungeon variant findings

## What changed
- Built `proto/tui/variants/dungeon` as a standalone TUI seam exporting `startTui(opts)`.
- Reframed the curriculum as a dungeon crawl: top mini-map floors/rooms from `buildAtlas`, SATCHEL side panel, torchlit palette, loot/unlock copy, boss banner, and a three-heart teaching streak.
- Added pure smoke coverage for map derivation and heart reduction.
- Added `scripts/real-demo-dungeon.tape` with the required story flow, SATCHEL tour, collapse/expand beat, mini-map room-clear moment, deny-with-reason, and approve path.

## LOO-174/179 input: does spatializing progression beat lists for intuition?
Yes for this curriculum shape. The mini-map makes the short quest chain easier to parse than a vertical checklist because it communicates three things at once: current room, cleared rooms, and future/fogged floors. The boss room also reads better as a destination than as another row in a list. The tradeoff is horizontal density: long curricula would need paging/zooming, but for the prototype's onboarding arc the spatial model improves orientation and makes "what changed after my last message?" visible at a glance.

## Hearts verdict
Keep hearts as a soft streak meter, not a health system. Spending a heart on blocks/denials gives risk moments game feel and makes the approval denial visible in the header, but zero hearts must remain non-punitive. The teaching copy ("the dungeon humbles you") is the right boundary: it acknowledges the stumble, points to safer behavior, and does not imply failure or lockout. Hearts refilling on room clear feels good and prevents a cautious user from carrying shame through the whole session.

## Design notes
- Palette: warm near-black background, torch amber primary, slime green success/loot, blood red traps/boss, royal purple trophy/approval accent.
- SATCHEL tabs: `[1]Quest(scroll) [2]Verbs(gear) [3]Chronicle(progress feed) [4]Treasury(unlocks/loot table) [5]Trials(challenges) [6]Trophies(achievements)`; `[` and `]` cycle tabs when the input is empty; `\` collapses the panel.
- Transcript remains central; dungeon event rows are appended as room echoes so quest clears, loot, locks, and denials remain visible beside the shared reduced transcript.
- Boss quest uses `bossGoodbyeGreeter`; boss rooms in the mini-map use `emblemBoss`; Treasury uses `emblemUnlock`.

## Prototype risks
- The mini-map is intentionally compact. If the atlas grows beyond a handful of floors, it should gain a focused-floor mode rather than shrinking room glyphs further.
- The SATCHEL title is dense because it doubles as discoverability for recording. A production pass should split the key legend into the footer.
