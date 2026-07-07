# Garnish Dungeon Crawl TUI real demo — mini-map, satchel tabs, hearts, approvals.
# Keys: Enter send · Esc abort · Ctrl+C quit · \ toggles SATCHEL · 1-6 pick tabs · [/] cycle tabs.
# Mini-map beat: "Record the first edit" clears the active room; watch its tile light up and the next floor wake.
Output demo/garnish-demo-dungeon.mp4
Set Shell bash
Set FontSize 15
Set Width 1400
Set Height 900
Set Padding 16
Set Theme { "name": "Garnish Dungeon Torch", "black": "#0B0705", "red": "#FF3158", "green": "#79E84A", "yellow": "#FFB13B", "blue": "#4D67FF", "magenta": "#9B5CFF", "cyan": "#35D6C6", "white": "#F7E7C6", "brightBlack": "#4B3B35", "brightRed": "#FF6B7F", "brightGreen": "#A6FF6A", "brightYellow": "#FFD166", "brightBlue": "#8395FF", "brightMagenta": "#C29BFF", "brightCyan": "#75FFE9", "brightWhite": "#FFF8E7", "background": "#0B0705", "foreground": "#F7E7C6", "selection": "#241509", "cursor": "#FFB13B" }

# isolated save for the recording
Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun run proto:dungeon"
Enter
# onboarding wizard: pantry-pass menu on a fresh save
Sleep 4s
Type "1"
Enter
# TUI boots into the first room; SATCHEL starts open on Quest
Sleep 5s
Type "What's my quest?"
Enter
Sleep 4s
Type "Look around"
Enter
Sleep 5s
# SATCHEL tour: Verbs, Chronicle, Treasury, Trials, Trophies, back to Quest
Type "2"
Sleep 1s
Type "3"
Sleep 1s
Type "4"
Sleep 1s
Type "5"
Sleep 1s
Type "6"
Sleep 1s
Type "1"
Sleep 1s
# Collapse for full-width transcript, then reopen the SATCHEL
Type "\\"
Sleep 2s
Type "\\"
Sleep 1s
# Mini-map moment: complete a quest; current room lights and next room/floor advances
Type "Record the first edit"
Enter
Sleep 6s
Type "]"
Sleep 1s
Type "]"
Sleep 1s
# BOSS FIGHT: The Goodbye Greeter (stamp asks for approval)
Type "Fix the greeter bug, stamp it, and prove it"
Enter
Sleep 4s
# deny-with-reason costs a heart and shows teaching copy
Type "r"
Sleep 1s
Type "show me the diff first"
Enter
Sleep 3s
# repeat command and approve once
Type "Fix the greeter bug, stamp it, and prove it"
Enter
Sleep 3s
Type "a"
Sleep 7s
Ctrl+C
