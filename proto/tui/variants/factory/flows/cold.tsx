/** @jsxImportSource @opentui/react */
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useRef } from "react";
import { FACTORY_THEME } from "../factory-theme";
import type { FactoryFlow } from "./types";

function ColdIntro({ done }: { worldName: string; done(): void }) {
  const finished = useRef(false);

  useKeyboard((key) => {
    if (finished.current) return;
    if (key.name !== "return" && key.name !== "enter" && key.name !== "space" && key.raw !== " ") return;
    finished.current = true;
    done();
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
      <box style={{ flexDirection: "column", alignItems: "center" }}>
        <text fg={FACTORY_THEME.copper} attributes={TextAttributes.BOLD}>GARNISH · FACTORY</text>
        <text fg={FACTORY_THEME.text}>Automate yourself out of the loop.</text>
        <box style={{ height: 1 }} />
        <text fg={FACTORY_THEME.dim}>[Enter] clock in</text>
      </box>
    </box>
  );
}

export const coldFlow: FactoryFlow = {
  id: "cold",
  label: "Cold Open",
  hintLabel: "HINT",
  bootLines: ["ore is piling up. item-1 waits: /mine"],
  Intro: ColdIntro,
};
