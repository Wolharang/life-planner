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
  await saveMeals(all.map((m) => (m.id === meal.id ? meal : m)));
  syncPut("meals", meal);
}

export async function deleteMeal(id: string): Promise<void> {
  const all = await listMeals();
  await saveMeals(all.filter((m) => m.id !== id));
  syncRemove("meals", id);
}
