import { expect, test } from "bun:test";

import {
  doctorCommand,
  main,
  questCommand,
  statusCommand,
  unlockCommand,
  type CliDeps,
  type ProgressionStore,
} from "../../src/cli";
import {
  foldEvents,
  type FeatureId,
  type LevelId,
  type ProgressionEvent,
  type ProgressionGraph,
  type Quest,
  type QuestId,
} from "../../src/index";

const level = {
  l0: "tutorial-island" as LevelId,
  l1: "first-quest" as LevelId,
} as const;

const quest = {
  start: "start-standalone-harness" as QuestId,
  connect: "connect-agent" as QuestId,
  bonus: "status-screen" as QuestId,
  firstFile: "first-file" as QuestId,
} as const;

const feature = {
  file: "tool:file" as FeatureId,
  shell: "tool:shell" as FeatureId,
} as const;

const graph = {
  levels: [
    { id: level.l0, order: 0, quests: [quest.start, quest.connect, quest.bonus], unlocks: [feature.file] },
    { id: level.l1, order: 1, quests: [quest.firstFile], unlocks: [feature.shell] },
  ],
  quests: [
    { id: quest.start, level: level.l0, required: true, xp: 10 },
    { id: quest.connect, level: level.l0, required: true, xp: 20 },
    { id: quest.bonus, level: level.l0, required: false, xp: 10 },
    { id: quest.firstFile, level: level.l1, required: true, xp: 15 },
  ],
  unlockEdges: [],
} satisfies ProgressionGraph;

const packQuests: readonly Quest[] = [
  {
    id: quest.start,
    level: level.l0,
    title: "Start the game engine",
    description: "Start Garnish through the standalone harness.",
    xp: 10,
    required: true,
    prereqs: [],
    unlocks: [],
    checks: [{ type: "event", match: { event: "session_start" } }],
  },
];

function memoryStore(initial: readonly ProgressionEvent[] = []): ProgressionStore & {
  readonly events: () => readonly ProgressionEvent[];
} {
  let log: ProgressionEvent[] = [...initial];
  return {
    readEvents: () => log,
    appendEvents: (events) => {
      log = [...log, ...events];
    },
    events: () => log,
  };
}

function questCompleted(id: QuestId, levelId: LevelId, xp: number, at: string): ProgressionEvent {
  return { at, type: "quest_completed", quest_id: id, level_id: levelId, required: true, xp };
}

function deps(store: ProgressionStore, extra: Partial<CliDeps> = {}): CliDeps {
  return { graph, quests: packQuests, store, now: () => "2026-07-02T00:00:00Z", ...extra };
}

test("status renders level, XP, quest states, and next pointer", async () => {
  const store = memoryStore([questCompleted(quest.start, level.l0, 10, "2026-07-02T00:00:00Z")]);

  const outcome = await statusCommand(deps(store));

  expect(outcome.exitCode).toBe(0);
  expect(outcome.text).toContain("Level 0 — tutorial-island");
  expect(outcome.text).toContain("XP: 10");
  expect(outcome.text).toContain("[x] start-standalone-harness");
  expect(outcome.text).toContain("[ ] connect-agent  ← next");
  expect(outcome.text).toContain("(optional)");
  expect(outcome.text).toContain("[·] first-file");
  expect(outcome.text).toContain("Next: connect-agent");
});

test("status shows badges when present in progression state", async () => {
  const store = memoryStore([
    { at: "2026-07-02T00:00:00Z", type: "badge_award", badge: "speedrunner" },
  ]);

  const outcome = await statusCommand(deps(store));

  expect(outcome.text).toContain("Badges: speedrunner");
});

test("quest renders the active quest's full text and checks", async () => {
  const outcome = await questCommand(deps(memoryStore()));

  expect(outcome.exitCode).toBe(0);
  expect(outcome.text).toContain("Active quest: start-standalone-harness");
  expect(outcome.text).toContain("Start the game engine");
  expect(outcome.text).toContain("Start Garnish through the standalone harness.");
  expect(outcome.text).toContain("event session_start");
});

test("unlock --all unlocks graph features and graph levels without awarding XP", async () => {
  const store = memoryStore();

  const outcome = await unlockCommand(deps(store), { all: true });

  expect(outcome.exitCode).toBe(0);
  const state = foldEvents(store.events(), graph);
  expect(state.unlockSet.levels).toEqual([level.l0, level.l1]);
  expect(state.unlockSet.features).toContain(feature.file);
  expect(state.unlockSet.features).toContain(feature.shell);
  expect(state.xpTotal).toBe(0);
  expect(outcome.text).toContain("no XP");
});

test("unlock --level accepts an order number and is idempotent", async () => {
  const store = memoryStore();

  const first = await unlockCommand(deps(store), { level: "1" });
  expect(first.exitCode).toBe(0);
  expect(first.text).toContain("level first-quest");
  expect(first.text).toContain("feature tool:shell");

  const second = await unlockCommand(deps(store), { level: "1" });
  expect(second.exitCode).toBe(0);
  expect(second.text).toContain("already unlocked");

  const state = foldEvents(store.events(), graph);
  expect(state.unlockSet.levels).toContain(level.l1);
  expect(state.xpTotal).toBe(0);
});

test("unlock rejects an unknown level with the known-level list", async () => {
  const outcome = await unlockCommand(deps(memoryStore()), { level: "nope" });

  expect(outcome.exitCode).toBe(1);
  expect(outcome.text).toContain('unknown level "nope"');
  expect(outcome.text).toContain("tutorial-island (0)");
});

test("cheat is a strict alias for unlock through main dispatch", async () => {
  const storeUnlock = memoryStore();
  const storeCheat = memoryStore();

  const viaUnlock = await main(["unlock", "--level", "0"], { cli: deps(storeUnlock), doctor: {} });
  const viaCheat = await main(["cheat", "--level", "0"], { cli: deps(storeCheat), doctor: {} });

  expect(viaCheat.text).toBe(viaUnlock.text);
  expect(foldEvents(storeCheat.events(), graph)).toEqual(foldEvents(storeUnlock.events(), graph));
});

test("doctor reports the standalone-harness handoff", async () => {
  const outcome = await doctorCommand({});

  expect(outcome.exitCode).toBe(1);
  expect(outcome.text).toContain("Garnish doctor");
  expect(outcome.text).toContain("superseded by the standalone harness");
});

test("main returns usage for unknown commands", async () => {
  const outcome = await main(["frobnicate"], {
    cli: deps(memoryStore()),
    doctor: {},
  });

  expect(outcome.exitCode).toBe(2);
  expect(outcome.text).toContain("garnish <command>");
});
