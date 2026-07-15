// Korean public holidays (관공서 공휴일) — the "red days" the calendar colours and names.
//
// **Two layers** (D89):
//   · **BUNDLED** (`holidays.data.ts`) — every Kakao holiday **2015–2040**, generated once and baked into the
//     app. This is the base: works offline, on first run, and beyond the sync's window. Names are Kakao's
//     verbatim (새해·대체휴일·노동절·제헌절 …).
//   · **synced** — a Cloudflare Worker pulls the Kakao API for a **rolling 45 months** and serves it at a public
//     URL; each device fetches + caches it (`holidaySync.ts`) and feeds it here via `applySyncedHolidays`. It
//     **overrides** BUNDLED for the near future, so any newly-announced substitute/temporary holiday shows up
//     without an app update.
//
// `holidayName` = synced first, then BUNDLED. Weekday colouring (Sun red / Sat blue) is the caller's job; this
// module only answers "red holiday + name?".

import { BUNDLED } from "./holidays.data";

// The synced map (from the Worker, via holidaySync.ts). Null until a cache load / remote sync populates it.
let synced: Record<string, string> | null = null;
const listeners = new Set<() => void>();

/** The official-holiday name for a date ("YYYY-MM-DD"), or null. Synced map wins; BUNDLED is the base. */
export function holidayName(ymd: string): string | null {
  return synced?.[ymd] ?? BUNDLED[ymd] ?? null;
}

/** Feed in the synced {date: name} map (or null to clear). Notifies subscribers so the calendar re-renders. */
export function applySyncedHolidays(days: Record<string, string> | null): void {
  synced = days;
  for (const f of listeners) f();
}

/** Subscribe to holiday-table changes (a completed sync). Returns an unsubscribe. */
export function onHolidaysChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
