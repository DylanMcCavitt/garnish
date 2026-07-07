import type { HarnessEvent, MachineKind } from "../../../harness/types";
import type { FactoryState, ItemStatus, MachineState, PowerState, WorkMode } from "../../../factory/types";
import { FACTORY_VARIANT_PLAN } from "../../../factory/types";

export type FactoryStage = 0 | 1 | 2;

export interface FactoryHudItem {
  itemId: string;
  familyId: string;
  variantId: string;
  title: string;
  status: ItemStatus;
  mode: WorkMode | null;
  touches: number;
}

export interface FactoryHudState {
  items: FactoryHudItem[];
  currentItemId: string | null;
  touchSeries: Array<{ itemId: string; touches: number }>;
  sciencePacks: Record<string, number>;
  researchDone: Array<{ researchId: string; label: string; unlocks: MachineKind; shipped: number }>;
  machines: MachineState[];
  power: PowerState;
  brownoutFlash: boolean;
}

export interface MiniMapMachineNode {
  id: "miner" | "belt" | "assembler" | "circuit";
  kind: MachineKind;
  label: string;
  built: boolean;
  machine?: MachineState;
}

export interface FactoryMiniMapModel {
  machines: MiniMapMachineNode[];
  oreRemaining: number;
  sciencePacks: Record<string, number>;
}

const ZERO_POWER: PowerState = {
  shiftActive: false,
  budgetTokens: 0,
  usedTokens: 0,
  brownedOut: false,
  brownouts: 0,
  shiftShipped: 0,
};

export function emptyFactoryHud(): FactoryHudState {
  return {
    items: [],
    currentItemId: null,
    touchSeries: [],
    sciencePacks: { red: 0 },
    researchDone: [],
    machines: [],
    power: { ...ZERO_POWER },
    brownoutFlash: false,
  };
}

export function deriveStage(events: HarnessEvent[]): FactoryStage {
  let enqueued = 0;
  for (const event of events) {
    if (event.type === "machine.built" && event.kind === "routing-belt") return 2;
    if (event.type === "item.enqueued") enqueued += 1;
  }
  return enqueued >= 3 ? 1 : 0;
}
/**
 * Stage from authoritative engine state — immune to pre-mount or ring-buffer
 * event loss (the live app uses this; deriveStage stays for full-log folds).
 */
export function stageFromState(state: FactoryState): FactoryStage {
  if (state.machines.some((machine) => machine.kind === "routing-belt")) return 2;
  return state.items.length >= 3 ? 1 : 0;
}

export function hudFromFactoryState(state: FactoryState): FactoryHudState {
  const scienceRed = state.touchSeries.length || state.shippedCount;
  return {
    items: state.items.map((item) => ({
      itemId: item.id,
      familyId: item.familyId,
      variantId: item.variantId,
      title: item.title,
      status: item.status,
      mode: item.mode,
      touches: item.touches,
    })),
    currentItemId: state.currentItemId,
    touchSeries: [...state.touchSeries],
    sciencePacks: { red: scienceRed },
    researchDone: state.research
      .filter((research) => research.done)
      .map((research) => ({ researchId: research.id, label: research.label, unlocks: research.unlocks, shipped: research.threshold })),
    machines: [...state.machines],
    power: { ...state.power },
    brownoutFlash: state.power.brownedOut,
  };
}

function fallbackItem(itemId: string): FactoryHudItem {
  return {
    itemId,
    familyId: "",
    variantId: "",
    title: itemId,
    status: "queued",
    mode: null,
    touches: 0,
  };
}

function updateItem(items: FactoryHudItem[], itemId: string, update: (item: FactoryHudItem) => FactoryHudItem): FactoryHudItem[] {
  const index = items.findIndex((item) => item.itemId === itemId);
  if (index === -1) return [...items, update(fallbackItem(itemId))];
  return items.map((item, itemIndex) => (itemIndex === index ? update(item) : item));
}

function usageTokens(event: Extract<HarnessEvent, { type: "assistant.end" }>): number {
  const usage = event.usage ?? event.message.usage;
  return usage ? usage.inputTokens + usage.outputTokens : 0;
}

export function reduceFactoryHud(state: FactoryHudState, event: HarnessEvent): FactoryHudState {
  switch (event.type) {
    case "item.enqueued":
      return {
        ...state,
        items: updateItem(state.items, event.itemId, (item) => ({
          ...item,
          familyId: event.familyId,
          variantId: event.variantId,
          title: event.title,
          status: item.status === "shipped" ? item.status : "queued",
        })),
      };
    case "item.started":
      return {
        ...state,
        currentItemId: event.itemId,
        items: updateItem(state.items, event.itemId, (item) => ({ ...item, status: "in-progress", mode: event.mode })),
      };
    case "touch.recorded":
      if (event.kind === "power") {
        return {
          ...state,
          power: { ...state.power, brownedOut: false },
          brownoutFlash: false,
        };
      }
      if (!event.itemId) return state;
      return {
        ...state,
        items: updateItem(state.items, event.itemId, (item) => ({ ...item, touches: item.touches + 1 })),
      };
    case "item.shipped": {
      const science = event.science || "red";
      const shiftShipped = state.power.shiftActive ? state.power.shiftShipped + 1 : state.power.shiftShipped;
      return {
        ...state,
        currentItemId: state.currentItemId === event.itemId ? null : state.currentItemId,
        items: updateItem(state.items, event.itemId, (item) => ({ ...item, status: "shipped", touches: event.touches })),
        touchSeries: [...state.touchSeries, { itemId: event.itemId, touches: event.touches }],
        sciencePacks: { ...state.sciencePacks, [science]: (state.sciencePacks[science] ?? 0) + 1 },
        power: { ...state.power, shiftShipped },
      };
    }
    case "research.completed":
      if (state.researchDone.some((research) => research.researchId === event.researchId)) return state;
      return {
        ...state,
        researchDone: [...state.researchDone, { researchId: event.researchId, label: event.label, unlocks: event.unlocks, shipped: event.shipped }],
      };
    case "machine.built":
      return {
        ...state,
        machines: state.machines.some((machine) => machine.id === event.machineId)
          ? state.machines.map((machine) => machine.id === event.machineId ? { id: event.machineId, kind: event.kind, label: event.label, artifact: event.artifact } : machine)
          : [...state.machines, { id: event.machineId, kind: event.kind, label: event.label, artifact: event.artifact }],
      };
    case "shift.started":
      return {
        ...state,
        power: { shiftActive: true, budgetTokens: event.budgetTokens, usedTokens: 0, brownedOut: false, brownouts: 0, shiftShipped: 0 },
        brownoutFlash: false,
      };
    case "assistant.end":
      if (!state.power.shiftActive) return state;
      return {
        ...state,
        power: { ...state.power, usedTokens: state.power.usedTokens + usageTokens(event) },
      };
    case "power.brownout":
      return {
        ...state,
        power: {
          ...state.power,
          usedTokens: event.usedTokens,
          budgetTokens: event.budgetTokens,
          brownedOut: true,
          brownouts: state.power.brownouts + 1,
        },
        brownoutFlash: true,
      };
    case "shift.ended":
      return {
        ...state,
        power: { ...state.power, shiftActive: false, shiftShipped: event.itemsShipped, brownouts: event.brownouts },
      };
    default:
      return state;
  }
}

function itemMarker(item: FactoryHudItem): string {
  if (item.status === "shipped") return "✓";
  if (item.status === "in-progress") return item.mode === "agent" ? "▶A" : "▶H";
  return "□";
}

export function queueStripLine(hud: FactoryHudState, maxLength = 130): string {
  if (hud.items.length === 0) return "QUEUE empty";
  // collapse the leading shipped run so a long session never wraps the band
  let collapsed = 0;
  while (collapsed < hud.items.length - 3 && hud.items[collapsed]?.status === "shipped") collapsed += 1;
  const head = collapsed > 1 ? [`✓×${collapsed}`] : hud.items.slice(0, collapsed).map((item) => `${itemMarker(item)} ${item.itemId}:${item.title}`);
  const tail = hud.items.slice(collapsed).map((item) => `${itemMarker(item)} ${item.itemId}:${item.title}`);
  const line = `QUEUE ${[...head, ...tail].join("  ")}`;
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
}

export function touchSeriesLine(hud: FactoryHudState): string {
  const series = hud.touchSeries.map((item) => item.touches).join(" ");
  return `TOUCHES/ITEM ${series || "—"}`;
}

export function powerMeter(hud: FactoryHudState, width: number): string {
  const cells = Math.max(1, Math.floor(width));
  const budget = hud.power.budgetTokens;
  const used = hud.power.usedTokens;
  const ratio = budget > 0 ? Math.min(1, used / budget) : 0;
  const filled = Math.min(cells, Math.max(0, Math.round(ratio * cells)));
  const bar = `${"█".repeat(filled)}${"░".repeat(cells - filled)}`;
  const state = hud.power.brownedOut || hud.brownoutFlash ? " BROWNOUT" : hud.power.shiftActive ? " SHIFT" : " IDLE";
  return `[${bar}] ⚡ ${used}/${budget}${state}`;
}

const MINI_MAP_NODES: Array<Omit<MiniMapMachineNode, "built" | "machine">> = [
  { id: "miner", kind: "bare-agent", label: "miner" },
  { id: "belt", kind: "routing-belt", label: "belt" },
  { id: "assembler", kind: "skill", label: "assembler" },
  { id: "circuit", kind: "policy-circuit", label: "circuit" },
];

export function miniMapModel(hud: FactoryHudState): FactoryMiniMapModel {
  const shipped = hud.touchSeries.length;
  return {
    machines: MINI_MAP_NODES.map((node) => {
      const machine = hud.machines.find((candidate) => candidate.kind === node.kind);
      return { ...node, built: Boolean(machine), machine };
    }),
    oreRemaining: Math.max(0, FACTORY_VARIANT_PLAN.length - shipped),
    sciencePacks: { ...hud.sciencePacks },
  };
}
