export const garnishExtensionEntrypoint = "garnish-extension" as const;
export * from "./extension/index";
export * from "./extension/hud";
export { createGarnishExtension as default } from "./extension/index";
