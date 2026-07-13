// The SOFT notification path (full-app PRD R15a) — ordinary local notifications, distinct from the
// execution cue: they do NOT pierce the lock screen and are not held to the S1 tolerance (best-effort).
// Two users of it:
//   1. Task plain reminders (prototype R1/R2) — chosen minute-offsets before a task's set time.
//      Identifiers `${taskId}-r${offset}`.
//   2. ImportantEvent advance notification (full-app R3/D18) — one local alert at
//      `event time − notifyLeadMinutes` (falls back to the personal default lead when unset).
//      Identifiers `${eventId}-e`.
// Both are one-shot per next occurrence; the app re-arms on open so recurring ones keep rolling.
//
// expo-notifications is loaded LAZILY + defensively: if its native module isn't linked yet (e.g. before
// a full `prebuild` + rebuild), notifications silently no-op instead of crashing the whole app.

import type { ImportantEvent, Task } from "@/core/data/types";

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

// ── ImportantEvent advance notification (R3) ────────────────────────────────────────────────────────

const EVENT_SUFFIX = "-e";

/** The personal default lead (R13/D28), required lazily so this module's pure time math stays importable
 *  without pulling in AsyncStorage. 0 (fire at the event time) if settings can't be read. */
async function defaultLead(): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSettings } = require("@/core/data/settingsRepository");
    return (await getSettings()).defaultLeadMinutes ?? 0;
  } catch {
    return 0;
  }
}

/** An event alerts at `date+time − lead`. An **untimed** event has no moment to count back from, so it
 *  gets no advance alert (R3 is defined on `time − notifyLeadMinutes`). Past moments are skipped. */
export function eventNotifyAt(event: ImportantEvent, lead: number, now: number): number | null {
  if (!event.time) return null;
  const [y, mo, d] = event.date.split("-").map(Number);
  const [h, mi] = event.time.split(":").map(Number);
  if ([y, mo, d, h, mi].some(isNaN)) return null;
  const at = new Date(y, mo - 1, d, h, mi, 0, 0).getTime() - lead * 60_000;
  return at > now ? at : null;
}

export async function cancelEventNotification(eventId: string): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(`${eventId}${EVENT_SUFFIX}`);
  } catch {
    // best-effort — nothing scheduled under that id
  }
}

/** Schedule (replacing any existing) the soft advance alert for one event. Lead = the event's own
 *  `notifyLeadMinutes`, else the personal default (R3 "default if unset", D28). */
export async function scheduleEventNotification(event: ImportantEvent): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await cancelEventNotification(event.id);
    const lead = event.notifyLeadMinutes ?? (await defaultLead());
    const at = eventNotifyAt(event, lead, Date.now());
    if (at == null) return;
    await N.scheduleNotificationAsync({
      identifier: `${event.id}${EVENT_SUFFIX}`,
      content: {
        title: event.title,
        body: lead > 0 ? `${lead}분 후 · ${event.time}` : `지금 · ${event.time}`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  } catch {
    // best-effort
  }
}

/** Re-arm every event alert from scratch (app open / after a backup import): drop all event alerts —
 *  including ghosts of deleted events — then schedule the current set. */
export async function rearmEventNotifications(events: ImportantEvent[]): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    const all = await N.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier?.endsWith(EVENT_SUFFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch {
    // best-effort
  }
  for (const e of events) await scheduleEventNotification(e);
}
