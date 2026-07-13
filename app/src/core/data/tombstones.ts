// **Deletions must outlive being logged out.**
//
// The hole (found on the device, 2026-07-13): `syncRemove` is a **no-op with no account** — there is no `uid`,
// so there is no document to tombstone. That is correct as far as it goes. But it means a row you delete
// **while logged out leaves no trace anywhere**: locally it is simply gone, and the cloud — which may still
// hold it from an earlier logged-in session — never hears about it. Log back in, the cutover reconciles, and
// the cloud honestly hands your deleted blocks straight back. **They resurrect.**
//
// D53/D54 closed resurrection for deletes made *while logged in*. This closes it for deletes made while
// logged **out**, which is the ordinary state of an app that insists you don't need an account (D20).
//
// So a delete **always** writes a local tombstone, account or no account. At the next reconcile these are
// pushed up as real tombstones and dropped. A tombstone is small (an id, a collection, a timestamp) and it is
// the only thing standing between the user and a workout they deleted taking their lock screen next week.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CollectionName } from "./sync";

const KEY = "lp.tombstones.v1";

/** Deletions live long enough to survive any plausible offline/logged-out gap, then stop costing us storage. */
const KEEP_MS = 180 * 24 * 60 * 60 * 1000;

export interface Tombstone {
  collection: CollectionName;
  id: string;
  deletedAt: number;
}

export async function listTombstones(): Promise<Tombstone[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as Tombstone[]) : [];
  } catch {
    return [];
  }
}

export async function rememberDeletion(collection: CollectionName, id: string): Promise<void> {
  const now = Date.now();
  const kept = (await listTombstones()).filter(
    (t) => now - t.deletedAt < KEEP_MS && !(t.collection === collection && t.id === id)
  );
  kept.push({ collection, id, deletedAt: now });
  await AsyncStorage.setItem(KEY, JSON.stringify(kept));
}

/** The ids this device has deleted from a collection — whatever its login state was at the time. */
export async function deletedIds(collection: CollectionName): Promise<Set<string>> {
  return new Set((await listTombstones()).filter((t) => t.collection === collection).map((t) => t.id));
}
