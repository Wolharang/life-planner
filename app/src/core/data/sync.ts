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
// ── The one ordering rule that must never be broken ─────────────────────────────────────────────────────
// **Push the local rows up BEFORE subscribing.** A listener projects the snapshot into local storage; if it
// ran first, a fresh account's empty snapshot would land on top of a phone full of real plans and **erase
// them**. Cutover pushes first (`await`), so by the time the first snapshot arrives the cloud already
// contains everything this device had. This is P-c in `implementation-plan.md`.
//
// Deletes are **soft** (`deletedAt` tombstone, §6): a hard delete cannot propagate — the other device would
// simply never hear about it and would push the row back up. Tombstones live in Firestore only; locally a
// deleted row is just gone.

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

/** Mirror one row up. No account → a no-op, not an error: logged-out is a normal, supported state (D20). */
export function syncPut<T extends Syncable>(name: CollectionName, row: T): void {
  const account = currentAccount();
  if (!account) return;
  fire(() =>
    col(account.uid, name)
      ?.doc(row.id)
      .set({ ...row, deletedAt: null }, { merge: true }),
  );
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

// ── Pull (the listener projects the cloud into AsyncStorage) ────────────────────────────────────────────

async function applySnapshot(name: CollectionName, snap: any): Promise<void> {
  // **An empty cloud collection can never erase local data.** Zero documents means the cloud has never heard
  // of this collection — not that everything was deleted. A real deletion leaves a *tombstone document*
  // behind (§6), so a genuinely emptied collection still arrives as N docs, all of them dead. Without this
  // guard, a fresh account's first snapshot (or one that raced ahead of the cutover push) would land on a
  // phone full of real plans and wipe them. Instead we treat it as "nothing to say" and push local up.
  if (snap.size === 0) {
    const local = await readLocal(name);
    if (local.length > 0) syncPutMany(name, local);
    return;
  }

  const rows: Syncable[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data();
    if (data?.deletedAt) return; // tombstone — the row is dead everywhere (§6: reads filter deletedAt)
    const { deletedAt, ...row } = data;
    rows.push(row as Syncable);
  });
  await AsyncStorage.setItem(KEYS[name], JSON.stringify(rows));
  await hooks[name]?.(); // e.g. a block that arrived from the other phone must now arm its alarm
}

/**
 * Turn sync on for `uid`: cutover (push what this device has) → then listen. Idempotent per uid, so the
 * auth listener can call it freely.
 */
async function enable(uid: string): Promise<void> {
  if (syncingFor === uid) return;
  disable();
  syncingFor = uid;

  // 1) Cutover (P-c) — everything this device made while logged out goes up. Enqueued, not awaited (see
  //    `fire`): waiting on the server here would stall login on a slow network and hang it offline. The
  //    "empty snapshot cannot erase local" guard in `applySnapshot` is what actually makes the data safe —
  //    ordering alone would leave the outcome depending on a race.
  for (const name of NAMES) {
    syncPutMany(name, await readLocal(name));
  }

  // 2) Now let the cloud drive.
  for (const name of NAMES) {
    const unsub = col(uid, name)?.onSnapshot(
      (snap: any) => {
        void applySnapshot(name, snap);
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
}

/**
 * Start watching the account. Called once, at app start. Logged out → nothing happens and the app is
 * local-only (D20). Logging in enables sync **from that point**; logging out stops it and **keeps every
 * local row**.
 */
export function startSync(applyHooks: ApplyHooks): () => void {
  hooks = applyHooks;
  return onAccountChanged((account) => {
    if (account) void enable(account.uid);
    else disable();
  });
}

export function syncEnabled(): boolean {
  return syncingFor !== null;
}
