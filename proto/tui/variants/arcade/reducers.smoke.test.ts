import { describe, expect, test } from "bun:test";
import type { HarnessEvent, Scorecard } from "../../../harness/types";
import { arcadeScore, emptyCombo, rankQuest, reduceCombo } from "./reducers";

const event = (payload: { type: HarnessEvent["type"]; [key: string]: unknown }): HarnessEvent => ({
  id: `e-${payload.type}`,
  sessionId: "s-1",
  seq: 1,
  ts: 1,
  ...payload,
} as HarnessEvent);

const scorecard = (overrides: Partial<Scorecard> = {}): Scorecard => ({
  sessionId: "s-1",
  tokens: { input: 10_000, output: 4_000 },
  wallTimeMs: 120_000,
  diffBytes: 42,
  promptCount: 3,
  approvals: { approved: 1, denied: 0, auto: 0 },
  blocked: 0,
  ...overrides,
});

describe("arcade combo reducer", () => {
  test("clean tool results build multiplier and peak", () => {
    const clean = event({ type: "tool.result", callId: "c1", tool: "read", output: "ok", isError: false });
    const state = [clean, clean, clean, clean, clean].reduce(reduceCombo, emptyCombo());
    expect(state).toMatchObject({ chain: 5, multiplier: 3, peak: 3, breakText: null });
  });

  const breakCases: Array<[HarnessEvent, string]> = [
    [event({ type: "tool.result", callId: "c1", tool: "bash", output: "boom", isError: true }), "COMBO BREAK · bash ERROR"],
    [event({ type: "tool.blocked", callId: "c1", tool: "write", reason: "sandbox", teaching: "nope" }), "COMBO BREAK · SANDBOX BLOCK"],
    [event({ type: "tool.approval.resolved", callId: "c1", approved: false, mode: "deny-with-reason", reason: "show diff" }), "COMBO BREAK · DENIAL BREAK"],
    [event({ type: "error", message: "bad" }), "COMBO BREAK · SYSTEM ERROR"],
  ];
  test.each(breakCases)("breaks on %p", (breaker, text) => {
    const clean = event({ type: "tool.result", callId: "c0", tool: "read", output: "ok", isError: false });
    const state = reduceCombo(reduceCombo(emptyCombo(), clean), breaker);
    expect(state.chain).toBe(0);
    expect(state.multiplier).toBe(1);
    expect(state.breakText).toBe(text);
  });
});

describe("arcade rank and score reducers", () => {
  const rankCases: Array<[Scorecard, number, "S" | "A" | "B" | "C"]> = [
    [scorecard(), 4, "S"],
    [scorecard({ tokens: { input: 20_000, output: 20_000 }, wallTimeMs: 240_000 }), 2, "A"],
    [scorecard({ tokens: { input: 50_000, output: 5_000 }, wallTimeMs: 400_000, approvals: { approved: 1, denied: 1, auto: 0 } }), 1, "C"],
    [scorecard({ tokens: { input: 30_000, output: 5_000 }, wallTimeMs: 200_000, blocked: 1 }), 2, "B"],
  ];
  test.each(rankCases)("grades rank %s with combo %i as %s", (card, comboPeak, expected) => {
    expect(rankQuest(card, comboPeak).rank).toBe(expected);
  });

  test("score is xp times 1000 plus efficiency bonus", () => {
    expect(arcadeScore(scorecard(), { xp: 7, level: 2 })).toMatchObject({ xpBase: 7, xpScore: 7000, efficiencyBonus: 36000, total: 43000, tokens: 14000 });
  });
});
