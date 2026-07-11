// Prototype data model — mirrors docs/core/data-model.md §8 (local-only, no account/cloud).

export type Recurrence = "none" | "daily" | "weekly";
// `skipped` = turned off in advance via the R1 "오늘은 쉼" toggle (distinct from `miss`, equally
// guilt-free); `pre-skip` is its source. PRD §7.1.0 outcome model.
export type OutcomeStatus = "pending" | "done" | "miss" | "skipped";
export type OutcomeSource = "execution-screen" | "catch-up" | "pre-skip";

/** The prototype's single unit. Maps to the full-app TimeBlock (end/kind unused here). */
export interface Task {
  id: string;
  title: string;
  /** wall-clock local time, "HH:mm" */
  setTime: string;
  microStartNote?: string;
  /** only tasks with this ON get the R2/R3 lock-screen intervention */
  executionAlarm: boolean;
  /** fire at setTime − lead. Default 0 (fire at set time); presets {0,15,30,60,custom} */
  leadMinutes: number;
  /** soft multi-offset reminders, distinct from the execution alarm */
  plainReminderOffsets: number[];
  recurrence: Recurrence;
  /** YYYY-MM-DD dates the user pre-skipped ("오늘은 쉼", R1 v0.5) — those occurrences don't fire */
  skippedDates?: string[];
  /** ms — pre-commitment validity guard (PRD §10): commit-line phrasing + commit→fire gap */
  createdAt: number;
}

/** One per repeat date; carries the outcome. S2 counts source === "execution-screen" only. */
export interface Occurrence {
  taskId: string;
  /** YYYY-MM-DD, device local midnight */
  date: string;
  /** ms — setTime − lead for this date */
  effectiveTime: number;
  status: OutcomeStatus;
  source?: OutcomeSource;
  outcomeAt?: number;
}

export interface Settings {
  /** execution-moment sound; default off = haptic-only (R8) */
  sound: boolean;
}

// ── Full-app entities ───────────────────────────────────────────────────────

/**
 * Important event on the month calendar (PRD R1 · data-model §2.2). Placed days–weeks ahead, marked on
 * the calendar by `date`, notified in advance, NOT evaluated (canceled = deleted). Local-only for now
 * (Repository pattern); the storage impl swaps to Firestore later (architecture §7) — this shape stays.
 */
export interface ImportantEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD (device local) — the calendar day this event sits on */
  date: string;
  /** wall-clock local start time, "HH:mm" — optional */
  time?: string;
  /** minutes before `time` to fire the advance notification; default applied if unset (D28) */
  notifyLeadMinutes?: number;
  /** calendar bar color (hex). Falls back to the brand color when unset */
  color?: string;
  memo?: string;
  createdAt: number;
  updatedAt: number;
}
