// Client-generated record ids (data-model §0): they must be **unique without a server** — two devices
// creating offline must never mint the same id, or Firestore's last-write-wins (D17) would silently
// merge two unrelated records. A wall-clock timestamp alone does NOT satisfy that (same-ms collisions),
// so ids carry random entropy.

/** e.g. `block-lz4k2f-8t1qw9c` — prefix keeps stores greppable, the suffix carries the entropy. */
export function newId(prefix: string): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  return `${prefix}-${t}-${r}`;
}
