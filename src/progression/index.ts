import type {
  Badge,
  FeatureId,
  LevelId,
  ProgressionEvent,
  QuestCompletedEvent,
  QuestId,
  UnlockEvent,
} from "../core";

export type ProgressionGraphQuest = {
  readonly id: QuestId;
  readonly level: LevelId;
  readonly required: boolean;
  readonly xp?: number;
  readonly unlocks?: readonly FeatureId[];
};

export type ProgressionGraphLevel = {
  readonly id: LevelId;
  readonly order: number;
  readonly quests: readonly QuestId[];
  readonly unlocks?: readonly FeatureId[];
};

export type ProgressionGraphUnlockEdge = {
  readonly quest: QuestId;
  readonly feature: FeatureId;
};

export type ProgressionGraph = {
  readonly levels: readonly ProgressionGraphLevel[];
  readonly quests: readonly ProgressionGraphQuest[];
  readonly unlockEdges?: readonly ProgressionGraphUnlockEdge[];
};

export type ProgressionBadgeAward = {
  readonly badge: Badge;
  readonly levelId?: LevelId;
  readonly questId?: QuestId;
};

export type LevelCompletion = {
  readonly levelId: LevelId;
  readonly at: string;
  readonly sourceQuestId?: QuestId;
};

export type ProgressionUnlockSet = {
  readonly features: readonly FeatureId[];
  readonly levels: readonly LevelId[];
};

export type ProgressionHintBookkeeping = {
  readonly quests: readonly QuestId[];
  readonly levels: readonly LevelId[];
};

export type ProgressionState = {
  readonly completedQuests: readonly QuestId[];
  readonly xpTotal: number;
  readonly completedLevels: readonly LevelId[];
  readonly currentLevel: LevelId | null;
  readonly unlockSet: ProgressionUnlockSet;
  readonly badges: readonly ProgressionBadgeAward[];
  readonly hintsOpened: ProgressionHintBookkeeping;
  readonly levelCompletions: readonly LevelCompletion[];
};

export type ProgressionReplayResult = {
  readonly snapshot: ProgressionState;
  readonly replayed: ProgressionState;
  readonly equal: boolean;
};

const SYSTEM_EVENT_AT = "1970-01-01T00:00:00Z";

export function foldEvents(events: readonly ProgressionEvent[], graph: ProgressionGraph): ProgressionState {
  const normalized = normalizeGraph(graph);
  const completedQuests = new Set<QuestId>();
  const hintedQuests = new Set<QuestId>();
  const hintedLevels = new Set<LevelId>();
  const unlockedFeatures = new Set<FeatureId>();
  const unlockedLevels = new Set<LevelId>();
  const badges = new Map<string, ProgressionBadgeAward>();
  const levelCompletions = new Map<LevelId, LevelCompletion>();
  let xpTotal = 0;
  let usedSpeedrunPath = false;

  const initialLevel = normalized.levels[0];
  if (initialLevel) {
    unlockedLevels.add(initialLevel.id);
  }

  const addBadge = (award: ProgressionBadgeAward) => {
    badges.set(badgeKey(award), award);
  };

  const completeNewLevels = (trigger: QuestCompletedEvent | undefined) => {
    for (const level of normalized.levels) {
      if (levelCompletions.has(level.id)) {
        continue;
      }

      const requiredQuests = normalized.requiredQuestIdsByLevel.get(level.id) ?? [];
      if (!requiredQuests.every((questId) => completedQuests.has(questId))) {
        continue;
      }

      levelCompletions.set(level.id, {
        levelId: level.id,
        at: trigger?.at ?? SYSTEM_EVENT_AT,
        sourceQuestId: trigger?.quest_id,
      });

      if (requiredQuests.every((questId) => !hintedQuests.has(questId))) {
        addBadge({ badge: "no_hint_clear", levelId: level.id });
      }
    }
  };

  const addComputedBadges = () => {
    for (const level of normalized.levels) {
      const questIds = normalized.questIdsByLevel.get(level.id) ?? [];
      if (questIds.length > 0 && questIds.every((questId) => completedQuests.has(questId))) {
        addBadge({ badge: "completionist", levelId: level.id });
      }
    }

    if (normalized.quests.length > 0 && normalized.quests.every((quest) => completedQuests.has(quest.id))) {
      addBadge({ badge: "completionist" });
    }

    if (
      usedSpeedrunPath &&
      normalized.requiredQuestIds.length > 0 &&
      normalized.requiredQuestIds.every((questId) => completedQuests.has(questId))
    ) {
      addBadge({ badge: "speedrunner" });
    }
  };

  completeNewLevels(undefined);
  addComputedBadges();

  for (const event of events) {
    switch (event.type) {
      case "quest_completed": {
        if (!completedQuests.has(event.quest_id)) {
          completedQuests.add(event.quest_id);
          xpTotal += normalized.questsById.get(event.quest_id)?.xp ?? event.xp;
          completeNewLevels(event);
          addComputedBadges();
        }
        break;
      }
      case "unlock": {
        if (event.target.type === "feature") {
          unlockedFeatures.add(event.target.id);
        } else {
          unlockedLevels.add(event.target.id);
        }
        if (event.reason === "speedrun" || event.reason === "cheat") {
          usedSpeedrunPath = true;
          addComputedBadges();
        }
        break;
      }
      case "xp_award": {
        if (!event.quest_id) {
          xpTotal += event.amount;
        }
        break;
      }
      case "badge_award": {
        addBadge({ badge: event.badge, levelId: event.level_id, questId: event.quest_id });
        break;
      }
      case "hint_opened": {
        hintedQuests.add(event.quest_id);
        hintedLevels.add(event.level_id);
        break;
      }
    }
  }

  const completedLevelIds = new Set(levelCompletions.keys());

  return {
    completedQuests: sortQuestIds([...completedQuests]),
    xpTotal,
    completedLevels: sortLevelIds([...completedLevelIds], normalized),
    currentLevel: normalized.levels.find((level) => !completedLevelIds.has(level.id))?.id ?? null,
    unlockSet: {
      features: sortFeatureIds([...unlockedFeatures]),
      levels: sortLevelIds([...unlockedLevels], normalized),
    },
    badges: sortBadges([...badges.values()], normalized),
    hintsOpened: {
      quests: sortQuestIds([...hintedQuests]),
      levels: sortLevelIds([...hintedLevels], normalized),
    },
    levelCompletions: sortLevelCompletions([...levelCompletions.values()], normalized),
  };
}

export function deriveUnlocks(state: ProgressionState, graph: ProgressionGraph): UnlockEvent[] {
  const normalized = normalizeGraph(graph);
  const completedQuests = new Set(state.completedQuests);
  const unlockedFeatures = new Set(state.unlockSet.features);
  const unlockedLevels = new Set(state.unlockSet.levels);
  const unlocks: UnlockEvent[] = [];

  for (const completion of sortLevelCompletions([...state.levelCompletions], normalized)) {
    for (const feature of featuresUnlockedByLevel(completion.levelId, completedQuests, normalized)) {
      if (unlockedFeatures.has(feature)) {
        continue;
      }
      unlockedFeatures.add(feature);
      unlocks.push({
        at: completion.at,
        type: "unlock",
        target: { type: "feature", id: feature },
        reason: "quest_completed",
        source_quest_id: completion.sourceQuestId,
        source_level_id: completion.levelId,
      });
    }

    const nextLevel = normalized.nextLevelById.get(completion.levelId);
    if (nextLevel && !unlockedLevels.has(nextLevel.id)) {
      unlockedLevels.add(nextLevel.id);
      unlocks.push({
        at: completion.at,
        type: "unlock",
        target: { type: "level", id: nextLevel.id },
        reason: "quest_completed",
        source_quest_id: completion.sourceQuestId,
        source_level_id: completion.levelId,
      });
    }
  }

  return unlocks;
}

export function replayProgression(
  events: readonly ProgressionEvent[],
  graph: ProgressionGraph,
): ProgressionReplayResult {
  const snapshot = foldEvents(events, graph);
  const replayed = foldEvents(events, graph);

  return {
    snapshot,
    replayed,
    equal: JSON.stringify(snapshot) === JSON.stringify(replayed),
  };
}

type NormalizedGraph = {
  readonly levels: readonly ProgressionGraphLevel[];
  readonly quests: readonly ProgressionGraphQuest[];
  readonly questsById: ReadonlyMap<QuestId, ProgressionGraphQuest>;
  readonly questIdsByLevel: ReadonlyMap<LevelId, readonly QuestId[]>;
  readonly requiredQuestIds: readonly QuestId[];
  readonly requiredQuestIdsByLevel: ReadonlyMap<LevelId, readonly QuestId[]>;
  readonly unlockEdgesByLevel: ReadonlyMap<LevelId, readonly ProgressionGraphUnlockEdge[]>;
  readonly nextLevelById: ReadonlyMap<LevelId, ProgressionGraphLevel>;
  readonly levelOrder: ReadonlyMap<LevelId, number>;
};

function normalizeGraph(graph: ProgressionGraph): NormalizedGraph {
  const levels = [...graph.levels].sort((left, right) => left.order - right.order || compareId(left.id, right.id));
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const levelOrder = new Map(levels.map((level, index) => [level.id, index]));
  const quests = [...graph.quests].sort((left, right) => compareLevelOrder(left.level, right.level, levelOrder) || compareId(left.id, right.id));
  const questsById = new Map(quests.map((quest) => [quest.id, quest]));
  const questIdsByLevel = new Map<LevelId, QuestId[]>();
  const requiredQuestIdsByLevel = new Map<LevelId, QuestId[]>();
  const unlockEdgesByLevel = new Map<LevelId, ProgressionGraphUnlockEdge[]>();
  const nextLevelById = new Map<LevelId, ProgressionGraphLevel>();

  for (const level of levels) {
    questIdsByLevel.set(level.id, [...level.quests].sort(compareId));
    requiredQuestIdsByLevel.set(level.id, []);
    unlockEdgesByLevel.set(level.id, []);
  }

  for (const quest of quests) {
    const levelQuestIds = questIdsByLevel.get(quest.level) ?? [];
    if (!levelQuestIds.includes(quest.id)) {
      levelQuestIds.push(quest.id);
      levelQuestIds.sort(compareId);
      questIdsByLevel.set(quest.level, levelQuestIds);
    }
    if (quest.required) {
      const requiredQuestIds = requiredQuestIdsByLevel.get(quest.level) ?? [];
      requiredQuestIds.push(quest.id);
      requiredQuestIds.sort(compareId);
      requiredQuestIdsByLevel.set(quest.level, requiredQuestIds);
    }
  }

  for (const edge of graph.unlockEdges ?? []) {
    const quest = questsById.get(edge.quest);
    if (!quest || !levelById.has(quest.level)) {
      continue;
    }
    const levelEdges = unlockEdgesByLevel.get(quest.level) ?? [];
    levelEdges.push(edge);
    levelEdges.sort((left, right) => compareId(left.feature, right.feature) || compareId(left.quest, right.quest));
    unlockEdgesByLevel.set(quest.level, levelEdges);
  }

  for (let index = 0; index < levels.length - 1; index += 1) {
    nextLevelById.set(levels[index].id, levels[index + 1]);
  }

  return {
    levels,
    quests,
    questsById,
    questIdsByLevel,
    requiredQuestIds: quests.filter((quest) => quest.required).map((quest) => quest.id),
    requiredQuestIdsByLevel,
    unlockEdgesByLevel,
    nextLevelById,
    levelOrder,
  };
}

function featuresUnlockedByLevel(
  levelId: LevelId,
  completedQuests: ReadonlySet<QuestId>,
  graph: NormalizedGraph,
): FeatureId[] {
  const features = new Set<FeatureId>();
  const level = graph.levels.find((candidate) => candidate.id === levelId);
  for (const feature of level?.unlocks ?? []) {
    features.add(feature);
  }

  for (const questId of graph.questIdsByLevel.get(levelId) ?? []) {
    if (!completedQuests.has(questId)) {
      continue;
    }
    for (const feature of graph.questsById.get(questId)?.unlocks ?? []) {
      features.add(feature);
    }
  }

  for (const edge of graph.unlockEdgesByLevel.get(levelId) ?? []) {
    if (completedQuests.has(edge.quest)) {
      features.add(edge.feature);
    }
  }

  return sortFeatureIds([...features]);
}

function sortQuestIds(ids: QuestId[]): QuestId[] {
  return ids.sort(compareId);
}

function sortFeatureIds(ids: FeatureId[]): FeatureId[] {
  return ids.sort(compareId);
}

function sortLevelIds(ids: LevelId[], graph: NormalizedGraph): LevelId[] {
  return ids.sort((left, right) => compareLevelOrder(left, right, graph.levelOrder) || compareId(left, right));
}

function sortLevelCompletions(completions: LevelCompletion[], graph: NormalizedGraph): LevelCompletion[] {
  return completions.sort(
    (left, right) => compareLevelOrder(left.levelId, right.levelId, graph.levelOrder) || compareId(left.levelId, right.levelId),
  );
}

function sortBadges(awards: ProgressionBadgeAward[], graph: NormalizedGraph): ProgressionBadgeAward[] {
  return awards.sort(
    (left, right) =>
      compareId(left.badge, right.badge) ||
      compareMaybeLevelId(left.levelId, right.levelId, graph.levelOrder) ||
      compareMaybeId(left.questId, right.questId),
  );
}

function badgeKey(award: ProgressionBadgeAward): string {
  return `${award.badge}:${award.levelId ?? ""}:${award.questId ?? ""}`;
}

function compareLevelOrder(left: LevelId, right: LevelId, order: ReadonlyMap<LevelId, number>): number {
  return (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER);
}

function compareMaybeLevelId(
  left: LevelId | undefined,
  right: LevelId | undefined,
  order: ReadonlyMap<LevelId, number>,
): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return compareLevelOrder(left, right, order) || compareId(left, right);
}

function compareMaybeId(left: string | undefined, right: string | undefined): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return compareId(left, right);
}

function compareId(left: string, right: string): number {
  return left.localeCompare(right);
}
