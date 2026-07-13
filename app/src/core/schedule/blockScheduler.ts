// Bridges a TimeBlock (domain) to the exact-alarm module (PRD R7) and holds the day-plan time math.
// Blocks are per-date (no recurrence), so scheduling is a single moment: `date + start − lead`.
//
// Two rules from the docs are encoded here, not in the screens:
//  · The alarm always follows the **LIVE** start − lead; the D-1 snapshot never schedules anything (D23).
//  · The snapshot **mirrors** the live values while the block's date is still in the future and **freezes
//    by itself once that date arrives** — no midnight job. A block created on the day snapshots its
//    creation values (data-model §2.3, spec §3.6).

import type { TimeBlock } from "@/core/data/types";
import { alarm } from "@/core/notifications/alarm";
import { cancelBlockSoftAlert, scheduleBlockSoftAlert } from "@/core/notifications/plainReminders";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function todayYmd(now: number = Date.now()): string {
  return ymd(new Date(now));
}

export function shiftYmd(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + deltaDays));
}

/** Epoch ms of a block's wall-clock start (its `date` at `start`, device-local). */
export function blockStartAt(block: TimeBlock): number {
  const [y, mo, d] = block.date.split("-").map(Number);
  const [h, mi] = block.start.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

/** A block the user pre-skipped ("오늘은 쉼", R7) — the single source of that fact is `status`. */
export const isSkipped = (block: TimeBlock) => block.status === "skipped";

/** Does this block get the lock-screen execution moment (as opposed to a soft alert / silence)? D40. */
export const isExecution = (block: TimeBlock) => block.alert === "execution" && !isSkipped(block);

/**
 * When a block **first** announces itself: `start − lead`. For a soft block with several chosen moments
 * (D45) that's its **earliest** one. Null only when the block is pre-skipped ("오늘은 쉼", R7).
 */
export function blockFireAt(block: TimeBlock): number | null {
  if (isSkipped(block)) return null;
  const lead =
    block.alert === "soft" && block.alertLeads?.length
      ? Math.max(...block.alertLeads)
      : block.alarmLeadMinutes;
  return blockStartAt(block) - lead * 60_000;
}

/**
 * Arm the block's ONE alert (D40), or cancel everything if it has none / is skipped / is already past.
 * The two mechanisms are kept strictly apart (R15): `execution` → the native exact alarm + full-screen
 * moment; `soft` → an ordinary local notification on the quiet channel, which never pierces the lock
 * screen. A block is always cancelled on **both** paths first, so switching tiers can't leave a ghost.
 */
export async function scheduleBlock(block: TimeBlock, now: number = Date.now()): Promise<void> {
  alarm.cancel(block.id);
  await cancelBlockSoftAlert(block.id);

  // The native moment arms its own ~5-min re-check ("<id>#recheck", R7). Kill it **only once the block is
  // no longer open** — done / missed / 쉼 — so a resolved block never asks "진짜 했어?" again. A still-open
  // block must KEEP its re-check: this function also runs on every app-open re-arm, and blindly cancelling
  // here would silently delete the follow-up whenever the user opened the app within those 5 minutes.
  if (block.status !== "planned") alarm.cancel(`${block.id}#recheck`);

  const fireAt = blockFireAt(block);
  if (fireAt == null || fireAt <= now) return;

  if (block.alert === "execution") {
    alarm.schedule({
      id: block.id,
      fireAt,
      title: block.title,
      recurrence: "none", // per-date blocks: every alarm is one-shot
      note: block.microStartNote ?? "",
      createdAt: block.createdAt,
      leadMinutes: block.alarmLeadMinutes,
      sound: !!block.alertSound, // D43: the moment itself can be vibration-only
    });
  } else {
    // The soft tier owns its own moments (alertLeads), so it needs the block's START, not one fire time.
    await scheduleBlockSoftAlert(block, blockStartAt(block));
  }
}

/**
 * Delete-safety: cancel **every** path a block could still fire on — the exact alarm, the **armed 5-min
 * re-check** ("<id>#recheck", which the native moment schedules on its own and which JS must therefore
 * know to kill), and the soft alert. Otherwise a block you already resolved (or deleted) still asks
 * "진짜 했어?" five minutes later.
 */
export function unscheduleBlock(id: string): void {
  alarm.cancel(id);
  alarm.cancel(`${id}#recheck`);
  void cancelBlockSoftAlert(id);
}

/**
 * The D-1 snapshot fields for a block being saved (D23). Future date → the snapshot mirrors the live
 * values (the plan is still being designed). Today/past → the snapshot is already frozen: an existing
 * block keeps its `snap*`, and a block *created* on the day snapshots its creation values.
 */
export function snapshotFor(
  live: Pick<TimeBlock, "date" | "start" | "end" | "title">,
  prev: TimeBlock | null,
  now: number = Date.now()
): Pick<TimeBlock, "snapStart" | "snapEnd" | "snapTitle" | "plannedAt"> {
  const frozen = live.date <= todayYmd(now); // the day has arrived → the plan of record stands
  if (frozen && prev) {
    return { snapStart: prev.snapStart, snapEnd: prev.snapEnd, snapTitle: prev.snapTitle, plannedAt: prev.plannedAt };
  }
  return { snapStart: live.start, snapEnd: live.end, snapTitle: live.title, plannedAt: now };
}

/**
 * Past blocks whose execution moment should have fired but left **no** trace (device off, alarm never
 * armed). The marker-based catch-up net can't see these — they never fired — so R6 reconstructs them
 * here. `stillArmed` = ids the native mirror still holds with a past fireAt: the WorkManager backup will
 * re-fire those (leaving a marker), so JS must not claim them.
 */
export function pastUnfiredBlocks(
  blocks: TimeBlock[],
  stillArmed: Set<string>,
  from: number,
  now: number = Date.now()
): TimeBlock[] {
  return blocks.filter((b) => {
    if (!isExecution(b)) return false; // only the CUE can be "missed" — a soft alert just informed you
    const fireAt = blockFireAt(b);
    return fireAt != null && fireAt <= now && fireAt > from && !stillArmed.has(b.id);
  });
}

/**
 * The day's genuinely empty gaps (H3/H10 free-slot hint, PRD R6): so a workout is placed where it can
 * actually happen instead of on top of a lecture. Blocks without an `end` occupy only their start
 * minute. Gaps shorter than `minMinutes` aren't worth offering.
 */
export function freeSlots(
  dayBlocks: TimeBlock[],
  dayStart = "07:00",
  dayEnd = "23:00",
  minMinutes = 30
): { start: string; end: string }[] {
  const toMin = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

  const busy = dayBlocks
    .map((b) => ({ from: toMin(b.start), to: b.end ? toMin(b.end) : toMin(b.start) }))
    .filter((i) => i.to >= i.from)
    .sort((a, b) => a.from - b.from);

  const out: { start: string; end: string }[] = [];
  let cursor = toMin(dayStart);
  const end = toMin(dayEnd);
  for (const i of busy) {
    if (i.from - cursor >= minMinutes) out.push({ start: toHm(cursor), end: toHm(i.from) });
    cursor = Math.max(cursor, i.to);
  }
  if (end - cursor >= minMinutes) out.push({ start: toHm(cursor), end: toHm(end) });
  return out;
}
