// Saved gyms — add, list, remove. Device-local, so a plain AsyncStorage round-trip is the whole contract.

jest.mock("@react-native-async-storage/async-storage", () => {
  const mockStore: Record<string, string> = {};
  return {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => {
      mockStore[k] = v;
    },
    removeItem: async (k: string) => {
      delete mockStore[k];
    },
    clear: async () => {
      for (const k of Object.keys(mockStore)) delete mockStore[k];
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { listGyms, addGym, removeGym } from "./gymRepository";

const gymA = { id: "a", label: "회사 앞 헬스장", lat: 37.5, lng: 127.0 };
const gymB = { id: "b", label: "집 앞 헬스장", lat: 37.6, lng: 127.1 };

describe("gymRepository", () => {
  it("starts empty, adds several, and lists them", async () => {
    await AsyncStorage.clear();
    expect((await listGyms()).length).toBe(0);
    await addGym(gymA);
    const after = await addGym(gymB);
    expect(after.length).toBe(2);
    expect((await listGyms()).map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("re-adding the same id replaces, never duplicates", async () => {
    await AsyncStorage.clear();
    await addGym(gymA);
    const after = await addGym({ ...gymA, label: "이름 바꿈" });
    expect(after.length).toBe(1);
    expect(after[0].label).toBe("이름 바꿈");
  });

  it("removes by id and leaves the rest", async () => {
    await AsyncStorage.clear();
    await addGym(gymA);
    await addGym(gymB);
    const after = await removeGym("a");
    expect(after.map((g) => g.id)).toEqual(["b"]);
  });
});
