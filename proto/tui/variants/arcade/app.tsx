/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard, useTimeline } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalDecision, EventBus, GateView, HarnessEvent, RiskTier, Scorecard } from "../../../harness/types";
import { activeAtlasQuest, buildAtlas, inferCompletedQuestIds, isAtlasBossQuest, nextLockedUnlock, unlockIdsFromTools } from "../../../game/atlas";
import { type ApprovalModalState, stepApprovalModal } from "../../modal";
import { PixelSpriteView } from "../../pixel";
import { PIXEL_SPRITES } from "../../pixel-sprites";
import { questHint, type QuestView } from "../../questlog";
import { Transcript, emptyTranscript, reduceTranscript, type TranscriptModel } from "../../transcript";
import { decayMoments, emptyStatus, momentFromEvent, reduceStatus, type GameMoment, type StatusModel } from "../../juice";
import { arcadeScore, emptyCombo, rankMedal, rankQuest, reduceCombo, type ComboState, type RankBreakdown } from "./reducers";

const BLACK = "#000000";
const PANEL = "#08000F";
const PANEL_2 = "#050515";
const MAGENTA = "#FF2BD6";
const CYAN = "#00E5FF";
const YELLOW = "#FFE600";
const GREEN = "#36FF7A";
const RED = "#FF355E";
const DIM = "#6F6A86";
const TEXT = "#F8F7FF";

const riskColor: Record<RiskTier, string> = {
  safe: GREEN,
  moderate: YELLOW,
  risky: MAGENTA,
  critical: RED,
};

export interface TuiMeta {
  workspace: string;
  provider: string;
  model?: string;
}

export interface ApprovalController {
  subscribe(fn: (state: ApprovalModalState | null) => void): () => void;
  resolve(decision: ApprovalDecision): void;
}

export interface ArcadeAppOpts {
  bus: EventBus;
  send(text: string): void;
  abort(): void;
  gateViews(): GateView[];
  questView(): QuestView | null;
  scorecard(): Scorecard | null;
  progress?(): { xp: number; level: number };
  onExit(): void;
  approval: ApprovalController;
  meta?: TuiMeta;
}

interface ResultsCard {
  questId: string;
  title: string;
  scorecard: Scorecard | null;
  comboPeak: number;
  rank: RankBreakdown;
}

const relevantViewEvents: Record<string, true> = {
  "tool.approval.resolved": true,
  "tool.blocked": true,
  "tool.result": true,
  "file.edited": true,
  "quest.completed": true,
  "unlock.applied": true,
  "assistant.end": true,
};

const tabNames = ["Missions", "Moves", "Feed", "Powerups", "Challenges", "Hall of Fame"] as const;
type TabIndex = 0 | 1 | 2 | 3 | 4 | 5;

function workspaceLabel(path: string | undefined): string {
  if (!path) return "workspace pending";
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function StatusInput({ status, input, setInput, focused, placeholder }: { status: StatusModel; input: string; setInput(value: string): void; focused: boolean; placeholder: string }) {
  const color = status.status === "ERROR" ? RED : status.status === "AWAITING APPROVAL" ? YELLOW : status.inTurn ? CYAN : MAGENTA;
  return (
    <box style={{ height: 3, border: true, borderColor: color, backgroundColor: PANEL, paddingLeft: 1, paddingRight: 1, flexDirection: "row", alignItems: "center" }}>
      <text fg={color} attributes={TextAttributes.BOLD}>{status.status.padEnd(17)} </text>
      <input focused={focused} placeholder={placeholder} value={input} onInput={setInput} />
    </box>
  );
}

function ScoreTicker({ target }: { target: number }) {
  const [shown, setShown] = useState(target);
  const last = useRef(Date.now());
  const targetRef = useRef(target);
  const timelineReady = useRef(false);
  targetRef.current = target;
  useEffect(() => setShown((current) => Math.min(current, target)), [target]);
  const timeline = useTimeline({ duration: 1000, loop: true });
  if (!timelineReady.current) {
    timeline.add({}, {
      duration: 1000,
      loop: true,
      onUpdate: () => {
        const now = Date.now();
        if (now - last.current < 55) return;
        last.current = now;
        setShown((current) => {
          const nextTarget = targetRef.current;
          if (current === nextTarget) return current;
          const delta = nextTarget - current;
          const step = Math.max(1, Math.ceil(Math.abs(delta) / 10));
          return current + Math.sign(delta) * Math.min(step, Math.abs(delta));
        });
      },
    });
    timelineReady.current = true;
  }
  return <text fg={YELLOW} attributes={TextAttributes.BOLD}>SCORE {Math.round(shown).toLocaleString()}</text>;
}

function ComboMeter({ combo }: { combo: ComboState }) {
  const hot = combo.multiplier >= 3;
  return (
    <box style={{ flexDirection: "column", alignItems: "flex-end" }}>
      <text fg={hot ? MAGENTA : CYAN} attributes={TextAttributes.BOLD}>COMBO x{combo.multiplier} · CHAIN {combo.chain}</text>
      <text fg={combo.breakText ? RED : DIM}>{combo.breakText ?? `PEAK x${combo.peak || 1} · clean tool streak`}</text>
    </box>
  );
}

function TabStrip({ tab }: { tab: TabIndex }) {
  return (
    <box style={{ height: 1, flexDirection: "row" }}>
      {tabNames.map((name, index) => (
        <text key={name} fg={index === tab ? BLACK : CYAN} bg={index === tab ? CYAN : undefined} attributes={index === tab ? TextAttributes.BOLD : undefined}>[{index + 1}]{name} </text>
      ))}
    </box>
  );
}

function SidePanel({ tab, quest, gates, moments, scorecard, combo, ranks }: { tab: TabIndex; quest: QuestView | null; gates: GateView[]; moments: GameMoment[]; scorecard: Scorecard | null; combo: ComboState; ranks: ResultsCard[] }) {
  const visibleGates = gates.filter((gate) => gate.visibility !== "hidden");
  const unlockedTools = new Set(visibleGates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
  const atlas = buildAtlas({ completedQuests: inferCompletedQuestIds(quest?.id ?? null), unlockedIds: unlockIdsFromTools(unlockedTools), activeQuestId: quest?.id ?? null });
  const nextUnlock = nextLockedUnlock(atlas, unlockedTools);
  const checksDone = quest?.checks.filter((check) => check.done).length ?? 0;
  const tokens = scorecard ? scorecard.tokens.input + scorecard.tokens.output : 0;
  const denied = scorecard?.approvals.denied ?? 0;
  return (
    <box style={{ width: "34%", minWidth: 38, flexDirection: "column", backgroundColor: BLACK }}>
      <TabStrip tab={tab} />
      <box title={tabNames[tab]} titleColor={MAGENTA} style={{ border: true, borderColor: MAGENTA, paddingLeft: 1, paddingRight: 1, flexGrow: 1, flexDirection: "column", backgroundColor: PANEL }}>
        {tab === 0 ? (
          <>
            <text fg={YELLOW} attributes={TextAttributes.BOLD}>{quest ? `${isAtlasBossQuest(quest.id) ? "BOSS · " : "STAGE · "}${quest.title}` : "INSERT COIN"}</text>
            <text fg={DIM}>CHECKS {checksDone}/{quest?.checks.length ?? 0} · HINT {questHint(quest)}</text>
            {quest?.checks.map((check, index) => <text key={`${check.line}:${index}`} fg={check.done ? GREEN : TEXT}>{check.done ? "☑" : "☐"} {check.line}</text>)}
          </>
        ) : null}
        {tab === 1 ? visibleGates.map((gate) => <text key={gate.tool} fg={gate.visibility === "unlocked" ? CYAN : DIM}>{gate.visibility === "unlocked" ? "▶" : "LOCK"} {gate.tool}{gate.teaching && gate.visibility !== "unlocked" ? ` — ${gate.teaching}` : ""}</text>) : null}
        {tab === 2 ? (
          <>
            {moments.length === 0 ? <text fg={DIM}>Waiting for attract-mode feed…</text> : null}
            {moments.slice(-14).map((moment) => <text key={moment.id} fg={moment.color}>{moment.glyph} {moment.line}</text>)}
          </>
        ) : null}
        {tab === 3 ? (
          <>
            <text fg={YELLOW}>NEXT POWERUP</text>
            <text fg={TEXT}>{nextUnlock ? `${nextUnlock.rewards.join(" · ")} @ ${nextUnlock.levelTitle}` : "All current rewards lit"}</text>
            {atlas.flatMap((level) => level.rewards.map((reward) => <text key={`${level.id}:${reward}`} fg={level.status === "done" ? GREEN : level.status === "active" ? CYAN : DIM}>{level.status.toUpperCase()} · {reward}</text>))}
          </>
        ) : null}
        {tab === 4 ? (
          <>
            <text fg={tokens <= 25000 ? GREEN : YELLOW}>CHALLENGE · Under 25k tokens ({tokens})</text>
            <text fg={denied === 0 ? GREEN : RED}>CHALLENGE · Zero denials ({denied})</text>
            <text fg={combo.peak >= 4 ? GREEN : CYAN}>CHALLENGE · Hit x4 combo (peak x{combo.peak || 1})</text>
          </>
        ) : null}
        {tab === 5 ? (
          <>
            <text fg={ranks.length > 0 ? YELLOW : DIM}>{ranks.length > 0 ? "RANKS BANKED" : "No ranks yet — clear a stage"}</text>
            {ranks.slice(-8).map((result) => <text key={`${result.questId}:${result.title}`} fg={result.rank.rank === "S" ? YELLOW : result.rank.rank === "A" ? CYAN : result.rank.rank === "B" ? MAGENTA : DIM}>{rankMedal(result.rank.rank)} · {result.title}</text>)}
            {combo.peak > 1 ? <text fg={MAGENTA}>ACHIEVEMENT · combo peak x{combo.peak}</text> : null}
            {(scorecard?.approvals.denied ?? 0) > 0 ? <text fg={YELLOW}>ACHIEVEMENT · teach-back denial used</text> : null}
          </>
        ) : null}
      </box>
    </box>
  );
}

function StageSplash({ quest, visibleUntil }: { quest: QuestView | null; visibleUntil: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  if (!quest || now > visibleUntil) return null;
  const boss = isAtlasBossQuest(quest.id);
  return (
    <box zIndex={15} style={{ position: "absolute", left: 18, right: 18, top: 7, height: boss ? 15 : 8, border: true, borderColor: boss ? RED : CYAN, paddingLeft: 2, paddingRight: 2, alignItems: "center", justifyContent: "center", flexDirection: "column", backgroundColor: BLACK }}>
      {boss ? <PixelSpriteView sprite={PIXEL_SPRITES.bossGoodbyeGreeter} /> : null}
      <text fg={boss ? RED : YELLOW} attributes={TextAttributes.BOLD}>{boss ? "WARNING! BOSS APPROACHING" : "STAGE 1-2 · FIRST EDIT · READY?"}</text>
      <text fg={CYAN}>{quest.title}</text>
    </box>
  );
}

function ResultsOverlay({ result }: { result: ResultsCard | null }) {
  if (!result) return null;
  const score = arcadeScore(result.scorecard);
  return (
    <box zIndex={18} style={{ position: "absolute", left: 12, right: 12, top: 5, height: 16, border: true, borderColor: YELLOW, paddingLeft: 2, paddingRight: 2, flexDirection: "column", backgroundColor: BLACK }}>
      <text fg={YELLOW} attributes={TextAttributes.BOLD}>RESULTS · {result.title}</text>
      {isAtlasBossQuest(result.questId) ? <text fg={RED} attributes={TextAttributes.BOLD}>BOSS CLEAR BONUS REGISTERED</text> : null}
      <text fg={CYAN}>TOKENS {score.tokens} · WALL {Math.round((result.scorecard?.wallTimeMs ?? 0) / 1000)}s · APPROVALS {result.scorecard?.approvals.approved ?? 0}/{result.scorecard?.approvals.denied ?? 0} · PEAK x{result.comboPeak || 1}</text>
      <text fg={result.rank.rank === "S" ? YELLOW : result.rank.rank === "A" ? CYAN : result.rank.rank === "B" ? MAGENTA : DIM} attributes={TextAttributes.BOLD}>{rankMedal(result.rank.rank)} · {result.rank.points}/8</text>
      <text fg={TEXT}>{result.rank.tokenLine}</text>
      <text fg={TEXT}>{result.rank.timeLine}</text>
      <text fg={TEXT}>{result.rank.approvalLine}</text>
      <text fg={TEXT}>{result.rank.comboLine}</text>
      <text fg={DIM}>Press any key to bank this rank</text>
    </box>
  );
}

function ArcadeApprovalModal({ state }: { state: ApprovalModalState | null }) {
  if (!state) return null;
  const request = state.request;
  const pattern = request.suggestedPattern ?? request.command;
  return (
    <box zIndex={20} title="INSERT JUDGMENT" titleColor={YELLOW} style={{ position: "absolute", left: 8, right: 8, top: 4, height: 13, border: true, borderColor: riskColor[request.risk], paddingLeft: 2, paddingRight: 2, flexDirection: "column", backgroundColor: BLACK }}>
      <text fg={riskColor[request.risk]} attributes={TextAttributes.BOLD}>{request.risk.toUpperCase()} · {request.tool}</text>
      <text fg={TEXT}>{request.command}</text>
      <text fg={CYAN}>{request.explanation}</text>
      <text fg={DIM}>PATTERN · {pattern}</text>
      {state.mode === "reason" ? (
        <box title="DENY REASON" titleColor={MAGENTA} style={{ border: true, borderColor: MAGENTA, height: 3, backgroundColor: PANEL }}>
          <input focused placeholder="Why deny? Enter submits" value={state.reason} />
        </box>
      ) : (
        <text fg={YELLOW}>[a]pprove once  [p]attern  [d]eny  [r]eason</text>
      )}
    </box>
  );
}

export function ArcadeApp(opts: ArcadeAppOpts) {
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptModel>(() => emptyTranscript());
  const [quest, setQuest] = useState<QuestView | null>(() => opts.questView());
  const [gates, setGates] = useState<GateView[]>(() => opts.gateViews());
  const [scorecard, setScorecard] = useState<Scorecard | null>(() => opts.scorecard());
  const [modal, setModal] = useState<ApprovalModalState | null>(null);
  const [moments, setMoments] = useState<GameMoment[]>([]);
  const [status, setStatus] = useState<StatusModel>(() => emptyStatus());
  const [combo, setCombo] = useState<ComboState>(() => emptyCombo());
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<TabIndex>(0);
  const [stageUntil, setStageUntil] = useState(0);
  const [results, setResults] = useState<ResultsCard | null>(null);
  const [rankHistory, setRankHistory] = useState<ResultsCard[]>([]);
  const lastQuestId = useRef<string | null>(quest?.id ?? null);

  useEffect(() => opts.approval.subscribe(setModal), [opts.approval]);
  useEffect(() => {
    return opts.bus.subscribe((event: HarnessEvent) => {
      setTranscript((current) => reduceTranscript(current, event));
      setStatus((current) => reduceStatus(current, event));
      setCombo((current) => reduceCombo(current, event));
      const moment = momentFromEvent(event);
      if (moment) setMoments((current) => [...current.slice(-13), moment]);
      if (relevantViewEvents[event.type]) {
        const nextQuest = opts.questView();
        setQuest(nextQuest);
        setGates(opts.gateViews());
        const nextScorecard = opts.scorecard();
        setScorecard(nextScorecard);
        if (nextQuest?.id && nextQuest.id !== lastQuestId.current) {
          lastQuestId.current = nextQuest.id;
          setStageUntil(Date.now() + 2000);
        }
      }
      if (event.type === "quest.completed") {
        const currentScorecard = opts.scorecard();
        const title = quest?.id === event.questId ? quest.title : event.questId;
        setCombo((current) => {
          const rank = rankQuest(currentScorecard, current.peak);
          const card = { questId: event.questId, title, scorecard: currentScorecard, comboPeak: current.peak, rank };
          setResults(card);
          setRankHistory((history) => [...history, card]);
          return current;
        });
      }
    });
  }, [opts, quest]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      opts.onExit();
      return;
    }
    if (results) {
      setResults(null);
      return;
    }
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
    if (key.raw === "\\") {
      setPanelOpen((current) => !current);
      return;
    }
    if (panelOpen && input.length === 0 && /^[1-6]$/.test(key.raw)) {
      setTab((Number(key.raw) - 1) as TabIndex);
      return;
    }
    if (panelOpen && input.length === 0 && key.raw === "]") {
      setTab((current) => ((current + 1) % 6) as TabIndex);
      return;
    }
    if (panelOpen && input.length === 0 && key.raw === "[") {
      setTab((current) => ((current + 5) % 6) as TabIndex);
      return;
    }
    if (key.name === "escape") {
      opts.abort();
      return;
    }
    if (key.name === "return" && input.trim()) {
      opts.send(input.trim());
      setInput("");
    }
  });

  const level = opts.progress?.() ?? { level: 1, xp: scorecard ? scorecard.diffBytes + scorecard.tokens.output : 0 };
  const score = arcadeScore(scorecard, level);
  const provider = opts.meta?.model ? `${opts.meta.provider}/${opts.meta.model}` : opts.meta?.provider ?? "provider pending";
  const activeHint = questHint(quest);
  const atlasLevels = useMemo(() => {
    const unlockedTools = new Set(gates.filter((gate) => gate.visibility === "unlocked").map((gate) => gate.tool));
    return buildAtlas({ completedQuests: inferCompletedQuestIds(quest?.id ?? null), unlockedIds: unlockIdsFromTools(unlockedTools), activeQuestId: quest?.id ?? null });
  }, [gates, quest]);
  const objectiveQuest = activeAtlasQuest(atlasLevels);
  const objectiveLabel = objectiveQuest && isAtlasBossQuest(objectiveQuest.id) ? "BOSS" : "MISSION";
  const overlayOpen = modal !== null || results !== null || Date.now() < stageUntil;

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: BLACK }}>
      <box style={{ height: 4, flexDirection: "row", justifyContent: "space-between", backgroundColor: BLACK }}>
        <box style={{ width: 18, flexDirection: "column" }}><PixelSpriteView sprite={PIXEL_SPRITES.sprigCelebrate} /></box>
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <text fg={MAGENTA} attributes={TextAttributes.BOLD}>GARNISH ARCADE · {workspaceLabel(opts.meta?.workspace)} · LVL {level.level}</text>
          <text fg={CYAN}>\ toggles cabinet · [/] or 1-6 tabs · NEXT MOVE: {activeHint}</text>
          <text fg={DIM}>{provider} · XP {score.xpBase}×1000 + efficiency {score.efficiencyBonus}</text>
        </box>
        <box style={{ width: 42, flexDirection: "column", alignItems: "flex-end" }}>
          <ScoreTicker target={score.total} />
          <ComboMeter combo={combo} />
        </box>
      </box>
      <box style={{ height: 1, flexDirection: "row", backgroundColor: PANEL_2, paddingLeft: 1 }}>
        <text fg={objectiveQuest && isAtlasBossQuest(objectiveQuest.id) ? RED : YELLOW} attributes={TextAttributes.BOLD}>{objectiveLabel} ▸ </text>
        <text fg={TEXT}>{objectiveQuest?.title ?? quest?.title ?? "All stages clear"} — {objectiveQuest?.hint ?? activeHint}</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "row" }}>
        <box style={{ width: panelOpen ? "66%" : "100%", flexDirection: "column" }}><Transcript model={transcript} /></box>
        {panelOpen ? <SidePanel tab={tab} quest={quest} gates={gates} moments={moments} scorecard={scorecard} combo={combo} ranks={rankHistory} /> : null}
      </box>
      <StatusInput status={status} input={input} setInput={setInput} focused={!overlayOpen} placeholder={`try: ${activeHint}`} />
      <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: BLACK }}>
        <text fg={DIM}>Enter Send · Esc Abort · \ Collapse · 1-6/[ ] Cabinet Tabs · a/p/d/r Approvals · Ctrl+C Quit</text>
      </box>
      <StageSplash quest={quest} visibleUntil={stageUntil} />
      <ResultsOverlay result={results} />
      <ArcadeApprovalModal state={modal} />
    </box>
  );
}
