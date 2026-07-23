import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as readline from "node:readline/promises";

import { initCommand, type Prompter } from "./init";
import { doctorCommand, main, usage, type CommandOutcome } from "./index";
import { createFsEventStore, loadInstalledState } from "./state";

/** Real dependency composition root: wires the portable CLI to Garnish state on disk. */
export interface RunGarnishOptions {
  /** Garnish-owned storage root. Default: $GARNISH_ROOT, else ~/.garnish. */
  readonly rootDir?: string;
  /** Environment snapshot consulted for GARNISH_ROOT. Default: process.env. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Prompter retained for callers that still exercise the superseded init command. */
  readonly prompter?: Prompter;
}

export async function runGarnish(
  argv: readonly string[],
  options: RunGarnishOptions = {},
): Promise<CommandOutcome> {
  const env = options.env ?? process.env;
  const rootDir = resolve(options.rootDir ?? env.GARNISH_ROOT ?? join(process.env.HOME ?? ".", ".garnish"));
  const [command = "status"] = argv;

  if (command === "init") {
    return await initCommand({ prompter: options.prompter ?? createStdinPrompter() });
  }

  if (command === "doctor") {
    return await doctorCommand({});
  }

  if (command !== "status" && command !== "quest" && command !== "unlock" && command !== "cheat") {
    return { text: usage(), exitCode: 2 };
  }

  try {
    const installed = loadInstalledState(join(rootDir, "agent"));
    return await main(argv, {
      cli: {
        graph: installed.graph,
        quests: installed.quests,
        store: createFsEventStore(installed.eventsPath),
        now: () => new Date().toISOString(),
      },
      doctor: {},
    });
  } catch (error) {
    return { text: error instanceof Error ? error.message : `${error}`, exitCode: 1 };
  }
}

function createStdinPrompter(): Prompter {
  if (process.stdin.isTTY !== true) {
    // Piped/non-interactive stdin (proof plan: "answers piped"): readline drops buffered
    // lines before question() attaches, so consume stdin wholesale instead.
    const lines = readFileSync(0, "utf8").split("\n");
    let index = 0;
    return {
      ask(_question: string, defaultAnswer?: string): string {
        const answer = (lines[index] ?? "").trim();
        index += 1;
        return answer.length === 0 ? (defaultAnswer ?? "") : answer;
      },
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: async (question: string, defaultAnswer?: string): Promise<string> => {
      const hint = defaultAnswer === undefined ? "" : ` (default: ${defaultAnswer})`;
      const answer = (await rl.question(`${question}${hint}: `)).trim();
      return answer.length === 0 ? (defaultAnswer ?? "") : answer;
    },
  };
}
