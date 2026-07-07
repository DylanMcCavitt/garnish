/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useMemo, useRef, useState } from "react";
import type { FactoryState } from "../../../../factory/types";
import { FACTORY_THEME } from "../factory-theme";
import { nextActionHint } from "../model";
import type { FactoryFlow } from "./types";

const FOREMAN_CARDS = [
  "This harness is bare. You'll work the first ore by HAND.",
  "Every touch costs you. We count them — top of the screen.",
  "Ship items → research machines → automate yourself out of this chair.",
] as const;

function ForemanIntro({ worldName, done }: { worldName: string; done(): void }) {
  const [cardIndex, setCardIndex] = useState(0);
  const finished = useRef(false);

  const advance = () => {
    if (finished.current) return;
    if (cardIndex < FOREMAN_CARDS.length - 1) {
      setCardIndex((current) => Math.min(current + 1, FOREMAN_CARDS.length - 1));
      return;
    }
    finished.current = true;
    done();
  };

  useKeyboard((key) => {
    if (key.name !== "return" && key.name !== "enter" && key.name !== "space" && key.raw !== " ") return;
    advance();
  });

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: FACTORY_THEME.bg,
      }}
    >
      <box
        style={{
          width: 72,
          border: true,
          borderColor: FACTORY_THEME.copper,
          backgroundColor: FACTORY_THEME.panel,
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: 1,
          paddingBottom: 1,
          flexDirection: "column",
        }}
      >
        <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <text fg={FACTORY_THEME.copper} attributes={TextAttributes.BOLD}>SPRIG · FOREMAN</text>
          <text fg={FACTORY_THEME.dim}>{worldName}</text>
        </box>
        <box style={{ height: 1 }} />
        <text fg={FACTORY_THEME.text} attributes={TextAttributes.BOLD}>{FOREMAN_CARDS[cardIndex]}</text>
        <box style={{ height: 1 }} />
        <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <text fg={FACTORY_THEME.dim}>CARD {cardIndex + 1}/3</text>
          <text fg={FACTORY_THEME.amber}>[Enter/Space] continue</text>
        </box>
      </box>
    </box>
  );
}

function currentItem(state: FactoryState) {
  return state.currentItemId === null
    ? null
    : state.items.find((item) => item.id === state.currentItemId && item.status === "in-progress") ?? null;
}

function queuedItemIdFromHint(hint: string): string | null {
  const minePrefix = "/mine — ";
  if (!hint.startsWith(minePrefix)) return null;
  const rest = hint.slice(minePrefix.length);
  return rest.split(" ", 1)[0] ?? null;
}

function buildTargetFromHint(hint: string): string | null {
  const buildPrefix = "research complete — /build ";
  if (!hint.startsWith(buildPrefix)) return null;
  return hint.slice(buildPrefix.length).split(" ", 1)[0] ?? null;
}

function objectiveOrder(state: FactoryState): string | null {
  const hint = nextActionHint(state);
  if (hint === null) return null;

  if (hint.startsWith("⚡ brownout")) return "feed the grid · /feed 50000";
  if (hint.startsWith("queue clear")) return "end the shift · /end";

  const buildTarget = buildTargetFromHint(hint);
  if (buildTarget !== null) return `build ${buildTarget}`;

  if (hint.startsWith("research complete — /forge ")) return "forge greeter-fix";
  if (hint.startsWith("research complete — /wire ")) return "wire the first allow rule";
  if (hint.startsWith("/power ")) return "power the belt · /power 800";

  const queuedItemId = queuedItemIdFromHint(hint);
  if (queuedItemId !== null) return `mine ${queuedItemId} · /mine`;

  const item = currentItem(state);
  if (hint.startsWith("/cat ") && item !== null) return `hand-fix ${item.id} · expect 4 touches`;
  if (hint.startsWith("ask the model") && item !== null) return `ask the model for ${item.id} · paste the command`;

  return hint;
}

function ForemanBanner({ state }: { state: FactoryState }) {
  const order = useMemo(() => objectiveOrder(state), [state]);
  if (order === null) return null;
  return (
    <box style={{ height: 1, flexDirection: "row", justifyContent: "center", backgroundColor: FACTORY_THEME.panelAlt }}>
      <text fg={FACTORY_THEME.amber} attributes={TextAttributes.BOLD}>OBJECTIVE · {order}</text>
    </box>
  );
}

export const foremanFlow: FactoryFlow = {
  id: "foreman",
  label: "Foreman",
  hintLabel: "FOREMAN",
  bootLines: [
    "Foreman says: first command is /mine.",
    "Work item-1 by hand. I count every touch.",
  ],
  Intro: ForemanIntro,
  Banner: ForemanBanner,
};
