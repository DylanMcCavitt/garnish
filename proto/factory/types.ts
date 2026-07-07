/**
 * PROTOTYPE — THROWAWAY. Shared contract for proto #4: the Factorio first-hour
 * vertical slice. Integrator-owned: pinned BEFORE fanout; slices import from
 * here and MUST NOT edit it. Event taxonomy additions live in
 * `proto/harness/types.ts` (same rule).
 */
import type { Check } from "../../src/core/checks";
import type {
  ApprovalPrompter,
  EventSink,
  Harness,
  MachineKind,
  ProviderName,
  StreamFn,
  TouchKind,
} from "../harness/types";

// ---------------------------------------------------------------------------
// Ore: procedural task families (ONE hardcoded family, two variants)
// ---------------------------------------------------------------------------

/** A single hand-fix step (mirrors the edit tool's exact-replace contract). */
export interface HandFix {
  path: string; // workspace-relative
  oldString: string;
  newString: string;
}

export interface OreVariant {
  id: string;
  title(itemId: string): string;
  /** one-paragraph task brief shown to player/agent */
  brief(itemId: string): string;
  /** write the broken file(s) for one item; returns workspace-relative paths */
  scaffold(workspace: string, itemId: string): Promise<{ paths: string[] }>;
  /** v1 check-DSL data proving the item is fixed ({workspace} substitution ok) */
  checks(itemId: string): Check[];
  /** the canonical hand fixes, in application order (drives /fix + demo) */
  handFixes(itemId: string): HandFix[];
}

export interface OreFamily {
  id: string;
  label: string;
  /** science pack color this family yields (red = bug-fix throughput) */
  science: "red";
  variants: OreVariant[];
}

// ---------------------------------------------------------------------------
// Items & factory state
// ---------------------------------------------------------------------------

export type ItemStatus = "queued" | "in-progress" | "shipped";
export type WorkMode = "hand" | "agent";

export interface TaskItem {
  id: string; // "item-1"... enqueue order
  familyId: string;
  variantId: string;
  title: string;
  brief: string;
  paths: string[]; // workspace-relative files it owns
  checks: Check[];
  status: ItemStatus;
  mode: WorkMode | null;
  touches: number; // touch.recorded folded per item
}

export interface MachineState {
  id: string; // singleton kinds: kind itself; else "skill:<name>" / "policy:<name>"
  kind: MachineKind;
  label: string;
  artifact?: string; // workspace-relative authored-artifact path
}

export interface ResearchState {
  id: string; // "research-red-1"...
  label: string;
  unlocks: MachineKind;
  threshold: number; // shipped-items count that completes it
  done: boolean;
}

export interface PowerState {
  shiftActive: boolean;
  budgetTokens: number;
  usedTokens: number; // accumulated from assistant.end usage while shift active
  brownedOut: boolean;
  brownouts: number; // count this session
  shiftShipped: number; // items shipped during the active shift
}

/** 0 = bare chat · 1 = +queue strip · 2 = +mini-map. Derived, never stored. */
export type FactoryStage = 0 | 1 | 2;

export interface FactoryState {
  items: TaskItem[]; // enqueue order
  currentItemId: string | null;
  machines: MachineState[];
  research: ResearchState[];
  power: PowerState;
  shippedCount: number;
  /** per shipped item, in ship order — the HUD descent series */
  touchSeries: Array<{ itemId: string; touches: number }>;
}

// ---------------------------------------------------------------------------
// Engine (proto/factory/engine.ts)
// ---------------------------------------------------------------------------

export interface FactoryEngineOptions {
  sink: EventSink;
  workspace: string;
  family: OreFamily;
  /** variant id per enqueue index (cycles if shorter than items enqueued) */
  variantPlan: string[];
  research: Array<Omit<ResearchState, "done">>;
}

export interface FactoryEngine {
  state(): FactoryState;
  /** scaffold + emit item.enqueued for `count` new items */
  enqueue(count: number): Promise<TaskItem[]>;
  /** pull next queued item -> in-progress; emits item.started. null when empty/occupied */
  startNext(mode: WorkMode): TaskItem | null;
  /** mark current item done: emits item.shipped, folds research (research.completed) */
  ship(itemId: string): void;
  buildMachine(
    kind: MachineKind,
    opts?: { name?: string; label?: string; artifact?: string },
  ): MachineState;
  hasMachine(kind: MachineKind): boolean;
  startShift(budgetTokens: number): void;
  endShift(): void;
  /** belt pull-time power gate: true = pull allowed; false = brownout was emitted */
  drawPower(): boolean;
  /** player raises the budget; emits touch.recorded kind=power itemId=null */
  feedGrid(tokens: number): void;
  /** record a player touch against the current item (or null) */
  recordTouch(kind: TouchKind, detail?: string): void;
  /** subscribes bus folds (message.user/approval/assistant.end); returns unsubscribe */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Hand actions (proto/factory/hand.ts) — the player's literal hands
// ---------------------------------------------------------------------------

export interface HandActions {
  /** run a command in the workspace; emits touch hand-command; returns output */
  command(cmd: string): Promise<{ exitCode: number; output: string }>;
  /** exact-replace edit; emits touch hand-edit + file.edited (verifier trigger) */
  edit(fix: HandFix): Promise<void>;
  /**
   * human-as-tool-runtime: run the model-proposed command, then send its output
   * back through the harness as "PASTE: ..." (counted once, kind paste-back)
   */
  pasteBack(cmd: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Ship verifier (proto/factory/verify.ts) — v1 engine rebind for items
// ---------------------------------------------------------------------------

export interface EvaluateChecksOptions {
  checks: Check[];
  workspace: string;
  /** live harness events mapped to VerifierEvents (same mapping as game bridge) */
  events: ReadonlyArray<{ name: string; sessionId?: string; seq: number; payload?: unknown }>;
  currentSessionId?: string;
  /** sameItem: scope anchor — v1 EvaluationContext.currentItemId */
  currentItemId?: string;
}

export interface ChecksVerdict {
  pass: boolean;
  lines: Array<{ line: string; done: boolean }>;
}

/** Shared single bridge into src/verifier evaluateQuest (demo + ship-verifier). */
export type EvaluateChecks = (opts: EvaluateChecksOptions) => Promise<ChecksVerdict>;

export interface ShipVerifier {
  /** re-evaluate current item now (also auto-runs on turn.end/file.edited/touch.recorded) */
  poke(): Promise<void>;
  /** resolves when no evaluation is in flight */
  settled(): Promise<void>;
  stop(): void;
}

// ---------------------------------------------------------------------------
// Wiring (proto/factory/wire.ts)
// ---------------------------------------------------------------------------

export interface FactoryWireOptions {
  streamFn: StreamFn;
  provider: ProviderName;
  prompter: ApprovalPrompter;
  root?: string;
  model?: string;
  /** shift/belt budget defaults; demo overrides */
  budgetTokens?: number;
}

export interface WiredFactory {
  harness: Harness;
  sink: EventSink;
  engine: FactoryEngine;
  hand: HandActions;
  verifier: ShipVerifier;
  workspace: string;
  root: string;
  sessionLogPath: string;
  /** belt: if built + powered + idle, pull next item and send the steering brief */
  beltKick(): Promise<void>;
  /** forge the skill machine: writes .garnish/skills/<name>.md + machine.built */
  forgeSkill(name: string): Promise<MachineState>;
  /** wire the policy circuit: writes .garnish/policies/circuit.txt + machine.built */
  wireCircuit(patterns: string[]): Promise<MachineState>;
  stop(): void;
}

// ---------------------------------------------------------------------------
// Canonical episode constants (pinned; demo + tests assert against these)
// ---------------------------------------------------------------------------

export const FACTORY_RESEARCH_TRACK: Array<Omit<ResearchState, "done">> = [
  { id: "research-red-1", label: "Burner Mining (bare agent)", unlocks: "bare-agent", threshold: 2 },
  { id: "research-red-2", label: "Logistics (routing belt)", unlocks: "routing-belt", threshold: 3 },
  { id: "research-red-3", label: "Assembly (skills)", unlocks: "skill", threshold: 3 },
  { id: "research-red-4", label: "Circuit Network (policies)", unlocks: "policy-circuit", threshold: 3 },
];

/** item-1..item-7 variant plan: A = two-spot "wrong-greeting", B = one-spot "flat-greeting" */
export const FACTORY_VARIANT_PLAN = [
  "wrong-greeting", // item-1: hand-craft, 4 touches
  "flat-greeting", //  item-2: human-as-tool-runtime, 3 touches
  "flat-greeting", //  item-3: bare agent everything-ask, 4 touches
  "wrong-greeting", // item-4: belt+skill+policy, 1 touch (pattern approval)
  "flat-greeting", //  item-5: shift, 0 touches
  "wrong-greeting", // item-6: shift (after brownout+feed), 0 touches
  "flat-greeting", //  item-7: shift, 0 touches
];

/** the felt-experience bar: the HUD descent the demo must reproduce */
export const FACTORY_TOUCH_DESCENT = [4, 3, 4, 1, 0, 0, 0];
