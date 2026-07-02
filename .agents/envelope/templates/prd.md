# PRD — {{FEATURE_NAME}}

> Synthesized from existing context by `blueprint`; no interview performed.
> Published as a Linear document on the target Garnish project (see
> `.agents/envelope/linear-map.md`). Use the glossary in
> `.agents/envelope/domain.md` for every term below.

## Problem

The problem in the learner's words and reality. Why it matters now.

## Solution

The intended outcome from the learner's perspective. What changes for them, and
how they will know it changed.

## User stories

A numbered, exhaustive list. Each entry: As a {{actor}}, I want {{capability}},
so that {{benefit}}.

## Decisions

The decisions this spec encodes: the modules/interfaces touched (named in
glossary terms — harness, TUI, verifier, progression, packs, gates, tutor),
contracts, schema or state changes, and key interactions. Prose, no file paths.
The one exception: a decision-encoding prototype snippet (state machine,
reducer, schema, type shape) inlined only where prose is less precise.

## Non-goals

What this explicitly does NOT do. Each non-goal closes a door so scope cannot
creep.

## Acceptance criteria

- [ ] {{observable, testable outcome}}
- [ ] {{observable, testable outcome}}

## Proof plan

How an agent proves each acceptance criterion without expanding scope: the seams
to test (prefer the highest existing seam — verifier/progression/pack semantics
have reusable tests), the checks to run, and the evidence to capture.

## Open questions / further notes

Anything unresolved. If a genuine unknown blocks the spec, route to `research`
first.
