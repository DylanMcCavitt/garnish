import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { FactoryEngine, HandActions, HandFix } from "./types";
import type { EventSink } from "../harness/types";

interface HandActionOptions {
  engine: FactoryEngine;
  workspace: string;
  sink: EventSink;
  send?: (text: string) => Promise<void>;
  harnessSend?: (text: string) => Promise<void>;
}

const PASTE_BACK_LIMIT = 4000;

async function runWorkspaceCommand(workspace: string, cmd: string): Promise<{ exitCode: number; output: string }> {
  const proc = Bun.spawn(["sh", "-c", cmd], {
    cwd: workspace,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { exitCode, output: `${stdout}${stderr}` };
}

function replaceOnce(text: string, fix: HandFix): string {
  const first = text.indexOf(fix.oldString);
  if (first < 0) {
    throw new Error(`Exact string not found in ${fix.path}`);
  }
  if (text.indexOf(fix.oldString, first + fix.oldString.length) >= 0) {
    throw new Error(`Exact string is not unique in ${fix.path}`);
  }
  return `${text.slice(0, first)}${fix.newString}${text.slice(first + fix.oldString.length)}`;
}

export function createHandActions(opts: HandActionOptions): HandActions {
  const send = opts.send ?? opts.harnessSend;
  if (send === undefined) {
    throw new Error("createHandActions requires send or harnessSend");
  }

  return {
    async command(cmd: string): Promise<{ exitCode: number; output: string }> {
      opts.engine.recordTouch("hand-command", cmd);
      return runWorkspaceCommand(opts.workspace, cmd);
    },
    async edit(fix: HandFix): Promise<void> {
      const absolutePath = join(opts.workspace, fix.path);
      const before = await readFile(absolutePath, "utf8");
      const after = replaceOnce(before, fix);
      await writeFile(absolutePath, after, "utf8");
      opts.engine.recordTouch("hand-edit", fix.path);
      opts.sink.emit({
        type: "file.edited",
        path: fix.path,
        kind: "edit",
        summary: `+${Buffer.byteLength(fix.newString, "utf8")}/-${Buffer.byteLength(fix.oldString, "utf8")} bytes`,
      });
    },
    async pasteBack(cmd: string): Promise<void> {
      const result = await runWorkspaceCommand(opts.workspace, cmd);
      const output = result.output.length > PASTE_BACK_LIMIT ? `${result.output.slice(0, PASTE_BACK_LIMIT)}…` : result.output;
      await send(`PASTE: ${output}`);
    },
  };
}
