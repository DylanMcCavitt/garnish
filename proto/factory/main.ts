import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { ApprovalDecision, ApprovalRequest, EventBus, ProviderName, ScriptedTurn, StreamFn } from "../harness/types";
import { scriptedStream } from "../harness/scripted";
import { startTui, type FactoryTuiHandle } from "../tui/variants/factory";
import { sandboxAvailability } from "../sandbox";
import { GREETER_BUG_FAMILY } from "./ore";
import type { FactoryState, HandFix, TaskItem, WiredFactory } from "./types";
import { listWorldSlots, worldRoot } from "./menu";
import { wireFactory } from "./wire";

const script: ScriptedTurn[] = [
  { text: "Try `grep -n friend src/ore/item-2.ts`, paste the output, then apply the one-line greeting fix." },
  { text: "Replace `Hello, friend!` with `Hello, " + " + name + " + "!` in src/ore/item-2.ts." },
  { text: "Which item should I work?" },
  { text: "Reading item-3.", toolCalls: [{ name: "read", input: { path: "src/ore/item-3.ts" } }] },
  { text: "Fixing item-3.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-3.ts", oldString: "Hello, friend!", newString: "\"Hello, \" + name + \"!\"" } }], stopReason: "end_turn" },
  { text: "Belt item-4 first spot.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-4.ts", oldString: "Goodbye, ", newString: "Hello, " } }] },
  { text: "Belt item-4 second spot.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-4.ts", oldString: ".", newString: "!" } }], stopReason: "end_turn" },
  { text: "Belt item-5.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-5.ts", oldString: "Hello, friend!", newString: "\"Hello, \" + name + \"!\"" } }], stopReason: "end_turn" },
  { text: "Belt item-6 first spot.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-6.ts", oldString: "Goodbye, ", newString: "Hello, " } }] },
  { text: "Belt item-6 second spot.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-6.ts", oldString: ".", newString: "!" } }], stopReason: "end_turn" },
  { text: "Belt item-7.", toolCalls: [{ name: "edit", input: { path: "src/ore/item-7.ts", oldString: "Hello, friend!", newString: "\"Hello, \" + name + \"!\"" } }], stopReason: "end_turn" },
  { text: "Factory arc complete." },
];

interface LateBus {
  bus: EventBus;
  attach(next: EventBus): void;
  detach(): void;
}

const streamFn: StreamFn = scriptedStream(script);
const provider: ProviderName = "scripted";
const saveRoot = process.env.GARNISH_PROTO_HOME ?? join(homedir(), ".garnish-proto");
const sandbox = sandboxAvailability();
const bypassWorldName = worldNameFromArgs(process.argv.slice(2));
const bypassWorld = bypassWorldName === null ? null : worldRoot(saveRoot, bypassWorldName);
const factoryBus = createLateBus();
let tuiPrompter: ((req: ApprovalRequest) => Promise<ApprovalDecision>) | null = null;
let tui: FactoryTuiHandle | null = null;
let wired: WiredFactory | null = null;
let activeWorld: { root: string; name: string } | null = null;

const prompter = (req: ApprovalRequest): Promise<ApprovalDecision> => {
  if (tuiPrompter !== null) return tuiPrompter(req);
  return Promise.resolve({ approved: false, mode: "deny", reason: `UI not ready for ${req.tool}` });
};

function worldNameFromArgs(args: string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--world") {
      const value = args[index + 1];
      if (value === undefined || value.trim().length === 0) throw new Error("--world requires a name");
      return value;
    }
    if (arg.startsWith("--world=")) {
      const value = arg.slice("--world=".length);
      if (value.trim().length === 0) throw new Error("--world requires a name");
      return value;
    }
  }
  return null;
}

function createLateBus(): LateBus {
  let current: EventBus | null = null;
  const subscribers = new Set<(event: Parameters<EventBus["publish"]>[0]) => void>();
  const downstream = new Map<(event: Parameters<EventBus["publish"]>[0]) => void, () => void>();

  const detachDownstream = () => {
    for (const unsubscribe of downstream.values()) unsubscribe();
    downstream.clear();
  };

  return {
    bus: {
      publish(event) {
        current?.publish(event);
      },
      subscribe(fn) {
        subscribers.add(fn);
        if (current !== null) downstream.set(fn, current.subscribe(fn));
        return () => {
          subscribers.delete(fn);
          downstream.get(fn)?.();
          downstream.delete(fn);
        };
      },
    },
    attach(next) {
      detachDownstream();
      current = next;
      for (const subscriber of subscribers) downstream.set(subscriber, next.subscribe(subscriber));
    },
    detach() {
      detachDownstream();
      current = null;
    },
  };
}

function emptyFactoryState(): FactoryState {
  return {
    items: [],
    currentItemId: null,
    machines: [],
    research: [],
    power: { shiftActive: false, budgetTokens: 0, usedTokens: 0, brownedOut: false, brownouts: 0, shiftShipped: 0 },
    shippedCount: 0,
    touchSeries: [],
  };
}

function requireWired(): WiredFactory {
  if (wired === null) throw new Error("factory world is still loading");
  return wired;
}

function transcript(text: string): void {
  if (wired === null) {
    console.error(text);
    return;
  }
  wired.sink.emit({ type: "message.user", source: "tutor", text });
}

function runCommand(work: () => Promise<void>): void {
  void work().catch((error) => transcript(`SYSTEM: ${error instanceof Error ? error.message : String(error)}`));
}

function currentItem(): TaskItem | null {
  const factory = requireWired();
  const state = factory.engine.state();
  return state.items.find((item) => item.id === state.currentItemId) ?? null;
}

function nextHandFix(item: TaskItem): Promise<HandFix | null> {
  const variant = GREETER_BUG_FAMILY.variants.find((candidate) => candidate.id === item.variantId);
  if (variant === undefined) return Promise.resolve(null);
  return firstApplicableFix(variant.handFixes(item.id));
}

async function firstApplicableFix(fixes: HandFix[]): Promise<HandFix | null> {
  const factory = requireWired();
  for (const fix of fixes) {
    const content = await readFile(join(factory.workspace, fix.path), "utf8");
    if (content.includes(fix.oldString)) return fix;
  }
  return null;
}

async function writeMachineStub(kind: "bare-agent" | "routing-belt"): Promise<string> {
  const factory = requireWired();
  const artifact = `.garnish/machines/${kind}.md`;
  const absolute = join(factory.workspace, artifact);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `# ${kind}\n\nFactory-authored ${kind} machine stub.\n`, "utf8");
  return artifact;
}

function onCommand(line: string): boolean {
  if (wired === null) {
    console.error("SYSTEM: factory world is still loading");
    return true;
  }
  const factory = wired;
  const [command, ...rest] = line.trim().split(/\s+/);
  const argText = rest.join(" ");
  if (command === "/mine") {
    const item = factory.engine.startNext("hand");
    transcript(item === null ? "SYSTEM: no queued ore ready for hand mining" : `SYSTEM: hand-mining ${item.id}`);
    return true;
  }
  if (command === "/cat") {
    runCommand(async () => {
      const result = await factory.hand.command(`cat ${argText}`);
      transcript(`SYSTEM: cat exited ${result.exitCode}\n${result.output}`);
    });
    return true;
  }
  if (command === "/grep") {
    runCommand(async () => {
      const result = await factory.hand.command(`grep ${argText}`);
      transcript(`SYSTEM: grep exited ${result.exitCode}\n${result.output}`);
    });
    return true;
  }
  if (command === "/run") {
    runCommand(async () => {
      const result = await factory.hand.command(argText);
      transcript(`SYSTEM: command exited ${result.exitCode}\n${result.output}`);
    });
    return true;
  }
  if (command === "/fix") {
    runCommand(async () => {
      const item = currentItem();
      if (item === null) throw new Error("no current item; use /mine or build the routing belt");
      const fix = await nextHandFix(item);
      if (fix === null) throw new Error(`no remaining canned hand fix for ${item.id}`);
      await requireWired().hand.edit(fix);
      await requireWired().verifier.settled();
      transcript(`SYSTEM: applied hand fix to ${fix.path}`);
    });
    return true;
  }
  if (command === "/paste") {
    runCommand(async () => {
      await factory.hand.pasteBack(argText);
      await factory.verifier.settled();
    });
    return true;
  }
  if (command === "/build") {
    runCommand(async () => {
      if (argText !== "bare-agent" && argText !== "routing-belt") throw new Error("usage: /build <bare-agent|routing-belt>");
      const artifact = await writeMachineStub(argText);
      requireWired().engine.buildMachine(argText, { label: argText, artifact });
      transcript(`SYSTEM: built ${argText}`);
    });
    return true;
  }
  if (command === "/forge") {
    runCommand(async () => {
      const name = argText || "greeter-fix";
      await factory.forgeSkill(name);
      transcript(`SYSTEM: forged skill ${name}`);
    });
    return true;
  }
  if (command === "/wire") {
    runCommand(async () => {
      if (argText.length === 0) throw new Error("usage: /wire <allow-pattern>");
      await factory.wireCircuit([argText]);
      transcript(`SYSTEM: wired circuit pattern ${argText}`);
    });
    return true;
  }
  if (command === "/power") {
    const budget = Number(argText || "0");
    factory.engine.startShift(budget);
    void factory.beltKick();
    transcript(`SYSTEM: shift started with budget ${budget}`);
    return true;
  }
  if (command === "/feed") {
    const tokens = Number(argText || "0");
    factory.engine.feedGrid(tokens);
    transcript(`SYSTEM: fed grid +${tokens}`);
    return true;
  }
  if (command === "/end") {
    factory.engine.endShift();
    transcript("SYSTEM: shift ended");
    return true;
  }
  return false;
}

function readArtifact(path: string): string | null {
  const factory = wired;
  if (factory === null) return null;
  try {
    return readFileSync(join(factory.workspace, path), "utf8");
  } catch {
    return null;
  }
}

function settingsView(): Array<[string, string]> {
  const factory = wired;
  const state = factory?.engine.state();
  return [
    ["world", activeWorld?.name ?? "menu"],
    ["root", activeWorld?.root ?? join(saveRoot, "worlds")],
    ["provider", provider],
    ["model", factory?.harness.config.model ?? "scripted"],
    ["sandbox", sandbox.mode],
    ["budget", state === undefined ? "0" : `${state.power.usedTokens}/${state.power.budgetTokens}`],
  ];
}

async function wireWorld(world: { root: string; name: string }): Promise<void> {
  if (wired !== null) {
    wired.stop();
    factoryBus.detach();
  }
  activeWorld = world;
  const next = await wireFactory({ streamFn, provider, prompter, root: world.root, worldName: world.name });
  wired = next;
  factoryBus.attach(next.sink.bus);
  tui?.showFactory();
  setTimeout(() => {
    transcript("SPRIG: bare harness online — ore waits. Type /mine to hand-craft item-1 (hints live under the input).");
  }, 800);
}

function stopAll(): void {
  const sessionLogPath = wired?.sessionLogPath;
  tui?.stop();
  wired?.stop();
  factoryBus.detach();
  if (sessionLogPath) console.log(`session log: ${sessionLogPath}`);
}

tui = startTui({
  bus: factoryBus.bus,
  send: (text) => {
    const factory = wired;
    if (factory === null) {
      console.error("SYSTEM: factory world is still loading");
      return;
    }
    void factory.harness.send(text).then(() => factory.verifier.settled());
  },
  abort: () => wired?.harness.abort(),
  gateViews: () => [],
  questView: () => null,
  scorecard: () => null,
  factoryState: () => wired?.engine.state() ?? emptyFactoryState(),
  onCommand,
  readArtifact,
  settingsView,
  worlds: {
    list: () => listWorldSlots(saveRoot),
    create: (name) => worldRoot(saveRoot, name),
    select(world) {
      void wireWorld(world).catch((error) => transcript(`SYSTEM: ${error instanceof Error ? error.message : String(error)}`));
    },
  },
  initialScreen: bypassWorld === null ? "menu" : "factory",
  meta: { workspace: bypassWorld?.root ?? saveRoot, provider, model: "scripted" },
  onExit: () => {
    stopAll();
    process.exit(0);
  },
});
tuiPrompter = tui.prompter;

if (bypassWorld !== null) {
  void wireWorld(bypassWorld).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    stopAll();
    process.exit(1);
  });
}

console.log(`garnish factory TUI — provider=${provider}`);
console.log("commands: /mine /cat /grep /run /fix /paste /build /forge /wire /power /feed /end");
