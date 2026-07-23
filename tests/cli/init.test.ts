import { expect, test } from "bun:test";

import { initCommand, queuedPrompter } from "../../src/cli";

test("init is superseded by the standalone harness", async () => {
  const result = await initCommand({ prompter: queuedPrompter(["anthropic"]) });

  expect(result.exitCode).toBe(1);
  expect(result.promptCount).toBe(0);
  expect(result.text).toContain("superseded by the standalone harness");
});

test("queued prompter remains available for callers that still inject init answers", () => {
  const prompter = queuedPrompter(["openai", ""]);

  expect(prompter.ask("Provider?", "anthropic")).toBe("openai");
  expect(prompter.ask("Sandbox?", "default")).toBe("default");
  expect(prompter.askedQuestions).toEqual(["Provider?", "Sandbox?"]);
});
