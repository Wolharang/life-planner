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

/** When the execution moment should fire: `start − lead`. Null when the block isn't a cue target. */
export function blockFireAt(block: TimeBlock): number | null {
  if (!block.executionAlarm || isSkipped(block)) return null;
  return blockStartAt(block) - block.alarmLeadMinutes * 60_000;
}

/** Arm (or, if off / skipped / already past, cancel) a block's execution intervention. */
export function scheduleBlock(block: TimeBlock, now: number = Date.now()): void {
  const fireAt = blockFireAt(block);
  if (fireAt == null || fireAt <= now) {
    alarm.cancel(block.id); // nothing to arm — and never leave a stale alarm behind
    return;
  }
  alarm.schedule({
    id: block.id,
    fireAt,
    title: block.title,
    recurrence: "none", // per-date blocks: every alarm is one-shot
    note: block.microStartNote ?? "",
    createdAt: block.createdAt,
    leadMinutes: block.alarmLeadMinutes,
  });
}

/** Delete-safety: cancel the alarm so a removed block leaves no ghost fire. */
export function unscheduleBlock(id: string): void {
  alarm.cancel(id);
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
