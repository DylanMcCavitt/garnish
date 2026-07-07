/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard, useTimeline } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalDecision, EventBus, GateView, Scorecard, HarnessEvent } from "../../../harness/types";
import { activeAtlasQuest, buildAtlas, inferCompletedQuestIds, isAtlasBossQuest, nextLockedUnlock, unlockIdsFromTools } from "../../../game/atlas";
import { PIXEL_SPRITES } from "../../pixel-sprites";
import { PixelSpriteView } from "../../pixel";
import { emptyStatus, reduceStatus, type GameMoment, type StatusModel, momentFromEvent, decayMoments, emptyTranscript, reduceTranscript, type TranscriptEntry, type TranscriptModel, stepApprovalModal, type ApprovalModalState } from "../../index";
import { questHint, type QuestView } from "../../questlog";
import { DUNGEON_COLORS as C, derivedTrials, derivedTrophies, dungeonEventLine, dungeonFloorsFromAtlas, emptyHeartState, heartGlyphs, reduceHearts, type DungeonFloor, type HeartState } from "./model";

export interface ApprovalController {
  subscribe(subscriber: (state: ApprovalModalState | null) => void): () => void;
  resolve(decision: ApprovalDecision): void;
}

export interface DungeonAppOpts {
  bus: EventBus;
  send(text: string): void;
  abort(): void;
  gateViews(): GateView[];
  questView(): QuestView | null;
  scorecard(): Scorecard | null;
  progress?(): { xp: number; level: number };
  onExit(): void;
  approval: ApprovalController;
  meta?: { workspace: string; provider: string; model?: string };
}

const tabs = ["Quest", "Verbs", "Chronicle", "Treasury", "Trials", "Trophies"] as const;
type SatchelTab = (typeof tabs)[number];

const relevantViewEvents: Record<string, true> = {
  "quest.completed": true,
  "unlock.applied": true,
  "tool.blocked": true,
  "tool.approval.resolved": true,
  "assistant.end": true,
  "turn.end": true,
};

function compactPath(path: string | undefined): string {
  if (!path) return "unknown crypt";
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function tokenLabel(scorecard: Scorecard | null): string {
  const total = (scorecard?.tokens.input ?? 0) + (scorecard?.tokens.output ?? 0);
  return total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
}

function statusColor(status: StatusModel["status"]): string {
  if (status === "ERROR" || status === "ABORTED") return C.blood;
  if (status === "AWAITING APPROVAL") return C.purple;
  if (status === "RUNNING TOOL") return C.slime;
  if (status === "STREAMING") return C.amber;
  return C.dim;
}

function currentLevel(progress: DungeonAppOpts["progress"], scorecard: Scorecard | null): { level: number; xp: number } {
  const real = progress?.();
  if (real) return real;
  const xp = scorecard ? scorecard.diffBytes + scorecard.tokens.output : 0;
  return { level: Math.max(1, Math.floor(xp / 500) + 1), xp };
}

function MiniMap({ floors, frame }: { floors: DungeonFloor[]; frame: number }) {
  return (
    <box title="DUNGEON MAP" titleColor={C.amberBright} style={{ height: 5, border: true, borderColor: C.border, backgroundColor: C.panel, paddingLeft: 1, paddingRight: 1, flexDirection: "row", alignItems: "center" }}>
      {floors.map((floor, floorIndex) => (
        <box key={floor.id} style={{ flexDirection: "row", alignItems: "center", marginRight: 1 }}>
          <text fg={floor.state === "teaser" ? C.fog : floor.state === "done" ? C.slime : floor.state === "active" ? C.amber : C.dim}>{floorIndex + 1}F </text>
          {floor.rooms.map((room, roomIndex) => {
            const active = room.state === "active";
            const fg = room.state === "done" ? C.slime : active ? (frame % 2 === 0 ? C.amberBright : C.amber) : room.state === "fog" ? C.fog : C.dim;
            const label = room.state === "fog" ? "░░" : room.boss ? "B!" : `R${roomIndex + 1}`;
            return (
              <box key={room.id} style={{ flexDirection: "row", alignItems: "center" }}>
                <text fg={fg} attributes={active ? TextAttributes.BOLD : room.state === "locked" || room.state === "fog" ? TextAttributes.DIM : undefined}>[{label}]</text>
                {room.boss ? <PixelSpriteView sprite={PIXEL_SPRITES.emblemBoss} dim={room.state === "locked" || room.state === "fog"} /> : null}
                {roomIndex < floor.rooms.length - 1 ? <text fg={fg}>─</text> : null}
              </box>
            );
          })}
          {floorIndex < floors.length - 1 ? <text fg={floor.state === "done" ? C.amber : C.dim}> ⇵ </text> : null}
        </box>
      ))}
    </box>
  );
}

function DungeonTranscript({ model, roomEvents }: { model: TranscriptModel; roomEvents: string[] }) {
  const live: TranscriptEntry[] = [];
  if (model.thinkingDraft.trim()) live.push({ id: "thinking-live", kind: "thinking", title: "Torch smoke", body: model.thinkingDraft.slice(0, 120), tone: "dim" });
  if (model.assistantDraft) live.push({ id: "assistant-live", kind: "assistant", title: "Guide · echoing", body: model.assistantDraft, tone: "normal" });
  const entries = [...model.entries, ...live].slice(-24);
  const eventRows = roomEvents.slice(-6);
  return (
    <scrollbox title="Transcript / Room Echoes" titleColor={C.amber} stickyScroll stickyStart="bottom" style={{ border: true, borderColor: C.border, flexGrow: 1, paddingLeft: 1, paddingRight: 1, backgroundColor: C.bg }}>
      {entries.map((entry) => (
        <box key={entry.id} style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg={entry.kind === "user" ? C.amber : entry.kind === "blocked" ? C.blood : C.dim} attributes={entry.kind === "thinking" ? TextAttributes.DIM : undefined}>{entry.kind.padEnd(9, " ")} · {entry.title}</text>
          <text fg={entry.tone === "bad" ? C.blood : entry.tone === "good" || entry.tone === "accent" ? C.slime : entry.kind === "thinking" ? C.dim : C.text}>{entry.kind === "thinking" ? `torch smoke · ${entry.body}` : entry.body}</text>
        </box>
      ))}
      {eventRows.map((line, index) => (
        <box key={`${line}:${index}`} style={{ flexDirection: "row", marginBottom: 1 }}>
          <text fg={line.startsWith("LOOT") ? C.slime : line.startsWith("ROOM") ? C.amberBright : C.purple} attributes={TextAttributes.BOLD}>◆ </text>
          <text fg={line.startsWith("LOCKED") ? C.blood : C.amberBright}>{line}</text>
        </box>
      ))}
    </scrollbox>
  );
}

function Satchel({ open, tab, quest, gates, scorecard, moments, floors, hearts }: { open: boolean; tab: SatchelTab; quest: QuestView | null; gates: GateView[]; scorecard: Scorecard | null; moments: GameMoment[]; floors: DungeonFloor[]; hearts: HeartState }) {
  if (!open) return null;
  const visibleGates = gates.filter((gate) => gate.visibility !== "hidden");
  const unlockedTools = new Set(visibleGates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
  const loot = nextLockedUnlock(floors.map((floor) => ({ id: floor.id, title: floor.title, status: floor.state, rewards: floor.rewards, quests: floor.rooms.map((room) => ({ id: room.id, title: room.title, state: room.state === "fog" ? "locked" : room.state, boss: room.boss })) })), unlockedTools);
  const checksDone = quest?.checks.filter((check) => check.done).length ?? 0;
  return (
    <box title="SATCHEL  [1]Quest(scroll) [2]Verbs(gear) [3]Chronicle [4]Treasury [5]Trials [6]Trophies" titleColor={C.amberBright} style={{ width: "34%", minWidth: 42, border: true, borderColor: C.border, backgroundColor: C.panel, paddingLeft: 1, paddingRight: 1, flexDirection: "column" }}>
      <text fg={C.dim}>{tabs.map((name, index) => `${tab === name ? "▶" : " "}${index + 1}:${name}`).join("  ")}</text>
      {tab === "Quest" && (quest ? <box style={{ flexDirection: "column" }}>
        <text fg={isAtlasBossQuest(quest.id) ? C.blood : C.amberBright} attributes={TextAttributes.BOLD}>{isAtlasBossQuest(quest.id) ? "BOSS BANNER · " : "You enter: "}{quest.title}</text>
        <text fg={C.dim}>scroll {checksDone}/{quest.checks.length} · hint: {questHint(quest)}</text>
        {quest.checks.map((check, index) => <text key={`${check.line}:${index}`} fg={check.done ? C.slime : C.text}>{check.done ? "☑" : "☐"} {check.line}</text>)}
        {isAtlasBossQuest(quest.id) ? <box style={{ flexDirection: "row", marginTop: 1 }}><PixelSpriteView sprite={PIXEL_SPRITES.bossGoodbyeGreeter} /><text fg={C.blood} attributes={TextAttributes.BOLD}>  The Goodbye Greeter blocks the stair.</text></box> : null}
      </box> : <text fg={C.dim}>No active room. The torch waits.</text>)}
      {tab === "Verbs" && <box style={{ flexDirection: "column" }}>{visibleGates.map((gate) => <text key={gate.tool} fg={gate.visibility === "unlocked" ? C.slime : C.dim}>{gate.visibility === "unlocked" ? "⚙" : "🔒"} {gate.tool}{gate.visibility !== "unlocked" && gate.teaching ? ` — ${gate.teaching}` : ""}</text>)}</box>}
      {tab === "Chronicle" && <box style={{ flexDirection: "column" }}>{moments.length === 0 ? <text fg={C.dim}>No footfalls yet.</text> : moments.slice(-10).map((moment) => <text key={moment.id} fg={moment.color}>{moment.glyph} {moment.line}</text>)}<text fg={C.dim}>denials {scorecard?.approvals.denied ?? hearts.approvalsDenied} · blocks {scorecard?.blocked ?? hearts.blocked}</text></box>}
      {tab === "Treasury" && <box style={{ flexDirection: "column" }}><box style={{ flexDirection: "row", alignItems: "center" }}><PixelSpriteView sprite={PIXEL_SPRITES.emblemUnlock} /><text fg={C.slime} attributes={TextAttributes.BOLD}> Loot table</text></box>{floors.filter((floor) => floor.rewards.length > 0).map((floor) => <text key={floor.id} fg={floor.state === "done" ? C.slime : floor.state === "active" ? C.amber : C.dim}>{floor.state === "done" ? "picked up" : "sealed"}: {floor.rewards.join(", ")} · {floor.title}</text>)}<text fg={C.amber}>{loot ? `next cache: ${loot.rewards.join(", ")} in ${loot.levelTitle}` : "all visible loot claimed"}</text></box>}
      {tab === "Trials" && <box style={{ flexDirection: "column" }}>{derivedTrials(scorecard, hearts).map((trial) => <text key={trial.label} fg={trial.done ? C.slime : C.amber}>{trial.done ? "✓" : "◇"} {trial.label}</text>)}<text fg={C.dim}>{hearts.teaching ?? "The dungeon rewards careful routes, not speed alone."}</text></box>}
      {tab === "Trophies" && <box style={{ flexDirection: "column" }}>{derivedTrophies(scorecard, floors, hearts).map((trophy) => <text key={trophy} fg={trophy.includes("No trophies") ? C.dim : C.purple}>🏆 {trophy}</text>)}</box>}
    </box>
  );
}

function DungeonApprovalModal({ state }: { state: ApprovalModalState | null }) {
  if (!state) return null;
  const request = state.request;
  const risk = request.risk === "critical" || request.risk === "risky" ? C.blood : request.risk === "moderate" ? C.amber : C.slime;
  return (
    <box title="TRAP CHECK · approval gate" titleColor={risk} zIndex={20} style={{ position: "absolute", left: 8, right: 8, top: 6, height: 14, border: true, borderStyle: "double", borderColor: risk, paddingLeft: 2, paddingRight: 2, flexDirection: "column", backgroundColor: C.panelHot }}>
      <text fg={risk} attributes={TextAttributes.BOLD}>{request.risk.toUpperCase()} · {request.tool}</text>
      <text fg={C.text}>{request.command}</text>
      <text fg={C.dim}>{request.explanation}</text>
      <text fg={C.dim}>Pattern rune: {request.suggestedPattern ?? request.command}</text>
      {state.mode === "reason" ? <box title="Deny reason" titleColor={C.purple} style={{ height: 3, border: true, borderColor: C.purple, backgroundColor: C.bg }}><input focused placeholder="Why deny? Enter submits" value={state.reason} /></box> : <text fg={C.text}>[a]pprove once  [p]attern  [d]eny  [r]eason</text>}
      <text fg={C.dim}>Denials cost a heart of streak, then teach the safer route.</text>
    </box>
  );
}

function CommandInput({ status, input, setInput, focused, placeholder }: { status: StatusModel; input: string; setInput(value: string): void; focused: boolean; placeholder: string }) {
  return (
    <box style={{ height: 3, border: true, borderColor: statusColor(status.status), backgroundColor: C.panel, paddingLeft: 1, paddingRight: 1, flexDirection: "row", alignItems: "center" }}>
      <text fg={statusColor(status.status)} attributes={TextAttributes.BOLD}>{status.status} ▸ </text>
      <input focused={focused} placeholder={placeholder} value={input} onInput={setInput} />
    </box>
  );
}

export function DungeonApp(opts: DungeonAppOpts) {
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptModel>(() => emptyTranscript());
  const [quest, setQuest] = useState<QuestView | null>(() => opts.questView());
  const [gates, setGates] = useState<GateView[]>(() => opts.gateViews());
  const [scorecard, setScorecard] = useState<Scorecard | null>(() => opts.scorecard());
  const [modal, setModal] = useState<ApprovalModalState | null>(null);
  const [moments, setMoments] = useState<GameMoment[]>([]);
  const [status, setStatus] = useState<StatusModel>(() => emptyStatus());
  const [hearts, setHearts] = useState<HeartState>(() => emptyHeartState());
  const [roomEvents, setRoomEvents] = useState<string[]>([]);
  const [frame, setFrame] = useState(0);
  const [satchelOpen, setSatchelOpen] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  const timeline = useTimeline({ duration: 1000, loop: true });
  const timelineReady = useRef(false);
  const lastDecay = useRef(Date.now());
  if (!timelineReady.current) {
    timeline.add({}, { duration: 1000, loop: true, onUpdate: () => {
      setFrame((current) => current + 1);
      const now = Date.now();
      if (now - lastDecay.current >= 1000) {
        lastDecay.current = now;
        setMoments((current) => decayMoments(current));
      }
    } });
    timelineReady.current = true;
  }

  useEffect(() => opts.approval.subscribe(setModal), [opts.approval]);
  useEffect(() => opts.bus.subscribe((event: HarnessEvent) => {
    setTranscript((current) => reduceTranscript(current, event));
    setStatus((current) => reduceStatus(current, event));
    setHearts((current) => reduceHearts(current, event));
    const line = dungeonEventLine(event);
    if (line) setRoomEvents((current) => [...current.slice(-10), line]);
    const moment = momentFromEvent(event);
    if (moment) setMoments((current) => [...current.slice(-11), moment]);
    if (relevantViewEvents[event.type]) {
      setQuest(opts.questView());
      setGates(opts.gateViews());
      setScorecard(opts.scorecard());
    }
  }), [opts]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") { opts.onExit(); return; }
    if (modal) {
      if (modal.mode === "reason" && key.name !== "return" && key.name !== "escape") {
        if (key.name === "backspace") setModal((current) => current ? { ...current, reason: current.reason.slice(0, -1) } : current);
        else if (!key.ctrl && !key.meta && key.raw.length === 1) setModal((current) => current ? { ...current, reason: current.reason + key.raw } : current);
        return;
      }
      const modalKey = key.name === "return" ? "enter" : key.name === "escape" ? "escape" : key.name;
      if (["a", "p", "d", "r", "enter", "escape"].includes(modalKey)) {
        const step = stepApprovalModal(modal, { type: "key", key: modalKey as "a" | "p" | "d" | "r" | "enter" | "escape" });
        setModal(step.state);
        if (step.decision) opts.approval.resolve(step.decision);
      }
      return;
    }
    if (key.raw === "\\") { setSatchelOpen((current) => !current); return; }
    if (satchelOpen && input.length === 0) {
      if (key.raw >= "1" && key.raw <= "6") { setTabIndex(Number(key.raw) - 1); return; }
      if (key.raw === "]") { setTabIndex((current) => (current + 1) % tabs.length); return; }
      if (key.raw === "[") { setTabIndex((current) => (current + tabs.length - 1) % tabs.length); return; }
    }
    if (key.name === "escape") { opts.abort(); return; }
    if (key.name === "return" && input.trim()) { opts.send(input.trim()); setInput(""); }
  });

  const unlockedTools = new Set(gates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
  const atlasLevels = useMemo(() => buildAtlas({ completedQuests: inferCompletedQuestIds(quest?.id ?? null), unlockedIds: unlockIdsFromTools(unlockedTools), activeQuestId: quest?.id ?? null }), [gates, quest]);
  const floors = useMemo(() => dungeonFloorsFromAtlas(atlasLevels), [atlasLevels]);
  const activeRoom = activeAtlasQuest(atlasLevels);
  const level = currentLevel(opts.progress, scorecard);
  const provider = opts.meta?.model ? `${opts.meta.provider}/${opts.meta.model}` : opts.meta?.provider ?? "provider pending";
  const currentTab = tabs[tabIndex]!;
  const activeHint = questHint(quest);

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: C.bg }}>
      <box style={{ height: 3, flexDirection: "row", justifyContent: "space-between", backgroundColor: C.bg }}>
        <box style={{ width: 28, flexDirection: "column" }}><text fg={C.amberBright} attributes={TextAttributes.BOLD}>Garnish Dungeon</text><text fg={C.dim}>{compactPath(opts.meta?.workspace)}</text></box>
        <box style={{ flexGrow: 1, flexDirection: "column" }}><text fg={activeRoom?.boss ? C.blood : C.amber} attributes={TextAttributes.BOLD}>{activeRoom?.boss ? "BOSS BANNER" : "You enter"}: {activeRoom?.title ?? quest?.title ?? "Torchlit threshold"}</text><text fg={C.dim}>Satchel \\ collapse · [/] tabs · Enter send · Esc abort</text></box>
        <box style={{ width: 38, flexDirection: "column", alignItems: "flex-end" }}><text fg={hearts.hearts === 0 ? C.blood : C.amberBright}>HEARTS {heartGlyphs(hearts.hearts)} · LVL {level.level} · XP {level.xp}</text><text fg={C.dim}>TOK {tokenLabel(scorecard)} · {provider}</text></box>
      </box>
      <MiniMap floors={floors} frame={frame} />
      {hearts.teaching ? <box style={{ height: 1, flexDirection: "row", backgroundColor: C.panelHot, paddingLeft: 1 }}><text fg={hearts.hearts === 0 ? C.blood : C.amber}>{hearts.teaching}</text></box> : null}
      <box style={{ flexGrow: 1, flexDirection: "row" }}>
        <box style={{ width: satchelOpen ? "66%" : "100%", flexDirection: "column" }}><DungeonTranscript model={transcript} roomEvents={roomEvents} /></box>
        <Satchel open={satchelOpen} tab={currentTab} quest={quest} gates={gates} scorecard={scorecard} moments={moments} floors={floors} hearts={hearts} />
      </box>
      <CommandInput status={status} input={input} setInput={setInput} focused={modal === null} placeholder={`try: ${activeHint}`} />
      <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: C.bg }}><text fg={C.dim}>\\ Satchel · 1-6 tabs · [/] cycle · a/p/d/r approval · Ctrl+C quit</text></box>
      <DungeonApprovalModal state={modal} />
    </box>
  );
}
