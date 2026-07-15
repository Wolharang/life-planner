// Local-first repository for MealEntries (data-model §2.5 · PRD R9). Ported from `reference/kcal.js`
// (`@diet_list`) — reference-apps.md §B2/§B3 — **minus photos** (D19) and **minus the 운동/러닝 activity
// records** (D22: a workout is a TimeBlock marked success, not a log row).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MealEntry } from "./types";
import { syncPut, syncRemove } from "./sync";

const KEY = "lp.meals.v1";

export type { MealEntry } from "./types";

export async function listMeals(): Promise<MealEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    const all = Array.isArray(rows) ? (rows as MealEntry[]) : [];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    // A corrupt store must degrade, not detonate — this read sits under home, the tabs, the catch-up sweep
    // and the app-open re-arm, and an unguarded throw took the whole app down with no recovery path.
    return [];
  }
}

export async function saveMeals(meals: MealEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(meals));
}

export async function addMeal(meal: MealEntry): Promise<void> {
  await saveMeals([...(await listMeals()), meal]);
  syncPut("meals", meal);
}

export async function updateMeal(meal: MealEntry): Promise<void> {
  const all = await listMeals();
  // An edit for a row that is no longer here (deleted on the other phone while this screen
  //  was open) used to be silently discarded — the screen closed and the change vanished.
  const exists = all.some((m) => m.id === meal.id);
  await saveMeals(
    exists ? all.map((m) => (m.id === meal.id ? meal : m)) : [...all, meal]
  );
  syncPut("meals", meal);
}

/** Persist a manual within-day order (D92) — see reorderExpenses. */
export async function reorderMeals(orderedIds: string[]): Promise<void> {
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  const now = Date.now();
  const all = await listMeals();
  const touched: MealEntry[] = [];
  const next = all.map((m) => {
    const i = rank.get(m.id);
    if (i == null || m.sortIndex === i) return m;
    const updated = { ...m, sortIndex: i, updatedAt: now };
    touched.push(updated);
    return updated;
  });
  if (touched.length === 0) return;
  await saveMeals(next);
  for (const m of touched) syncPut("meals", m);
}

export async function deleteMeal(id: string): Promise<void> {
  const all = await listMeals();
  await saveMeals(all.filter((m) => m.id !== id));
  syncRemove("meals", id);
}
