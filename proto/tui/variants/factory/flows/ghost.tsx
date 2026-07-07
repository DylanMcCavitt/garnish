/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useEffect, useRef } from "react";
import type { MachineKind } from "../../../../harness/types";
import { FACTORY_THEME as theme } from "../factory-theme";
import type { FactoryFlow } from "./types";

const INTRO_AUTO_DONE_FRAME = 780; // ~13 seconds at the factory timeline's 60-ish fps.
const FEED_REVEAL_EVERY = 84;

const HOUR_10_QUEUE = ["item-41", "item-42", "item-43", "item-44", "item-45", "item-46"] as const;
const HOUR_10_TOUCHES = [0, 0, 0] as const;
const HOUR_10_FEED = [
  "belt pulled item-41 · no player input",
  "bare agent patched ore/41.ts · approval auto-allowed",
  "assembler applied greeter-fix · pattern matched",
  "circuit approved edit/read/write · policy lane green",
  "ship launched item-41 · touches 0 · red science +1",
  "queue advanced · item-42 already moving",
] as const;

const MACHINE_TEASE: Partial<Record<MachineKind, string>> = {
  "bare-agent": "burner agent reads the ore and takes the first tool calls",
  "routing-belt": "routing belt pulls items for you",
  skill: "skill assembler turns one fix into a reusable recipe",
  "policy-circuit": "policy circuit approves safe tools without asking",
};

function completeOnce(done: () => void, doneRef: { current: boolean }) {
  if (doneRef.current) return;
  doneRef.current = true;
  done();
}

function GhostIntro(props: { worldName: string; done(): void; frame?: number }) {
  const frame = props.frame ?? 0;
  const doneRef = useRef(false);
  const visibleFeed = Math.min(HOUR_10_FEED.length, 1 + Math.floor(frame / FEED_REVEAL_EVERY));
  const hum = frame % 24 < 12;
  const powerFill = 14 + (frame % 18 < 9 ? 1 : 0);
  const powerMeter = `${"█".repeat(powerFill)}${"░".repeat(18 - powerFill)}`;
  const scanColumn = frame % HOUR_10_QUEUE.length;

  useEffect(() => {
    if (frame >= INTRO_AUTO_DONE_FRAME) completeOnce(props.done, doneRef);
  }, [frame, props.done]);

  useKeyboard((key) => {
    if (key.ctrl || key.meta) return;
    if (key.name === "return" || key.raw === " ") completeOnce(props.done, doneRef);
  });

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: theme.bg, paddingLeft: 2, paddingRight: 2, paddingTop: 1, paddingBottom: 1 }}>
      <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: theme.copper }}>
        <text fg={theme.bg} attributes={TextAttributes.BOLD}>THIS IS HOUR 10 · REWINDING TO HOUR 0 …</text>
      </box>

      <box style={{ height: 3, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <text fg={theme.amber} attributes={TextAttributes.BOLD}>GARNISH FACTORY · GHOST SIGNAL</text>
        <text fg={theme.dim}>{props.worldName} · future floor telemetry · press Enter to wake up</text>
      </box>

      <box style={{ height: 3, flexDirection: "column", border: true, borderColor: theme.border, backgroundColor: theme.panel, paddingLeft: 1, paddingRight: 1 }}>
        <box style={{ height: 1, flexDirection: "row" }}>
          <text fg={theme.dim}>QUEUE </text>
          {HOUR_10_QUEUE.map((item, index) => (
            <text key={item} fg={index === scanColumn ? theme.bg : theme.green} bg={index === scanColumn ? theme.green : undefined} attributes={TextAttributes.BOLD}>{` ✓ ${item} `}</text>
          ))}
        </box>
        <text fg={theme.cyan} attributes={TextAttributes.BOLD}>{`TOUCHES/ITEM ${HOUR_10_TOUCHES.join(" ")} · player hands off the belt`}</text>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "row", marginTop: 1 }}>
        <box style={{ width: "56%", flexDirection: "column", border: true, borderColor: theme.border, backgroundColor: theme.panelAlt, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={theme.copper} attributes={TextAttributes.BOLD}>MISSION CONTROL FEED</text>
          {HOUR_10_FEED.map((line, index) => (
            <box key={line} style={{ height: 1, flexDirection: "row" }}>
              <text fg={index < visibleFeed ? theme.green : theme.grid}>▍ </text>
              <text fg={index < visibleFeed ? theme.text : theme.dim} attributes={index < visibleFeed ? undefined : TextAttributes.DIM}>{index < visibleFeed ? line : "…"}</text>
            </box>
          ))}
        </box>

        <box style={{ width: "44%", flexDirection: "column", border: true, borderColor: theme.border, backgroundColor: theme.panel, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={theme.purple} attributes={TextAttributes.BOLD}>FLOOR STATUS</text>
          <text fg={theme.green}>● ore → agent → belt → assembler → circuit → ship</text>
          <text fg={theme.dim}>all lanes built · all approvals patterned</text>
          <text fg={theme.amber}>{`POWER [${powerMeter}] ${hum ? "HUM" : "hum"}`}</text>
          <text fg={theme.cyan}>zero-touch ships are ordinary now</text>
          <text fg={theme.dim}>hour 0 starts with one raw ore and your hands.</text>
        </box>
      </box>
    </box>
  );
}

function ghostBannerLine(state: Parameters<NonNullable<FactoryFlow["Banner"]>>[0]["state"]): string | null {
  const next = state.research.find((research) => !state.machines.some((machine) => machine.kind === research.unlocks));
  if (!next) return null;
  const tease = MACHINE_TEASE[next.unlocks] ?? `${next.label.toLowerCase()} comes online`;
  const suffix = next.done ? "build it now" : `research ${next.id.replace("research-", "")}`;
  return `GHOST · next: ${tease} (${suffix})`;
}

function GhostBanner(props: Parameters<NonNullable<FactoryFlow["Banner"]>>[0]) {
  const line = ghostBannerLine(props.state);
  if (line === null) return null;
  return (
    <box style={{ height: 1, flexDirection: "row", paddingLeft: 1, backgroundColor: theme.bg }}>
      <text fg={theme.dim} attributes={props.frame % 30 < 15 ? TextAttributes.DIM : undefined}>{line}</text>
    </box>
  );
}

export const ghostFlow: FactoryFlow = {
  id: "ghost",
  label: "Ghost signal",
  hintLabel: "ECHO",
  bootLines: ["hour 0. bare hands. the ghost you saw is 10 hours of automation away."],
  Intro: GhostIntro,
  Banner: GhostBanner,
};
