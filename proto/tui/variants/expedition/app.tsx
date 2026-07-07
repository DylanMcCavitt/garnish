/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard, useTimeline } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalDecision, EventBus, GateView, HarnessEvent, Scorecard } from "../../../harness/types";
import { activeAtlasQuest, isAtlasBossQuest } from "../../../game/atlas";
import { PIXEL_SPRITES } from "../../pixel-sprites";
import { PixelSpriteView } from "../../pixel";
import { Transcript, emptyTranscript, reduceTranscript, type TranscriptModel } from "../../transcript";
import { decayMoments, emptyStatus, momentFromEvent, reduceStatus, type GameMoment, type MissionStatus, type StatusModel } from "../../juice";
import { missionLevel, questHint, type QuestView } from "../../questlog";
import { riskColors, stepApprovalModal, type ApprovalModalState } from "../../modal";
import type { StartTuiOpts } from "../../index";
import { atlasForExpedition, buildAchievements, buildChallengeChips, expeditionTabs, hiddenNewsTabs, nextUnlockLabel, toastFromMoment, xpBar, type DeckTabId } from "./model";

const c = {
  bg: "#07111F",
  panel: "#0B1B2E",
  panel2: "#10243A",
  line: "#1B4161",
  cyan: "#22D3EE",
  cyan2: "#67E8F9",
  amber: "#FFB86B",
  coral: "#FF6B6B",
  mint: "#5FFFB1",
  magenta: "#F472D0",
  text: "#E6F6FF",
  dim: "#7DA3B8",
  danger: "#FF4D7D",
};

export interface ApprovalController {
  subscribe(fn: (state: ApprovalModalState | null) => void): () => void;
  resolve(decision: ApprovalDecision): void;
}

interface ExpeditionAppOpts extends StartTuiOpts {
  approval: ApprovalController;
}

const statusColors: Record<MissionStatus, string> = {
  "AWAITING INPUT": c.cyan2,
  STREAMING: c.cyan,
  "RUNNING TOOL": c.amber,
  "AWAITING APPROVAL": c.magenta,
  ABORTED: c.danger,
  ERROR: c.danger,
};

const relevantViewEvents: Record<string, true> = {
  "session.start": true,
  "turn.end": true,
  "tool.blocked": true,
  "tool.result": true,
  "tool.approval.resolved": true,
  "file.edited": true,
  "quest.completed": true,
  "unlock.applied": true,
  error: true,
};

function tokenLabel(scorecard: Scorecard | null): string {
  const total = (scorecard?.tokens.input ?? 0) + (scorecard?.tokens.output ?? 0);
  return total >= 1000 ? `${Math.round(total / 100) / 10}k` : `${total}`;
}

function workspaceLabel(path: string | undefined): string {
  if (!path) return "workspace pending";
  const leaf = path.split("/").filter(Boolean).at(-1) ?? path;
  return leaf.length > 24 ? `…${leaf.slice(-23)}` : leaf;
}

function fmtTime(ts: number | undefined): string {
  if (!ts) return "--:--";
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function Header({ meta, level, scorecard, flash }: { meta: StartTuiOpts["meta"]; level: { level: number; xp: number }; scorecard: Scorecard | null; flash: boolean }) {
  const provider = meta?.model ? `${meta.provider}/${meta.model}` : meta?.provider ?? "provider pending";
  return (
    <box style={{ height: 4, flexDirection: "row", backgroundColor: c.bg, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ width: 14, flexDirection: "column" }}>
        <PixelSpriteView sprite={PIXEL_SPRITES.sprigIdle} />
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text fg={flash ? c.magenta : c.cyan} attributes={TextAttributes.BOLD}>✦ EXPEDITION CONTROL · {workspaceLabel(meta?.workspace)}</text>
        <text fg={c.dim}>{provider}</text>
        <text fg={c.line}>deck: 1-6 tabs · [ ] cycle · \ collapse · Enter send · Esc abort</text>
      </box>
      <box style={{ width: 38, flexDirection: "column", alignItems: "flex-end" }}>
        <text fg={c.text} attributes={TextAttributes.BOLD}>LVL {level.level}  XP {level.xp}  TOK {tokenLabel(scorecard)}</text>
        <text fg={c.cyan}>▕{xpBar(level.xp, 24)}▏</text>
        <text fg={c.dim}>OK {scorecard?.approvals.approved ?? 0} · NO {scorecard?.approvals.denied ?? 0} · BLK {scorecard?.blocked ?? 0}</text>
      </box>
    </box>
  );
}

function ObjectiveStrip({ quest, gates }: { quest: QuestView | null; gates: GateView[] }) {
  const atlas = atlasForExpedition(quest, gates);
  const active = activeAtlasQuest(atlas);
  const label = active?.boss || (quest && isAtlasBossQuest(quest.id)) ? "BOSS VECTOR" : "OBJECTIVE";
  const title = active?.title ?? quest?.title ?? "All current quests complete";
  const hint = active?.hint ?? questHint(quest);
  return (
    <box style={{ height: 2, flexDirection: "column", backgroundColor: c.panel2, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={label === "BOSS VECTOR" ? c.coral : c.amber} attributes={TextAttributes.BOLD}>{label} ▸ </text>
        <text fg={c.text}>{title}</text>
        <text fg={c.dim}>  NEXT UP </text>
        <text fg={c.cyan}>{hint}</text>
      </box>
    </box>
  );
}

function TabBar({ active, flash }: { active: DeckTabId; flash: boolean }) {
  return (
    <box style={{ height: 2, flexDirection: "column" }}>
      <box style={{ flexDirection: "row" }}>
        {expeditionTabs.map((tab) => {
          const selected = tab.id === active;
          return <text key={tab.id} fg={selected ? (flash ? c.magenta : c.bg) : c.dim} bg={selected ? c.cyan : undefined} attributes={selected ? TextAttributes.BOLD : undefined}>[{tab.number}]{tab.label} </text>;
        })}
      </box>
      <text fg={c.line}>────────────────────────────────────────────</text>
    </box>
  );
}

function QuestPage({ quest, gates }: { quest: QuestView | null; gates: GateView[] }) {
  const atlas = atlasForExpedition(quest, gates);
  const active = activeAtlasQuest(atlas);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>◇ ACTIVE QUEST</text>
      <text fg={active?.boss ? c.coral : c.text}>{active?.boss ? "BOSS · " : ""}{active?.title ?? quest?.title ?? "No active quest"}</text>
      {quest?.checks.map((check, index) => <text key={`${check.line}:${index}`} fg={check.done ? c.mint : c.text}>{check.done ? "☑" : "☐"} {check.line}</text>)}
      <text fg={c.amber}>NEXT UP · {active?.hint ?? questHint(quest)}</text>
      <text fg={active?.boss ? c.magenta : c.dim}>BOSS CHIP · {active?.boss ? "armed" : "not yet"}</text>
    </box>
  );
}

function VerbsPage({ gates }: { gates: GateView[] }) {
  const visible = gates.filter((gate) => gate.visibility !== "hidden");
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>✦ VERB GRID</text>
      {visible.map((gate) => {
        const unlocked = gate.visibility === "unlocked";
        return <text key={gate.tool} fg={unlocked ? c.mint : c.dim} attributes={unlocked ? TextAttributes.BOLD : TextAttributes.DIM}>{unlocked ? "●" : "◌ 🔒"} {gate.tool}{unlocked ? " online" : ` · ${gate.teaching ?? "clear the next quest"}`}</text>;
      })}
    </box>
  );
}

function ProgressPage({ moments }: { moments: GameMoment[] }) {
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>▸ MOMENT FEED</text>
      {moments.length === 0 ? <text fg={c.dim}>Awaiting mission telemetry…</text> : null}
      {moments.slice(-12).map((moment) => <text key={moment.id} fg={moment.color}>{moment.glyph} {moment.line}</text>)}
    </box>
  );
}

function UnlocksPage({ quest, gates }: { quest: QuestView | null; gates: GateView[] }) {
  const atlas = atlasForExpedition(quest, gates);
  const next = nextUnlockLabel(atlas, gates);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>⬡ REWARD TRACK</text>
      <box style={{ flexDirection: "row", alignItems: "center" }}>
        <PixelSpriteView sprite={PIXEL_SPRITES.emblemUnlock} />
        <box style={{ flexDirection: "column", paddingLeft: 1 }}>
          <text fg={c.magenta} attributes={TextAttributes.BOLD}>NEXT EMBLEM</text>
          <text fg={c.amber}>{next}</text>
        </box>
      </box>
      {atlas.map((level) => <text key={level.id} fg={level.status === "done" ? c.mint : level.status === "active" ? c.amber : c.dim}>{level.status === "done" ? "◆" : level.status === "active" ? "◇" : "◌"} {level.title} · {level.rewards.length ? level.rewards.join(" + ") : "boss clear"}</text>)}
    </box>
  );
}

function ChallengesPage({ scorecard, events }: { scorecard: Scorecard | null; events: HarnessEvent[] }) {
  const chips = buildChallengeChips(scorecard, events);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>◆ LIVE CHALLENGES</text>
      {chips.map((chip) => <text key={chip.id} fg={chip.passed ? c.mint : c.amber}>{chip.passed ? "PASS" : "WARN"} · {chip.label} · {chip.progress}</text>)}
    </box>
  );
}

function AchievementsPage({ events, scorecard }: { events: HarnessEvent[]; scorecard: Scorecard | null }) {
  const achievements = buildAchievements(events, scorecard);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={c.cyan} attributes={TextAttributes.BOLD}>★ ACHIEVEMENTS</text>
      {achievements.map((achievement) => <text key={achievement.id} fg={achievement.earned ? c.magenta : c.dim} attributes={achievement.earned ? TextAttributes.BOLD : TextAttributes.DIM}>{achievement.earned ? "★" : "???"} {achievement.label} {achievement.earned ? `· ${fmtTime(achievement.ts)}` : ""}</text>)}
    </box>
  );
}

function Deck({ collapsed, active, flash, news, quest, gates, scorecard, moments, events }: { collapsed: boolean; active: DeckTabId; flash: boolean; news: Partial<Record<DeckTabId, true>>; quest: QuestView | null; gates: GateView[]; scorecard: Scorecard | null; moments: GameMoment[]; events: HarnessEvent[] }) {
  if (collapsed) {
    return (
      <box title="Deck" titleColor={c.cyan} style={{ width: 5, border: true, borderColor: c.line, flexDirection: "column", alignItems: "center", backgroundColor: c.panel }}>
        {expeditionTabs.map((tab) => <text key={tab.id} fg={tab.id === active ? c.cyan : c.dim}>{tab.icon}{news[tab.id] ? "•" : " "}</text>)}
      </box>
    );
  }
  return (
    <box title="RIGHT DECK" titleColor={flash ? c.magenta : c.cyan} style={{ width: "38%", minWidth: 45, border: true, borderColor: flash ? c.magenta : c.line, paddingLeft: 1, paddingRight: 1, flexDirection: "column", backgroundColor: c.panel }}>
      <TabBar active={active} flash={flash} />
      {active === "quests" ? <QuestPage quest={quest} gates={gates} /> : null}
      {active === "verbs" ? <VerbsPage gates={gates} /> : null}
      {active === "progress" ? <ProgressPage moments={moments} /> : null}
      {active === "unlocks" ? <UnlocksPage quest={quest} gates={gates} /> : null}
      {active === "challenges" ? <ChallengesPage scorecard={scorecard} events={events} /> : null}
      {active === "achievements" ? <AchievementsPage events={events} scorecard={scorecard} /> : null}
    </box>
  );
}

function StatusInput({ status, input, setInput, focused, placeholder, toast }: { status: StatusModel; input: string; setInput(value: string): void; focused: boolean; placeholder: string; toast: string | null }) {
  return (
    <box style={{ flexDirection: "column" }}>
      {toast ? <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: c.panel2 }}><text fg={toast.startsWith("★") ? c.magenta : c.amber} attributes={TextAttributes.BOLD}>{toast}</text></box> : null}
      <box style={{ border: true, borderColor: status.status === "AWAITING APPROVAL" ? c.magenta : c.line, height: 3, paddingLeft: 1, paddingRight: 1, flexDirection: "row", alignItems: "center", backgroundColor: c.panel }}>
        <text fg={statusColors[status.status]} attributes={TextAttributes.BOLD}>{status.pulse ? "●" : "○"} {status.status}  </text>
        <input focused={focused} placeholder={placeholder} value={input} onInput={setInput} style={{ flexGrow: 1 }} />
      </box>
    </box>
  );
}

function ExpeditionApprovalModal({ state }: { state: ApprovalModalState | null }) {
  if (!state) return null;
  const request = state.request;
  const pattern = request.suggestedPattern ?? request.command;
  return (
    <box title="CAPCOM APPROVAL" titleColor={c.magenta} zIndex={30} style={{ position: "absolute", left: 8, right: 8, top: 5, height: 14, border: true, borderColor: c.magenta, paddingLeft: 2, paddingRight: 2, flexDirection: "column", backgroundColor: c.panel }}>
      <text fg={riskColors[request.risk]} attributes={TextAttributes.BOLD}>{request.risk.toUpperCase()} · {request.tool}</text>
      <text fg={c.text}>COMMAND · {request.command}</text>
      <text fg={c.amber}>WHY · {request.explanation}</text>
      <text fg={c.dim}>PATTERN · {pattern}</text>
      {state.mode === "reason" ? (
        <box title="Deny reason" titleColor={c.magenta} style={{ border: true, borderColor: c.line, height: 3, flexDirection: "row", backgroundColor: c.bg }}>
          <input focused placeholder="reason, then Enter" value={state.reason} />
        </box>
      ) : (
        <text fg={c.text}>[a] approve once   [p] pattern   [d] deny   [r] deny with reason</text>
      )}
    </box>
  );
}

function nextTab(current: DeckTabId, delta: number): DeckTabId {
  const index = expeditionTabs.findIndex((tab) => tab.id === current);
  return expeditionTabs[(index + delta + expeditionTabs.length) % expeditionTabs.length]!.id;
}

export function ExpeditionApp(opts: ExpeditionAppOpts) {
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptModel>(() => emptyTranscript());
  const [quest, setQuest] = useState<QuestView | null>(() => opts.questView());
  const [gates, setGates] = useState<GateView[]>(() => opts.gateViews());
  const [scorecard, setScorecard] = useState<Scorecard | null>(() => opts.scorecard());
  const [modal, setModal] = useState<ApprovalModalState | null>(null);
  const [moments, setMoments] = useState<GameMoment[]>([]);
  const [events, setEvents] = useState<HarnessEvent[]>([]);
  const [status, setStatus] = useState<StatusModel>(() => emptyStatus());
  const [frame, setFrame] = useState(0);
  const [activeTab, setActiveTab] = useState<DeckTabId>("quests");
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedAt, setCollapsedAt] = useState(0);
  const [tabFlashUntil, setTabFlashUntil] = useState(0);
  const timelineReady = useRef(false);
  const lastDecay = useRef(Date.now());
  const timeline = useTimeline({ duration: 1000, loop: true });

  if (!timelineReady.current) {
    timeline.add({}, {
      duration: 1000,
      loop: true,
      onUpdate: () => {
        setFrame((current) => current + 1);
        const now = Date.now();
        if (now - lastDecay.current >= 1000) {
          lastDecay.current = now;
          setMoments((current) => decayMoments(current));
        }
      },
    });
    timelineReady.current = true;
  }

  useEffect(() => opts.approval.subscribe(setModal), [opts.approval]);

  useEffect(() => {
    return opts.bus.subscribe((event) => {
      setEvents((current) => [...current.slice(-79), event]);
      setTranscript((current) => reduceTranscript(current, event));
      setStatus((current) => reduceStatus(current, event));
      const moment = momentFromEvent(event);
      if (moment) setMoments((current) => [...current.slice(-17), moment]);
      if (relevantViewEvents[event.type]) {
        setQuest(opts.questView());
        setGates(opts.gateViews());
        setScorecard(opts.scorecard());
      }
    });
  }, [opts]);

  const switchTab = (tab: DeckTabId) => {
    setActiveTab(tab);
    setTabFlashUntil(Date.now() + 700);
  };

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      opts.onExit();
      return;
    }
    if (modal) {
      if (modal.mode === "reason" && key.name !== "return" && key.name !== "escape") {
        if (key.name === "backspace") {
          setModal((current) => current ? { ...current, reason: current.reason.slice(0, -1) } : current);
        } else if (!key.ctrl && !key.meta && key.raw.length === 1) {
          setModal((current) => current ? { ...current, reason: current.reason + key.raw } : current);
        }
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
    if (key.name === "escape") {
      opts.abort();
      return;
    }
    if (key.raw === "\\") {
      setCollapsed((current) => {
        const next = !current;
        if (next) setCollapsedAt(events.length);
        return next;
      });
      return;
    }
    if (!collapsed && input.trim() === "") {
      const numbered = expeditionTabs.find((tab) => key.raw === tab.number);
      if (numbered) {
        switchTab(numbered.id);
        return;
      }
      if (key.raw === "]") {
        switchTab(nextTab(activeTab, 1));
        return;
      }
      if (key.raw === "[") {
        switchTab(nextTab(activeTab, -1));
        return;
      }
    }
    if (key.name === "return" && input.trim()) {
      opts.send(input.trim());
      setInput("");
    }
  });

  const level = opts.progress?.() ?? missionLevel(scorecard);
  const achievements = useMemo(() => buildAchievements(events, scorecard), [events, scorecard]);
  const news = useMemo(() => hiddenNewsTabs(activeTab, events, achievements, collapsedAt, collapsed), [activeTab, events, achievements, collapsedAt, collapsed]);
  const latestMoment = moments.at(-1);
  const flash = Date.now() < tabFlashUntil || moments.some((moment) => moment.ttl > 10);
  const toast = toastFromMoment(latestMoment, achievements);
  const placeholder = `mission input · try: ${questHint(quest)}`;

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: c.bg }}>
      <Header meta={opts.meta} level={level} scorecard={scorecard} flash={flash} />
      <ObjectiveStrip quest={quest} gates={gates} />
      <box style={{ flexGrow: 1, flexDirection: "row", backgroundColor: c.bg }}>
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <Transcript model={transcript} />
        </box>
        <Deck collapsed={collapsed} active={activeTab} flash={flash} news={news} quest={quest} gates={gates} scorecard={scorecard} moments={moments} events={events} />
      </box>
      <StatusInput status={status} input={input} setInput={setInput} focused={modal === null} placeholder={placeholder} toast={toast} />
      <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: c.bg }}>
        <text fg={c.dim}>[1-6] deck tabs · [ / ] cycle · \ collapse · a/p/d/r approvals · Ctrl+C quit</text>
      </box>
      <ExpeditionApprovalModal state={modal} />
    </box>
  );
}
