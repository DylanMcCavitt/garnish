import { describe, expect, test } from "bun:test";
import type { HarnessEvent, HarnessEventPayload, Scorecard } from "../../../harness/types";
import { buildAchievements, buildChallengeChips, hiddenNewsTabs, xpBar } from "./model";

let seq = 0;
function event(payload: HarnessEventPayload): HarnessEvent {
  seq += 1;
  return { id: `expedition-${seq}`, parentId: null, sessionId: "test", seq, ts: 1_700_000_000_000 + seq, ...payload } as HarnessEvent;
}

function scorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    sessionId: "test",
    tokens: { input: 1000, output: 500 },
    wallTimeMs: 100,
    diffBytes: 12,
    promptCount: 2,
    approvals: { approved: 1, denied: 0, auto: 0 },
    blocked: 0,
    ...overrides,
  };
}

describe("expedition pure reducers", () => {
  test("renders XP in block eighths with stable width", () => {
    expect(xpBar(0, 4)).toBe("    ");
    expect(xpBar(250, 4)).toBe("██  ");
    expect(xpBar(499, 4)).toHaveLength(4);
    expect(xpBar(500, 4)).toBe("    ");
  });

  test("derives meaningful achievements from event history and scorecard", () => {
    const events = [
      event({ type: "unlock.applied", unlockId: "l0-hands", tools: ["write", "edit"] }),
      event({ type: "file.edited", path: "src/greeter.ts", kind: "edit", summary: "fixed greeter" }),
      event({ type: "tool.approval.resolved", callId: "c1", approved: false, mode: "deny-with-reason", reason: "show diff" }),
      event({ type: "quest.completed", questId: "fix-bug-prove-it", xp: 125 }),
    ];

    const achievements = buildAchievements(events, scorecard());
    expect(achievements.filter((achievement) => achievement.earned).map((achievement) => achievement.id)).toEqual([
      "first-unlock",
      "first-edit",
      "approval-captain",
      "teach-back",
      "boss-slayer",
    ]);
  });

  test("scores live challenges as pass and warning chips", () => {
    const events = [event({ type: "file.edited", path: "a.ts", kind: "write", summary: "created" })];
    const chips = buildChallengeChips(scorecard({ approvals: { approved: 0, denied: 1, auto: 0 }, blocked: 2, tokens: { input: 24_000, output: 2_000 } }), events);
    expect(chips.map((chip) => [chip.id, chip.passed])).toEqual([
      ["clean-comms", false],
      ["lean-burn", false],
      ["no-doom-loops", false],
      ["ship-proof", false],
    ]);
  });

  test("marks hidden deck tabs with alert dots for collapsed progress", () => {
    const events = [
      event({ type: "message.user", source: "player", text: "go" }),
      event({ type: "unlock.applied", unlockId: "l1-shell", tools: ["bash"] }),
      event({ type: "tool.approval.resolved", callId: "c1", approved: true, mode: "once" }),
    ];
    const news = hiddenNewsTabs("quests", events, buildAchievements(events, scorecard()), 1, true);
    expect(news.unlocks).toBe(true);
    expect(news.progress).toBe(true);
    expect(news.quests).toBeUndefined();
  });
});
