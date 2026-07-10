// Bridges a Task (domain) to the exact-alarm module (PRD R2). Computes the next effective fire time
// (= set time − lead, for the next applicable NON-SKIPPED date) and schedules / cancels the lock-screen
// alarm. Recurring re-arming is handled natively (AlarmReceiver advances the next occurrence).

import type { Task } from "@/core/data/types";
import { alarm } from "@/core/notifications/alarm";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function todayYmd(now: number = Date.now()): string {
  return ymd(new Date(now));
}

/** Occurrence date is the SET-time date, not necessarily the effective fire date (lead may cross midnight). */
export function occurrenceDateForFire(fireAt: number, leadMinutes: number): string {
  return ymd(new Date(fireAt + leadMinutes * 60_000));
}

/** Next fire epoch ms (= set time − lead, next applicable non-skipped date), or null if nothing to fire. */
export function nextEffectiveFireAt(task: Task, now: number = Date.now()): number | null {
  const [h, m] = task.setTime.split(":").map(Number);
  const skipped = new Set(task.skippedDates ?? []);
  const d = new Date(now);
  d.setHours(h, m, 0, 0); // today at set time
  let effective = d.getTime() - task.leadMinutes * 60_000;

  if (task.recurrence === "none") {
    // Creation validates the set time is future; a "오늘은 쉼" skip of that date → nothing to schedule.
    return skipped.has(ymd(d)) ? null : effective;
  }

  const stepDays = task.recurrence === "weekly" ? 7 : 1;
  // Advance only when today's SET time itself has passed (or the date is pre-skipped). A future set
  // time whose *effective* time (set − lead) is already past is returned as-is so it fires immediately
  // (PRD R1: "lead pushes effective into the past while set time is still future → fire ASAP"), matching
  // the one-shot branch — rather than rolling to the next date and dropping today's occurrence.
  while (d.getTime() <= now || skipped.has(ymd(d))) {
    d.setDate(d.getDate() + stepDays);
    effective = d.getTime() - task.leadMinutes * 60_000;
  }
  return effective;
}

/** Schedule (or, if off / fully skipped, cancel) a task's execution intervention. */
export function scheduleTask(task: Task): void {
  if (!task.executionAlarm) {
    alarm.cancel(task.id);
    return;
  }
  const fireAt = nextEffectiveFireAt(task);
  if (fireAt == null) {
    alarm.cancel(task.id);
    return;
  }
  alarm.schedule({
    id: task.id,
    fireAt,
    title: task.title,
    recurrence: task.recurrence,
    note: task.microStartNote ?? "",
    createdAt: task.createdAt,
    leadMinutes: task.leadMinutes,
  });
}

/** Delete-safety (R1): cancel the alarm so there is no ghost fire after a task is removed. */
export function unscheduleTask(id: string): void {
  alarm.cancel(id);
}

/**
 * Past occurrences that a recurring task *should* have fired, walking backward from the currently
 * ARMED occurrence (`anchorFireAt` = the native mirror's next set−lead epoch, the ground-truth series).
 * R6 uses this to catch the "never fired" case (device off at the effective time, or the alarm was
 * never armed): such occurrences leave NO fire marker, so the marker-based net alone misses them
 * (PRD R6 "놓쳤어요"; impl-plan Phase 4).
 *
 * Anchoring on the armed fireAt — not on "today" — is what makes WEEKLY correct: today may not be the
 * task's weekday, so a today-anchored walk would both miss the real weekly occurrence and synthesize
 * phantom ones on the wrong weekday (false "놓쳤어요" / false miss). Daily is unaffected (every day is
 * an occurrence). One-shot ("none") tasks are excluded: a missed one-shot is re-fired late by the
 * native catch-up (which then leaves a marker), and a "none" task carries no recurring series.
 *
 * Bounded below by `from` and the task's creation time.
 */
export function pastOccurrenceFires(
  task: Task,
  anchorFireAt: number,
  from: number,
  now: number = Date.now()
): { date: string; effectiveTime: number }[] {
  if (!task.executionAlarm || task.recurrence === "none") return [];
  const lo = Math.max(from, task.createdAt ?? 0);
  const skipped = new Set(task.skippedDates ?? []);
  const stepDays = task.recurrence === "weekly" ? 7 : 1;
  const leadMs = task.leadMinutes * 60_000;
  const out: { date: string; effectiveTime: number }[] = [];
  // `d` is held at each occurrence's SET time (anchor + lead) so its date key matches skippedDates /
  // outcome dates; effectiveTime = set − lead.
  const d = new Date(anchorFireAt + leadMs); // armed occurrence's set time
  d.setDate(d.getDate() - stepDays); // step back to the most recent prior occurrence
  for (;;) {
    const effective = d.getTime() - leadMs;
    if (effective <= lo) break;
    if (effective <= now && !skipped.has(ymd(d))) {
      out.push({ date: ymd(d), effectiveTime: effective });
    }
    d.setDate(d.getDate() - stepDays);
  }
  return out;
}
