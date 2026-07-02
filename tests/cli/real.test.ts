import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runGarnish } from "../../src/cli";

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
