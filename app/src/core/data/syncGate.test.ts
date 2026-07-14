// **The consent gate on sync** — holdSync / releaseSync.
//
// Why this needs a test of its own: "Google로 계속하기" is a login for someone who has an account and a *signup*
// for someone who does not, and Firebase only says which afterwards (`isNewUser`). So a Google press on the
// 로그인 tab can create an account with no consent behind it, and the account screen deletes it again.
//
// But sync starts the **instant** auth reports a user. Without a hold, those milliseconds push every local row
// to the uid we are about to delete — and deleting an auth user does **not** delete its documents. We would
// take the account back and leave the data on the server: the exact thing the consent gate exists to prevent.
//
// Both failure modes here are silent, which is why they are pinned down rather than eyeballed:
//   · a hold that is never released → sync is off forever and **the app never says so** (this is how 180
//     imported expenses once sat undelivered while the app reported everything synced);
//   · a hold that releases anyway → the undone account gets the data.

const listeners: ((a: { uid: string } | null) => void)[] = [];

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => undefined },
}));
const mockClosed = new Map<string, "keep" | "wipe">();
const mockEvents: string[] = [];

jest.mock("./firebase", () => ({
  currentAccount: () => null,
  db: () => null, // no Firestore under Jest — `col()` optional-chains to undefined, which is fine here
  onAccountChanged: (cb: (a: { uid: string } | null) => void) => {
    listeners.push(cb);
    return () => undefined;
  },
  accountClosure: async (uid: string) => ({
    closed: mockClosed.has(uid),
    wipeDevices: mockClosed.get(uid) === "wipe",
  }),
  signOut: async () => {
    mockEvents.push("sign-out");
  },
}));

import { startSync, syncEnabled, holdSync, releaseSync, onAccountClosed } from "./sync";

startSync({});

/** Pretend Firebase announced a login (or, with null, a logout). */
const auth = (uid: string | null) => {
  for (const l of listeners) l(uid ? { uid } : null);
};

describe("the consent gate on sync", () => {
  it("an ordinary login turns sync on", () => {
    auth(null);
    auth("user-1");
    expect(syncEnabled()).toBe(true);
    auth(null);
  });

  it("a login made while HELD does not start sync — nothing may reach a uid we have not accepted", () => {
    auth(null);
    holdSync();
    auth("user-new");
    expect(syncEnabled()).toBe(false);
    releaseSync(false);
    auth(null);
  });

  it("releasing a kept login starts sync — the hold must not become a permanent off switch", () => {
    auth(null);
    holdSync();
    auth("user-2");
    expect(syncEnabled()).toBe(false); // still held
    releaseSync(true);
    expect(syncEnabled()).toBe(true); // ...and now it runs, for the uid that was waiting
    auth(null);
  });

  it("releasing an UNDONE signup never syncs to it — the account was deleted, its data must not exist", () => {
    auth(null);
    holdSync();
    auth("user-rejected");
    releaseSync(false);
    expect(syncEnabled()).toBe(false);
    auth(null);
  });

  it("a logout during the hold discards the pending uid — a release cannot resurrect it", () => {
    auth(null);
    holdSync();
    auth("user-3");
    auth(null); // deleteCurrentUser() lands: auth reports no user
    releaseSync(true); // ...and the caller still thought it was keeping the login
    expect(syncEnabled()).toBe(false);
  });

  it("after the gate, logins behave normally again — the hold is not sticky", () => {
    auth(null);
    holdSync();
    auth("user-4");
    releaseSync(false);

    auth(null);
    auth("user-5");
    expect(syncEnabled()).toBe(true);
    auth(null);
    expect(syncEnabled()).toBe(false);
  });

  // ── D76: the other phone, after 회원 탈퇴 ────────────────────────────────────────────────────────────
  //
  // 탈퇴 happens on ONE phone. This one is still logged in, still holding every row, and its ID token stays
  // valid for up to an hour after Firebase deletes the user. Its reconcile's own rule is "a row the cloud has
  // never seen is pushed up" — and after the wipe, the cloud has seen nothing. Left alone it would push the
  // entire deleted account back, under a uid with no user behind it: data nobody can read and nobody can
  // delete. The server refuses those writes; this is the client half — it must not even try.

  it("refuses to sync to an account that was closed on another device", async () => {
    auth(null);
    mockClosed.set("gone-1", "keep");
    mockEvents.length = 0;

    auth("gone-1");
    await new Promise((r) => setTimeout(r, 0)); // the closed-check is one server read away

    expect(syncEnabled()).toBe(false);
    expect(mockEvents.includes("sign-out")).toBe(true); // staying "logged in" to a deleted account is a fiction
    mockClosed.delete("gone-1");
    auth(null);
  });

  it("tells the user — a phone that silently logs itself out is a phone they assume is broken", async () => {
    auth(null);
    mockClosed.set("gone-2", "keep");
    let told = false;
    onAccountClosed(() => {
      told = true;
    });

    auth("gone-2");
    await new Promise((r) => setTimeout(r, 0));

    expect(told).toBe(true);
    mockClosed.delete("gone-2");
    auth(null);
  });

  it("carries the wipe choice to the other phones — it was a decision about the ACCOUNT", async () => {
    // "기기 기록도 함께 지우기" is chosen on one handset, but it is a decision about the account. If the
    // tombstone did not carry it, "모든 기기에서 지웠다" would quietly mean "지운 폰에서만 지웠다".
    auth(null);
    mockClosed.set("gone-3", "wipe");
    let wipeAsked: boolean | null = null as boolean | null;
    onAccountClosed((wipe) => {
      wipeAsked = wipe;
    });

    auth("gone-3");
    await new Promise((r) => setTimeout(r, 0));

    expect(wipeAsked).toBe(true);
    expect(syncEnabled()).toBe(false);
    mockClosed.delete("gone-3");
    auth(null);
  });

  it("...and does not wipe the other phones when the user chose to keep them", async () => {
    auth(null);
    mockClosed.set("gone-4", "keep");
    let wipeAsked: boolean | null = null as boolean | null;
    onAccountClosed((wipe) => {
      wipeAsked = wipe;
    });

    auth("gone-4");
    await new Promise((r) => setTimeout(r, 0));

    expect(wipeAsked).toBe(false); // leaving the service is not giving up what you wrote — on any phone
    mockClosed.delete("gone-4");
    auth(null);
  });

  it("a LIVE account is untouched by the check", async () => {
    auth(null);
    auth("alive");
    await new Promise((r) => setTimeout(r, 0));
    expect(syncEnabled()).toBe(true);
    auth(null);
  });
});
