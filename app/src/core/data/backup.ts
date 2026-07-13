// Local JSON backup — manual export / import of the whole on-device dataset (decisions D2 + D24).
// LOCAL only: writes/reads a file and uses the OS share/pick sheets — NO network, NO account, so it
// respects the prototype's offline principle (PRD R5). Import offers D24's merge vs overwrite.
//
// A backup bundles every `lp.*` AsyncStorage key (blocks, events, expenses, meals, outcomes, fires,
// missed, latencies, baseline, onboarded flag, settings) plus the native sound flag. On import we re-arm
// every alarm/alert from the restored data so nothing is left ghosting or silently unarmed.

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { alarm } from "@/core/notifications/alarm";
import { listBlocks } from "@/core/data/blockRepository";
import { listEvents } from "@/core/data/eventRepository";
import { scheduleBlock, unscheduleBlock } from "@/core/schedule/blockScheduler";
import { rearmEventNotifications } from "@/core/notifications/plainReminders";

export type ImportMode = "merge" | "overwrite";

interface Backup {
  app: "lifeplanner";
  version: 1;
  exportedAt: number;
  sound: boolean;
  data: Record<string, string>; // AsyncStorage key -> its raw stored string
}

// Merge identity per array-valued key (D24: "append items whose id isn't already present").
const ARRAY_KEY_ID: Record<string, (item: any) => string> = {
  "lp.blocks.v1": (b) => String(b?.id),
  "lp.tasks.v1": (t) => String(t?.id), // legacy (prototype backups) — migrated to blocks on the next read
  "lp.events.v1": (e) => String(e?.id),
  "lp.expenses.v1": (e) => String(e?.id),
  "lp.meals.v1": (m) => String(m?.id),
  "lp.outcomes.v1": (o) => `${o?.taskId}|${o?.date}|${o?.source}`,
  "lp.fires.v1": (f) => `${f?.taskId}|${f?.date}`,
  "lp.missed.v1": (m) => `${m?.taskId}|${m?.date}`,
  "lp.latencies.v1": (l) => `${l?.taskId}|${l?.date}|${l?.firedAt}`,
};
// Every other lp.* key (lp.baseline.v1, lp.onboarded.v1, lp.settings.v1, …) is scalar/object: overwrite
// replaces it; merge keeps the existing value if present, else adopts the backup's.

const pad = (n: number) => String(n).padStart(2, "0");

function safeArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Serialize the whole local dataset to a JSON file and open the share sheet. Returns the file uri. */
export async function exportBackup(): Promise<string> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("lp."));
  const pairs = await AsyncStorage.multiGet(keys);
  const data: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) data[k] = v;

  const backup: Backup = {
    app: "lifeplanner",
    version: 1,
    exportedAt: Date.now(),
    sound: safeBool(() => alarm.getSound()),
    data,
  };

  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const uri = `${FileSystem.cacheDirectory}lifeplanner-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "백업 내보내기",
      UTI: "public.json",
    });
  }
  return uri;
}

export interface ImportResult {
  imported: boolean; // false when the user cancels the picker
  mode: ImportMode;
  blocks: number; // block count after import (for a confirmation message)
}

/** Pick a backup JSON file and apply it (merge or overwrite), then re-arm alarms + reminders. */
export async function importBackup(mode: ImportMode): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return { imported: false, mode, blocks: 0 };

  const raw = await FileSystem.readAsStringAsync(asset.uri);
  let backup: Backup;
  try {
    backup = JSON.parse(raw) as Backup;
  } catch {
    throw new Error("파일을 읽을 수 없어요. 올바른 백업 JSON인지 확인해 주세요.");
  }
  if (!backup || backup.app !== "lifeplanner" || typeof backup.data !== "object" || backup.data == null) {
    throw new Error("이 앱의 백업 파일이 아니에요.");
  }

  // Block ids before import — so an overwrite that drops blocks can cancel their orphaned alarms too.
  const beforeIds = (await listBlocks()).map((b) => b.id);

  for (const [key, incomingRaw] of Object.entries(backup.data)) {
    if (typeof incomingRaw !== "string") continue;
    const idOf = ARRAY_KEY_ID[key];
    if (idOf) {
      if (mode === "overwrite") {
        await AsyncStorage.setItem(key, incomingRaw);
      } else {
        const existing = safeArray(await AsyncStorage.getItem(key));
        const seen = new Set(existing.map(idOf));
        const merged = existing.slice();
        for (const item of safeArray(incomingRaw)) {
          const id = idOf(item);
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(item);
          }
        }
        await AsyncStorage.setItem(key, JSON.stringify(merged));
      }
    } else {
      // scalar/object or unknown lp.* key
      if (mode === "overwrite") {
        await AsyncStorage.setItem(key, incomingRaw);
      } else {
        const existing = await AsyncStorage.getItem(key);
        if (existing == null) await AsyncStorage.setItem(key, incomingRaw);
      }
    }
  }

  // Sound is native, not AsyncStorage — overwrite adopts the backup's flag; merge keeps current.
  if (typeof backup.sound === "boolean" && mode === "overwrite") {
    safeBool(() => (alarm.setSound(backup.sound), backup.sound));
  }

  // Re-arm: cancel every alarm that could exist for the before ∪ after id sets, then schedule the final
  // block set so restored blocks fire (and dropped ones leave no ghost). `listBlocks` also runs the
  // one-time Task→TimeBlock migration, so importing an OLD (prototype) backup still lands as blocks.
  const afterBlocks = await listBlocks();
  const allIds = new Set<string>([...beforeIds, ...afterBlocks.map((b) => b.id)]);
  for (const id of allIds) unscheduleBlock(id);
  for (const b of afterBlocks) scheduleBlock(b);
  // Events (R3): re-arm from scratch — drops ghosts of events the restore removed.
  await rearmEventNotifications(await listEvents());

  return { imported: true, mode, blocks: afterBlocks.length };
}

function safeBool(fn: () => boolean): boolean {
  try {
    return !!fn();
  } catch {
    return false;
  }
}
