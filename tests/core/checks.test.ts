import { expect, test } from "bun:test";
import type { z } from "zod";

import {
  CheckSchema,
  LevelSchema,
  PackSchema,
  ProgressionEventSchema,
  QuestSchema,
  UNKNOWN_CHECK_TYPE_MESSAGE,
} from "../../src/core";
import type { Check, Level, Pack, ProgressionEvent, Quest } from "../../src/index";

type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
  ? (<T>() => T extends Right ? 1 : 2) extends <T>() => T extends Left ? 1 : 2
    ? true
    : false
  : false;

type Assert<T extends true> = T;

type CheckTypeMatchesSchema = Assert<Equal<Check, z.infer<typeof CheckSchema>>>;
type QuestTypeMatchesSchema = Assert<Equal<Quest, z.infer<typeof QuestSchema>>>;
type LevelTypeMatchesSchema = Assert<Equal<Level, z.infer<typeof LevelSchema>>>;
type PackTypeMatchesSchema = Assert<Equal<Pack, z.infer<typeof PackSchema>>>;
type ProgressionEventTypeMatchesSchema = Assert<Equal<ProgressionEvent, z.infer<typeof ProgressionEventSchema>>>;

const validCheckCases = [
  {
    name: "event accepts an event match with session and after boundaries",
    value: {
      type: "event",
      match: { event: "command_finished", success: true, exit_code: { equals: 0 } },
      after: { ref: "commandFinished", event: "command" },
      sameSession: true,
    },
  },
  {
    name: "file_exists accepts a path template",
    value: { type: "file_exists", path: "src/index.ts" },
  },
  {
    name: "json_path accepts a JSONPath assertion",
    value: { type: "json_path", file: "package.json", path: "$.scripts.test", assert: { equals: "bun test" } },
  },
  {
    name: "yaml_path accepts a YAML path assertion",
    value: { type: "yaml_path", file: "pack.yml", path: "$.levels[0].id", assert: "exists" },
  },
  {
    name: "command accepts argv, exit code, and stream predicates",
    value: {
      type: "command",
      command: ["bun", "test", "tests/core"],
      exit_code: 0,
      stdout: { contains: "pass" },
      stderr: { contains: "warning" },
      timeout_ms: 10_000,
    },
  },
  {
    name: "git accepts at least one repository predicate",
    value: { type: "git", repo: ".", clean_tree: true },
  },
  {
    name: "mcp_handshake accepts a server predicate and timeout",
    value: { type: "mcp_handshake", server: { starts_with: "pi" }, timeout_ms: 1_000 },
  },
  {
    name: "skill_valid accepts a path and discovery flag",
    value: { type: "skill_valid", path: ".agents/skills/core/SKILL.md", discovery: true },
  },
  {
    name: "confirm accepts a stable id, prompt, and expected acknowledgement",
    value: { type: "confirm", id: "approveCoreSchemas", prompt: "Approve core schema changes?", expected: true },
  },
] as const;

for (const { name, value } of validCheckCases) {
  test(`CheckSchema valid v1 check: ${name}`, () => {
    const result = CheckSchema.safeParse(value);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw result.error;
    }
    expect(result.data.type).toBe(value.type);
  });
}

const invalidCheckCases = [
  {
    name: "event rejects an empty event name",
    value: { type: "event", match: { event: "" } },
  },
  {
    name: "file_exists rejects an empty path",
    value: { type: "file_exists", path: "" },
  },
  {
    name: "json_path rejects paths that are not JSONPath expressions",
    value: { type: "json_path", file: "package.json", path: "scripts.test", assert: "exists" },
  },
  {
    name: "yaml_path rejects paths that are not JSONPath expressions",
    value: { type: "yaml_path", file: "pack.yml", path: "levels[0].id", assert: "exists" },
  },
  {
    name: "command rejects an empty argv list",
    value: { type: "command", command: [] },
  },
  {
    name: "git rejects a check with no predicate",
    value: { type: "git", repo: "." },
  },
  {
    name: "mcp_handshake rejects a missing server predicate",
    value: { type: "mcp_handshake", timeout_ms: 1_000 },
  },
  {
    name: "skill_valid rejects an empty path",
    value: { type: "skill_valid", path: "" },
  },
  {
    name: "confirm rejects a false expected acknowledgement",
    value: { type: "confirm", id: "approveCoreSchemas", expected: false },
  },
] as const;

for (const { name, value } of invalidCheckCases) {
  test(`CheckSchema invalid v1 check: ${name}`, () => {
    const result = CheckSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
}

test("event after accepts a quest id boundary", () => {
  const result = CheckSchema.safeParse({
    type: "event",
    match: { event: "quest_started" },
    after: "intro-quest",
  });

  expect(result.success).toBe(true);
  if (!result.success) {
    throw result.error;
  }
  if (result.data.type !== "event") {
    throw new Error(`expected event check, parsed ${result.data.type}`);
  }
  if (typeof result.data.after !== "string") {
    throw new Error("expected event after boundary to parse as a quest id");
  }
  const after: string = result.data.after;
  expect(after).toBe("intro-quest");
});

test("event after accepts an event reference boundary", () => {
  const result = CheckSchema.safeParse({
    type: "event",
    match: { event: "command_finished" },
    after: { ref: "commandFinished", event: "command_started" },
  });

  expect(result.success).toBe(true);
  if (!result.success) {
    throw result.error;
  }
  if (result.data.type !== "event") {
    throw new Error(`expected event check, parsed ${result.data.type}`);
  }
  expect(result.data.after).toEqual({ ref: "commandFinished", event: "command_started" });
});

test("event after rejects the wrong boundary type", () => {
  const result = CheckSchema.safeParse({
    type: "event",
    match: { event: "command_finished" },
    after: 42,
  });

  expect(result.success).toBe(false);
});

test("event after rejects an event reference without a ref", () => {
  const result = CheckSchema.safeParse({
    type: "event",
    match: { event: "command_finished" },
    after: { event: "command_started" },
  });

  expect(result.success).toBe(false);
});

test("event sameSession rejects the wrong boundary type", () => {
  const result = CheckSchema.safeParse({
    type: "event",
    match: { event: "command_finished" },
    sameSession: "true",
  });

  expect(result.success).toBe(false);
});

test("unknown check type reports the exported useful message", () => {
  const result = CheckSchema.safeParse({ type: "unknown", path: "whatever" });

  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("unknown check type unexpectedly parsed");
  }
  expect(result.error.issues.map((issue) => issue.message)).toContain(UNKNOWN_CHECK_TYPE_MESSAGE);
});
