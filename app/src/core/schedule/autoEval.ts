// **Auto-evaluation by location** (founder, 2026-07-14) — the workout/run execution block decides its own
// 성공/실패 from where the phone was, so the user does not have to remember to mark it.
//
// The rule, exactly as specified:
//   · Three fixes are taken — at commit (t=0), at the re-check (t≈5m), and 10 minutes after that (t≈15m).
//   · **If the phone moved** (any fix is farther than the radius from the others) → 성공. You went somewhere.
//   · **If it stayed put** (all fixes clustered) → 실패 — *unless* that spot is one of the user's saved gyms,
//     in which case → 성공. Standing still is what you DO at the gym; standing still at home is the miss.
//
// This module is the **pure decision** — no GPS, no storage, no native — so it is fully testable. Capturing the
// fixes and persisting the verdict live elsewhere. The verdict is only ever a **default**: the user can override
// it by hand (and, on a manual 실패, write the reason), which is why this never touches `failReason`.

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A place the user marked as a gym. Standing still here counts as 성공. `updatedAt` makes it Syncable — a gym
 *  is a static reference the member saves, and it syncs across their devices like any other input (§sync). */
export interface Gym extends GeoPoint {
  id: string;
  label: string;
  updatedAt: number;
}

/** How close two fixes must be to count as "the same place". Generous enough to absorb urban GPS jitter
 *  (~30–50 m), tight enough that walking to a different building reads as movement. Tunable. */
export const DEFAULT_RADIUS_M = 150;

export type AutoVerdict = "success" | "fail";

/**
 * Great-circle distance between two points, in metres (haversine). Good to well under a metre at city scale —
 * far more precise than the GPS fixes it compares.
 */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000; // Earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is `p` within `radiusM` of any saved gym? (Standing still there is 성공, not a miss.) */
export function atGym(p: GeoPoint, gyms: GeoPoint[], radiusM = DEFAULT_RADIUS_M): boolean {
  return gyms.some((g) => distanceM(p, g) <= radiusM);
}

/**
 * Decide 성공/실패 from the fixes gathered. Returns **null when it cannot decide** — fewer than two usable fixes
 * (GPS denied, the app died before the later samples) — so the caller leaves the block for the user to judge
 * rather than inventing a verdict from nothing.
 */
export function evaluateByLocation(
  samples: GeoPoint[],
  gyms: GeoPoint[] = [],
  radiusM = DEFAULT_RADIUS_M,
): AutoVerdict | null {
  if (samples.length < 2) return null; // cannot judge movement from a single point — abstain

  // Moved? If any pair of fixes is farther apart than the radius, the phone did not stay in one place.
  let moved = false;
  for (let i = 0; i < samples.length && !moved; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      if (distanceM(samples[i], samples[j]) > radiusM) {
        moved = true;
        break;
      }
    }
  }
  if (moved) return "success";

  // Stayed put. That is 실패 — unless the spot is a saved gym (any fix within range of any gym).
  if (samples.some((s) => atGym(s, gyms, radiusM))) return "success";
  return "fail";
}
