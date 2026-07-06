# Auth OMP slice findings

## Verdict

Founder decision reverses ADR-12 for the prototype: API keys stay as env/file fallback, but subscription OAuth is now in scope for the same provider ids OMP exposes. I ported the OAuth registry shape and the executable, network-boundary machinery for Anthropic and OpenAI Codex while keeping tests keyless and offline.

## OMP flow requirements observed

- OMP package reference: `@oh-my-pi/pi-ai@16.2.13`, license `MIT` in its `package.json`. I used it as a shape/reference source only; no source files were vendored wholesale.
- Anthropic (`anthropic`):
  - Client id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`.
  - Authorize endpoint: `https://claude.ai/oauth/authorize`.
  - Token endpoint: `https://api.anthropic.com/v1/oauth/token`.
  - Callback server shape in OMP: localhost port `54545`, path `/callback`; prototype supports manual paste of the final redirect URL or `code#state` and builds the same redirect URI shape.
  - Scopes: `org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload`.
  - PKCE: S256 challenge with a generated verifier; token exchange JSON body includes `grant_type=authorization_code`, `client_id`, `code`, `state`, `redirect_uri`, and `code_verifier`.
  - Response parsing: stores `access_token`, `refresh_token`, `expires_in` with OMP's five-minute expiry safety margin, and lifts `account.email_address`/`account.uuid` when present. OMP can also recover identity from `https://api.anthropic.com/api/claude_cli/bootstrap?entrypoint=cli&model=claude-opus-4-8`.
  - Refresh: OMP posts JSON to the same token endpoint with `grant_type=refresh_token`, `client_id`, and `refresh_token`, plus `anthropic-beta: oauth-2025-04-20` and `User-Agent: anthropic-sdk-typescript/0.94.0 userOAuthProvider`.
- OpenAI Codex (`openai-codex`):
  - Client id: `app_EMoamEEZ73f0CkXaXp7hrann`.
  - Browser authorize endpoint: `https://auth.openai.com/oauth/authorize`.
  - Token endpoint: `https://auth.openai.com/oauth/token`.
  - Fixed browser callback shape in OMP: localhost port `1455`, path `/auth/callback`; OMP does not allow random-port fallback because the redirect URI is allowlisted.
  - Scope: `openid profile email offline_access api.connectors.read api.connectors.invoke`.
  - Browser authorize params include `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, and originator `pi`.
  - Token exchange uses `application/x-www-form-urlencoded` with `authorization_code`, client id, code verifier, and redirect URI.
  - Device flow endpoints: start at `https://auth.openai.com/api/accounts/deviceauth/usercode`, poll `https://auth.openai.com/api/accounts/deviceauth/token`, user URL `https://auth.openai.com/codex/device`, token redirect URI `https://auth.openai.com/deviceauth/callback`.
  - Device polling returns `authorization_code` + `code_verifier`, then OMP reuses the standard token exchange.
  - Account extraction: OMP decodes the access-token JWT and reads `https://api.openai.com/auth.chatgpt_account_id` plus `https://api.openai.com/profile.email`.
  - Refresh: OMP posts form data to the token endpoint with `grant_type=refresh_token`, `refresh_token`, and `client_id`.
- Other parity ids present but intentionally metadata-only in this prototype: `cursor`, `github-copilot`, `google-gemini-cli`, `kimi`, `xai`.
- Offline/demo provider: `demo-kitchen` is a mock provider with fake user code `GRN-1234`; it stores a fake token and returns scripted account `chef@demo.kitchen` for tutorial/demo use without network calls.

## ADR-12 reversal implications and risk notes

- ADR-12's no-OAuth clause is no longer true for founder-facing proto v2. Env keys remain highest precedence and the legacy `0600` key file still works, but OAuth store lookup now fills the gap after env vars.
- OAuth token storage is more sensitive than the earlier API-key-only story because refresh tokens enable long-lived account access. The proto store is local JSON at `GARNISH_PROTO_AUTH_FILE` or `~/.config/garnish-proto/oauth.json`, rejects non-`0600` reads, and writes with `0600`, but this is still a prototype storage posture rather than a hardened credential vault.
- ToS/product risk: these are subscription-user OAuth flows exposed by OMP-compatible clients. The prototype should treat them as user-authorized interactive login, not service-account or shared-key infrastructure. Shipping this beyond demos needs an explicit policy review per provider, especially for refresh, account pooling, and any use that looks like API-key substitution.
- The callback-server vs manual-paste difference matters operationally. OMP opens local callback servers for the smooth path; this prototype builds the same URLs and exchange bodies but uses manual completion to avoid adding a live local server to the throwaway slice.

## Adapter changes real OAuth tokens need

- `proto/providers/auth.ts` now maps stored OAuth access tokens into `{ apiKey: token }` only as a compatibility seam so existing adapters can be exercised without changing their headers in this slice.
- Real Anthropic OAuth inference is not `x-api-key`. OMP's Anthropic OAuth path uses `Authorization: Bearer <access_token>` plus `anthropic-beta: oauth-2025-04-20` for OAuth-token requests. LOO-157 should be re-scoped to teach the Anthropic adapter to distinguish API keys from OAuth credentials and emit Bearer + beta headers instead of blindly placing the token in `x-api-key`.
- OpenAI Codex similarly wants Codex-specific headers/claims and token refresh semantics rather than pretending the access token is a platform API key. The provider adapter should carry credential kind/provenance once this leaves the prototype.

## Proof run

- `bun test ./proto/auth ./proto/providers` passed keyless: auth PKCE/store/mock/registry/request fixtures plus existing provider tests.
- TypeScript slice check was run with `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep 'proto/auth\|proto/providers/auth'`; after fixes it produced no matching diagnostics.
