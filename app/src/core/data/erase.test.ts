// **Leaving** — 회원 탈퇴 and 모든 기록 삭제 (D75).
//
// The 이용약관 (제6조) and 처리방침 (제7조) promise 파기. This is the code that has to keep that promise, and the
// two ways it can quietly fail to are both pinned here:
//
//   · **Order.** Delete the Firebase user first and the security rules stop recognising the owner — the
//     documents become unreachable *and undeletable*, stranded on the server forever while the app tells the
//     user they were destroyed. **Data first, account second.**
//   · **Alarms.** A block can be gone from storage and still fire: the alarm lives in the OS, not in our data.
//     An execution moment for a task that no longer exists — moments after the user asked us to erase
//     everything — is the app failing in the one place it is supposed to be trusted.

const events: string[] = [];
const store: Record<string, string> = {};
const cloud: Record<string, string[]> = {
  blocks: ["b1", "b2"],
  devices: ["d1"],
  expenses: ["e1"],
  meals: [],
  consents: ["2026-07-14"],
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: async (k: string) => {
      delete store[k];
    },
    multiRemove: async (keys: string[]) => {
      events.push("erase-local");
      for (const k of keys) delete store[k];
    },
  },
}));

jest.mock("@/core/notifications/alarm", () => ({
  alarm: {
    getScheduled: () => [{ id: "b1" }, { id: "b2" }],
    cancel: (id: string) => events.push(`cancel:${id}`),
  },
}));

jest.mock("./firebase", () => ({
  currentAccount: () => ({ uid: "uid-1", email: "a@b.c" }),
  deleteCurrentUser: async () => {
    events.push("delete-account");
  },
  db: () => ({
    collection: () => ({
      doc: () => ({
        collection: (name: string) => ({
          get: async () => ({
            docs: (cloud[name] ?? []).map((id) => ({
              ref: {
                delete: async () => {
                  events.push(`cloud-delete:${name}/${id}`);
                },
              },
            })),
          }),
        }),
      }),
    }),
  }),
}));

import { deleteAccount, eraseAllRecords } from "./erase";

const reset = () => {
  events.length = 0;
  store["lp.blocks.v1"] = "[]";
  store["lp.sync.owner.v1"] = "uid-1";
  store["lp.consent.v1"] = "{}";
  store["lp.settings.v1"] = "{}";
};

describe("leaving", () => {
  it("silences the OS before it touches storage — an alarm outlives the row that made it", async () => {
    reset();
    await eraseAllRecords();
    expect(events.indexOf("cancel:b1") < events.indexOf("erase-local")).toBe(true);
    expect(events.indexOf("cancel:b2") < events.indexOf("erase-local")).toBe(true);
  });

  it("모든 기록 삭제, logged in — the server's copy goes too, or the next login brings it all back", async () => {
    reset();
    await eraseAllRecords();
    expect(events.includes("cloud-delete:blocks/b1")).toBe(true);
    expect(events.includes("cloud-delete:expenses/e1")).toBe(true);
    expect(events.includes("cloud-delete:consents/2026-07-14")).toBe(true);
    expect(events.includes("delete-account")).toBe(false); // the account stays: this is not 탈퇴
  });

  it("회원 탈퇴 deletes the DATA FIRST and the ACCOUNT SECOND", async () => {
    reset();
    await deleteAccount(false);
    // Reverse the order and the rules stop recognising the owner mid-wipe: the remaining documents can never
    // be read or deleted by anyone, while the app reports 파기 완료.
    expect(events.indexOf("cloud-delete:blocks/b1") < events.indexOf("delete-account")).toBe(true);
    expect(events.indexOf("cloud-delete:consents/2026-07-14") < events.indexOf("delete-account")).toBe(true);
  });

  it("회원 탈퇴, keeping this phone's records — leaving the service is not giving up what you wrote", async () => {
    reset();
    await deleteAccount(true);

    expect(events.includes("erase-local")).toBe(false);
    expect(store["lp.blocks.v1"]).toBe("[]"); // still here

    // But they must stop belonging to an account that no longer exists: a stale owner mark would make the next
    // login refuse to push, leaving the new account silently empty.
    expect(store["lp.sync.owner.v1"] === undefined).toBe(true);
    expect(store["lp.consent.v1"] === undefined).toBe(true); // the consent died with the account it was given to
  });

  it("회원 탈퇴, wiping the phone too — settings survive, because re-granting permissions is not a punishment", async () => {
    reset();
    await deleteAccount(false);
    expect(events.includes("erase-local")).toBe(true);
    expect(store["lp.blocks.v1"] === undefined).toBe(true);
    expect(store["lp.settings.v1"]).toBe("{}");
  });
});
