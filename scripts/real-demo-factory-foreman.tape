# Flow proto 1/3 — FOREMAN: explicit-instruction onboarding (dialogue cards + OBJECTIVE banner).
Output demo/garnish-flow-foreman.mp4
Set Shell bash
Set FontSize 16
Set Width 1400
Set Height 900
Set Padding 14
Set Theme { "name": "Garnish Factory", "background": "#0B0B0D", "foreground": "#D8DEE9", "black": "#0B0B0D", "red": "#E5484D", "green": "#7CCB6B", "yellow": "#F0B429", "blue": "#58C7F3", "magenta": "#B48CFF", "cyan": "#58C7F3", "white": "#D8DEE9", "brightBlack": "#3A3F4B", "brightRed": "#E5484D", "brightGreen": "#7CCB6B", "brightYellow": "#F0B429", "brightBlue": "#58C7F3", "brightMagenta": "#B48CFF", "brightCyan": "#58C7F3", "brightWhite": "#FFFFFF", "selection": "#1C1C24", "cursor": "#D8DEE9" }

Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun proto/factory/main.ts --flow foreman"
Enter
Sleep 4s
# launcher: new world
Type "n"
Sleep 1s
Type "shift-one"
Enter
Sleep 3s
# foreman dialogue cards
Enter
Sleep 3s
Enter
Sleep 3s
Enter
Sleep 4s
# first level under orders
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
