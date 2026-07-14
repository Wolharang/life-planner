// A thin, defensive wrapper over expo-location — for the parts that run in JS: requesting permission and
// grabbing a single foreground fix when the user saves a gym ("현재 위치로 지정").
//
// The **timed auto-evaluation fixes (t=0/5/15) are captured natively** (Kotlin lp-alarm), because they must land
// even when the app is dead — JS is not alive on a locked phone. This module never does that; it only handles the
// foreground, user-initiated fix, and the permission flow that both paths share.
//
// Loaded LAZILY + defensively, exactly like the notification layer: if expo-location's native module isn't linked
// yet (before a `prebuild` + rebuild), every call degrades to "unavailable" instead of crashing the app.

import type { GeoPoint } from "@/core/schedule/autoEval";

let mod: any;
let unavailable = false;

function load(): any | null {
  if (unavailable) return null;
  if (mod) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("expo-location");
    return mod;
  } catch {
    unavailable = true;
    return null;
  }
}

/** Ask for foreground ("앱 사용 중") location. Returns whether it is granted. */
export async function requestLocationPermission(): Promise<boolean> {
  const L = load();
  if (!L) return false;
  try {
    const { status } = await L.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Ask for background ("항상 허용") location — what the native t=15 capture needs. On Android this must follow a
 * granted foreground permission, and the OS shows its own "항상 허용" settings step; expo surfaces the result.
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const L = load();
  if (!L) return false;
  try {
    const fg = await L.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;
    const { status } = await L.requestBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function backgroundLocationGranted(): Promise<boolean> {
  const L = load();
  if (!L) return false;
  try {
    const { status } = await L.getBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * One foreground fix, or null. Balanced accuracy — a gym is a building, not a doorstep, so we do not pay the
 * battery/time cost of the highest accuracy for a coordinate the 150 m radius will absorb anyway.
 *
 * **Reliable enough to centre a map on:** a fresh fix, bounded to a few seconds (it can hang indoors), and if
 * that does not land, the OS's **last-known** position (instant, cached). Either gives the map a place to open on
 * / move to — so "go to my location" does not silently do nothing when GPS is slow.
 */
export async function getCurrentFix(): Promise<GeoPoint | null> {
  const L = load();
  if (!L) return null;
  const toPoint = (c: any): GeoPoint | null =>
    c && typeof c.latitude === "number" && typeof c.longitude === "number"
      ? { lat: c.latitude, lng: c.longitude }
      : null;
  try {
    if (!(await requestLocationPermission())) return null;
    try {
      const fresh = await Promise.race([
        L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced }).then((p: any) => p?.coords),
        new Promise<null>((res) => setTimeout(() => res(null), 6000)),
      ]);
      const p = toPoint(fresh);
      if (p) return p;
    } catch {
      // fall through to last-known
    }
    const last = await L.getLastKnownPositionAsync();
    return toPoint(last?.coords);
  } catch {
    return null;
  }
}

/** Is expo-location present in this build at all? `false` → the UI hides the "현재 위치" option. */
export function locationAvailable(): boolean {
  return !!load();
}
