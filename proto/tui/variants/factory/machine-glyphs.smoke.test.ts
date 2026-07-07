import { describe, expect, test } from "bun:test";
import { glyphFromArt, MACHINE_GLYPHS } from "./machine-glyphs";

const glyphNames = ["ore", "miner", "belt", "assembler", "circuit", "bolt", "ship"] as const;

describe("factory machine glyphs", () => {
  test("all pinned machine glyphs stay tiny, colored, rectangular sprites", () => {
    for (const name of glyphNames) {
      const glyph = MACHINE_GLYPHS[name];
      const colors = new Set<string>();
      let paintedCells = 0;

      expect(glyph.width, name).toBeGreaterThan(0);
      expect(glyph.width, name).toBeLessThanOrEqual(8);
      expect(glyph.cellRows.length, name).toBeGreaterThan(0);
      expect(glyph.cellRows.length, name).toBeLessThanOrEqual(3);
      expect(glyph.ansi, name).toHaveLength(glyph.cellRows.length);
      expect(glyph.ansi.join(""), name).toContain("\u001B[");

      for (const row of glyph.cellRows) {
        expect(row, name).toHaveLength(glyph.width);
        for (const [top, bottom] of row) {
          if (top) {
            colors.add(top);
            paintedCells += 1;
          }
          if (bottom) {
            colors.add(bottom);
            paintedCells += 1;
          }
        }
      }

      expect(paintedCells, name).toBeGreaterThan(0);
      // bolt is deliberately a single-color lightning silhouette (art-director call)
      expect(colors.size, name).toBeGreaterThanOrEqual(name === "bolt" ? 1 : 2);
      expect(colors.size, name).toBeLessThanOrEqual(3);
    }
  });

  test("glyphFromArt packs rectangular pixel art into half-block rows", () => {
    const glyph = glyphFromArt(["a.", ".b", "ba"], { a: "#111111", b: "#222222" });

    expect(glyph.width).toBe(2);
    expect(glyph.cellRows).toEqual([
      [["#111111", null], [null, "#222222"]],
      [["#222222", null], ["#111111", null]],
    ]);
    expect(glyph.ansi).toHaveLength(2);
  });

  test("glyphFromArt rejects jagged art and unknown palette keys", () => {
    expect(() => glyphFromArt(["aa", "a"], { a: "#111111" })).toThrow(/rectangular/);
    expect(() => glyphFromArt(["ab"], { a: "#111111" })).toThrow(/palette color/);
  });
});
