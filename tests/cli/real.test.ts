import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { queuedPrompter, runGarnish } from "../../src/cli";

test("doctor reports the standalone-harness handoff without installed state", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-doctor-"));
  try {
    const outcome = await runGarnish(["doctor"], { rootDir: root });

    expect(outcome.exitCode).toBe(1);
    expect(outcome.text).toContain("Garnish doctor");
    expect(outcome.text).toContain("superseded by the standalone harness");
    expect(outcome.text).not.toContain("Garnish is not initialized");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("usage does not require installed Garnish state", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-usage-"));
  try {
    const outcome = await runGarnish(["nope"], { rootDir: root });

    expect(outcome.exitCode).toBe(2);
    expect(outcome.text).toContain("garnish <command>");
    expect(outcome.text).toContain("doctor");
    expect(outcome.text).not.toContain("Garnish is not initialized");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init returns the superseded-command error without consuming caller answers", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-init-"));
  try {
    const prompter = queuedPrompter(["anthropic"]);

    const outcome = await runGarnish(["init"], { rootDir: root, prompter });

    expect(outcome.exitCode).toBe(1);
    expect(outcome.text).toContain("superseded by the standalone harness");
    expect(prompter.askedQuestions).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("status reads standalone-provisioned state", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-status-"));
  try {
    const garnishDir = join(root, "agent", "garnish");
    await mkdir(garnishDir, { recursive: true });
    await writeFile(
      join(garnishDir, "graph.json"),
      JSON.stringify({
        levels: [{ id: "tutorial-island", order: 0, quests: ["start-standalone-harness"] }],
        quests: [{ id: "start-standalone-harness", level: "tutorial-island", required: true, xp: 10 }],
        unlockEdges: [],
      }),
      "utf8",
    );
    await writeFile(
      join(garnishDir, "quests.json"),
      JSON.stringify([
        {
          id: "start-standalone-harness",
          level: "tutorial-island",
          title: "Start the game engine",
          description: "Start Garnish through the standalone harness.",
          xp: 10,
          required: true,
          prereqs: [],
          unlocks: [],
          checks: [{ type: "event", match: { event: "session_start" } }],
        },
      ]),
      "utf8",
    );
    await writeFile(join(garnishDir, "state.json"), JSON.stringify({ activeLevel: "tutorial-island" }), "utf8");

    const outcome = await runGarnish(["status"], { rootDir: root });

    expect(outcome.exitCode).toBe(0);
    expect(outcome.text).toContain("Level 0 — tutorial-island");
    expect(outcome.text).toContain("Next: start-standalone-harness");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
