import { existsSync, readFileSync, statSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface StoredAuth {
  token: string;
  refreshToken?: string;
  account?: string;
  expiresAt?: number;
}

export type AuthStore = Record<string, StoredAuth>;

export function authStorePath(): string {
  return process.env.GARNISH_PROTO_AUTH_FILE ?? join(homedir(), ".config", "garnish-proto", "oauth.json");
}

function isStoredAuth(value: unknown): value is StoredAuth {
  if (!value || typeof value !== "object") return false;
  const auth = value as Record<string, unknown>;
  return (
    typeof auth.token === "string" &&
    auth.token.length > 0 &&
    (auth.refreshToken === undefined || typeof auth.refreshToken === "string") &&
    (auth.account === undefined || typeof auth.account === "string") &&
    (auth.expiresAt === undefined || typeof auth.expiresAt === "number")
  );
}

export function readAuthStore(path = authStorePath()): AuthStore {
  let stat: { mode: number; isFile(): boolean };
  try {
    stat = statSync(path);
  } catch {
    return {};
  }
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const store: AuthStore = {};
    for (const [provider, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isStoredAuth(value)) store[provider] = value;
    }
    return store;
  } catch {
    return {};
  }
}

export function getStoredAuth(provider: string): StoredAuth | null {
  return readAuthStore()[provider] ?? null;
}

export async function writeAuthStore(store: AuthStore, path = authStorePath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  if (existsSync(path)) await chmod(path, 0o600);
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function storeAuth(provider: string, auth: StoredAuth): Promise<void> {
  const store = readAuthStore();
  store[provider] = auth;
  await writeAuthStore(store);
}
