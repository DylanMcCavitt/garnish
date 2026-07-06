---
name: qa
description: >
  Run functional QA for Garnish. Analyzes git diff, routes to relevant Garnish
  CLI, Pi extension, and quest-engine sub-skills, then captures terminal evidence.
---

# QA Orchestrator

SCOPE: This skill performs manual and functional QA only. It verifies Garnish by interacting with it as a terminal user or harness operator would. Do not run or report on CI checks, linting, typecheck, unit tests, or static analysis as QA results.

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for targets, app mappings, tool choices, cleanup rules, and failure learning.

## Step 2: Determine Target

Use `default_target` unless the user specifies another target.

- `local`: current checkout at `/Users/dylanmccavitt/projects/garnish`.
- `managed_droid_computer`: a managed Factory Droid Computer checkout. It must be created in Factory App under Settings -> Droid Computers before use.

Always test checked-out branch code. Garnish has no remote web environment, so never substitute a staging or production URL.

## Step 3: Analyze Git Diff

Run `git diff` and map changed files to apps using `apps.*.path_patterns` in config.

- If only `.factory/skills/**`, docs, workflow, or unrelated config files changed, report INCONCLUSIVE: "No app code changed, QA not applicable for this diff."
- If one app is affected, load only that app sub-skill.
- If multiple apps are affected, load each affected sub-skill.
- Do not load or test unaffected apps.

## Step 4: Pre-flight Checks

For affected apps only:

1. Confirm `bun` is available.
2. Confirm `tuistory` is available for interactive terminal evidence. If missing, report affected flows as BLOCKED and state: `npm install -g tuistory`.
3. Prepare isolated temp dirs for `GARNISH_ROOT`, `PI_CODING_AGENT_DIR`, `HOME`, and `OMP_AUTH_BROKER_SNAPSHOT_CACHE`.
4. For Pi/OMP extension flows, use a hermetic `GARNISH_OMP_SOURCE` or report BLOCKED if a certified runtime/stub is unavailable.

Do not run automated suites as QA. Use them only if the user explicitly asks outside this QA skill.

## Step 5: Execute Relevant Flows

For each affected app:

1. Read `.factory/skills/qa-<app-name>/SKILL.md`.
2. Choose flows that directly verify the diff, plus adjacent integration checks.
3. Include at least one negative or boundary test when applicable.
4. Never run unrelated flows just to increase coverage.

Use the `droid-control` skill for all `tuistory` interactions. The app sub-skills describe what to test; `droid-control` provides the exact terminal automation mechanics.

## Step 6: Evidence Capture

Write evidence under `qa-results/$RUN_ID/`.

For CLI/TUI evidence:

- Capture text snapshots with `tuistory` and embed trimmed snapshots in the report.
- Capture screenshots only when visual layout matters.
- Every snapshot must show a distinct state.

For browser or native desktop evidence:

- This repo currently has no browser or native desktop app surface.
- If a future surface is added, use `agent-browser` or `desktop-control` and store screenshots as artifacts, not inline broken links.

## Step 7: Quality Gate

- Prioritize changed behavior first.
- Treat integration checks as valid when they prove the change works through real commands.
- Do not run static checks, unit tests, or `bun test` as QA rows.
- Do not silently skip a flow. If it cannot complete, report it as BLOCKED with what was tried and how to fix it.
- Mark INCONCLUSIVE if you cannot identify a user-facing or harness-facing behavior to test.

## Step 8: Generate Report

Write `qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Rules:

- Start with `## QA Report`.
- Use result values exactly: `:white_check_mark: PASS`, `:x: FAIL`, `:no_entry: BLOCKED`, `:warning: FLAKY`, `:grey_question: INCONCLUSIVE`.
- Keep the report concise.
- Put all evidence in one collapsed details block.
- Do not report setup steps as test rows.

## Step 9: Failure Learning

If a BLOCKED or FAIL result reveals new environment knowledge, add a `Suggested Skill Updates` section to the report. Include the target file, severity, issue, and a copyable fix prompt.

Do not suggest updates for expected PR behavior, bad selectors in the skill, or failures already covered under Known Failure Modes.
