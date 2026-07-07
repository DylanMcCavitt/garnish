import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { EventSink, ToolCall } from "../harness/types";
import { createRulesEngine } from "../approvals";

export interface CircuitOptions {
  workspace: string;
  sink: EventSink;
}

export interface Circuit {
  patterns(): string[];
  append(pattern: string): void;
  ruleString(call: { name: string; input: unknown }): string;
}

export function createCircuit(opts: CircuitOptions): Circuit {
  void opts.sink;
  const filePath = join(opts.workspace, ".garnish", "policies", "circuit.txt");
  const loaded = existsSync(filePath) ? readCircuit(filePath) : [];
  const patternSet = new Set(loaded);

  const persist = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    const lines = ["# Garnish policy circuit", "# One allow-pattern per line. Trailing * means startsWith.", ...patternSet];
    writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  };

  return {
    patterns() {
      return [...patternSet];
    },
    append(pattern: string) {
      const normalized = normalizePattern(pattern);
      if (normalized.length === 0) return;
      const before = patternSet.size;
      patternSet.add(normalized);
      if (patternSet.size !== before || !existsSync(filePath)) persist();
    },
    ruleString(call: Pick<ToolCall, "name" | "input">) {
      if (call.name === "bash") return `bash ${inputString(call.input, "cmd")}`.trim();
      if (call.name === "read" || call.name === "write" || call.name === "edit") {
        return `${call.name} ${inputString(call.input, "path")}`.trim();
      }
      return `${call.name} ${stableInput(call.input)}`.trim();
    },
  };
}

export function circuitAllows(patterns: string[], rule: string): boolean {
  return createRulesEngine({ sessionAllows: patterns }).evaluate(rule).outcome === "allow";
}

function readCircuit(filePath: string): string[] {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function normalizePattern(pattern: string): string {
  return pattern.trim().replace(/\s+/g, " ");
}

function inputString(input: unknown, key: string): string {
  if (input === null || typeof input !== "object" || !(key in input)) return "";
  const value = Reflect.get(input, key);
  return typeof value === "string" ? value : String(value ?? "");
}

function stableInput(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
