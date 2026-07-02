import type { Quest } from "../core";
import { questCommand, type CliDeps, type ProgressionStore } from "../cli";
import { foldEvents, type ProgressionGraph, type ProgressionState } from "../progression";
import { evaluateQuest, type Probes, type VerifierEvent } from "../verifier";
import type { PiEventHandler, PiExtensionContext, PiExtensionEvent } from "./index";

/** Structural slice of the Pi UI surface used by the HUD (spike-verified shapes). */
export interface HudWidgetOptions {
  readonly placement: "aboveEditor" | "belowEditor";
  readonly lines: readonly string[];
}

export interface HudUi {
  readonly setWidget: (id: string, options: HudWidgetOptions) => void;
  readonly setStatus: (id: string, text: string) => void;
  readonly notify: (message: string, level?: "info" | "warning" | "error") => void;
}

export interface HudExtensionContext extends Omit<PiExtensionContext, "ui"> {
  readonly ui: HudUi;
}

export type HudCommandHandler = (args: string, ctx: HudExtensionContext) => void | Promise<void>;

/** Real omp expects a spec object; a bare function throws `handler is not a function` (LOO-139 live). */
export interface HudCommandSpec {
  readonly description: string;
  readonly handler: HudCommandHandler;
}

export interface HudPi {
  readonly on: (event: string, handler: PiEventHandler) => void;
  readonly registerCommand: (name: string, spec: HudCommandSpec) => void;
}

/** Themed level labels paired with functional descriptors (PRD naming rule). */
export const coreLevelLabels: Readonly<Record<string, string>> = {
  "tutorial-island": "Tutorial Island (onboarding)",
  "first-quest": "First Quest (core agent loop)",
  "lore": "Lore (context)",
  "skill-tree": "Skill Tree (skills)",
  "loadout": "Loadout (MCP + extensions)",
  "the-party": "The Party (subagents)",
  "macros": "Macros (automation)",
  "final-boss": "Final Boss (capstone)",
};

export interface HudDeps {
  readonly graph: ProgressionGraph;
  readonly quests: readonly Quest[];
  readonly store: ProgressionStore;
  readonly probes: Probes;
  readonly now: () => string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly paths?: Readonly<Record<string, string>>;
}

export interface GarnishHudHandle {
  readonly refresh: () => Promise<void>;
  readonly widgetLines: () => readonly string[];
  readonly statusText: () => string;
}

const WIDGET_ID = "garnish-quest-log";
const STATUS_ID = "garnish";
const HUD_EVENTS = ["session_start", "turn_start", "turn_end", "tool_call", "tool_result", "agent_end"] as const;

export function renderHudLines(
  state: ProgressionState,
  graph: ProgressionGraph,
  quests: readonly Quest[],
  labels: Readonly<Record<string, string>> = coreLevelLabels,
): string[] {
  const levelId = state.currentLevel === null ? undefined : `${state.currentLevel}`;
  const levelLabel = levelId === undefined ? "All levels complete" : (labels[levelId] ?? levelId);
  const orderedLevels = [...graph.levels].sort((left, right) => left.order - right.order);
  const levelOrder = orderedLevels.find((level) => `${level.id}` === levelId)?.order;

  const lines = [
    `Garnish — ${levelOrder === undefined ? levelLabel : `Level ${levelOrder}: ${levelLabel}`}`,
    `XP: ${state.xpTotal}`,
  ];

  const active = activeQuest(state, graph, quests);
  if (active === undefined) {
    lines.push("No active quest — all required quests complete.");
    return lines;
  }

  lines.push(`Quest: ${active.title} (${active.id})`);
  const nextCheck = active.checks[0];
  if (nextCheck !== undefined) {
    lines.push(`Next check: ${summarizeCheck(nextCheck)}`);
  }

  return lines.slice(0, 10);
}

export function renderStatusLine(
  state: ProgressionState,
  graph: ProgressionGraph,
  quests: readonly Quest[],
  labels: Readonly<Record<string, string>> = coreLevelLabels,
): string {
  const levelId = state.currentLevel === null ? undefined : `${state.currentLevel}`;
  const levelLabel = levelId === undefined ? "complete" : (labels[levelId] ?? levelId);
  const active = activeQuest(state, graph, quests);
  const questPart = active === undefined ? "all required quests done" : `${active.title}`;
  return `${levelLabel} · ${state.xpTotal} XP · ${questPart}`;
}

export function registerGarnishHud(pi: HudPi, deps: HudDeps): GarnishHudHandle {
  const labels = deps.labels ?? coreLevelLabels;
  const recorded: VerifierEvent[] = [];
  let seq = 0;
  let currentSessionId: string | undefined;
  let latestCtx: HudExtensionContext | undefined;
  let lastWidgetLines: readonly string[] = [];
  let lastStatusText = "";
  let lastCompletedCount = -1;
  let lastLevelCount = -1;

  const cliDeps = (): CliDeps => ({
    graph: deps.graph,
    quests: deps.quests,
    store: deps.store,
    now: deps.now,
  });

  const refresh = async (): Promise<void> => {
    const state = foldEvents(await deps.store.readEvents(), deps.graph);
    lastWidgetLines = renderHudLines(state, deps.graph, deps.quests, labels);
    lastStatusText = renderStatusLine(state, deps.graph, deps.quests, labels);

    try {
      latestCtx?.ui.setWidget(WIDGET_ID, { placement: "aboveEditor", lines: lastWidgetLines });
      latestCtx?.ui.setStatus(STATUS_ID, lastStatusText);

      const completedCount = state.completedQuests.length;
      const levelCount = state.completedLevels.length;
      if (lastCompletedCount >= 0 && completedCount > lastCompletedCount) {
        latestCtx?.ui.setStatus(STATUS_ID, `quest complete! · ${lastStatusText}`);
      }
      if (lastLevelCount >= 0 && levelCount > lastLevelCount) {
        latestCtx?.ui.notify(`Level complete — ${lastStatusText}`, "info");
      }
      lastCompletedCount = completedCount;
      lastLevelCount = levelCount;
    } catch {
      // Headless/no-UI runs degrade safely; verification is unaffected.
    }
  };

  for (const eventName of HUD_EVENTS) {
    pi.on(eventName, (event: PiExtensionEvent, ctx: PiExtensionContext) => {
      latestCtx = ctx as HudExtensionContext;
      if (eventName === "session_start" && typeof event.sessionId === "string") {
        currentSessionId = event.sessionId;
      }
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(event)) {
        if (key !== "type") {
          payload[key] = value;
        }
      }
      recorded.push({
        name: event.type,
        seq: (seq += 1),
        sessionId: typeof event.sessionId === "string" ? event.sessionId : currentSessionId,
        payload,
      });
      if (eventName === "session_start" || eventName === "turn_end" || eventName === "agent_end") {
        void refresh();
      }
    });
  }

  pi.registerCommand("quest", {
    description: "Show the Garnish quest log; `/quest check` re-verifies the active quest.",
    handler: async (args: string, ctx: HudExtensionContext) => {
    latestCtx = ctx;
    try {
      if (args.trim() === "check") {
        const state = foldEvents(await deps.store.readEvents(), deps.graph);
        const active = activeQuest(state, deps.graph, deps.quests);
        if (active === undefined) {
          ctx.ui.notify("No active quest to check.", "info");
          return;
        }
        const result = await evaluateQuest(active, {
          probes: deps.probes,
          events: recorded,
          currentSessionId,
          paths: deps.paths,
        });
        const perCheck = result.checks
          .map((entry, index) => `  ${index + 1}. ${entry.result.status} — ${entry.result.evidence.message}`)
          .join("\n");
        ctx.ui.notify(`Quest ${active.id}: ${result.status}\n${perCheck}`, result.status === "pass" ? "info" : "warning");
        await refresh();
        return;
      }

      const outcome = await questCommand(cliDeps());
      ctx.ui.notify(outcome.text, "info");
    } catch {
      ctx.ui.notify("Garnish could not render the quest view.", "warning");
    }
    },
  });

  return {
    refresh,
    widgetLines: () => lastWidgetLines,
    statusText: () => lastStatusText,
  };
}

function activeQuest(
  state: ProgressionState,
  graph: ProgressionGraph,
  quests: readonly Quest[],
): Quest | undefined {
  const completed = new Set<string>(state.completedQuests.map(String));
  const firstLevel = [...graph.levels].sort((left, right) => left.order - right.order)[0];
  const unlockedLevels = new Set<string>([
    ...(firstLevel === undefined ? [] : [`${firstLevel.id}`]),
    ...state.unlockSet.levels.map(String),
    ...state.completedLevels.map(String),
  ]);

  return quests.find(
    (quest) =>
      quest.required &&
      !completed.has(`${quest.id}`) &&
      unlockedLevels.has(`${quest.level}`) &&
      quest.prereqs.every((prereq) => completed.has(`${prereq}`)),
  );
}

function summarizeCheck(check: Quest["checks"][number]): string {
  switch (check.type) {
    case "event":
      return `observe ${check.match.event}`;
    case "file_exists":
      return `create ${check.path}`;
    case "json_path":
      return `configure ${check.file}`;
    case "yaml_path":
      return `configure ${check.file}`;
    case "command":
      return `run ${typeof check.command === "string" ? check.command : check.command.join(" ")}`;
    case "git":
      return "reach the target git state";
    case "mcp_handshake":
      return "connect the MCP server";
    case "skill_valid":
      return `author a valid skill at ${check.path}`;
    case "confirm":
      return check.prompt ?? "confirm completion";
  }
}
