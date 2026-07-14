// Drain the native GPS fixes and turn them into 성공/실패 — the JS brain behind the native hands.
//
// Called on app open, AFTER the normal outcome settle, so a location verdict is the arbiter for a workout/run
// 실행 block: "진짜 했어?" answered by *where you were*, not by a self-report. It is only ever a **default** —
// a block the user judged by hand (`evalSource: "manual"`) is never touched.
//
// The raw coordinates are cleared here and never stored: only the derived status survives.

import { alarm, type GeoSampleGroup } from "@/core/notifications/alarm";
import { listGyms } from "@/core/data/gymRepository";
import { listBlocks, updateBlock } from "@/core/data/blockRepository";
import { recordOutcome } from "@/core/data/outcomeRepository";
import { evaluateByLocation } from "@/core/schedule/autoEval";

/** Don't decide from a half-collected set: wait for all three fixes, or ~16 min past the first (the +15m sample
 *  is not coming). Two fixes still decide moved-vs-stayed; one abstains. */
const SETTLE_AFTER_MS = 16 * 60_000;

export async function applyGeoEval(now: number = Date.now()): Promise<void> {
  let groups: GeoSampleGroup[];
  try {
    groups = alarm.getGeoSamples();
  } catch {
    return; // native module not linked (dev skew) — nothing to do
  }
  if (!groups.length) return;

  const gyms = await listGyms();
  const blocks = await listBlocks();

  for (const g of groups) {
    const samples = g.samples ?? [];
    const firstAt = samples.length ? Math.min(...samples.map((s) => s.at)) : now;
    const done = samples.length >= 3 || now - firstAt > SETTLE_AFTER_MS;
    if (!done) continue; // still collecting — leave the fixes for a later open

    // Collection is over: clear the raw fixes whatever the outcome (kept off disk from here on).
    try {
      alarm.clearGeoSamples(g.blockId, g.date);
    } catch {
      /* best-effort */
    }

    const block = blocks.find((b) => b.id === g.blockId);
    if (!block) continue;
    if (block.evalSource === "manual") continue; // the user's own call wins over any auto verdict

    const verdict = evaluateByLocation(samples, gyms);
    if (!verdict) continue; // too few usable fixes — leave it for the user to judge
    if (block.status === verdict && block.evalSource === "location") continue; // already applied

    // **Record the outcome, not just the block status** — otherwise the occurrence has a fire marker but no
    // outcome, so the R6 catch-up net reads it as unresolved: it nags every open and, after the 7-day window,
    // auto-archives it as a **miss**, silently overwriting a GPS 성공. `recordOutcome` upserts by taskId|date, so
    // this also supersedes a self-report the user gave at the re-check (source "location" overrides it, and a
    // later catch-up can no longer touch it). Mirrors `settle` (home).
    await recordOutcome({
      taskId: block.id,
      title: block.title,
      date: g.date,
      status: verdict === "success" ? "done" : "miss",
      source: "location",
      at: now,
    });
    await updateBlock({
      ...block,
      status: verdict,
      evalSource: "location",
      completedAt: verdict === "success" ? now : undefined,
      updatedAt: now,
    });
  }
}
