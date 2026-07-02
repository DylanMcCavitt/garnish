import { expect, test } from "bun:test";

import { questCommand, type ProgressionStore } from "../../src/cli";
import type { FeatureId, LevelId, ProgressionEvent, Quest, QuestId } from "../../src/core";
import {
  coreLevelLabels,
  registerGarnishHud,
  renderHudLines,
  type HudCommandSpec,
  type HudDeps,
  type HudExtensionContext,
  type HudPi,
} from "../../src/extension";
import { foldEvents, type ProgressionGraph } from "../../src/progression";
import type { PiEventHandler, PiExtensionEvent } from "../../src/extension";
import type { Probes } from "../../src/verifier";

const level = { l0: "tutorial-island" as LevelId, l1: "first-quest" as LevelId } as const;
const quest = { connect: "connect-agent" as QuestId, second: "second-turn" as QuestId } as const;
const feature = { file: "tool:file" as FeatureId } as const;

const graph = {
  levels: [
    { id: level.l0, order: 0, quests: [quest.connect, quest.second], unlocks: [feature.file] },
    { id: level.l1, order: 1, quests: [], unlocks: [] },
  ],
  quests: [
    { id: quest.connect, level: level.l0, required: true, xp: 20 },
    { id: quest.second, level: level.l0, required: true, xp: 10 },
  ],
} satisfies ProgressionGraph;

const connectQuest: Quest = {
  id: quest.connect,
  level: level.l0,
  title: "Player 1 connected",
  description: "First model round trip.",
  xp: 20,
  required: true,
  prereqs: [],
  unlocks: [],
  checks: [{ type: "event", match: { event: "agent_end", min_assistant_turns: 1 } }],
};

const secondQuest: Quest = {
  id: quest.second,
  level: level.l0,
  title: "Continue from save",
  description: "Second turn same session.",
  xp: 10,
  required: true,
  prereqs: [quest.connect],
  unlocks: [],
  checks: [{ type: "event", match: { event: "turn_start", count: { min: 2 } }, sameSession: true }],
};

class MemoryStore implements ProgressionStore {
  private log: ProgressionEvent[] = [];

  readEvents(): readonly ProgressionEvent[] {
    return this.log;
  }

  appendEvents(events: readonly ProgressionEvent[]): void {
    this.log = [...this.log, ...events];
  }
}

const inertProbes: Probes = {
  fileExists: () => false,
  readFile: () => {
    throw new Error("unexpected readFile");
  },
  runCommand: () => {
    throw new Error("unexpected command");
  },
  mcpHandshake: () => {
    throw new Error("unexpected handshake");
  },
  skillValid: () => {
    throw new Error("unexpected skill validation");
  },
  confirm: () => undefined,
};

class FakeHudPi implements HudPi {
  readonly handlers = new Map<string, PiEventHandler[]>();
  readonly commands = new Map<string, HudCommandSpec>();
  readonly widgets: Array<{ readonly id: string; readonly lines: readonly string[] }> = [];
  readonly statuses: Array<{ readonly id: string; readonly text: string }> = [];
  readonly notifications: string[] = [];
  throwOnUi = false;

  readonly ctx: HudExtensionContext = {
    hasUI: true,
    ui: {
      setWidget: (id, lines) => {
        if (this.throwOnUi) {
          throw new Error("no UI");
        }
        this.widgets.push({ id, lines });
      },
      setStatus: (id, text) => {
        if (this.throwOnUi) {
          throw new Error("no UI");
        }
        this.statuses.push({ id, text });
      },
      notify: (message) => {
        if (this.throwOnUi) {
          throw new Error("no UI");
        }
        this.notifications.push(message);
      },
    },
  };

  on(event: string, handler: PiEventHandler): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  registerCommand(name: string, spec: HudCommandSpec): void {
    this.commands.set(name, spec);
  }

  emit(event: PiExtensionEvent): void {
    for (const handler of this.handlers.get(event.type) ?? []) {
      handler(event, this.ctx);
    }
  }

  async runCommand(name: string, args: string): Promise<void> {
    const spec = this.commands.get(name);
    if (spec === undefined) {
      throw new Error(`command ${name} not registered`);
    }
    await spec.handler(args, this.ctx);
  }
}

function hudDeps(store: MemoryStore, overrides: Partial<HudDeps> = {}): HudDeps {
  return {
    graph,
    quests: [connectQuest, secondQuest],
    store,
    probes: inertProbes,
    now: () => "2026-07-02T00:00:00Z",
    ...overrides,
  };
}

function completion(id: QuestId, xp: number): ProgressionEvent {
  return {
    at: "2026-07-02T00:00:00Z",
    type: "quest_completed",
    quest_id: id,
    level_id: level.l0,
    required: true,
    xp,
  };
}

test("HUD widget renders level, XP, active quest, and next check in at most 10 lines", () => {
  const state = foldEvents([], graph);
  const lines = renderHudLines(state, graph, [connectQuest, secondQuest]);

  expect(lines.length).toBeLessThanOrEqual(10);
  expect(lines[0]).toContain("Tutorial Island (onboarding)");
  expect(lines[1]).toBe("XP: 0");
  expect(lines.some((line) => line.includes("Player 1 connected"))).toBe(true);
  expect(lines.some((line) => line.includes("Next check: observe agent_end"))).toBe(true);
});

test("themed labels pair functional descriptors for every core level", () => {
  expect(coreLevelLabels["tutorial-island"]).toBe("Tutorial Island (onboarding)");
  expect(coreLevelLabels["skill-tree"]).toBe("Skill Tree (skills)");
});

test("widget and status update on session start and after quest completion", async () => {
  const pi = new FakeHudPi();
  const store = new MemoryStore();
  const hud = registerGarnishHud(pi, hudDeps(store));

  pi.emit({ type: "session_start", sessionId: "s1" });
  await hud.refresh();
  expect(pi.widgets.length).toBeGreaterThan(0);
  expect(pi.statuses.at(-1)?.text).toContain("Player 1 connected");

  store.appendEvents([completion(quest.connect, 20)]);
  pi.emit({ type: "turn_end", sessionId: "s1" });
  await hud.refresh();

  expect(pi.statuses.some((status) => status.text.includes("quest complete!"))).toBe(true);
  expect(hud.statusText()).toContain("20 XP");
  expect(hud.statusText()).toContain("Continue from save");
});

test("level completion transition notifies with the new state", async () => {
  const pi = new FakeHudPi();
  const store = new MemoryStore();
  const hud = registerGarnishHud(pi, hudDeps(store));

  pi.emit({ type: "session_start", sessionId: "s1" });
  await hud.refresh();

  store.appendEvents([completion(quest.connect, 20), completion(quest.second, 10)]);
  await hud.refresh();

  expect(pi.notifications.some((message) => message.startsWith("Level complete"))).toBe(true);
});

test("/quest mirrors the CLI quest renderer exactly", async () => {
  const pi = new FakeHudPi();
  const store = new MemoryStore();
  registerGarnishHud(pi, hudDeps(store));

  await pi.runCommand("quest", "");

  const cli = await questCommand({
    graph,
    quests: [connectQuest, secondQuest],
    store,
    now: () => "2026-07-02T00:00:00Z",
  });
  expect(pi.notifications.at(-1)).toBe(cli.text);
});

test("/quest check runs the manual verifier dispatch and reports per-check evidence", async () => {
  const pi = new FakeHudPi();
  const store = new MemoryStore();
  registerGarnishHud(pi, hudDeps(store));

  pi.emit({ type: "session_start", sessionId: "s1" });
  await pi.runCommand("quest", "check");
  const failReport = pi.notifications.at(-1);
  expect(failReport).toContain("Quest connect-agent: fail");
  expect(failReport).toContain("event not found");

  pi.emit({ type: "agent_end", sessionId: "s1", assistant_turns: 1 });
  await pi.runCommand("quest", "check");
  const passReport = pi.notifications.at(-1);
  expect(passReport).toContain("Quest connect-agent: pass");
  expect(passReport).toContain("event matched");
});

test("headless UI failures degrade safely without breaking verification", async () => {
  const pi = new FakeHudPi();
  pi.throwOnUi = true;
  const store = new MemoryStore();
  const hud = registerGarnishHud(pi, hudDeps(store));

  pi.emit({ type: "session_start", sessionId: "s1" });
  await hud.refresh();

  store.appendEvents([completion(quest.connect, 20)]);
  await hud.refresh();

  expect(hud.statusText()).toContain("20 XP");
});
