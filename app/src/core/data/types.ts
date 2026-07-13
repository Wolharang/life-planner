// Data model — full app (docs/core/data-model.md §2), still local-only (no account/cloud until F0).
// The prototype's `Task` (§8.1) has been superseded by `TimeBlock` (§2.3); it survives below ONLY as the
// migration source (blockRepository converts it once, then drops the old key).

export type Recurrence = "none" | "daily" | "weekly";
// `skipped` = turned off in advance via the R1 "오늘은 쉼" toggle (distinct from `miss`, equally
// guilt-free); `pre-skip` is its source. PRD §7.1.0 outcome model.
export type OutcomeStatus = "pending" | "done" | "miss" | "skipped";
export type OutcomeSource = "execution-screen" | "catch-up" | "pre-skip";

/** LEGACY (prototype §8.1) — kept only so the one-time Task→TimeBlock migration can read old data. */
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

export type BlockKind = "normal" | "workout" | "run";
/** `planned|success|fail` per data-model §2.3; `skipped` carries over the prototype's no-guilt pre-fire
 *  "오늘은 쉼" (§8.2) — it is NOT a fail and is excluded from the execution-rate denominator. */
export type BlockStatus = "planned" | "success" | "fail" | "skipped";

/**
 * TimeBlock — the day plan's unit, the execution lever's target, and the evaluation subject
 * (data-model §2.3 · spec §3.2 · PRD R5–R7). **Per-date and free-form** (D14): one block belongs to one
 * `date`, from `start` to an optional `end`. **There is no recurrence** (D35 notes it was a
 * prototype-only addition; full-app blocks are per-date) — instead the add screen can place the *same*
 * block on **several dates at once**, each an independent block (founder decision 2026-07-11).
 *
 * Notifications: a block carries **exactly one** type — the execution cue (`executionAlarm`, default
 * off), the core lever (spec §3.9). It has **no soft reminder**; those belong to ImportantEvent (R3).
 */
export interface TimeBlock {
  id: string;
  /** YYYY-MM-DD (device local midnight) — the day this block belongs to */
  date: string;
  /** wall-clock local "HH:mm" — free-form interval (D14); `end` optional */
  start: string;
  end?: string;
  title: string;
  location?: string;
  /** workout/run blocks marked success ARE the workout record — no separate log (D22) */
  kind: BlockKind;
  /** only blocks with this ON get the lock-screen execution moment (R7). Fires at start − lead */
  executionAlarm: boolean;
  alarmLeadMinutes: number;
  microStartNote?: string;
  /** pre-fire, re-togglable "오늘은 쉼" (R7). The only intentional skip; guilt-free, never a miss */
  skipped?: boolean;
  // — D-1 snapshot (D23): mirrors the live values while `date` is still in the future, then freezes
  //   on its own once `date` arrives (no midnight job). Evaluation compares against THIS, never the
  //   live values; the alarm always follows the LIVE start − lead.
  snapStart: string;
  snapEnd?: string;
  snapTitle: string;
  plannedAt: number;
  status: BlockStatus;
  /** free text on fail — binary + reason only, no quantitative comparison (D5/D29) */
  failReason?: string;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

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
