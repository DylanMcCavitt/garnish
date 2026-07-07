/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { appendFileSync } from "node:fs";
import type { FactoryState } from "../../../factory/types";
import type { StatusModel } from "../../juice";
import type { StartTuiOpts } from "../../index";
import { PixelSpriteView } from "../../pixel";
import { PIXEL_SPRITES } from "../../pixel-sprites";
import { theme } from "../../theme";
import { Component, type ReactNode } from "react";
import {
  agentsPaneView,
  circuitPaneView,
  factoryDeckTabs,
  factoryFloor,
  inventoryPaneView,
  powerMeter,
  settingsPaneView,
  skillsPaneView,
  type FactoryDeckState,
  type FactoryDeckTabId,
  type FactoryHudState,
  type FloorNode,
} from "./model";

const spriteByFloorNode: Record<FloorNode["id"], keyof typeof PIXEL_SPRITES> = {
  ore: "orePatch",
  miner: "minerDrill",
  belt: "routingBelt",
  assembler: "assembler",
  circuit: "circuitPole",
  ship: "powerBolt",
};

function beltLane(dot: { itemId: string; offset: number } | null, built: boolean): string {
  const cells: string[] = Array.from({ length: 12 }, () => built ? "═" : "░");
  if (built && dot) cells[Math.max(0, Math.min(cells.length - 1, dot.offset))] = "◆";
  return cells.join("");
}

function FloorNodeView({ node, dot, frame }: { node: FloorNode; dot: { itemId: string; offset: number } | null; frame: number }) {
  const activePulse = node.id === "miner" && node.active ? frame % 2 === 0 ? "▶" : "◆" : node.active ? "◆" : node.built ? "●" : "○";
  const color = node.active ? theme.amber : node.built ? theme.primary : theme.dim;
  return (
    <box style={{ flexDirection: "row", marginBottom: node.id === "ship" ? 0 : 1 }}>
      <PixelSpriteView sprite={PIXEL_SPRITES[spriteByFloorNode[node.id]]} dim={!node.built} />
      <box style={{ flexDirection: "column", paddingLeft: 1, flexGrow: 1 }}>
        <text fg={color} attributes={node.built ? TextAttributes.BOLD : TextAttributes.DIM}>{activePulse} {node.label}</text>
        <text fg={node.built ? theme.dim : theme.amber}>{node.detail}</text>
        {node.id === "belt" ? <text fg={node.built ? theme.amber : theme.dim}>│ {beltLane(dot, node.built)} │</text> : null}
      </box>
    </box>
  );
}

function FloorPage({ hud, status, frame }: { hud: FactoryHudState; status: StatusModel; frame: number }) {
  const floor = factoryFloor(hud, status.status, frame);
  const meterColor = hud.brownoutFlash ? theme.bg : hud.power.shiftActive ? theme.amber : theme.dim;
  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {floor.nodes.map((node, index) => (
          <box key={node.id} style={{ flexDirection: "column" }}>
            <FloorNodeView node={node} dot={floor.beltDot} frame={frame} />
            {index < floor.nodes.length - 1 ? <text fg={node.built ? theme.dim : theme.amber}>  │</text> : null}
          </box>
        ))}
      </box>
      <box style={{ flexDirection: "row", minHeight: 3, backgroundColor: hud.brownoutFlash ? theme.red : undefined }}>
        <PixelSpriteView sprite={PIXEL_SPRITES.powerBolt} dim={!hud.power.shiftActive && !hud.brownoutFlash} />
        <box style={{ flexDirection: "column", paddingLeft: 1, justifyContent: "center" }}>
          <text fg={meterColor} attributes={hud.brownoutFlash ? TextAttributes.BOLD : undefined}>{powerMeter(hud, 14)}</text>
        </box>
      </box>
    </box>
  );
}

function TabBar({ active, flash, news }: { active: FactoryDeckTabId; flash: boolean; news: Partial<Record<FactoryDeckTabId, true>> }) {
  return (
    <box style={{ height: 2, flexDirection: "column" }}>
      <box style={{ height: 1, flexDirection: "row" }}>
        {factoryDeckTabs.map((tab) => {
          const selected = tab.id === active;
          const dot = news[tab.id] ? "•" : "";
          const cell = selected ? `[${tab.number}${tab.label}${dot}]` : ` ${tab.number}${tab.label}${dot} `;
          return (
            <text key={tab.id} fg={selected ? theme.bg : theme.primary} bg={selected ? (flash ? theme.amber : theme.accent) : undefined} attributes={selected ? TextAttributes.BOLD : undefined}>
              {cell}
            </text>
          );
        })}
      </box>
      <text fg={theme.border}>────────────────────────────────────────────</text>
    </box>
  );
}

function InventoryPage({ factoryState }: { factoryState: FactoryState }) {
  const view = inventoryPaneView(factoryState);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>▦ INVENTORY</text>
      <text fg={theme.amber}>SCIENCE red × {view.sciencePacks.red ?? 0}</text>
      <text fg={theme.dim}>ORE {view.oreRemaining} raw · {view.queuedOre} queued</text>
      <text fg={theme.primary} attributes={TextAttributes.BOLD}>SHIPPED</text>
      {view.shipped.length === 0 ? <text fg={theme.dim}>No shipped items yet.</text> : null}
      {view.shipped.slice(-8).map((item) => <text key={item.itemId} fg={theme.primary}>✓ {item.itemId} · touches {item.touches}</text>)}
      <text fg={theme.primary} attributes={TextAttributes.BOLD}>WORK QUEUE</text>
      {[...view.inProgress, ...view.queued].slice(0, 8).map((item) => <text key={item.itemId} fg={item.status === "in-progress" ? theme.amber : theme.dim}>{item.status === "in-progress" ? "▶" : "□"} {item.itemId} · {item.mode ?? "waiting"}</text>)}
    </box>
  );
}

function SkillsPage({ factoryState, readArtifact }: { factoryState: FactoryState; readArtifact(path: string): string | null }) {
  const skills = skillsPaneView(factoryState, readArtifact);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>✦ SKILLS</text>
      {skills.length === 0 ? <text fg={theme.dim}>No skill assembler built.</text> : null}
      {skills.map((skill) => (
        <box key={skill.id} style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg={theme.amber} attributes={TextAttributes.BOLD}>{skill.label}</text>
          <text fg={theme.dim}>{skill.artifact.path ?? "artifact pending"}</text>
          {skill.artifact.missing ? <text fg={theme.red}>preview unavailable</text> : skill.artifact.lines.map((line, index) => <text key={`${skill.id}:${index}`} fg={theme.dim}>{line || " "}</text>)}
        </box>
      ))}
    </box>
  );
}

function AgentsPage({ factoryState, status, meta }: { factoryState: FactoryState; status: StatusModel; meta: StartTuiOpts["meta"] }) {
  const view = agentsPaneView(factoryState, status.status, meta?.provider, meta?.model);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>● AGENTS</text>
      <text fg={theme.amber}>{view.missionStatus} · {view.providerModel}</text>
      <text fg={theme.dim}>CURRENT {view.currentItemId ?? "none"}</text>
      {view.machines.length === 0 ? <text fg={theme.dim}>No agent machinery built.</text> : null}
      {view.machines.map((machine) => <text key={machine.id} fg={theme.primary}>◆ {machine.label} · {machine.kind}{machine.artifact ? ` · ${machine.artifact}` : ""}</text>)}
    </box>
  );
}

function CircuitPage({ factoryState, readArtifact }: { factoryState: FactoryState; readArtifact(path: string): string | null }) {
  const view = circuitPaneView(factoryState, readArtifact);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>⬚ CIRCUIT</text>
      <text fg={theme.amber}>PATTERNS × {view.patternCount}</text>
      {view.machines.map((machine) => <text key={machine.id} fg={theme.primary}>◆ {machine.label}{machine.artifact ? ` · ${machine.artifact}` : ""}</text>)}
      <text fg={theme.dim}>{view.artifact.path ?? ".garnish/policies/circuit.txt"}</text>
      {view.artifact.missing ? <text fg={theme.red}>policy artifact not found yet</text> : view.artifact.lines.map((line, index) => <text key={`circuit:${index}`} fg={line.trim().startsWith("#") ? theme.dim : theme.primary}>{line || " "}</text>)}
    </box>
  );
}

function SettingsPage({ rows }: { rows: Array<[string, string]> }) {
  const settings = settingsPaneView(rows);
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>⚙ SETTINGS</text>
      {settings.length === 0 ? <text fg={theme.dim}>Settings unavailable.</text> : null}
      {settings.map(([label, value]) => <text key={label} fg={theme.primary}>{label.padEnd(10, " ")} · {value}</text>)}
    </box>
  );
}

export function TranscriptRail({ unread }: { unread: number }) {
  return (
    <box title="Feed" titleColor={theme.dim} style={{ width: 8, border: true, borderColor: theme.border, alignItems: "center", justifyContent: "center", flexDirection: "column", backgroundColor: theme.panel }}>
      {"FEED".split("").map((letter) => <text key={letter} fg={theme.dim} attributes={TextAttributes.BOLD}>{letter}</text>)}
      <text fg={theme.amber}>+{unread}</text>
    </box>
  );
}

/** A crashing pane must degrade to a red line, never kill the React root. */
class PaneBoundary extends Component<{ paneKey: string; children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      appendFileSync("/tmp/garnish-pane-crash.log", `${new Date().toISOString()} ${message}\n${error instanceof Error ? error.stack ?? "" : ""}\n`);
    } catch {
      // logging must never crash the boundary
    }
    return { error: message };
  }
  override render() {
    if (this.state.error !== null) return <text fg={theme.red}>pane crashed: {this.state.error}</text>;
    return this.props.children;
  }
}

export function FactoryDeck({ deck, hud, factoryState, status, frame, flash, news, readArtifact, settingsRows, meta }: { deck: FactoryDeckState; hud: FactoryHudState; factoryState: FactoryState; status: StatusModel; frame: number; flash: boolean; news: Partial<Record<FactoryDeckTabId, true>>; readArtifact(path: string): string | null; settingsRows: Array<[string, string]>; meta: StartTuiOpts["meta"] }) {

  if (deck.collapsed) {
    return (
      <box title="Deck" titleColor={theme.accent} style={{ width: 5, border: true, borderColor: theme.border, flexDirection: "column", alignItems: "center", backgroundColor: theme.panel }}>
        {factoryDeckTabs.map((tab) => <text key={tab.id} fg={tab.id === deck.active ? theme.accent : theme.dim}>{tab.initial}{news[tab.id] ? "•" : " "}</text>)}
      </box>
    );
  }

  const activeTab = factoryDeckTabs.find((tab) => tab.id === deck.active);
  return (
    <box title={`PANE DECK · ${activeTab?.label ?? ""} [${activeTab?.number ?? ""}/6]`} titleColor={flash ? theme.amber : theme.accent} style={{ width: "40%", minWidth: 45, border: true, borderColor: flash ? theme.amber : theme.border, paddingLeft: 1, paddingRight: 1, flexDirection: "column", backgroundColor: theme.panel }}>
      <TabBar active={deck.active} flash={flash} news={news} />
      <PaneBoundary paneKey={deck.active}>
        {deck.active === "floor" ? <FloorPage hud={hud} status={status} frame={frame} /> : null}
        {deck.active === "inventory" ? <InventoryPage factoryState={factoryState} /> : null}
        {deck.active === "skills" ? <SkillsPage factoryState={factoryState} readArtifact={readArtifact} /> : null}
        {deck.active === "agents" ? <AgentsPage factoryState={factoryState} status={status} meta={meta} /> : null}
        {deck.active === "circuit" ? <CircuitPage factoryState={factoryState} readArtifact={readArtifact} /> : null}
        {deck.active === "settings" ? <SettingsPage rows={settingsRows} /> : null}
      </PaneBoundary>
    </box>
  );
}
