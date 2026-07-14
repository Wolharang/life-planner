// The two import guards, kept honest. They are the file-upload security surface's whole answer:
//   · size — refuse a file too large to read safely, BEFORE reading it (OOM protection). Generous by design:
//     years of real data are a few MB, so the cap only ever catches the pathological file.
//   · namespace — an imported file may write only the app's own `lp.*` keys, never a foreign storage key. The
//     data is inert regardless (no eval/Function/network path exists to execute it), but a crafted "backup"
//     must not be able to plant values under keys the app does not own.

import { isBackupTooLarge, isImportableKey, MAX_BACKUP_BYTES } from "./backupGuards";

describe("backup import guards", () => {
  it("passes an honest multi-MB backup and refuses a pathological one", () => {
    expect(isBackupTooLarge(5 * 1024 * 1024)).toBe(false); // years of rows — must get in
    expect(isBackupTooLarge(MAX_BACKUP_BYTES)).toBe(false); // exactly the cap is allowed
    expect(isBackupTooLarge(MAX_BACKUP_BYTES + 1)).toBe(true); // one byte over is refused
  });

  it("does not block when the size is unknown — we cannot tell, so we do not guess", () => {
    expect(isBackupTooLarge(undefined)).toBe(false);
  });

  it("admits the app's own keys and rejects foreign ones", () => {
    expect(isImportableKey("lp.blocks.v1")).toBe(true);
    expect(isImportableKey("lp.meals.v1")).toBe(true);
    expect(isImportableKey("firebase:authUser")).toBe(false); // a foreign library's key — never touched
    expect(isImportableKey("__proto__")).toBe(false);
    expect(isImportableKey("evil")).toBe(false);
  });
});
