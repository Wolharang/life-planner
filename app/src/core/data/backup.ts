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
import { listExpenses, saveExpenses } from "@/core/data/expenseRepository";
import { listMeals, saveMeals } from "@/core/data/mealRepository";
import { detectReference, parseReference } from "@/core/data/referenceImport";
import { syncPutMany } from "@/core/data/sync";
import { scheduleBlock, unscheduleBlock } from "@/core/schedule/blockScheduler";
import { isBackupTooLarge, isImportableKey } from "@/core/data/backupGuards";

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
  "lp.subscriptions.v1": (s) => String(s?.id),
  "lp.meals.v1": (m) => String(m?.id),
  "lp.gyms.v1": (g) => String(g?.id),
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
  /** Set when the file came from a REFERENCE app (P-d), so the message can say what actually landed. */
  reference?: { expenses: number; meals: number; droppedActivities: number };
}

/**
 * Import a reference app's export (P-d). Merge = add rows whose id we don't already hold; overwrite =
 * replace that collection outright. It only ever touches the collection the file belongs to — importing a
 * budget backup must not wipe your meals.
 */
async function importReference(rows: unknown[], mode: ImportMode): Promise<ImportResult> {
  if (!detectReference(rows)) {
    throw new Error("이 앱의 백업 파일이 아니에요. 가계부/칼로리 앱의 백업 파일도 가져올 수 있어요.");
  }
  const ref = parseReference(rows);

  if (ref.expenses.length > 0) {
    const existing = mode === "overwrite" ? [] : await listExpenses();
    const seen = new Set(existing.map((e) => e.id));
    await saveExpenses([...existing, ...ref.expenses.filter((e) => !seen.has(e.id))]);
  }
  if (ref.meals.length > 0) {
    const existing = mode === "overwrite" ? [] : await listMeals();
    const seen = new Set(existing.map((m) => m.id));
    await saveMeals([...existing, ...ref.meals.filter((m) => !seen.has(m.id))]);
  }

  syncPutMany("expenses", await listExpenses());
  syncPutMany("meals", await listMeals());

  return {
    imported: true,
    mode,
    blocks: (await listBlocks()).length,
    reference: {
      expenses: ref.expenses.length,
      meals: ref.meals.length,
      droppedActivities: ref.droppedActivities,
    },
  };
}

/** Pick a backup JSON file and apply it (merge or overwrite), then re-arm alarms + reminders. */
export async function importBackup(mode: ImportMode): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return { imported: false, mode, blocks: 0 };

  // **Refuse an oversized file before reading a byte of it.** The picker reports the size; if it is missing
  // (some providers omit it) fall back to the filesystem, and only if we still cannot tell do we proceed and
  // trust the cap below. See MAX_BACKUP_BYTES — the point is OOM safety, not thrift.
  let bytes: number | undefined = typeof asset.size === "number" ? asset.size : undefined;
  if (bytes === undefined) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (info.exists && typeof info.size === "number") bytes = info.size;
  }
  if (isBackupTooLarge(bytes)) {
    throw new Error("백업 파일이 너무 커요. 이 앱에서 내보낸 백업 파일이 맞는지 확인해 주세요.");
  }

  const raw = await FileSystem.readAsStringAsync(asset.uri);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("파일을 읽을 수 없어요. 올바른 백업 JSON인지 확인해 주세요.");
  }

  // **The reference apps' own exports get in** (P-d). They are bare JSON arrays — `expense_backup_*.json`
  // from the budget app, `diet_backup_*.json` from the calorie app — and this function used to reject them
  // outright, so the founder's existing spending and meal history had **no path into the app built to
  // replace those apps**. Half of "one integrated day" was unreachable.
  if (Array.isArray(parsed)) {
    return importReference(parsed, mode);
  }

  const backup = parsed as Backup;
  if (!backup || backup.app !== "lifeplanner" || typeof backup.data !== "object" || backup.data == null) {
    throw new Error("이 앱의 백업 파일이 아니에요.");
  }

  // Block ids before import — so an overwrite that drops blocks can cancel their orphaned alarms too.
  const beforeIds = (await listBlocks()).map((b) => b.id);

  // **"덮어쓰기 (전체 교체)" has to actually replace everything.** It only wrote the keys the file happened to
  // contain, so importing an older backup (one with no meals, say) left the device's current meals sitting
  // there — a half-restore wearing the word "전체". Clear every lp.* data key first, then write what the file
  // has. The measurement stores go too: they are part of the snapshot you took.
  if (mode === "overwrite") {
    const present = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("lp."));
    await AsyncStorage.multiRemove(present.filter((k) => k !== "lp.onboarded.v1")); // never re-run onboarding
  }

  for (const [key, incomingRaw] of Object.entries(backup.data)) {
    if (typeof incomingRaw !== "string") continue;
    // **Stay inside our own namespace.** A genuine export only ever contains `lp.*` keys (exportBackup filters on
    // exactly that), so a file carrying anything else is not one of ours — and writing a foreign key would let a
    // crafted "backup" plant values under storage keys that belong to other libraries. The imported data is inert
    // either way (nothing here executes it — there is no eval/Function/network path), but it has no business
    // touching a key the app does not own.
    if (!isImportableKey(key)) continue;
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
  for (const b of afterBlocks) await scheduleBlock(b);

  // **Push the restored rows to the cloud.** An import writes AsyncStorage directly, behind the repositories'
  // backs, so nothing else would ever tell Firestore they exist. They would sit locally until the next
  // snapshot reconciled them up — which is correct but not immediate, and a user who restores a backup and
  // then reinstalls before the next snapshot would lose the restore. Pushing here closes that window.
  // (No-op when logged out, which is the ordinary case for an import.)
  syncPutMany("blocks", afterBlocks);
  syncPutMany("expenses", await listExpenses());
  syncPutMany("meals", await listMeals());

  return { imported: true, mode, blocks: afterBlocks.length };
}

function safeBool(fn: () => boolean): boolean {
  try {
    return !!fn();
  } catch {
    return false;
  }
}
