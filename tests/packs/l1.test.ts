import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import {
  evaluateCheck,
  evaluateQuest,
  loadPack,
  type Check,
  type EvaluationContext,
  type Probes,
  type Quest,
  type QuestGraph,
  type RunCommandOptions,
  type RunCommandResult,
  type VerifierEvent,
} from "../../src/index";

const packDir = fileURLToPath(new URL("../../packs/core/l1-first-quest/", import.meta.url));
const SANDBOX = "/tmp/garnish-sandbox";

type FixtureOverrides = Partial<{
  readonly existingFiles: readonly string[];
  readonly commands: Readonly<Record<string, RunCommandResult>>;
  readonly events: readonly VerifierEvent[];
  readonly currentSessionId: string;
  readonly eventRefs: Readonly<Record<string, VerifierEvent>>;
}>;

function fixtureContext(overrides: FixtureOverrides = {}): EvaluationContext {
  const existingFiles = new Set(overrides.existingFiles ?? []);
  const commands = overrides.commands ?? {};

  const probes: Probes = {
    fileExists: (path: string) => existingFiles.has(path),
    readFile: (path: string) => {
      throw new Error(`unexpected readFile ${path}`);
    },
    runCommand: (command: readonly string[] | string, options?: RunCommandOptions) => {
      const argv = typeof command === "string" ? command : command.join(" ");
      const key = `${options?.cwd ?? ""}|${argv}`;
      const result = commands[key];
      if (result === undefined) {
        throw new Error(`unexpected command ${key}`);
      }
      return result;
    },
    mcpHandshake: () => {
      throw new Error("unexpected MCP handshake");
    },
    skillValid: () => {
      throw new Error("unexpected skill validation");
    },
    confirm: () => {
      throw new Error("unexpected confirmation");
    },
  };

  return {
    probes,
    events: overrides.events ?? [],
    currentSessionId: overrides.currentSessionId,
    eventRefs: overrides.eventRefs,
    paths: { sandbox: SANDBOX },
  };
}

function event(
  name: string,
  seq: number,
  payload: Readonly<Record<string, unknown>> = {},
  sessionId = "s1",
): VerifierEvent {
  return { name, seq, payload, sessionId };
}

const ok = (stdout = ""): RunCommandResult => ({ exitCode: 0, stdout, stderr: "" });

let cachedGraph: QuestGraph | undefined;
async function l1Graph(): Promise<QuestGraph> {
  cachedGraph ??= await loadPack(packDir);
  return cachedGraph;
}

async function questById(id: string): Promise<Quest> {
  const graph = await l1Graph();
  const quest = graph.questNodes[id];
  if (quest === undefined) {
    throw new Error(`quest ${id} not found in L1 pack`);
  }
  return quest;
}

test("L1 pack loads with the first-quest level and six inventory quests", async () => {
  const graph = await l1Graph();

  expect(`${graph.pack.id}`).toBe("l1-first-quest");
  const levelEntry = graph.levels[0];
  expect(levelEntry && `${levelEntry.id}`).toBe("first-quest");
  expect(levelEntry?.order).toBe(1);
  expect(graph.quests.map((quest) => `${quest.id}`).sort()).toEqual([
    "deny-once",
    "explain-diff",
    "first-edit",
    "first-file",
    "revert-change",
    "run-command",
  ]);
  expect(levelEntry?.unlocks.map(String)).toEqual(["context"]);

  const byId = new Map(graph.quests.map((quest) => [`${quest.id}`, quest]));
  expect(byId.get("first-file")).toMatchObject({ required: true, xp: 15 });
  expect(byId.get("first-edit")).toMatchObject({ required: true, xp: 15 });
  expect(byId.get("run-command")).toMatchObject({ required: true, xp: 15 });
  expect(byId.get("explain-diff")).toMatchObject({ required: false, xp: 10 });
  expect(byId.get("revert-change")).toMatchObject({ required: true, xp: 15 });
  expect(byId.get("deny-once")).toMatchObject({ required: false, xp: 10 });
});

test("first-file passes with a successful write tool result and the sandbox file", async () => {
  const quest = await questById("first-file");
  const ctx = fixtureContext({
    existingFiles: [`${SANDBOX}/first-file.txt`],
    events: [event("tool_result", 1, { tool: "write", success: true })],
  });

  expect((await evaluateQuest(quest, ctx)).status).toBe("pass");
});

test("first-file fails when the write tool errored or the file is absent", async () => {
  const quest = await questById("first-file");

  const noFile = fixtureContext({
    events: [event("tool_result", 1, { tool: "write", success: true })],
  });
  expect((await evaluateQuest(quest, noFile)).status).toBe("fail");

  const failedWrite = fixtureContext({
    existingFiles: [`${SANDBOX}/first-file.txt`],
    events: [event("tool_result", 1, { tool: "write", success: false })],
  });
  expect((await evaluateQuest(quest, failedWrite)).status).toBe("fail");
});

test("first-edit passes with a successful edit and a diff containing the file", async () => {
  const quest = await questById("first-edit");
  const ctx = fixtureContext({
    events: [event("tool_result", 2, { tool: "edit", success: true })],
    commands: {
      [`${SANDBOX}|git diff --name-only`]: ok("first-file.txt\n"),
      [`${SANDBOX}|git diff --cached --name-only`]: ok(""),
    },
  });

  expect((await evaluateQuest(quest, ctx)).status).toBe("pass");
});

test("first-edit fails when the diff does not mention the file", async () => {
  const quest = await questById("first-edit");
  const ctx = fixtureContext({
    events: [event("tool_result", 2, { tool: "edit", success: true })],
    commands: {
      [`${SANDBOX}|git diff --name-only`]: ok("other.txt\n"),
      [`${SANDBOX}|git diff --cached --name-only`]: ok(""),
    },
  });

  expect((await evaluateQuest(quest, ctx)).status).toBe("fail");
});

test("run-command passes on a zero-exit bash tool result and fails otherwise", async () => {
  const quest = await questById("run-command");

  const pass = fixtureContext({ events: [event("tool_result", 3, { tool: "bash", exit_code: 0 })] });
  expect((await evaluateQuest(quest, pass)).status).toBe("pass");

  const fail = fixtureContext({ events: [event("tool_result", 3, { tool: "bash", exit_code: 2 })] });
  expect((await evaluateQuest(quest, fail)).status).toBe("fail");
});

test("explain-diff requires a dirty tree plus agent_end after the dirty anchor in the same session", async () => {
  const quest = await questById("explain-diff");
  const dirtyAnchor = event("git_dirty", 4, { ref: "gitDirty" });
  const dirtyCommands = {
    [`${SANDBOX}|git status --porcelain`]: ok(" M first-file.txt\n"),
  };

  const pass = fixtureContext({
    events: [dirtyAnchor, event("agent_end", 5, { assistant_turns: 1 })],
    eventRefs: { gitDirty: dirtyAnchor },
    commands: dirtyCommands,
    currentSessionId: "s1",
  });
  expect((await evaluateQuest(quest, pass)).status).toBe("pass");

  const explanationBeforeDirty = fixtureContext({
    events: [event("agent_end", 3, { assistant_turns: 1 }), dirtyAnchor],
    eventRefs: { gitDirty: dirtyAnchor },
    commands: dirtyCommands,
    currentSessionId: "s1",
  });
  expect((await evaluateQuest(quest, explanationBeforeDirty)).status).toBe("fail");

  const otherSession = fixtureContext({
    events: [dirtyAnchor, event("agent_end", 5, { assistant_turns: 1 }, "s2")],
    eventRefs: { gitDirty: dirtyAnchor },
    commands: dirtyCommands,
    currentSessionId: "s1",
  });
  expect((await evaluateQuest(quest, otherSession)).status).toBe("fail");
});

test("revert-change passes when the edited file returns to its committed state", async () => {
  const quest = await questById("revert-change");
  const ctx = fixtureContext({
    events: [event("tool_result", 6, { tool: "edit", success: true })],
    commands: {
      [`${SANDBOX}|git status --porcelain -- first-file.txt`]: ok(""),
    },
  });

  expect((await evaluateQuest(quest, ctx)).status).toBe("pass");
});

test("revert-change fails while the file is still modified", async () => {
  const quest = await questById("revert-change");
  const ctx = fixtureContext({
    events: [event("tool_result", 6, { tool: "edit", success: true })],
    commands: {
      [`${SANDBOX}|git status --porcelain -- first-file.txt`]: ok(" M first-file.txt\n"),
    },
  });

  expect((await evaluateQuest(quest, ctx)).status).toBe("fail");
});

test("deny-once passes on an approval denial event and fails on approval", async () => {
  const quest = await questById("deny-once");

  const denied = fixtureContext({
    events: [event("tool_approval_resolved", 7, { tool: "bash", approved: false })],
  });
  expect((await evaluateQuest(quest, denied)).status).toBe("pass");

  const approved = fixtureContext({
    events: [event("tool_approval_resolved", 7, { tool: "bash", approved: true })],
  });
  expect((await evaluateQuest(quest, approved)).status).toBe("fail");
});

test("approved matcher rejects events without the approved payload field", async () => {
  const check = {
    type: "event",
    match: { event: "tool_approval_resolved", approved: false },
  } satisfies Check;
  const ctx = fixtureContext({ events: [event("tool_approval_resolved", 1, { tool: "bash" })] });

  expect((await evaluateCheck(check, ctx)).status).toBe("fail");
});
