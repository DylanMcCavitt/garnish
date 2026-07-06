---
id: look-around
level: tutorial-island
title: Look around
xp: 5
required: true
prereqs: [mise-en-place]
unlocks: []
checks:
  - type: event
    match: { event: tool.result, tool: read, success: true }
---
Ask the agent to inspect the workspace with the read tool. Try `Look around` if you want the shortest prompt; the verifier accepts the first-party `tool.result` event for `read`.
