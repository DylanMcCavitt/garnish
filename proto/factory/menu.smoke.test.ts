import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { scriptedStream } from "../harness/scripted";
import type { ApprovalDecision } from "../harness/types";
import { initialMenuState, stepMenu } from "../tui/variants/factory/menu-screen";
import { GREETER_BUG_FAMILY } from "./ore";
import { listWorldSlots, parseWorldMenuChoice, renderWorldSlot, slugWorldName } from "./menu";
import { wireFactory } from "./wire";

const tempRoots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "garnish-factory-menu-"));
  tempRoots.push(root);
  return root;
}

function writeWorld(root: string, slug: string, summary: unknown): void {
  const world = join(root, "worlds", slug);
  mkdirSync(world, { recursive: true });
  writeFileSync(join(world, "world.json"), typeof summary === "string" ? summary : `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("factory world menu", () => {
  test("slugging lowercases names and maps non-alphanumerics to stable dashes", () => {
    expect(slugWorldName("Demo Kitchen")).toBe("demo-kitchen");
    expect(slugWorldName("  Red Science #7!! ")).toBe("red-science-7");
    expect(slugWorldName("---")).toBe("world");
  });

  test("lists world summaries and renders fresh slots for corrupt world files", () => {
    const root = tempRoot();
    const now = Date.parse("2026-07-07T12:00:00.000Z");
    writeWorld(root, "alpha-kitchen", {
      name: "demo-kitchen",
      shipped: 7,
      science: { red: 7 },
      machines: ["bare-agent", "routing-belt", "skill", "policy-circuit"],
      updatedAt: "2026-07-07T11:58:00.000Z",
    });
    writeWorld(root, "beta-lab", {
      name: "beta-lab",
      shipped: 2,
      science: { red: 2 },
      machines: ["bare-agent"],
      updatedAt: "2026-07-07T10:00:00.000Z",
    });
    writeWorld(root, "zz-corrupt", "{nope");

    const slots = listWorldSlots(root);

    expect(slots.map((slot) => ({ slug: slot.slug, name: slot.name, fresh: slot.summary === null }))).toEqual([
      { slug: "alpha-kitchen", name: "demo-kitchen", fresh: false },
      { slug: "beta-lab", name: "beta-lab", fresh: false },
      { slug: "zz-corrupt", name: "zz-corrupt", fresh: true },
    ]);
    expect(renderWorldSlot(slots[0]!, 0, now)).toBe("1) demo-kitchen — 7 shipped · red ×7 · 4 machines · 2m ago");
    expect(renderWorldSlot(slots[1]!, 1, now)).toBe("2) beta-lab — 2 shipped · red ×2 · 1 machines · 2h ago");
    expect(renderWorldSlot(slots[2]!, 2, now)).toBe("3) zz-corrupt — fresh world —");
  });

  test("parses digit, new-world, and quit choices", () => {
    expect(parseWorldMenuChoice("1", 2)).toEqual({ type: "select", index: 0 });
    expect(parseWorldMenuChoice("2", 2)).toEqual({ type: "select", index: 1 });
    expect(parseWorldMenuChoice("3", 2)).toBeNull();
    expect(parseWorldMenuChoice("n", 2)).toEqual({ type: "new" });
    expect(parseWorldMenuChoice("Q", 2)).toEqual({ type: "quit" });
    expect(parseWorldMenuChoice("", 2)).toBeNull();
  });

  test("stepMenu moves selection, jumps by digit, and selects on enter", () => {
    let step = stepMenu(initialMenuState(3), { type: "down" });
    expect(step).toEqual({ state: { mode: "select", selected: 1, slotCount: 3, nameInput: "" }, action: null });

    step = stepMenu(step.state, { type: "up" });
    expect(step.state.selected).toBe(0);

    step = stepMenu(step.state, { type: "digit", value: 3 });
    expect(step.state.selected).toBe(2);
    expect(step.action).toBeNull();

    step = stepMenu(step.state, { type: "enter" });
    expect(step.action).toEqual({ type: "select", index: 2 });
  });

  test("stepMenu creates inline-named worlds and escape cancels naming", () => {
    let step = stepMenu(initialMenuState(2), { type: "new" });
    expect(step.state.mode).toBe("name");

    step = stepMenu(step.state, { type: "char", value: "R" });
    step = stepMenu(step.state, { type: "char", value: "e" });
    step = stepMenu(step.state, { type: "char", value: "d" });
    step = stepMenu(step.state, { type: "backspace" });
    step = stepMenu(step.state, { type: "enter" });
    expect(step.action).toEqual({ type: "create", name: "Re" });
    expect(step.state).toEqual({ mode: "select", selected: 0, slotCount: 2, nameInput: "" });

    step = stepMenu(step.state, { type: "new" });
    step = stepMenu(step.state, { type: "escape" });
    expect(step).toEqual({ state: { mode: "select", selected: 0, slotCount: 2, nameInput: "" }, action: null });
  });

  test("wire writes world.json summary after hand-shipping one item", async () => {
    const root = tempRoot();
    const approval: ApprovalDecision = { approved: true, mode: "auto" };
    const wired = await wireFactory({
      root,
      worldName: "smoke",
      streamFn: scriptedStream([]),
      provider: "scripted",
      prompter: async () => approval,
    });

    try {
      const item = wired.engine.startNext("hand");
      expect(item?.id).toBe("item-1");
      const variant = GREETER_BUG_FAMILY.variants.find((candidate) => candidate.id === item?.variantId);
      expect(variant).toBeDefined();
      for (const fix of variant!.handFixes("item-1")) {
        await wired.hand.edit(fix);
        await wired.verifier.settled();
      }
      await wired.verifier.poke();
      await wired.verifier.settled();

      const summary = JSON.parse(readFileSync(join(root, "world.json"), "utf8")) as {
        name: string;
        shipped: number;
        science: { red: number };
        machines: string[];
        updatedAt: string;
      };
      expect(summary).toMatchObject({ name: "smoke", shipped: 1, science: { red: 1 }, machines: [] });
      expect(Number.isFinite(Date.parse(summary.updatedAt))).toBe(true);
    } finally {
      wired.stop();
    }
  });
});
