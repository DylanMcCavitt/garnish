import { describe, expect, test } from "bun:test";
import { MASCOT_NAME, mascot, unlockBanner, xpBurst } from "./sprites";

const poses = ["idle", "celebrate", "warn", "think"] as const;

describe("retro sprites", () => {
  test("mascot poses stay short and monospace-safe", () => {
    expect(MASCOT_NAME).toBe("Sprig");

    for (const pose of poses) {
      const rows = mascot(pose);
      const width = rows[0]?.length ?? 0;

      expect(rows.length).toBeLessThanOrEqual(3);
      expect(width).toBeGreaterThan(0);
      expect(rows.every((row) => row.length === width)).toBe(true);
      expect(rows.join("")).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });

  test("xp burst cycles through four text frames", () => {
    const frames = [xpBurst(0), xpBurst(1), xpBurst(2), xpBurst(3)];

    expect(new Set(frames).size).toBe(4);
    expect(xpBurst(4)).toBe(frames[0]);
    expect(xpBurst(-1)).toBe(frames[1]);
  });

  test("unlock banner announces tool names", () => {
    const banner = unlockBanner(["edit", "bash"]);

    expect(banner.length).toBeGreaterThanOrEqual(2);
    expect(banner.length).toBeLessThanOrEqual(3);
    expect(banner.every((row) => row.length === banner[0]!.length)).toBe(true);
    expect(banner.join("\n")).toContain("NEW VERB");
    expect(banner.join("\n")).toContain("edit");
    expect(banner.join("\n")).toContain("bash");
  });
});
