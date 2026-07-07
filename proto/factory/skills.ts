import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { OreFamily } from "./types";

export interface ForgeSkillArtifactOptions {
  workspace: string;
  name: string;
  family: OreFamily;
}

export interface SkillArtifact {
  path: string;
  content: string;
}

export function forgeSkillArtifact(opts: ForgeSkillArtifactOptions): SkillArtifact {
  const safeName = opts.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "greeter-fix";
  const path = `.garnish/skills/${safeName}.md`;
  const content = [
    "---",
    `name: ${safeName}`,
    `family: ${opts.family.id}`,
    "---",
    "",
    "# Greeter bug fix recipe",
    "",
    "I wrote this down after fixing three greeter ore items by hand. Use it when the belt hands you another greeter bug.",
    "",
    "1. Locate the greet function in `src/ore/<item>.ts`. Read that file first; every item keeps its bug in that one function.",
    "2. If the function returns `\"Goodbye, \" + name + \".\"`, fix both bad spots: replace `Goodbye` with `Hello`, then replace the final `.` with `!`.",
    "3. If the function returns `\"Hello, friend!\"`, preserve the greeting but interpolate the real argument: `\"Hello, \" + name + \"!\"`.",
    "4. Keep the function shape boring. Do not rename the export, move the file, or add helpers; the verifier only needs the greeting fixed.",
    "",
    "Decision table:",
    "- Wrong-greeting variant: the file still contains `Goodbye`. Make two exact replacements in order so the final code reads `return \"Hello, \" + name + \"!\";`.",
    "- Flat-greeting variant: the file contains `Hello, friend!` and does not use `name`. Make one exact replacement so the return expression is `\"Hello, \" + name + \"!\"`.",
    "- After each edit, do not invent extra checks or refactors. The ore verifier watches the existing file and will ship the item when the greeting text matches the recipe.",
    "- If a policy circuit allows `read *`, `bash grep *`, or `edit src/ore/*`, rely on it; otherwise ask once and prefer a reusable pattern for the ore directory.",
    "- Never touch another queued item while one is in progress. The belt brief names the item id; every read or edit path should stay under `src/ore/<that item>.ts`.",
    "",
  ].join("\n");

  const absolutePath = join(opts.workspace, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
  return { path, content };
}

export function skillBrief(content: string): string {
  const trimmed = content.trim();
  return trimmed.length === 0 ? "" : `\n\nSKILL RECIPE:\n${trimmed}\nEND SKILL RECIPE`;
}
