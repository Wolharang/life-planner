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
import { accountClosure, currentAccount, db, onAccountChanged, signOut } from "./firebase";
import { deletedIds, rememberDeletion } from "./tombstones";

/** Everything we sync is identified and versioned the same way. */
interface Syncable {
  id: string;
  updatedAt: number;
}

/** The four synced collections → their AsyncStorage key. The measurement/catch-up stores
 *  (`lp.outcomes/fires/missed/latencies`, data-model §2.7) are **deliberately absent**: they are this
 *  device's record of what the lever actually did, not shared state. They stay local and untouched. */
const KEYS = {
  // `events` is gone (D67): an "important event" was always just a block that holds an hour. One unit.
  blocks: "lp.blocks.v1",
  devices: "lp.devices.v1", // which phones this account has (D70) — a block names the one that takes the screen
  expenses: "lp.expenses.v1",
  // Recurring-spend templates (D96). They follow the account across devices like expenses; the monthly rows
  // they generate carry a deterministic id, so two phones holding the same subscription never double-log a month.
  subscriptions: "lp.subscriptions.v1",
  meals: "lp.meals.v1",
  // Saved gyms (auto-eval). A gym is a **static place the member chose**, not their live location — like the
  // block's 장소명 that already syncs — so it rides the same machinery. The real-time evaluation fixes are NOT
  // here: they stay on the device and are discarded (위치 약관 / 처리방침).
  gyms: "lp.gyms.v1",
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

/**
 * The uid whose cloud this device's local rows have been reconciled against.
 *
 * **Signing out of A and into B used to upload A's data into B.** `disable()` keeps every local row (D20 —
 * logout must not cost you your data), so B's first reconcile saw a phone full of rows the new cloud had never
 * heard of, and dutifully **pushed them all up**. One person's plans landed in another person's account.
 *
 * So we remember the owner. When it changes, the cutover **does not push** — the new account adopts its own
 * cloud, and the previous account's rows stay put locally (they are already safe in *its* cloud). Nothing is
 * uploaded that the new owner never made, and nothing local is destroyed.
 */
const OWNER_KEY = "lp.sync.owner.v1";

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
/**
 * **The app must never claim a write is synced when it isn't.**
 *
 * `set()` resolves only when the **server** accepts the write. Not awaiting it is right (awaiting hangs the
 * save button offline — see above), but *"we don't wait"* must not become *"we don't know"*. The founder
 * imported 180 expenses, Firestore's outbox jammed, and **not one reached the server** — while the app happily
 * reported everything as synced, because nothing was ever checked. He found out by opening the Firebase console.
 *
 * So we keep books: what we handed over, and what actually landed. The difference is **in flight, or stuck**,
 * and the account screen shows it. A number the user can see is the whole distance between "eventually
 * consistent" and "your year of receipts is gone and nobody said so".
 */
const stats = { sent: 0, acked: 0, failed: 0 };

export function syncStats(): { sent: number; acked: number; failed: number; inFlight: number } {
  return { ...stats, inFlight: Math.max(0, stats.sent - stats.acked - stats.failed) };
}

function fire(work: () => Promise<unknown> | undefined): void {
  try {
    const pr = work();
    if (!pr) return; // no account / no native Firebase — nothing was handed over, so nothing is owed
    stats.sent++;
    void pr.then(
      () => {
        stats.acked++;
      },
      (err: any) => {
        // The row is safe locally, and the next session's server reconcile offers it again. This must never
        // reach the user as an error — but it must not vanish from OUR books either.
        stats.failed++;

        // **A refusal can mean the account is gone** (D76). If 탈퇴 happens on the other phone while this one is
        // mid-sync, nothing here re-runs `enable()` — this device would go on pushing into a closed account
        // forever, its "아직 올라가지 못한 기록 N건" climbing with no explanation on offer. A permission error is
        // the first moment we can find out, so we ask.
        if (String(err?.code ?? "").includes("permission-denied")) void checkClosedNow();
      },
    );
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
 *
 * It must also carry **no `undefined` values**. Firestore **rejects** `undefined` outright (`Unsupported field
 * value: undefined`), and the screens hand us rows full of them — a block with no end time literally holds
 * `end: undefined` as an own property, as do `location`, `microStartNote`, `completedAt`, an expense's `store`,
 * an event's `time`… That rejection was thrown inside `fire()` and **swallowed**, so the row silently never
 * reached the cloud — and then the next snapshot, seeing no such document, **deleted it from the phone and
 * cancelled its alarm**. Saving a workout with no end time was enough to lose it. An absent key is the correct
 * encoding of "not set" anyway: `merge: true` leaves the field alone.
 */
export function putPayload<T extends Syncable>(row: T): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (key === "deletedAt") continue; // a row must never carry a resurrection with it
    if (value === undefined) continue; // Firestore rejects undefined — and the rejection was invisible
    fields[key] = value;
  }
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

/**
 * Soft-delete (§6). The tombstone is what actually travels; the row is already gone locally.
 *
 * **It also records the deletion LOCALLY, even with no account** — because that was the hole. With no `uid`
 * there is no document to tombstone, so a delete made while logged out left no trace anywhere: the cloud (which
 * may still hold the row from an earlier session) never heard about it, and the next login's reconcile handed it
 * straight back. **The founder's deleted blocks resurrected on login.** The local tombstone is what the reconcile
 * now pushes up.
 */
export function syncRemove(name: CollectionName, id: string): void {
  void rememberDeletion(name, id); // always — this is what survives being logged out
  const account = currentAccount();
  if (!account) return;
  fire(() => col(account.uid, name)?.doc(id).set({ id, deletedAt: Date.now() }, { merge: true }));
}

// ── Pull ────────────────────────────────────────────────────────────────────────────────────────────────

/** Collections (`uid:name`) whose local rows have been reconciled against real server state this session. */
const reconciled = new Set<string>();

/**
 * Screens re-read only on focus, so a change that arrived from the other phone **sat in storage unseen** until
 * you navigated away and back. R2 promises the event "appears on device B **within seconds**"; the data did,
 * the screen didn't. Screens subscribe here and reload when the cloud actually changes something.
 */
const watchers = new Set<(name: CollectionName) => void>();

export function onSyncApplied(fn: (name: CollectionName) => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

async function writeLocal(name: CollectionName, rows: Syncable[]): Promise<void> {
  await AsyncStorage.setItem(KEYS[name], JSON.stringify(rows));
  await hooks[name]?.(); // e.g. a block that arrived from the other phone must now arm its alarm
  for (const fn of watchers) {
    try {
      fn(name);
    } catch {
      // a screen that blew up on a refresh must not take the sync engine with it
    }
  }
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
  /** Ids THIS device deleted — including while logged out, when no cloud tombstone could be written. */
  locallyDeleted: Set<string> = new Set(),
): { merged: T[]; toPush: T[]; toBury: string[] } {
  const dead = new Set<string>();
  const cloud = new Map<string, T>();
  for (const row of cloudRows) {
    if (row.deletedAt) dead.add(row.id); // a tombstone is a fact, not an absence
    else {
      const { deletedAt, ...rest } = row;
      cloud.set(row.id, rest as unknown as T);
    }
  }

  // A row this device deleted is dead too — even if the cloud still holds it alive because we were logged out
  // when we deleted it and could write no tombstone. Bury it now.
  const toBury: string[] = [];
  for (const id of locallyDeleted) {
    if (cloud.has(id)) {
      cloud.delete(id);
      toBury.push(id);
    }
    dead.add(id);
  }

  const merged = new Map(cloud);
  const toPush: T[] = [];
  for (const row of local) {
    if (dead.has(row.id)) continue; // deleted elsewhere (or here) — never push over a tombstone
    const remote = cloud.get(row.id);
    if (!remote || row.updatedAt > (remote.updatedAt ?? 0)) {
      toPush.push(row); // the cloud is missing this, or is behind it
      merged.set(row.id, row);
    }
  }
  return { merged: [...merged.values()], toPush, toBury };
}

/**
 * **Ask the SERVER what it has. Never ask the cache.**
 *
 * A Firestore snapshot layers **this device's own un-sent writes** on top of the server's state, so a row still
 * sitting in the outbox looks exactly like a row the server already holds. `reconcile` read a snapshot,
 * concluded "the cloud has all 180 of these", and pushed nothing — **so a write that never reached the server
 * was never retried.** The founder's 180 imported expenses sat on the phone forever while the app cheerfully
 * reported them as synced. `hasPendingWrites` does not save us either: on a fresh launch it reports *pending*
 * for rows the server accepted long ago.
 *
 * So the reconcile — the one moment we decide **what the cloud is missing** — reads with `source: "server"`. It
 * is one read per collection per session, it cannot lie, and it is the only thing standing between an import
 * and silent data loss. If it fails (offline), we simply do not reconcile this session: local storage keeps
 * serving, and the next launch tries again.
 */
async function reconcileAgainstServer(name: CollectionName, uid: string): Promise<void> {
  const snap = await col(uid, name)?.get({ source: "server" });
  if (!snap) return;

  const cloudRows: CloudRow[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data();
    if (data) cloudRows.push({ ...data, id: data.id ?? doc.id } as CloudRow);
  });

  const previousOwner = await AsyncStorage.getItem(OWNER_KEY);
  const sameOwner = previousOwner == null || previousOwner === uid;

  const { merged, toPush, toBury } = planReconcile(
    await readLocal(name),
    cloudRows,
    await deletedIds(name)
  );

  if (sameOwner) {
    for (const row of toPush) syncPut(name, row);
    for (const id of toBury) syncRemove(name, id); // a logged-out deletion finally reaches the cloud
  }
  // Different owner → push NOTHING. Those rows belong to the previous account; they are already safe in its
  // cloud, and they are not this account's to hold.

  await AsyncStorage.setItem(OWNER_KEY, uid);
  await writeLocal(name, merged);
}

/**
 * Steady state: keep local in step with what the listener reports. It **never pushes** — what the cloud is
 * missing is decided only against real server state (above) and at write time. And it never deletes a row the
 * cloud has simply never heard of (one made while logged out): `planReconcile` keeps those, and only a
 * **tombstone** removes anything.
 */
async function project(name: CollectionName, snap: any): Promise<void> {
  const cloudRows: CloudRow[] = [];
  snap.forEach((doc: any) => {
    const data = doc.data();
    if (data) cloudRows.push({ ...data, id: data.id ?? doc.id } as CloudRow);
  });
  const { merged } = planReconcile(await readLocal(name), cloudRows, await deletedIds(name));
  await writeLocal(name, merged);
}

async function applySnapshot(uid: string, name: CollectionName, snap: any): Promise<void> {
  if (!reconciled.has(`${uid}:${name}`)) return; // the server reconcile speaks first
  await project(name, snap);
}

/** Turn sync on for `uid`. Idempotent per uid, so the auth listener can call it freely. */
/**
 * **The other phone, after 탈퇴** (D76). Its ID token stays valid for up to an hour, its rows are still local,
 * and its reconcile's rule is *"a row the cloud has never seen is pushed up"* — so it would push the whole
 * deleted account back. The rules refuse those writes, but a client that keeps hammering a door it cannot open
 * is not a fix; it is a phone whose 아직 올라가지 못한 기록 count climbs forever with no explanation.
 *
 * So before syncing anything, ask the server whether the account is still there. If it is closed, this device
 * stops and signs out. **Local rows are kept** — logging out never deletes them (D20), and the choice to erase
 * this phone was never made *on* this phone.
 */
let closedNotice: ((wipeDevices: boolean) => void) | null = null;

/** @param fn receives the user's choice: did they ask for **every** device's records to go, or only theirs? */
export function onAccountClosed(fn: (wipeDevices: boolean) => void): void {
  closedNotice = fn;
}

/** Ask once, act once. A denied write can also just be a rules mistake — it must not be able to spam the user. */
let closedCheck: Promise<void> | null = null;

function checkClosedNow(): Promise<void> {
  const uid = syncingFor;
  if (!uid) return Promise.resolve();
  if (closedCheck) return closedCheck;

  closedCheck = accountClosure(uid)
    .then(({ closed, wipeDevices }) => {
      if (!closed || syncingFor !== uid) return;
      disable();
      closedNotice?.(wipeDevices);
      void signOut();
    })
    .finally(() => {
      closedCheck = null;
    });
  return closedCheck;
}

function enable(uid: string): void {
  if (syncingFor === uid) return;
  disable();
  syncingFor = uid;

  void accountClosure(uid).then(({ closed, wipeDevices }) => {
    if (!closed || syncingFor !== uid) return;
    disable();
    closedNotice?.(wipeDevices);
    void signOut(); // there is no account to sync to; staying "logged in" to it is a fiction
  });

  for (const name of NAMES) {
    // 1) Reconcile against the SERVER first — the only source that knows what actually arrived. Until it
    //    answers, the listener stays silent (`applySnapshot` returns early): acting on a cache that mixes in
    //    our own undelivered writes is how the imported expenses were declared "synced" and abandoned.
    void reconcileAgainstServer(name, uid)
      .then(() => {
        reconciled.add(`${uid}:${name}`);
      })
      .catch(() => {
        // Offline, or the read was refused. Do nothing: local storage keeps serving the app exactly as it does
        // logged out, and the next launch reconciles. Never guess.
      });

    // 2) Then follow it live.
    const unsub = col(uid, name)?.onSnapshot(
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
// **A hold, for the one moment a login might have to be undone.**
//
// "Google로 계속하기" is a login for someone who has an account and a *signup* for someone who does not, and
// Firebase only says which afterwards (`isNewUser`). So a Google press on the 로그인 tab can create an account
// with no consent behind it — and the account screen then deletes it.
//
// But sync starts the instant auth reports a user. Without this hold, those milliseconds are enough to push
// every local row to the new uid; deleting the auth user afterwards does **not** delete the documents. We
// would have taken the account back and left the data on the server — the exact thing the consent gate exists
// to prevent. So the caller holds sync across the decision, and only a login that survives it turns sync on.
let held = false;
let pendingUid: string | null = null;

/**
 * **One pull, no listeners.** For the background task (D77): reconcile every collection against real server
 * state, apply the hooks, and stop. No snapshot listeners, nothing left running — the process is about to be
 * killed by Android anyway.
 *
 * This exists because *the app being open* was a hidden precondition of being correct. Sync only ran while a
 * screen was up, so a phone that had been rebooted and not opened would go on briefing the day from a plan
 * another phone had already changed. Two phones, two different mornings, and nothing to say which was true.
 */
export async function syncPullOnce(): Promise<boolean> {
  const account = currentAccount();
  if (!account) return false;

  let pulled = false;
  for (const name of NAMES) {
    try {
      await reconcileAgainstServer(name, account.uid);
      reconciled.add(`${account.uid}:${name}`);
      await hooks[name]?.();
      pulled = true;
    } catch {
      // Offline, or refused. Keep the local rows exactly as they are — never guess (the whole D66 lesson).
    }
  }
  return pulled;
}

export function holdSync(): void {
  held = true;
}

/**
 * **Stop syncing, now, and do not start again.** Used before an erase: while sync is live, every local write
 * is still being handed to Firestore, and a row uploaded a moment after we deleted it is a row we did not
 * delete. (This is not hypothetical — 134 meals came back this way, orphaned under a deleted account.)
 *
 * This only stops *our* writes. Whatever Firestore has already queued is beyond our reach; that queue is
 * discarded separately, by `purgeFirestoreCache()`.
 */
export function stopSync(): void {
  held = true;
  pendingUid = null;
  disable();
}

/** @param enableIfPending false when the login was undone — the uid must never be synced to. */
export function releaseSync(enableIfPending = true): void {
  held = false;
  const uid = pendingUid;
  pendingUid = null;
  if (uid && enableIfPending) enable(uid);
}

/**
 * **The phone that came back too late.** (D76)
 *
 * A device offline for longer than an ID token lives (~1h) is signed out by **Firebase itself** the moment it
 * reconnects — the deleted user cannot refresh a token. By the time our code looks, there is no account to ask
 * about: it would simply appear logged out, for no stated reason, still holding every row the user asked us to
 * erase on every device.
 *
 * So we ask on its behalf, using the uid it last synced as (`lp.sync.owner.v1`) — which is exactly what that
 * mark is for. The tombstone is readable without a login for this reason and no other.
 *
 * Called once at startup, after the auth state has settled.
 */
export async function checkClosedWhileSignedOut(): Promise<void> {
  if (currentAccount()) return; // still signed in — `enable()` does the asking
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (!owner) return;

  const { closed, wipeDevices } = await accountClosure(owner);
  if (!closed) return;

  closedNotice?.(wipeDevices);
  // The account is gone for good. Drop the mark so the next login is an ordinary first login — but only now
  // that we KNOW, never on a guess: the mark is also what stops one account's rows from landing in another's.
  await AsyncStorage.removeItem(OWNER_KEY);
}

export function startSync(applyHooks: ApplyHooks): () => void {
  hooks = applyHooks;
  return onAccountChanged((account) => {
    if (!account) {
      pendingUid = null;
      disable();
      return;
    }
    if (held) {
      pendingUid = account.uid; // decided by releaseSync()
      return;
    }
    enable(account.uid);
  });
}

export function syncEnabled(): boolean {
  return syncingFor !== null;
}
