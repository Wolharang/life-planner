// The **알림** tier's time math (D40/D43/D45) — which moments a soft alert actually lands on.
//
// This is also the path a `실행` block takes on a phone the moment is *not* addressed to (D70), so it is
// not a minor tier: it is how every other phone learns the hour arrived. It had no test at all — the file
// that should have held one still contained fixtures for `ImportantEvent`, an entity D67 deleted.

import { softLeadMoments, SOFT_LEADS_MAX, type SoftAlertBlock } from "./plainReminders";

const START = new Date(2026, 6, 20, 9, 0).getTime(); // 2026-07-20 09:00 — the block's start
const min = (n: number) => n * 60_000;

const block = (over: Partial<SoftAlertBlock> = {}): SoftAlertBlock => ({
  id: "block-1",
  title: "강의",
  start: "09:00",
  alarmLeadMinutes: 10,
  ...over,
});

describe("softLeadMoments", () => {
  it("falls back to the block's own lead when the user picked no moments", () => {
    const now = START - min(60);
    expect(softLeadMoments(block(), START, now)).toEqual([START - min(10)]);
  });

  it("honours every chosen moment, earliest first", () => {
    const now = START - min(120);
    expect(softLeadMoments(block({ alertLeads: [0, 60, 15] }), START, now)).toEqual([
      START - min(60),
      START - min(15),
      START,
    ]);
  });

  it("drops a moment that has already passed rather than firing it late", () => {
    // 09:00 block, it is already 08:30 — the "1시간 전" alert would be a lie about the clock.
    const now = START - min(30);
    expect(softLeadMoments(block({ alertLeads: [60, 15] }), START, now)).toEqual([START - min(15)]);
  });

  it("says nothing at all once every chosen moment is gone", () => {
    const now = START + min(1);
    expect(softLeadMoments(block({ alertLeads: [60, 15, 0] }), START, now)).toEqual([]);
  });

  it("collapses a duplicate moment — the same buzz twice is just noise", () => {
    const now = START - min(120);
    expect(softLeadMoments(block({ alertLeads: [30, 30] }), START, now)).toEqual([START - min(30)]);
  });

  it("never schedules more than the 3 moments the tier allows", () => {
    const now = START - min(600);
    const moments = softLeadMoments(block({ alertLeads: [120, 90, 60, 30, 10] }), START, now);
    expect(moments.length).toBe(SOFT_LEADS_MAX);
    expect(moments[0]).toBe(START - min(120)); // it keeps the earliest ones
  });

  it("treats a negative or fractional lead as a real minute, not a crash", () => {
    const now = START - min(60);
    expect(softLeadMoments(block({ alertLeads: [-5, 10.4] }), START, now)).toEqual([
      START - min(10),
      START,
    ]);
  });
});
