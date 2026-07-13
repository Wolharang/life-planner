// R3 — when an important event's soft advance alert fires. Pure time math only (the scheduling call
// itself is a best-effort expo-notifications side-effect, exercised on device).

import { eventNotifyAt } from "./plainReminders";
import type { ImportantEvent } from "@/core/data/types";

const ev = (over: Partial<ImportantEvent> = {}): ImportantEvent => ({
  id: "event-1",
  title: "알바",
  date: "2026-08-01",
  time: "14:00",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

describe("eventNotifyAt (R3)", () => {
  const now = at(2026, 7, 20, 9, 0); // well before the event

  it("counts the lead back from the event's local date+time", () => {
    expect(eventNotifyAt(ev(), 30, now)).toBe(at(2026, 8, 1, 13, 30));
  });

  it("supports a day-ahead lead (하루 전)", () => {
    expect(eventNotifyAt(ev(), 1440, now)).toBe(at(2026, 7, 31, 14, 0));
  });

  it("fires at the event time itself when the lead is 0 (정각)", () => {
    expect(eventNotifyAt(ev(), 0, now)).toBe(at(2026, 8, 1, 14, 0));
  });

  it("gives an untimed event no alert — there is no moment to count back from", () => {
    expect(eventNotifyAt(ev({ time: undefined }), 30, now)).toBe(null);
  });

  it("skips a moment that has already passed", () => {
    expect(eventNotifyAt(ev(), 30, at(2026, 8, 1, 13, 45))).toBe(null);
  });
});
