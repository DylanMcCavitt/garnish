---
id: revert-change
level: first-quest
title: Undo potion
xp: 15
required: true
prereqs: [first-edit]
unlocks: []
checks:
  - type: event
    match: { event: tool_result, tool: edit, success: true }
  - type: git
    repo: "{sandbox}"
    file_restored: "first-file.txt"
---
Ask the agent to revert an unwanted change instead of piling fixes on top. The file
returning to its committed state is the proof.
