import { blockFireAt, freeSlots, pastUnfiredBlocks, snapshotFor, todayYmd } from "./blockScheduler";
import type { TimeBlock } from "@/core/data/types";

jest.mock("@/core/notifications/alarm", () => ({
  alarm: {
    schedule: jest.fn(),
    cancel: jest.fn(),
  },
}));

const block = (over: Partial<TimeBlock> = {}): TimeBlock => ({
  id: "b1",
  date: "2026-08-01",
  start: "21:00",
  title: "헬스",
  kind: "workout",
  alert: "execution",
  alarmLeadMinutes: 0,
  snapStart: "21:00",
  snapTitle: "헬스",
  plannedAt: 0,
  status: "planned",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

describe("blockFireAt (R7)", () => {
  it("fires at the block's own date+start when the lead is 0", () => {
    expect(blockFireAt(block())).toBe(at(2026, 8, 1, 21, 0));
  });

  it("subtracts the lead from the LIVE start (D23 — never from the snapshot)", () => {
    expect(blockFireAt(block({ start: "21:00", snapStart: "20:00", alarmLeadMinutes: 30 }))).toBe(at(2026, 8, 1, 20, 30));
  });

  it("does not fire when the block carries no alert", () => {
    expect(blockFireAt(block({ alert: "none" }))).toBe(null);
  });

  it("does not fire on a pre-skipped block (오늘은 쉼)", () => {
    expect(blockFireAt(block({ status: "skipped" }))).toBe(null);
  });
});

describe("snapshotFor (D-1 snapshot, D23)", () => {
  const now = at(2026, 7, 20, 10, 0);
  const today = todayYmd(now);

  it("mirrors the live values while the block's date is still in the future", () => {
    const snap = snapshotFor({ date: "2026-07-21", start: "21:00", end: "22:00", title: "헬스" }, block(), now);
    expect(snap.snapStart).toBe("21:00");
    expect(snap.snapTitle).toBe("헬스");
    expect(snap.plannedAt).toBe(now);
  });

  it("freezes once the day has arrived — a same-day edit does not move the plan of record", () => {
    const prev = block({ date: today, start: "20:00", snapStart: "20:00", snapTitle: "헬스", plannedAt: 111 });
    const snap = snapshotFor({ date: today, start: "23:00", title: "헬스(미룸)" }, prev, now);
    expect(snap.snapStart).toBe("20:00");
    expect(snap.snapTitle).toBe("헬스");
    expect(snap.plannedAt).toBe(111);
  });

  it("snapshots the creation values for a block created on the day (no prior D-1 state)", () => {
    const snap = snapshotFor({ date: today, start: "13:10", title: "헬스" }, null, now);
    expect(snap.snapStart).toBe("13:10");
    expect(snap.plannedAt).toBe(now);
  });
});

describe("pastUnfiredBlocks (R6 never-fired net)", () => {
  const now = at(2026, 8, 1, 23, 0); // after the 21:00 block

  it("reconstructs a past cue that left no marker", () => {
    expect(pastUnfiredBlocks([block()], new Set(), now - 86_400_000, now).map((b) => b.id)).toEqual(["b1"]);
  });

  it("leaves alone a block the native backup will still re-fire", () => {
    expect(pastUnfiredBlocks([block()], new Set(["b1"]), now - 86_400_000, now)).toEqual([]);
  });

  it("ignores blocks with no cue and future blocks", () => {
    const future = block({ id: "b2", date: "2026-09-01" });
    const noCue = block({ id: "b3", alert: "none" });
    expect(pastUnfiredBlocks([future, noCue], new Set(), now - 86_400_000, now)).toEqual([]);
  });
});

describe("freeSlots (free-slot hint)", () => {
  it("returns the real gaps between the day's blocks", () => {
    const day = [
      block({ id: "a", start: "10:00", end: "13:00" }),
      block({ id: "b", start: "14:00", end: "19:00" }),
    ];
    expect(freeSlots(day, "07:00", "23:00", 30)).toEqual([
      { start: "07:00", end: "10:00" },
      { start: "13:00", end: "14:00" },
      { start: "19:00", end: "23:00" },
    ]);
  });

  it("drops gaps too short to be worth offering", () => {
    const day = [
      block({ id: "a", start: "07:00", end: "12:50" }),
      block({ id: "b", start: "13:00", end: "23:00" }),
    ];
    expect(freeSlots(day, "07:00", "23:00", 30)).toEqual([]);
  });
});
