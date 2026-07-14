// Consent as **evidence** (D74) — what it must still be able to prove, later.
//
// The record has to answer three questions we cannot answer from anywhere else: *what* was agreed to (which
// version of which words), *when* — per item, to the second, because the four ticks are four separate acts —
// and *on which phone*. It also has to survive being asked from a second device, which is why it goes to the
// server with the account rather than staying in AsyncStorage.

const store: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
  },
}));
jest.mock("./firebase", () => ({ db: () => null })); // no Firestore under Jest — the local half is what is tested
jest.mock("./deviceRepository", () => ({
  selfDeviceId: async () => "dev-abc",
  listDevices: async () => [{ id: "dev-abc", label: "갤럭시 A56" }],
}));

import {
  CONSENT_ITEMS,
  consentComplete,
  getConsent,
  recordConsent,
  type ConsentRecord,
} from "./consentRepository";
import { LEGAL_VERSION } from "@/content/legal";

describe("consent as evidence", () => {
  it("asks for exactly four things — the age, then the three documents", () => {
    expect(CONSENT_ITEMS).toEqual(["age", "terms", "privacy", "location"]);
  });

  it("keeps each tick's OWN second — four acts, four times", async () => {
    // The founder asked for the time of each button, not one timestamp stamped over all four at submit.
    const ticks = { age: 1_000, terms: 2_000, privacy: 3_500, location: 9_999 };
    await recordConsent(ticks, "uid-1");

    const saved = (await getConsent()) as ConsentRecord;
    expect(saved.agreedAt).toEqual(ticks);
  });

  it("records the phone it was given on, and the version of the words that were shown", async () => {
    await recordConsent({ age: 1, terms: 1, privacy: 1, location: 1 }, "uid-1");

    const saved = (await getConsent()) as ConsentRecord;
    expect(saved.deviceId).toBe("dev-abc");
    expect(saved.deviceLabel).toBe("갤럭시 A56");
    expect(saved.version).toBe(LEGAL_VERSION);
    expect(saved.id).toBe(LEGAL_VERSION); // one document per version — the server rule keys on it
    expect(saved.uid).toBe("uid-1");
  });

  it("is not complete while any one of the four is missing", () => {
    const base = { id: LEGAL_VERSION, version: LEGAL_VERSION, recordedAt: 0, deviceId: "d", deviceLabel: "d" };
    expect(consentComplete({ ...base, agreedAt: { age: 1, terms: 1, privacy: 1, location: 1 } })).toBe(true);
    expect(consentComplete({ ...base, agreedAt: { age: 1, terms: 1, privacy: 1 } })).toBe(false);
    expect(consentComplete(null)).toBe(false);
  });

  it("is not complete when it was given against OLDER words — that is what re-asks the user", () => {
    const stale: ConsentRecord = {
      id: "2020-01-01",
      version: "2020-01-01",
      agreedAt: { age: 1, terms: 1, privacy: 1, location: 1 },
      recordedAt: 0,
      deviceId: "d",
      deviceLabel: "d",
    };
    // Every box is ticked, and it still does not count: they agreed to a document we no longer ship.
    expect(consentComplete(stale)).toBe(false);
  });
});
