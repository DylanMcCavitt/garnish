import type { FeatureId, LevelId, ProgressionEvent, Quest, UnlockEvent } from "../core";
import {
  deriveUnlocks,
  foldEvents,
  type ProgressionGraph,
  type ProgressionState,
} from "../progression";
import type { MaybePromise } from "../verifier";

export interface CommandOutcome {
  readonly text: string;
  readonly exitCode: number;
}

export interface ProgressionStore {
  readonly readEvents: () => MaybePromise<readonly ProgressionEvent[]>;
  readonly appendEvents: (events: readonly ProgressionEvent[]) => MaybePromise<void>;
}

export interface CliDeps {
  readonly graph: ProgressionGraph;
  readonly quests?: readonly Quest[];
  readonly store: ProgressionStore;
  readonly now: () => string;
}

export interface DoctorDeps {}

type QuestDisplayState = "complete" | "active" | "available" | "locked";

interface QuestLine {
  readonly quest: ProgressionGraph["quests"][number];
  readonly state: QuestDisplayState;
  readonly isNext: boolean;
}

export async function statusCommand(deps: CliDeps): Promise<CommandOutcome> {
  const state = foldEvents(await deps.store.readEvents(), deps.graph);
  const lines: string[] = [];
  const currentLevel = state.currentLevel === null ? undefined : findLevel(deps.graph, `${state.currentLevel}`);
  const levelLabel = currentLevel === undefined ? "all levels complete" : `Level ${currentLevel.order} — ${currentLevel.id}`;

  lines.push(`Garnish — ${levelLabel}`);
  lines.push(`XP: ${state.xpTotal}`);
  if (state.badges.length > 0) {
    lines.push(`Badges: ${state.badges.map((award) => award.badge).join(", ")}`);
  }

  const questLines = computeQuestLines(state, deps.graph, deps.quests);
  for (const level of [...deps.graph.levels].sort((left, right) => left.order - right.order)) {
    lines.push("");
    lines.push(`Level ${level.order}: ${level.id}${state.completedLevels.includes(level.id) ? " ✓" : ""}`);
    for (const entry of questLines.filter((line) => `${line.quest.level}` === `${level.id}`)) {
      const marker =
        entry.state === "complete" ? "[x]" : entry.state === "locked" ? "[·]" : "[ ]";
      const suffix = entry.isNext ? "  ← next" : entry.quest.required ? "" : "  (optional)";
      lines.push(`  ${marker} ${entry.quest.id}${suffix}`);
    }
  }

  const next = questLines.find((line) => line.isNext);
  lines.push("");
  lines.push(next === undefined ? "Next: nothing — all required quests complete." : `Next: ${next.quest.id}`);

  return { text: lines.join("\n"), exitCode: 0 };
}

export async function questCommand(deps: CliDeps): Promise<CommandOutcome> {
  const state = foldEvents(await deps.store.readEvents(), deps.graph);
  const next = computeQuestLines(state, deps.graph, deps.quests).find((line) => line.isNext);

  if (next === undefined) {
    return { text: "No active quest — all required quests are complete.", exitCode: 0 };
  }

  const quest = (deps.quests ?? []).find((candidate) => `${candidate.id}` === `${next.quest.id}`);
  const lines: string[] = [`Active quest: ${next.quest.id}`];
  if (quest !== undefined) {
    lines.push(`Title: ${quest.title}`);
    lines.push(`XP: ${quest.xp}`);
    if (quest.description.length > 0) {
      lines.push("");
      lines.push(quest.description);
    }
    lines.push("");
    lines.push("Checks:");
    for (const check of quest.checks) {
      lines.push(`- ${describeCheck(check)}`);
    }
  } else {
    lines.push(`XP: ${next.quest.xp ?? 0}`);
    lines.push("");
    lines.push("(full quest unavailable — pack quests not provided)");
  }

  return { text: lines.join("\n"), exitCode: 0 };
}

export interface UnlockOptions {
  readonly all?: boolean;
  readonly level?: string;
}

export async function unlockCommand(deps: CliDeps, options: UnlockOptions): Promise<CommandOutcome> {
  if (!options.all && options.level === undefined) {
    return { text: "Usage: garnish unlock --all | unlock --level <id|N>", exitCode: 2 };
  }

  const events = await deps.store.readEvents();
  const state = foldEvents(events, deps.graph);
  const at = deps.now();
  const unlocks: UnlockEvent[] = [];

  if (options.all === true) {
    for (const feature of graphFeatureIds(deps.graph)) {
      if (!state.unlockSet.features.includes(feature)) {
        unlocks.push(featureUnlock(feature, at));
      }
    }
    for (const level of deps.graph.levels) {
      if (!state.unlockSet.levels.includes(level.id)) {
        unlocks.push(levelUnlock(level.id, at));
      }
    }
  } else if (options.level !== undefined) {
    const level = findLevel(deps.graph, options.level);
    if (level === undefined) {
      const known = deps.graph.levels.map((entry) => `${entry.id} (${entry.order})`).join(", ");
      return { text: `unlock: unknown level "${options.level}". Known levels: ${known}`, exitCode: 1 };
    }
    if (!state.unlockSet.levels.includes(level.id)) {
      unlocks.push(levelUnlock(level.id, at));
    }
    for (const feature of level.unlocks ?? []) {
      if (!state.unlockSet.features.includes(feature)) {
        unlocks.push(featureUnlock(feature, at));
      }
    }
  }

  if (unlocks.length === 0) {
    return { text: "Nothing to unlock — already unlocked.", exitCode: 0 };
  }

  await deps.store.appendEvents(unlocks);
  const updated = foldEvents([...events, ...unlocks], deps.graph);
  const derivedUnlocks = deriveUnlocks(updated, deps.graph);
  if (derivedUnlocks.length > 0) {
    await deps.store.appendEvents(derivedUnlocks);
  }

  const summary = [...unlocks, ...derivedUnlocks]
    .map((event) => (event.target.type === "feature" ? `feature ${event.target.id}` : `level ${event.target.id}`))
    .join(", ");
  return {
    text: `Unlocked: ${summary}\nNote: skipped quests award no XP. Clear them later to earn XP and the Speedrunner badge.`,
    exitCode: 0,
  };
}

export async function doctorCommand(_deps: DoctorDeps = {}): Promise<CommandOutcome> {
  return {
    text: [
      "Garnish doctor",
      "The embedded setup doctor was superseded by the standalone harness.",
      "Use the standalone harness health checks for setup and runtime diagnostics.",
    ].join("\n"),
    exitCode: 1,
  };
}

export interface MainDeps {
  readonly cli: CliDeps;
  readonly doctor: DoctorDeps;
}

export async function main(argv: readonly string[], deps: MainDeps): Promise<CommandOutcome> {
  const [command = "status", ...rest] = argv;
  switch (command) {
    case "status":
      return statusCommand(deps.cli);
    case "quest":
      return questCommand(deps.cli);
    case "unlock":
    case "cheat":
      return unlockCommand(deps.cli, parseUnlockArgs(rest));
    case "doctor":
      return doctorCommand(deps.doctor);
    default:
      return { text: usage(), exitCode: 2 };
  }
}

export function usage(): string {
  return [
    "garnish <command>",
    "",
    "Commands:",
    "  status            show level, XP, and quest progress",
    "  quest             show the active quest's full text and checks",
    "  unlock --all      unlock everything without awarding XP",
    "  unlock --level N  unlock one level by id or order",
    "  cheat             alias for unlock",
    "  doctor            explain the standalone-harness diagnostics handoff",
  ].join("\n");
}

export function parseUnlockArgs(args: readonly string[]): UnlockOptions {
  const options: { all?: boolean; level?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--all") {
      options.all = true;
      continue;
    }
    if (args[index] === "--level") {
      options.level = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function computeQuestLines(
  state: ProgressionState,
  graph: ProgressionGraph,
  quests?: readonly Quest[],
): QuestLine[] {
  const orderedLevels = [...graph.levels].sort((left, right) => left.order - right.order);
  const completedQuests = new Set<string>(state.completedQuests.map(String));
  const prereqsById = new Map<string, readonly string[]>(
    (quests ?? []).map((quest) => [`${quest.id}`, quest.prereqs.map(String)]),
  );
  const lines: QuestLine[] = [];
  let nextAssigned = false;

  for (const level of orderedLevels) {
    const levelUnlocked =
      level.order === orderedLevels[0]?.order ||
      state.unlockSet.levels.includes(level.id) ||
      state.completedLevels.includes(level.id);
    const levelQuests = graph.quests.filter((quest) => `${quest.level}` === `${level.id}`);

    for (const quest of levelQuests) {
      if (completedQuests.has(`${quest.id}`)) {
        lines.push({ quest, state: "complete", isNext: false });
        continue;
      }
      if (!levelUnlocked) {
        lines.push({ quest, state: "locked", isNext: false });
        continue;
      }
      const prereqs = prereqsById.get(`${quest.id}`) ?? [];
      const prereqsMet = prereqs.every((prereq) => completedQuests.has(prereq));
      const isNext = !nextAssigned && quest.required && prereqsMet;
      if (isNext) {
        nextAssigned = true;
      }
      lines.push({ quest, state: isNext ? "active" : "available", isNext });
    }
  }

  return lines;
}

function findLevel(graph: ProgressionGraph, selector: string): ProgressionGraph["levels"][number] | undefined {
  return graph.levels.find((level) => `${level.order}` === selector) ?? graph.levels.find((level) => `${level.id}` === selector);
}

function graphFeatureIds(graph: ProgressionGraph): FeatureId[] {
  const features = new Set<FeatureId>();
  for (const level of graph.levels) {
    for (const feature of level.unlocks ?? []) {
      features.add(feature);
    }
  }
  for (const edge of graph.unlockEdges ?? []) {
    features.add(edge.feature);
  }
  for (const quest of graph.quests) {
    for (const feature of quest.unlocks ?? []) {
      features.add(feature);
    }
  }
  return [...features].sort((left, right) => `${left}`.localeCompare(`${right}`));
}

function featureUnlock(feature: FeatureId, at: string): UnlockEvent {
  return { at, type: "unlock", target: { type: "feature", id: feature }, reason: "cheat" };
}

function levelUnlock(level: LevelId, at: string): UnlockEvent {
  return { at, type: "unlock", target: { type: "level", id: level }, reason: "cheat" };
}

function describeCheck(check: Quest["checks"][number]): string {
  switch (check.type) {
    case "event": {
      const extras: string[] = [];
      if (check.match.count !== undefined) {
        extras.push(`count ${JSON.stringify(check.match.count)}`);
      }
      if (check.match.min_assistant_turns !== undefined) {
        extras.push(`min_assistant_turns ${check.match.min_assistant_turns}`);
      }
      if (check.sameSession === true) {
        extras.push("same session");
      }
      return `event ${check.match.event}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`;
    }
    case "file_exists":
      return `file exists: ${check.path}`;
    case "json_path":
      return `json ${check.file} ${check.path}`;
    case "yaml_path":
      return `yaml ${check.file} ${check.path}`;
    case "command":
      return `command: ${typeof check.command === "string" ? check.command : check.command.join(" ")}`;
    case "git":
      return "git repository state";
    case "mcp_handshake":
      return `MCP handshake: ${typeof check.server === "string" ? check.server : JSON.stringify(check.server)}`;
    case "skill_valid":
      return `skill valid: ${check.path}`;
    case "confirm":
      return `confirm: ${check.prompt ?? check.id ?? "user confirmation"}`;
  }
}
