import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { certifiedRelease } from "../../src/adapter";
import { queuedPrompter, runGarnish } from "../../src/cli";

test("doctor diagnoses an uninitialized Garnish root", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-doctor-"));
  try {
    const outcome = await runGarnish(["doctor"], { rootDir: root });

    expect(outcome.exitCode).toBe(1);
    expect(outcome.text).toContain("Garnish doctor");
    expect(outcome.text).toContain("Certified runtime installed: NO");
    expect(outcome.text).toContain("Run `garnish init`");
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

test("init leaves a caller-owned prompter open across launch and cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "garnish-real-init-prompter-"));
  try {
    const ompSource = join(root, "omp-source");
    await writeFile(ompSource, `#!/bin/sh\necho '${certifiedRelease.versionOutput}'\n`, { mode: 0o755 });
    const answers = queuedPrompter(["anthropic", "n", ""]);
    let closeCount = 0;
    let launchCount = 0;
    const prompter = {
      ask: answers.ask,
      close: () => {
        closeCount += 1;
      },
    };

    // Passing a custom launch replaces the default tty-handoff closure, so this test
    // pins the observable ownership seam: only Garnish-owned stdin prompters are closed.
    // The default tty close-before-launch path was covered by the live LOO-139 walkthrough.
    const outcome = await runGarnish(["init"], {
      rootDir: root,
      env: { GARNISH_OMP_SOURCE: ompSource },
      prompter,
      launch: () => {
        launchCount += 1;
      },
    });

    expect(outcome.exitCode).toBe(0);
    expect(launchCount).toBe(1);
    expect(closeCount).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
