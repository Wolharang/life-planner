// Log of "the execution moment appeared" (drained from the native PendingFires on app open). Used by
// R6 catch-up (a fire with no `done` outcome for its date = fired-but-not-done → "아직 안 했죠") and by
// S1 measurability (each carries the actual fire latency `deltaMs`). Entries are removed once resolved
// (done/miss recorded) or auto-archived after the catch-up window.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMisses, setMisses } from "./missedRepository";

const KEY = "lp.fires.v1";

export interface FireRecord {
  taskId: string;
  title: string;
  date: string; // YYYY-MM-DD occurrence date
  intended: number; // epoch ms it was scheduled for
  firedAt: number; // epoch ms it actually fired
  deltaMs: number; // firedAt − intended (S1 latency)
  createdAt?: number; // task creation time — for the PRD §10 commit→fire gap (may be absent on old rows)
}

export async function listFires(): Promise<FireRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as FireRecord[]) : [];
  } catch {
    // A corrupt store must degrade, not detonate. This is read by home, the tabs, the catch-up sweep and the
    // app-open re-arm — an unguarded throw here took the whole app down with no recovery path.
    return [];
  }
}

export async function setFires(list: FireRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function appendFires(list: FireRecord[]): Promise<void> {
  if (list.length === 0) return;
  const all = await listFires();
  await setFires([...all, ...list]);
}

/**
 * Forget an occurrence's markers entirely (fire + never-fired). Used when a settled block is **moved to a new
 * time** and its occurrence is re-opened (`blockRepository.updateBlock`): the old markers describe a moment
 * that no longer exists, and leaving them behind makes the catch-up net argue about a time the user already
 * abandoned.
 */
export async function forgetOccurrence(taskId: string, date: string): Promise<void> {
  await setFires((await listFires()).filter((f) => !(f.taskId === taskId && f.date === date)));
  await setMisses((await listMisses()).filter((m) => !(m.taskId === taskId && m.date === date)));
}
