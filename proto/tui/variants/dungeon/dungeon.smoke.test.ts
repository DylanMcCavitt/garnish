import { describe, expect, test } from "bun:test";
import { buildAtlas } from "../../../game/atlas";
import type { HarnessEvent, HarnessEventPayload } from "../../../harness/types";
import { dungeonEventLine, dungeonFloorsFromAtlas, emptyHeartState, heartGlyphs, reduceHearts } from "./model";

let seq = 0;
function event(payload: HarnessEventPayload): HarnessEvent {
  seq += 1;
  return { id: `dungeon-${seq}`, parentId: null, sessionId: "test", seq, ts: seq, ...payload } as HarnessEvent;
}

function atlas(completed: string[], activeQuestId: string | null = null) {
  return buildAtlas({ completedQuests: new Set(completed), unlockedIds: new Set(), activeQuestId });
}

describe("dungeon variant pure seams", () => {
  test("derives floors and rooms from atlas progression", () => {
    const floors = dungeonFloorsFromAtlas(atlas(["mise-en-place"], "look-around"));

    expect(floors[0]?.rooms.map((room) => [room.id, room.state, room.boss])).toEqual([
      ["mise-en-place", "done", false],
      ["look-around", "active", false],
    ]);
    expect(floors[2]?.rooms[0]).toMatchObject({ id: "fix-bug-prove-it", state: "locked", boss: true });
    expect(floors[3]?.rooms.every((room) => room.state === "fog")).toBe(true);
  });

  test("heart reducer spends on denials and blocks, bottoms out with teaching, and refills on clear", () => {
    let hearts = emptyHeartState();

    hearts = reduceHearts(hearts, event({ type: "tool.approval.resolved", callId: "a", approved: false, mode: "deny" }));
    hearts = reduceHearts(hearts, event({ type: "tool.blocked", callId: "b", tool: "bash", reason: "locked", teaching: "Unlock bash first." }));
    hearts = reduceHearts(hearts, event({ type: "tool.blocked", callId: "c", tool: "edit", reason: "locked", teaching: "Unlock edit first." }));
    hearts = reduceHearts(hearts, event({ type: "tool.blocked", callId: "d", tool: "write", reason: "locked", teaching: "Unlock write first." }));

    expect(hearts.hearts).toBe(0);
    expect(heartGlyphs(hearts.hearts)).toBe("♡♡♡");
    expect(hearts.teaching).toContain("the dungeon humbles you");

    hearts = reduceHearts(hearts, event({ type: "quest.completed", questId: "look-around", xp: 75 }));
    expect(heartGlyphs(hearts.hearts)).toBe("♥♥♥");
    expect(dungeonEventLine(event({ type: "unlock.applied", unlockId: "l1-shell", tools: ["bash"] }))).toContain("LOOT you picked up: bash");
  });
});
