import { z } from "zod";

import { ChecksSchema } from "./checks";
import { FeatureIdSchema, LevelIdSchema, QuestIdSchema } from "./ids";

export const QuestSchema = z.strictObject({
  id: QuestIdSchema,
  level: LevelIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  xp: z.number().int().nonnegative(),
  required: z.boolean(),
  prereqs: z.array(QuestIdSchema).default([]),
  unlocks: z.array(FeatureIdSchema).default([]),
  checks: ChecksSchema,
});
export type Quest = z.infer<typeof QuestSchema>;
