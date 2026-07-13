// The merge that runs when a device rejoins the cloud (sync.ts · data-model §6). Every case below is a way
// the founder's data could be silently destroyed or silently resurrected, so each one is nailed down.

// `planReconcile` is pure, but its module pulls in AsyncStorage and Firebase at import time — neither of which
// exists under Jest. Stub them out: the decision logic is what is under test, not the plumbing around it.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => undefined },
}));
jest.mock("./firebase", () => ({
  currentAccount: () => null,
  db: () => null,
  onAccountChanged: () => () => undefined,
}));

import { planReconcile, putPayload, type CloudRow } from "./sync";

interface Row {
  id: string;
  updatedAt: number;
  title?: string;
}

const row = (id: string, updatedAt: number, title = id): Row => ({ id, updatedAt, title });
const tomb = (id: string, deletedAt = 999): CloudRow => ({ id, updatedAt: deletedAt, deletedAt });
const ids = (rows: Row[]) => rows.map((r) => r.id).sort();

describe("planReconcile — rejoining the cloud", () => {
  it("a row the cloud has never seen is pushed up and kept (the actual cutover: made while logged out)", () => {
    const { merged, toPush } = planReconcile<Row>([row("a", 1)], []);
    expect(ids(merged)).toEqual(["a"]);
    expect(ids(toPush)).toEqual(["a"]);
  });

  it("an EMPTY cloud never erases local rows — it has nothing to say, not 'delete everything'", () => {
    const { merged } = planReconcile<Row>([row("a", 1), row("b", 2)], []);
    expect(ids(merged)).toEqual(["a", "b"]);
  });

  it("a row deleted on the OTHER device stays dead — it is not pushed back up, and it leaves local", () => {
    // The bug this exists to prevent: phone B deletes the block, phone A was offline and still holds it. If A
    // pushed its copy up, the tombstone would be overwritten and the deleted workout would come back — and
    // re-arm its alarm.
    const { merged, toPush } = planReconcile<Row>([row("a", 1), row("gone", 5)], [tomb("gone")]);
    expect(ids(merged)).toEqual(["a"]);
    expect(ids(toPush)).toEqual(["a"]); // "gone" is NOT among them
  });

  it("a tombstone wins even when the local copy was edited more recently", () => {
    const { merged, toPush } = planReconcile<Row>([row("gone", 10_000)], [tomb("gone", 1)]);
    expect(merged.length).toBe(0);
    expect(toPush.length).toBe(0);
  });

  it("an edit made offline (newer than the cloud's) wins and is pushed", () => {
    const { merged, toPush } = planReconcile<Row>(
      [row("a", 20, "mine")],
      [{ id: "a", updatedAt: 10, title: "theirs" } as CloudRow],
    );
    expect(merged[0].title).toBe("mine");
    expect(toPush.length).toBe(1);
  });

  it("a stale local row does NOT overwrite a newer cloud row", () => {
    const { merged, toPush } = planReconcile<Row>(
      [row("a", 10, "stale")],
      [{ id: "a", updatedAt: 20, title: "fresh" } as CloudRow],
    );
    expect(merged[0].title).toBe("fresh");
    expect(toPush.length).toBe(0); // nothing to say — the cloud is ahead
  });

  it("a row that exists only in the cloud (made on the other phone) arrives", () => {
    const { merged } = planReconcile<Row>([], [{ id: "b", updatedAt: 3, title: "b" } as CloudRow]);
    expect(ids(merged)).toEqual(["b"]);
  });

  it("the tombstone's deletedAt field never leaks into a local row", () => {
    const { merged } = planReconcile<Row>([], [{ id: "a", updatedAt: 1, deletedAt: null } as CloudRow]);
    expect((merged[0] as unknown as Record<string, unknown>).deletedAt).toBe(undefined);
  });
});

describe("putPayload — a push can never undo a delete", () => {
  // The three-device case that reconcile alone cannot catch (D54):
  //   Mon: A, B, C all hold X.        Tue: B (offline) deletes X — tombstone goes into B's queue.
  //   Wed: A (online) edits X.        Thu: C (offline) edits X — the edit goes into C's queue.
  //   Fri: B reconnects → the tombstone lands. X is dead; A drops it.
  //   Sat: C reconnects → Firestore flushes C's Thursday write UNCONDITIONALLY. It never passes through
  //        reconcile, which only governs what *we* choose to push — this one is already in the pipe.
  // If that write carries deletedAt: null it overwrites the tombstone and the deleted block comes back, alarm
  // and all. With the field simply absent, merge:true leaves the tombstone standing and the late write lands
  // harmlessly on a dead document.
  it("a pushed row NEVER carries deletedAt — a stale queued edit cannot resurrect a tombstoned row", () => {
    const payload = putPayload({ id: "x", updatedAt: 5, title: "gym" } as Row);
    expect("deletedAt" in payload).toBe(false);
  });

  it("even a local row that somehow carries deletedAt is stripped before being pushed", () => {
    const payload = putPayload({ id: "x", updatedAt: 5, deletedAt: null } as unknown as Row);
    expect("deletedAt" in payload).toBe(false);
  });

  it("the row's real fields still go up", () => {
    const payload = putPayload({ id: "x", updatedAt: 5, title: "gym" } as Row);
    expect(payload.id).toBe("x");
    expect(payload.title).toBe("gym");
    expect(payload.updatedAt).toBe(5);
  });
});
