// App-level preferences (PRD R8: "Any additional preference, e.g. a personal default lead, is optional
// and local."). Local-only, AsyncStorage — same repository pattern as taskRepository. The execution-moment
// SOUND setting is NOT here: it lives natively (read at fire time even when JS is dead) via the alarm
// module. This holds only JS-side preferences that don't need a fire-time native read.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.settings.v1";

export interface AppSettings {
  /** Default lead (minutes) pre-filled for NEW tasks (R8 optional/local). 0 = fire at set time. */
  defaultLeadMinutes: number;
}

const DEFAULTS: AppSettings = { defaultLeadMinutes: 0 };

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
