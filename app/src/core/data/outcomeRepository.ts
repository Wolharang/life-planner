// Minimal outcome store for Phase 2 (data-model §8 Occurrence, trimmed). Records the result of an
// occurrence so S2 (initiation rate) is measurable: done/miss/skipped + SOURCE (execution-screen /
// catch-up / pre-skip) + timestamp. Phase 3/4 expand this into full per-occurrence records + history.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.outcomes.v1";

// `skipped` (source `pre-skip`) = the R1 "오늘은 쉼" pre-fire toggle — guilt-free, NOT a miss, and
// excluded from the S2 initiation denominator (PRD §7.1.0 / §4).
export type OutcomeStatus = "done" | "miss" | "skipped";
// `location` = the GPS auto-evaluation verdict (workout/run 실행 blocks). It is the truth of whether the workout
// happened, so it may overwrite a self-report — but a later `catch-up` must never overwrite IT.
export type OutcomeSource = "execution-screen" | "catch-up" | "pre-skip" | "location";

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
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as OutcomeRecord[]) : [];
  } catch {
    return []; // a corrupt store must not take the whole app down on its first read
  }
}

/**
 * **An occurrence has exactly ONE outcome.** This used to blindly `push`, so any double tap wrote the record
 * twice — and an impatient "했어" followed by "안 했어" (the buttons stay live across several awaits) wrote a
 * `done` **and** a `miss` for the same occurrence. Both land in S1, the one number the whole self-experiment
 * turns on. A duplicated or contradictory outcome is worse than a crash: it is a lie we then reason from.
 *
 * So this is an **upsert keyed by `taskId|date`** — with one asymmetry: an outcome the **execution moment
 * itself** produced is never overwritten by a later `catch-up` one. S1 counts only what the moment produced
 * (R18), so letting a catch-up tap rewrite the source would quietly steal the lever's own evidence.
 */
export async function recordOutcome(record: OutcomeRecord): Promise<void> {
  const all = await listOutcomes();
  const i = all.findIndex((o) => o.taskId === record.taskId && o.date === record.date);
  if (i < 0) {
    all.push(record);
  } else if (
    (all[i].source === "execution-screen" || all[i].source === "location") &&
    record.source === "catch-up"
  ) {
    // The moment (or its GPS verdict) already spoke for this occurrence — a later catch-up may not rewrite it.
    return;
  } else {
    all[i] = record;
  }
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
