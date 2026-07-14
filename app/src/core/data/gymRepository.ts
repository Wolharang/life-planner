// Saved gym locations for auto-evaluation (D-log: GPS auto-eval, 2026-07-14).
//
// **Device-local on purpose.** These coordinates never sync and never leave the phone — the whole point of the
// feature is to keep the location footprint minimal: the raw fixes are compared and discarded, and the only thing
// that ever reaches the server is the derived 성공/실패 (the block's `status`, which already syncs). A gym list is
// the one durable location value, so it stays where it was set. (A user with two phones sets it on each — a small
// cost to keep coordinates off the network entirely.)
//
// Any number of gyms: standing still at ANY of them counts as 성공 (evaluateByLocation → atGym).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Gym } from "@/core/schedule/autoEval";

const KEY = "lp.gyms.v1";

function safeParse(raw: string | null): Gym[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as Gym[]) : [];
  } catch {
    return [];
  }
}

export async function listGyms(): Promise<Gym[]> {
  return safeParse(await AsyncStorage.getItem(KEY));
}

/**
 * Save a gym. Returns the stored list. A client-generated id keys removal; the label is the user's own name for
 * the place ("회사 앞 헬스장"), free to be empty.
 */
export async function addGym(gym: Gym): Promise<Gym[]> {
  const gyms = await listGyms();
  const next = [...gyms.filter((g) => g.id !== gym.id), gym];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeGym(id: string): Promise<Gym[]> {
  const next = (await listGyms()).filter((g) => g.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
