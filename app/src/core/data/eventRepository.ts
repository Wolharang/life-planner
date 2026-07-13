// Local-first repository for calendar ImportantEvents (PRD R1 · data-model §2.2). Same AsyncStorage
// pattern as taskRepository — the rest of the app talks to this interface, never storage directly, so
// the impl can swap to Firestore for the full app (architecture §7) without touching the calendar UI.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImportantEvent } from "./types";
import { syncPut, syncRemove } from "./sync";

const KEY = "lp.events.v1";

export type { ImportantEvent } from "./types";

export async function listEvents(): Promise<ImportantEvent[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as ImportantEvent[]) : [];
}

export async function saveEvents(events: ImportantEvent[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(events));
}

export async function addEvent(event: ImportantEvent): Promise<void> {
  await saveEvents([...(await listEvents()), event]);
  await syncPut("events", event);
}

export async function updateEvent(event: ImportantEvent): Promise<void> {
  const events = await listEvents();
  await saveEvents(events.map((e) => (e.id === event.id ? event : e)));
  await syncPut("events", event);
}

export async function deleteEvent(id: string): Promise<void> {
  const events = await listEvents();
  await saveEvents(events.filter((e) => e.id !== id));
  await syncRemove("events", id);
}

/** Group events by their calendar `date` (YYYY-MM-DD) → for month-grid bars + the selected-day list. */
export function groupByDate(events: ImportantEvent[]): Record<string, ImportantEvent[]> {
  const by: Record<string, ImportantEvent[]> = {};
  for (const e of events) (by[e.date] ??= []).push(e);
  // stable order within a day: timed events first (by time), then untimed
  for (const d of Object.keys(by)) {
    by[d].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  }
  return by;
}
