import { access, readFile } from "node:fs/promises";

import type { Check, Quest } from "../../src/core";
import { evaluateQuest, type EvaluationContext, type VerifierEvent } from "../../src/verifier";
import type { ChecksVerdict, EvaluateChecks, FactoryEngine, ShipVerifier } from "./types";
import type { EventBus, EventSink, HarnessEvent } from "../harness/types";

interface ShipVerifierOptions {
  bus?: EventBus;
  sink: EventSink;
  engine: FactoryEngine;
  workspace: string;
  evaluateChecks?: EvaluateChecks;
}

export const evaluateChecks: EvaluateChecks = async (opts) => {
  const quest = {
    id: "factory-item",
    level: "factory",
    title: "Factory item",
    description: "Ephemeral factory item checks",
    xp: 0,
    required: true,
    prereqs: [],
    unlocks: [],
    checks: opts.checks as Check[],
  } as unknown as Quest;

  const ctx = {
    probes: createProbes(opts.workspace),
    events: opts.events,
    currentSessionId: opts.currentSessionId,
    currentItemId: opts.currentItemId,
    paths: {
      workspace: opts.workspace,
      sandbox: opts.workspace,
    },
    commandCwd: opts.workspace,
  } as EvaluationContext;

  const result = await evaluateQuest(quest, ctx);
  return {
    pass: result.status === "pass",
    lines: result.checks.map((entry) => ({ line: renderCheck(entry.check), done: entry.result.status === "pass" })),
  };
};

export function startShipVerifier(opts: ShipVerifierOptions): ShipVerifier {
  const bus = opts.bus ?? opts.sink.bus;
  const runChecks = opts.evaluateChecks ?? evaluateChecks;
  const events: VerifierEvent[] = opts.sink.log.read().map(toVerifierEvent);
  let stopped = false;
  let running = false;
  let pending = false;
  let queue: Promise<void> = Promise.resolve();

  async function evaluateCurrent(): Promise<void> {
    if (stopped) return;
    const snapshot = opts.engine.state();
    if (snapshot.currentItemId === null) return;
    const item = snapshot.items.find((candidate) => candidate.id === snapshot.currentItemId && candidate.status === "in-progress");
    if (item === undefined) return;

    const verdict = await runChecks({
      checks: item.checks,
      workspace: opts.workspace,
      events,
      currentSessionId: opts.sink.sessionId,
      currentItemId: item.id,
    });

    const after = opts.engine.state();
    if (verdict.pass && after.currentItemId === item.id && after.items.some((candidate) => candidate.id === item.id && candidate.status === "in-progress")) {
      opts.engine.ship(item.id);
    }
  }

  async function drain(): Promise<void> {
    if (running) return queue;
    running = true;
    try {
      while (pending && !stopped) {
        pending = false;
        await evaluateCurrent();
      }
    } finally {
      running = false;
    }
  }

  function schedule(): Promise<void> {
    pending = true;
    if (!running) {
      queue = queue.then(drain, drain);
    }
    return queue;
  }

  const unsubscribe = bus.subscribe((event) => {
    if (stopped) return;
    events.push(toVerifierEvent(event));
    if (event.type === "turn.end" || event.type === "file.edited" || event.type === "touch.recorded") {
      void schedule();
    }
  });

  return {
    poke(): Promise<void> {
      return schedule();
    },
    settled(): Promise<void> {
      return queue;
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      unsubscribe();
    },
  };
}

function toVerifierEvent(event: HarnessEvent): VerifierEvent {
  const { type, id, parentId, sessionId, seq, ts, ...payload } = event;
  return {
    name: type,
    sessionId,
    seq,
    payload: {
      ...payload,
      id,
      parentId,
      sessionId,
      seq,
      ts,
    },
  };
}

function createProbes(workspace: string): EvaluationContext["probes"] {
  return {
    async fileExists(path: string): Promise<boolean> {
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    },
    readFile(path: string): Promise<string> {
      return readFile(path, "utf8");
    },
    async runCommand(command: readonly string[] | string, options?: { readonly cwd?: string; readonly timeoutMs?: number }) {
      const args = typeof command === "string" ? ["sh", "-c", command] : [...command];
      const proc = Bun.spawn(args, {
        cwd: options?.cwd ?? workspace,
        stdout: "pipe",
        stderr: "pipe",
      });
      const timeout = options?.timeoutMs === undefined ? undefined : setTimeout(() => proc.kill(), options.timeoutMs);
      try {
        const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
        return { exitCode, stdout, stderr };
      } finally {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
      }
    },
    mcpHandshake() {
      return { ok: false, error: "mcp checks are not wired in the factory bridge" };
    },
    skillValid() {
      return { valid: false, errors: ["skill checks are not wired in the factory bridge"] };
    },
    confirm() {
      return undefined;
    },
  };
}

function renderCheck(check: Check): string {
  switch (check.type) {
    case "event":
      return `event ${check.match.event}${check.match.tool === undefined ? "" : ` tool=${JSON.stringify(check.match.tool)}`}${check.match.path === undefined ? "" : ` path=${JSON.stringify(check.match.path)}`}${check.match.approved === undefined ? "" : ` approved=${check.match.approved}`}${check.match.success === undefined ? "" : ` success=${check.match.success}`}`;
    case "file_exists":
      return `file exists ${check.path}`;
    case "json_path":
      return `json ${check.file} ${check.path} ${JSON.stringify(check.assert)}`;
    case "yaml_path":
      return `yaml ${check.file} ${check.path} ${JSON.stringify(check.assert)}`;
    case "command":
      return `command ${Array.isArray(check.command) ? check.command.join(" ") : check.command}${check.stdout === undefined ? "" : ` stdout=${JSON.stringify(check.stdout)}`}`;
    case "git":
      return `git ${check.repo ?? "."}`;
    case "mcp_handshake":
      return `mcp handshake ${JSON.stringify(check.server)}`;
    case "skill_valid":
      return `skill valid ${check.path}`;
    case "confirm":
      return `confirm ${check.prompt ?? check.id ?? "confirm"}`;
  }
}
