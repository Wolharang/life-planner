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
  const all = raw ? (JSON.parse(raw) as Expense[]) : [];
  return all.sort((a, b) => b.timestamp - a.timestamp);
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
  await saveExpenses(all.map((e) => (e.id === expense.id ? expense : e)));
  syncPut("expenses", expense);
}

export async function deleteExpense(id: string): Promise<void> {
  const all = await listExpenses();
  await saveExpenses(all.filter((e) => e.id !== id));
  syncRemove("expenses", id); // soft-delete tombstone — a hard delete cannot propagate (§6)
}
