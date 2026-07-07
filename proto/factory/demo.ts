/**
 * PROTOTYPE — THROWAWAY. Proto #4: Factorio first-hour factory slice.
 *
 * Runs the canonical ore → automation → brownout episode with a scripted model —
 * no API key, no TTY. Prints a narrated event stream, then asserts the demo beats
 * and exits non-zero if any beat failed (CI-able).
 */
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";

import type { Check } from "../../src/core/checks";
import type { ApprovalDecision, ApprovalRequest, HarnessEvent, ScriptedTurn } from "../harness/types";
import { replaySession } from "../harness";
import { scriptedStream } from "../harness/scripted";
import { deriveStage } from "../tui/variants/factory/model";
import {
  FACTORY_RESEARCH_TRACK,
  FACTORY_TOUCH_DESCENT,
  FACTORY_VARIANT_PLAN,
  type HandFix,
  type TaskItem,
  type WiredFactory,
} from "./types";
import { evaluateChecks } from "./verify";
import { wireFactory } from "./wire";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const color = (c: number, s: string) => `\x1b[3${c}m${s}\x1b[0m`;

// Tuned from actual scripted runs: item-5's assistant turn spends more than
// this, so the next belt pull (item-6) browns out exactly once.
const SHIFT_BUDGET_TOKENS = 4_000;
const GRID_FEED_TOKENS = 50_000;
const WORKSPACE_ROOT = await mkdtemp(join(tmpdir(), "garnish-factory-demo-"));

// --- canonical scripted model ---------------------------------------------------

const a = (itemId: string, step: 0 | 1): HandFix => {
  const path = `src/ore/${itemId}.ts`;
  return step === 0
    ? { path, oldString: "Goodbye, ", newString: "Hello, " }
    : { path, oldString: ".", newString: "!" };
};

const b = (itemId: string): HandFix => ({
  path: `src/ore/${itemId}.ts`,
  oldString: "Hello, friend!",
  newString: 'Hello, " + name + "!',
});

const script: ScriptedTurn[] = [
  // player send 1: item-2 help. Human-as-runtime, no tools yet.
  {
    text: "I can help, but you are still the runtime. Please run `grep -n 'friend' src/ore/item-2.ts` and paste the output back with PASTE: so I can propose the smallest edit.",
  },
  // player send 2: PASTE reply from hand.pasteBack.
  {
    text: 'PASTE confirms the flat greeter. Apply this exact edit: replace `Hello, friend!` with `Hello, " + name + "!` in src/ore/item-2.ts.',
  },
  // player send 3: item-3 start. Bare agent still needs clarification.
  {
    text: "Before I touch item-3: should this keep the caller's name instead of the generic friend greeting?",
  },
  // player send 4: item-3 clarify answer. Everything-ask: read approval + edit approval.
  {
    thinking: "Inspect the queued ore file, then patch the exact one-spot flat greeting.",
    text: "I'll read item-3, then make the one-line greeter fix.",
    toolCalls: [
      { name: "read", input: { path: "src/ore/item-3.ts" } },
      { name: "edit", input: b("item-3") },
    ],
    stopReason: "end_turn",
  },
  // belt steering send: item-4. Skill removes clarification; pattern approval removes future edit prompts.
  {
    thinking: "The belt brief includes the greeter-fix recipe. Patch both A-variant spots; the first edit will ask for a pattern approval, the second should ride the saved circuit pattern.",
    text: "BELT: applying greeter-fix recipe to item-4.",
    toolCalls: [
      { name: "edit", input: a("item-4", 0) },
      { name: "edit", input: a("item-4", 1) },
    ],
    stopReason: "end_turn",
  },
  // belt steering send: item-5. Shift has started; policy circuit auto-allows edit.
  {
    thinking: "Zero-touch shift item: apply the flat-greeting recipe directly.",
    text: "BELT: item-5 is a flat greeting; applying the learned recipe without waking the player.",
    toolCalls: [{ name: "edit", input: b("item-5") }],
    stopReason: "end_turn",
  },
  // belt steering send after feedGrid: item-6.
  {
    thinking: "Power is back. Item-6 is the two-spot wrong-greeting variant; apply both edits under the circuit pattern.",
    text: "BELT: item-6 resumes after brownout; applying the two-spot recipe.",
    toolCalls: [
      { name: "edit", input: a("item-6", 0) },
      { name: "edit", input: a("item-6", 1) },
    ],
    stopReason: "end_turn",
  },
  // belt steering send: item-7.
  {
    thinking: "Last shift item: flat greeting, no human touches.",
    text: "BELT: item-7 closes the shift with a zero-touch flat-greeting fix.",
    toolCalls: [{ name: "edit", input: b("item-7") }],
    stopReason: "end_turn",
  },
];

// --- scripted player (approval decisions) --------------------------------------

const decisions: ApprovalDecision[] = [
  { approved: true, mode: "once" },
  { approved: true, mode: "once" },
  { approved: true, mode: "pattern", pattern: "edit src/ore/*" },
];

const prompter = async (req: ApprovalRequest): Promise<ApprovalDecision> => {
  const decision = decisions.shift() ?? { approved: true, mode: "auto" as const };
  console.log(dim(`      (player decides for ${req.tool} ${req.command}: ${decision.mode}${decision.pattern ? ` ${decision.pattern}` : ""})`));
  return decision;
};

// --- narration ------------------------------------------------------------------

let assistantBuffer = "";
function narrate(event: HarnessEvent): void {
  switch (event.type) {
    case "session.start":
      console.log(dim(`▶ session ${event.sessionId.slice(0, 8)} · provider=${event.provider} · workspace=${event.workspace}`));
      break;
    case "message.user":
      if (event.source === "player") console.log(`\n${bold(color(6, `▸ YOU: ${event.text}`))}`);
      else if (event.source === "steering") console.log(`\n${bold(color(4, `▸ BELT: ${event.text.split("\n")[0]}`))}`);
      break;
    case "turn.start":
      console.log(dim(`  — turn ${event.turn} —`));
      break;
    case "assistant.delta":
      assistantBuffer += event.text;
      break;
    case "assistant.thinking.delta":
      break;
    case "assistant.end":
      console.log(color(5, `  🤖 ${event.message.text.trim()}`));
      assistantBuffer = "";
      break;
    case "tool.call":
      console.log(color(4, `  ⚙ ${event.tool} ${JSON.stringify(event.input)}`));
      break;
    case "tool.approval.requested":
      console.log(color(3, `  ❓ APPROVAL ${event.risk.toUpperCase()} → ${event.command}`));
      break;
    case "tool.approval.resolved":
      console.log(color(event.approved ? 2 : 1, `  ${event.approved ? "✔ approved" : "✖ denied"} (${event.mode}${event.pattern ? ` ${event.pattern}` : ""})`));
      break;
    case "tool.result":
      console.log(dim(`    → ${event.isError ? "error" : "ok"}: ${event.output.split("\n")[0]?.slice(0, 100) ?? ""}`));
      break;
    case "file.edited":
      console.log(color(2, `  ✎ ${event.kind} ${event.path} (${event.summary})`));
      break;
    case "item.enqueued":
      console.log(color(6, `  ▣ queued ${event.itemId} · ${event.title}`));
      break;
    case "item.started":
      console.log(bold(color(event.mode === "hand" ? 3 : 4, `  ▶ ${event.itemId} started by ${event.mode}`)));
      break;
    case "touch.recorded":
      console.log(color(event.kind === "power" ? 3 : 1, `  ✋ touch ${event.kind}${event.itemId ? ` on ${event.itemId}` : " (factory)"}${event.detail ? ` — ${event.detail}` : ""}`));
      break;
    case "item.shipped":
      console.log(bold(color(2, `  ✓ ${event.itemId} shipped · touches=${event.touches} · ${event.science}`)));
      break;
    case "research.completed":
      console.log(bold(color(6, `  ⚗ ${event.researchId}: ${event.label} → ${event.unlocks}`)));
      break;
    case "machine.built":
      console.log(bold(color(6, `  ⚙ built ${event.kind}: ${event.label}${event.artifact ? ` (${event.artifact})` : ""}`)));
      break;
    case "shift.started":
      console.log(bold(color(3, `  ⇥ shift started · budget=${event.budgetTokens}`)));
      break;
    case "power.brownout":
      console.log(bold(color(1, `  ⚡ brownout · used=${event.usedTokens} budget=${event.budgetTokens}`)));
      break;
    case "shift.ended":
      console.log(bold(color(3, `  ⇤ shift ended · shipped=${event.itemsShipped} brownouts=${event.brownouts} touches=${event.touches}`)));
      break;
    case "error":
      console.log(color(1, `  ‼ ${event.message}`));
      break;
    default:
      break;
  }
}

// --- run ------------------------------------------------------------------------

console.log(bold("GARNISH FACTORY PROTOTYPE — Factorio first-hour vertical slice"));
console.log(dim("scripted model, temp workspace, no API key required"));
console.log(`${bold("SHIFT BUDGET")} ${SHIFT_BUDGET_TOKENS} tokens (tuned for one item-6 pull brownout)`);

const wired = await wireFactory({
  streamFn: scriptedStream(script),
  provider: "scripted",
  prompter,
  root: WORKSPACE_ROOT,
  budgetTokens: SHIFT_BUDGET_TOKENS,
});
wired.sink.bus.subscribe(narrate);

let shiftStartedForDemo = false;
const startShiftAfterItem4 = wired.sink.bus.subscribe((event) => {
  if (event.type === "item.shipped" && event.itemId === "item-4" && !shiftStartedForDemo) {
    shiftStartedForDemo = true;
    wired.engine.startShift(SHIFT_BUDGET_TOKENS);
  }
});
console.log(`${bold("WORKSPACE")} ${wired.workspace}`);

const settle = async () => {
  await wired.verifier.settled();
};

const waitForShip = async (itemId: string) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await settle();
    const item = wired.engine.state().items.find((candidate) => candidate.id === itemId);
    if (item?.status === "shipped") return;
    await Bun.sleep(10);
  }
  const item = wired.engine.state().items.find((candidate) => candidate.id === itemId);
  throw new Error(`${itemId} did not ship; status=${item?.status ?? "missing"}`);
};

const start = (itemId: string, mode: "hand" | "agent"): TaskItem => {
  const item = wired.engine.startNext(mode);
  if (!item || item.id !== itemId) throw new Error(`expected ${itemId} to start, got ${item?.id ?? "none"}`);
  return item;
};

try {
  // wireFactory boots the canonical episode by enqueuing item-1.
  start("item-1", "hand");
  await wired.hand.command("cat src/ore/item-1.ts");
  await wired.hand.command("grep -n Goodbye src/ore/item-1.ts");
  await wired.hand.edit(a("item-1", 0));
  await wired.hand.edit(a("item-1", 1));
  await waitForShip("item-1");

  start("item-2", "hand");
  await wired.harness.send("item-2 help: inspect the next greeter and tell me the safest fix.");
  await settle();
  await wired.hand.pasteBack("grep -n 'friend' src/ore/item-2.ts");
  await settle();
  await wired.hand.edit(b("item-2"));
  await waitForShip("item-2");

  wired.engine.buildMachine("bare-agent", { label: "Bare agent" });

  start("item-3", "agent");
  await wired.harness.send("item-3 start: take this one with the bare agent.");
  await settle();
  await wired.harness.send("Yes — preserve the caller's name and use the exact ore recipe.");
  await waitForShip("item-3");

  await wired.forgeSkill("greeter-fix");
  await wired.wireCircuit(["read *", "bash grep *", "bash cat *"]);
  wired.engine.buildMachine("routing-belt", { label: "Routing belt" });

  await wired.beltKick();
  await waitForShip("item-4");

  if (!shiftStartedForDemo) {
    shiftStartedForDemo = true;
    wired.engine.startShift(SHIFT_BUDGET_TOKENS);
  }
  await wired.beltKick();
  await waitForShip("item-5");

  await wired.beltKick();
  wired.engine.feedGrid(GRID_FEED_TOKENS);
  await wired.beltKick();
  await waitForShip("item-6");

  await wired.beltKick();
  await waitForShip("item-7");
  wired.engine.endShift();
} finally {
  startShiftAfterItem4();
  wired.stop();
}

// --- beats ----------------------------------------------------------------------

const events = wired.sink.log.read();
const state = wired.engine.state();
const replayA = JSON.stringify(replaySession(events));
const replayB = JSON.stringify(replaySession(events));
const touchSeries = state.touchSeries.map((entry) => entry.touches);
const touchSeriesLine = touchSeries.join("→");

const has = (fn: (e: HarnessEvent) => boolean) => events.some(fn);
const count = (fn: (e: HarnessEvent) => boolean) => events.filter(fn).length;
const firstSeq = (fn: (e: HarnessEvent) => boolean) => events.find(fn)?.seq ?? -1;
const eventSeq = (type: HarnessEvent["type"], itemId?: string) =>
  firstSeq((e) => e.type === type && (itemId === undefined || ("itemId" in e && e.itemId === itemId)));
const between = (afterSeq: number, beforeSeq: number) => events.filter((e) => e.seq > afterSeq && e.seq < beforeSeq);
const shippedTouches = (itemId: string) => events.find((e): e is Extract<HarnessEvent, { type: "item.shipped" }> => e.type === "item.shipped" && e.itemId === itemId)?.touches;
const artifactPath = (artifact: string | undefined) => {
  if (!artifact) return undefined;
  return isAbsolute(artifact) ? artifact : join(wired.workspace, artifact);
};
const artifactExists = (artifact: string | undefined) => {
  const path = artifactPath(artifact);
  return path !== undefined && existsSync(path);
};
const artifactText = async (artifact: string | undefined) => {
  const path = artifactPath(artifact);
  return path ? await Bun.file(path).text().catch(() => "") : "";
};

function maxQueuedWhileShipped(targetShipped: number): number {
  let enqueued = 0;
  let started = 0;
  let shipped = 0;
  let maxQueued = 0;
  for (const event of events) {
    if (event.type === "item.enqueued") enqueued += 1;
    else if (event.type === "item.started") started += 1;
    else if (event.type === "item.shipped") shipped += 1;
    if (shipped === targetShipped) maxQueued = Math.max(maxQueued, enqueued - started);
  }
  return maxQueued;
}

const toVerifierEvents = () => events.map((event) => ({
  name: event.type,
  sessionId: event.sessionId,
  seq: event.seq,
  payload: event,
}));

const zeroTouchSameItemCheck = {
  type: "event",
  match: { event: "touch.recorded", count: 0 },
  sameItem: true,
} satisfies Check;
const sameItem7 = await evaluateChecks({
  checks: [zeroTouchSameItemCheck],
  workspace: wired.workspace,
  events: toVerifierEvents(),
  currentSessionId: wired.sink.sessionId,
  currentItemId: "item-7",
});
const sameItem1 = await evaluateChecks({
  checks: [zeroTouchSameItemCheck],
  workspace: wired.workspace,
  events: toVerifierEvents(),
  currentSessionId: wired.sink.sessionId,
  currentItemId: "item-1",
});

const item1ShipSeq = eventSeq("item.shipped", "item-1");
const item3ShipSeq = eventSeq("item.shipped", "item-3");
const item4StartSeq = eventSeq("item.started", "item-4");
const item5ShipSeq = eventSeq("item.shipped", "item-5");
const item6StartSeq = eventSeq("item.started", "item-6");
const brownoutSeq = eventSeq("power.brownout");
const red1Seq = eventSeq("research.completed", undefined);
const bareSeq = firstSeq((e) => e.type === "machine.built" && e.kind === "bare-agent");
const circuitSeq = firstSeq((e) => e.type === "machine.built" && e.kind === "policy-circuit");
const skillBuilt = events.find((e) => e.type === "machine.built" && e.kind === "skill");
const circuitBuilt = events.find((e) => e.type === "machine.built" && e.kind === "policy-circuit");
const circuitText = await artifactText(circuitBuilt?.type === "machine.built" ? circuitBuilt.artifact : undefined);
const item4Window = between(item3ShipSeq, eventSeq("item.shipped", "item-4"));
const item4BeltBrief = item4Window.find((e): e is Extract<HarnessEvent, { type: "message.user" }> => e.type === "message.user" && e.source === "steering" && e.text.includes("BELT: item-4"));
const item2TextTurnSeq = firstSeq((e) => e.type === "assistant.end" && e.message.text.includes("grep -n 'friend'"));
const item2PasteSeq = firstSeq((e) => e.type === "message.user" && e.source === "player" && "text" in e && e.text.includes("PASTE:"));
const prefixBeforeItem2 = events.slice(0, events.findIndex((e) => e.type === "item.enqueued" && e.itemId === "item-2"));

const beats: Array<[string, boolean]> = [
  ["item-1 shipped by hand: touches=4 and zero tool.call before ship", shippedTouches("item-1") === 4 && count((e) => e.type === "tool.call" && e.seq < item1ShipSeq) === 0],
  ["human-as-runtime: model proposes command, PASTE returns later, item-2 touches=3", item2TextTurnSeq > 0 && item2PasteSeq > item2TextTurnSeq && shippedTouches("item-2") === 3],
  ["ore pressure: at least 4 queued while shippedCount==3", maxQueuedWhileShipped(3) >= 4],
  ["research red-1 completes and bare-agent is built", has((e) => e.type === "research.completed" && e.researchId === "research-red-1") && bareSeq > red1Seq],
  ["item-3 by agent: two once approvals and touches=4", count((e) => e.type === "tool.approval.resolved" && e.mode === "once" && e.seq > eventSeq("item.started", "item-3") && e.seq < eventSeq("item.shipped", "item-3")) >= 2 && shippedTouches("item-3") === 4],
  ["belt starts item-4 from steering with no player message between item-3 and item-4 ship", item4BeltBrief !== undefined && !item4Window.some((e) => e.type === "message.user" && e.source === "player")],
  ["skill artifact exists and item-4 belt brief contains the recipe block", skillBuilt?.type === "machine.built" && artifactExists(skillBuilt.artifact) && typeof item4BeltBrief?.text === "string" && item4BeltBrief.text.includes("greeter-fix") && /recipe/i.test(item4BeltBrief.text)],
  ["policy circuit built and at least one tool approval auto-resolves afterwards", circuitSeq > 0 && has((e) => e.type === "tool.approval.resolved" && e.mode === "auto" && e.seq > circuitSeq)],
  ["pattern approval persists edit src/ore/* into circuit.txt", count((e) => e.type === "tool.approval.resolved" && e.mode === "pattern" && e.pattern === "edit src/ore/*") === 1 && circuitText.includes("edit src/ore/*")],
  ["item-4 ships with exactly one touch", shippedTouches("item-4") === 1],
  ["shift: items 5/6/7 zero-touch and shift.ended reports 3 shipped, 1 brownout", has((e) => e.type === "shift.started" && e.budgetTokens === SHIFT_BUDGET_TOKENS) && ["item-5", "item-6", "item-7"].every((itemId) => shippedTouches(itemId) === 0) && has((e) => e.type === "shift.ended" && e.itemsShipped === 3 && e.brownouts === 1)],
  ["exactly one brownout between item-5 shipped and item-6 started, followed by factory power touch", count((e) => e.type === "power.brownout") === 1 && brownoutSeq > item5ShipSeq && brownoutSeq < item6StartSeq && has((e) => e.type === "touch.recorded" && e.kind === "power" && e.itemId === null && e.seq > brownoutSeq)],
  ["touchSeries === FACTORY_TOUCH_DESCENT", JSON.stringify(touchSeries) === JSON.stringify(FACTORY_TOUCH_DESCENT)],
  ["sameItem DSL: zero-touch passes for item-7 and fails for item-1", sameItem7.pass === true && sameItem1.pass === false],
  ["stage derivation: full log is stage 2 and pre-item-2 prefix is stage 0", deriveStage(events) === 2 && deriveStage(prefixBeforeItem2) === 0],
  ["replay is deterministic (fold twice, identical)", replayA === replayB],
];

console.log(`\n${bold("TOUCH DESCENT")}  ${touchSeriesLine}  ${dim(`expected ${FACTORY_TOUCH_DESCENT.join("→")}`)}`);
console.log(`${bold("BROWNOUT")} budget=${SHIFT_BUDGET_TOKENS} · seq=${brownoutSeq} · between item-5 ship seq=${item5ShipSeq} and item-6 start seq=${item6StartSeq}`);
console.log(`${bold("FACTORY STATE")} shipped=${state.shippedCount} · queued=${state.items.filter((item) => item.status === "queued").length} · machines=${state.machines.map((machine) => machine.kind).join(", ")}`);
console.log(`${bold("SESSION LOG")} ${wired.sessionLogPath} (${events.length} events)`);
console.log(dim(`variant plan: ${FACTORY_VARIANT_PLAN.join(" → ")} · research: ${FACTORY_RESEARCH_TRACK.map((r) => r.id).join(", ")}`));

console.log(`\n${bold("DEMO BEATS")}`);
let failed = 0;
for (const [name, ok] of beats) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? color(2, "PASS") : color(1, "FAIL")}  ${name}`);
}

console.log(failed === 0 ? bold(color(2, "\nAll factory beats passed — the automation descent holds end to end.")) : bold(color(1, `\n${failed} beat(s) failed`)));
process.exit(failed === 0 ? 0 : 1);
