/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import type { ApprovalDecision, ApprovalRequest, RiskTier } from "../harness/types";
import { TUI_BG, TUI_DIM, TUI_ORANGE, TUI_RED, TUI_TEXT } from "./juice";

export interface ApprovalModalState {
  request: ApprovalRequest;
  reason: string;
  mode: "menu" | "reason";
}

export type ModalAction =
  | { type: "key"; key: "a" | "p" | "d" | "r" | "enter" | "escape" }
  | { type: "reason"; value: string };

export interface ModalStep {
  state: ApprovalModalState | null;
  decision?: ApprovalDecision;
}

export function stepApprovalModal(state: ApprovalModalState, action: ModalAction): ModalStep {
  if (action.type === "reason") return { state: { ...state, reason: action.value } };
  if (action.key === "escape") return { state: null, decision: { approved: false, mode: "deny" } };
  if (state.mode === "reason") {
    if (action.key === "enter") {
      return { state: null, decision: { approved: false, mode: "deny-with-reason", reason: state.reason.trim() || "No reason provided." } };
    }
    return { state };
  }
  if (action.key === "a") return { state: null, decision: { approved: true, mode: "once" } };
  if (action.key === "p") {
    return {
      state: null,
      decision: { approved: true, mode: "pattern", pattern: state.request.suggestedPattern ?? state.request.command },
    };
  }
  if (action.key === "d") return { state: null, decision: { approved: false, mode: "deny" } };
  if (action.key === "r") return { state: { ...state, mode: "reason" } };
  return { state };
}

export const riskColors: Record<RiskTier, string> = {
  safe: TUI_ORANGE,
  moderate: TUI_ORANGE,
  risky: "#FF9F43",
  critical: TUI_RED,
};

export function ApprovalModal({ state }: { state: ApprovalModalState | null }) {
  if (!state) return null;
  const request = state.request;
  const pattern = request.suggestedPattern ?? request.command;
  return (
    <box
      title="Approval needed"
      titleColor={riskColors[request.risk]}
      zIndex={20}
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        top: 4,
        height: 13,
        border: true,
        borderStyle: "double",
        paddingLeft: 2,
        paddingRight: 2,
        flexDirection: "column",
        backgroundColor: TUI_BG,
      }}
    >
      <text fg={riskColors[request.risk]} attributes={TextAttributes.BOLD}>{`${request.risk.toUpperCase()} · ${request.tool}`}</text>
      <text fg={TUI_TEXT}>{request.command}</text>
      <text fg={TUI_ORANGE}>{request.explanation}</text>
      <text fg={TUI_DIM}>{`Pattern: ${pattern}`}</text>
      {state.mode === "reason" ? (
        <box title="Reason" titleColor={TUI_DIM} style={{ border: true, height: 3 }}>
          <input focused placeholder="Why deny? Enter submits" value={state.reason} />
        </box>
      ) : (
        <text fg={TUI_TEXT}>[a]pprove once  [p]attern  [d]eny  [r]eason</text>
      )}
    </box>
  );
}
