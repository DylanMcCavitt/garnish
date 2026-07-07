import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { scriptedStream } from "../harness/scripted";
import type { ApprovalDecision, ApprovalRequest, HarnessEvent, ScriptedTurn } from "../harness/types";
import { wireFactory } from "./wire";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "garnish-factory-wire-"));
}

function eventsOf(events: HarnessEvent[], type: HarnessEvent["type"]): HarnessEvent[] {
  return events.filter((event) => event.type === type);
}


describe("wireFactory approvals and belt", () => {
  test("approval hook locks tools, asks after bare-agent, auto-allows circuit patterns, and persists pattern approvals", async () => {
    const decisions: ApprovalDecision[] = [
      { approved: true, mode: "once" },
      { approved: true, mode: "pattern", pattern: "edit src/ore/*" },
    ];
    const requests: ApprovalRequest[] = [];
    const turns: ScriptedTurn[] = [
      { text: "locked read", toolCalls: [{ name: "read", input: { path: "README.md" } }] },
      { text: "after locked" },
      { text: "asked read", toolCalls: [{ name: "read", input: { path: "README.md" } }] },
      { text: "after asked" },
      { text: "auto read", toolCalls: [{ name: "read", input: { path: "README.md" } }] },
      { text: "after auto" },
      { text: "pattern edit", toolCalls: [{ name: "edit", input: { path: "src/ore/item-4.ts", oldString: "Goodbye, ", newString: "Hello, " } }] },
      { text: "after pattern" },
      { text: "auto edit", toolCalls: [{ name: "edit", input: { path: "src/ore/item-4.ts", oldString: ".", newString: "!" } }] },
      { text: "after auto edit" },
    ];
    const wired = await wireFactory({
      root: tempRoot(),
      provider: "scripted",
      streamFn: scriptedStream(turns),
      prompter: (request) => {
        requests.push(request);
        return Promise.resolve(decisions.shift() ?? { approved: false, mode: "deny", reason: "unexpected prompt" });
      },
    });
    try {
      const events: HarnessEvent[] = [];
      const unsubscribe = wired.sink.bus.subscribe((event) => events.push(event));
      mkdirSync(join(wired.workspace, "src", "ore"), { recursive: true });
      writeFileSync(join(wired.workspace, "src", "ore", "item-4.ts"), "export function greet(name: string): string {\n  return \"Goodbye, \" + name + \".\";\n}\n", "utf8");

      await wired.harness.send("try locked read");
      expect(events.some((event) => event.type === "tool.blocked" && event.reason === "locked" && event.teaching.includes("bare agent"))).toBe(true);

      wired.engine.buildMachine("bare-agent", { label: "Bare Agent" });
      await wired.harness.send("try read with approval");
      expect(requests.at(-1)?.tool).toBe("read");
      expect(requests.at(-1)?.risk).toBe("safe");
      expect(events.some((event) => event.type === "tool.approval.requested" && event.tool === "read" && event.risk === "safe")).toBe(true);

      await wired.wireCircuit(["read README.md"]);
      const requestedBeforeAuto = eventsOf(events, "tool.approval.requested").length;
      await wired.harness.send("try auto read");
      expect(eventsOf(events, "tool.approval.requested")).toHaveLength(requestedBeforeAuto);
      expect(events.some((event) => event.type === "tool.approval.resolved" && event.mode === "auto" && event.pattern === "read README.md")).toBe(true);

      await wired.harness.send("approve edit pattern");
      const circuitPath = join(wired.workspace, ".garnish", "policies", "circuit.txt");
      expect(readFileSync(circuitPath, "utf8")).toContain("edit src/ore/*");
      const requestedBeforeSecondEdit = eventsOf(events, "tool.approval.requested").length;
      await wired.harness.send("second edit should be auto");
      expect(eventsOf(events, "tool.approval.requested")).toHaveLength(requestedBeforeSecondEdit);
      expect(readFileSync(join(wired.workspace, "src", "ore", "item-4.ts"), "utf8")).toContain("return \"Hello, \" + name + \"!\";");
      unsubscribe();
    } finally {
      wired.stop();
    }
  });

  test("belt idles until built, sends steering, brownouts at pull-time, and resumes after feed", async () => {
    const wired = await wireFactory({
      root: tempRoot(),
      provider: "scripted",
      streamFn: scriptedStream([
        { text: "belt received" },
        { text: "burn tokens" },
        { text: "after feed" },
      ]),
      prompter: () => Promise.resolve({ approved: true, mode: "once" }),
    });
    try {
      const events: HarnessEvent[] = [];
      wired.sink.bus.subscribe((event) => events.push(event));

      await wired.beltKick();
      expect(events.some((event) => event.type === "message.user" && event.source === "steering")).toBe(false);

      wired.engine.buildMachine("routing-belt", { label: "Routing Belt" });
      await wired.beltKick();
      expect(events.some((event) => event.type === "message.user" && event.source === "steering" && event.text.startsWith("BELT:"))).toBe(true);

      const brownout = await wireFactory({
        root: tempRoot(),
        provider: "scripted",
        streamFn: scriptedStream([{ text: "usage burn" }, { text: "resumed" }]),
        prompter: () => Promise.resolve({ approved: true, mode: "once" }),
      });
      try {
        const brownoutEvents: HarnessEvent[] = [];
        brownout.sink.bus.subscribe((event) => brownoutEvents.push(event));
        const handItem = brownout.engine.startNext("hand");
        expect(handItem?.id).toBe("item-1");
        brownout.engine.buildMachine("routing-belt", { label: "Routing Belt" });
        brownout.engine.startShift(1);
        await brownout.harness.send("burn budget");
        brownout.engine.ship("item-1");
        await Promise.resolve();
        await brownout.beltKick();
        expect(brownoutEvents.some((event) => event.type === "power.brownout")).toBe(true);
        expect(brownout.engine.state().currentItemId).toBeNull();

        brownout.engine.feedGrid(100_000);
        await brownout.beltKick();
        expect(brownoutEvents.some((event) => event.type === "message.user" && event.source === "steering" && event.text.startsWith("BELT:"))).toBe(true);
        expect(brownout.engine.state().currentItemId).toBe("item-2");
      } finally {
        brownout.stop();
      }
    } finally {
      wired.stop();
    }
  });
});
