/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import type { GateView, Scorecard } from "../harness/types";
import { TUI_DIM, TUI_ORANGE, TUI_PANEL, TUI_RED, TUI_TEXT, type GameMoment } from "./juice";

export const HINTS: Record<string, string> = {
  "mise-en-place": "What's my quest?",
  "look-around": "Look around",
  "first-edit": "Record the first edit",
  "fix-bug-prove-it": "Fix the greeter and prove it",
};

export function questHint(quest: QuestView | null): string {
  return quest === null ? "What's my quest?" : HINTS[quest.id] ?? "What's my quest?";
}

export interface QuestView {
  id: string;
  title: string;
  checks: Array<{ line: string; done: boolean }>;
}

function GateRow({ gate }: { gate: GateView }) {
  if (gate.visibility === "hidden") return null;
  const unlocked = gate.visibility === "unlocked";
  return (
    <text fg={unlocked ? TUI_ORANGE : TUI_DIM} attributes={unlocked ? TextAttributes.BOLD : TextAttributes.DIM}>
      {unlocked ? "●" : "◌ 🔒"} {gate.tool}{gate.teaching && !unlocked ? ` — ${gate.teaching}` : ""}
    </text>
  );
}

export function missionLevel(scorecard: Scorecard | null): { level: number; xp: number } {
  const xp = scorecard ? scorecard.diffBytes + scorecard.tokens.output : 0;
  return { level: Math.max(1, Math.floor(xp / 500) + 1), xp };
}

export function QuestLog({ quest, gates, scorecard, moments, flash }: { quest: QuestView | null; gates: GateView[]; scorecard: Scorecard | null; moments: GameMoment[]; flash: boolean }) {
  const checksDone = quest?.checks.filter((check) => check.done).length ?? 0;
  const checksTotal = quest?.checks.length ?? 0;
  const visibleGates = gates.filter((gate) => gate.visibility !== "hidden");
  const unlocked = visibleGates.filter((gate) => gate.visibility === "unlocked").length;
  const newestMoment = moments.at(-1);

  return (
    <box style={{ width: "35%", minWidth: 34, flexDirection: "column" }}>
      <box title={`Quest ${checksDone}/${checksTotal}`} titleColor={flash ? TUI_ORANGE : TUI_DIM} style={{ border: true, paddingLeft: 1, paddingRight: 1, flexDirection: "column", minHeight: 8, backgroundColor: TUI_PANEL }}>
        {quest ? (
          <>
            <text fg={TUI_ORANGE} attributes={TextAttributes.BOLD}>{quest.title}</text>
            {quest.checks.map((check, index) => (
              <text key={`${check.line}:${index}`} fg={check.done ? TUI_ORANGE : TUI_TEXT}>
                {check.done ? "☑" : "☐"} {check.line}
              </text>
            ))}
            <text fg={TUI_DIM}>NEXT UP {questHint(quest)}</text>
          </>
        ) : (
          <text fg={TUI_DIM}>No active quest</text>
        )}
      </box>
      <box title={`Verbs ${unlocked}/${visibleGates.length}`} titleColor={flash ? TUI_ORANGE : TUI_DIM} style={{ border: true, paddingLeft: 1, paddingRight: 1, flexDirection: "column", minHeight: 7, backgroundColor: TUI_PANEL }}>
        {visibleGates.map((gate) => <GateRow key={gate.tool} gate={gate} />)}
      </box>
      <box title="Progress Log" titleColor={flash ? TUI_ORANGE : TUI_DIM} style={{ border: true, paddingLeft: 1, paddingRight: 1, flexDirection: "column", flexGrow: 1, backgroundColor: TUI_PANEL }}>
        {moments.length === 0 ? <text fg={TUI_DIM}>Waiting for game moments…</text> : null}
        {moments.slice(-9).map((moment) => (
          <text key={moment.id} fg={moment.color}>{moment.glyph} {moment.line}</text>
        ))}
        {newestMoment && newestMoment.ttl > 10 ? <text fg={TUI_ORANGE}>● pulse · {newestMoment.line}</text> : null}
      </box>
      <box style={{ height: 1, flexDirection: "row", justifyContent: "space-between" }}>
        <text fg={TUI_DIM}>OK {scorecard?.approvals.approved ?? 0} · NO {scorecard?.approvals.denied ?? 0}</text>
        <text fg={(scorecard?.blocked ?? 0) > 0 ? TUI_RED : TUI_DIM}>blocks {scorecard?.blocked ?? 0}</text>
      </box>
    </box>
  );
}
