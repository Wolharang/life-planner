import type { Task } from "@/core/data/types";
import { nextEffectiveFireAt, occurrenceDateForFire, pastOccurrenceFires } from "./taskScheduler";

jest.mock("@/core/notifications/alarm", () => ({
  alarm: {
    schedule: jest.fn(),
    cancel: jest.fn(),
  },
}));

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  title: "헬스",
  setTime: "21:00",
  microStartNote: "지금 신발 신기",
  executionAlarm: true,
  leadMinutes: 0,
  plainReminderOffsets: [],
  recurrence: "none",
  createdAt: new Date("2026-07-10T09:00:00+09:00").getTime(),
  ...overrides,
});

describe("taskScheduler", () => {
  it("returns an immediate past effective time when lead already passed but set time is still future", () => {
    const now = new Date("2026-07-10T20:45:00+09:00").getTime();
    const fireAt = nextEffectiveFireAt(task({ setTime: "21:00", leadMinutes: 30, recurrence: "daily" }), now);

    expect(fireAt).toBe(new Date("2026-07-10T20:30:00+09:00").getTime());
  });

  it("skips only the explicitly skipped occurrence date", () => {
    const now = new Date("2026-07-10T08:00:00+09:00").getTime();
    const fireAt = nextEffectiveFireAt(
      task({ setTime: "09:00", recurrence: "daily", skippedDates: ["2026-07-10"] }),
      now
    );

    expect(fireAt).toBe(new Date("2026-07-11T09:00:00+09:00").getTime());
  });

  it("anchors weekly past occurrence reconstruction on the armed occurrence weekday", () => {
    const now = new Date("2026-07-24T22:00:00+09:00").getTime();
    const anchor = new Date("2026-07-31T21:00:00+09:00").getTime();
    const out = pastOccurrenceFires(
      task({ recurrence: "weekly", setTime: "21:00", createdAt: new Date("2026-07-01T00:00:00+09:00").getTime() }),
      anchor,
      new Date("2026-07-01T00:00:00+09:00").getTime(),
      now
    );

    expect(out.map((o) => o.date)).toEqual(["2026-07-24", "2026-07-17", "2026-07-10", "2026-07-03"]);
  });

  it("uses the set-time date as the occurrence date when lead crosses midnight", () => {
    const fireAt = new Date("2026-07-09T23:40:00+09:00").getTime();

    expect(occurrenceDateForFire(fireAt, 30)).toBe("2026-07-10");
  });
});
