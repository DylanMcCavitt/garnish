import { describe, expect, test } from "bun:test";
import type { HarnessEvent, HarnessEventPayload } from "../../../harness/types";
import { deriveStage, emptyFactoryHud, powerMeter, queueStripLine, reduceFactoryHud, touchSeriesLine } from "./model";

let seq = 0;
function event(payload: HarnessEventPayload): HarnessEvent {
  seq += 1;
  return { id: `factory-tui-${seq}`, parentId: null, sessionId: "test", seq, ts: 1_700_000_000_000 + seq, ...payload } as HarnessEvent;
}

function enqueue(itemId: string, variantId = "flat-greeting"): HarnessEvent {
  return event({ type: "item.enqueued", itemId, familyId: "greeter-bug", variantId, title: `${itemId} ${variantId}` });
}

function touches(itemId: string, count: number): HarnessEvent[] {
  return Array.from({ length: count }, (_, index) => event({ type: "touch.recorded", itemId, kind: index === 0 ? "prompt" : "hand-edit" }));
}

describe("factory TUI model", () => {
  test("derives stages only at pinned boundaries", () => {
    const twoItems = [enqueue("item-1", "wrong-greeting"), enqueue("item-2")];
    expect(deriveStage(twoItems)).toBe(0);

    const threeItems = [...twoItems, enqueue("item-3")];
    expect(deriveStage(threeItems)).toBe(1);

    expect(deriveStage([...threeItems, event({ type: "machine.built", machineId: "routing-belt", kind: "routing-belt", label: "routing belt" })])).toBe(2);
  });

  test("folds the canonical first-hour HUD descent and power flags", () => {
    let hud = emptyFactoryHud();
    let brownoutLine = "";
    const events = [
      enqueue("item-1", "wrong-greeting"),
      event({ type: "item.started", itemId: "item-1", mode: "hand" }),
      ...touches("item-1", 4),
      event({ type: "item.shipped", itemId: "item-1", touches: 4, science: "red" }),
      enqueue("item-2"),
      enqueue("item-3"),
      event({ type: "item.started", itemId: "item-2", mode: "agent" }),
      ...touches("item-2", 3),
      event({ type: "item.shipped", itemId: "item-2", touches: 3, science: "red" }),
      event({ type: "research.completed", researchId: "research-red-1", label: "Burner Mining", unlocks: "bare-agent", shipped: 2 }),
      event({ type: "machine.built", machineId: "bare-agent", kind: "bare-agent", label: "bare agent" }),
      enqueue("item-4", "wrong-greeting"),
      enqueue("item-5"),
      event({ type: "item.started", itemId: "item-3", mode: "agent" }),
      ...touches("item-3", 4),
      event({ type: "item.shipped", itemId: "item-3", touches: 4, science: "red" }),
      event({ type: "research.completed", researchId: "research-red-2", label: "Logistics", unlocks: "routing-belt", shipped: 3 }),
      event({ type: "research.completed", researchId: "research-red-3", label: "Assembly", unlocks: "skill", shipped: 3 }),
      event({ type: "research.completed", researchId: "research-red-4", label: "Circuit Network", unlocks: "policy-circuit", shipped: 3 }),
      event({ type: "machine.built", machineId: "routing-belt", kind: "routing-belt", label: "routing belt" }),
      event({ type: "machine.built", machineId: "skill:greeter-fix", kind: "skill", label: "greeter fix" }),
      event({ type: "machine.built", machineId: "policy:circuit", kind: "policy-circuit", label: "policy circuit" }),
      enqueue("item-6", "wrong-greeting"),
      enqueue("item-7"),
      event({ type: "item.started", itemId: "item-4", mode: "agent" }),
      ...touches("item-4", 1),
      event({ type: "item.shipped", itemId: "item-4", touches: 1, science: "red" }),
      event({ type: "shift.started", budgetTokens: 100 }),
      event({ type: "item.started", itemId: "item-5", mode: "agent" }),
      event({ type: "assistant.end", message: { role: "assistant", text: "done", toolCalls: [], stopReason: "end_turn" }, usage: { inputTokens: 60, outputTokens: 45 } }),
      event({ type: "item.shipped", itemId: "item-5", touches: 0, science: "red" }),
      event({ type: "power.brownout", usedTokens: 105, budgetTokens: 100, itemId: null }),
      event({ type: "touch.recorded", itemId: null, kind: "power", detail: "feed grid" }),
      event({ type: "item.started", itemId: "item-6", mode: "agent" }),
      event({ type: "item.shipped", itemId: "item-6", touches: 0, science: "red" }),
      event({ type: "item.started", itemId: "item-7", mode: "agent" }),
      event({ type: "item.shipped", itemId: "item-7", touches: 0, science: "red" }),
      event({ type: "shift.ended", itemsShipped: 3, brownouts: 1, touches: 1 }),
    ];

    for (const next of events) {
      hud = reduceFactoryHud(hud, next);
      if (next.type === "power.brownout") brownoutLine = powerMeter(hud, 8);
    }

    expect(hud.touchSeries.map((item) => item.touches)).toEqual([4, 3, 4, 1, 0, 0, 0]);
    expect(hud.sciencePacks.red).toBe(7);
    expect(brownoutLine).toContain("BROWNOUT");
    expect(brownoutLine).toContain("⚡ 105/100");
    expect(hud.brownoutFlash).toBe(false);
    expect(hud.power.brownedOut).toBe(false);
    expect(hud.machines.map((machine) => machine.kind)).toEqual(["bare-agent", "routing-belt", "skill", "policy-circuit"]);
    expect(hud.researchDone.map((research) => research.researchId)).toEqual(["research-red-1", "research-red-2", "research-red-3", "research-red-4"]);
  });

  test("renders strip, touch, and meter markers", () => {
    let hud = emptyFactoryHud();
    for (const next of [enqueue("item-1", "wrong-greeting"), event({ type: "item.started", itemId: "item-1", mode: "hand" }), event({ type: "item.shipped", itemId: "item-1", touches: 4, science: "red" })]) {
      hud = reduceFactoryHud(hud, next);
    }

    expect(queueStripLine(hud)).toContain("✓ item-1");
    expect(touchSeriesLine(hud)).toBe("TOUCHES/ITEM 4");
    expect(powerMeter(hud, 6)).toContain("⚡ 0/0 IDLE");
  });
});
