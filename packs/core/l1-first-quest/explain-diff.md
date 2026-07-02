---
id: explain-diff
level: first-quest
title: Read the quest log
xp: 10
required: false
prereqs: [first-edit]
unlocks: []
checks:
  - type: git
    repo: "{sandbox}"
    dirty: true
  - type: event
    match: { event: agent_end }
    after: { ref: gitDirty }
    sameSession: true
---
Before accepting changes, ask the agent to explain the diff. The check anchors on the
dirty working tree: the explanation reply must land after the tree went dirty, in the
same session.
