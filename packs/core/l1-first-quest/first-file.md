---
id: first-file
level: first-quest
title: "Loot drop: first file"
xp: 15
required: true
prereqs: []
unlocks: []
checks:
  - type: event
    match: { event: tool_result, tool: write, success: true }
  - type: file_exists
    path: "{sandbox}/first-file.txt"
---
Ask the agent to create a file in your sandbox. Watch the write tool do the work —
the file landing on disk is your first loot drop.
