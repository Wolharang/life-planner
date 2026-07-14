// **A device-local daily budget for the emails Firebase sends on our behalf** (founder, 2026-07-14).
//
// Firebase's email quota is *global* to the project, not per-user: one abuser hammering "비밀번호 재설정" can
// exhaust it and leave a real person unable to receive their own verification mail. Firebase throttles server-
// side, but by then the damage — a spent quota — is done. So we cap it *before* the request leaves the phone.
//
// The counter lives in AsyncStorage, which is per-install by nature — that is exactly the "기기 정보를 토대로 한
// 제한" asked for, with no device id to read: a store that never leaves this handset is already device-scoped.
// It is **device-global per action**, not per email: the point is to bound how much *this device* can add to the
// shared quota, and a per-email counter would let one device mail a hundred addresses a day.
//
// Limits (per calendar day, per device):
//   · 비밀번호 재설정  1  — the most abusable (logged out, targets any address), so the tightest.
//   · 이메일 변경      3  }  Firebase's own limits here are looser, and both are actions the *account owner*
//   · 인증 메일 재발송 3  }  takes on their own address — a legitimate retry or two must not be walled off.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.ratelimit.v1";

export type RateAction = "passwordReset" | "emailChange" | "resendVerification";

const LIMITS: Record<RateAction, number> = {
  passwordReset: 1,
  emailChange: 3,
  resendVerification: 3,
};

/** The local calendar day, `YYYY-MM-DD`. (In app runtime `Date` is available — the Workflow-only ban does not
 *  apply here.) Exposed via a parameter on the functions below so the day-rollover can be tested deterministically. */
export function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Store = Record<string, { day: string; count: number }>;

async function read(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

async function write(store: Store): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Persisting the counter failed. That is pathological on its own; do not compound it by trapping a real user
    // out of password recovery with no recourse — the in-memory decision already stands for this call.
  }
}

export interface RateResult {
  allowed: boolean;
  /** How many sends remain today after this call. */
  remaining: number;
  limit: number;
}

/**
 * Check the device's budget for `action` today and, if there is room, **spend one token**. A new day resets the
 * count (the stored day no longer matches). Returns `allowed: false` when the day's limit is already reached —
 * the caller must not make the network request in that case.
 */
export async function spendDaily(action: RateAction, day: string = today()): Promise<RateResult> {
  const limit = LIMITS[action];
  const store = await read();
  const cur = store[action];
  const count = cur && cur.day === day ? cur.count : 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  store[action] = { day, count: count + 1 };
  await write(store);
  return { allowed: true, remaining: limit - (count + 1), limit };
}

/**
 * Give a token back — for an attempt that never actually reached Firebase (no network). A request that did not
 * happen must not cost the user their one reset for the day.
 */
export async function refundDaily(action: RateAction, day: string = today()): Promise<void> {
  const store = await read();
  const cur = store[action];
  if (cur && cur.day === day && cur.count > 0) {
    store[action] = { day, count: cur.count - 1 };
    await write(store);
  }
}

/** The configured daily limit for an action — for building the "하루에 N번" copy without hard-coding it twice. */
export function dailyLimit(action: RateAction): number {
  return LIMITS[action];
}
