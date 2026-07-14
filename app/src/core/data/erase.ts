// **Leaving.** 회원 탈퇴, and deleting your records.
//
// The 이용약관 (제6조) and the 개인정보 처리방침 (제3조·제7조) already promise this: *탈퇴 시 서버에 저장된 회원
// 데이터 및 계정 정보는 지체 없이 파기됩니다.* Until now that promise had **no implementation behind it** — the
// worst kind of clause, because the user has no way to discover it is empty.
//
// Three exits, and they are deliberately different things:
//
//   · **회원 탈퇴** — the account itself is destroyed at Firebase, and the server data with it. Whether the
//     records on *this phone* also go is the user's choice: leaving the service is not the same as giving up
//     what you wrote, and we must not decide that for them.
//   · **모든 기록 삭제, logged in** — the records go, on the server and on the phone. The account stays.
//   · **모든 기록 삭제, logged out** — only this phone has them, so only this phone is cleared.
//
// **Alarms are cancelled first, always.** A block can be gone from storage and still fire: the alarm lives in
// the OS, not in our data. An execution moment for a task that no longer exists — after the user has just
// asked us to erase everything — would be the app failing in the single place it is supposed to be trusted.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { alarm } from "@/core/notifications/alarm";
import {
  closeAccount,
  currentAccount,
  db,
  deleteCurrentUser,
  purgeFirestoreCache,
} from "./firebase";
import { stopSync } from "./sync";

/** Every store the app owns. `lp.device.self.v1` is deliberately absent — see below. */
const DATA_KEYS = [
  "lp.blocks.v1",
  "lp.expenses.v1",
  "lp.meals.v1",
  "lp.tasks.v1", // pre-D30 rows, if a migration never ran
  "lp.events.v1", // pre-D67 rows, likewise
  "lp.outcomes.v1",
  "lp.fires.v1",
  "lp.missed.v1",
  "lp.latencies.v1",
  "lp.tombstones.v1",
  "lp.devices.v1",
  "lp.gyms.v1", // saved gyms (auto-eval) — location data, so a wipe must not leave it behind
  "lp.consent.v1",
  "lp.sync.owner.v1",
] as const;

/** The Firestore collections that carry user data. `consents` is here too — 파기 means 파기. */
const CLOUD_COLLECTIONS = ["blocks", "devices", "expenses", "meals", "gyms", "consents"] as const;

/** Silence the OS before touching storage: an alarm outlives the row that created it. */
export async function cancelAllAlarms(): Promise<void> {
  try {
    const scheduled = alarm.getScheduled() ?? [];
    for (const a of scheduled) alarm.cancel(a.id);
  } catch {
    // Native module missing (Jest, or a JS-ahead-of-native skew) — nothing scheduled to cancel.
  }
}

/**
 * Erase every record on this phone. **Settings and onboarding survive** — they are not records of your life,
 * and making someone re-grant four permissions is a punishment for exercising a right.
 *
 * `lp.device.self.v1` also survives: it is this install's name for itself, not data about the user. Wiping it
 * would orphan the `executeOn` list on any block still living on another phone (D70).
 */
export async function eraseLocal(): Promise<void> {
  await cancelAllAlarms();
  await AsyncStorage.multiRemove([...DATA_KEYS]);
}

/**
 * Erase the account's data on the server. **Hard deletes, not tombstones** — a tombstone is how one phone
 * tells another that a row is gone (D53/D54), and there is no "other phone" left to tell: the user is
 * destroying the account. 파기 has to mean the document is not there.
 *
 * Best-effort per document: one failure must not abandon the rest half-deleted.
 */
export async function eraseCloud(uid: string): Promise<{ deleted: number; failed: number }> {
  const stats = { deleted: 0, failed: 0 };
  const database = db();
  if (!database) return stats;

  for (const name of CLOUD_COLLECTIONS) {
    try {
      // `source: "server"` — the cache can be missing documents another phone wrote, and a document we never
      // saw is still a document we promised to destroy.
      const snap = await database
        .collection("users")
        .doc(uid)
        .collection(name)
        .get({ source: "server" });

      for (const doc of snap?.docs ?? []) {
        try {
          await doc.ref.delete();
          stats.deleted++;
        } catch {
          stats.failed++;
        }
      }
    } catch {
      stats.failed++; // could not even read the collection — reported, never hidden
    }
  }
  return stats;
}

/**
 * **Tombstone every row in the account** — the delete that other devices can actually hear.
 *
 * A **hard** delete is the wrong tool here, and it was the tool we used. It leaves no trace, so the other phone
 * does not see a deletion at all: it sees rows the cloud has never heard of, and its reconcile's rule is *"push
 * those up"*. **The other phone would have restored the entire account**, and this one would have downloaded it
 * all back on the next launch. "모든 기록 삭제" would have quietly undone itself, which is worse than not having
 * the button.
 *
 * A tombstone is how a deletion travels (D53/D54), and it is terminal — the security rules forbid clearing
 * `deletedAt`, so even a write already queued on another phone cannot bring the row back.
 */
async function tombstoneCloud(uid: string): Promise<{ deleted: number; failed: number }> {
  const stats = { deleted: 0, failed: 0 };
  const database = db();
  if (!database) return stats;

  const now = Date.now();
  for (const name of CLOUD_COLLECTIONS) {
    if (name === "consents") continue; // evidence of what was agreed to — not a record of the user's day
    try {
      const snap = await database
        .collection("users")
        .doc(uid)
        .collection(name)
        .get({ source: "server" });

      for (const doc of snap?.docs ?? []) {
        try {
          // Only the id and the fact of death survive. The content — what you spent, what you ate, what you
          // planned — is overwritten, not merely hidden.
          await doc.ref.set({ id: doc.id, deletedAt: now });
          stats.deleted++;
        } catch {
          stats.failed++;
        }
      }
    } catch {
      stats.failed++;
    }
  }
  return stats;
}

/**
 * 모든 기록 삭제. Logged in, the records belong to the **account**, not to the handset — so they go from every
 * device that account reaches. Anything less would be a lie in both directions: the next login would bring back
 * what the user destroyed, and the other phone would still be holding it.
 */
export async function eraseAllRecords(): Promise<{ deleted: number; failed: number }> {
  const uid = currentAccount()?.uid;
  if (!uid) {
    await eraseLocal();
    return { deleted: 0, failed: 0 };
  }

  // Stop this phone's own uploads first: a row handed to Firestore a moment before the wipe would land a moment
  // after it. (The tombstone is terminal, so it could not resurrect the row — but the books would still be wrong.)
  stopSync();
  const stats = await tombstoneCloud(uid);
  await purgeFirestoreCache();
  await eraseLocal();
  return stats;
}

/**
 * 회원 탈퇴 — the account is destroyed.
 *
 * Order matters and is not negotiable: **the data first, the account second.** Delete the Firebase user first
 * and the security rules stop recognising the owner — the documents become unreachable **and undeletable**,
 * left on the server forever while the app tells the user they were 파기됐다.
 *
 * @param keepLocal true → the records stay on this phone. Leaving the service is not the same as giving up
 *                  what you wrote, and that choice is the user's to make, not ours.
 */
export async function deleteAccount(keepLocal: boolean): Promise<{ deleted: number; failed: number }> {
  const uid = currentAccount()?.uid;

  // **Silence this phone's uploads first.** Otherwise sync keeps handing rows to Firestore while we delete —
  // and the ones already queued flush *after* the wipe. That is not a theory: 134 meals came back exactly this
  // way, left orphaned under a uid whose user we had just destroyed. Nobody could ever read them, and nobody
  // could ever delete them.
  stopSync();

  // **Close the account on the server before deleting a single row** (D76). 탈퇴 happens on one phone; the
  // others are still logged in, still holding rows, and — the part that bites — **still holding a valid ID
  // token for up to an hour after the user is deleted**. Their reconcile's own rule is *"a row the cloud has
  // never seen is pushed up"*, and after our wipe the cloud has seen nothing. They would push the entire
  // account back, under a uid with no user behind it.
  //
  // No client fix reaches them: they are a different device, possibly an older build, acting in good faith.
  // So the door is shut where they cannot argue with it — in the security rules, which refuse every write to a
  // closed account. It goes first, so it is already shut while we clean.
  if (uid) await closeAccount(uid, !keepLocal);

  const stats = uid ? await eraseCloud(uid) : { deleted: 0, failed: 0 };

  // Now throw away whatever Firestore is still holding. A write already handed to the SDK cannot be recalled —
  // only the SDK's entire local state can be discarded. This is why the app restarts after 탈퇴.
  await purgeFirestoreCache();

  await deleteCurrentUser(); // the account itself — Firebase Auth

  if (!keepLocal) {
    await eraseLocal();
  } else {
    // The rows stay, but they must stop belonging to an account that no longer exists: otherwise the next
    // login (a different account) would find this device's owner mark and refuse to push (sync.ts owner
    // tracking), leaving the new account silently empty.
    await AsyncStorage.removeItem("lp.sync.owner.v1");
    await AsyncStorage.removeItem("lp.consent.v1"); // the consent died with the account it was given to
  }
  return stats;
}
