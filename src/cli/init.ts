import type { CommandOutcome } from "./index";

export interface Prompter {
  readonly ask: (question: string, defaultAnswer?: string) => string | Promise<string>;
}

export interface InitDeps {
  readonly prompter?: Prompter;
}

export interface InitResult extends CommandOutcome {
  readonly promptCount: number;
}

export async function initCommand(_deps: InitDeps = {}): Promise<InitResult> {
  return {
    text: [
      "garnish init has been superseded by the standalone harness.",
      "Use the standalone harness to provision Garnish state before running the portable CLI commands.",
    ].join("\n"),
    exitCode: 1,
    promptCount: 0,
  };
}

export interface QueuedPrompter extends Prompter {
  readonly askedQuestions: string[];
}

export function queuedPrompter(answers: readonly string[]): QueuedPrompter {
  const queue = [...answers];
  const askedQuestions: string[] = [];
  return {
    askedQuestions,
    ask(question: string, defaultAnswer?: string): string {
      askedQuestions.push(question);
      const next = queue.shift();
      return next === undefined || next.length === 0 ? (defaultAnswer ?? "") : next;
    },
  };
}
