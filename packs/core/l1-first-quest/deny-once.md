---
id: deny-once
level: first-quest
title: Assist mode
xp: 10
required: false
prereqs: []
unlocks: []
checks:
  - type: event
    match: { event: tool_approval_resolved, approved: false }
---
You are always in control: deny one tool approval on purpose. The harness records
denials as `tool_approval_resolved` with `approved: false`, so this is a real event
check — no honor-system confirmation needed.
