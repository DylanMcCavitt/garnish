import { expect, test } from "bun:test";

import {
  deriveUnlocks,
  foldEvents,
  replayProgression,
  type Badge,
  type FeatureId,
  type LevelId,
  type ProgressionEvent,
  type ProgressionGraph,
  type ProgressionState,
  type QuestCompletedEvent,
  type QuestId,
  type UnlockEvent,
} from "../../src/index";

const level = {
  intro: "intro" as LevelId,
  mastery: "mastery" as LevelId,
} as const;

const quest = {
  introSetup: "intro-setup" as QuestId,
  introBranch: "intro-branch" as QuestId,
  introBonus: "intro-bonus" as QuestId,
  masteryBoss: "mastery-boss" as QuestId,
  masteryExtra: "mastery-extra" as QuestId,
} as const;

const feature = {
  shortcut: "shortcut" as FeatureId,
  terminal: "terminal" as FeatureId,
  debugger: "debugger" as FeatureId,
  introClear: "intro-clear" as FeatureId,
  bonusMode: "bonus-mode" as FeatureId,
  compiler: "compiler" as FeatureId,
  profiler: "profiler" as FeatureId,
  masteryClear: "mastery-clear" as FeatureId,
} as const;

const at = {
  speedrun: "2026-07-02T10:00:00Z",
  setup: "2026-07-02T10:01:00Z",
  branch: "2026-07-02T10:02:00Z",
  bonus: "2026-07-02T10:03:00Z",
  boss: "2026-07-02T10:04:00Z",
  extra: "2026-07-02T10:05:00Z",
  hint: "2026-07-02T10:00:30Z",
} as const;

const graph = {
  levels: [
    {
      id: level.intro,
      order: 0,
      quests: [quest.introSetup, quest.introBranch, quest.introBonus],
      unlocks: [feature.introClear],
    },
    {
      id: level.mastery,
      order: 1,
      quests: [quest.masteryBoss, quest.masteryExtra],
      unlocks: [feature.masteryClear],
    },
  ],
  quests: [
    {
      id: quest.introSetup,
      level: level.intro,
      required: true,
      xp: 10,
      unlocks: [feature.terminal],
    },
    {
      id: quest.introBranch,
      level: level.intro,
      required: true,
      xp: 20,
    },
    {
      id: quest.introBonus,
      level: level.intro,
      required: false,
      xp: 5,
      unlocks: [feature.bonusMode],
    },
    {
      id: quest.masteryBoss,
      level: level.mastery,
      required: true,
      xp: 50,
      unlocks: [feature.compiler],
    },
    {
      id: quest.masteryExtra,
      level: level.mastery,
      required: false,
      xp: 7,
    },
  ],
  unlockEdges: [
    { quest: quest.introBranch, feature: feature.debugger },
    { quest: quest.masteryBoss, feature: feature.profiler },
  ],
} satisfies ProgressionGraph;

const introRequiredCompletions = [
  questCompleted(quest.introSetup, at.setup),
  questCompleted(quest.introBranch, at.branch),
] as const;

const allRequiredCompletions = [
  ...introRequiredCompletions,
  questCompleted(quest.masteryBoss, at.boss),
] as const;

const allQuestCompletions = [
  ...allRequiredCompletions,
  questCompleted(quest.introBonus, at.bonus),
  questCompleted(quest.masteryExtra, at.extra),
] as const;

test("foldEvents counts each completed quest once and advances levels without inventing derived unlocks", () => {
  const state = foldEvents(
    [
      questCompleted(quest.introSetup, at.setup),
      questCompleted(quest.introBranch, at.branch),
      questCompleted(quest.introSetup, at.extra),
    ],
    graph,
  );

  expect(state.completedQuests).toEqual([quest.introBranch, quest.introSetup]);
  expect(state.xpTotal).toBe(30);
  expect(state.completedLevels).toEqual([level.intro]);
  expect(state.currentLevel).toBe(level.mastery);
  expect(state.unlockSet).toEqual({
    features: [],
    levels: [level.intro],
  });
  expect(state.levelCompletions).toEqual([
    {
      levelId: level.intro,
      at: at.branch,
      sourceQuestId: quest.introBranch,
    },
  ]);
});

test("deriveUnlocks deterministically emits graph feature unlocks before the next level and then reaches a fixed point", () => {
  const state = foldEvents(introRequiredCompletions, graph);

  const unlocks = deriveUnlocks(state, graph);

  expect(unlocks).toEqual([
    questUnlock(feature.debugger, level.intro, quest.introBranch, at.branch),
    questUnlock(feature.introClear, level.intro, quest.introBranch, at.branch),
    questUnlock(feature.terminal, level.intro, quest.introBranch, at.branch),
    levelUnlock(level.mastery, level.intro, quest.introBranch, at.branch),
  ]);

  const foldedWithUnlocks = foldEvents([...introRequiredCompletions, ...unlocks], graph);

  expect(foldedWithUnlocks.unlockSet).toEqual({
    features: [feature.debugger, feature.introClear, feature.terminal],
    levels: [level.intro, level.mastery],
  });
  expect(deriveUnlocks(foldedWithUnlocks, graph)).toEqual([]);
});

test("duplicate quest completions are idempotent for XP, completion state, and unlock derivation", () => {
  const state = foldEvents(
    [
      questCompleted(quest.introSetup, at.setup),
      questCompleted(quest.introSetup, at.bonus),
      questCompleted(quest.introBranch, at.branch),
      questCompleted(quest.introBranch, at.extra),
    ],
    graph,
  );

  expect(state.xpTotal).toBe(30);
  expect(state.completedQuests).toEqual([quest.introBranch, quest.introSetup]);
  expect(state.completedLevels).toEqual([level.intro]);
  expect(state.levelCompletions).toEqual([
    {
      levelId: level.intro,
      at: at.branch,
      sourceQuestId: quest.introBranch,
    },
  ]);
  expect(deriveUnlocks(state, graph).map((event) => event.target)).toEqual([
    { type: "feature", id: feature.debugger },
    { type: "feature", id: feature.introClear },
    { type: "feature", id: feature.terminal },
    { type: "level", id: level.mastery },
  ]);
});

test("speedrunner is awarded only when a speedrun or cheat unlock path precedes clearing every required quest", () => {
  const cases: Array<{
    name: string;
    events: readonly ProgressionEvent[];
    expected: boolean;
  }> = [
    {
      name: "speedrun path then every required quest",
      events: [speedrunUnlock("speedrun"), ...allRequiredCompletions],
      expected: true,
    },
    {
      name: "cheat path then every required quest",
      events: [speedrunUnlock("cheat"), ...allRequiredCompletions],
      expected: true,
    },
    {
      name: "required quests without speedrun or cheat path",
      events: allRequiredCompletions,
      expected: false,
    },
    {
      name: "speedrun path without the later mastery required quest",
      events: [speedrunUnlock("speedrun"), ...introRequiredCompletions],
      expected: false,
    },
  ];

  for (const { name, events, expected } of cases) {
    const state = foldEvents(events, graph);

    expect(hasBadge(state, "speedrunner"), name).toBe(expected);
  }
});

test("completionist requires every quest, including optional quests", () => {
  const complete = foldEvents(allQuestCompletions, graph);
  const missingMasteryOptional = foldEvents(
    [
      ...allRequiredCompletions,
      questCompleted(quest.introBonus, at.bonus),
    ],
    graph,
  );

  expect(hasBadge(complete, "completionist")).toBe(true);
  expect(hasBadge(complete, "completionist", level.intro)).toBe(true);
  expect(hasBadge(complete, "completionist", level.mastery)).toBe(true);
  expect(hasBadge(missingMasteryOptional, "completionist")).toBe(false);
  expect(hasBadge(missingMasteryOptional, "completionist", level.intro)).toBe(true);
  expect(hasBadge(missingMasteryOptional, "completionist", level.mastery)).toBe(false);
});

test("no-hint clear is per-level and only required quest hints block it", () => {
  const cases: Array<{
    name: string;
    events: readonly ProgressionEvent[];
    expected: boolean;
  }> = [
    {
      name: "required quests completed with no hints",
      events: introRequiredCompletions,
      expected: true,
    },
    {
      name: "optional quest hint does not poison a required clear",
      events: [hintOpened(quest.introBonus, level.intro), ...introRequiredCompletions],
      expected: true,
    },
    {
      name: "required quest hint before completion blocks the badge",
      events: [hintOpened(quest.introSetup, level.intro), ...introRequiredCompletions],
      expected: false,
    },
  ];

  for (const { name, events, expected } of cases) {
    const state = foldEvents(events, graph);

    expect(hasBadge(state, "no_hint_clear", level.intro), name).toBe(expected);
  }
});

test("replayProgression and JSON serialization are deterministic for the folded state", () => {
  const firstPass = foldEvents(allQuestCompletions, graph);
  const derived = deriveUnlocks(firstPass, graph);
  const replayLog = [speedrunUnlock("speedrun"), ...allQuestCompletions, ...derived];
  const expectedState = foldEvents(replayLog, graph);

  const replay = replayProgression(replayLog, graph);

  expect(replay.equal).toBe(true);
  expect(replay.snapshot).toEqual(expectedState);
  expect(replay.replayed).toEqual(expectedState);
  expect(jsonRoundTrip(replay.snapshot)).toEqual(replay.snapshot);
});

function questCompleted(questId: QuestId, completedAt: string): QuestCompletedEvent {
  const graphQuest = graph.quests.find((candidate) => candidate.id === questId);
  if (!graphQuest) {
    throw new Error(`unknown test quest ${questId}`);
  }

  return {
    at: completedAt,
    type: "quest_completed",
    quest_id: graphQuest.id,
    level_id: graphQuest.level,
    required: graphQuest.required,
    xp: graphQuest.xp ?? 0,
  };
}

function questUnlock(
  id: FeatureId,
  sourceLevelId: LevelId,
  sourceQuestId: QuestId,
  unlockedAt: string,
): UnlockEvent {
  return {
    at: unlockedAt,
    type: "unlock",
    target: { type: "feature", id },
    reason: "quest_completed",
    source_quest_id: sourceQuestId,
    source_level_id: sourceLevelId,
  };
}

function levelUnlock(
  id: LevelId,
  sourceLevelId: LevelId,
  sourceQuestId: QuestId,
  unlockedAt: string,
): UnlockEvent {
  return {
    at: unlockedAt,
    type: "unlock",
    target: { type: "level", id },
    reason: "quest_completed",
    source_quest_id: sourceQuestId,
    source_level_id: sourceLevelId,
  };
}

function speedrunUnlock(reason: "speedrun" | "cheat"): UnlockEvent {
  return {
    at: at.speedrun,
    type: "unlock",
    target: { type: "feature", id: feature.shortcut },
    reason,
  };
}

function hintOpened(questId: QuestId, levelId: LevelId): ProgressionEvent {
  return {
    at: at.hint,
    type: "hint_opened",
    quest_id: questId,
    level_id: levelId,
  };
}

function hasBadge(state: ProgressionState, badge: Badge, levelId?: LevelId): boolean {
  return state.badges.some((award) => award.badge === badge && award.levelId === levelId);
}

function jsonRoundTrip(state: ProgressionState): ProgressionState {
  return JSON.parse(JSON.stringify(state)) as ProgressionState;
}
