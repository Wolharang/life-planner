import { holidayName, applySyncedHolidays } from "./holidays";

// The bundled table (holidays.data.ts) is Kakao's data 2015–2040, verbatim — so names are Kakao's
// (새해, 크리스마스, 대체휴일…), not the older hand-table wording.
describe("holidayName (bundled Kakao table)", () => {
  it("names 2026 holidays as Kakao provides them", () => {
    expect(holidayName("2026-01-01")).toBe("새해");
    expect(holidayName("2026-03-01")).toBe("삼일절");
    expect(holidayName("2026-02-17")).toBe("설날");
    expect(holidayName("2026-03-02")).toBe("대체휴일");
    expect(holidayName("2026-05-24")).toBe("부처님오신날");
    expect(holidayName("2026-07-17")).toBe("제헌절"); // Kakao marks it a holiday; we take it as-is
    expect(holidayName("2026-08-17")).toBe("대체휴일");
    expect(holidayName("2026-09-25")).toBe("추석");
    expect(holidayName("2026-12-25")).toBe("크리스마스");
  });

  it("covers the full 2015–2040 range", () => {
    expect(holidayName("2015-01-01")).toBe("새해");
    expect(holidayName("2040-12-25")).toBe("크리스마스");
  });

  it("returns null for ordinary days", () => {
    expect(holidayName("2026-07-15")).toBe(null);
    expect(holidayName("2026-02-19")).toBe(null); // day after 설날 연휴
    expect(holidayName("2026-09-28")).toBe(null); // Kakao lists no 추석 substitute in 2026 — we defer to Kakao
  });

  it("lets the synced map override the bundled table", () => {
    applySyncedHolidays({ "2026-07-15": "테스트공휴일" });
    expect(holidayName("2026-07-15")).toBe("테스트공휴일"); // synced wins
    expect(holidayName("2026-01-01")).toBe("새해"); // falls through to bundled when synced lacks it
    applySyncedHolidays(null); // reset for other tests
  });
});
