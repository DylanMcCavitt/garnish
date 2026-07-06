import { describe, expect, test } from "bun:test";
import type { HarnessEvent, HarnessEventPayload } from "../harness/types";
import { emptyStatus, emptyTranscript, glyphLegend, momentFromEvent, reduceStatus, reduceTranscript, stepApprovalModal } from "./index";

let seq = 0;
function event(payload: HarnessEventPayload, parentId: string | null = null): HarnessEvent {
  seq += 1;
  return { id: `test-${seq}`, parentId, sessionId: "test", seq, ts: seq, ...payload } as HarnessEvent;
}

describe("TUI pure seams", () => {
  test("reduces streamed assistant text, tool chips, blocked teaching, and file edits", () => {
    let model = emptyTranscript();
    model = reduceTranscript(model, event({ type: "message.user", source: "player", text: "hello" }));
    model = reduceTranscript(model, event({ type: "assistant.thinking.delta", text: "checking" }));
    model = reduceTranscript(model, event({ type: "assistant.delta", text: "Hi " }));
    model = reduceTranscript(model, event({ type: "assistant.delta", text: "there" }));
    model = reduceTranscript(model, event({ type: "assistant.end", message: { role: "assistant", text: "Hi there", toolCalls: [], stopReason: "end_turn" } }));
    model = reduceTranscript(model, event({ type: "tool.call", callId: "c1", tool: "read", input: { path: "x.ts" } }));
    model = reduceTranscript(model, event({ type: "tool.blocked", callId: "c2", tool: "edit", reason: "locked", teaching: "Finish the quest first." }));
    model = reduceTranscript(model, event({ type: "file.edited", path: "x.ts", kind: "edit", summary: "changed one line" }));

    expect(model.assistantDraft).toBe("");
    expect(model.thinkingDraft).toBe("");
    expect(model.entries.map((entry) => entry.kind)).toEqual(["user", "thinking", "assistant", "tool", "blocked", "file"]);
    expect(model.entries.at(-1)?.body).toContain("changed one line");
  });

  test("maps game events to glyph legend moments", () => {
    const quest = momentFromEvent(event({ type: "quest.completed", questId: "q1", xp: 75 }));
    const unlock = momentFromEvent(event({ type: "unlock.applied", unlockId: "u1", tools: ["edit", "bash"] }));

    expect(quest?.glyph).toBe(glyphLegend["quest.completed"]?.glyph);
    expect(quest?.line).toContain("+75");
    expect(quest?.line).toContain("q1");
    expect(unlock?.line).toContain("edit");
  });

  test("reduces mission status from bus events", () => {
    let status = emptyStatus();
    status = reduceStatus(status, event({ type: "turn.start", turn: 1 }));
    expect(status.status).toBe("STREAMING");
    status = reduceStatus(status, event({ type: "tool.call", callId: "c1", tool: "read", input: {} }));
    expect(status.status).toBe("RUNNING TOOL");
    status = reduceStatus(status, event({ type: "tool.approval.requested", callId: "c2", tool: "bash", command: "bun test ./proto/tui", risk: "moderate", explanation: "slice-only" }));
    expect(status.status).toBe("AWAITING APPROVAL");
    status = reduceStatus(status, event({ type: "tool.approval.resolved", callId: "c2", approved: true, mode: "once" }));
    expect(status.status).toBe("RUNNING TOOL");
    status = reduceStatus(status, event({ type: "tool.result", callId: "c1", tool: "read", output: "ok", isError: false }));
    expect(status.status).toBe("STREAMING");
    status = reduceStatus(status, event({ type: "assistant.end", message: { role: "assistant", text: "done", toolCalls: [], stopReason: "end_turn" } }));
    expect(status.status).toBe("AWAITING INPUT");
    status = reduceStatus(status, event({ type: "turn.end", turn: 1, stopReason: "aborted" }));
    expect(status.status).toBe("ABORTED");
  });

  test("approval modal state machine resolves each keyboard path", () => {
    const state = { request: { callId: "c1", tool: "bash", command: "bun test proto/tui", risk: "moderate" as const, explanation: "slice-only", suggestedPattern: "bun test proto/tui" }, reason: "", mode: "menu" as const };

    expect(stepApprovalModal(state, { type: "key", key: "a" }).decision).toEqual({ approved: true, mode: "once" });
    expect(stepApprovalModal(state, { type: "key", key: "p" }).decision).toEqual({ approved: true, mode: "pattern", pattern: "bun test proto/tui" });
    expect(stepApprovalModal(state, { type: "key", key: "d" }).decision).toEqual({ approved: false, mode: "deny" });

    const askingReason = stepApprovalModal(state, { type: "key", key: "r" }).state;
    expect(askingReason?.mode).toBe("reason");
    const withReason = stepApprovalModal(askingReason!, { type: "reason", value: "too broad" }).state!;
    expect(stepApprovalModal(withReason, { type: "key", key: "enter" }).decision).toEqual({ approved: false, mode: "deny-with-reason", reason: "too broad" });
  });
});
