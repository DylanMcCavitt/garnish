import { createElement, useEffect, useMemo, useState } from "react";
import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createRoot, type Root } from "@opentui/react";
import type { ApprovalDecision, ApprovalPrompter, ApprovalRequest } from "../../../harness/types";
import type { FactoryState } from "../../../factory/types";
import type { WorldSlot } from "../../../factory/menu";
import type { StartTuiOpts } from "../../index";
import { FactoryApp, type ApprovalController } from "./app";
import { MenuScreen, type MenuWorlds } from "./menu-screen";
import type { ApprovalModalState } from "../../modal";
import { theme } from "./factory-theme";
import type { FactoryFlow } from "./flows/types";

export type FactoryTuiOpts = StartTuiOpts & {
  onCommand(line: string): boolean;
  factoryState(): FactoryState;
  readArtifact(path: string): string | null;
  settingsView(): Array<[string, string]>;
  flow: FactoryFlow;
  worlds: {
    list(): WorldSlot[];
    create(name: string): { root: string; name: string };
    select(world: { root: string; name: string }): void;
  };
  initialScreen: "menu" | "factory";
};

interface PendingApproval {
  state: ApprovalModalState;
  resolve(decision: ApprovalDecision): void;
}

export interface FactoryTuiHandle {
  prompter: ApprovalPrompter;
  stop(): void;
  showFactory(): void;
}

function worldLabel(path: string | undefined): string {
  if (!path) return "factory-world";
  return path.split("/").filter(Boolean).at(-1) ?? "factory-world";
}

function RootApp(props: { opts: FactoryTuiOpts; approval: ApprovalController; screen: "menu" | "factory"; registerShowFactory(fn: () => void): void }) {
  const [screen, setScreen] = useState<"menu" | "intro" | "factory">(props.screen);
  const [introWorldName, setIntroWorldName] = useState(() => worldLabel(props.opts.meta?.workspace));

  useEffect(() => {
    // "world is wired" signal: may not stomp an active intro card — the intro's
    // done() owns that transition (proto #5.2: wiring completes in milliseconds).
    props.registerShowFactory(() => setScreen((current) => (current === "intro" ? current : "factory")));
    return () => props.registerShowFactory(() => {
      // Replaced by the next mounted RootApp; startTui keeps the requested screen separately.
    });
  }, [props]);

  const worlds = useMemo<MenuWorlds>(() => ({
    list: props.opts.worlds.list,
    create: props.opts.worlds.create,
    select(world) {
      props.opts.worlds.select(world);
      setIntroWorldName(world.name);
      setScreen(props.opts.flow.Intro ? "intro" : "factory");
    },
  }), [props.opts.worlds, props.opts.flow.Intro]);

  if (screen === "menu") return createElement(MenuScreen, { worlds, onQuit: props.opts.onExit });
  if (screen === "intro" && props.opts.flow.Intro) return createElement(props.opts.flow.Intro, { worldName: introWorldName, done: () => setScreen("factory") });
  return createElement(FactoryApp, { ...props.opts, approval: props.approval });
}

export function startTui(opts: FactoryTuiOpts): FactoryTuiHandle {
  let renderer: CliRenderer | null = null;
  let root: Root | null = null;
  let stopped = false;
  let pending: PendingApproval | null = null;
  let requestedScreen: "menu" | "factory" = opts.initialScreen;
  let showFactoryScreen = () => {
    requestedScreen = "factory";
  };
  const subscribers = new Set<(state: ApprovalModalState | null) => void>();

  const publishApprovalState = () => {
    for (const subscriber of subscribers) subscriber(pending?.state ?? null);
  };

  const unsubscribeApprovalEvents = opts.bus.subscribe((event) => {
    if (event.type !== "tool.approval.requested") return;
    const request: ApprovalRequest = {
      callId: event.callId,
      tool: event.tool,
      command: event.command ?? "(no command supplied)",
      risk: event.risk,
      explanation: event.explanation,
      suggestedPattern: pending?.state.request.callId === event.callId ? pending.state.request.suggestedPattern : undefined,
    };
    pending = {
      state: { request, reason: pending?.state.request.callId === event.callId ? pending.state.reason : "", mode: "menu" },
      resolve: pending?.state.request.callId === event.callId ? pending.resolve : () => undefined,
    };
    publishApprovalState();
  });

  const approval: ApprovalController = {
    subscribe(fn) {
      subscribers.add(fn);
      fn(pending?.state ?? null);
      return () => subscribers.delete(fn);
    },
    resolve(decision) {
      const active = pending;
      pending = null;
      publishApprovalState();
      active?.resolve(decision);
    },
  };

  const boot = async () => {
    renderer = await createCliRenderer({
      screenMode: "alternate-screen",
      exitOnCtrlC: false,
      clearOnShutdown: true,
      targetFps: 30,
      backgroundColor: theme.bg,
    });
    if (stopped) {
      renderer.destroy();
      return;
    }
    root = createRoot(renderer);
    const registerShowFactory = (fn: () => void) => {
      showFactoryScreen = () => {
        requestedScreen = "factory";
        fn();
      };
    };
    root.render(createElement(RootApp, { opts, approval, screen: requestedScreen, registerShowFactory }));
  };

  void boot().catch((error) => {
    opts.onExit();
    console.error("Factory TUI failed to start", error);
  });

  return {
    prompter(req: ApprovalRequest) {
      return new Promise<ApprovalDecision>((resolve) => {
        if (pending?.state.request.callId === req.callId) {
          pending = { state: { ...pending.state, request: req }, resolve };
        } else {
          pending = { state: { request: req, reason: "", mode: "menu" }, resolve };
        }
        publishApprovalState();
      });
    },
    showFactory() {
      showFactoryScreen();
    },
    stop() {
      stopped = true;
      pending?.resolve({ approved: false, mode: "deny", reason: "TUI stopped" });
      pending = null;
      publishApprovalState();
      root?.unmount();
      renderer?.destroy();
      subscribers.clear();
      unsubscribeApprovalEvents();
    },
  };
}

export {
  deriveStage,
  emptyFactoryHud,
  factoryFloor,
  hudFromFactoryState,
  miniMapModel,
  nextActionHint,
  powerMeter,
  queueStripLine,
  reduceFactoryHud,
  touchSeriesLine,
} from "./model";
