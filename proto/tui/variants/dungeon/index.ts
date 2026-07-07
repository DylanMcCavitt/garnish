import { createElement } from "react";
import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createRoot, type Root } from "@opentui/react";
import type { ApprovalDecision, ApprovalPrompter, ApprovalRequest } from "../../../harness/types";
import type { StartTuiOpts } from "../../index";
import type { ApprovalModalState } from "../../modal";
import { DungeonApp, type ApprovalController } from "./app";

interface PendingApproval {
  state: ApprovalModalState;
  resolve(decision: ApprovalDecision): void;
}

export function startTui(opts: StartTuiOpts): { prompter: ApprovalPrompter; stop(): void } {
  let renderer: CliRenderer | null = null;
  let root: Root | null = null;
  let stopped = false;
  let pending: PendingApproval | null = null;
  const subscribers = new Set<(state: ApprovalModalState | null) => void>();

  const publishApprovalState = () => {
    for (const subscriber of subscribers) subscriber(pending?.state ?? null);
  };

  const unsubscribeApprovalEvents = opts.bus.subscribe((event) => {
    if (event.type !== "tool.approval.requested") return;
    pending = {
      state: {
        request: {
          callId: event.callId,
          tool: event.tool,
          command: event.command ?? event.tool,
          risk: event.risk,
          explanation: event.explanation,
        },
        reason: "",
        mode: "menu",
      },
      resolve: () => {},
    };
    publishApprovalState();
  });

  const approval: ApprovalController = {
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(pending?.state ?? null);
      return () => subscribers.delete(subscriber);
    },
    resolve(decision) {
      const current = pending;
      pending = null;
      publishApprovalState();
      current?.resolve(decision);
    },
  };

  const boot = async () => {
    renderer = await createCliRenderer({ targetFps: 30, screenMode: "alternate-screen" });
    if (stopped) {
      renderer.destroy();
      renderer = null;
      return;
    }
    root = createRoot(renderer);
    root.render(createElement(DungeonApp, { ...opts, approval }));
  };

  void boot().catch((error) => {
    console.error(error);
    opts.onExit();
  });

  return {
    prompter(request: ApprovalRequest) {
      return new Promise<ApprovalDecision>((resolve) => {
        pending = { state: { request, reason: "", mode: "menu" }, resolve };
        publishApprovalState();
      });
    },
    stop() {
      stopped = true;
      unsubscribeApprovalEvents();
      pending?.resolve({ approved: false, mode: "deny", reason: "TUI stopped." });
      pending = null;
      publishApprovalState();
      root?.unmount();
      renderer?.destroy();
      root = null;
      renderer = null;
    },
  };
}
