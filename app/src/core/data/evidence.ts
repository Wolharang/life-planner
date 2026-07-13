// The self-experiment's evidence — and the one button that clears it.
//
// `lp.outcomes / fires / missed / latencies` (data-model §2.7) are the ONLY record of what the lever
// actually did: S1 (execution rate), S2 (alarm reliability), S5 (no-guilt return). They are deliberately
// **not synced** — they are this device's testimony, not shared state.
//
// **Why a reset button exists at all.** A self-experiment is only worth running on honest data, and this
// device's evidence is not honest: it carries prototype leftovers, blocks named 테스트, and — worst —
// outcomes the bugs we just fixed **invented** (a miss recorded because a re-check was silently dropped, a
// done double-counted by a screen rotation). **A false record is worse than no record**, because we would
// reason from it: PRD §4's falsification condition ("if S1 is no better than a plain reminder, stop and
// redesign") would fire on a number that was never about the lever. So the founder must be able to draw a
// line and say: day zero starts now.
//
// It clears the **evidence**, never the **plan**. Blocks, events, expenses and meals are untouched — a reset
// must not cost you tomorrow's workout. (Nothing here is synced, so nothing propagates to the other phone.)

import AsyncStorage from "@react-native-async-storage/async-storage";

const EVIDENCE_KEYS = [
  "lp.outcomes.v1", // done / miss / skipped, with their source (S1, S5)
  "lp.fires.v1", // "the moment appeared" markers (the catch-up net's grounds, S2 latency)
  "lp.missed.v1", // native never-fired markers
  "lp.latencies.v1", // scheduled-vs-actual fire times (S2)
] as const;

/** Wipe the measurement/catch-up stores. Returns how many rows were destroyed, so the confirmation can be
 *  honest about what it is about to do. */
export async function evidenceCount(): Promise<number> {
  let n = 0;
  for (const key of EVIDENCE_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const rows = JSON.parse(raw);
      if (Array.isArray(rows)) n += rows.length;
    } catch {
      /* a corrupt store is about to be cleared anyway */
    }
  }
  return n;
}

export async function resetEvidence(): Promise<void> {
  await AsyncStorage.multiRemove([...EVIDENCE_KEYS]);
}
