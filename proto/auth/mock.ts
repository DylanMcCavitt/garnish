import { storeAuth } from "./store";
import type { AuthProviderInfo, AuthResult, LoginSession } from "./index";

export const demoKitchenProvider: AuthProviderInfo = {
  id: "demo-kitchen",
  label: "Demo Kitchen",
  kind: "mock",
  ported: true,
};

export async function startDemoKitchenLogin(): Promise<LoginSession> {
  return {
    provider: "demo-kitchen",
    instructions: "Offline demo sign-in: enter GRN-1234 to join the Demo Kitchen.",
    userCode: "GRN-1234",
    async complete(): Promise<AuthResult> {
      await Bun.sleep(300);
      await storeAuth("demo-kitchen", {
        token: "demo-kitchen-token",
        account: "chef@demo.kitchen",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      return { provider: "demo-kitchen", method: "scripted", account: "chef@demo.kitchen" };
    },
  };
}
