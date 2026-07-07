import { MACHINE_GLYPHS } from "./machine-glyphs";

const names = ["ore", "miner", "belt", "assembler", "circuit", "bolt", "ship"] as const;
const labelWidth = Math.max(...names.map((name) => name.length));

for (const name of names) {
  const glyph = MACHINE_GLYPHS[name];
  for (let index = 0; index < glyph.ansi.length; index += 1) {
    const label = index === 0 ? name.padEnd(labelWidth) : " ".repeat(labelWidth);
    console.log(`${label}  ${glyph.ansi[index]}`);
  }
  console.log("");
}
