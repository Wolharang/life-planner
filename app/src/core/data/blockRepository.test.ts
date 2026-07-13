// The alarm reconciliation that runs on every app open — and, since F0, on every Firestore snapshot.
// It once cancelled the R7 re-check as if it were a ghost, which is the single worst thing this file can do:
// the moment never comes back, and the block quietly becomes a miss.

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

const scheduled: { id: string }[] = [];
const cancelled: string[] = [];
jest.mock("@/core/notifications/alarm", () => ({
  alarm: {
    getScheduled: () => scheduled,
    schedule: () => undefined,
    cancel: (id: string) => {
      cancelled.push(id);
    },
  },
}));
jest.mock("@/core/notifications/plainReminders", () => ({
  cancelReminders: async () => undefined,
  cancelBlockSoftAlert: async () => undefined,
  scheduleBlockSoftAlert: async () => undefined,
}));
jest.mock("./sync", () => ({
  syncPut: () => undefined,
  syncPutMany: () => undefined,
  syncRemove: () => undefined,
}));

import { rearmBlockAlarms } from "./blockRepository";
import type { TimeBlock } from "./types";

const block = (id: string): TimeBlock => ({
  id,
  date: "2026-08-01",
  start: "21:00",
  title: "헬스",
  kind: "workout",
  alert: "execution",
  alarmLeadMinutes: 0,
  snapStart: "21:00",
  snapTitle: "헬스",
  plannedAt: 0,
  status: "planned", // still open — its re-check may be in flight
  createdAt: 0,
  updatedAt: 0,
});

describe("rearmBlockAlarms — the orphan sweep must not eat the R7 re-check", () => {
  it("an in-flight '<id>#recheck' survives a re-arm (it is not an orphan — it has no block of its own, by design)", async () => {
    storage["lp.blocks.v1"] = JSON.stringify([block("b1")]);
    scheduled.length = 0;
    scheduled.push({ id: "b1" }, { id: "b1#recheck" }); // the native moment armed the follow-up itself
    cancelled.length = 0;

    await rearmBlockAlarms();

    // Cancelling this is what made the moment never come back and the block fall to the catch-up net.
    expect(cancelled.includes("b1#recheck")).toBe(false);
  });

  it("an alarm whose block is gone IS an orphan — both it and its re-check are evicted", async () => {
    storage["lp.blocks.v1"] = JSON.stringify([block("b1")]);
    scheduled.length = 0;
    scheduled.push({ id: "ghost" }, { id: "ghost#recheck" });
    cancelled.length = 0;

    await rearmBlockAlarms();

    expect(cancelled.includes("ghost")).toBe(true);
    expect(cancelled.includes("ghost#recheck")).toBe(true);
  });
});
