import type { HarnessEvent, Scorecard } from "../../../harness/types";

export interface ComboState {
  chain: number;
  multiplier: number;
  peak: number;
  breakText: string | null;
}

export const emptyCombo = (): ComboState => ({ chain: 0, multiplier: 1, peak: 0, breakText: null });

export function reduceCombo(state: ComboState, event: HarnessEvent): ComboState {
  if (event.type === "tool.result") {
    if (event.isError) return breakCombo(state, `${event.tool} ERROR`);
    const chain = state.chain + 1;
    const multiplier = Math.min(8, Math.max(1, Math.floor(chain / 2) + 1));
    return { chain, multiplier, peak: Math.max(state.peak, multiplier), breakText: null };
  }
  if (event.type === "tool.blocked") return breakCombo(state, `${event.reason.toUpperCase()} BLOCK`);
  if (event.type === "tool.approval.resolved" && !event.approved) return breakCombo(state, "DENIAL BREAK");
  if (event.type === "error") return breakCombo(state, "SYSTEM ERROR");
  return state;
}

function breakCombo(state: ComboState, reason: string): ComboState {
  return {
    chain: 0,
    multiplier: 1,
    peak: state.peak,
    breakText: state.chain > 0 || state.multiplier > 1 ? `COMBO BREAK · ${reason}` : reason,
  };
}

export interface ArcadeScore {
  xpBase: number;
  xpScore: number;
  efficiencyBonus: number;
  total: number;
  tokens: number;
}

export function arcadeScore(scorecard: Scorecard | null, progress?: { xp: number; level: number }): ArcadeScore {
  const tokens = scorecard ? scorecard.tokens.input + scorecard.tokens.output : 0;
  const xpBase = progress?.xp ?? (scorecard ? scorecard.diffBytes + scorecard.tokens.output : 0);
  const approvalPenalty = scorecard ? scorecard.approvals.denied * 3_000 + scorecard.blocked * 5_000 : 0;
  const efficiencyBonus = Math.max(0, 50_000 - tokens - approvalPenalty);
  const xpScore = xpBase * 1_000;
  return { xpBase, xpScore, efficiencyBonus, total: xpScore + efficiencyBonus, tokens };
}

export interface RankBreakdown {
  rank: "S" | "A" | "B" | "C";
  tokenLine: string;
  timeLine: string;
  approvalLine: string;
  comboLine: string;
  points: number;
}

export function rankQuest(scorecard: Scorecard | null, comboPeak: number): RankBreakdown {
  const tokens = scorecard ? scorecard.tokens.input + scorecard.tokens.output : 0;
  const wallSeconds = scorecard ? Math.round(scorecard.wallTimeMs / 1000) : 0;
  const approvals = scorecard ? scorecard.approvals.approved + scorecard.approvals.denied : 0;
  const denied = scorecard?.approvals.denied ?? 0;
  const blocked = scorecard?.blocked ?? 0;

  const tokenPoints = tokens <= 25_000 ? 2 : tokens <= 45_000 ? 1 : 0;
  const timePoints = wallSeconds <= 180 ? 2 : wallSeconds <= 360 ? 1 : 0;
  const approvalPoints = denied === 0 && blocked === 0 ? 2 : denied <= 1 && blocked === 0 ? 1 : 0;
  const comboPoints = comboPeak >= 4 ? 2 : comboPeak >= 2 ? 1 : 0;
  const points = tokenPoints + timePoints + approvalPoints + comboPoints;
  const rank = points >= 7 ? "S" : points >= 5 ? "A" : points >= 3 ? "B" : "C";

  return {
    rank,
    points,
    tokenLine: `TOKENS ${tokens} <=25k +2 / <=45k +1 => +${tokenPoints}`,
    timeLine: `TIME ${wallSeconds}s <=180s +2 / <=360s +1 => +${timePoints}`,
    approvalLine: `JUDGMENT ${approvals} approvals, ${denied} denied, ${blocked} blocks => +${approvalPoints}`,
    comboLine: `COMBO PEAK x${comboPeak || 1} >=x4 +2 / >=x2 +1 => +${comboPoints}`,
  };
}

export function rankMedal(rank: RankBreakdown["rank"]): string {
  if (rank === "S") return "★ S-RANK";
  if (rank === "A") return "◆ A-RANK";
  if (rank === "B") return "● B-RANK";
  return "○ C-RANK";
}
