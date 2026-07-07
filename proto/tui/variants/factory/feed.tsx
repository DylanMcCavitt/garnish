/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import type { TranscriptEntry, TranscriptModel } from "../../transcript";
import { FACTORY_THEME, theme } from "./factory-theme";

export type FeedBadge = "YOU" | "SPRIG" | "BELT" | "TOOL" | "SYS";
export type FeedTone = "normal" | "dim" | "good" | "warn" | "bad" | "accent";

export interface FeedLineModel {
  badge: FeedBadge;
  title: string;
  body: string;
  gutter: string;
  tone: FeedTone;
  card: boolean;
}

const BADGE_COLORS: Record<FeedBadge, { fg: string; bg?: string }> = {
  YOU: { fg: FACTORY_THEME.bg, bg: FACTORY_THEME.cyan },
  SPRIG: { fg: FACTORY_THEME.bg, bg: FACTORY_THEME.copper },
  BELT: { fg: FACTORY_THEME.bg, bg: FACTORY_THEME.purple },
  TOOL: { fg: FACTORY_THEME.text, bg: FACTORY_THEME.grid },
  SYS: { fg: FACTORY_THEME.dim },
};

const TONE_COLORS: Record<FeedTone, string> = {
  normal: FACTORY_THEME.text,
  dim: FACTORY_THEME.dim,
  good: FACTORY_THEME.green,
  warn: FACTORY_THEME.amber,
  bad: FACTORY_THEME.red,
  accent: FACTORY_THEME.copper,
};

function preview(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function afterMarker(value: string, marker: string): string {
  const index = value.indexOf(marker);
  return index === -1 ? value : value.slice(index + marker.length).trim();
}

function userBadge(entry: TranscriptEntry): FeedBadge {
  if (entry.title.endsWith("· tutor")) return "SPRIG";
  if (entry.title.endsWith("· steering")) return "BELT";
  return "YOU";
}

function toolCard(entry: TranscriptEntry): string {
  if (entry.title.startsWith("Tool · ")) {
    const tool = afterMarker(entry.title, "Tool · ");
    return `⚙ ${tool}${entry.body.trim() ? `  ${preview(entry.body)}` : ""}`;
  }
  if (entry.title.startsWith("Tool output · ")) {
    const tool = afterMarker(entry.title, "Tool output · ");
    return `⚙ ${tool} output  ${preview(entry.body, 160)}`;
  }
  if (entry.title.startsWith("Tool error · ")) {
    const tool = afterMarker(entry.title, "Tool error · ");
    return `⚙ ${tool} error  ${preview(entry.body, 160)}`;
  }
  if (entry.title.startsWith("Approval · approved")) return entry.body && !["once", "auto"].includes(entry.body) ? `⚿ approved · pattern ${entry.body}` : `⚿ approved · ${entry.body || "once"}`;
  if (entry.title.startsWith("Approval · denied")) return `⚿ denied${entry.body ? ` · ${entry.body}` : ""}`;
  if (entry.title.startsWith("Approval · ")) return `⚿ ${afterMarker(entry.title, "Approval · ")}  ${preview(entry.body, 160)}`;
  if (entry.title.startsWith("File ")) return `⚙ ${entry.title}  ${preview(entry.body, 160)}`;
  return `⚙ ${entry.title}${entry.body ? `  ${preview(entry.body, 160)}` : ""}`;
}

export function feedLine(entry: TranscriptEntry): FeedLineModel {
  if (entry.kind === "tool" || entry.kind === "file") {
    const approved = entry.title.startsWith("Approval · approved");
    const denied = entry.title.startsWith("Approval · denied");
    return {
      badge: "TOOL",
      title: entry.title,
      body: toolCard(entry),
      gutter: denied || entry.tone === "bad" ? FACTORY_THEME.red : approved ? FACTORY_THEME.green : FACTORY_THEME.copper,
      tone: denied ? "bad" : approved ? "good" : entry.tone ?? "dim",
      card: true,
    };
  }

  if (entry.kind === "blocked") {
    return {
      badge: "TOOL",
      title: entry.title,
      body: `lesson · ${entry.body}`,
      gutter: FACTORY_THEME.red,
      tone: "bad",
      card: true,
    };
  }

  if (entry.kind === "assistant") {
    return { badge: "SPRIG", title: entry.title, body: entry.body, gutter: FACTORY_THEME.copper, tone: entry.tone ?? "normal", card: false };
  }

  if (entry.kind === "user") {
    if (entry.body.startsWith("SYSTEM:")) {
      return { badge: "SYS", title: entry.title, body: entry.body.slice("SYSTEM:".length).trim(), gutter: FACTORY_THEME.dim, tone: "dim", card: false };
    }
    const badge = userBadge(entry);
    return { badge, title: entry.title, body: entry.body, gutter: badge === "YOU" ? FACTORY_THEME.cyan : badge === "BELT" ? FACTORY_THEME.purple : FACTORY_THEME.copper, tone: entry.tone ?? "accent", card: false };
  }

  if (entry.kind === "thinking") {
    return { badge: "SYS", title: entry.title, body: `signal · ${entry.body}`, gutter: FACTORY_THEME.dim, tone: "dim", card: false };
  }

  if (entry.kind === "celebration") {
    return { badge: "SYS", title: entry.title, body: entry.body, gutter: FACTORY_THEME.green, tone: "good", card: false };
  }

  return { badge: "SYS", title: entry.title, body: entry.body, gutter: entry.tone === "bad" ? FACTORY_THEME.red : FACTORY_THEME.dim, tone: entry.tone ?? "dim", card: false };
}

function liveEntries(model: TranscriptModel): TranscriptEntry[] {
  const live: TranscriptEntry[] = [];
  if (model.thinkingDraft.trim()) {
    live.push({ id: "thinking-live", kind: "thinking", title: "Thinking…", body: preview(model.thinkingDraft, 120), tone: "dim" });
  }
  if (model.assistantDraft) {
    live.push({ id: "assistant-live", kind: "assistant", title: "SPRIG · streaming", body: model.assistantDraft, tone: "normal" });
  }
  return live;
}

function bodyLines(body: string): string[] {
  const lines = body.split("\n");
  return lines.length === 0 ? [""] : lines;
}

function FeedEntry({ entry }: { entry: TranscriptEntry }) {
  const line = feedLine(entry);
  const badge = BADGE_COLORS[line.badge];
  const bodyColor = line.card && line.body.startsWith("⚿ approved · pattern") ? FACTORY_THEME.amber : line.card && line.body.startsWith("⚿ approved") ? FACTORY_THEME.green : line.card && line.body.startsWith("⚿ denied") ? FACTORY_THEME.red : TONE_COLORS[line.tone];
  const titleColor = line.badge === "SYS" ? FACTORY_THEME.dim : FACTORY_THEME.text;

  return (
    <box style={{ flexDirection: "column", marginBottom: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={line.gutter}>▍</text>
        <text fg={badge.fg} bg={badge.bg} attributes={TextAttributes.BOLD}> {line.badge.padEnd(5, " ")} </text>
        <text fg={titleColor} attributes={line.card ? undefined : TextAttributes.BOLD}> {line.card ? line.body : ""}</text>
      </box>
      {line.card ? null : bodyLines(line.body).map((row, index) => (
        <text key={`${entry.id}:body:${index}`} fg={entry.kind === "celebration" && index > 0 ? FACTORY_THEME.amber : bodyColor}>  {row || " "}</text>
      ))}
    </box>
  );
}

export function FactoryFeed({ model }: { model: TranscriptModel }) {
  const rows = [...model.entries, ...liveEntries(model)].slice(-30);
  return (
    <scrollbox title="Factory Feed" titleColor={theme.dim} stickyScroll stickyStart="bottom" style={{ border: true, borderColor: theme.border, flexGrow: 1, paddingLeft: 1, paddingRight: 1, backgroundColor: theme.panelAlt }}>
      {rows.map((entry) => <FeedEntry key={entry.id} entry={entry} />)}
    </scrollbox>
  );
}
