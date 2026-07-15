// Korean public holidays (관공서 공휴일) — the "red days" the calendar colours and names.
//
// Two kinds:
//   · **Fixed solar** dates recur every year → keyed by "MM-DD".
//   · **Lunar-derived** (설날·추석·부처님오신날) and **substitute** (대체공휴일)/temporary (임시공휴일) holidays
//     move every year, so they are a hand-maintained per-year table keyed by full "YYYY-MM-DD".
//
// The lunar/substitute table currently covers **2025–2026**; extend it each year (there is no lunar-calendar
// math here on purpose — a wrong computed date is worse than a known table). Weekday colouring (Sun red / Sat
// blue) is handled by the caller; this module only answers "is this an official red holiday, and its name?".

const FIXED: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};

// Lunar + substitute + temporary holidays, by exact date. 대체공휴일 = the make-up day when a national holiday
// falls on a weekend/overlaps; 현충일 and 신정 never get one.
const DATED: Record<string, string> = {
  // 2025
  "2025-01-27": "임시공휴일",
  "2025-01-28": "설날",
  "2025-01-29": "설날",
  "2025-01-30": "설날",
  "2025-03-03": "대체공휴일", // 삼일절(토)
  "2025-05-06": "대체공휴일", // 어린이날·부처님오신날(5/5) 겹침
  "2025-10-05": "추석",
  "2025-10-06": "추석",
  "2025-10-07": "추석",
  "2025-10-08": "대체공휴일", // 추석 연휴가 일요일 포함
  // 2026
  "2026-02-16": "설날",
  "2026-02-17": "설날",
  "2026-02-18": "설날",
  "2026-03-02": "대체공휴일", // 삼일절(일)
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일", // 부처님오신날(일)
  "2026-08-17": "대체공휴일", // 광복절(토)
  "2026-09-24": "추석",
  "2026-09-25": "추석",
  "2026-09-26": "추석",
  "2026-09-28": "대체공휴일", // 추석 연휴가 토·일 포함
  "2026-10-05": "대체공휴일", // 개천절(토)
};

/** The official-holiday name for a date ("YYYY-MM-DD"), or null. Sundays/Saturdays are NOT holidays here. */
export function holidayName(ymd: string): string | null {
  return DATED[ymd] ?? FIXED[ymd.slice(5)] ?? null;
}
