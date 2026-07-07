import { createElement, type ReactNode } from "react";
import { FACTORY_THEME } from "./factory-theme";
import { PixelSpriteView } from "../../pixel";
import type { PixelCell, PixelSprite } from "../../pixel-sprites";

const RESET = "\u001B[0m";


const machinePalettes = {
  ore: { a: FACTORY_THEME.amber, d: FACTORY_THEME.border, W: FACTORY_THEME.text },
  miner: { c: FACTORY_THEME.copper, "#": FACTORY_THEME.border, g: FACTORY_THEME.dim },
  belt: { "#": FACTORY_THEME.border, y: FACTORY_THEME.amber },
  assembler: { c: FACTORY_THEME.copper, g: FACTORY_THEME.dim, y: FACTORY_THEME.amber },
  circuit: { c: FACTORY_THEME.green, "#": FACTORY_THEME.border, r: FACTORY_THEME.red, g: FACTORY_THEME.green },
  bolt: { y: FACTORY_THEME.amber },
  ship: { g: FACTORY_THEME.dim, y: FACTORY_THEME.amber },
} as const;

type MachineGlyphName = "ore" | "miner" | "belt" | "assembler" | "circuit" | "bolt" | "ship";

function colorFor(char: string, palette: Record<string, string>): string | null {
  if (char === " " || char === ".") return null;
  const color = palette[char];
  if (!color) throw new Error(`No glyph palette color for '${char}'`);
  return color;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function fg(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `\u001B[38;2;${r};${g};${b}m`;
}

function bg(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `\u001B[48;2;${r};${g};${b}m`;
}

function cellToAnsi([top, bottom]: PixelCell): string {
  if (top && bottom) return `${fg(top)}${bg(bottom)}▀${RESET}`;
  if (top) return `${fg(top)}▀${RESET}`;
  if (bottom) return `${fg(bottom)}▄${RESET}`;
  return " ";
}

export function glyphFromArt(art: string[], palette: Record<string, string>): PixelSprite {
  const width = art[0]?.length ?? 0;
  if (width === 0 || art.length === 0) throw new Error("Glyph art must be non-empty");

  for (const row of art) {
    if (row.length !== width) throw new Error("Glyph art must be rectangular");
  }

  const cellRows: PixelCell[][] = [];
  for (let y = 0; y < art.length; y += 2) {
    const row: PixelCell[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push([
        colorFor(art[y]?.[x] ?? ".", palette),
        colorFor(art[y + 1]?.[x] ?? ".", palette),
      ]);
    }
    cellRows.push(row);
  }

  return {
    width,
    cellRows,
    ansi: cellRows.map((row) => row.map(cellToAnsi).join("")),
  };
}

const machineArt = {
  ore: [
    ".aa..a.",
    "aWa.aaa",
    "aaa.aa.",
  ],
  miner: [
    "ccccccc",
    "c#####c",
    ".ggggg.",
    "..ggg..",
    "...g...",
  ],
  belt: [
    "########",
    ".y..y..y",
    "########",
  ],
  assembler: [
    ".cccccc.",
    ".c.gg.c.",
    "gcggggcy",
    ".c.gg.c.",
    ".cccccc.",
  ],
  circuit: [
    "..c....",
    "#######",
    "#.r.g.#",
    "#######",
  ],
  bolt: [
    "..yyy",
    ".yyy.",
    "yyyy.",
    "..yy.",
    ".yy..",
  ],
  ship: [
    "..gg...",
    ".gggg..",
    "..yy...",
  ],
} as const satisfies Record<MachineGlyphName, readonly string[]>;

export const MACHINE_GLYPHS = {
  ore: glyphFromArt([...machineArt.ore], machinePalettes.ore),
  miner: glyphFromArt([...machineArt.miner], machinePalettes.miner),
  belt: glyphFromArt([...machineArt.belt], machinePalettes.belt),
  assembler: glyphFromArt([...machineArt.assembler], machinePalettes.assembler),
  circuit: glyphFromArt([...machineArt.circuit], machinePalettes.circuit),
  bolt: glyphFromArt([...machineArt.bolt], machinePalettes.bolt),
  ship: glyphFromArt([...machineArt.ship], machinePalettes.ship),
} as const satisfies Record<MachineGlyphName, PixelSprite>;

export function MachineGlyphView(props: { sprite: PixelSprite; dim?: boolean }): ReactNode {
  return createElement(PixelSpriteView, props);
}
