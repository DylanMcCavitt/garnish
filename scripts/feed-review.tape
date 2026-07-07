# Integrator review — feed/theme styling under real activity. NOT a demo.
Output demo/feed-review.mp4
Set Shell bash
Set FontSize 16
Set Width 1400
Set Height 900
Set Padding 14
Set Theme { "name": "Review", "background": "#0B0B0D", "foreground": "#D8DEE9", "black": "#0B0B0D", "red": "#E5484D", "green": "#7CCB6B", "yellow": "#F0B429", "blue": "#58C7F3", "magenta": "#B48CFF", "cyan": "#58C7F3", "white": "#D8DEE9", "brightBlack": "#3A3F4B", "brightRed": "#E5484D", "brightGreen": "#7CCB6B", "brightYellow": "#F0B429", "brightBlue": "#58C7F3", "brightMagenta": "#B48CFF", "brightCyan": "#58C7F3", "brightWhite": "#FFFFFF", "selection": "#1C1C24", "cursor": "#D8DEE9" }

Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun proto/factory/main.ts --world review --flow cold"
Enter
Sleep 4s
Type "/mine"
Enter
Sleep 1s
Type "/cat src/ore/item-1.ts"
Enter
Sleep 1s
Type "/fix"
Enter
Sleep 1s
Type "/fix"
Enter
Sleep 3s
Type "/mine"
Enter
Sleep 1s
Type "item-2 help: what is the safest fix here?"
Enter
Sleep 4s
Type "/paste grep -n 'friend' src/ore/item-2.ts"
Enter
Sleep 3s
Type "/fix"
Enter
Sleep 3s
Type "/build bare-agent"
Enter
Sleep 2s
Type "/build routing-belt"
Enter
Sleep 4s
Ctrl+C
