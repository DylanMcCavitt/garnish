# Flow proto 2/3 — COLD OPEN: environmental-discovery onboarding (one card, hints teach).
Output demo/garnish-flow-cold.mp4
Set Shell bash
Set FontSize 16
Set Width 1400
Set Height 900
Set Padding 14
Set Theme { "name": "Garnish Factory", "background": "#0B0B0D", "foreground": "#D8DEE9", "black": "#0B0B0D", "red": "#E5484D", "green": "#7CCB6B", "yellow": "#F0B429", "blue": "#58C7F3", "magenta": "#B48CFF", "cyan": "#58C7F3", "white": "#D8DEE9", "brightBlack": "#3A3F4B", "brightRed": "#E5484D", "brightGreen": "#7CCB6B", "brightYellow": "#F0B429", "brightBlue": "#58C7F3", "brightMagenta": "#B48CFF", "brightCyan": "#58C7F3", "brightWhite": "#FFFFFF", "selection": "#1C1C24", "cursor": "#D8DEE9" }

Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun proto/factory/main.ts --flow cold"
Enter
Sleep 4s
Type "n"
Sleep 1s
Type "night-shift"
Enter
Sleep 4s
# single title card
Enter
Sleep 3s
# discovery: the HINT row is the only teacher
Type "/mine"
Enter
Sleep 3s
Type "/cat src/ore/item-1.ts"
Enter
Sleep 3s
Type "/fix"
Enter
Sleep 2s
Type "/fix"
Enter
Sleep 5s
Ctrl+C
