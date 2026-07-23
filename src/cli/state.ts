import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

import {
  FeatureIdSchema,
  LevelIdSchema,
  ProgressionEventSchema,
  QuestIdSchema,
  QuestSchema,
  UnlockEdgeSchema,
  type ProgressionEvent,
  type Quest,
} from "../core";
import type { ProgressionGraph } from "../progression";
import type { ProgressionStore } from "./index";

/** Durable Garnish state under {agent_dir}/garnish/, provisioned by the standalone harness. */

export const GraphFileSchema = z.object({
  levels: z.array(
    z.object({
      id: LevelIdSchema,
      order: z.number(),
      quests: z.array(QuestIdSchema),
      unlocks: z.array(FeatureIdSchema).optional(),
    }),
  ),
  quests: z.array(
    z.object({
      id: QuestIdSchema,
      level: LevelIdSchema,
      required: z.boolean(),
      xp: z.number(),
      unlocks: z.array(FeatureIdSchema).optional(),
    }),
  ),
  unlockEdges: z.array(UnlockEdgeSchema),
});

export const StateFileSchema = z.object({
  activeLevel: z.string().optional(),
  packs: z.array(z.string()).optional(),
  sandboxDir: z.string().optional(),
});

export interface InstalledGarnishState {
  readonly graph: ProgressionGraph;
  readonly quests: readonly Quest[];
  readonly state: z.infer<typeof StateFileSchema>;
  readonly eventsPath: string;
}

/** Load the provisioned graph/quests/state snapshot; throws when not initialized. */
export function loadInstalledState(agentDir: string): InstalledGarnishState {
  const garnishDir = join(agentDir, "garnish");
  const graphPath = join(garnishDir, "graph.json");
  if (!existsSync(graphPath)) {
    throw new Error(`Garnish is not initialized (missing ${graphPath}). Provision it with the standalone harness first.`);
  }

  const graph: ProgressionGraph = GraphFileSchema.parse(JSON.parse(readFileSync(graphPath, "utf8")));
  const quests: Quest[] = z
    .array(QuestSchema)
    .parse(JSON.parse(readFileSync(join(garnishDir, "quests.json"), "utf8")));
  const state = StateFileSchema.parse(JSON.parse(readFileSync(join(garnishDir, "state.json"), "utf8")));

  return { graph, quests, state, eventsPath: join(garnishDir, "events.jsonl") };
}

/** Synchronous fs-backed event store over {agent_dir}/garnish/events.jsonl. */
export function createFsEventStore(eventsPath: string): ProgressionStore {
  return {
    readEvents: (): readonly ProgressionEvent[] => {
      if (!existsSync(eventsPath)) {
        return [];
      }
      return readFileSync(eventsPath, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => ProgressionEventSchema.parse(JSON.parse(line)));
    },
    appendEvents: (events: readonly ProgressionEvent[]): void => {
      if (events.length === 0) {
        return;
      }
      mkdirSync(dirname(eventsPath), { recursive: true });
      appendFileSync(eventsPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    },
  };
}
