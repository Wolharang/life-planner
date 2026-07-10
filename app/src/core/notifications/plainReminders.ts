// Plain reminders (PRD R1/R2) — the SOFT path, distinct from the execution alarm: ordinary local
// notifications at chosen minute-offsets before the set time. Not lock-screen takeovers, not held to
// the S1 tolerance (best-effort). One-shot per next occurrence; the app reschedules on open so
// recurring reminders keep rolling. Identifiers are `${taskId}-r${offset}` so they're cancelable.
//
// expo-notifications is loaded LAZILY + defensively: if its native module isn't linked yet (e.g. before
// a full `prebuild` + rebuild), reminders silently no-op instead of crashing the whole app.

import type { Task } from "@/core/data/types";

function getNotifications(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch {
    return null;
  }
}

/** Android 13+ runtime notification permission — needed by plain reminders (and the FSI-degraded
 *  heads-up). Requested from first-run onboarding (PRD §8). No-op if the native module isn't linked. */
export async function requestNotificationPermission(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.requestPermissionsAsync();
  } catch {
    // notifications unavailable — best-effort
  }
}

/** Whether the notification permission is currently granted. Defaults to true when the native module
 *  isn't linked yet, so onboarding never blocks on a dev skew. */
export async function notificationPermissionGranted(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return true;
  try {
    const p = await N.getPermissionsAsync();
    return !!p?.granted;
  } catch {
    return true;
  }
}

function nextReminderAt(
  setTime: string,
  offset: number,
  recurrence: Task["recurrence"],
  now: number
): number | null {
  const [h, m] = setTime.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  let rt = d.getTime() - offset * 60_000;
  if (recurrence === "none") return rt > now ? rt : null;
  const step = recurrence === "weekly" ? 7 : 1;
  while (rt <= now) {
    d.setDate(d.getDate() + step);
    rt = d.getTime() - offset * 60_000;
  }
  return rt;
}

export async function cancelReminders(taskId: string): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    const all = await N.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier?.startsWith(`${taskId}-r`)) {
        await N.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // notifications unavailable — reminders are best-effort
  }
}

export async function scheduleReminders(task: Task): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await cancelReminders(task.id);
    for (const offset of task.plainReminderOffsets ?? []) {
      const at = nextReminderAt(task.setTime, offset, task.recurrence, Date.now());
      if (at == null) continue;
      await N.scheduleNotificationAsync({
        identifier: `${task.id}-r${offset}`,
        content: { title: task.title, body: `${offset}분 후 · ${task.setTime}` },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
      });
    }
  } catch {
    // best-effort
  }
}
