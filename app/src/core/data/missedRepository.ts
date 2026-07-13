// R6 "never fired" catch-up store. These are occurrences whose effective time passed without the
// execution moment appearing, drained from the native backup/boot scans and shown as "놓쳤어요".

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.missed.v1";

export interface MissedRecord {
  taskId: string;
  title: string;
  date: string;
  intended: number;
  missedAt: number;
}

export async function listMisses(): Promise<MissedRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as MissedRecord[]) : [];
  } catch {
    // A corrupt store must degrade, not detonate — this read sits under home, the tabs, the catch-up sweep
    // and the app-open re-arm, and an unguarded throw took the whole app down with no recovery path.
    return [];
  }
}

export async function setMisses(list: MissedRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function appendMisses(list: MissedRecord[]): Promise<void> {
  if (list.length === 0) return;
  const all = await listMisses();
  const byKey = new Map(all.map((m) => [`${m.taskId}|${m.date}`, m]));
  for (const m of list) byKey.set(`${m.taskId}|${m.date}`, m);
  await setMisses([...byKey.values()]);
}
