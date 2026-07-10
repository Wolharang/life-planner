// Local-first repository (Phase 0 = AsyncStorage). The rest of the app talks to this
// interface, never storage directly (architecture §5 Repository pattern) — so the
// storage impl can be swapped for the full-app later without touching features.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Task } from "./types";

const KEY = "lp.tasks.v1";

export type { Task } from "./types";

export async function listTasks(): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Task[]) : [];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(tasks));
}

export async function addTask(task: Task): Promise<void> {
  const tasks = await listTasks();
  await saveTasks([...tasks, task]);
}

export async function updateTask(task: Task): Promise<void> {
  const tasks = await listTasks();
  await saveTasks(tasks.map((t) => (t.id === task.id ? task : t)));
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = await listTasks();
  await saveTasks(tasks.filter((t) => t.id !== id));
}
