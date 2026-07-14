// **아침 요약** — what the day's one silent briefing actually says.
//
// The text is not decoration: the calendar shows this exact function's output back to the user as a preview,
// and *a preview that is not the real thing is just another promise to check later.* So the composition is
// pinned here, and the two ways a briefing goes wrong with it:
//
//   · listing a block that opted out — a briefing that repeats a standing 강의 every morning is a briefing
//     nobody reads by the third day;
//   · arriving with nothing to say — an empty notification at 7am is worse than none.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => undefined },
}));

import { briefBody, briefTitle, inBrief } from "./morningBrief";
import type { TimeBlock } from "@/core/data/types";

const b = (over: Partial<TimeBlock>): TimeBlock =>
  ({
    id: over.title ?? "x",
    date: "2026-07-15",
    start: "09:00",
    title: "일정",
    kind: "normal",
    alert: "none",
    alarmLeadMinutes: 0,
    snapStart: "09:00",
    snapTitle: "일정",
    plannedAt: 0,
    status: "planned",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as TimeBlock;

describe("아침 요약", () => {
  it("includes a block by default — a block you put in the day IS what the day holds", () => {
    expect(inBrief(b({ title: "헬스" }))).toBe(true);
    expect(inBrief(b({ title: "강의", inBrief: true }))).toBe(true);
  });

  it("leaves out the ones that opted out", () => {
    expect(inBrief(b({ title: "강의", inBrief: false }))).toBe(false);

    const blocks = [
      b({ title: "헬스", start: "07:30" }),
      b({ title: "강의", start: "10:00", inBrief: false }),
    ];
    expect(briefBody(blocks)).toBe("07:30 헬스");
    expect(briefTitle(blocks)).toBe("오늘 일정 1개");
  });

  it("reads in clock order, whatever order the blocks were written in", () => {
    const blocks = [
      b({ title: "저녁 러닝", start: "19:00" }),
      b({ title: "헬스", start: "07:30" }),
      b({ title: "회의", start: "13:00" }),
    ];
    expect(briefBody(blocks)).toBe("07:30 헬스\n13:00 회의\n19:00 저녁 러닝");
  });

  it("has nothing to say when every block opted out — and the scheduler must then send nothing", () => {
    const blocks = [b({ title: "강의", inBrief: false }), b({ title: "이동", inBrief: false })];
    expect(briefBody(blocks)).toBe("");
    expect(briefTitle(blocks)).toBe("오늘 일정 0개");
  });
});
