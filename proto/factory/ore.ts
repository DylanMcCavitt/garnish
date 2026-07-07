import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Check } from "../../src/core/checks";
import type { HandFix, OreFamily, OreVariant } from "./types";

function orePath(itemId: string): string {
  return `src/ore/${itemId}.ts`;
}

function oreFile(workspace: string, itemId: string): string {
  return join(workspace, orePath(itemId));
}

function writeOre(workspace: string, itemId: string, body: string): { paths: string[] } {
  const path = orePath(itemId);
  const file = oreFile(workspace, itemId);
  mkdirSync(join(workspace, "src", "ore"), { recursive: true });
  writeFileSync(file, body, "utf8");
  return { paths: [path] };
}

const WRONG_GREETING_BODY = `export function greet(name: string): string {
  return "Goodbye, " + name + ".";
}
`;

const FLAT_GREETING_BODY = `export function greet(name: string): string {
  return "Hello, friend!";
}
`;

const wrongGreeting: OreVariant = {
  id: "wrong-greeting",
  title() {
    return "Wrong Greeting";
  },
  brief(itemId) {
    return `Fix ${orePath(itemId)} so greet(name) says Hello to the provided name and ends with an exclamation mark.`;
  },
  scaffold(workspace, itemId) {
    return Promise.resolve(writeOre(workspace, itemId, WRONG_GREETING_BODY));
  },
  checks(itemId): Check[] {
    const file = `{workspace}/${orePath(itemId)}`;
    return [
      { type: "command", command: `grep -q 'Hello,' ${file}`, exit_code: 0 },
      { type: "command", command: `grep -q 'Goodbye' ${file}`, exit_code: 1 },
      { type: "command", command: `grep -q '!' ${file}`, exit_code: 0 },
    ];
  },
  handFixes(itemId): HandFix[] {
    const path = orePath(itemId);
    return [
      { path, oldString: "Goodbye, ", newString: "Hello, " },
      { path, oldString: ".", newString: "!" },
    ];
  },
};

const flatGreeting: OreVariant = {
  id: "flat-greeting",
  title() {
    return "Flat Greeting";
  },
  brief(itemId) {
    return `Fix ${orePath(itemId)} so greet(name) uses the provided name instead of the flat friend fallback.`;
  },
  scaffold(workspace, itemId) {
    return Promise.resolve(writeOre(workspace, itemId, FLAT_GREETING_BODY));
  },
  checks(itemId): Check[] {
    const file = `{workspace}/${orePath(itemId)}`;
    return [
      { type: "command", command: `grep -q '+ name +' ${file}`, exit_code: 0 },
      { type: "command", command: `grep -q 'friend' ${file}`, exit_code: 1 },
    ];
  },
  handFixes(itemId): HandFix[] {
    return [{ path: orePath(itemId), oldString: "Hello, friend!", newString: "\"Hello, \" + name + \"!\"" }];
  },
};

export const GREETER_BUG_FAMILY: OreFamily = {
  id: "greeter-bug",
  label: "Greeter Bug",
  science: "red",
  variants: [wrongGreeting, flatGreeting],
};
