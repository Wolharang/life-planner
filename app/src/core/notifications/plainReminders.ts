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

// R15 is a *policy*, so it must be enforced by the channel, not by hope: the soft alert gets its own
// channel with **DEFAULT importance, no sound, PRIVATE lock-screen visibility** — it informs, it does
// not pierce. (The execution cue's channel is the opposite by design: HIGH + bypassDnd + PUBLIC, set
// natively in AlarmNotifications.kt.) Android freezes a channel's settings after creation, so this id
// is versioned — bump it if the policy ever changes.
// Two channels, because Android freezes a channel's sound after creation: a **silent** one (vibration
// only — the default) and an **audible** one (D43: a soft alert may ring if the user wants it to).
// Neither pierces the lock screen — that stays the execution cue's alone (R15).
const SOFT_CHANNEL_ID = "lp-soft-v1";
const SOFT_SOUND_CHANNEL_ID = "lp-soft-sound-v1";
const channelsReady = new Set<string>();

async function ensureSoftChannel(N: any, withSound = false): Promise<string | undefined> {
  const id = withSound ? SOFT_SOUND_CHANNEL_ID : SOFT_CHANNEL_ID;
  if (channelsReady.has(id)) return id;
  try {
    await N.setNotificationChannelAsync(id, {
      name: withSound ? "알림 (소리)" : "알림 (진동만)",
      importance: N.AndroidImportance.DEFAULT, // not HIGH → no heads-up takeover, never a lock-screen takeover
      sound: withSound ? "default" : null,
      vibrationPattern: [0, 220, 120, 220],
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: false,
    });
    channelsReady.add(id);
    return id;
  } catch {
    return undefined; // channel API unavailable (non-Android / not linked) — schedule without it
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
    const channelId = await ensureSoftChannel(N);
    for (const offset of task.plainReminderOffsets ?? []) {
      const at = nextReminderAt(task.setTime, offset, task.recurrence, Date.now());
      if (at == null) continue;
      await N.scheduleNotificationAsync({
        identifier: `${task.id}-r${offset}`,
        content: { title: task.title, body: `${offset}분 후 · ${task.setTime}` },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId },
      });
    }
  } catch {
    // best-effort
  }
}

// ── Block soft alert (D40) ─────────────────────────────────────────────────────────────────────────
// The tier the founder asked for (2026-07-11): a block that just **tells** you — notification +
// vibration at `start − lead` — with **no forced full-screen execution**. It rides the same quiet
// channel as the event alert, so R15 holds structurally: only the execution cue pierces the lock screen.
// Identifiers `${blockId}-b` (task reminders `-r*`, events `-e`).

const BLOCK_SUFFIX = "-b";
/** A soft alert can arrive at up to 3 moments the USER picks (D45) — not on a fixed repeat interval. */
export const SOFT_LEADS_MAX = 3;

export async function cancelBlockSoftAlert(blockId: string): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  // Cancel generously (5 > the 3 we allow) so alerts left by an older, more permissive build still die.
  for (let i = 0; i < 5; i++) {
    try {
      await N.cancelScheduledNotificationAsync(`${blockId}${BLOCK_SUFFIX}${i}`);
    } catch {
      // best-effort — nothing scheduled under that id
    }
  }
}

/** "1시간 전 · 09:00" — the user asked for THIS moment, so say which one it is. */
const leadLabel = (lead: number) =>
  lead === 0 ? "지금" : lead % 60 === 0 ? `${lead / 60}시간 전` : `${lead}분 전`;

/**
 * The soft tier (D40/D43/D45): a plain notification that **tells** you — at up to **3 moments the user
 * chose** (`alertLeads`, minutes before start; e.g. an hour before, 15 min before, and on the dot). It
 * never takes the screen, so it can never become a second execution cue (R15).
 */
export async function scheduleBlockSoftAlert(
  block: {
    id: string;
    title: string;
    start: string;
    end?: string;
    alarmLeadMinutes: number;
    alertSound?: boolean;
    alertLeads?: number[];
  },
  startAt: number
): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await cancelBlockSoftAlert(block.id);
    const channelId = await ensureSoftChannel(N, !!block.alertSound);
    const now = Date.now();

    const leads = (block.alertLeads?.length ? block.alertLeads : [block.alarmLeadMinutes])
      .map((l) => Math.max(0, Math.round(l)))
      .filter((l, i, a) => a.indexOf(l) === i) // the same moment twice is just noise
      .sort((a, b) => b - a) // earliest notification first
      .slice(0, SOFT_LEADS_MAX);

    for (let i = 0; i < leads.length; i++) {
      const at = startAt - leads[i] * 60_000;
      if (at <= now) continue; // a moment that has already passed is simply skipped
      await N.scheduleNotificationAsync({
        identifier: `${block.id}${BLOCK_SUFFIX}${i}`,
        content: {
          title: block.title,
          body: `${leadLabel(leads[i])} · ${block.start}${block.end ? `–${block.end}` : ""}`,
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId },
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
    const channelId = await ensureSoftChannel(N); // R15: soft, quiet, does not pierce the lock screen
    await N.scheduleNotificationAsync({
      identifier: `${event.id}${EVENT_SUFFIX}`,
      content: {
        title: event.title,
        body: lead > 0 ? `${lead}분 후 · ${event.time}` : `지금 · ${event.time}`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId },
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
