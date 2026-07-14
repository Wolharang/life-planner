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
jest.mock("./firebase", () => ({
  currentAccount: () => null,
  db: () => null, // no Firestore under Jest — `col()` optional-chains to undefined, which is fine here
  onAccountChanged: (cb: (a: { uid: string } | null) => void) => {
    listeners.push(cb);
    return () => undefined;
  },
}));

import { startSync, syncEnabled, holdSync, releaseSync } from "./sync";

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
});
