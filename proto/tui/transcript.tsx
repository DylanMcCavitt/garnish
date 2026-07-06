/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import type { HarnessEvent } from "../harness/types";
import { TUI_DIM, TUI_ORANGE, TUI_RED, TUI_TEXT } from "./juice";

export type TranscriptEntryKind =
  | "user"
  | "assistant"
  | "thinking"
  | "tool"
  | "blocked"
  | "file"
  | "celebration"
  | "system";

export interface TranscriptEntry {
  id: string;
  kind: TranscriptEntryKind;
  title: string;
  body: string;
  tone?: "normal" | "dim" | "good" | "warn" | "bad" | "accent";
}

export interface TranscriptModel {
  entries: TranscriptEntry[];
  assistantDraft: string;
  thinkingDraft: string;
  toolInputs: Record<string, string>;
}

export const emptyTranscript = (): TranscriptModel => ({
  entries: [],
  assistantDraft: "",
  thinkingDraft: "",
  toolInputs: {},
});

const MAX_ENTRIES = 80;

function pushEntry(model: TranscriptModel, entry: TranscriptEntry): TranscriptModel {
  const entries = [...model.entries, entry].slice(-MAX_ENTRIES);
  return { ...model, entries };
}

function compact(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function preview(text: string, max = 180): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

export function reduceTranscript(model: TranscriptModel, event: HarnessEvent): TranscriptModel {
  switch (event.type) {
    case "message.user":
      return pushEntry(model, {
        id: event.id,
        kind: "user",
        title: `PLAYER · ${event.source}`,
        body: event.text,
        tone: "accent",
      });
    case "assistant.delta":
      return { ...model, assistantDraft: model.assistantDraft + event.text };
    case "assistant.thinking.delta":
      return { ...model, thinkingDraft: model.thinkingDraft + event.text };
    case "assistant.end": {
      let next = model;
      if (model.thinkingDraft.trim()) {
        next = pushEntry(next, {
          id: `${event.id}:thinking`,
          kind: "thinking",
          title: "thinking",
          body: preview(model.thinkingDraft, 120),
          tone: "dim",
        });
      }
      const body = model.assistantDraft.trim() || event.message.text || "(assistant turn ended)";
      next = pushEntry(next, {
        id: event.id,
        kind: "assistant",
        title: "ASSISTANT",
        body,
      });
      return { ...next, assistantDraft: "", thinkingDraft: "" };
    }
    case "tool.call":
      return pushEntry(
        { ...model, toolInputs: { ...model.toolInputs, [event.callId]: compact(event.input) } },
        {
          id: event.id,
          kind: "tool",
          title: `TOOL CALL · ${event.tool}`,
          body: preview(compact(event.input), 140),
          tone: "dim",
        },
      );
    case "tool.approval.requested":
      return pushEntry(model, {
        id: event.id,
        kind: "tool",
        title: `APPROVAL · ${event.tool}`,
        body: `${event.risk.toUpperCase()} ${event.command ?? ""}\n${event.explanation}`.trim(),
        tone: event.risk === "critical" || event.risk === "risky" ? "warn" : "accent",
      });
    case "tool.approval.resolved":
      return pushEntry(model, {
        id: event.id,
        kind: "tool",
        title: `APPROVAL ${event.approved ? "APPROVED" : "DENIED"}`,
        body: event.reason ?? event.pattern ?? event.mode,
        tone: event.approved ? "accent" : "bad",
      });
    case "tool.blocked":
      return pushEntry(model, {
        id: event.id,
        kind: "blocked",
        title: `TEACHING BLOCK · ${event.tool}`,
        body: event.teaching,
        tone: "bad",
      });
    case "tool.result":
      return pushEntry(model, {
        id: event.id,
        kind: "tool",
        title: `${event.isError ? "TOOL ERROR" : "TOOL OUTPUT"} · ${event.tool}`,
        body: preview(event.output, 220),
        tone: event.isError ? "bad" : "normal",
      });
    case "file.edited":
      return pushEntry(model, {
        id: event.id,
        kind: "file",
        title: `FILE ${event.kind.toUpperCase()} · ${event.path}`,
        body: `+ ${event.summary}`,
        tone: "accent",
      });
    case "quest.completed":
      return pushEntry(model, {
        id: event.id,
        kind: "celebration",
        title: "★ QUEST COMPLETE",
        body: `${event.questId} · +${event.xp} XP`,
        tone: "accent",
      });
    case "unlock.applied":
      return pushEntry(model, {
        id: event.id,
        kind: "celebration",
        title: "🔓 NEW VERB",
        body: event.tools.join(", "),
        tone: "accent",
      });
    case "error":
      return pushEntry(model, { id: event.id, kind: "system", title: "ERROR", body: event.message, tone: "bad" });
    case "session.start":
      return pushEntry(model, {
        id: event.id,
        kind: "system",
        title: "SESSION",
        body: `${event.provider}${event.model ? `/${event.model}` : ""} in ${event.workspace}`,
        tone: "dim",
      });
    default:
      return model;
  }
}

const colors: Record<NonNullable<TranscriptEntry["tone"]>, string> = {
  normal: TUI_TEXT,
  dim: TUI_DIM,
  good: TUI_ORANGE,
  warn: TUI_ORANGE,
  bad: TUI_RED,
  accent: TUI_ORANGE,
};

function prefix(entry: TranscriptEntry): string {
  if (entry.kind === "tool") return "◇";
  if (entry.kind === "file") return "Δ";
  if (entry.kind === "blocked") return "⛔";
  if (entry.kind === "celebration") return "★";
  if (entry.kind === "thinking") return "…";
  return "";
}

function renderBody(entry: TranscriptEntry): string {
  if (entry.kind === "thinking") return `dim signal · ${entry.body}`;
  if (entry.kind === "blocked") return `red lesson · ${entry.body}`;
  return entry.body;
}

export function Transcript({ model }: { model: TranscriptModel }) {
  const live: TranscriptEntry[] = [];
  if (model.thinkingDraft.trim()) {
    live.push({ id: "thinking-live", kind: "thinking", title: "thinking…", body: preview(model.thinkingDraft, 120), tone: "dim" });
  }
  if (model.assistantDraft) {
    live.push({ id: "assistant-live", kind: "assistant", title: "ASSISTANT STREAM", body: model.assistantDraft, tone: "normal" });
  }
  const rows = [...model.entries, ...live].slice(-30);

  return (
    <scrollbox title="Transcript" titleColor={TUI_DIM} stickyScroll stickyStart="bottom" style={{ border: true, flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      {rows.map((entry) => (
        <box key={entry.id} style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg={colors[entry.tone ?? "normal"]} attributes={entry.kind === "thinking" ? TextAttributes.DIM : undefined}>
            {prefix(entry)} {entry.title}
          </text>
          <text fg={entry.kind === "thinking" ? TUI_DIM : colors[entry.tone ?? "normal"]}>{renderBody(entry)}</text>
        </box>
      ))}
    </scrollbox>
  );
}
