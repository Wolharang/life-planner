// Saved gym locations for auto-evaluation (D-log: GPS auto-eval, 2026-07-14).
//
// **A gym syncs across the member's devices** — it is a static place they chose (like the block's 장소명 that
// already syncs), not their live location, so it rides the same Repository+sync machinery as blocks/expenses.
// The auto-eval's real-time fixes are a different thing entirely: those are captured natively, compared on the
// device, and **discarded — never synced** (위치 약관 / 처리방침). Only the derived 성공/미스 and this static
// reference ever leave the phone.
//
// Any number of gyms: standing still at ANY of them counts as 성공 (evaluateByLocation → atGym).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Gym } from "@/core/schedule/autoEval";
import { syncPut, syncRemove } from "./sync";

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

async function saveGyms(gyms: Gym[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(gyms));
}

/**
 * Save a gym (stamping `updatedAt` for last-writer-wins sync). Re-adding the same id replaces it. Returns the
 * stored list. The label is the member's own name for the place ("회사 앞 헬스장"), free to be empty.
 */
export async function addGym(gym: Omit<Gym, "updatedAt">): Promise<Gym[]> {
  const row: Gym = { ...gym, updatedAt: Date.now() };
  const next = [...(await listGyms()).filter((g) => g.id !== row.id), row];
  await saveGyms(next);
  syncPut("gyms", row); // mirror up (no-op when logged out)
  return next;
}

export async function removeGym(id: string): Promise<Gym[]> {
  const next = (await listGyms()).filter((g) => g.id !== id);
  await saveGyms(next);
  syncRemove("gyms", id); // soft-delete tombstone — a hard delete cannot propagate (§6)
  return next;
}
