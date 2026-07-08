# Issue Tracker — Garnish

Tracker: Linear

## Linear

- Team: Loom (`LOO`)
- Project: Garnish
- Project URL: https://linear.app/dylanmccavitt/project/garnish-19ceee7bd725
- Project ID: `8605167b-8479-4dcb-b1f7-e6c3dca7eb86`

## Planning documents

- PRD — Garnish: https://linear.app/dylanmccavitt/document/prd-garnish-f4b93b442997
- ARD — Garnish: https://linear.app/dylanmccavitt/document/ard-garnish-cf395973f74d
- Quest Inventory — Garnish Core Pack: https://linear.app/dylanmccavitt/document/quest-inventory-garnish-core-pack-49b81216c2f6

## Related projects

- Garnish Standalone — purpose-built harness & TUI (DECIDED 2026-07-02, state: Building):
  https://linear.app/dylanmccavitt/project/garnish-standalone-purpose-built-harness-and-tui-98f6de260a93
  Brief + decision record: https://linear.app/dylanmccavitt/document/brief-garnish-standalone-purpose-built-harness-and-tui-2527da9a5034
  Research spike (2026-07-02): https://linear.app/dylanmccavitt/document/research-spike-garnish-standalone-harness-architecture-2026-07-02-4a7d1435bfd3
  PRD v2 (ACCEPTED 2026-07-04): https://linear.app/dylanmccavitt/document/prd-v2-garnish-standalone-purpose-built-harness-and-tui-632ac25c9788
  ARD v2 (ACCEPTED 2026-07-04): https://linear.app/dylanmccavitt/document/ard-v2-garnish-standalone-architecture-decisions-c71d90cbecef
  Prototype retro (2026-07-06): https://linear.app/dylanmccavitt/document/prototype-retro-garnish-standalone-map-seed-run-2026-07-06-7f955a42c984
  — throwaway map-seed prototype of the full v2 spec on branch `prototype/garnish-standalone`
  (never merges; proto tree deleted 2026-07-08, tombstone 196fbeb). All demo beats passed;
  spec held. PRD/ARD v2 carry "Prototype amendments (2026-07-06)" sections.
  FACTORIO PIVOT (DECIDED 2026-07-06): game design superseded — the factory vision (start
  bare like pi, automate yourself out of the loop machine-by-machine; UI is the progress bar;
  tokens are electricity; ore = procedural task families; graduation = export the factory).
  Decision ledger (9 grilled Qs): https://linear.app/dylanmccavitt/document/decision-record-factorio-pivot-2026-07-06-the-factory-vision-for-9646047ca1b0
  MAP-SEED RUN COMPLETE (2026-07-07): proto #4-#5.2 answered Q9 (crown, with the in-flow
  machine-building condition) and the founder picked the FOREMAN onboarding flow.
  Factory retro: https://linear.app/dylanmccavitt/document/prototype-retro-factory-first-hour-run-proto-4-52-2026-07-07-74183470612a
  All prototypes deleted per map-seed discipline (prototype branch tombstone 196fbeb;
  substrate reference at 8773476). The prototype branch never merges.
  PRD v3 (DRAFT for acceptance, 2026-07-08): https://linear.app/dylanmccavitt/document/prd-v3-garnish-the-factory-game-about-automating-yourself-out-of-the-edcc06551ddf
  ARD v3 (DRAFT for acceptance, 2026-07-08): https://linear.app/dylanmccavitt/document/ard-v3-garnish-factory-game-architecture-decisions-150fb0c951c4
  v3 supersedes the v2 game-design layer only; the v2 harness substrate (loop, providers,
  events, tools, approvals, sandbox, verifier, persistence, TUI substrate) survives with
  prototype amendments (ADR-10..21 dispositions in ARD v3; new ADR-22..28 for the factory).
  The three earlier TUI variants (expedition/dungeon/arcade) and the cold/ghost onboarding
  flows are dead; findings live in the retro docs.
  Implementation issues: 25 dependency-ordered issues LOO-155..LOO-179 under project
  milestones M0-M4, wired with Linear blocked-by relations. M0/M1 survive as stamped
  (2026-07-04); M2-M4 (LOO-166..179) re-stamped 2026-07-08 against factory nouns.
  - Done: LOO-155 OpenTUI spike, LOO-156 Bun+Seatbelt spike (findings verdicts on issues)
  - In review: LOO-158 delete omp surfaces (PR #22, first build PR of the factory era)
  - Unblocked (Todo): LOO-157 auth, LOO-159 event taxonomy/bus/session log
  - M0 loop+providers: LOO-160 loop core, LOO-162 Anthropic adapter, LOO-161 OpenAI adapter
  - M1 tools+safety: LOO-163 core tools, LOO-164 approvals engine, LOO-165 Seatbelt sandbox
  - M2 factory TUI: LOO-166 staged UI foundation, LOO-168 feed/transcript, LOO-167 approval
    modal + pattern wiring, LOO-169 CLI rebind
  - M3 factory core+first hour: LOO-170 verifier (+sameItem), LOO-171 factory engine/
    progression, LOO-172 FOREMAN, LOO-173 gates, LOO-174 ore families + machine ladder,
    LOO-176 headless e2e (touch-descent beats), LOO-175 exit gate: hour-0 vs hour-N (HITL)
  - M4: LOO-177 scorecards-as-power-bill, LOO-178 factory export, LOO-179 curriculum
    re-scope to machine ladder (HITL)
  Decision: fully own harness — own agent loop + TUI, omp dropped. Repeals ARD §1/ADR-8/9
  for v-next. Evolve this repo; no fresh repo. Main bus (packs, verifier, progression,
  gates, curriculum) carries over. v1 omp-coupled work (LOO-148/149/150,
  adapter/extension/runtime fallout) is paused/cancelled unless v1 maintenance is
  explicitly revived; portable pack authoring continues.

## GitHub

- Repository: https://github.com/DylanMcCavitt/garnish
- Default branch: `main`
- Visibility: public

## Workflow convention

- Use Linear for planning and issue tracking.
- Use GitHub for code delivery.
- One Linear issue -> one branch -> one PR.
- Branches should include the Linear issue identifier once implementation issues exist.
- Pull requests should link the Linear issue and rely on the GitHub/Linear bridge when configured.

## Implementation issues (stamped 2026-07-01)

29 dependency-ordered issues live in the Garnish project, wired with Linear blocked-by
relations and grouped under project milestones M0-M5 (M5 is a v2 placeholder with no issues).

- Meta / unblocked: LOO-116 (license decision, HITL), LOO-117 (Linear/GitHub bridge, HITL),
  LOO-118 (Pi extension API spike), LOO-119 (repo scaffold)
- M0 skeleton: LOO-120 core types, LOO-122 pack loader, LOO-123 progression, LOO-124 verifier
- M1 adapter + CLI: LOO-121 certified runtime, LOO-125 gate render, LOO-130 init wizard, LOO-128 CLI surface
- M2 extension: LOO-126 ext core, LOO-132 HUD/commands, LOO-129 live unlocks, LOO-135 tutor bridge,
  LOO-136 scripted E2E, LOO-139 live L0->L1 walkthrough (HITL exit gate)
- M3 core pack: LOO-127 L0, LOO-131 L1, LOO-137 L2, LOO-140 L3
- M4 core pack + polish: LOO-141 L4, LOO-142 L5, LOO-143 L6, LOO-144 L7 capstone,
  LOO-133 third-party packs, LOO-134 eject, LOO-138 polish

Content-pack chain edges (L0->...->L7) are merge order only: levels share the one in-repo core
pack and the loader rejects unknown quest ids; authoring may parallelize.

Done (merged + bridge-closed), 21 of 29: LOO-116..LOO-128 (see PRs #1-#11 above/git log),
LOO-129 live unlocks (PR #14), LOO-130 init wizard (PR #15), LOO-131 L1 pack + `approved`
event matcher (PR #12), LOO-132 HUD + /quest (PR #13), LOO-135 tutor bridge (PR #16,
live-smoke verified: "what's my quest?" answered with the real L0 checks), LOO-136
scripted E2E happy path (PR #18), LOO-137 L2 Lore pack (PR #17), LOO-139 M2 exit gate
(PR #19 — live L0->L1 walkthrough on real omp 16.2.13; evidence + 7 fixed live defects
recorded on the issue; fallout filed as LOO-148/149/150).
M0 + M1 + M2 complete. Next unblocked: LOO-140 L3 Skill Tree pack, LOO-148/149/150 fallout.
Notes: certified-runtime source for walkthroughs:
`GARNISH_OMP_SOURCE=~/.local/share/garnish/omp-source/16.2.13/omp-16.2.13` (sibling
`pi_natives.darwin-arm64.node` required next to source AND installed binary — LOO-148;
host omp GC prunes `~/.omp/natives/<old>`). Mint `omp token anthropic` immediately
before launching (short TTL). Extension redeploys need a session restart (LOO-150).
Notes: L0 status-screen uses `command(garnish status exit=0)` (no OR in the DSL);
deny-once is a real `event(tool_approval_resolved approved=false)` check per the spike.

## Notes

- License: MIT (LICENSE, commit 39fe8ef; decision recorded on LOO-116).
- Pi adapter contract findings: `docs/spikes/pi-extension-api-findings.md` (LOO-118, PR #2).
  Notable: approval denial = `tool_approval_resolved.approved=false` (no `approval_denied`
  event); `appendEntry` before `reload()` not durable headless; `PI_CODING_AGENT_DIR`
  isolates sessions/config/auth but omp still writes `~/.omp/logs/`.
