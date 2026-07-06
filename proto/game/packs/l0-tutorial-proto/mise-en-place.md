---
id: mise-en-place
level: tutorial-island
title: Mise en place
xp: 5
required: true
prereqs: []
unlocks: []
checks:
  - type: event
    match: { event: auth.login }
---
Every kitchen starts with mise en place: sign in and stock your station before the first order hits the rail. The verifier accepts the `auth.login` event emitted by the onboarding wizard.
