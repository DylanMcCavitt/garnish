---
id: first-edit
level: first-quest
title: Patch the item
xp: 15
required: true
prereqs: [first-file]
unlocks: []
checks:
  - type: event
    match: { event: tool_result, tool: edit, success: true }
  - type: git
    repo: "{sandbox}"
    diff_contains: { contains: first-file }
---
Ask the agent to edit the file it just created. The git diff proves the patch landed.
