// Minimal outcome store for Phase 2 (data-model §8 Occurrence, trimmed). Records the result of an
// occurrence so S2 (initiation rate) is measurable: done/miss/skipped + SOURCE (execution-screen /
// catch-up / pre-skip) + timestamp. Phase 3/4 expand this into full per-occurrence records + history.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.outcomes.v1";

// `skipped` (source `pre-skip`) = the R1 "오늘은 쉼" pre-fire toggle — guilt-free, NOT a miss, and
// excluded from the S2 initiation denominator (PRD §7.1.0 / §4).
export type OutcomeStatus = "done" | "miss" | "skipped";
export type OutcomeSource = "execution-screen" | "catch-up" | "pre-skip";

export interface OutcomeRecord {
  taskId: string;
  title?: string; // denormalized so history survives task deletion
  date: string; // YYYY-MM-DD of the occurrence
  status: OutcomeStatus;
  source: OutcomeSource;
  at: number; // epoch ms the outcome was recorded
}

export async function listOutcomes(): Promise<OutcomeRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as OutcomeRecord[]) : [];
}

export async function recordOutcome(record: OutcomeRecord): Promise<void> {
  const all = await listOutcomes();
  all.push(record);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

/** Remove outcome(s) for an occurrence (optionally only a given source). Used when un-toggling
 *  "오늘은 쉼" before fire so a re-armed occurrence carries no stale `skipped` record (R1). */
export async function removeOutcome(
  taskId: string,
  date: string,
  source?: OutcomeSource
): Promise<void> {
  const all = await listOutcomes();
  const kept = all.filter(
    (o) => !(o.taskId === taskId && o.date === date && (source ? o.source === source : true))
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(kept));
}
