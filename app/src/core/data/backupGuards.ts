// The import guards, in a leaf module — no AsyncStorage, no native alarm, nothing heavy — so they can be tested
// on their own. They are the whole security answer for the "파일 업로드/저장소" surface:
//   · size — refuse a file too large to read safely, before reading it (OOM protection);
//   · namespace — an imported file may write only the app's own `lp.*` keys, never a foreign storage key.

/**
 * A ceiling on the file we will read into memory. **Deliberately generous**: an honest backup of *years* of daily
 * rows is only a few MB (a block/expense/meal is a few hundred bytes), so 100 MB is far above any real dataset —
 * it never stands between a heavy user and their own history. Its only job is to stop the pathological file: one
 * picked by mistake, or crafted to be enormous, that `readAsStringAsync` + `JSON.parse` would balloon several-fold
 * and OOM the app **before** any of our validation could run.
 */
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** True when the reported file size is over the cap. Undefined size → we cannot tell, so we do not block. */
export function isBackupTooLarge(bytes: number | undefined): boolean {
  return bytes !== undefined && bytes > MAX_BACKUP_BYTES;
}

/**
 * Only the app's own namespace may be written on import. A genuine export contains only `lp.*` keys, so a file
 * carrying anything else is not one of ours — and writing a foreign key would let a crafted "backup" plant values
 * under storage keys that belong to other libraries. The imported data is inert regardless (nothing here executes
 * it — there is no eval/Function/network path), but it has no business touching a key the app does not own.
 */
export function isImportableKey(key: string): boolean {
  return key.startsWith("lp.");
}
