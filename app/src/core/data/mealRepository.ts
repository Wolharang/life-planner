// Local-first repository for MealEntries (data-model §2.5 · PRD R9). Ported from `reference/kcal.js`
// (`@diet_list`) — reference-apps.md §B2/§B3 — **minus photos** (D19) and **minus the 운동/러닝 activity
// records** (D22: a workout is a TimeBlock marked success, not a log row).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MealEntry } from "./types";

const KEY = "lp.meals.v1";

export type { MealEntry } from "./types";

export async function listMeals(): Promise<MealEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const all = raw ? (JSON.parse(raw) as MealEntry[]) : [];
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function saveMeals(meals: MealEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(meals));
}

export async function addMeal(meal: MealEntry): Promise<void> {
  await saveMeals([...(await listMeals()), meal]);
}

export async function updateMeal(meal: MealEntry): Promise<void> {
  const all = await listMeals();
  await saveMeals(all.map((m) => (m.id === meal.id ? meal : m)));
}

export async function deleteMeal(id: string): Promise<void> {
  const all = await listMeals();
  await saveMeals(all.filter((m) => m.id !== id));
}
