// Persistent log of every execution-moment fire latency (S1). Unlike firedRepository (the catch-up net,
// which is pruned as occurrences resolve), this is never pruned — it's the measurement record so
// S1 (fire within ±[TBD ~1 min] of the effective time) is computable after the self-experiment.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.latencies.v1";

export interface Latency {
  taskId: string;
  title: string;
  date: string;
  intended: number; // epoch ms scheduled
  firedAt: number; // epoch ms actual
  deltaMs: number; // firedAt − intended
  createdAt?: number; // task creation time — for the PRD §10 commit→fire gap (may be absent on old rows)
}

export async function listLatencies(): Promise<Latency[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as Latency[]) : [];
  } catch {
    // A corrupt store must degrade, not detonate — this read sits under home, the tabs, the catch-up sweep
    // and the app-open re-arm, and an unguarded throw took the whole app down with no recovery path.
    return [];
  }
}

export async function appendLatencies(list: Latency[]): Promise<void> {
  if (list.length === 0) return;
  const all = await listLatencies();
  await AsyncStorage.setItem(KEY, JSON.stringify([...all, ...list]));
}
