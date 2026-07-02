import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const featurePattern = /^[a-z][a-z0-9]*(?:(?:-|:|\.)[a-z0-9]+)*$/;

export const QuestIdSchema = z
  .string()
  .min(1)
  .regex(slugPattern, "QuestId must be a lowercase slug")
  .brand<"QuestId">();
export type QuestId = z.infer<typeof QuestIdSchema>;

export const LevelIdSchema = z
  .string()
  .min(1)
  .regex(slugPattern, "LevelId must be a lowercase slug")
  .brand<"LevelId">();
export type LevelId = z.infer<typeof LevelIdSchema>;

export const PackIdSchema = z
  .string()
  .min(1)
  .regex(slugPattern, "PackId must be a lowercase slug")
  .brand<"PackId">();
export type PackId = z.infer<typeof PackIdSchema>;

export const FeatureIdSchema = z
  .string()
  .min(1)
  .regex(featurePattern, "FeatureId must be a lowercase feature key")
  .brand<"FeatureId">();
export type FeatureId = z.infer<typeof FeatureIdSchema>;
