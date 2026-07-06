import { demoKitchenProvider, startDemoKitchenLogin } from "./mock";
import { providerTable, startAnthropicLogin, startOpenAICodexLogin } from "./registry";
export { getStoredAuth } from "./store";

export type AuthProviderInfo = {
  id: string;
  label: string;
  kind: "oauth-pkce" | "device-code" | "manual" | "mock";
  ported: boolean;
};

export type AuthResult = {
  provider: string;
  method: "oauth" | "api-key" | "scripted";
  account?: string;
};

export type LoginSession = {
  provider: string;
  instructions: string;
  url?: string;
  userCode?: string;
  complete(input?: string): Promise<AuthResult>;
};

export function listAuthProviders(): AuthProviderInfo[] {
  return [demoKitchenProvider, ...providerTable];
}

export async function startLogin(id: string): Promise<LoginSession> {
  if (id === "demo-kitchen") return startDemoKitchenLogin();
  if (id === "anthropic") return startAnthropicLogin();
  if (id === "openai-codex") return startOpenAICodexLogin();
  const provider = providerTable.find((entry) => entry.id === id);
  if (provider) throw new Error(`${provider.label} OAuth is listed for omp parity but is not ported in this prototype yet`);
  throw new Error(`Unknown auth provider: ${id}`);
}

export * from "./registry";
export { codeChallenge, createPkce, createState } from "./pkce";
export { storeAuth, readAuthStore, writeAuthStore, authStorePath } from "./store";
