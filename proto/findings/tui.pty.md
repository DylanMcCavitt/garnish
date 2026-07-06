# TUI PTY verification note

Command attempted:

```sh
bun proto/tui/dev.tsx
```

The harness call requested a PTY (`pty: true`), but this environment reported: `pty requested but unavailable in this environment; ran without a terminal`.

Observed from the captured non-TTY run:

- The OpenTUI app started and ran the 9-second scripted demo to completion.
- The capture contained the transcript frame, quest panel, skill tree, command box, approval modal, unlock banner, and completed quest state.
- The approval modal showed the command `bun test proto/tui`, the `moderate` risk tier, the explanation, the suggested pattern, and hotkey options.
- The scripted synthetic approval key advanced the approval check and allowed the later tool result, unlock, file edit, and quest completion events to render.

Frame stability:

- No crash during the scripted run.
- A true flicker judgment is not possible from the non-TTY capture because control codes are captured as text instead of interpreted frames.

Input latency:

- The synthetic `a` key resolved the approval before the next scripted event. Human-perceived latency still needs a real terminal pass on macOS Ghostty and the Linux VM.

Verdict:

- OpenTUI + React + Bun held up for startup, bus updates, modal resolution, and timeline animation in this local run.
- True interactive smoothness remains unverified until a real PTY is available.
