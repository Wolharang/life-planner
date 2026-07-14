// What the user agreed to, and when.
//
// A tick box that leaves no trace is theatre: if we never record the consent, we cannot say we have it, and we
// cannot tell whether the words they saw are the words we still ship. So the record carries the **version** —
// when a policy's meaning changes, `LEGAL_VERSION` bumps, the stored record no longer matches, and the app
// knows it must ask again rather than assume.
//
// Local only, deliberately. It is written at signup — the one moment the account exists *because* of it — and
// nothing about the lever depends on it, so it never becomes a reason a write has to wait for a network.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEGAL_VERSION, type LegalKey } from "@/content/legal.generated";

const KEY = "lp.consent.v1";

export interface ConsentRecord {
  /** The `LEGAL_VERSION` the user actually saw. */
  version: string;
  agreedAt: number;
  /** Every document ticked — required ones plus any optional ones. */
  agreed: LegalKey[];
  /** Which account it was given for, when there was one. */
  uid?: string;
}

export async function getConsent(): Promise<ConsentRecord | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as ConsentRecord;
    return c && typeof c.version === "string" ? c : null;
  } catch {
    return null;
  }
}

export async function recordConsent(agreed: LegalKey[], uid?: string): Promise<void> {
  const record: ConsentRecord = { version: LEGAL_VERSION, agreedAt: Date.now(), agreed, uid };
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
}

/** Did they agree to *this* version of the documents? A stale record means the words changed under them. */
export async function consentIsCurrent(): Promise<boolean> {
  const c = await getConsent();
  return !!c && c.version === LEGAL_VERSION;
}

/** Whether the optional location terms were accepted — the gate for the gym-arrival feature when it lands. */
export async function locationConsented(): Promise<boolean> {
  const c = await getConsent();
  return !!c && c.version === LEGAL_VERSION && c.agreed.includes("location");
}
