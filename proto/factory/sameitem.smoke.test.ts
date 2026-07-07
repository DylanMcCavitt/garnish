import { expect, test } from "bun:test";

import { evaluateQuest, type EvaluationContext, type Probes, type VerifierEvent } from "../../src/verifier";
import type { LevelId, Quest, QuestId } from "../../src/core";

const inertProbes: Probes = {
  fileExists(path: string): boolean {
    throw new Error(`unexpected fileExists ${path}`);
  },
  readFile(path: string): string {
    throw new Error(`unexpected readFile ${path}`);
  },
  runCommand(command: readonly string[] | string) {
    throw new Error(`unexpected runCommand ${Array.isArray(command) ? command.join(" ") : command}`);
  },
  mcpHandshake(server: string) {
    throw new Error(`unexpected mcpHandshake ${server}`);
  },
  skillValid(path: string) {
    throw new Error(`unexpected skillValid ${path}`);
  },
  confirm(id: string) {
    throw new Error(`unexpected confirm ${id}`);
  },
};

function sameItemQuest(count: 0 | { readonly min: number } | undefined = undefined): Quest {
  return {
    id: "same-item-scope" as QuestId,
    level: "factory-proto" as LevelId,
    title: "Same item scope",
    description: "Checks touch events for the current item only.",
    xp: 0,
    required: true,
    prereqs: [],
    unlocks: [],
    checks: [
      {
        type: "event",
        match: count === undefined ? { event: "touch.recorded" } : { event: "touch.recorded", count },
        sameItem: true,
      },
    ],
  };
}

function context(events: readonly VerifierEvent[], currentItemId?: string): EvaluationContext {
  return { probes: inertProbes, events, currentItemId };
}

function touchRecorded(seq: number, itemId: string | null | undefined): VerifierEvent {
  return {
    name: "touch.recorded",
    seq,
    payload: itemId === undefined ? {} : { itemId },
  };
}

test("sameItem count zero passes when the current item has no touches even if other items do", async () => {
  const result = await evaluateQuest(
    sameItemQuest(0),
    context([touchRecorded(1, "item-1"), touchRecorded(2, "item-2")], "item-7"),
  );

  expect(result.status).toBe("pass");
  expect(result.checks[0]?.result.evidence).toMatchObject({
    kind: "event",
    message: "event count matched",
    details: {
      count: 0,
      matchedEvents: [],
      sameItem: "item-7",
    },
  });
});

test("sameItem count zero fails when the current item has a touch", async () => {
  const result = await evaluateQuest(
    sameItemQuest(0),
    context([touchRecorded(1, "item-1"), touchRecorded(2, "item-2")], "item-1"),
  );

  expect(result.status).toBe("fail");
  expect(result.checks[0]?.result.evidence).toMatchObject({
    kind: "event",
    message: "event count did not match",
    details: {
      count: 1,
      matchedEvents: [touchRecorded(1, "item-1")],
      sameItem: "item-1",
    },
  });
});

test("sameItem fails with a clear evidence message when no current item anchor is available", async () => {
  const result = await evaluateQuest(sameItemQuest(), context([touchRecorded(1, "item-7")]));

  expect(result.status).toBe("fail");
  expect(result.checks[0]?.result.evidence).toEqual({
    kind: "event",
    message: "sameItem requested but no item anchor was available",
    details: { after: undefined, currentItemId: undefined },
  });
});

test("sameItem does not match touch events whose payload itemId is null", async () => {
  const result = await evaluateQuest(sameItemQuest(), context([touchRecorded(1, null)], "item-7"));

  expect(result.status).toBe("fail");
  expect(result.checks[0]?.result.evidence).toMatchObject({
    kind: "event",
    message: "event not found",
    details: {
      matchedEvent: undefined,
      sameItem: "item-7",
    },
  });
});

test("sameItem composes with count predicates by counting only touches for the current item", async () => {
  const result = await evaluateQuest(
    sameItemQuest({ min: 2 }),
    context(
      [touchRecorded(1, "item-7"), touchRecorded(2, "item-1"), touchRecorded(3, null), touchRecorded(4, "item-7")],
      "item-7",
    ),
  );

  expect(result.status).toBe("pass");
  expect(result.checks[0]?.result.evidence).toMatchObject({
    kind: "event",
    message: "event count matched",
    details: {
      count: 2,
      matchedEvents: [touchRecorded(1, "item-7"), touchRecorded(4, "item-7")],
      sameItem: "item-7",
    },
  });
});
