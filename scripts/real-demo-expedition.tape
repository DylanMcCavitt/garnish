# Garnish Expedition real demo — clean-vivid mission console, right-deck tour, collapse, approval flow.
# Keys shown: 1-6 switch deck tabs, [/] cycle tabs, \ collapses/expands the deck, a/p/d/r answer approvals.
Output demo/garnish-demo-expedition.mp4
Set Shell bash
Set FontSize 15
Set Width 1400
Set Height 900
Set Padding 16
Set Theme { "name": "Garnish Expedition", "black": "#07111F", "red": "#FF4D7D", "green": "#5FFFB1", "yellow": "#FFB86B", "blue": "#1B4161", "magenta": "#F472D0", "cyan": "#22D3EE", "white": "#E6F6FF", "brightBlack": "#10243A", "brightRed": "#FF6B6B", "brightGreen": "#8DFFC9", "brightYellow": "#FFD29A", "brightBlue": "#2F6B99", "brightMagenta": "#FF9CDF", "brightCyan": "#67E8F9", "brightWhite": "#FFFFFF", "background": "#07111F", "foreground": "#E6F6FF", "selection": "#1B4161", "cursor": "#22D3EE" }

# isolated save for the recording
Type "export GARNISH_PROTO_HOME=$(mktemp -d)"
Enter
Sleep 500ms
Type "bun run proto:expedition"
Enter
# onboarding wizard: mascot welcome + pantry-pass menu (fresh save)
Sleep 4s
Type "1"
Enter
# Demo Kitchen sign-in ceremony + tips, then the TUI boots
Sleep 5s
Type "What's my quest?"
Enter
Sleep 4s
Type "Look around"
Enter
Sleep 5s
# RIGHT DECK tour: quests, verbs, progress, unlocks, challenges, achievements
Type "2"
Sleep 1200ms
Type "3"
Sleep 1200ms
Type "4"
Sleep 1200ms
Type "5"
Sleep 1200ms
Type "6"
Sleep 1200ms
Type "["
Sleep 1s
# collapse to glyph strip, let transcript breathe, then expand
Type "\\"
Sleep 2s
Type "\\"
Sleep 1s
Type "Record the first edit"
Enter
Sleep 5s
# boss fight: stamp asks for approval; deny with reason first, then approve the next prompt
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
# final achievements pass
Type "6"
Sleep 5s
Ctrl+C
