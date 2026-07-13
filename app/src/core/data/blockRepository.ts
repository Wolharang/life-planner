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

const KEY = "lp.blocks.v1";
const LEGACY_KEY = "lp.tasks.v1";

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
 * Read old rows forward. Two shapes predate the current one:
 *  · pre-D40 blocks carry `executionAlarm: boolean` instead of `alert`.
 *  · D40 blocks may carry `alert: "none"` — a tier D43 **deleted**. `none` is no longer a `BlockAlert`,
 *    and `scheduleBlock` matches on the two live tiers, so a `none` row would arm **nothing**: a block
 *    sitting in the plan that can never announce itself. Land it on `soft` (it still tells you) rather
 *    than `execution` (never silently *add* a lock-screen takeover to a block that opted out of one).
 * `alertRepeat` (D40's fixed interval) is dropped — D45 replaced it with user-picked `alertLeads`.
 */
function normalize(raw: any): TimeBlock {
  const { executionAlarm, alertRepeat, ...rest } = raw;
  const alert: BlockAlert =
    rest.alert === "execution" || (rest.alert === undefined && executionAlarm) ? "execution" : "soft";
  return { ...rest, alert } as TimeBlock;
}

export async function listBlocks(): Promise<TimeBlock[]> {
  await ensureMigrated();
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as any[]).map(normalize) : [];
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
}

export async function updateBlock(block: TimeBlock): Promise<void> {
  const blocks = await listBlocks();
  await writeBlocks(blocks.map((b) => (b.id === block.id ? block : b)));
  await scheduleBlock(block); // re-arms the block's ONE alert, or cancels both paths (D40)
}

export async function deleteBlock(id: string): Promise<void> {
  const blocks = await listBlocks();
  await writeBlocks(blocks.filter((b) => b.id !== id));
  unscheduleBlock(id); // eviction — no ghost fire behind a deleted block
}

/**
 * Re-derive every block alarm from storage. Architecture §11 layer 4 ("앱 포그라운드 진입 시 저장소에서
 * 재예약"): the repository is the truth, the native mirror is a derived cache, so any divergence (a
 * failed schedule, cleared app data, a restored backup, later a Firestore listener) heals on app open.
 */
export async function rearmBlockAlarms(): Promise<void> {
  const armed = new Set<string>();
  try {
    for (const a of alarm.getScheduled()) armed.add(a.id);
  } catch {
    // native unavailable (dev skew) — still (re)schedule below; cancels of unknown ids are harmless
  }
  const blocks = await listBlocks();
  const live = new Set(blocks.map((b) => b.id));
  for (const id of armed) if (!live.has(id)) unscheduleBlock(id); // orphan alarm → evict
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
