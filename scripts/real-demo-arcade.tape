# Garnish Arcade variant real demo — neon score attack HUD.
# Keys shown in footer: Enter send · Esc abort · \\ collapse · 1-6 or [/] side tabs · a/p/d/r approvals · Ctrl+C quit.
# Capture beats: STAGE SPLASH on quest activation, COMBO BREAK on denial, boss RESULTS card.
Output demo/garnish-demo-arcade.mp4
Set Shell bash
Set FontSize 15
Set Width 1400
Set Height 900
Set Padding 16
Set Theme { "name": "Garnish Arcade Neon", "black": "#000000", "red": "#FF355E", "green": "#36FF7A", "yellow": "#FFE600", "blue": "#00E5FF", "magenta": "#FF2BD6", "cyan": "#00E5FF", "white": "#F8F7FF", "brightBlack": "#171024", "brightRed": "#FF6682", "brightGreen": "#6DFF9E", "brightYellow": "#FFF45C", "brightBlue": "#5EF1FF", "brightMagenta": "#FF6BE3", "brightCyan": "#74F7FF", "brightWhite": "#FFFFFF", "background": "#000000", "foreground": "#F8F7FF", "selection": "#30103D", "cursor": "#FFE600" }

# isolated save for the recording
Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun run proto:arcade"
Enter
# onboarding wizard: fresh save → start the arcade cabinet
Sleep 4s
Type "1"
Enter
Sleep 5s
# STAGE SPLASH should be visible as the first mission activates
Type "What's my quest?"
Enter
Sleep 4s
Type "Look around"
Enter
Sleep 5s
# Side-panel tour: Missions → Moves → Feed → Powerups → Challenges → Hall of Fame
Type "1"
Sleep 700ms
Type "2"
Sleep 700ms
Type "3"
Sleep 700ms
Type "4"
Sleep 700ms
Type "5"
Sleep 700ms
Type "6"
Sleep 1s
# Collapse transcript full-width, then reopen cabinet tabs
Type "\\"
Sleep 2s
Type "\\"
Sleep 1s
Type "1"
Sleep 500ms
Type "Record the first edit"
Enter
Sleep 6s
# BOSS FIGHT: denial with reason creates COMBO BREAK, then approve to land RESULTS.
Type "Fix the greeter bug, stamp it, and prove it"
Enter
Sleep 5s
Type "r"
Sleep 700ms
Type "show me the diff first"
Enter
# COMBO BREAK should now be visible in the top-right combo meter.
Sleep 3s
Type "a"
# Boss RESULTS card appears on quest.completed; let it hold on screen, then dismiss.
Sleep 6s
Enter
Sleep 2s
Ctrl+C
