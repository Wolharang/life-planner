// What the user agreed to, and when.
//
// A tick box that leaves no trace is theatre: if the answer is never recorded, we cannot say we have consent,
// and we cannot tell whether the words they saw are the words we still ship. So the record carries the
// **version** — when a document's meaning changes, `LEGAL_VERSION` bumps, the stored record no longer matches,
// and the app knows it must ask again rather than assume.
//
// The date is kept **per document**, because that is what the consent screen shows on each row, and because
// documents will not always change together.
//
// Local only, deliberately. It is written at signup and nothing about the lever depends on it, so it never
// becomes a reason a write has to wait for a network.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEGAL_VERSION, LEGAL_ORDER, type LegalKey } from "@/content/legal";

const KEY = "lp.consent.v1";

export interface ConsentRecord {
  /** The `LEGAL_VERSION` of the words they actually saw. */
  version: string;
  /** When each document was agreed to (ms). */
  agreedAt: Partial<Record<LegalKey, number>>;
  /** Which account it was given for, when there was one. */
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

/** Stamp every document as agreed, now, against the version they were shown. */
export async function recordConsent(uid?: string): Promise<ConsentRecord> {
  const now = Date.now();
  const agreedAt: Partial<Record<LegalKey, number>> = {};
  for (const key of LEGAL_ORDER) agreedAt[key] = now;

  const record: ConsentRecord = { version: LEGAL_VERSION, agreedAt, uid };
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
  return record;
}

/** Did they agree to *this* version? A stale record means the words changed under them. */
export async function consentIsCurrent(): Promise<boolean> {
  const c = await getConsent();
  if (!c || c.version !== LEGAL_VERSION) return false;
  return LEGAL_ORDER.every((k) => typeof c.agreedAt[k] === "number");
}
