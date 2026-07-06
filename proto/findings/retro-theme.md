# Retro Theme Findings

## Palette

Final tokens live in `proto/tui/theme.ts`:

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#0A0F0A` | Near-black CRT glass with a slight green cast. |
| `panel` | `#101910` | Raised panel fill that stays dark but separates from `bg`. |
| `border` | `#235C36` | Muted phosphor edge for future explicit border styling. |
| `primary` | `#33FF66` | Phosphor-green action/quest/celebration color. Replaces the old orange via `TUI_ORANGE`. |
| `primaryDim` | `#1FA84A` | Dim phosphor green for lower-emphasis active states. |
| `accent` | `#B48CFF` | Purple player/status/approval accent so the UI is not all green. |
| `dim` | `#6F8A72` | Green-gray metadata text with enough contrast on the dark background. |
| `text` | `#D7F8D9` | Soft green-white body text; less harsh than pure white. |
| `red` | `#FF5C7A` | Danger/error color that still reads on green-black. |
| `amber` | `#FFD166` | Warning/moderate approval color. |

Rationale: the old orange has been removed from the shared TUI bus. Existing consumers keep importing `TUI_ORANGE`, but it now points to phosphor green so unowned screens recolor without structural edits. Purple is reserved for player rows, auth/approval highlights, and modal framing so it reads as secondary/status rather than another warning color.

## Modal tier colors

Approval tiers use:

- `safe`: `#33FF66`
- `moderate`: `#FFD166`
- `risky`: `#FF9F43`
- `critical`: `#FF5C7A`

The risky tier intentionally keeps an orange-amber hue for legibility and risk escalation. The modal title/explanation use purple accent framing, while the tier label remains risk-colored.

## Sprite and monospace gotchas

`proto/tui/sprites.ts` adds Sprig, a tiny parsley-sprig mascot. Each pose is pure text, at most three rows, and rows within a pose have equal string length. The smoke test also rejects high-plane emoji ranges because wide emoji break terminal cell math differently across Ghostty, macOS Terminal, and OpenTUI render paths.

The current sprites avoid zero-width joiners and emoji presentation selectors. Block-shade banner glyphs (`░▒▓`) are assumed single-cell in common terminal fonts, but a production system should still measure rendered cell width instead of relying on JavaScript string length.

## OpenTUI needs for a real sprite/animation system

LOO-174 celebration-surface input: the prototype can only render static transcript rows and frame strings. A real sprite/animation layer needs OpenTUI support for:

1. A measured cell-width API for strings, including ambiguous-width Unicode and terminal/font differences.
2. A lightweight timed surface or animation primitive that can update only the celebration region without forcing transcript data to carry fake animation frames.
3. Stable z-index/overlay semantics for celebratory bursts that do not steal focus from inputs or modals.
4. A color-safe sprite surface with per-cell fg/bg attributes so ASCII art can pulse without reflow.

## Proof

- `bun test ./proto/tui` → 7 pass, 0 fail.
- `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep proto/tui` → empty output.
