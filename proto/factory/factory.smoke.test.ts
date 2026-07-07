import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { createEventSink, type HarnessEvent } from "../harness";
import { createFactoryEngine } from "./engine";
import { createHandActions } from "./hand";
import { GREETER_BUG_FAMILY } from "./ore";
import { FACTORY_RESEARCH_TRACK, FACTORY_VARIANT_PLAN } from "./types";
import { evaluateChecks, startShipVerifier } from "./verify";

const tempRoots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "garnish-factory-"));
  tempRoots.push(root);
  return root;
}

function createRig() {
  const root = tempRoot();
  const workspace = join(root, "workspace");
  const sink = createEventSink({ sessionId: "factory-smoke", logPath: join(root, "sessions", "factory.jsonl") });
  const events: HarnessEvent[] = [];
  sink.bus.subscribe((event) => events.push(event));
  const engine = createFactoryEngine({
    sink,
    workspace,
    family: GREETER_BUG_FAMILY,
    variantPlan: FACTORY_VARIANT_PLAN,
    research: FACTORY_RESEARCH_TRACK,
  });
  const hand = createHandActions({ engine, workspace, sink, send: async (text) => {
    sink.emit({ type: "message.user", source: "player", text });
  } });
  return { root, workspace, sink, events, engine, hand };
}

async function flushFactoryWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("factory core", () => {
  test("enqueue scaffolds broken ore and evaluateChecks fails before hand fixes then passes and ships", async () => {
    const { workspace, sink, engine, hand } = createRig();
    const [item] = await engine.enqueue(1);
    expect(item).toMatchObject({ id: "item-1", familyId: "greeter-bug", variantId: "wrong-greeting", status: "queued" });
    expect(readFileSync(join(workspace, "src", "ore", "item-1.ts"), "utf8")).toBe('export function greet(name: string): string {\n  return "Goodbye, " + name + ".";\n}\n');

    const failing = await evaluateChecks({ checks: item.checks, workspace, events: sink.log.read().map((event) => ({ name: event.type, sessionId: event.sessionId, seq: event.seq, payload: event })) });
    expect(failing.pass).toBe(false);
    expect(failing.lines.map((line) => line.done)).toEqual([false, false, false]);

    expect(engine.startNext("hand")?.id).toBe("item-1");
    const verifier = startShipVerifier({ sink, engine, workspace, evaluateChecks });
    const variant = GREETER_BUG_FAMILY.variants.find((candidate) => candidate.id === "wrong-greeting");
    expect(variant).toBeDefined();
    for (const fix of variant!.handFixes("item-1")) {
      await hand.edit(fix);
      await verifier.settled();
    }
    await verifier.poke();

    const passing = await evaluateChecks({ checks: item.checks, workspace, events: sink.log.read().map((event) => ({ name: event.type, sessionId: event.sessionId, seq: event.seq, payload: event })) });
    expect(passing.pass).toBe(true);
    expect(passing.lines.map((line) => line.done)).toEqual([true, true, true]);
    expect(engine.state().items.find((candidate) => candidate.id === "item-1")?.status).toBe("shipped");
    expect(sink.log.read().some((event) => event.type === "item.shipped" && event.itemId === "item-1" && event.touches === 2 && event.science === "red")).toBe(true);
    verifier.stop();
  });

  test("touch folds count player prompts, paste-backs, and non-auto approvals only on the in-progress item", async () => {
    const { sink, engine } = createRig();
    await engine.enqueue(1);
    expect(engine.startNext("agent")?.id).toBe("item-1");

    sink.emit({ type: "message.user", source: "player", text: "please fix it" });
    sink.emit({ type: "message.user", source: "steering", text: "belt brief" });
    sink.emit({ type: "message.user", source: "tutor", text: "hint" });
    sink.emit({ type: "message.user", source: "player", text: "PASTE: grep output" });
    sink.emit({ type: "tool.approval.resolved", callId: "auto", approved: true, mode: "auto" });
    sink.emit({ type: "tool.approval.resolved", callId: "once", approved: true, mode: "once" });

    expect(engine.state().items[0]?.touches).toBe(3);
    engine.ship("item-1");
    expect(engine.state().touchSeries).toEqual([{ itemId: "item-1", touches: 3 }]);
    const touches = sink.log.read().filter((event) => event.type === "touch.recorded");
    expect(touches.map((event) => event.kind)).toEqual(["prompt", "paste-back", "approval"]);
    expect(touches.map((event) => event.itemId)).toEqual(["item-1", "item-1", "item-1"]);
  });

  test("research thresholds fire once and auto-enqueue two items for only the first three ships", async () => {
    const { engine, sink } = createRig();
    await engine.enqueue(1);

    for (let index = 1; index <= 4; index += 1) {
      expect(engine.startNext("hand")?.id).toBe(`item-${index}`);
      engine.ship(`item-${index}`);
      await flushFactoryWork();
    }

    const state = engine.state();
    expect(state.items.map((item) => item.id)).toEqual(["item-1", "item-2", "item-3", "item-4", "item-5", "item-6", "item-7"]);
    expect(state.items.filter((item) => item.status === "queued").map((item) => item.id)).toEqual(["item-5", "item-6", "item-7"]);
    expect(state.research.map((research) => ({ id: research.id, done: research.done }))).toEqual([
      { id: "research-red-1", done: true },
      { id: "research-red-2", done: true },
      { id: "research-red-3", done: true },
      { id: "research-red-4", done: true },
    ]);
    expect(sink.log.read().filter((event) => event.type === "research.completed").map((event) => [event.researchId, event.unlocks, event.shipped])).toEqual([
      ["research-red-1", "bare-agent", 2],
      ["research-red-2", "routing-belt", 3],
      ["research-red-3", "skill", 3],
      ["research-red-4", "policy-circuit", 3],
    ]);
    expect(sink.log.read().filter((event) => event.type === "item.enqueued")).toHaveLength(7);
  });

  test("power brownout latches until feedGrid and power touches are factory-level", () => {
    const { sink, engine } = createRig();
    engine.startShift(10);
    sink.emit({
      type: "assistant.end",
      message: { role: "assistant", text: "small", toolCalls: [], stopReason: "end_turn" },
      usage: { inputTokens: 3, outputTokens: 4 },
    });
    expect(engine.drawPower()).toBe(true);
    sink.emit({
      type: "assistant.end",
      message: { role: "assistant", text: "large", toolCalls: [], stopReason: "end_turn" },
      usage: { inputTokens: 10, outputTokens: 0 },
    });
    expect(engine.drawPower()).toBe(false);
    expect(engine.drawPower()).toBe(false);
    engine.feedGrid(20);
    expect(engine.drawPower()).toBe(true);
    engine.endShift();

    const brownouts = sink.log.read().filter((event) => event.type === "power.brownout");
    expect(brownouts).toHaveLength(1);
    expect(brownouts[0]).toMatchObject({ usedTokens: 17, budgetTokens: 10, itemId: null });
    const powerTouches = sink.log.read().filter((event) => event.type === "touch.recorded" && event.kind === "power");
    expect(powerTouches).toHaveLength(1);
    expect(powerTouches[0]).toMatchObject({ itemId: null, kind: "power", detail: "+20" });
    expect(sink.log.read().find((event) => event.type === "shift.ended")).toMatchObject({ itemsShipped: 0, brownouts: 1, touches: 1 });
  });
});
