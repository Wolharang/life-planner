// Local-first repository for Subscriptions (D96 · PRD R8 family). A Subscription is a **template** for a
// recurring monthly spend; on its `dayOfMonth` each month it materializes an ordinary Expense (category
// 정기구독) into the log. Same Repository pattern as the others, so F0's Firestore swap sits behind this
// interface (architecture §7). Subscriptions sync (sync.ts KEYS); the Expense they generate carries a
// **deterministic id** so two devices holding the same subscription can never double-log the same month.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense, Subscription } from "./types";
import { listExpenses, saveExpenses } from "./expenseRepository";
import { stampFor } from "@/core/logs/aggregate";
import { todayYmd } from "@/core/schedule/blockScheduler";
import { syncPut, syncRemove } from "./sync";

const KEY = "lp.subscriptions.v1";

export type { Subscription } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
/** Days in month `m1` (1-based) of year `y`. `new Date(y, m1, 0)` = the last day of month m1. */
const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();
/** "YYYY-MM" → the following "YYYY-MM". */
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m >= 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

/** The deterministic id of the Expense a subscription generates for a given "YYYY-MM" — the cross-device
 *  dedup key (Firestore last-write-wins collapses two identical ids into one row). */
export const subExpenseId = (subId: string, ym: string) => `sub_${subId}_${ym}`;

export async function listSubscriptions(): Promise<Subscription[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    const all = Array.isArray(rows) ? (rows as Subscription[]) : [];
    // Newest first, like the other lists.
    return all.sort((a, b) => b.createdAt - a.createdAt);
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

/** Flip a subscription on/off. **Re-activating rebases `lastMonth` to last month** so it resumes from the
 *  current month forward and never backfills the dormant stretch as a lump of surprise charges. */
export async function setSubscriptionActive(id: string, active: boolean, today = todayYmd(), now = Date.now()): Promise<void> {
  const all = await listSubscriptions();
  const sub = all.find((s) => s.id === id);
  if (!sub) return;
  const next: Subscription = {
    ...sub,
    active,
    lastMonth: active ? prevMonth(today.slice(0, 7)) : sub.lastMonth,
    updatedAt: now,
  };
  await saveSubscriptions(all.map((s) => (s.id === id ? next : s)));
  syncPut("subscriptions", next);
}

/** "YYYY-MM" → the preceding "YYYY-MM". */
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m <= 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

/**
 * **Pure** planner: which Expenses a single subscription owes as of `today`, and the `lastMonth` it advances
 * to. No storage, no React — so the month math is unit-testable.
 *
 * Rules (D96): forward-only from the creation date (a charge dated before the user set the subscription up is
 * never fabricated); a month is generated only once its due day has **arrived** (`due <= today`); a future
 * month stops the walk **without** advancing `lastMonth`, so it is reconsidered next run; a short month with no
 * such day clamps to its last day. Returns `null` when nothing is owed and `lastMonth` is unchanged.
 */
export function subscriptionDueExpenses(
  sub: Subscription,
  today: string,
  now: number,
): { expenses: Expense[]; lastMonth: string } | null {
  if (!sub.active) return null;
  const createdYmd = ymdOf(sub.createdAt);
  const currentMonth = today.slice(0, 7);
  // Start at the month after the last one we settled, or — first run — the creation month.
  let cursor = sub.lastMonth ? nextMonth(sub.lastMonth) : createdYmd.slice(0, 7);

  const expenses: Expense[] = [];
  let advancedTo: string | null = null;

  while (cursor <= currentMonth) {
    const [cy, cm] = cursor.split("-").map(Number);
    const day = Math.min(sub.dayOfMonth, daysInMonth(cy, cm));
    const dueDate = `${cursor}-${pad(day)}`;
    if (dueDate > today) break; // not due yet — leave lastMonth here so we revisit this month next time

    // Forward-only: skip (but settle) any month whose due day fell before the user created the subscription.
    if (dueDate >= createdYmd) {
      expenses.push({
        id: subExpenseId(sub.id, cursor),
        date: dueDate,
        timestamp: stampFor(dueDate, now),
        name: sub.name,
        amount: sub.amount,
        category: "정기구독",
        store: sub.store,
        payment: sub.payment,
        createdAt: now,
        updatedAt: now,
      });
    }
    advancedTo = cursor;
    cursor = nextMonth(cursor);
  }

  if (advancedTo == null) return null;
  return { expenses, lastMonth: advancedTo };
}

const ymdOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Generate every due subscription row and advance each subscription's `lastMonth`. Idempotent — safe to call
 * on every app open and every 기록 focus. Returns true if anything was written (so a caller can refresh).
 *
 * The generated Expense's deterministic id also de-dupes against whatever is already stored, so a row a user
 * has since edited or a row already synced from the other phone is left exactly as it is.
 */
export async function materializeSubscriptions(today = todayYmd(), now = Date.now()): Promise<boolean> {
  const subs = await listSubscriptions();
  const freshExpenses: Expense[] = [];
  const settled: Subscription[] = [];

  for (const sub of subs) {
    const res = subscriptionDueExpenses(sub, today, now);
    if (!res) continue;
    freshExpenses.push(...res.expenses);
    if (res.lastMonth !== sub.lastMonth) settled.push({ ...sub, lastMonth: res.lastMonth, updatedAt: now });
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
