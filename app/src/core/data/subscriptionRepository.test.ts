// subscriptionDueExpenses is pure, but its module imports AsyncStorage/sync at load time — mock them so the
// import doesn't reach for a native module in Jest (same pattern as blockRepository.test).
const storage: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => storage[k] ?? null,
    setItem: async (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: async (k: string) => {
      delete storage[k];
    },
  },
}));
jest.mock("./sync", () => ({
  syncPut: () => undefined,
  syncPutMany: () => undefined,
  syncRemove: () => undefined,
}));

import { subscriptionDueExpenses, subExpenseId } from "./subscriptionRepository";
import type { Subscription } from "./types";

const ms = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 9, 0, 0).getTime();

function sub(over: Partial<Subscription> = {}): Subscription {
  const createdAt = over.createdAt ?? ms(2026, 7, 13);
  return {
    id: "s1",
    name: "넷플릭스",
    amount: 13500,
    dayOfMonth: 20,
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...over,
  };
}

const NOW = ms(2026, 7, 25);

describe("subscriptionDueExpenses", () => {
  it("returns null before the first due day (no charge, no advance)", () => {
    expect(subscriptionDueExpenses(sub(), "2026-07-13", NOW)).toBe(null);
  });

  it("generates the month's row once the due day has arrived", () => {
    const r = subscriptionDueExpenses(sub(), "2026-07-20", NOW)!;
    expect(r.expenses.length).toBe(1);
    expect(r.expenses[0].id).toBe(subExpenseId("s1", "2026-07"));
    expect([r.expenses[0].date, r.expenses[0].category, r.expenses[0].amount]).toEqual([
      "2026-07-20",
      "정기구독",
      13500,
    ]);
    expect(r.lastMonth).toBe("2026-07");
  });

  it("is forward-only: a due day that fell before creation is skipped but settled", () => {
    // created on the 20th, pays on the 5th → this month's 5th already passed before setup.
    const r = subscriptionDueExpenses(sub({ dayOfMonth: 5, createdAt: ms(2026, 7, 20) }), "2026-07-25", NOW)!;
    expect(r.expenses.length).toBe(0); // no fabricated past charge
    expect(r.lastMonth).toBe("2026-07"); // but the month is settled, so next month WILL generate
  });

  it("catches up multiple missed months since lastMonth", () => {
    const r = subscriptionDueExpenses(
      sub({ dayOfMonth: 5, createdAt: ms(2026, 7, 1), lastMonth: "2026-07" }),
      "2026-09-10",
      ms(2026, 9, 10),
    )!;
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-08-05", "2026-09-05"]);
    expect(r.lastMonth).toBe("2026-09");
  });

  it("clamps the due day to a short month's last day", () => {
    const r = subscriptionDueExpenses(
      sub({ dayOfMonth: 31, createdAt: ms(2026, 1, 1), lastMonth: "2026-01" }),
      "2026-02-28",
      ms(2026, 2, 28),
    )!;
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-02-28"]);
  });

  it("does not advance past a month whose due day is still in the future", () => {
    // lastMonth 07, today 2026-08-10, due on the 20th → 08 not due yet → nothing owed.
    expect(subscriptionDueExpenses(sub({ lastMonth: "2026-07" }), "2026-08-10", ms(2026, 8, 10))).toBe(null);
  });

  it("generates nothing while inactive", () => {
    expect(subscriptionDueExpenses(sub({ active: false }), "2026-07-20", NOW)).toBe(null);
  });
});
