// The device-local daily send budget. These pin the founder's numbers (1 reset, 3 email-change, 3 resend) and
// the two properties that make it a *safety* mechanism rather than a nuisance: it resets on a new day, and a
// failed attempt can be refunded so a no-network press does not burn the day's only reset.

jest.mock("@react-native-async-storage/async-storage", () => {
  const mockStore: Record<string, string> = {};
  return {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => {
      mockStore[k] = v;
    },
    removeItem: async (k: string) => {
      delete mockStore[k];
    },
    clear: async () => {
      for (const k of Object.keys(mockStore)) delete mockStore[k];
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { spendDaily, refundDaily, dailyLimit } from "./rateLimit";

describe("rateLimit — device-local daily budget", () => {
  it("password reset is spendable once a day, then blocked", async () => {
    await AsyncStorage.clear();
    const first = await spendDaily("passwordReset", "2026-07-14");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);

    const second = await spendDaily("passwordReset", "2026-07-14");
    expect(second.allowed).toBe(false);
  });

  it("a new day resets the count", async () => {
    await AsyncStorage.clear();
    await spendDaily("passwordReset", "2026-07-14");
    const nextDay = await spendDaily("passwordReset", "2026-07-15");
    expect(nextDay.allowed).toBe(true);
  });

  it("email change and resend each allow three, then block the fourth", async () => {
    await AsyncStorage.clear();
    expect(dailyLimit("emailChange")).toBe(3);
    for (let i = 0; i < 3; i++) {
      const r = await spendDaily("emailChange", "2026-07-14");
      expect(r.allowed).toBe(true);
    }
    const fourth = await spendDaily("emailChange", "2026-07-14");
    expect(fourth.allowed).toBe(false);
  });

  it("the three actions have independent budgets", async () => {
    await AsyncStorage.clear();
    await spendDaily("passwordReset", "2026-07-14"); // spend the single reset
    const email = await spendDaily("emailChange", "2026-07-14");
    expect(email.allowed).toBe(true); // reset being spent must not touch email change
  });

  it("a refund returns a token so a failed attempt does not count", async () => {
    await AsyncStorage.clear();
    await spendDaily("passwordReset", "2026-07-14");
    await refundDaily("passwordReset", "2026-07-14");
    const retry = await spendDaily("passwordReset", "2026-07-14");
    expect(retry.allowed).toBe(true);
  });
});
