/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useEffect, useMemo, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { WorldSlot } from "../../../factory/menu";
import { renderWorldSlot } from "../../../factory/menu";
import { PixelSpriteView } from "../../pixel";
import { PIXEL_SPRITES } from "../../pixel-sprites";
import { theme } from "../../theme";

export type MenuMode = "select" | "name";

export interface MenuState {
  mode: MenuMode;
  selected: number;
  slotCount: number;
  nameInput: string;
}

export type MenuAction =
  | { type: "select"; index: number }
  | { type: "create"; name: string }
  | { type: "quit" };

export type MenuKey =
  | { type: "up" }
  | { type: "down" }
  | { type: "digit"; value: number }
  | { type: "enter" }
  | { type: "new" }
  | { type: "quit" }
  | { type: "escape" }
  | { type: "backspace" }
  | { type: "char"; value: string };

export interface MenuStep {
  state: MenuState;
  action: MenuAction | null;
}

export interface MenuWorlds {
  list(): WorldSlot[];
  create(name: string): { root: string; name: string };
  select(world: { root: string; name: string }): void;
}

export function initialMenuState(slotCount: number): MenuState {
  return { mode: "select", selected: 0, slotCount: Math.max(0, slotCount), nameInput: "" };
}

function clampSelection(selected: number, slotCount: number): number {
  if (slotCount <= 0) return 0;
  return Math.max(0, Math.min(slotCount - 1, selected));
}

function normalizeState(state: MenuState): MenuState {
  return { ...state, slotCount: Math.max(0, state.slotCount), selected: clampSelection(state.selected, state.slotCount) };
}

export function stepMenu(state: MenuState, key: MenuKey): MenuStep {
  const current = normalizeState(state);

  if (current.mode === "name") {
    if (key.type === "escape") return { state: { ...current, mode: "select", nameInput: "" }, action: null };
    if (key.type === "backspace") return { state: { ...current, nameInput: current.nameInput.slice(0, -1) }, action: null };
    if (key.type === "enter") {
      const fallback = `world-${current.slotCount + 1}`;
      const name = current.nameInput.trim().length === 0 ? fallback : current.nameInput.trim();
      return { state: { ...current, mode: "select", nameInput: "" }, action: { type: "create", name } };
    }
    if (key.type === "char") {
      if (key.value.length === 0) return { state: current, action: null };
      return { state: { ...current, nameInput: `${current.nameInput}${key.value}`.slice(0, 40) }, action: null };
    }
    return { state: current, action: null };
  }

  if (key.type === "up") {
    if (current.slotCount <= 0) return { state: current, action: null };
    return { state: { ...current, selected: (current.selected - 1 + current.slotCount) % current.slotCount }, action: null };
  }
  if (key.type === "down") {
    if (current.slotCount <= 0) return { state: current, action: null };
    return { state: { ...current, selected: (current.selected + 1) % current.slotCount }, action: null };
  }
  if (key.type === "digit") {
    const index = key.value - 1;
    if (index < 0 || index >= current.slotCount) return { state: current, action: null };
    return { state: { ...current, selected: index }, action: null };
  }
  if (key.type === "enter") {
    if (current.slotCount <= 0) return { state: current, action: null };
    return { state: current, action: { type: "select", index: current.selected } };
  }
  if (key.type === "new") return { state: { ...current, mode: "name", nameInput: "" }, action: null };
  if (key.type === "quit") return { state: current, action: { type: "quit" } };
  return { state: current, action: null };
}

function menuKeyFromOpenTui(key: { name: string; raw: string; ctrl?: boolean; meta?: boolean }, mode: MenuMode): MenuKey | null {
  if (key.ctrl || key.meta) return null;
  if (key.name === "return") return { type: "enter" };
  if (key.name === "escape") return { type: "escape" };
  if (key.name === "backspace") return { type: "backspace" };
  if (mode === "name") {
    if (key.raw.length === 1) return { type: "char", value: key.raw };
    return null;
  }
  if (key.name === "up") return { type: "up" };
  if (key.name === "down") return { type: "down" };
  if (key.raw === "n") return { type: "new" };
  if (key.raw === "q") return { type: "quit" };
  if (/^[1-9]$/.test(key.raw)) return { type: "digit", value: Number(key.raw) };
  if (key.raw.length === 1) return { type: "char", value: key.raw };
  return null;
}

function SlotRow(props: { slot: WorldSlot; index: number; selected: boolean; now: number }) {
  const fresh = props.slot.summary === null;
  return (
    <box style={{ height: 1, flexDirection: "row", paddingLeft: 1, paddingRight: 1, backgroundColor: props.selected ? theme.accent : undefined }}>
      <text
        fg={props.selected ? theme.bg : fresh ? theme.dim : theme.primary}
        attributes={props.selected ? TextAttributes.BOLD : fresh ? TextAttributes.DIM : undefined}
      >
        {renderWorldSlot(props.slot, props.index, props.now)}
      </text>
    </box>
  );
}

function NameInputRow({ value }: { value: string }) {
  return (
    <box style={{ height: 3, border: true, borderColor: theme.accent, flexDirection: "row", alignItems: "center", paddingLeft: 1, paddingRight: 1 }}>
      <text fg={theme.amber} attributes={TextAttributes.BOLD}>Name this world › </text>
      <text fg={theme.primary}>{value.length === 0 ? "_" : `${value}_`}</text>
    </box>
  );
}

export function MenuScreen(props: { worlds: MenuWorlds; onQuit(): void }) {
  const [slots, setSlots] = useState<WorldSlot[]>(() => props.worlds.list());
  const [state, setState] = useState<MenuState>(() => initialMenuState(slots.length));
  const now = useMemo(() => Date.now(), [slots]);

  useEffect(() => {
    setState((current) => normalizeState({ ...current, slotCount: slots.length }));
  }, [slots.length]);

  const applyAction = (action: MenuAction | null) => {
    if (action === null) return;
    if (action.type === "quit") {
      props.onQuit();
      return;
    }
    if (action.type === "select") {
      const slot = slots[action.index];
      if (slot) props.worlds.select({ root: slot.root, name: slot.name });
      return;
    }
    const world = props.worlds.create(action.name);
    setSlots(props.worlds.list());
    props.worlds.select(world);
  };

  useKeyboard((key) => {
    setState((current) => {
      const menuKey = menuKeyFromOpenTui(key, current.mode);
      if (menuKey === null) return current;
      const step = stepMenu({ ...current, slotCount: slots.length }, menuKey);
      applyAction(step.action);
      return step.state;
    });
  });

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <box style={{ width: 76, flexDirection: "column", border: true, borderColor: theme.border, backgroundColor: theme.panel, paddingLeft: 2, paddingRight: 2, paddingTop: 1, paddingBottom: 1 }}>
        <box style={{ flexDirection: "row", justifyContent: "center", height: 5 }}>
          <PixelSpriteView sprite={PIXEL_SPRITES.sprigIdle} />
        </box>
        <box style={{ height: 2, flexDirection: "column", alignItems: "center" }}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>GARNISH · FACTORY</text>
          <text fg={theme.dim}>a factory game about automating yourself out of the loop</text>
        </box>
        <box style={{ height: 1 }} />
        <box style={{ flexDirection: "column", border: true, borderColor: theme.border, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={theme.amber} attributes={TextAttributes.BOLD}>WORLD SLOTS</text>
          {slots.length === 0 ? <text fg={theme.dim}>— fresh world —</text> : null}
          {slots.map((slot, index) => <SlotRow key={slot.root} slot={slot} index={index} selected={state.mode === "select" && state.selected === index} now={now} />)}
        </box>
        <box style={{ height: 1 }} />
        {state.mode === "name" ? <NameInputRow value={state.nameInput} /> : null}
        <box style={{ height: 2, flexDirection: "column" }}>
          <text fg={theme.dim}>↑/↓ move · digits jump · Enter select · n new world · q quit</text>
          <text fg={theme.dim}>New world: type a name, Enter launch, Esc cancel</text>
        </box>
      </box>
    </box>
  );
}
