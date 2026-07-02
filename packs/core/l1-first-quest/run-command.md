---
id: run-command
level: first-quest
title: Press the action button
xp: 15
required: true
prereqs: [first-file]
unlocks: []
checks:
  - type: event
    match: { event: tool_result, tool: bash, exit_code: 0 }
---
Ask the agent to run a command and read its output. A clean exit code means the
action button worked.
