import { z } from "zod";

import { FeatureIdSchema, LevelIdSchema, QuestIdSchema } from "./ids";

export const LevelSchema = z.strictObject({
  id: LevelIdSchema,
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  order: z.number().int().nonnegative(),
  quests: z.array(QuestIdSchema).default([]),
  unlocks: z.array(FeatureIdSchema).default([]),
});
export type Level = z.infer<typeof LevelSchema>;
