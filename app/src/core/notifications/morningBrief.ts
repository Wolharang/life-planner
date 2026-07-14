// **아침 요약** — one silent notification a day, saying what the day holds.
//
// It is a *briefing*, not a cue, and the difference is the whole design:
//
//   · **It is silent.** No sound, no vibration. Every needless buzz spends the budget that keeps the one loud
//     thing loud (C1/D30) — and the one loud thing is the execution moment, never this.
//   · **It does not pierce the lock screen** (R15). Only the execution cue may do that.
//   · **A block can opt out** (`inBrief: false`). A briefing that lists a standing 강의 and a commute every
//     single morning is a briefing nobody reads by the third day.
//
// ## Why it is scheduled per-day, and not as a repeating alarm
//
// A local notification's text is fixed **when it is scheduled**. A daily repeat would have to say something
// generic ("오늘 일정을 확인하세요"), which is a notification that carries no information — the thing we are
// trying not to be. So the next two weeks are scheduled individually, each with **that day's** actual list,
// and the whole set is rebuilt whenever the plan changes. The cost is a re-schedule on every block edit; the
// benefit is that the notification says the true thing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TimeBlock } from "@/core/data/types";

const HORIZON_DAYS = 14;
const ID = (ymd: string) => `brief-${ymd}`;
const CHANNEL = "lp-brief-v1";

function getNotifications(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch {
    return null;
  }
}

/** Android freezes a channel's sound and vibration at creation, so the silence has to be structural. */
let channelReady = false;
async function ensureChannel(N: any): Promise<string | undefined> {
  if (channelReady) return CHANNEL;
  try {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: "아침 요약",
      importance: N.AndroidImportance.DEFAULT, // not HIGH: it must never take over the screen
      sound: null,
      vibrationPattern: null, // `null`, not `[]` — an empty array still buzzes on some OEMs
      enableVibrate: false,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: false,
    });
    channelReady = true;
    return CHANNEL;
  } catch {
    return undefined;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A block is in the briefing unless it opted out. Undefined means yes — see `TimeBlock.inBrief`. */
export const inBrief = (b: TimeBlock): boolean => b.inBrief !== false;

/**
 * What the briefing for one day would say. Exported because the calendar shows this exact text back to the
 * user — **a preview that is not the real thing is just another promise to check later.**
 */
export function briefBody(blocks: TimeBlock[]): string {
  const rows = blocks
    .filter(inBrief)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((b) => `${b.start} ${b.title}`);
  return rows.join("\n");
}

export function briefTitle(blocks: TimeBlock[]): string {
  const n = blocks.filter(inBrief).length;
  return `오늘 일정 ${n}개`;
}

export interface PlannedBrief {
  ymd: string;
  at: number;
  title: string;
  body: string;
}

/**
 * **Which briefings are still to come.** Pure, because the rule it encodes is one the user asked about by name:
 *
 * ***A briefing is a statement about the morning it was sent.*** Edit today's plan at 09:00 and today's briefing
 * does **not** go out again — 07:00 has been and gone, and a second "오늘 일정" arriving at lunchtime would be
 * describing a morning that already happened. Tomorrow's is re-cut; today's is history.
 *
 * A day with nothing in it gets nothing: an empty notification at 7am is worse than none.
 */
export function planBriefs(
  blocks: TimeBlock[],
  time: string,
  now: number,
  horizonDays = HORIZON_DAYS
): PlannedBrief[] {
  const [h, m] = String(time || "07:00").split(":").map(Number);
  const out: PlannedBrief[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const ymd = ymdOf(d);

    const ofDay = blocks.filter((b) => b.date === ymd && inBrief(b));
    if (ofDay.length === 0) continue;

    const at = new Date(d);
    at.setHours(h || 0, m || 0, 0, 0);
    if (at.getTime() <= now) continue; // that morning has already been — it does not get a second briefing

    out.push({ ymd, at: at.getTime(), title: briefTitle(ofDay), body: briefBody(ofDay) });
  }
  return out;
}

/**
 * Rebuild the next two weeks of briefings. Called at app start and after **any** change to the plan — a
 * briefing built from yesterday's plan would describe a day that no longer exists.
 */
export async function rescheduleMorningBrief(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  try {
    // Clear the whole horizon first. A day whose blocks were all deleted must lose its briefing too — an empty
    // notification arriving at 7am is worse than none.
    for (let i = 0; i < HORIZON_DAYS + 2; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      try {
        await N.cancelScheduledNotificationAsync(ID(ymdOf(d)));
      } catch {
        // nothing scheduled for that day
      }
    }

    // Lazily required: this module is imported by the repositories, and importing them back would be a cycle.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSettings } = require("@/core/data/settingsRepository");
    const settings = await getSettings();
    if (!settings.morningBriefOn) return;

    // **Every phone briefs.** The briefing is a notification, and notifications go to all of them — only the
    // execution moment is addressed to one (D70), because only it takes the screen. What must be solved is not
    // *who* speaks but *whether they know the same thing*: see `syncBeforeBrief` (D77).

    const channelId = await ensureChannel(N);

    const raw = await AsyncStorage.getItem("lp.blocks.v1");
    const blocks: TimeBlock[] = raw ? (JSON.parse(raw) as TimeBlock[]) : [];

    for (const plan of planBriefs(blocks, settings.morningBriefTime, Date.now())) {
      await N.scheduleNotificationAsync({
        identifier: ID(plan.ymd),
        content: { title: plan.title, body: plan.body, sound: null, vibrate: null },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(plan.at), channelId },
      });
    }
  } catch {
    // Best-effort, always. A briefing is a convenience; it must never be able to break the app that carries the
    // lever.
  }
}
