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

/** The 8 fixed budget categories (D16 — user-editable categories are deliberately not offered). */
export type ExpenseCategory =
  | "주식"
  | "간식"
  | "문화생활"
  | "잡화소모"
  | "이동통신"
  | "대중교통비"
  | "의료"
  | "기타";

export type MealType = "아침" | "점심" | "저녁" | "간식";

/**
 * Expense — logged **the moment money is spent** (D6), on the Logs surface, which is kept SEPARATE from
 * the plan/execution surface (D32). Ported from `reference/calculator.js` (`@expense_list`), see
 * docs/research/reference-apps.md §A2. KRW only (D25); `payment` is free text (D26); the icon is derived
 * from the category, never stored.
 */
export interface Expense {
  id: string;
  /** YYYY-MM-DD (device local) — the day this spend belongs to */
  date: string;
  /** ms — the chosen date + the clock time at save (the reference apps' convention) */
  timestamp: number;
  /** 소비 이름 (required) */
  name: string;
  /** KRW (D25) */
  amount: number;
  category: ExpenseCategory;
  /** 구매처 */
  store?: string;
  /** 결제수단 — free text (D26) */
  payment?: string;
  memo?: string;
  /** Manual within-day display order (D92). Absent = fall back to timestamp (newest first). Lower = higher. */
  sortIndex?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * MealEntry — logged **the moment you eat** (D6). Ported from `reference/kcal.js` (`@diet_list`), see
 * reference-apps.md §B2, **minus photos** (D19) and **minus the 운동/러닝 activity records** — a workout is
 * a TimeBlock marked success (D22), never a log entry.
 */
export interface MealEntry {
  id: string;
  date: string;
  timestamp: number;
  mealType: MealType;
  /** 음식 이름 (required) */
  foodName: string;
  /** 상세 정보 */
  detail?: string;
  /** manual entry only — no barcode / calorie DB (D27) */
  kcal: number;
  /** Manual within-day display order (D92). Absent = fall back to timestamp (newest first). Lower = higher. */
  sortIndex?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * DayAggregate — the day's rollup (data-model §2.6 · PRD R10). **Derived, never stored**: computed from
 * that day's blocks + expenses + meals on read (zero writes — the cost guard in tech-feasibility §6-3).
 *
 * It is the concrete form of "integration = **linking**, not merging" (D32): it carries the plan side and
 * the log side as **separate totals**, so a screen can show them as distinct sections and never as one
 * interleaved timeline. `workoutDone`/`runDone` are **derived from success blocks** (D22) — there is no
 * activity record anywhere.
 */
export interface DayAggregate {
  date: string;
  blocksPlanned: number;
  blocksSuccess: number;
  blocksFail: number;
  blocksSkipped: number;
  workoutDone: boolean;
  runDone: boolean;
  expenseTotal: number;
  kcalTotal: number;
  kcalByMeal: Record<MealType, number>;
}

export type BlockKind = "normal" | "workout" | "run";
/**
 * data-model §2.3: `planned|success|fail`, **plus** `skipped` — the pre-fire, re-togglable "오늘은 쉼"
 * (§8.2). A skip is NOT a fail and is excluded from the execution-rate denominator.
 *
 * This is the **single** source of "is this block skipped" — there is deliberately no separate boolean:
 * two fields drifted apart (a settled block could keep reading as 쉼) and the doc defines one.
 */
export type BlockStatus = "planned" | "success" | "fail" | "skipped";

/**
 * How a block announces itself (**D40** → **D43** → **D62**, 2026-07-13). A block carries **exactly one**
 * alert, and there are **three** kinds.
 *
 * `none` was removed by D43 on the reasoning that "a block you'd never be told about isn't worth adding".
 * **That reasoning was wrong, and D62 brings it back.** A block is not only an alert — it is also an *hour of
 * your day that is taken*. You need to be able to put 강의, 알바, 이동 on the plan so that the day is **honest**:
 * so the free-slot hint doesn't offer you a gap that isn't free, so you don't double-book, so tomorrow's
 * workout lands somewhere it can actually happen. Forcing such a block to carry a notification means the app
 * pesters you about a lecture you are already sitting in — and every needless notification spends the budget
 * that keeps the ONE loud thing loud (C1/D30).
 *
 * The three:
 *  · `none` — **silent**. It occupies the day and shapes the plan (free slots, double-booking), and says
 *    nothing, ever. Not evaluated by the lever; it is context, not a commitment (D62).
 *  · `soft` — a plain notification. It **tells** you; it never takes the screen. It arrives at up to
 *    **3 moments the user picks** (`alertLeads`, D45). For blocks that need telling, not forcing (점심, 약속).
 *  · `execution` — **the default**: the exact alarm + the full-screen moment over the lock screen (R7).
 *    The lever is the product, so a new block gets it unless you say otherwise.
 * **Loudness is an independent axis with three settings** (`alertLoudness`, D65): **무음 · 진동 · 소리**. The
 * tier says *how hard the app pushes*; loudness says *how loudly it announces*. They are orthogonal — the
 * execution moment may be silent, an ordinary alert may ring.
 *
 * 무음 exists because a **buzz is not free**. A block you added only so the day is honest (강의, 이동) still has
 * to be able to *appear* without vibrating your leg for the twentieth time — and every needless buzz spends the
 * budget that keeps the one loud thing loud (C1/D30). Before D65 the axis was a boolean and the quiet end of it
 * was still a vibration; there was no way to simply be seen.
 */
export type BlockAlert = "none" | "soft" | "execution";

/** How loudly an alert announces itself — independent of which tier it is (D43/D65). */
export type BlockLoudness = "silent" | "vibrate" | "sound";

/**
 * TimeBlock — the day plan's unit, the execution lever's target, and the evaluation subject
 * (data-model §2.3 · spec §3.2 · PRD R5–R7). **Per-date and free-form** (D14): one block belongs to one
 * `date`, from `start` to an optional `end`. **There is no recurrence** (D35 notes it was a
 * prototype-only addition; full-app blocks are per-date) — instead the add screen can place the *same*
 * block on **several dates at once**, each an independent block (founder decision 2026-07-11, D37).
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
  /** which alert this block carries (D40/D43) — fires at `start − alarmLeadMinutes`. Default `execution`. */
  alert: BlockAlert;
  alarmLeadMinutes: number;
  /** sound on this block's alert? `false` (default) = **vibration only**. Applies to BOTH tiers (D43) —
   *  the execution moment can be silent, and a soft alert can be audible. The tone itself is a setting. */
  /** LEGACY (pre-D65): `true` = sound. Read forward into `alertLoudness`; never written. */
  alertSound?: boolean;
  /** 무음 (appears, says nothing) · 진동 (default) · 소리 (D65). Independent of the tier (D43). */
  alertLoudness?: BlockLoudness;
  /**
   * `soft` only — **when** its notifications arrive: minutes before `start`, **one entry per notification**,
   * **max 3** (D45). e.g. `[60, 15, 0]` = an hour before, 15 minutes before, and on the dot. The user picks
   * each one; a fixed repeat interval was wrong (you don't want "every 5 minutes", you want *your* moments).
   * Sorted earliest-first (largest lead first). Defaults to one entry: `[alarmLeadMinutes]`.
   */
  alertLeads?: number[];
  /** the 5-second first move (A2) — shown on the execution moment's commit card */
  microStartNote?: string;
  /**
   * Include this block in the **아침 요약** — the day's one silent briefing?
   *
   * **Undefined means yes**: a block you put in the day is, by default, part of what the day holds. Set false
   * for the ones that are always there and tell you nothing (a standing 강의, the commute) — *a briefing that
   * lists everything is a briefing nobody reads by the third day.*
   */
  inBrief?: boolean;
  /** calendar bar color (hex). Falls back to the tier's own color. (Absorbed from ImportantEvent, D67.) */
  color?: string;
  memo?: string;
  /**
   * **Which phones may take the screen** (D70). Only meaningful for `alert: "execution"`.
   *
   * Sync made the lever fire on *every* logged-in device at once, and a cue that goes off in three places is
   * not a cue — it is a question: **"where am I supposed to do this?"** The moment's whole power is that it is
   * unambiguous. So a block names its phone(s); by default, the one it was created on.
   *
   * The phones **not** named still hear about it — one buzz and a notification — because being unaware is a
   * different failure from being interrupted in three rooms at once.
   *
   * `undefined` = **every** device (how blocks behaved before D70; nothing silently loses its lever).
   */
  executeOn?: string[];
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
  /**
   * How this block's `status` came to be — only meaningful for a workout/run **실행** block (GPS auto-eval).
   *   · `"location"` — decided automatically from where the phone was. **Still overridable by hand** — the auto
   *      verdict is a default, never a lock (founder).
   *   · `"manual"`   — the user set or changed it themselves; auto-eval must not overwrite it.
   * Undefined = never auto-evaluated (any other block, or one the user judged the ordinary way).
   */
  evalSource?: "location" | "manual";
  createdAt: number;
  updatedAt: number;
}

/**
 * **`ImportantEvent` was RETIRED here (D67, 2026-07-13). Do not bring it back.**
 *
 * An "important event" was always just a block that holds an hour and does not push you — it is now a
 * `TimeBlock` with `alert: "none"` (or `"soft"` if it had a notify lead). Two entities forced the user to
 * answer a question that has nothing to do with their life — *"is this a 캘린더 일정 or a 블록?"* — and then
 * live with the consequence: a block added for the calendar **did not appear on the calendar**, so the month
 * showed a free afternoon that was not free. The tier now *is* the answer: **없음** = it just holds the hour ·
 * **알림** = it matters · **실행** = the lever. Kind (일반/운동/러닝) is orthogonal to all three.
 *
 * The old row's shape survives only where it is still read — `blockRepository.ensureEventsMigrated()`.
 */

/**
 * The loudness a block actually announces with. Reads the **old boolean forward**: rows written before D65
 * carry `alertSound` (true = 소리, false = 진동만) and no `alertLoudness`. There was no way to say 무음 back
 * then, so an old row can never *become* silent by accident — it lands where its owner left it.
 */
export function loudnessOf(b: { alertLoudness?: BlockLoudness; alertSound?: boolean }): BlockLoudness {
  if (b.alertLoudness) return b.alertLoudness;
  return b.alertSound ? "sound" : "vibrate";
}
