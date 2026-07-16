// Local-first repository for Subscriptions (D96 · D98 · PRD R8 family). A Subscription is a **template** for a
// recurring spend; on each occurrence of its schedule (매월/매주/매일) it materializes an ordinary Expense
// (category 정기구독) into the log. Same Repository pattern as the others, so F0's Firestore swap sits behind
// this interface (architecture §7). Subscriptions sync (sync.ts KEYS); the Expense they generate carries a
// **deterministic id** so two devices holding the same subscription can never double-log one occurrence.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense, SubFrequency, Subscription } from "./types";
import { listExpenses, saveExpenses } from "./expenseRepository";
import { stampFor } from "@/core/logs/aggregate";
import { todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { syncPut, syncRemove } from "./sync";

const KEY = "lp.subscriptions.v1";

export type { Subscription } from "./types";

/** 매주 결제 요일 labels, index = getDay() (0=일 … 6=토). */
export const WEEKDAY_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const pad = (n: number) => String(n).padStart(2, "0");
/** Days in month `m1` (1-based) of year `y`. `new Date(y, m1, 0)` = the last day of month m1. */
const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();
/** "YYYY-MM" → the following "YYYY-MM". */
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m >= 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}
/** getDay() of a YYYY-MM-DD (device-local). */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
const ymdOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const effFrequency = (sub: { frequency?: SubFrequency }): SubFrequency => sub.frequency ?? "monthly";

/** The deterministic id of the Expense a subscription generates for a given occurrence date — the cross-device
 *  dedup key (Firestore last-write-wins collapses two identical ids into one row). 매월 keys by month (so it
 *  matches the D96 rows already in the wild); 매주/매일 key by the exact date. */
export function subExpenseId(sub: Pick<Subscription, "id" | "frequency">, date: string): string {
  return effFrequency(sub) === "monthly" ? `sub_${sub.id}_${date.slice(0, 7)}` : `sub_${sub.id}_${date}`;
}

/**
 * Fill in fields legacy (D96) rows lack, so the rest of the code sees one shape: default `frequency` to
 * "monthly", and derive `lastRun` from the old `lastMonth` (its month's clamped 결제일). Pure — applied on read.
 */
export function normalizeSubscription(s: Subscription): Subscription {
  const frequency = effFrequency(s);
  let lastRun = s.lastRun;
  if (!lastRun && s.lastMonth && frequency === "monthly" && s.dayOfMonth) {
    const [y, m] = s.lastMonth.split("-").map(Number);
    lastRun = `${s.lastMonth}-${pad(Math.min(s.dayOfMonth, daysInMonth(y, m)))}`;
  }
  return { ...s, frequency, lastRun };
}

/** The user-facing cadence line: "매월 11일" · "매주 일요일" · "매일". */
export function subscriptionScheduleLabel(sub: Subscription): string {
  switch (effFrequency(sub)) {
    case "weekly":
      return `매주 ${WEEKDAY_LABELS[sub.weekday ?? 0]}`;
    case "daily":
      return "매일";
    default:
      return `매월 ${sub.dayOfMonth ?? 1}일`;
  }
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    const all = Array.isArray(rows) ? (rows as Subscription[]) : [];
    // Newest first, like the other lists; normalize legacy shape on the way out.
    return all.map(normalizeSubscription).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    // A corrupt store must degrade, not detonate — this read sits under the log tab and the app-open sweep.
    return [];
  }
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(subs));
}

export async function addSubscription(sub: Subscription): Promise<void> {
  await saveSubscriptions([...(await listSubscriptions()), sub]);
  syncPut("subscriptions", sub);
}

export async function updateSubscription(sub: Subscription): Promise<void> {
  const all = await listSubscriptions();
  const exists = all.some((s) => s.id === sub.id);
  await saveSubscriptions(exists ? all.map((s) => (s.id === sub.id ? sub : s)) : [...all, sub]);
  syncPut("subscriptions", sub);
}

export async function deleteSubscription(id: string): Promise<void> {
  const all = await listSubscriptions();
  await saveSubscriptions(all.filter((s) => s.id !== id));
  syncRemove("subscriptions", id); // soft-delete tombstone so the other phone hears the removal
}

/** Flip a subscription on/off. **Re-activating rebases `lastRun` to yesterday** so it resumes from today
 *  forward (a due-today occurrence still fires) and never backfills the dormant stretch as surprise charges. */
export async function setSubscriptionActive(id: string, active: boolean, today = todayYmd(), now = Date.now()): Promise<void> {
  const all = await listSubscriptions();
  const sub = all.find((s) => s.id === id);
  if (!sub) return;
  const next: Subscription = {
    ...sub,
    active,
    lastRun: active ? shiftYmd(today, -1) : sub.lastRun,
    updatedAt: now,
  };
  await saveSubscriptions(all.map((s) => (s.id === id ? next : s)));
  syncPut("subscriptions", next);
}

/** Every occurrence date of `sub`'s schedule strictly after `afterExclusive` and on/before `today`, ascending.
 *  Capped to 400 iterations so a phone closed for a year can't spin forever (it advances `lastRun` to the last
 *  one it emits, so the next run continues from there). */
function occurrences(sub: Subscription, afterExclusive: string, today: string): string[] {
  const out: string[] = [];
  const freq = effFrequency(sub);

  if (freq === "monthly") {
    const day = sub.dayOfMonth ?? 1;
    let cursor = afterExclusive.slice(0, 7);
    for (let i = 0; i < 400 && cursor <= today.slice(0, 7); i++) {
      const [y, m] = cursor.split("-").map(Number);
      const date = `${cursor}-${pad(Math.min(day, daysInMonth(y, m)))}`;
      if (date > afterExclusive && date <= today) out.push(date);
      cursor = nextMonth(cursor);
    }
    return out;
  }

  // weekly / daily: walk day by day from the day after `afterExclusive` through today.
  let d = shiftYmd(afterExclusive, 1);
  for (let i = 0; i < 400 && d <= today; i++) {
    if (freq === "daily" || weekdayOf(d) === (sub.weekday ?? 0)) out.push(d);
    d = shiftYmd(d, 1);
  }
  return out;
}

/**
 * **Pure** planner: which Expenses a single subscription owes as of `today`, and the `lastRun` it advances to.
 * No storage, no React — so the schedule math is unit-testable. Expects a normalized sub (frequency set).
 *
 * Forward-only from creation (a charge dated before the user set the subscription up is never fabricated);
 * an occurrence generates only once its date has arrived (`<= today`); a future occurrence is simply not yet in
 * range and is picked up next run; a 매월 29/30/31 clamps to a short month's last day. Returns `null` when
 * nothing is owed (and `lastRun` is unchanged).
 */
export function subscriptionDueExpenses(
  sub: Subscription,
  today: string,
  now: number,
): { expenses: Expense[]; lastRun: string } | null {
  if (!sub.active) return null;
  const createdYmd = ymdOf(sub.createdAt);
  // Occurrences strictly after this date are still owed. First run (no lastRun): the day before creation, so the
  // creation day itself can fire but nothing earlier is back-filled.
  const afterExclusive = sub.lastRun ?? shiftYmd(createdYmd, -1);

  const dates = occurrences(sub, afterExclusive, today);
  if (dates.length === 0) return null;

  const expenses: Expense[] = [];
  for (const date of dates) {
    if (date < createdYmd) continue; // forward-only guard (belt-and-braces with afterExclusive)
    expenses.push({
      id: subExpenseId(sub, date),
      date,
      timestamp: stampFor(date, now),
      name: sub.name,
      amount: sub.amount,
      category: "정기구독",
      store: sub.store,
      payment: sub.payment,
      createdAt: now,
      updatedAt: now,
    });
  }
  return { expenses, lastRun: dates[dates.length - 1] };
}

/**
 * Generate every due subscription row and advance each subscription's `lastRun`. Idempotent — safe to call on
 * every app open and every 기록 focus. Returns true if anything was written (so a caller can refresh).
 *
 * The generated Expense's deterministic id also de-dupes against whatever is already stored, so a row a user has
 * since edited or a row already synced from the other phone is left exactly as it is.
 */
export async function materializeSubscriptions(today = todayYmd(), now = Date.now()): Promise<boolean> {
  const subs = await listSubscriptions();
  const freshExpenses: Expense[] = [];
  const settled: Subscription[] = [];

  for (const sub of subs) {
    const res = subscriptionDueExpenses(sub, today, now);
    if (!res) continue;
    freshExpenses.push(...res.expenses);
    if (res.lastRun !== sub.lastRun) settled.push({ ...sub, lastRun: res.lastRun, updatedAt: now });
  }

  let wrote = false;

  if (freshExpenses.length > 0) {
    const existing = await listExpenses();
    const have = new Set(existing.map((e) => e.id));
    const toAdd = freshExpenses.filter((e) => !have.has(e.id));
    if (toAdd.length > 0) {
      await saveExpenses([...existing, ...toAdd]);
      for (const e of toAdd) syncPut("expenses", e);
      wrote = true;
    }
  }

  if (settled.length > 0) {
    const byId = new Map(settled.map((s) => [s.id, s]));
    const all = await listSubscriptions();
    await saveSubscriptions(all.map((s) => byId.get(s.id) ?? s));
    for (const s of settled) syncPut("subscriptions", s);
    wrote = true;
  }

  return wrote;
}
