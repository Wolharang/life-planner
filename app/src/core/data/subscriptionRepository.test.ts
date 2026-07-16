// subscriptionDueExpenses / normalizeSubscription are pure, but the module imports AsyncStorage/sync at load
// time — mock them so the import doesn't reach for a native module in Jest (same pattern as blockRepository.test).
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

import {
  subscriptionDueExpenses,
  subExpenseId,
  normalizeSubscription,
  subscriptionScheduleLabel,
} from "./subscriptionRepository";
import type { Subscription } from "./types";

const ms = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 9, 0, 0).getTime();

function sub(over: Partial<Subscription> = {}): Subscription {
  const createdAt = over.createdAt ?? ms(2026, 7, 13);
  return {
    id: "s1",
    name: "넷플릭스",
    amount: 13500,
    frequency: "monthly",
    dayOfMonth: 20,
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...over,
  };
}

const NOW = ms(2026, 7, 25);

describe("subscriptionDueExpenses — 매월", () => {
  it("returns null before the first due day", () => {
    expect(subscriptionDueExpenses(sub(), "2026-07-13", NOW)).toBe(null);
  });

  it("generates the month's row once the due day has arrived", () => {
    const r = subscriptionDueExpenses(sub(), "2026-07-20", NOW)!;
    expect(r.expenses.length).toBe(1);
    expect(r.expenses[0].id).toBe(subExpenseId({ id: "s1", frequency: "monthly" }, "2026-07-20"));
    expect(r.expenses[0].id).toBe("sub_s1_2026-07");
    expect([r.expenses[0].date, r.expenses[0].category, r.expenses[0].amount]).toEqual([
      "2026-07-20",
      "정기구독",
      13500,
    ]);
    expect(r.lastRun).toBe("2026-07-20");
  });

  it("is forward-only: a due day before creation is not fabricated", () => {
    // created on the 20th, pays on the 5th → this month's 5th already passed before setup, next is August.
    expect(subscriptionDueExpenses(sub({ dayOfMonth: 5, createdAt: ms(2026, 7, 20) }), "2026-07-25", NOW)).toBe(null);
  });

  it("catches up multiple missed months since lastRun", () => {
    const r = subscriptionDueExpenses(
      sub({ dayOfMonth: 5, createdAt: ms(2026, 7, 1), lastRun: "2026-07-05" }),
      "2026-09-10",
      ms(2026, 9, 10),
    )!;
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-08-05", "2026-09-05"]);
    expect(r.lastRun).toBe("2026-09-05");
  });

  it("clamps the due day to a short month's last day", () => {
    const r = subscriptionDueExpenses(
      sub({ dayOfMonth: 31, createdAt: ms(2026, 1, 1), lastRun: "2026-01-31" }),
      "2026-02-28",
      ms(2026, 2, 28),
    )!;
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-02-28"]);
  });

  it("does not fire a month whose due day is still in the future", () => {
    expect(subscriptionDueExpenses(sub({ lastRun: "2026-07-20" }), "2026-08-10", ms(2026, 8, 10))).toBe(null);
  });
});

describe("subscriptionDueExpenses — 매일 / 매주", () => {
  it("매일 emits one row per day since lastRun, keyed by date", () => {
    const r = subscriptionDueExpenses(
      sub({ frequency: "daily", dayOfMonth: undefined, createdAt: ms(2026, 7, 1), lastRun: "2026-07-10" }),
      "2026-07-13",
      ms(2026, 7, 13),
    )!;
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-07-11", "2026-07-12", "2026-07-13"]);
    expect(r.expenses[0].id).toBe("sub_s1_2026-07-11");
    expect(r.lastRun).toBe("2026-07-13");
  });

  it("매주 emits only the chosen weekday's occurrences", () => {
    const W = new Date(2026, 6, 13).getDay(); // whatever weekday 2026-07-13 is
    const r = subscriptionDueExpenses(
      sub({ frequency: "weekly", weekday: W, dayOfMonth: undefined, createdAt: ms(2026, 7, 1), lastRun: "2026-07-06" }),
      "2026-07-20",
      ms(2026, 7, 20),
    )!;
    // 07-13 and 07-20 are 7 days apart → same weekday as 07-13.
    expect(r.expenses.map((e) => e.date)).toEqual(["2026-07-13", "2026-07-20"]);
    expect(r.lastRun).toBe("2026-07-20");
  });

  it("generates nothing while inactive", () => {
    expect(subscriptionDueExpenses(sub({ active: false }), "2026-07-20", NOW)).toBe(null);
  });
});

describe("normalizeSubscription (legacy D96 → D98)", () => {
  it("defaults missing frequency to monthly and derives lastRun from lastMonth", () => {
    const legacy = { id: "x", name: "n", amount: 1, dayOfMonth: 20, active: true, lastMonth: "2026-07", createdAt: 1, updatedAt: 1 } as Subscription;
    const n = normalizeSubscription(legacy);
    expect([n.frequency, n.lastRun]).toEqual(["monthly", "2026-07-20"]);
  });

  it("clamps the derived lastRun to a short month", () => {
    const legacy = { id: "x", name: "n", amount: 1, dayOfMonth: 31, active: true, lastMonth: "2026-02", createdAt: 1, updatedAt: 1 } as Subscription;
    expect(normalizeSubscription(legacy).lastRun).toBe("2026-02-28");
  });
});

describe("subscriptionScheduleLabel", () => {
  it("reads each cadence back in the user's words", () => {
    expect(subscriptionScheduleLabel(sub({ frequency: "monthly", dayOfMonth: 11 }))).toBe("매월 11일");
    expect(subscriptionScheduleLabel(sub({ frequency: "weekly", weekday: 0 }))).toBe("매주 일요일");
    expect(subscriptionScheduleLabel(sub({ frequency: "daily" }))).toBe("매일");
  });
});
