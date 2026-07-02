import { z } from "zod";

import { QuestIdSchema } from "./ids";

const nonEmptyString = z.string().min(1);
const pathTemplate = nonEmptyString;
const jsonPath = z.string().min(1).regex(/^\$($|[.\[])/, "path must be a JSONPath starting with $");
const regexPattern = nonEmptyString;

export const StringMatcherSchema = z
  .strictObject({
    equals: nonEmptyString.optional(),
    contains: nonEmptyString.optional(),
    starts_with: nonEmptyString.optional(),
    ends_with: nonEmptyString.optional(),
    regex: regexPattern.optional(),
    one_of: z.array(nonEmptyString).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.equals === undefined &&
      value.contains === undefined &&
      value.starts_with === undefined &&
      value.ends_with === undefined &&
      value.regex === undefined &&
      value.one_of === undefined
    ) {
      ctx.addIssue({ code: "custom", message: "string matcher must declare at least one predicate" });
    }
  });
export type StringMatcher = z.infer<typeof StringMatcherSchema>;

export const StringPredicateSchema = z.union([nonEmptyString, StringMatcherSchema]);
export type StringPredicate = z.infer<typeof StringPredicateSchema>;

export const IntPredicateSchema = z.union([
  z.number().int().nonnegative(),
  z
    .strictObject({
      equals: z.number().int().nonnegative().optional(),
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().nonnegative().optional(),
    })
    .superRefine((value, ctx) => {
      if (value.equals === undefined && value.min === undefined && value.max === undefined) {
        ctx.addIssue({ code: "custom", message: "integer predicate must declare equals, min, or max" });
      }
      if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
        ctx.addIssue({ code: "custom", message: "integer predicate min must be less than or equal to max" });
      }
    }),
]);
export type IntPredicate = z.infer<typeof IntPredicateSchema>;

export const AssertionSchema = z.union([
  z.enum(["exists", "missing", "non_empty"]),
  z.strictObject({ equals: z.unknown() }),
  z.strictObject({ contains: z.unknown() }),
  z.strictObject({ matches: regexPattern }),
]);
export type Assertion = z.infer<typeof AssertionSchema>;

export const EventAfterSchema = z.union([
  QuestIdSchema,
  z.strictObject({
    ref: z.string().min(1).regex(/^[a-z][A-Za-z0-9_-]*$/, "after ref must be an event reference id"),
    event: nonEmptyString.optional(),
  }),
]);
export type EventAfter = z.infer<typeof EventAfterSchema>;

export const EventMatchSchema = z.strictObject({
  event: nonEmptyString,
  tool: StringPredicateSchema.optional(),
  source: StringPredicateSchema.optional(),
  server: StringPredicateSchema.optional(),
  name: StringPredicateSchema.optional(),
  path: StringPredicateSchema.optional(),
  success: z.boolean().optional(),
  exit_code: IntPredicateSchema.optional(),
  count: IntPredicateSchema.optional(),
  min_assistant_turns: z.number().int().positive().optional(),
  resumed: z.boolean().optional(),
  extension_loaded: z.boolean().optional(),
  size_reduced: z.boolean().optional(),
  reason: StringPredicateSchema.optional(),
  headless: z.boolean().optional(),
  tasks: z
    .strictObject({
      length: IntPredicateSchema.optional(),
    })
    .optional(),
});
export type EventMatch = z.infer<typeof EventMatchSchema>;

export const EventCheckSchema = z.strictObject({
  type: z.literal("event"),
  match: EventMatchSchema,
  after: EventAfterSchema.optional(),
  sameSession: z.boolean().optional(),
});
export type EventCheck = z.infer<typeof EventCheckSchema>;

export const FileExistsCheckSchema = z.strictObject({
  type: z.literal("file_exists"),
  path: pathTemplate,
});
export type FileExistsCheck = z.infer<typeof FileExistsCheckSchema>;

export const JsonPathCheckSchema = z.strictObject({
  type: z.literal("json_path"),
  file: pathTemplate,
  path: jsonPath,
  assert: AssertionSchema,
});
export type JsonPathCheck = z.infer<typeof JsonPathCheckSchema>;

export const YamlPathCheckSchema = z.strictObject({
  type: z.literal("yaml_path"),
  file: pathTemplate,
  path: jsonPath,
  assert: AssertionSchema,
});
export type YamlPathCheck = z.infer<typeof YamlPathCheckSchema>;

export const CommandCheckSchema = z.strictObject({
  type: z.literal("command"),
  command: z.union([nonEmptyString, z.array(nonEmptyString).min(1)]),
  exit_code: z.number().int().nonnegative().optional(),
  stdout: StringPredicateSchema.optional(),
  stderr: StringPredicateSchema.optional(),
  timeout_ms: z.number().int().positive().optional(),
});
export type CommandCheck = z.infer<typeof CommandCheckSchema>;

export const GitCheckSchema = z
  .strictObject({
    type: z.literal("git"),
    repo: pathTemplate.optional(),
    commit_count: IntPredicateSchema.optional(),
    clean_tree: z.boolean().optional(),
    branch_exists: StringPredicateSchema.optional(),
    dirty: z.boolean().optional(),
    diff_contains: StringPredicateSchema.optional(),
    file_restored: pathTemplate.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.commit_count === undefined &&
      value.clean_tree === undefined &&
      value.branch_exists === undefined &&
      value.dirty === undefined &&
      value.diff_contains === undefined &&
      value.file_restored === undefined
    ) {
      ctx.addIssue({ code: "custom", message: "git check must declare at least one predicate" });
    }
  });
export type GitCheck = z.infer<typeof GitCheckSchema>;

export const McpHandshakeCheckSchema = z.strictObject({
  type: z.literal("mcp_handshake"),
  server: StringPredicateSchema,
  timeout_ms: z.number().int().positive().optional(),
});
export type McpHandshakeCheck = z.infer<typeof McpHandshakeCheckSchema>;

export const SkillValidCheckSchema = z.strictObject({
  type: z.literal("skill_valid"),
  path: pathTemplate,
  discovery: z.boolean().optional(),
});
export type SkillValidCheck = z.infer<typeof SkillValidCheckSchema>;

export const ConfirmCheckSchema = z.strictObject({
  type: z.literal("confirm"),
  id: z.string().min(1).regex(/^[a-z][A-Za-z0-9_-]*$/, "confirm id must be a stable key").optional(),
  prompt: nonEmptyString.optional(),
  expected: z.literal(true).optional(),
});
export type ConfirmCheck = z.infer<typeof ConfirmCheckSchema>;

export const CHECK_TYPES = [
  "event",
  "file_exists",
  "json_path",
  "yaml_path",
  "command",
  "git",
  "mcp_handshake",
  "skill_valid",
  "confirm",
] as const;
export const CheckTypeSchema = z.enum(CHECK_TYPES);
export type CheckType = z.infer<typeof CheckTypeSchema>;

export const UNKNOWN_CHECK_TYPE_MESSAGE = `Unknown check type. Expected one of: ${CHECK_TYPES.join(", ")}`;

export const CheckSchema = z.discriminatedUnion(
  "type",
  [
    EventCheckSchema,
    FileExistsCheckSchema,
    JsonPathCheckSchema,
    YamlPathCheckSchema,
    CommandCheckSchema,
    GitCheckSchema,
    McpHandshakeCheckSchema,
    SkillValidCheckSchema,
    ConfirmCheckSchema,
  ],
  { error: UNKNOWN_CHECK_TYPE_MESSAGE },
);
export type Check = z.infer<typeof CheckSchema>;

export const ChecksSchema = z.array(CheckSchema).min(1);
export type Checks = z.infer<typeof ChecksSchema>;
