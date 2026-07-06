import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveAuth } from "../providers/auth";
import {
  ANTHROPIC_AUTHORIZE_URL,
  ANTHROPIC_CLIENT_ID,
  ANTHROPIC_REDIRECT_URI,
  ANTHROPIC_SCOPE,
  ANTHROPIC_TOKEN_URL,
  OPENAI_CODEX_CLIENT_ID,
  buildAnthropicAuthorizeUrl,
  buildAnthropicTokenRequest,
  buildOpenAICodexDevicePollRequest,
  buildOpenAICodexDeviceStartRequest,
  buildOpenAICodexTokenRequest,
  codeChallenge,
  getStoredAuth,
  listAuthProviders,
  parseAnthropicCodeInput,
  parseAnthropicTokenResponse,
  parseOpenAICodexTokenResponse,
  startLogin,
  storeAuth,
} from "./index";

const envSnapshot = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
});

test("pkce S256 challenge matches the RFC vector", async () => {
  expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("store writes 0600 and refuses wrong-mode reads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "garnish-oauth-store-"));
  try {
    process.env.GARNISH_PROTO_AUTH_FILE = join(dir, "oauth.json");
    await storeAuth("anthropic", { token: "oauth-token", refreshToken: "refresh", account: "chef@example.test" });
    expect(statSync(process.env.GARNISH_PROTO_AUTH_FILE).mode & 0o777).toBe(0o600);
    expect(getStoredAuth("anthropic")?.token).toBe("oauth-token");

    await chmod(process.env.GARNISH_PROTO_AUTH_FILE, 0o644);
    expect(getStoredAuth("anthropic")).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mock Demo Kitchen flow completes offline and stores token", async () => {
  const dir = mkdtempSync(join(tmpdir(), "garnish-demo-auth-"));
  try {
    process.env.GARNISH_PROTO_AUTH_FILE = join(dir, "oauth.json");
    const session = await startLogin("demo-kitchen");
    expect(session.userCode).toBe("GRN-1234");
    const before = Date.now();
    await expect(session.complete()).resolves.toEqual({
      provider: "demo-kitchen",
      method: "scripted",
      account: "chef@demo.kitchen",
    });
    expect(Date.now() - before).toBeGreaterThanOrEqual(250);
    expect(getStoredAuth("demo-kitchen")?.token).toBe("demo-kitchen-token");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("registry lists omp-parity OAuth ids plus the offline demo provider", () => {
  const providers = listAuthProviders();
  expect(providers.find((provider) => provider.id === "demo-kitchen")).toMatchObject({ kind: "mock", ported: true });
  for (const id of ["anthropic", "openai-codex", "cursor", "github-copilot", "google-gemini-cli", "kimi", "xai"]) {
    expect(providers.map((provider) => provider.id)).toContain(id);
  }
  expect(providers.find((provider) => provider.id === "anthropic")).toMatchObject({ kind: "oauth-pkce", ported: true });
  expect(providers.find((provider) => provider.id === "openai-codex")).toMatchObject({
    kind: "device-code",
    ported: true,
  });
});

test("anthropic authorize URL and token exchange request match omp shape", () => {
  const url = new URL(buildAnthropicAuthorizeUrl({ state: "state-123", challenge: "challenge-456" }));
  expect(`${url.origin}${url.pathname}`).toBe(ANTHROPIC_AUTHORIZE_URL);
  expect(url.searchParams.get("code")).toBe("true");
  expect(url.searchParams.get("client_id")).toBe(ANTHROPIC_CLIENT_ID);
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("redirect_uri")).toBe(ANTHROPIC_REDIRECT_URI);
  expect(url.searchParams.get("scope")).toBe(ANTHROPIC_SCOPE);
  expect(url.searchParams.get("code_challenge")).toBe("challenge-456");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toBe("state-123");

  expect(parseAnthropicCodeInput("code-from-page#state-from-page", "fallback")).toEqual({
    code: "code-from-page",
    state: "state-from-page",
  });

  const request = buildAnthropicTokenRequest({ code: "auth-code", state: "state-123", verifier: "verifier-789" });
  expect(request.url).toBe(ANTHROPIC_TOKEN_URL);
  expect(request.init.method).toBe("POST");
  expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
  expect(JSON.parse(String(request.init.body))).toEqual({
    grant_type: "authorization_code",
    client_id: ANTHROPIC_CLIENT_ID,
    code: "auth-code",
    state: "state-123",
    redirect_uri: ANTHROPIC_REDIRECT_URI,
    code_verifier: "verifier-789",
  });

  expect(
    parseAnthropicTokenResponse(
      {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        account: { uuid: "acct_123", email_address: "chef@example.test" },
      },
      1_000,
    ),
  ).toEqual({ token: "access-token", refreshToken: "refresh-token", account: "chef@example.test", expiresAt: 3_301_000 });
});

test("openai codex request builders and JWT account extraction match omp outline", () => {
  const tokenRequest = buildOpenAICodexTokenRequest({ code: "auth-code", verifier: "verifier" });
  expect(tokenRequest.url).toBe("https://auth.openai.com/oauth/token");
  expect(tokenRequest.init.method).toBe("POST");
  expect(tokenRequest.init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
  expect(String(tokenRequest.init.body)).toBe(
    `grant_type=authorization_code&client_id=${OPENAI_CODEX_CLIENT_ID}&code=auth-code&code_verifier=verifier&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback`,
  );

  expect(buildOpenAICodexDeviceStartRequest()).toMatchObject({
    url: "https://auth.openai.com/api/accounts/deviceauth/usercode",
    init: { method: "POST", headers: { "Content-Type": "application/json" } },
  });
  expect(JSON.parse(String(buildOpenAICodexDevicePollRequest({ deviceAuthId: "device", userCode: "CODE" }).init.body))).toEqual({
    device_auth_id: "device",
    user_code: "CODE",
  });

  const payload = Buffer.from(
    JSON.stringify({
      "https://api.openai.com/auth": { chatgpt_account_id: "chatgpt-account" },
      "https://api.openai.com/profile": { email: "CHEF@EXAMPLE.TEST" },
    }),
  ).toString("base64url");
  expect(
    parseOpenAICodexTokenResponse({ access_token: `header.${payload}.sig`, refresh_token: "refresh", expires_in: 10 }, 2_000),
  ).toEqual({ token: `header.${payload}.sig`, refreshToken: "refresh", account: "chef@example.test", expiresAt: 12_000 });
});

test("provider auth falls through from env to oauth store before legacy key file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "garnish-provider-oauth-"));
  try {
    const authFile = join(dir, "oauth.json");
    process.env.GARNISH_PROTO_AUTH_FILE = authFile;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await writeFile(authFile, JSON.stringify({ anthropic: { token: "anthropic-oauth" }, "openai-codex": { token: "openai-oauth" } }));
    await chmod(authFile, 0o600);

    expect(resolveAuth("anthropic")).toEqual({ apiKey: "anthropic-oauth" });
    expect(resolveAuth("openai")).toEqual({ apiKey: "openai-oauth" });

    process.env.ANTHROPIC_API_KEY = "env-wins";
    expect(resolveAuth("anthropic")).toEqual({ apiKey: "env-wins" });
    expect(await readFile(authFile, "utf8")).toContain("anthropic-oauth");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
