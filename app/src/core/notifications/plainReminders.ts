// The SOFT notification path (full-app PRD R15a) — ordinary local notifications, distinct from the
// execution cue: they do NOT pierce the lock screen and are not held to the S1 tolerance (best-effort).
// Two users of it:
//   1. Task plain reminders (prototype R1/R2) — chosen minute-offsets before a task's set time.
//      Identifiers `${taskId}-r${offset}`.
//   2. The block **알림** tier (D40/D43/D45) — up to 3 chosen moments before a block's start.
//      Identifiers `${blockId}-b${i}`. This is also what a `실행` block falls back to on a phone the
//      moment is not addressed to (D70) — it must still *tell* you, just not take the screen.
// Both are one-shot per next occurrence; the app re-arms on open so recurring ones keep rolling.
//
// (The ImportantEvent advance alert that used to live here is gone — D67 retired the entity; an event is
// just a block whose tier says it only holds the hour.)
//
// expo-notifications is loaded LAZILY + defensively: if its native module isn't linked yet (e.g. before
// a full `prebuild` + rebuild), notifications silently no-op instead of crashing the whole app.

import { loudnessOf, type BlockLoudness, type Task } from "@/core/data/types";

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
// **THREE channels**, because Android freezes a channel's sound *and* its vibration after creation — you
// cannot change either later, you can only ship another channel (data-model §2.3). So one per loudness (D65):
//   무음  — it appears in the shade and says nothing. No sound, **no vibration**.
//   진동  — the default.
//   소리  — it rings (the tone itself is a global setting).
// None of them pierces the lock screen — that stays the execution cue's alone (R15).
const SOFT_CHANNELS: Record<BlockLoudness, { id: string; name: string }> = {
  silent: { id: "lp-soft-silent-v1", name: "알림 (무음)" },
  vibrate: { id: "lp-soft-v1", name: "알림 (진동만)" },
  sound: { id: "lp-soft-sound-v1", name: "알림 (소리)" },
};
const channelsReady = new Set<string>();

async function ensureSoftChannel(N: any, loudness: BlockLoudness): Promise<string | undefined> {
  const { id, name } = SOFT_CHANNELS[loudness];
  if (channelsReady.has(id)) return id;
  try {
    await N.setNotificationChannelAsync(id, {
      name,
      importance: N.AndroidImportance.DEFAULT, // not HIGH → no heads-up takeover, never a lock-screen takeover
      sound: loudness === "sound" ? "default" : null,
      // `null` is the only way to say "do not vibrate" — an empty array still buzzes on some OEMs.
      vibrationPattern: loudness === "silent" ? null : [0, 220, 120, 220],
      enableVibrate: loudness !== "silent",
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
    const channelId = await ensureSoftChannel(N, "vibrate");
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

export interface SoftAlertBlock {
  id: string;
  title: string;
  start: string;
  end?: string;
  alarmLeadMinutes: number;
  alertSound?: boolean;
  alertLoudness?: BlockLoudness;
  alertLeads?: number[];
}

/**
 * **Which moments a soft alert actually lands on** — pure, so it can be tested (the scheduling call around
 * it is an expo-notifications side-effect that only exists on a device).
 *
 * A moment already in the past is dropped rather than fired late: a notification that says "1시간 전" when
 * the hour is gone is worse than silence — it is a lie about the clock.
 */
export function softLeadMoments(block: SoftAlertBlock, startAt: number, now: number): number[] {
  return (block.alertLeads?.length ? block.alertLeads : [block.alarmLeadMinutes])
    .map((l) => Math.max(0, Math.round(l)))
    .filter((l, i, a) => a.indexOf(l) === i) // the same moment twice is just noise
    .sort((a, b) => b - a) // earliest notification first
    .slice(0, SOFT_LEADS_MAX)
    .map((l) => startAt - l * 60_000)
    .filter((at) => at > now);
}

/**
 * The soft tier (D40/D43/D45): a plain notification that **tells** you — at up to **3 moments the user
 * chose** (`alertLeads`, minutes before start; e.g. an hour before, 15 min before, and on the dot). It
 * never takes the screen, so it can never become a second execution cue (R15).
 */
export async function scheduleBlockSoftAlert(block: SoftAlertBlock, startAt: number): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await cancelBlockSoftAlert(block.id);
    const channelId = await ensureSoftChannel(N, loudnessOf(block));

    const moments = softLeadMoments(block, startAt, Date.now());
    for (let i = 0; i < moments.length; i++) {
      const lead = Math.round((startAt - moments[i]) / 60_000);
      await N.scheduleNotificationAsync({
        identifier: `${block.id}${BLOCK_SUFFIX}${i}`,
        content: {
          title: block.title,
          body: `${leadLabel(lead)} · ${block.start}${block.end ? `–${block.end}` : ""}`,
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(moments[i]), channelId },
      });
    }
  } catch {
    // best-effort
  }
}
