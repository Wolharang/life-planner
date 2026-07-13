// **P-d — the reference-app data migration** (`docs/research/reference-apps.md` §C · implementation-plan P-d).
//
// The plan recorded P-d as "done inside F3". It was not. Only the *field mapping* was done; the **data** was
// never given a way in — and `backup.ts` actively rejects anything whose `app !== "lifeplanner"`, so the
// founder's own `expense_backup_*.json` / `diet_backup_*.json` files **bounced off the app that exists to
// replace those apps**. Half of "one integrated day" (G2) was unreachable.
//
// The reference exports are **bare JSON arrays** — `JSON.stringify(expenseList)` / `JSON.stringify(dietList)`,
// no wrapper, no version. So we sniff the rows rather than trust a header.
//
// What is deliberately dropped, and why:
//  · `image` — **no meal photos** (D19: they would need paid Cloud Storage).
//  · `icon`  — derived from the category here, never stored (data-model §2.4).
//  · **러닝 / 운동 rows** — the calorie app logged workouts as diet entries. In this model a workout **is a
//    TimeBlock marked success** (D22); importing them as meals would invent food that was never eaten and
//    corrupt the kcal totals.

import type { Expense, ExpenseCategory, MealEntry, MealType } from "./types";
import { EXPENSE_CATEGORIES, MEAL_TYPES } from "@/core/logs/constants";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export type ReferenceKind = "expenses" | "meals";

export interface ReferenceImport {
  kind: ReferenceKind;
  expenses: Expense[];
  meals: MealEntry[];
  /** 러닝/운동 rows we refused to import as meals (D22) — reported so the user isn't told a silent lie. */
  droppedActivities: number;
}

/**
 * Is this a reference-app export? Both are arrays of `{id, timestamp, name, category, …}`; the budget app's
 * rows carry `amount`, the calorie app's carry `kcal`. Anything else is not ours to read.
 */
export function detectReference(rows: unknown): ReferenceKind | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sample = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (sample.length === 0) return null;
  const has = (k: string) => sample.some((r) => k in r);
  if (!has("id") || !has("timestamp")) return null;
  if (has("amount")) return "expenses";
  if (has("kcal")) return "meals";
  return null;
}

export function parseReference(rows: unknown[]): ReferenceImport {
  const kind = detectReference(rows);
  const expenses: Expense[] = [];
  const meals: MealEntry[] = [];
  let droppedActivities = 0;
  const now = Date.now();

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, any>;
    const timestamp = Number(r.timestamp);
    if (!r.id || !Number.isFinite(timestamp)) continue;
    const id = String(r.id);

    if (kind === "expenses") {
      const amount = Number(r.amount);
      if (!Number.isFinite(amount)) continue;
      const category: ExpenseCategory = EXPENSE_CATEGORIES.includes(r.category)
        ? (r.category as ExpenseCategory)
        : "기타"; // the two apps' category sets are identical, but never trust a file
      expenses.push({
        id,
        date: ymd(timestamp),
        timestamp,
        name: String(r.name ?? "").trim() || category, // a blank name falls back to the category (R8)
        amount,
        category,
        store: r.store ? String(r.store) : undefined,
        payment: r.payment ? String(r.payment) : undefined,
        createdAt: timestamp,
        updatedAt: now,
      });
    } else if (kind === "meals") {
      const type = String(r.category ?? "");
      if (!MEAL_TYPES.includes(type as MealType)) {
        droppedActivities++; // 러닝 / 운동 — a workout is a TimeBlock, not a meal (D22)
        continue;
      }
      meals.push({
        id,
        date: ymd(timestamp),
        timestamp,
        mealType: type as MealType,
        foodName: String(r.name ?? "").trim() || type,
        detail: r.details ? String(r.details) : undefined,
        kcal: Number.isFinite(Number(r.kcal)) ? Number(r.kcal) : 0,
        createdAt: timestamp,
        updatedAt: now,
      });
    }
  }

  return { kind: kind ?? "expenses", expenses, meals, droppedActivities };
}
