// Local-first repository for TimeBlocks (data-model §2.3 · PRD R5). Same AsyncStorage Repository
// pattern as eventRepository — features talk to this interface, never storage, so the impl swaps to
// Firestore at F0 without touching any screen (architecture §7).
//
// **Alarm discipline lives HERE, not in the screens** (architecture §9-2: write-through on save,
// eviction on delete — "고스트 알람 방지"). Every mutation below reconciles the native alarm for the
// blocks it touched, so a future Firestore impl (where deletes arrive from a listener, not a screen)
// cannot bypass it.
//
// It also owns the ONE-TIME prototype migration (data-model §8.4): the old `lp.tasks.v1` Task list is
// converted to per-date blocks the first time blocks are read, then the old key is dropped. Recurrence
// has no home in the full-app model (D37), so a recurring task lands as a single block on today.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlockAlert, BlockKind, Task, TimeBlock } from "./types";
import { alarm } from "@/core/notifications/alarm";
import { cancelReminders } from "@/core/notifications/plainReminders";
import { scheduleBlock, unscheduleBlock } from "@/core/schedule/blockScheduler";
import { syncPut, syncPutMany, syncRemove } from "./sync";
import { recordOutcome, removeOutcome } from "./outcomeRepository";
import { forgetOccurrence } from "./firedRepository";

const KEY = "lp.blocks.v1";
const LEGACY_KEY = "lp.tasks.v1";
const LEGACY_EVENTS_KEY = "lp.events.v1";

export type { TimeBlock } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A workout/run block IS the workout record (D22), so the migration guesses `kind` from the title the
 *  prototype only ever rendered as an icon. Wrong guesses are harmless and editable. */
export function guessKind(title: string): BlockKind {
  if (/헬스|운동|웨이트|근력|짐|gym|workout|리프트/i.test(title)) return "workout";
  if (/러닝|런닝|달리기|조깅|마라톤|산책|run|jog|walk/i.test(title)) return "run";
  return "normal";
}

function fromTask(t: Task, date: string): TimeBlock {
  const skipped = (t.skippedDates ?? []).includes(date);
  return {
    id: t.id, // keep the id → existing outcomes/fires/latencies stay attached to their block
    date,
    start: t.setTime,
    title: t.title,
    kind: guessKind(t.title),
    alert: t.executionAlarm ? "execution" : "soft", // D40/D43: the prototype only had the cue on/off
    alarmLeadMinutes: t.leadMinutes,
    microStartNote: t.microStartNote,
    snapStart: t.setTime,
    snapTitle: t.title,
    plannedAt: t.createdAt,
    status: skipped ? "skipped" : "planned",
    createdAt: t.createdAt,
    updatedAt: Date.now(),
  };
}

/**
 * Idempotent one-time move (§8.4). Two things beyond the data itself, both mandatory:
 *  · **Evict the prototype's alarms.** A `daily`/`weekly` task's alarm re-arms itself natively (mirror →
 *    AlarmReceiver → BootReceiver), so if we only rewrote storage it would keep firing **forever** with
 *    no block behind it — ghost fires that poison the catch-up net and the metrics. Same for its soft
 *    reminders, which blocks may no longer have at all (D38).
 *  · **Re-arm the migrated blocks** from their new (per-date) times.
 * The legacy key is dropped **only after** the new payload is safely written — an earlier version deleted
 * it even when the write threw, which would have destroyed the prototype's data.
 */
async function ensureMigrated(): Promise<void> {
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return;

  let tasks: Task[];
  try {
    tasks = JSON.parse(legacy) as Task[];
    if (!Array.isArray(tasks)) throw new Error("not an array");
  } catch {
    await AsyncStorage.removeItem(LEGACY_KEY); // unreadable legacy payload — nothing to save
    return;
  }

  const existingRaw = await AsyncStorage.getItem(KEY);
  let blocks: TimeBlock[] = [];
  if (existingRaw) {
    try {
      blocks = JSON.parse(existingRaw) as TimeBlock[];
    } catch {
      return; // the DESTINATION is corrupt — keep the legacy key rather than lose both
    }
  }

  const have = new Set(blocks.map((b) => b.id));
  const today = ymd(new Date());
  const migrated = tasks.filter((t) => !have.has(t.id)).map((t) => fromTask(t, today));
  await AsyncStorage.setItem(KEY, JSON.stringify([...blocks, ...migrated])); // throws → legacy survives
  await AsyncStorage.removeItem(LEGACY_KEY);

  // Alarms: kill every prototype alarm/reminder first (recurring ones would otherwise fire forever),
  // then arm the migrated blocks at their new per-date times.
  for (const t of tasks) {
    unscheduleBlock(t.id);
    await cancelReminders(t.id); // the prototype's per-task multi-offset reminders are retired (D40)
  }
  for (const b of migrated) await scheduleBlock(b);
}

/**
 * **D67 — an important event is just a block that holds an hour.** One-time move of `lp.events.v1` into blocks:
 * a lead time means it told you (`soft`), no lead means it only held the hour (`none`). Its `color` and `memo`
 * come along; its id is preserved so nothing that referenced it breaks.
 *
 * An event had no end time and was never evaluated — both fall out for free: `end` stays undefined, and a
 * `none` block is excluded from evaluation (돌아보기), exactly as R1 required of events.
 */
async function ensureEventsMigrated(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_EVENTS_KEY);
  if (!raw) return;

  let events: any[];
  try {
    events = JSON.parse(raw);
    if (!Array.isArray(events)) throw new Error("not an array");
  } catch {
    await AsyncStorage.removeItem(LEGACY_EVENTS_KEY);
    return;
  }

  const existingRaw = await AsyncStorage.getItem(KEY);
  let blocks: TimeBlock[] = [];
  if (existingRaw) {
    try {
      blocks = JSON.parse(existingRaw) as TimeBlock[];
    } catch {
      return; // destination unreadable — keep the events rather than lose both
    }
  }

  const have = new Set(blocks.map((b) => b.id));
  const now = Date.now();
  const migrated: TimeBlock[] = events
    .filter((e) => e?.id && e?.date && !have.has(e.id))
    .map((e) => {
      const lead = Number(e.notifyLeadMinutes);
      const hasLead = Number.isFinite(lead) && lead > 0;
      const start = typeof e.time === "string" && e.time ? e.time : "09:00";
      return {
        id: e.id,
        date: e.date,
        start,
        title: String(e.title ?? "일정"),
        kind: "normal" as const,
        alert: hasLead ? ("soft" as const) : ("none" as const),
        alarmLeadMinutes: hasLead ? lead : 0,
        alertLeads: hasLead ? [lead] : undefined,
        alertLoudness: "vibrate" as const,
        color: e.color,
        memo: e.memo,
        snapStart: start,
        snapTitle: String(e.title ?? "일정"),
        plannedAt: Number(e.createdAt) || now,
        status: "planned" as const,
        createdAt: Number(e.createdAt) || now,
        updatedAt: now,
      };
    });

  await AsyncStorage.setItem(KEY, JSON.stringify([...blocks, ...migrated])); // throws → events survive
  await AsyncStorage.removeItem(LEGACY_EVENTS_KEY);
  for (const b of migrated) await scheduleBlock(b);
}

/**
 * Read old rows forward. Two shapes predate the current one:
 *  · pre-D40 blocks carry `executionAlarm: boolean` instead of `alert`.
 *  · `alert: "none"` is a **live tier again** (D62) — D43 had deleted it and this function used to rewrite
 *    such rows to `soft`, which silently gave a lecture block a notification its owner never asked for.
 * `alertRepeat` (D40's fixed interval) is dropped — D45 replaced it with user-picked `alertLeads`.
 */
function normalize(raw: any): TimeBlock {
  const { executionAlarm, alertRepeat, ...rest } = raw;
  const alert: BlockAlert =
    rest.alert === "execution" || rest.alert === "none" || rest.alert === "soft"
      ? rest.alert
      : executionAlarm
        ? "execution" // pre-D40 rows carried a boolean
        : "soft";
  return { ...rest, alert } as TimeBlock;
}

export async function listBlocks(): Promise<TimeBlock[]> {
  await ensureMigrated();
  await ensureEventsMigrated();
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => r && typeof r === "object").map(normalize);
  } catch {
    // A corrupt block store must not take the app down — every screen and the app-open re-arm read this.
    return [];
  }
}

/** Raw write — callers must reconcile alarms themselves. Internal; the exported mutations below do it. */
async function writeBlocks(blocks: TimeBlock[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(blocks));
}

export async function addBlock(block: TimeBlock): Promise<void> {
  await addBlocks([block]);
}

export async function addBlocks(blocks: TimeBlock[]): Promise<void> {
  await writeBlocks([...(await listBlocks()), ...blocks]);
  for (const b of blocks) await scheduleBlock(b); // write-through (architecture §9-2)
  syncPutMany("blocks", blocks); // mirror up; a no-op when logged out
}

/**
 * **Moving a settled block to a new time RE-OPENS it.**
 *
 * "I missed the 15:58 gym — I'll move it to 17:27 and do it" is the most natural thing a person does with this
 * app, and the app silently refused to let it work. The block kept `status: "fail"`, so:
 *  · the card showed **미스** the moment you looked at it, before the new time had even arrived;
 *  · the old `miss` outcome still keyed `taskId|date`, so when the moment fired again the catch-up net saw the
 *    occurrence as **already resolved** and **threw the fire marker away**;
 *  · and `scheduleBlock` cancels `<id>#recheck` for any block that is not `planned`, so **"진짜 했어?" never
 *    came**. The alarm rang into an app that had already decided the answer.
 *
 * So: if a **settled** block's `start` or `date` moves, the occurrence is re-opened — status back to
 * `planned`, verdict cleared, and the stale outcome and markers removed. This cannot erase a miss by accident:
 * `settle()` and the 쉼 toggle don't move the clock, so they never trigger it.
 *
 * The evaluation stays honest anyway: the **D-1 snapshot** (`snapStart`) does **not** move (D23), so 돌아보기
 * still knows you had promised 15:58 — you just get to actually do the thing.
 */
export async function updateBlock(block: TimeBlock): Promise<void> {
  const blocks = await listBlocks();
  const prev = blocks.find((b) => b.id === block.id);

  const wasSettled = prev?.status === "success" || prev?.status === "fail";
  const moved = !!prev && (prev.start !== block.start || prev.date !== block.date);
  const verdictUnchanged = prev?.status === block.status; // settle() would have changed it — this is an edit

  let next = block;
  if (wasSettled && moved && verdictUnchanged) {
    next = { ...block, status: "planned", completedAt: undefined, failReason: undefined };
    await removeOutcome(prev!.id, prev!.date); // the old verdict was for a time that no longer exists
    await forgetOccurrence(prev!.id, prev!.date); // and so were its fire / missed markers
  }

  await writeBlocks(blocks.map((b) => (b.id === next.id ? next : b)));
  await scheduleBlock(next); // re-arms the block's ONE alert, or cancels every path
  syncPut("blocks", next);
}

/** Was this block part of the plan of record — i.e. committed on an EARLIER day than the one it sits on? */
export function preCommitted(b: TimeBlock): boolean {
  return ymd(new Date(b.plannedAt)) < b.date;
}

/**
 * **Deleting a pre-committed block on its own day counts as a miss** (spec §3.6).
 *
 * The rule exists to close a hole, not to punish: without it, deletion is a **silent, cost-free "can't
 * today"** — the one escape the product forbids (R7). You don't answer the moment, you just remove the
 * evidence, and 돌아보기 never knows the block existed. Yesterday's you made a promise; today's you can
 * decide not to keep it, but not to pretend it was never made.
 *
 * It is scoped tightly, so ordinary editing is never punished:
 *  · only blocks **planned on an earlier day** (`plannedAt` < `date`) — a block you created and deleted today
 *    was never a commitment;
 *  · only on or after the day itself — deleting *tomorrow's* plan is just planning;
 *  · only while still **open** (`planned`) — a resolved block already has its outcome.
 * The miss is recorded as `catch-up`, never `execution-screen`: S1 counts only what the moment produced (R18).
 * It is neutral data — taupe, never red, and nothing scolds.
 */
export async function deleteBlock(id: string): Promise<void> {
  const blocks = await listBlocks();
  const b = blocks.find((x) => x.id === id);

  if (b && b.status === "planned" && preCommitted(b) && b.date <= ymd(new Date())) {
    await recordOutcome({
      taskId: b.id,
      title: b.title,
      date: b.date,
      status: "miss",
      source: "catch-up",
      at: Date.now(),
    });
  }

  await writeBlocks(blocks.filter((x) => x.id !== id));
  unscheduleBlock(id); // eviction — no ghost fire behind a deleted block
  syncRemove("blocks", id); // soft-delete tombstone, so the OTHER phone evicts its alarm too (§6)
}

/**
 * Re-derive every block alarm from storage. Architecture §11 layer 4 ("앱 포그라운드 진입 시 저장소에서
 * 재예약"): the repository is the truth, the native mirror is a derived cache, so any divergence (a
 * failed schedule, cleared app data, a restored backup, later a Firestore listener) heals on app open.
 */
export async function rearmBlockAlarms(): Promise<void> {
  const armed: string[] = [];
  try {
    for (const a of alarm.getScheduled()) armed.push(a.id);
  } catch {
    // native unavailable (dev skew) — still (re)schedule below; cancels of unknown ids are harmless
  }
  const blocks = await listBlocks();
  const live = new Set(blocks.map((b) => b.id));

  // **A "<id>#recheck" alarm is NOT an orphan.** It is the R7 follow-up the native moment armed for itself
  // ("진짜 했어?", ~5 min after the commit), and it is in flight — there is no block by that id and there
  // never will be. Matching armed ids against block ids therefore made every re-check look like a ghost, and
  // this sweep **cancelled it**: open the app inside those 5 minutes and the follow-up silently died, so the
  // moment never came back and the block fell to the catch-up net as a miss. `scheduleBlock` goes out of its
  // way to preserve the re-check (it only cancels one once the block is resolved) — and this undid that.
  // F0 made it far worse: every Firestore snapshot re-arms, so a reconnect alone could kill the follow-up.
  //
  // So an alarm is an orphan only when **the block it belongs to is gone**, and a re-check belongs to the
  // block whose id it carries.
  for (const id of armed) {
    const owner = id.endsWith("#recheck") ? id.slice(0, -"#recheck".length) : id;
    if (!live.has(owner)) unscheduleBlock(owner); // evicts the block's alarm AND its re-check
  }

  for (const b of blocks) await scheduleBlock(b);
}

/** A day's blocks in clock order — the day view and My Day both read the day this way. */
export function blocksOn(blocks: TimeBlock[], date: string): TimeBlock[] {
  return blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

/** Which days carry blocks → the calendar can mark them without re-filtering per cell. */
export function groupByDate(blocks: TimeBlock[]): Record<string, TimeBlock[]> {
  const by: Record<string, TimeBlock[]> = {};
  for (const b of blocks) (by[b.date] ??= []).push(b);
  for (const d of Object.keys(by)) by[d].sort((a, b) => a.start.localeCompare(b.start));
  return by;
}
