import { z } from "zod";

import { LevelSchema } from "./level";
import { FeatureIdSchema, PackIdSchema, QuestIdSchema } from "./ids";
import { QuestSchema } from "./quest";

const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export const PackRequiresSchema = z.strictObject({
  features: z.array(FeatureIdSchema).default([]),
});
export type PackRequires = z.infer<typeof PackRequiresSchema>;

export const UnlockEdgeSchema = z.strictObject({
  quest: QuestIdSchema,
  feature: FeatureIdSchema,
});
export type UnlockEdge = z.infer<typeof UnlockEdgeSchema>;

export const PackMetadataSchema = z.strictObject({
  id: PackIdSchema,
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  version: z.string().regex(semver, "version must be semver"),
  requires: PackRequiresSchema.default({ features: [] }),
  levels: z.array(LevelSchema).min(1),
});
export type PackMetadata = z.infer<typeof PackMetadataSchema>;

export const PackSchema = PackMetadataSchema.extend({
  quests: z.array(QuestSchema).default([]),
});
export type Pack = z.infer<typeof PackSchema>;
