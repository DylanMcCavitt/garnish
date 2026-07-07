import type { ReactNode } from "react";
import type { FactoryState } from "../../../../factory/types";
import type { FactoryStage } from "../model";

export interface FactoryFlow {
  id: "foreman" | "cold" | "ghost";
  label: string;
  hintLabel: string;                       // e.g. FOREMAN / HINT / ECHO
  bootLines: string[];                     // tutor lines emitted post-mount (replaces hardcoded SPRIG tip; emission stays in main.ts)
  Intro?: (props: { worldName: string; done(): void }) => ReactNode;  // full-screen, any key/enter -> done()
  Banner?: (props: { state: FactoryState; stage: FactoryStage; frame: number }) => ReactNode;
}
