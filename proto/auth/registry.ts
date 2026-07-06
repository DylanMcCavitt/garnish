import { createPkce, createState } from "./pkce";
import { storeAuth } from "./store";
import type { AuthResult, LoginSession } from "./index";

export type AuthProviderInfo = {
  id: string;
  label: string;
  kind: "oauth-pkce" | "device-code" | "manual" | "mock";
  ported: boolean;
};

export const ANTHROPIC_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const ANTHROPIC_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
export const ANTHROPIC_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";
export const ANTHROPIC_REDIRECT_URI = "http://localhost:54545/callback";
export const ANTHROPIC_SCOPE =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

export const OPENAI_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_CODEX_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const OPENAI_CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const OPENAI_CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
export const OPENAI_CODEX_SCOPE = "openid profile email offline_access api.connectors.read api.connectors.invoke";
export const OPENAI_DEVICE_USERCODE_URL = "https://auth.openai.com/api/accounts/deviceauth/usercode";
export const OPENAI_DEVICE_TOKEN_URL = "https://auth.openai.com/api/accounts/deviceauth/token";
export const OPENAI_DEVICE_AUTH_URL = "https://auth.openai.com/codex/device";
export const OPENAI_DEVICE_REDIRECT_URI = "https://auth.openai.com/deviceauth/callback";

export const providerTable: AuthProviderInfo[] = [
  { id: "anthropic", label: "Anthropic Claude", kind: "oauth-pkce", ported: true },
  { id: "openai-codex", label: "OpenAI Codex", kind: "device-code", ported: true },
  { id: "cursor", label: "Cursor", kind: "oauth-pkce", ported: false },
  { id: "github-copilot", label: "GitHub Copilot", kind: "device-code", ported: false },
  { id: "google-gemini-cli", label: "Google Gemini CLI", kind: "oauth-pkce", ported: false },
  { id: "kimi", label: "Kimi", kind: "oauth-pkce", ported: false },
  { id: "xai", label: "xAI", kind: "oauth-pkce", ported: false },
];

export function buildAnthropicAuthorizeUrl(args: { state: string; challenge: string; redirectUri?: string }): string {
  const search = new URLSearchParams({
    code: "true",
    client_id: ANTHROPIC_CLIENT_ID,
    response_type: "code",
    redirect_uri: args.redirectUri ?? ANTHROPIC_REDIRECT_URI,
    scope: ANTHROPIC_SCOPE,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
    state: args.state,
  });
  return `${ANTHROPIC_AUTHORIZE_URL}?${search.toString()}`;
}

export function parseAnthropicCodeInput(input: string, fallbackState: string): { code: string; state: string } {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return {
      code: url.searchParams.get("code") ?? trimmed,
      state: url.searchParams.get("state") ?? fallbackState,
    };
  } catch {
    const codeFragmentIndex = trimmed.indexOf("#");
    if (codeFragmentIndex < 0) return { code: trimmed, state: fallbackState };
    const fragmentState = trimmed.slice(codeFragmentIndex + 1);
    return { code: trimmed.slice(0, codeFragmentIndex), state: fragmentState || fallbackState };
  }
}

export function buildAnthropicTokenRequest(args: {
  code: string;
  state: string;
  verifier: string;
  redirectUri?: string;
}): { url: string; init: RequestInit } {
  return {
    url: ANTHROPIC_TOKEN_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: ANTHROPIC_CLIENT_ID,
        code: args.code,
        state: args.state,
        redirect_uri: args.redirectUri ?? ANTHROPIC_REDIRECT_URI,
        code_verifier: args.verifier,
      }),
    },
  };
}

export function parseAnthropicTokenResponse(data: unknown, now = Date.now()): {
  token: string;
  refreshToken: string;
  account?: string;
  expiresAt: number;
} {
  if (!data || typeof data !== "object") throw new Error("Anthropic token response missing body");
  const body = data as Record<string, unknown>;
  if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    throw new Error("Anthropic token response missing tokens");
  }
  if (typeof body.expires_in !== "number") throw new Error("Anthropic token response missing expiry");
  const accountBlock = body.account && typeof body.account === "object" ? (body.account as Record<string, unknown>) : null;
  const email = accountBlock && typeof accountBlock.email_address === "string" ? accountBlock.email_address : undefined;
  const uuid = accountBlock && typeof accountBlock.uuid === "string" ? accountBlock.uuid : undefined;
  return {
    token: body.access_token,
    refreshToken: body.refresh_token,
    account: email ?? uuid,
    expiresAt: now + body.expires_in * 1000 - 5 * 60 * 1000,
  };
}

export function buildOpenAICodexAuthorizeUrl(args: {
  state: string;
  challenge: string;
  redirectUri?: string;
  originator?: string;
}): string {
  const search = new URLSearchParams({
    response_type: "code",
    client_id: OPENAI_CODEX_CLIENT_ID,
    redirect_uri: args.redirectUri ?? OPENAI_CODEX_REDIRECT_URI,
    scope: OPENAI_CODEX_SCOPE,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
    state: args.state,
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: args.originator?.trim() || "pi",
  });
  return `${OPENAI_CODEX_AUTHORIZE_URL}?${search.toString()}`;
}

export function buildOpenAICodexTokenRequest(args: {
  code: string;
  verifier: string;
  redirectUri?: string;
}): { url: string; init: RequestInit } {
  return {
    url: OPENAI_CODEX_TOKEN_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: OPENAI_CODEX_CLIENT_ID,
        code: args.code,
        code_verifier: args.verifier,
        redirect_uri: args.redirectUri ?? OPENAI_CODEX_REDIRECT_URI,
      }),
    },
  };
}

export function buildOpenAICodexDeviceStartRequest(): { url: string; init: RequestInit } {
  return {
    url: OPENAI_DEVICE_USERCODE_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: OPENAI_CODEX_CLIENT_ID }),
    },
  };
}

export function buildOpenAICodexDevicePollRequest(args: { deviceAuthId: string; userCode: string }): {
  url: string;
  init: RequestInit;
} {
  return {
    url: OPENAI_DEVICE_TOKEN_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_auth_id: args.deviceAuthId, user_code: args.userCode }),
    },
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseOpenAICodexTokenResponse(data: unknown, now = Date.now()): {
  token: string;
  refreshToken: string;
  account?: string;
  expiresAt: number;
} {
  if (!data || typeof data !== "object") throw new Error("OpenAI Codex token response missing body");
  const body = data as Record<string, unknown>;
  if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    throw new Error("OpenAI Codex token response missing tokens");
  }
  if (typeof body.expires_in !== "number") throw new Error("OpenAI Codex token response missing expiry");
  const payload = decodeJwtPayload(body.access_token);
  const profile = payload?.["https://api.openai.com/profile"];
  const auth = payload?.["https://api.openai.com/auth"];
  const email = profile && typeof profile === "object" ? (profile as Record<string, unknown>).email : undefined;
  const accountId = auth && typeof auth === "object" ? (auth as Record<string, unknown>).chatgpt_account_id : undefined;
  return {
    token: body.access_token,
    refreshToken: body.refresh_token,
    account: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : typeof accountId === "string" ? accountId : undefined,
    expiresAt: now + body.expires_in * 1000,
  };
}

export async function startAnthropicLogin(): Promise<LoginSession> {
  const state = createState();
  const pkce = await createPkce();
  const url = buildAnthropicAuthorizeUrl({ state, challenge: pkce.challenge });
  return {
    provider: "anthropic",
    instructions:
      "Open the Anthropic OAuth URL, complete sign-in, then paste the final redirect URL or code#state value here.",
    url,
    async complete(input?: string): Promise<AuthResult> {
      if (!input?.trim()) throw new Error("Anthropic OAuth completion requires a pasted redirect URL or code");
      const parsed = parseAnthropicCodeInput(input, state);
      const request = buildAnthropicTokenRequest({ code: parsed.code, state: parsed.state, verifier: pkce.verifier });
      const response = await fetch(request.url, request.init);
      if (!response.ok) throw new Error(`Anthropic token exchange failed: ${response.status}`);
      const auth = parseAnthropicTokenResponse(await response.json());
      await storeAuth("anthropic", auth);
      return { provider: "anthropic", method: "oauth", account: auth.account };
    },
  };
}

export async function startOpenAICodexLogin(): Promise<LoginSession> {
  const state = createState();
  const pkce = await createPkce();
  const url = buildOpenAICodexAuthorizeUrl({ state, challenge: pkce.challenge });
  return {
    provider: "openai-codex",
    instructions:
      "Open the OpenAI Codex OAuth URL, complete sign-in, then paste the authorization code from the callback. Headless device-code support uses the exported request builders.",
    url,
    async complete(input?: string): Promise<AuthResult> {
      const code = input?.trim();
      if (!code) throw new Error("OpenAI Codex OAuth completion requires an authorization code");
      const request = buildOpenAICodexTokenRequest({ code, verifier: pkce.verifier });
      const response = await fetch(request.url, request.init);
      if (!response.ok) throw new Error(`OpenAI Codex token exchange failed: ${response.status}`);
      const auth = parseOpenAICodexTokenResponse(await response.json());
      await storeAuth("openai-codex", auth);
      return { provider: "openai-codex", method: "oauth", account: auth.account };
    },
  };
}
