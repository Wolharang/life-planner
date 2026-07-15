// Device side of the synced holiday table (D89). The source is a **Cloudflare Worker** (Cron Trigger pulls the
// Kakao holidays API into KV; the admin key lives only as a Wrangler secret, never here). This module fetches the
// Worker's public JSON endpoint — `{ version, days: { "YYYY-MM-DD": name } }` — and feeds `holidays.ts`.
//
// Cheap by design: the Worker sends an ETag (`"v<version>"`), we send `If-None-Match`, so an unchanged table
// returns **304 with no body**. The device caches the last {etag, days} in AsyncStorage; `holidayName` reads the
// in-memory map and falls back to the bundled table when there has never been a successful sync.
//
// Best-effort, like the rest: no URL configured (Worker not deployed yet), offline, or a fetch error all just
// keep the cached-or-bundled table. Holidays are never on the critical path.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { applySyncedHolidays } from "@/core/schedule/holidays";

const CACHE_KEY = "lp.holidays.v1";
// The Worker's public URL, set in app.json → extra.holidaysUrl after `wrangler deploy`. Empty = not wired yet.
const HOLIDAYS_URL: string =
  (Constants.expoConfig?.extra as { holidaysUrl?: string } | undefined)?.holidaysUrl ?? "";

let lastEtag: string | null = null;

/** Load the cache into memory immediately, then kick a best-effort remote check. Call once at app start. */
export async function initHolidays(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { etag?: string; days?: Record<string, string> };
      lastEtag = c.etag ?? null;
      if (c.days) applySyncedHolidays(c.days);
    }
  } catch {
    // a corrupt cache just means we fall back to the bundled table
  }
  void syncHolidays();
}

/** Fetch the Worker's table; a 304 (ETag unchanged) costs no body and does nothing. */
export async function syncHolidays(): Promise<void> {
  if (!HOLIDAYS_URL) return; // Worker not deployed / not wired → bundled fallback
  try {
    const res = await fetch(HOLIDAYS_URL, lastEtag ? { headers: { "If-None-Match": lastEtag } } : undefined);
    if (res.status === 304) return; // unchanged
    if (!res.ok) return;
    const etag = res.headers.get("etag");
    const json = (await res.json()) as { days?: Record<string, string> };
    if (!json?.days) return;
    // Defense-in-depth against bad data (the Worker guards too): a 45-month table is ~55–90 dates. If it's
    // implausible, ignore it and keep the bundled/cached table rather than paint every day red.
    const n = Object.keys(json.days).length;
    if (n < 30 || n > 300) return;
    lastEtag = etag;
    applySyncedHolidays(json.days);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ etag, days: json.days }));
  } catch {
    // offline / not deployed / transient — the cached-or-bundled table stays in effect
  }
}
