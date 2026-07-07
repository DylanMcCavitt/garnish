import type { HarnessEvent, Scorecard } from "../../../harness/types";
import type { AtlasLevel } from "../../../game/atlas";

export const DUNGEON_COLORS = {
  bg: "#0B0705",
  panel: "#17100B",
  panelHot: "#241509",
  amber: "#FFB13B",
  amberBright: "#FFD166",
  slime: "#79E84A",
  blood: "#FF3158",
  purple: "#9B5CFF",
  text: "#F7E7C6",
  dim: "#9C7B5A",
  border: "#7A3F18",
  fog: "#4B3B35",
} as const;

export interface DungeonRoom {
  id: string;
  title: string;
  state: "done" | "active" | "locked" | "fog";
  boss: boolean;
}

export interface DungeonFloor {
  id: string;
  title: string;
  state: AtlasLevel["status"];
  rewards: string[];
  rooms: DungeonRoom[];
}

export function dungeonFloorsFromAtlas(levels: AtlasLevel[]): DungeonFloor[] {
  return levels.map((level) => ({
    id: level.id,
    title: level.title,
    state: level.status,
    rewards: level.rewards,
    rooms: level.quests.map((quest) => ({
      id: quest.id,
      title: quest.title,
      state: level.status === "teaser" ? "fog" : quest.state,
      boss: quest.boss,
    })),
  }));
}

export interface HeartState {
  hearts: number;
  teaching: string | null;
  approvalsDenied: number;
  blocked: number;
}

export const emptyHeartState = (): HeartState => ({ hearts: 3, teaching: null, approvalsDenied: 0, blocked: 0 });

export function reduceHearts(state: HeartState, event: HarnessEvent): HeartState {
  if (event.type === "quest.completed") return { ...state, hearts: 3, teaching: "ROOM CLEARED — hearts refill by torchlight." };
  if (event.type === "tool.approval.resolved" && !event.approved) {
    const hearts = Math.max(0, state.hearts - 1);
    return {
      ...state,
      hearts,
      approvalsDenied: state.approvalsDenied + 1,
      teaching: hearts === 0 ? "the dungeon humbles you — inspect the risk, then try again." : "a trap nicks your streak — denial taught the route.",
    };
  }
  if (event.type === "tool.blocked") {
    const hearts = Math.max(0, state.hearts - 1);
    return {
      ...state,
      hearts,
      blocked: state.blocked + 1,
      teaching: hearts === 0 ? "the dungeon humbles you — unlock the verb before forcing the door." : event.teaching,
    };
  }
  return state;
}

export function heartGlyphs(hearts: number): string {
  const full = Math.max(0, Math.min(3, hearts));
  return `${"♥".repeat(full)}${"♡".repeat(3 - full)}`;
}

export function dungeonEventLine(event: HarnessEvent): string | null {
  if (event.type === "quest.completed") return `ROOM CLEARED +${event.xp}xp · loot glints beyond ${event.questId}`;
  if (event.type === "unlock.applied") return `LOOT you picked up: ${event.tools.join(", ")}`;
  if (event.type === "tool.blocked") return `LOCKED DOOR ${event.tool}: ${event.teaching}`;
  if (event.type === "tool.approval.resolved" && !event.approved) return "TRAP DISARMED denial recorded; route annotated.";
  return null;
}

export function derivedTrials(scorecard: Scorecard | null, hearts: HeartState): Array<{ label: string; done: boolean }> {
  const denied = scorecard?.approvals.denied ?? hearts.approvalsDenied;
  const blocked = scorecard?.blocked ?? hearts.blocked;
  const totalTokens = (scorecard?.tokens.input ?? 0) + (scorecard?.tokens.output ?? 0);
  return [
    { label: "Silent traps: zero denials this crawl", done: denied === 0 },
    { label: "Clean lockpicks: no blocked tools", done: blocked === 0 },
    { label: "Light pack: stay under 25k tokens", done: totalTokens < 25_000 },
  ];
}

export function derivedTrophies(scorecard: Scorecard | null, floors: DungeonFloor[], hearts: HeartState): string[] {
  const trophies: string[] = [];
  if (floors.some((floor) => floor.rooms.some((room) => room.state === "done"))) trophies.push("First room torchlit");
  if (floors.some((floor) => floor.rewards.length > 0 && floor.state === "done")) trophies.push("First loot cache claimed");
  if (floors.some((floor) => floor.rooms.some((room) => room.boss && room.state === "done"))) trophies.push("Goodbye Greeter boss slain");
  if ((scorecard?.approvals.denied ?? hearts.approvalsDenied) > 0) trophies.push("Trap teach-back survived");
  if (trophies.length === 0) trophies.push("No trophies yet — enter the first room.");
  return trophies;
}
