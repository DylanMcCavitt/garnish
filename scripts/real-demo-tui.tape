# Garnish interactive TUI real demo — onboarding wizard + Mission Control play.
# Sleeps are intentionally generous and may need tuning after layout or pacing changes.
Output demo/garnish-demo-tui.mp4
Set Shell bash
Set FontSize 15
Set Width 1400
Set Height 900
Set Padding 16
Set Theme { "name": "Garnish Retro", "black": "#0A0F0A", "red": "#FF5C5C", "green": "#33FF66", "yellow": "#FFD166", "blue": "#60a5fa", "magenta": "#B48CFF", "cyan": "#22d3ee", "white": "#D6E8D6", "brightBlack": "#1E2A1E", "brightRed": "#fca5a5", "brightGreen": "#6ee7b7", "brightYellow": "#fde68a", "brightBlue": "#93c5fd", "brightMagenta": "#d8b4fe", "brightCyan": "#67e8f9", "brightWhite": "#ffffff", "background": "#0A0F0A", "foreground": "#D6E8D6", "selection": "#1e293b", "cursor": "#33FF66" }

Type "bun run proto"
Enter
# onboarding wizard: welcome card + pantry-pass menu
Sleep 4s
Type "1"
Enter
# Demo Kitchen sign-in ceremony + tips card, then the TUI boots
Sleep 5s
Type "What's my quest?"
Enter
Sleep 4s
Type "Look around"
Enter
Sleep 5s
Type "Record the first edit"
Enter
Sleep 5s
Type "Fix the greeter bug, stamp it, and prove it"
Enter
Sleep 4s
Type "r"
Sleep 1s
Type "show me the diff first"
Enter
Sleep 3s
Type "a"
Sleep 4s
Sleep 5s
Ctrl+C
