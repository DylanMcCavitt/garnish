import type { GateView, HarnessEvent, Scorecard } from "../../../harness/types";
import { buildAtlas, inferCompletedQuestIds, nextLockedUnlock, unlockIdsFromTools, type AtlasLevel } from "../../../game/atlas";
import type { GameMoment } from "../../juice";
import type { QuestView } from "../../questlog";

export type DeckTabId = "quests" | "verbs" | "progress" | "unlocks" | "challenges" | "achievements";

export interface DeckTab {
  id: DeckTabId;
  number: string;
  label: string;
  icon: string;
}

export const expeditionTabs: DeckTab[] = [
  { id: "quests", number: "1", label: "Quests", icon: "◇" },
  { id: "verbs", number: "2", label: "Verbs", icon: "✦" },
  { id: "progress", number: "3", label: "Progress", icon: "▸" },
  { id: "unlocks", number: "4", label: "Unlocks", icon: "⬡" },
  { id: "challenges", number: "5", label: "Challenges", icon: "◆" },
  { id: "achievements", number: "6", label: "Achievements", icon: "★" },
];

export interface Achievement {
  id: string;
  label: string;
  earned: boolean;
  ts?: number;
}

export interface ChallengeChip {
  id: string;
  label: string;
  passed: boolean;
  progress: string;
}

export function xpBar(xp: number, width = 18): string {
  const boundedWidth = Math.max(1, width);
  const withinLevel = ((xp % 500) + 500) % 500;
  const eighths = Math.round((withinLevel / 500) * boundedWidth * 8);
  const glyphs = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
  let out = "";
  for (let cell = 0; cell < boundedWidth; cell += 1) {
    const fill = Math.max(0, Math.min(8, eighths - cell * 8));
    out += glyphs[fill] ?? " ";
  }
  return out;
}

export function atlasForExpedition(quest: QuestView | null, gates: GateView[]): AtlasLevel[] {
  const unlockedTools = new Set(gates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
  return buildAtlas({
    completedQuests: inferCompletedQuestIds(quest?.id ?? null),
    unlockedIds: unlockIdsFromTools(unlockedTools),
    activeQuestId: quest?.id ?? null,
  });
}

export function nextUnlockLabel(atlas: AtlasLevel[], gates: GateView[]): string {
  const unlockedTools = new Set(gates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
  const next = nextLockedUnlock(atlas, unlockedTools);
  return next ? `${next.rewards.join(" + ")} · ${next.levelTitle}` : "all current rewards online";
}

export function buildAchievements(events: HarnessEvent[], scorecard: Scorecard | null): Achievement[] {
  const firstUnlock = events.find((event) => event.type === "unlock.applied");
  const firstDeniedApproval = events.find((event) => event.type === "tool.approval.resolved" && !event.approved);
  const bossSlain = events.find((event) => event.type === "quest.completed" && event.questId === "fix-bug-prove-it");
  const firstEdit = events.find((event) => event.type === "file.edited");
  const approved = scorecard?.approvals.approved ?? 0;
  return [
    { id: "first-unlock", label: "First unlock routed", earned: Boolean(firstUnlock), ts: firstUnlock?.ts },
    { id: "first-edit", label: "First edit recorded", earned: Boolean(firstEdit), ts: firstEdit?.ts },
    { id: "approval-captain", label: "Approval captain", earned: approved > 0, ts: events.find((event) => event.type === "tool.approval.resolved" && event.approved)?.ts },
    { id: "teach-back", label: "Denial teach-back", earned: Boolean(firstDeniedApproval), ts: firstDeniedApproval?.ts },
    { id: "boss-slayer", label: "Boss slain", earned: Boolean(bossSlain), ts: bossSlain?.ts },
  ];
}

export function buildChallengeChips(scorecard: Scorecard | null, events: HarnessEvent[]): ChallengeChip[] {
  const denied = scorecard?.approvals.denied ?? 0;
  const blocked = scorecard?.blocked ?? 0;
  const totalTokens = (scorecard?.tokens.input ?? 0) + (scorecard?.tokens.output ?? 0);
  const editedFiles = events.filter((event) => event.type === "file.edited").length;
  const approvals = scorecard?.approvals.approved ?? 0;
  return [
    { id: "clean-comms", label: "Zero denials", passed: denied === 0, progress: `${denied} denied` },
    { id: "lean-burn", label: "Under 25k tokens", passed: totalTokens < 25_000, progress: `${totalTokens}/25000 tok` },
    { id: "no-doom-loops", label: "No blocked loops", passed: blocked === 0, progress: `${blocked} blocks` },
    { id: "ship-proof", label: "Edit + approval", passed: editedFiles > 0 && approvals > 0, progress: `${editedFiles} edits · ${approvals} ok` },
  ];
}

export function hiddenNewsTabs(active: DeckTabId, events: HarnessEvent[], achievements: Achievement[], previousEventCount: number, wasCollapsed: boolean): Partial<Record<DeckTabId, true>> {
  if (!wasCollapsed || events.length <= previousEventCount) return {};
  const newest = events.slice(previousEventCount);
  const news: Partial<Record<DeckTabId, true>> = {};
  if (newest.some((event) => event.type === "quest.completed" || event.type === "tool.blocked")) news.quests = true;
  if (newest.some((event) => event.type === "unlock.applied")) news.unlocks = true;
  if (newest.some((event) => event.type === "file.edited" || event.type === "tool.approval.resolved" || event.type === "error")) news.progress = true;
  if (achievements.some((achievement) => achievement.earned && newest.some((event) => event.ts === achievement.ts))) news.achievements = true;
  delete news[active];
  return news;
}

export function toastFromMoment(moment: GameMoment | undefined, achievements: Achievement[]): string | null {
  const earned = achievements.find((achievement) => achievement.earned && achievement.ts && moment?.line.includes("quest complete"));
  if (earned) return `★ ACHIEVEMENT · ${earned.label}`;
  if (!moment || moment.ttl <= 10) return null;
  return `${moment.glyph} ${moment.line}`;
}
