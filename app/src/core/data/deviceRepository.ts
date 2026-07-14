// **Which phone should the moment take over?** (D70)
//
// Sync made the lever fire on *every* logged-in device at once. Three phones would light up together — and a
// lever that goes off in three places is not a cue, it is a question: **"where am I supposed to do this?"** The
// intervention's whole power is that it is unambiguous.
//
// So the account remembers its devices, and a block names the one(s) that should take the screen. Everything
// still syncs; only the **takeover** is addressed. The phones that were not named still tell you — one buzz and
// a notification — because being unaware is a different failure from being interrupted in three places.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { newId } from "./id";
import { setSelfDeviceId, selfDeviceIdSync } from "./deviceId";
import { syncPut } from "./sync";

const KEY = "lp.devices.v1";
const SELF_KEY = "lp.device.self.v1";

export interface DeviceRecord {
  id: string;
  /** What the user will recognise it by — the phone's own name, or its model. */
  label: string;
  updatedAt: number;
  lastSeenAt: number;
}

/** This install's stable id. Created once and kept — it is what a block's `executeOn` points at. */
export async function selfDeviceId(): Promise<string> {
  const known = selfDeviceIdSync();
  if (known) return known;
  const stored = await AsyncStorage.getItem(SELF_KEY);
  if (stored) {
    setSelfDeviceId(stored);
    return stored;
  }
  const fresh = newId("dev");
  await AsyncStorage.setItem(SELF_KEY, fresh);
  setSelfDeviceId(fresh);
  return fresh;
}

export { selfDeviceIdSync };

function selfLabel(): string {
  const name = (Constants as unknown as { deviceName?: string }).deviceName;
  return (typeof name === "string" && name.trim()) || "이 기기";
}

export async function listDevices(): Promise<DeviceRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as DeviceRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveDevices(rows: DeviceRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(rows));
}

/**
 * Announce this phone to the account, and cache its id for the scheduler. Called once at app start — before
 * any alarm is re-armed, because `scheduleBlock` has to know **which phone it is** to decide whether the
 * moment belongs to it.
 */
export async function registerSelf(): Promise<DeviceRecord> {
  const id = await selfDeviceId();
  const now = Date.now();
  const me: DeviceRecord = { id, label: selfLabel(), updatedAt: now, lastSeenAt: now };

  const all = await listDevices();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) all.push(me);
  else all[i] = { ...all[i], ...me };
  await saveDevices(all);

  syncPut("devices", me); // a no-op when logged out — a lone phone needs no register
  return me;
}
