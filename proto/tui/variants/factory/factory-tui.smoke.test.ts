import { describe, expect, test } from "bun:test";
import type { HarnessEvent, HarnessEventPayload, MachineKind } from "../../../harness/types";
import { FACTORY_RESEARCH_TRACK, FACTORY_VARIANT_PLAN, type FactoryState, type PowerState, type TaskItem, type WorkMode } from "../../../factory/types";
import { agentsPaneView, circuitPaneView, deriveStage, emptyFactoryHud, factoryFloor, hiddenFactoryNewsTabs, hudFromFactoryState, initialFactoryDeckState, inventoryPaneView, nextActionHint, powerMeter, queueStripLine, reduceFactoryHud, settingsPaneView, skillsPaneView, stepDeck, touchSeriesLine } from "./model";

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

const idlePower: PowerState = {
  shiftActive: false,
  budgetTokens: 0,
  usedTokens: 0,
  brownedOut: false,
  brownouts: 0,
  shiftShipped: 0,
};

function taskItem(itemId: string, status: TaskItem["status"] = "queued", mode: WorkMode | null = null): TaskItem {
  return {
    id: itemId,
    familyId: "greeter-bug",
    variantId: FACTORY_VARIANT_PLAN[Math.max(0, Number(itemId.split("-")[1] ?? "1") - 1)] ?? "flat-greeting",
    title: `${itemId} ore`,
    brief: `${itemId} brief`,
    paths: [`src/ore/${itemId}.ts`],
    checks: [],
    status,
    mode,
    touches: 0,
  };
}

function research(doneKinds: MachineKind[] = []) {
  return FACTORY_RESEARCH_TRACK.map((entry) => ({ ...entry, done: doneKinds.includes(entry.unlocks) }));
}

function factoryState(overrides: Partial<Omit<FactoryState, "power">> & { power?: Partial<PowerState> } = {}): FactoryState {
  return {
    items: overrides.items ?? [],
    currentItemId: overrides.currentItemId ?? null,
    machines: overrides.machines ?? [],
    research: overrides.research ?? research(),
    power: { ...idlePower, ...overrides.power },
    shippedCount: overrides.shippedCount ?? 0,
    touchSeries: overrides.touchSeries ?? [],
  };
}

function shippedOre(count: number): TaskItem[] {
  return Array.from({ length: count }, (_, index) => taskItem(`item-${index + 1}`, "shipped"));
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

  test("nextActionHint follows the pinned priority rules", () => {
    const allShipped = shippedOre(FACTORY_VARIANT_PLAN.length);
    const cases: Array<[string, FactoryState, string | null]> = [
      ["brownout", factoryState({ items: [taskItem("item-6", "in-progress", "agent")], currentItemId: "item-6", power: { brownedOut: true } }), "⚡ brownout"],
      ["queue clear", factoryState({ items: allShipped, shippedCount: FACTORY_VARIANT_PLAN.length, touchSeries: allShipped.map((item) => ({ itemId: item.id, touches: 0 })) }), "queue clear"],
      ["power belt", factoryState({ items: [taskItem("item-5")], machines: [{ id: "routing-belt", kind: "routing-belt", label: "routing belt" }] }), "/power 800"],
      ["mine queued", factoryState({ items: [taskItem("item-1")] }), "/mine — item-1"],
      ["hand first", factoryState({ items: [taskItem("item-1", "in-progress", "hand")], currentItemId: "item-1" }), "/cat src/ore/item-1.ts"],
      ["hand later", factoryState({ items: [taskItem("item-2", "in-progress", "hand")], currentItemId: "item-2", shippedCount: 1 }), "ask the model for help"],
      ["agent watches", factoryState({ items: [taskItem("item-4", "in-progress", "agent")], currentItemId: "item-4" }), null],
    ];

    for (const [, state, prefix] of cases) {
      const hint = nextActionHint(state);
      if (prefix === null) expect(hint).toBeNull();
      else expect(hint?.startsWith(prefix)).toBe(true);
    }

    expect(nextActionHint(factoryState({ research: research(["bare-agent"]) }))?.startsWith("research complete — /build bare-agent")).toBe(true);
    expect(nextActionHint(factoryState({ research: research(["routing-belt"]), machines: [{ id: "bare-agent", kind: "bare-agent", label: "bare-agent" }] }))?.startsWith("research complete — /build routing-belt")).toBe(true);
    expect(nextActionHint(factoryState({ research: research(["skill"]), machines: [{ id: "routing-belt", kind: "routing-belt", label: "routing belt" }] }))?.startsWith("research complete — /forge greeter-fix")).toBe(true);
    expect(nextActionHint(factoryState({ research: research(["policy-circuit"]), machines: [{ id: "skill:greeter-fix", kind: "skill", label: "Skill: greeter-fix" }] }))?.startsWith("research complete — /wire \"read *\"")).toBe(true);
  });

  test("factoryFloor derives built active detail and belt dot state", () => {
    const shipped = shippedOre(4);
    const midShift = factoryState({
      items: [...shipped, taskItem("item-5"), taskItem("item-6", "in-progress", "agent"), taskItem("item-7")],
      currentItemId: "item-6",
      machines: [
        { id: "bare-agent", kind: "bare-agent", label: "bare-agent" },
        { id: "routing-belt", kind: "routing-belt", label: "routing belt" },
        { id: "skill:greeter-fix", kind: "skill", label: "Skill: greeter-fix" },
        { id: "policy:circuit", kind: "policy-circuit", label: "Policy Circuit" },
      ],
      power: { shiftActive: true, budgetTokens: 800, usedTokens: 120, shiftShipped: 1 },
      shippedCount: 4,
      touchSeries: shipped.map((item, index) => ({ itemId: item.id, touches: [4, 3, 4, 1][index] ?? 0 })),
    });

    const floor = factoryFloor(hudFromFactoryState(midShift), "STREAMING", 14);
    const nodes = Object.fromEntries(floor.nodes.map((node) => [node.id, node]));
    expect(nodes.ore).toMatchObject({ built: true, active: false, detail: "3 raw" });
    expect(nodes.miner).toMatchObject({ built: true, active: true, detail: "item-6" });
    expect(nodes.belt).toMatchObject({ built: true, active: true, detail: "shift on" });
    expect(nodes.assembler).toMatchObject({ built: true, active: true, detail: "greeter-fix" });
    expect(nodes.circuit).toMatchObject({ built: true, active: true, detail: "4 rules" });
    expect(nodes.ship).toMatchObject({ built: true, detail: "4 shipped · red ×4" });
    expect(floor.beltDot).toEqual({ itemId: "item-6", offset: 2 });

    const later = factoryFloor(hudFromFactoryState(midShift), "RUNNING TOOL", 23);
    expect(later.beltDot).toEqual({ itemId: "item-6", offset: 11 });

    const hourZero = factoryFloor(hudFromFactoryState(factoryState()), "AWAITING INPUT", 0);
    expect(hourZero.beltDot).toBeNull();
    expect(hourZero.nodes.map((node) => [node.id, node.built])).toEqual([
      ["ore", true],
      ["miner", false],
      ["belt", false],
      ["assembler", false],
      ["circuit", false],
      ["ship", true],
    ]);
    expect(hourZero.nodes.find((node) => node.id === "ore")?.detail).toBe("7 raw");
    expect(hourZero.nodes.find((node) => node.id === "miner")?.detail).toBe("locked · research red-1");
    expect(hourZero.nodes.find((node) => node.id === "ship")?.detail).toBe("0 shipped · red ×0");
  });

  test("stepDeck handles tabs and collapses only when the input is empty", () => {
    let deck = initialFactoryDeckState;

    deck = stepDeck(deck, "2", true);
    expect(deck).toMatchObject({ active: "inventory", collapsed: false });

    deck = stepDeck(deck, "2", true);
    expect(deck.collapsed).toBe(true);

    deck = stepDeck(deck, "2", true);
    expect(deck.collapsed).toBe(false);

    deck = stepDeck(deck, "]", true);
    expect(deck.active).toBe("skills");

    deck = stepDeck(deck, "[", true);
    expect(deck.active).toBe("inventory");

    deck = stepDeck(deck, "\\", true);
    expect(deck.collapsed).toBe(true);

    deck = stepDeck(deck, "\\", true);
    expect(deck.collapsed).toBe(false);

    deck = stepDeck(deck, "-", true);
    expect(deck.queueCollapsed).toBe(true);

    deck = stepDeck(deck, "0", true);
    expect(deck.transcriptCollapsed).toBe(true);

    expect(stepDeck(deck, "6", false)).toBe(deck);
  });

  test("pane view models expose inventory skills agents circuit and settings data", () => {
    const state = factoryState({
      items: [
        { ...taskItem("item-1", "shipped", "hand"), touches: 4 },
        taskItem("item-2", "in-progress", "agent"),
        taskItem("item-3", "queued"),
      ],
      currentItemId: "item-2",
      machines: [
        { id: "bare-agent", kind: "bare-agent", label: "burner agent", artifact: ".garnish/machines/bare-agent.md" },
        { id: "routing-belt", kind: "routing-belt", label: "routing belt" },
        { id: "skill:greeter-fix", kind: "skill", label: "Skill: greeter-fix", artifact: ".garnish/skills/greeter-fix.md" },
        { id: "policy:circuit", kind: "policy-circuit", label: "Policy Circuit", artifact: ".garnish/policies/circuit.txt" },
      ],
      shippedCount: 1,
      touchSeries: [{ itemId: "item-1", touches: 4 }],
    });
    const artifacts: Record<string, string> = {
      ".garnish/skills/greeter-fix.md": Array.from({ length: 12 }, (_, index) => `skill line ${index + 1}`).join("\n"),
      ".garnish/policies/circuit.txt": "# policy\nallow read *\nallow write src/**\n",
    };
    const readArtifact = (path: string) => artifacts[path] ?? null;

    const inventory = inventoryPaneView(state);
    expect(inventory.sciencePacks.red).toBe(1);
    expect(inventory.oreRemaining).toBe(6);
    expect(inventory.shipped).toEqual([{ itemId: "item-1", title: "item-1 ore", status: "shipped", mode: "hand", touches: 4 }]);
    expect(inventory.inProgress[0]?.itemId).toBe("item-2");
    expect(inventory.queued[0]?.itemId).toBe("item-3");

    const skills = skillsPaneView(state, readArtifact);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.label).toBe("greeter-fix");
    expect(skills[0]?.artifact.lines).toHaveLength(10);

    const agents = agentsPaneView(state, "RUNNING TOOL", "openai", "gpt-test");
    expect(agents.providerModel).toBe("openai/gpt-test");
    expect(agents.currentItemId).toBe("item-2");
    expect(agents.machines.map((machine) => machine.kind)).toEqual(["bare-agent", "routing-belt"]);

    const circuit = circuitPaneView(state, readArtifact);
    expect(circuit.patternCount).toBe(2);
    expect(circuit.machines[0]?.label).toBe("Policy Circuit");

    expect(settingsPaneView([["world", "alpha"], ["", "drop"], ["model", "gpt-test"]])).toEqual([["world", "alpha"], ["model", "gpt-test"]]);
  });

  test("hidden factory news dots follow collapsed unseen events", () => {
    const events = [
      event({ type: "item.enqueued", itemId: "item-1", familyId: "greeter-bug", variantId: "flat-greeting", title: "item-1" }),
      event({ type: "machine.built", machineId: "skill:greeter-fix", kind: "skill", label: "Skill: greeter-fix" }),
      event({ type: "machine.built", machineId: "policy:circuit", kind: "policy-circuit", label: "Policy Circuit" }),
    ];

    expect(hiddenFactoryNewsTabs("skills", events, 1, true)).toEqual({ floor: true, circuit: true });
    expect(hiddenFactoryNewsTabs("skills", events, 1, false)).toEqual({});
    expect(hiddenFactoryNewsTabs("skills", events, events.length, true)).toEqual({});
  });
});
