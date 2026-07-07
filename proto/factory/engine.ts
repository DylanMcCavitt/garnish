import type { FactoryEngine, FactoryEngineOptions, FactoryState, MachineState, TaskItem, WorkMode } from "./types";
import type { HarnessEvent, MachineKind, TouchKind, Usage } from "../harness/types";

function cloneState(state: FactoryState): FactoryState {
  return {
    items: state.items.map((item) => ({ ...item, checks: [...item.checks], paths: [...item.paths] })),
    currentItemId: state.currentItemId,
    machines: state.machines.map((machine) => ({ ...machine })),
    research: state.research.map((research) => ({ ...research })),
    power: { ...state.power },
    shippedCount: state.shippedCount,
    touchSeries: state.touchSeries.map((point) => ({ ...point })),
  };
}

function usageTokens(usage: Usage | undefined): number {
  if (usage === undefined) return 0;
  return usage.inputTokens + usage.outputTokens;
}

export function createFactoryEngine(opts: FactoryEngineOptions): FactoryEngine {
  let stopped = false;
  let shiftTouches = 0;
  const state: FactoryState = {
    items: [],
    currentItemId: null,
    machines: [],
    research: opts.research.map((entry) => ({ ...entry, done: false })),
    power: {
      shiftActive: false,
      budgetTokens: 0,
      usedTokens: 0,
      brownedOut: false,
      brownouts: 0,
      shiftShipped: 0,
    },
    shippedCount: 0,
    touchSeries: [],
  };

  function currentItem(): TaskItem | null {
    if (state.currentItemId === null) return null;
    return state.items.find((item) => item.id === state.currentItemId && item.status === "in-progress") ?? null;
  }

  function variantForIndex(index: number) {
    const variantId = opts.variantPlan[(index - 1) % opts.variantPlan.length];
    const variant = opts.family.variants.find((candidate) => candidate.id === variantId);
    if (variant === undefined) {
      throw new Error(`Unknown ore variant ${variantId}`);
    }
    return variant;
  }

  async function enqueue(count: number): Promise<TaskItem[]> {
    const created: TaskItem[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const index = state.items.length + 1;
      const id = `item-${index}`;
      const variant = variantForIndex(index);
      const scaffold = await variant.scaffold(opts.workspace, id);
      const item: TaskItem = {
        id,
        familyId: opts.family.id,
        variantId: variant.id,
        title: variant.title(id),
        brief: variant.brief(id),
        paths: scaffold.paths,
        checks: variant.checks(id),
        status: "queued",
        mode: null,
        touches: 0,
      };
      state.items.push(item);
      created.push(item);
      opts.sink.emit({ type: "item.enqueued", itemId: id, familyId: opts.family.id, variantId: variant.id, title: item.title });
    }
    return created;
  }

  function recordTouch(kind: TouchKind, detail?: string): void {
    const item = kind === "power" ? null : currentItem();
    const itemId = item?.id ?? null;
    if (item !== null) {
      item.touches += 1;
    }
    if (state.power.shiftActive) {
      shiftTouches += 1;
    }
    opts.sink.emit(detail === undefined ? { type: "touch.recorded", itemId, kind } : { type: "touch.recorded", itemId, kind, detail });
  }

  function foldResearch(): void {
    for (const research of state.research) {
      if (!research.done && state.shippedCount >= research.threshold) {
        research.done = true;
        opts.sink.emit({
          type: "research.completed",
          researchId: research.id,
          label: research.label,
          unlocks: research.unlocks,
          shipped: state.shippedCount,
        });
      }
    }
  }

  function onEvent(event: HarnessEvent): void {
    if (stopped) return;
    if (event.type === "message.user") {
      if (event.source !== "player" || currentItem() === null) return;
      recordTouch(event.text.startsWith("PASTE: ") ? "paste-back" : "prompt", event.text);
      return;
    }
    if (event.type === "tool.approval.resolved") {
      if (event.mode !== "auto" && currentItem() !== null) {
        recordTouch("approval", event.pattern ?? event.reason ?? event.mode);
      }
      return;
    }
    if (event.type === "assistant.end" && state.power.shiftActive) {
      state.power.usedTokens += usageTokens(event.usage);
    }
  }

  const unsubscribe = opts.sink.bus.subscribe(onEvent);

  return {
    state(): FactoryState {
      return cloneState(state);
    },
    enqueue,
    startNext(mode: WorkMode): TaskItem | null {
      if (state.currentItemId !== null) return null;
      const item = state.items.find((candidate) => candidate.status === "queued") ?? null;
      if (item === null) return null;
      item.status = "in-progress";
      item.mode = mode;
      state.currentItemId = item.id;
      opts.sink.emit({ type: "item.started", itemId: item.id, mode });
      return { ...item, checks: [...item.checks], paths: [...item.paths] };
    },
    ship(itemId: string): void {
      const item = currentItem();
      if (item === null || item.id !== itemId) {
        throw new Error(`Cannot ship ${itemId}: it is not the current in-progress item`);
      }
      item.status = "shipped";
      item.mode = null;
      state.currentItemId = null;
      state.shippedCount += 1;
      if (state.power.shiftActive) {
        state.power.shiftShipped += 1;
      }
      state.touchSeries.push({ itemId: item.id, touches: item.touches });
      opts.sink.emit({ type: "item.shipped", itemId: item.id, touches: item.touches, science: opts.family.science });
      if (state.shippedCount <= 3) {
        void enqueue(2);
      }
      foldResearch();
    },
    buildMachine(kind: MachineKind, buildOpts = {}): MachineState {
      const id = kind === "skill" ? `skill:${buildOpts.name ?? "default"}` : kind === "policy-circuit" ? `policy:${buildOpts.name ?? "default"}` : kind;
      const existing = state.machines.find((machine) => machine.id === id);
      if (existing !== undefined) return { ...existing };
      const machine: MachineState = {
        id,
        kind,
        label: buildOpts.label ?? buildOpts.name ?? kind,
        artifact: buildOpts.artifact,
      };
      state.machines.push(machine);
      opts.sink.emit(machine.artifact === undefined ? { type: "machine.built", machineId: id, kind, label: machine.label } : { type: "machine.built", machineId: id, kind, label: machine.label, artifact: machine.artifact });
      return { ...machine };
    },
    hasMachine(kind: MachineKind): boolean {
      return state.machines.some((machine) => machine.kind === kind);
    },
    startShift(budgetTokens: number): void {
      state.power.shiftActive = true;
      state.power.budgetTokens = budgetTokens;
      state.power.usedTokens = 0;
      state.power.brownedOut = false;
      state.power.brownouts = 0;
      state.power.shiftShipped = 0;
      shiftTouches = 0;
      opts.sink.emit({ type: "shift.started", budgetTokens });
    },
    endShift(): void {
      const itemsShipped = state.power.shiftShipped;
      const brownouts = state.power.brownouts;
      const touches = shiftTouches;
      state.power.shiftActive = false;
      opts.sink.emit({ type: "shift.ended", itemsShipped, brownouts, touches });
    },
    drawPower(): boolean {
      if (!state.power.shiftActive || state.power.usedTokens <= state.power.budgetTokens) {
        return true;
      }
      if (!state.power.brownedOut) {
        state.power.brownedOut = true;
        state.power.brownouts += 1;
        opts.sink.emit({
          type: "power.brownout",
          usedTokens: state.power.usedTokens,
          budgetTokens: state.power.budgetTokens,
          itemId: state.currentItemId,
        });
      }
      return false;
    },
    feedGrid(tokens: number): void {
      state.power.budgetTokens += tokens;
      state.power.brownedOut = false;
      recordTouch("power", `+${tokens}`);
    },
    recordTouch,
    stop(): void {
      if (stopped) return;
      stopped = true;
      unsubscribe();
    },
  };
}
