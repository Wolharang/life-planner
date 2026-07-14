// App-level preferences (PRD R8: "Any additional preference, e.g. a personal default lead, is optional
// and local."). Local-only, AsyncStorage — same repository pattern as taskRepository. The execution-moment
// SOUND setting is NOT here: it lives natively (read at fire time even when JS is dead) via the alarm
// module. This holds only JS-side preferences that don't need a fire-time native read.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.settings.v1";

export interface AppSettings {
  /** Default lead (minutes) pre-filled for NEW tasks (R8 optional/local). 0 = fire at set time. */
  defaultLeadMinutes: number;

  /**
   * **아침 요약** — one silent notification, once a day, listing what the day holds.
   *
   * It is deliberately **silent**: it is not a cue, it is a briefing. Every needless buzz spends the budget
   * that keeps the one loud thing loud (C1/D30) — and the one loud thing is the execution moment, not this.
   */
  morningBriefOn: boolean;
  /** "HH:mm" — when the briefing arrives. */
  morningBriefTime: string;
}

const DEFAULTS: AppSettings = {
  defaultLeadMinutes: 0,
  morningBriefOn: true,
  morningBriefTime: "07:00",
};

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
