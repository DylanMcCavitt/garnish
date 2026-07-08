---
id: start-standalone-harness
level: tutorial-island
title: Start the game engine
xp: 10
required: true
prereqs: []
unlocks: []
checks:
  - type: event
    match: { event: session_start }
  - type: json_path
    file: "{agent_dir}/garnish/state.json"
    path: "$.activeLevel"
    assert: non_empty
---
Start Garnish through the standalone harness so the game engine boots and records the active level.
