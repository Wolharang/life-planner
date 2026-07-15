// Device side of the synced holiday table (D89). The GitHub Action publishes two Firestore docs:
//   · config/holidays_meta  { version: number, count, updatedAt }   ← tiny; read every time
//   · config/holidays_data  { days: { "YYYY-MM-DD": name } }        ← the payload; read ONLY when version moved
//
// So the common case (nothing changed) costs one tiny doc read and downloads no payload. The device caches the
// last-seen {version, days} in AsyncStorage; `holidayName` reads the in-memory map (fed via applySyncedHolidays),
// and falls back to the bundled table when there has never been a successful sync (offline / no Firebase).
//
// Best-effort by design, like the rest of sync: logged out, offline, or a build with no google-services.json all
// just keep the cached-or-bundled table. Holidays are never on the critical path.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./firebase";
import { applySyncedHolidays } from "@/core/schedule/holidays";

const CACHE_KEY = "lp.holidays.v1";
let cachedVersion: number | null = null;

/** Load the cache into memory immediately, then kick a best-effort remote check. Call once at app start. */
export async function initHolidays(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { version?: number; days?: Record<string, string> };
      cachedVersion = c.version ?? null;
      if (c.days) applySyncedHolidays(c.days);
    }
  } catch {
    // a corrupt cache just means we fall back to the bundled table
  }
  void syncHolidays();
}

/** Check Firestore's version; only download the payload when it differs from what we cached. */
export async function syncHolidays(): Promise<void> {
  const database = db();
  if (!database) return; // logged out / no Firebase → keep cached-or-bundled
  try {
    const meta = await database.collection("config").doc("holidays_meta").get();
    const version: number | null = meta.exists ? (meta.data()?.version ?? null) : null;
    if (version == null || version === cachedVersion) return; // unchanged → don't fetch the payload

    const data = await database.collection("config").doc("holidays_data").get();
    const days = data.exists ? (data.data()?.days as Record<string, string> | undefined) : undefined;
    if (!days) return;

    cachedVersion = version;
    applySyncedHolidays(days);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version, days }));
  } catch {
    // offline / rules / transient — the cached-or-bundled table stays in effect
  }
}
