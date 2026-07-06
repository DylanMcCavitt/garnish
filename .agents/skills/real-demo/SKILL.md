---
name: real-demo
description: Renders repo demo surfaces to actual mp4 proof files instead of describing them. Use when the user says "real demo", "record the demo", "demo mp4", "demo video", or "show me it running".
---

# Real Demo

A "real demo" in this repo means: render the actual runnable surface to an mp4 file and return the file path. Do not substitute a written description, transcript, or static screenshot when an mp4 can be produced.

## Commands

- Headless prototype walkthrough: `bun run demo:mp4`
- Interactive TUI prototype: `bun run demo:mp4:tui`

Outputs land under `demo/`, which is gitignored. Attach or link the generated mp4 path for the user; never commit generated demo videos.

## Prerequisites

Install VHS before recording:

- macOS: `brew install vhs`
- Linux / Cursor VM: `go install github.com/charmbracelet/vhs@latest` or install from the Charm apt repository

VHS depends on `ffmpeg` and `ttyd`; packaged installs generally include or document those dependencies. If using `go install`, ensure all three binaries are on `PATH` before recording.

## Tuning and proof rule

Tape sleeps are intentionally generous but may need tuning after UI layout, streaming, or pacing changes. After any user-visible TUI or demo change, re-record the affected mp4 and share the new file path as proof.

This applies to any runnable demo surface in this repo, not only the prototype. Keep tapes in `scripts/` and name them `<surface>.tape`.
