import { z } from "zod";

import { FeatureIdSchema, LevelIdSchema, QuestIdSchema } from "./ids";

const timestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, "timestamp must be an ISO-8601 datetime");
const eventBaseShape = {
  at: timestamp,
  session_id: z.string().min(1).optional(),
};

export const UnlockTargetSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("feature"), id: FeatureIdSchema }),
  z.strictObject({ type: z.literal("level"), id: LevelIdSchema }),
]);
export type UnlockTarget = z.infer<typeof UnlockTargetSchema>;

export const BadgeSchema = z.enum(["completionist", "no_hint_clear", "speedrunner"]);
export type Badge = z.infer<typeof BadgeSchema>;

export const QuestCompletedEventSchema = z.strictObject({
  ...eventBaseShape,
  type: z.literal("quest_completed"),
  quest_id: QuestIdSchema,
  level_id: LevelIdSchema,
  required: z.boolean(),
  xp: z.number().int().nonnegative(),
});
export type QuestCompletedEvent = z.infer<typeof QuestCompletedEventSchema>;

export const UnlockEventSchema = z.strictObject({
  ...eventBaseShape,
  type: z.literal("unlock"),
  target: UnlockTargetSchema,
  reason: z.enum(["quest_completed", "speedrun", "cheat", "system"]),
  source_quest_id: QuestIdSchema.optional(),
  source_level_id: LevelIdSchema.optional(),
});
export type UnlockEvent = z.infer<typeof UnlockEventSchema>;

export const XpAwardEventSchema = z.strictObject({
  ...eventBaseShape,
  type: z.literal("xp_award"),
  quest_id: QuestIdSchema.optional(),
  amount: z.number().int().positive(),
  total: z.number().int().nonnegative().optional(),
});
export type XpAwardEvent = z.infer<typeof XpAwardEventSchema>;

export const BadgeAwardEventSchema = z.strictObject({
  ...eventBaseShape,
  type: z.literal("badge_award"),
  badge: BadgeSchema,
  level_id: LevelIdSchema.optional(),
  quest_id: QuestIdSchema.optional(),
});
export type BadgeAwardEvent = z.infer<typeof BadgeAwardEventSchema>;

export const HintOpenedEventSchema = z.strictObject({
  ...eventBaseShape,
  type: z.literal("hint_opened"),
  quest_id: QuestIdSchema,
  level_id: LevelIdSchema,
  hint_id: z.string().min(1).optional(),
});
export type HintOpenedEvent = z.infer<typeof HintOpenedEventSchema>;

export const ProgressionEventSchema = z.discriminatedUnion("type", [
  QuestCompletedEventSchema,
  UnlockEventSchema,
  XpAwardEventSchema,
  BadgeAwardEventSchema,
  HintOpenedEventSchema,
]);
export type ProgressionEvent = z.infer<typeof ProgressionEventSchema>;
