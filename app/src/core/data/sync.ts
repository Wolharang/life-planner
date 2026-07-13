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

/** Mirror one row up. No account → a no-op, not an error: writing offline/logged-out is the normal case,
 *  and Firestore's own queue handles "online later". A failed push must never fail the user's edit. */
export async function syncPut<T extends Syncable>(name: CollectionName, row: T): Promise<void> {
  const account = currentAccount();
  if (!account) return;
  try {
    await col(account.uid, name)
      ?.doc(row.id)
      .set({ ...row, deletedAt: null }, { merge: true });
  } catch {
    // swallowed on purpose — the row is already safe locally; the next full push reconciles it
  }
}

export async function syncPutMany<T extends Syncable>(name: CollectionName, rows: T[]): Promise<void> {
  for (const row of rows) await syncPut(name, row);
}

/** Soft-delete (§6). The tombstone is what actually travels; the row is already gone locally. */
export async function syncRemove(name: CollectionName, id: string): Promise<void> {
  const account = currentAccount();
  if (!account) return;
  try {
    await col(account.uid, name)?.doc(id).set({ id, deletedAt: Date.now() }, { merge: true });
  } catch {
    /* see syncPut */
  }
}

// ── Pull (the listener projects the cloud into AsyncStorage) ────────────────────────────────────────────

async function applySnapshot(name: CollectionName, snap: any): Promise<void> {
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

  // 1) Cutover FIRST (P-c) — everything this device made while logged out goes up. Must complete before a
  //    listener can project an empty cloud back down over it.
  for (const name of NAMES) {
    const rows = await readLocal(name);
    await syncPutMany(name, rows);
  }

  // 2) Now it is safe to let the cloud drive.
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
