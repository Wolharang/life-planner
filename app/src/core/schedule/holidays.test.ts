import { holidayName } from "./holidays";

describe("holidayName", () => {
  it("names fixed solar holidays every year (by MM-DD)", () => {
    expect(holidayName("2026-01-01")).toBe("신정");
    expect(holidayName("2027-01-01")).toBe("신정");
    expect(holidayName("2026-03-01")).toBe("삼일절");
    expect(holidayName("2026-06-06")).toBe("현충일");
    expect(holidayName("2026-12-25")).toBe("성탄절");
  });

  it("names 2026 lunar + substitute holidays", () => {
    expect(holidayName("2026-02-17")).toBe("설날"); // 설날 당일
    expect(holidayName("2026-03-02")).toBe("대체공휴일"); // 삼일절(일) 대체
    expect(holidayName("2026-05-24")).toBe("부처님오신날");
    expect(holidayName("2026-08-17")).toBe("대체공휴일"); // 광복절(토) 대체
    expect(holidayName("2026-09-25")).toBe("추석");
    expect(holidayName("2026-09-28")).toBe("대체공휴일"); // 추석 대체
  });

  it("returns null for ordinary days", () => {
    expect(holidayName("2026-07-15")).toBe(null);
    expect(holidayName("2026-02-19")).toBe(null); // day after 설날 연휴
  });
});
