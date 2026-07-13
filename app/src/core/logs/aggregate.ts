// Pure aggregation for the Logs surface — the numbers the reference apps showed (monthly total, category
// distribution, day sections, today's kcal-vs-target summary), rebuilt as functions so they're testable
// and reusable by the day summary (R10) later. No storage, no React.

import type { Expense, MealEntry, MealType } from "@/core/data/types";
import { KCAL_TARGET, MEAL_TYPES } from "./constants";

const pad = (n: number) => String(n).padStart(2, "0");

/** A record's ms stamp: the CHOSEN date carrying the current clock time — the reference apps' shared
 *  convention (reference-apps.md §C), kept so ported data and new data sort identically. */
export function stampFor(date: string, now: number): number {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(now);
  return new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds(), 0).getTime();
}

/** "YYYY-MM" of a YYYY-MM-DD date. */
export const monthOf = (date: string) => date.slice(0, 7);
export const monthKey = (y: number, m0: number) => `${y}-${pad(m0 + 1)}`;

export const inMonth = <T extends { date: string }>(items: T[], month: string) =>
  items.filter((i) => monthOf(i.date) === month);

export const expenseTotal = (expenses: Expense[]) => expenses.reduce((sum, e) => sum + e.amount, 0);

/** 1,234원 — the reference app's number formatting. */
export const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

/** Each category's share of the given expenses, biggest first; zero-amount categories are dropped. */
export function categoryDistribution(expenses: Expense[]): { category: Expense["category"]; amount: number; ratio: number }[] {
  const total = expenseTotal(expenses);
  const by = new Map<Expense["category"], number>();
  for (const e of expenses) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
  return [...by.entries()]
    .map(([category, amount]) => ({ category, amount, ratio: total > 0 ? amount / total : 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Day sections (newest day first, newest entry first within a day) — the reference apps' SectionList. */
export function byDay<T extends { date: string; timestamp: number }>(items: T[]): { date: string; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const i of items) {
    const arr = by.get(i.date);
    if (arr) arr.push(i);
    else by.set(i.date, [i]);
  }
  return [...by.entries()]
    .map(([date, list]) => ({ date, items: list.slice().sort((a, b) => b.timestamp - a.timestamp) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface MealSummary {
  total: number;
  byMeal: Record<MealType, { kcal: number; target: number; names: string[] }>;
}

/** Today's kcal summary vs the per-meal targets (reference §B4 "오늘의 기록 요약"). */
export function mealSummary(meals: MealEntry[], date: string): MealSummary {
  const byMeal = {} as MealSummary["byMeal"];
  for (const m of MEAL_TYPES) byMeal[m] = { kcal: 0, target: KCAL_TARGET[m], names: [] };
  let total = 0;
  for (const e of meals) {
    if (e.date !== date) continue;
    byMeal[e.mealType].kcal += e.kcal;
    byMeal[e.mealType].names.push(e.foodName);
    total += e.kcal;
  }
  return { total, byMeal };
}
