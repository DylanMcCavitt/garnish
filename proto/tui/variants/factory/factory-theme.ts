export const FACTORY_THEME = {
  bg: "#0B0B0D",
  panel: "#15151B",
  panelAlt: "#1C1C24",
  border: "#3A3F4B",
  grid: "#23232B",
  text: "#D8DEE9",
  dim: "#7A8290",
  copper: "#E8823C",
  amber: "#F0B429",
  green: "#7CCB6B",
  red: "#E5484D",
  cyan: "#58C7F3",
  purple: "#B48CFF",
} as const;

export const theme = {
  ...FACTORY_THEME,
  primary: FACTORY_THEME.text,
  primaryDim: FACTORY_THEME.dim,
  accent: FACTORY_THEME.copper,
} as const;

export type FactoryTheme = typeof FACTORY_THEME;
