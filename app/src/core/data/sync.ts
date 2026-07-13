// The sync engine (PRD R2 · data-model §6 · F0). Generic over the four synced collections; it knows about
// AsyncStorage keys and Firestore paths, and **nothing about screens, alarms, or entities**. Repositories
// call `syncPut`/`syncRemove` after a local write; `startSync` mirrors the cloud back down.
//
// ── The storage model, and why it is not literally D34 ──────────────────────────────────────────────────
// D34 says "Firestore offline persistence = the sole local store." That cannot hold together with **D20/R4**
// ("the app is fully usable with NO account"): with no account there is no `uid`, and with no `uid` there is
// no document path to write to. So:
//
//     AsyncStorage is the local store of record. Firestore is a MIRROR that switches on at login.
//
// Logged out, the app is exactly what it was before F0 — which is why R11 (identical in airplane mode) holds
// for free. Logged in, every local write is also pushed, and a realtime listener projects the cloud back into
// AsyncStorage so the screens (which only ever read AsyncStorage) see other devices' work. See D51.
//
// ── The two rules that keep data alive ──────────────────────────────────────────────────────────────────
// **1. Never act before the SERVER has spoken.** Both directions are destructive if taken on a guess:
//    projecting a cold, empty cache would erase a phone full of plans, and blindly pushing local rows up
//    would **resurrect rows another device deleted** — a deleted workout would come back *and re-arm its
//    alarm*. So the cutover (P-c) does not run at login; it runs on the **first server snapshot**, which is
//    the only thing that knows what is really there and what is a tombstone. Until then this device simply
//    runs on local storage — exactly as it does logged out, which is the point of being local-first.
//
// **2. Never wait on the server.** `set()` resolves only on server ack; offline it is pending *forever*.
//    Writes are handed to Firestore's queue and we return (`fire`) — it delivers them eventually, in order,
//    across restarts. Awaiting would hang the save button in airplane mode.
//
// Deletes are **soft** (`deletedAt` tombstone, §6): a hard delete cannot propagate — the other device would
// never hear about it and would push the row back up. Tombstones live in Firestore only; locally a deleted
// row is just gone.
//
// Concurrent edits: **last write to reach the server wins** (§6). Not "last edited" — a device that was
// offline for a day lands its write later and wins. §6 accepted this knowingly; for one user editing one
// block on two phones at once, it is a non-event, and field-level merging is complexity with no buyer.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentAccount, db, onAccountChanged } from "./firebase";

/** Everything we sync is identified and versioned the same way. */
interface Syncable {
  id: string;
  updatedAt: number;
}

/** The four synced collections → their AsyncStorage key. The measurement/catch-up stores
 *  (`lp.outcomes/fires/missed/latencies`, data-model §2.7) are **deliberately absent**: they are this
 *  device's record of what the lever actually did, not shared state. They stay local and untouched. */
const KEYS = {
  events: "lp.events.v1",
  blocks: "lp.blocks.v1",
  expenses: "lp.expenses.v1",
  meals: "lp.meals.v1",
} as const;

export type CollectionName = keyof typeof KEYS;
const NAMES = Object.keys(KEYS) as CollectionName[];

/** Run after a collection has been re-projected from the cloud — how a remote change becomes real here
 *  (blocks re-arm their alarms, events re-arm their notifications). Registered by the app, so this module
 *  never imports a repository (which would import this one straight back). */
export type ApplyHooks = Partial<Record<CollectionName, () => Promise<void>>>;

let hooks: ApplyHooks = {};
let listeners: Array<() => void> = [];
let syncingFor: string | null = null;

function col(uid: string, name: CollectionName) {
  return db()?.collection("users").doc(uid).collection(name);
}

async function readLocal<T extends Syncable>(name: CollectionName): Promise<T[]> {
  const raw = await AsyncStorage.getItem(KEYS[name]);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return [];
  }
}

// ── Push (called by the repositories, after the local write has already succeeded) ──────────────────────

/**
 * **NEVER await the server.** Firestore's `set()` promise resolves only on *server acknowledgement* — offline
 * it stays pending **forever** (it does not reject). The repositories are called as
 * `await addBlocks(…); router.back();`, so awaiting the cloud here would mean: **in airplane mode the save
 * button hangs and the screen never closes** — R11 ("works identically offline") destroyed by the very feature
 * meant to be invisible. Online it would still stall the UI for a full server round-trip per row (a 5-date
 * block add = 5 sequential round-trips).
 *
 * We don't need the acknowledgement. The row is **already** committed locally (the repository wrote it and
 * armed its alarm before calling us), and Firestore's own queue guarantees the write reaches the server
 * eventually, in order, across restarts. So: hand the write to Firestore's cache and return immediately.
 * Latency and connectivity become invisible — which is also why the database's *region* stops mattering.
 */
function fire(work: () => Promise<unknown> | undefined): void {
  try {
    void work()?.catch(() => {
      // the row is safe locally and queued in Firestore's cache; a rejection here must never reach the user
    });
  } catch {
    /* native missing / not signed in — local-only, exactly as designed */
  }
}

/**
 * The payload of a row push. **It must never contain `deletedAt`** — writing `deletedAt: null` (as this once
 * did) makes a tombstone *reversible*, and a tombstone must be **terminal**.
 *
 * Why terminal matters, and why `reconcile` alone cannot save us (D54). Phone C edits row X while offline on
 * Thursday: that write goes into **Firestore's own disk-backed queue** immediately. Phone B's delete of X
 * lands on Friday, so X is now a tombstone. C reconnects on Saturday — and Firestore flushes C's Thursday
 * write **unconditionally**. It never passes through `reconcile`, which only decides what *we* choose to push;
 * this write is already in the pipe. If it carries `deletedAt: null`, it **overwrites the tombstone and the
 * deleted block comes back — and re-arms its alarm.**
 *
 * With the field simply absent, `merge: true` leaves `deletedAt` untouched: C's late write lands harmlessly on
 * a dead document, updating fields nobody will ever read. **Deletion is permanent.** That is honest for this
 * app — there is no "undelete"; a block you re-create gets a **new id**.
 */
export function putPayload<T extends Syncable>(row: T): Record<string, unknown> {
  const { ...fields } = row as Record<string, unknown>;
  delete fields.deletedAt; // defensive: a row must never carry a resurrection with it
  return fields;
}

/** Mirror one row up. No account → a no-op, not an error: logged-out is a normal, supported state (D20). */
export function syncPut<T extends Syncable>(name: CollectionName, row: T): void {
  const account = currentAccount();
  if (!account) return;
  fire(() => col(account.uid, name)?.doc(row.id).set(putPayload(row), { merge: true }));
}

export function syncPutMany<T extends Syncable>(name: CollectionName, rows: T[]): void {
  for (const row of rows) syncPut(name, row);
}

/** Soft-delete (§6). The tombstone is what actually travels; the row is already gone locally. */
export function syncRemove(name: CollectionName, id: string): void {
  const account = currentAccount();
  if (!account) return;
  fire(() => col(account.uid, name)?.doc(id).set({ id, deletedAt: Date.now() }, { merge: true }));
}

// ── Pull ────────────────────────────────────────────────────────────────────────────────────────────────

/** Collections (`uid:name`) whose local rows have been reconciled against real server state this session. */
const reconciled = new Set<string>();

async function writeLocal(name: CollectionName, rows: Syncable[]): Promise<void> {
  await AsyncStorage.setItem(KEYS[name], JSON.stringify(rows));
  await hooks[name]?.(); // e.g. a block that arrived from the other phone must now arm its alarm
}

/**
 * **The cutover (P-c), done once per collection against real server state — never blind.**
 *
 * The earlier version simply pushed every local row up at login. That **resurrects the dead**: phone B deletes
 * block X (leaving a tombstone), phone A is offline and still holds X, A comes back and pushes X with
 * `deletedAt: null` — overwriting the tombstone. The deleted workout returns, **and re-arms its alarm**. A
 * block you deleted must never come back and take your lock screen.
 *
 * So the cutover reads what the cloud actually says and merges, row by row:
 *  · cloud says **deleted** → drop it locally too. The deletion wins; we never push over a tombstone.
 *  · cloud has **never seen it** → push it up (this is the real cutover: rows made while logged out).
 *  · cloud has it, and **ours is newer** (`updatedAt`) → push ours. This also repairs a push that failed
 *    permanently (a rules rejection, bad data) — every login reconciles, so a dropped write is not forever.
 *  · otherwise → the cloud's row wins, unchanged.
 *
 * `updatedAt` is the *client's* clock, which §6 forbids for **conflict resolution** — and this is not conflict
 * resolution. Concurrent writes are still settled server-side, last-writer-wins. This is only "which side has
 * something the other lacks", where the client clock is the only signal that exists.
 */
/** A cloud row as it arrives: a live row, or a tombstone (`deletedAt` set). */
export type CloudRow = Syncable & { deletedAt?: number | null };

/**
 * The merge decision, as a pure function — this is where the resurrection bug lived, so it is testable
 * without Firestore, AsyncStorage, or a device. Returns the rows local storage should hold, and the rows the
 * cloud is missing or behind on.
 */
export function planReconcile<T extends Syncable>(
  local: T[],
  cloudRows: CloudRow[],
): { merged: T[]; toPush: T[] } {
  const dead = new Set<string>();
  const cloud = new Map<string, T>();
  for (const row of cloudRows) {
    if (row.deletedAt) dead.add(row.id); // a tombstone is a fact, not an absence
    else {
      const { deletedAt, ...rest } = row;
      cloud.set(row.id, rest as unknown as T);
    }
  }

  const merged = new Map(cloud);
  const toPush: T[] = [];
  for (const row of local) {
    if (dead.has(row.id)) continue; // deleted elsewhere — respect it; never push over a tombstone
    const remote = cloud.get(row.id);
    if (!remote || row.updatedAt > (remote.updatedAt ?? 0)) {
      toPush.push(row); // the cloud is missing this, or is behind it
      merged.set(row.id, row);
    }
  }
  return { merged: [...merged.values()], toPush };
}

async function reconcile(name: CollectionName, snap: any): Promise<void> {
  const cloudRows: CloudRow[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data();
    if (data) cloudRows.push({ ...data, id: data.id ?? doc.id } as CloudRow);
  });

  const { merged, toPush } = planReconcile(await readLocal(name), cloudRows);
  for (const row of toPush) syncPut(name, row);
  await writeLocal(name, merged);
}

/** Steady state: the cloud drives. Snapshots include this device's own pending writes, so an offline edit is
 *  never lost by being projected over. */
async function project(name: CollectionName, snap: any): Promise<void> {
  const rows: Syncable[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data();
    if (!data || data.deletedAt) return; // tombstone — dead everywhere (§6: reads filter deletedAt)
    const { deletedAt, ...row } = data;
    rows.push(row as Syncable);
  });
  await writeLocal(name, rows);
}

async function applySnapshot(uid: string, name: CollectionName, snap: any): Promise<void> {
  const key = `${uid}:${name}`;

  if (!reconciled.has(key)) {
    // Until we have heard from the SERVER we do not know what was deleted, so we must not act: pushing could
    // resurrect a tombstoned row, and projecting a cold cache could erase rows made while logged out. Local
    // storage keeps serving the app in the meantime — which is the whole point of being local-first.
    if (snap.metadata?.fromCache !== false) return;
    reconciled.add(key);
    await reconcile(name, snap);
    return;
  }
  await project(name, snap);
}

/** Turn sync on for `uid`. Idempotent per uid, so the auth listener can call it freely. */
function enable(uid: string): void {
  if (syncingFor === uid) return;
  disable();
  syncingFor = uid;

  // No blind push here. The first *server* snapshot carries the truth (including tombstones), and the
  // reconcile that runs on it is the cutover. Until then this device runs on local storage, exactly as it
  // does logged out.
  for (const name of NAMES) {
    const unsub = col(uid, name)?.onSnapshot(
      { includeMetadataChanges: true }, // we must be able to tell a cold cache from real server state
      (snap: any) => {
        void applySnapshot(uid, name, snap);
      },
      () => {
        /* a listener error (rules, network) must not crash the app — local storage still serves it */
      },
    );
    if (unsub) listeners.push(unsub);
  }
}

function disable(): void {
  for (const unsub of listeners) {
    try {
      unsub();
    } catch {
      /* already gone */
    }
  }
  listeners = [];
  syncingFor = null;
  // The next session must reconcile again from real server state — the cloud may have moved on (or been
  // deleted from) while we were away. Reusing a stale "already reconciled" mark would skip the one step that
  // keeps a deleted row from coming back.
  reconciled.clear();
}

/**
 * Start watching the account. Called once, at app start. Logged out → nothing happens and the app is
 * local-only (D20). Logging in enables sync **from that point**; logging out stops it and **keeps every
 * local row**.
 */
export function startSync(applyHooks: ApplyHooks): () => void {
  hooks = applyHooks;
  return onAccountChanged((account) => {
    if (account) enable(account.uid);
    else disable();
  });
}

export function syncEnabled(): boolean {
  return syncingFor !== null;
}
