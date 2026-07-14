// **The plan can change on a phone that is not in your hand** (D77).
//
// Sync only ran while the app was open. That was a hidden precondition of being *correct*, and the 아침 요약
// is what exposed it: edit tomorrow on phone A, leave phone B rebooted and unopened, and B briefs you from a
// plan that no longer exists. Two phones, two different mornings, and nothing in either to say which is true.
//
// The briefing is a **notification**, so every phone sends it — only the execution moment is addressed to one
// (D70), because only it takes the screen. **So the fix is not to silence a phone. It is to make sure they know
// the same thing.**
//
// This registers a periodic background task:
//   · it survives a reboot — Android's JobScheduler persists it, so the phone does not have to be opened;
//   · it pulls the account's real server state (`syncPullOnce`) and re-cuts the briefings from it;
//   · it re-arms alarms through the same hooks a foreground sync uses, so a block another phone moved fires at
//     its new time even here.
//
// **It is best-effort, and honestly so.** Android throttles background work (Doze, per-app standby): the OS
// decides when this runs, not us. It is a *repair*, not a guarantee — the briefing is still written from what
// this phone last knew. What it buys is that "last knew" is usually minutes old instead of days.
//
// The lever does not depend on any of this. The execution alarm is a native exact alarm, re-armed at boot by
// the alarm module itself; it has never needed the app to be open.

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

export const BACKGROUND_SYNC_TASK = "lp-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Required lazily: this file is imported at app start, and these pull in AsyncStorage/Firebase.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncPullOnce } = require("@/core/data/sync");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { rescheduleMorningBrief } = require("@/core/notifications/morningBrief");

    const pulled = await syncPullOnce();

    // The foreground registers this hook through `startSync`; a headless task has no such registration, so a
    // block another phone MOVED would land in storage here and never re-arm. Do it explicitly.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { rearmBlockAlarms } = require("@/core/data/blockRepository");
    if (pulled) await rearmBlockAlarms();

    await rescheduleMorningBrief(); // rebuilt even when the pull failed: local edits still have to land

    return pulled ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Ask Android to run the task periodically. 15 minutes is the floor the platform allows; what we actually get
 * is up to the OS.
 *
 * `startOnBoot` is the point of the whole exercise — without it, the one phone that most needs repairing (the
 * one that was rebooted and never opened) is exactly the one that never runs.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (already) return;

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false, // keep running after the app is swiped away
      startOnBoot: true, // and after the phone is restarted, without it ever being opened
    });
  } catch {
    // Background execution unavailable (an OEM that forbids it, a permission withheld). The app is unaffected:
    // sync still runs whenever a screen is up, and the alarm never needed it.
  }
}
