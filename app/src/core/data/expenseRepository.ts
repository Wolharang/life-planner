// Local-first repository for Expenses (data-model §2.4 · PRD R8). Same Repository pattern as the others,
// so F0 swaps the impl to Firestore behind this interface (architecture §7). Ported storage shape from
// `reference/calculator.js` (`@expense_list`) — see reference-apps.md §A2/§A3.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense } from "./types";
import { syncPut, syncRemove } from "./sync";

const KEY = "lp.expenses.v1";

export type { Expense } from "./types";

/** Newest first — the reference app sorted by timestamp descending on every load. */
export async function listExpenses(): Promise<Expense[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    const all = Array.isArray(rows) ? (rows as Expense[]) : [];
    // Legacy normalization: 뷰티 was renamed to 의료 (D87). Remap on read so rows saved under the old name
    // still resolve a colour and icon instead of rendering blank. They persist under the new name on next save.
    for (const e of all) if ((e.category as string) === "뷰티") e.category = "의료";
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    // A corrupt store must degrade, not detonate — this read sits under home, the tabs, the catch-up sweep
    // and the app-open re-arm, and an unguarded throw took the whole app down with no recovery path.
    return [];
  }
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(expenses));
}

export async function addExpense(expense: Expense): Promise<void> {
  await saveExpenses([...(await listExpenses()), expense]);
  syncPut("expenses", expense); // mirror up (no-op when logged out)
}

export async function updateExpense(expense: Expense): Promise<void> {
  const all = await listExpenses();
  // An edit for a row that is no longer here (deleted on the other phone while this screen
  //  was open) used to be silently discarded — the screen closed and the change vanished.
  const exists = all.some((e) => e.id === expense.id);
  await saveExpenses(
    exists ? all.map((e) => (e.id === expense.id ? expense : e)) : [...all, expense]
  );
  syncPut("expenses", expense);
}

/** Persist a manual within-day order (D92): stamp `sortIndex` by position, bump `updatedAt`, and mirror each
 *  reordered row up so the new order reaches the other phones (putPayload carries the new field). */
export async function reorderExpenses(orderedIds: string[]): Promise<void> {
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  const now = Date.now();
  const all = await listExpenses();
  const touched: Expense[] = [];
  const next = all.map((e) => {
    const i = rank.get(e.id);
    if (i == null || e.sortIndex === i) return e;
    const updated = { ...e, sortIndex: i, updatedAt: now };
    touched.push(updated);
    return updated;
  });
  if (touched.length === 0) return;
  await saveExpenses(next);
  for (const e of touched) syncPut("expenses", e);
}

export async function deleteExpense(id: string): Promise<void> {
  const all = await listExpenses();
  await saveExpenses(all.filter((e) => e.id !== id));
  syncRemove("expenses", id); // soft-delete tombstone — a hard delete cannot propagate (§6)
}
