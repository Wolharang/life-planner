// **What the user agreed to, when, and on which phone.** (D74)
//
// Three things this is not:
//
//   1. **Not a tick box that leaves no trace.** If the answer is never recorded, we cannot say we have consent,
//      nor tell whether the words they saw are the words we still ship. The record carries `LEGAL_VERSION` — a
//      bump is what re-asks them.
//   2. **Not device state.** It used to live only in AsyncStorage, so logging in on a second phone showed an
//      empty 동의 내역: the same person, the same account, and no consent in sight. **Consent belongs to the
//      account, not to the handset it was typed on.** It now goes to the server with the account.
//   3. **Not a synced row.** It is deliberately kept OUT of `sync.ts`. That engine is last-write-wins with
//      tombstones — exactly right for a block you edit and delete, and exactly wrong for evidence, which a
//      later write must never overwrite and nothing may delete. The security rules make `consents`
//      **create-only**. *A consent record the client can rewrite is not a record of anything.*
//
// Each tick carries **its own second**, because they are separate acts: the founder asked for the time of each
// button, not one timestamp stamped over all four at submit.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEGAL_VERSION, LEGAL_ORDER, type LegalKey } from "@/content/legal";
import { db } from "./firebase";
import { selfDeviceId } from "./deviceRepository";

const KEY = "lp.consent.v1";

/** The four things ticked at signup: the three documents, plus the age statement. */
export type ConsentItem = LegalKey | "age";

export const CONSENT_ITEMS: ConsentItem[] = ["age", ...LEGAL_ORDER];

export interface ConsentRecord {
  /** The document id on the server: one record per version of the words. */
  id: string;
  /** The `LEGAL_VERSION` they actually saw. */
  version: string;
  /** ms — when each individual box was ticked. Separate acts, separate times. */
  agreedAt: Partial<Record<ConsentItem, number>>;
  /** ms — when the account was actually created with these ticks behind it. */
  recordedAt: number;
  /** The phone it was given on (D70's device id, and the name the user would recognise). */
  deviceId: string;
  deviceLabel: string;
  uid?: string;
}

export async function getConsent(): Promise<ConsentRecord | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as ConsentRecord;
    return c && typeof c.version === "string" && c.agreedAt ? c : null;
  } catch {
    return null;
  }
}

/** True when every one of the four was ticked, against the version we currently ship. */
export function consentComplete(c: ConsentRecord | null): boolean {
  if (!c || c.version !== LEGAL_VERSION) return false;
  return CONSENT_ITEMS.every((k) => typeof c.agreedAt[k] === "number");
}

export async function consentIsCurrent(): Promise<boolean> {
  return consentComplete(await getConsent());
}

function consentDoc(uid: string, version: string) {
  return db()?.collection("users").doc(uid).collection("consents").doc(version);
}

/**
 * Keep the consent: locally, and — when there is an account — on the server with it.
 *
 * The server write is **never awaited** (D51/R11). Offline, a Firestore `set()` resolves only on server ack,
 * so awaiting it here would hang the signup button on a plane exactly as it once hung the save button. The
 * write sits in Firestore's own queue and lands when the network does; the local copy is authoritative in the
 * meantime, so nothing is lost by not waiting.
 */
export async function recordConsent(
  agreedAt: Partial<Record<ConsentItem, number>>,
  uid?: string
): Promise<ConsentRecord> {
  const deviceId = await selfDeviceId();
  const deviceLabel = await selfDeviceLabel();

  const record: ConsentRecord = {
    id: LEGAL_VERSION,
    version: LEGAL_VERSION,
    agreedAt,
    recordedAt: Date.now(),
    deviceId,
    deviceLabel,
    uid,
  };

  await AsyncStorage.setItem(KEY, JSON.stringify(record));

  if (uid) {
    try {
      // create-only by the security rules; a second signup on the same version simply fails, which is correct
      void consentDoc(uid, LEGAL_VERSION)?.set(record);
    } catch {
      // Firestore unavailable — the local record stands, and `pushConsent` retries at the next login.
    }
  }
  return record;
}

/** Stamp the account onto a consent given moments before it existed, and push it. */
export async function pushConsent(uid: string): Promise<void> {
  const local = await getConsent();
  if (!local || !consentComplete(local)) return;

  const withUid: ConsentRecord = { ...local, uid };
  await AsyncStorage.setItem(KEY, JSON.stringify(withUid));
  try {
    void consentDoc(uid, local.version)?.set(withUid);
  } catch {
    // best-effort; the local record is what the app reads
  }
}

/**
 * Bring the account's consent down to a phone that has never seen it — the second device, or a reinstall.
 * Without this, logging in elsewhere showed an empty 동의 내역: the same person, the same account, and no
 * consent in sight.
 *
 * A local record always wins: it is the one given on *this* phone, and it is what we would have to produce.
 */
export async function fetchConsent(uid: string): Promise<ConsentRecord | null> {
  const local = await getConsent();
  if (consentComplete(local)) return local;

  try {
    const snap = await consentDoc(uid, LEGAL_VERSION)?.get({ source: "server" });
    const data = snap?.data?.();
    if (!data) return local;
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
    return data as ConsentRecord;
  } catch {
    return local; // offline, or nothing there — never guess
  }
}

async function selfDeviceLabel(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { listDevices } = require("./deviceRepository");
    const me = await selfDeviceId();
    const rows = await listDevices();
    return rows.find((d: { id: string }) => d.id === me)?.label ?? "이 기기";
  } catch {
    return "이 기기";
  }
}
