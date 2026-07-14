// The outcome upsert, guarded — with the GPS-verdict ("location") rules that the auto-eval feature relies on.
// The load-bearing property: a workout the GPS judged must be recorded as an outcome (so the R6 catch-up net
// sees it resolved and never auto-archives it as a miss), it supersedes a self-report, and a later catch-up can
// never overwrite it.

jest.mock("@react-native-async-storage/async-storage", () => {
  const mockStore: Record<string, string> = {};
  return {
    getItem: async (k: string) => mockStore[k] ?? null,
    setItem: async (k: string, v: string) => {
      mockStore[k] = v;
    },
    clear: async () => {
      for (const k of Object.keys(mockStore)) delete mockStore[k];
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordOutcome, listOutcomes } from "./outcomeRepository";

const at = 1_700_000_000_000;

describe("recordOutcome — the GPS verdict rules", () => {
  it("is one outcome per occurrence, keyed by taskId|date", async () => {
    await AsyncStorage.clear();
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "done", source: "location", at });
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "miss", source: "location", at: at + 1 });
    const outs = await listOutcomes();
    expect(outs.length).toBe(1);
    expect(outs[0].status).toBe("miss");
  });

  it("a GPS verdict overrides a self-report at the re-check", async () => {
    await AsyncStorage.clear();
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "done", source: "execution-screen", at });
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "miss", source: "location", at: at + 1 });
    const outs = await listOutcomes();
    expect(outs[0].status).toBe("miss");
    expect(outs[0].source).toBe("location");
  });

  it("a later catch-up can NEVER overwrite a GPS verdict", async () => {
    await AsyncStorage.clear();
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "done", source: "location", at });
    await recordOutcome({ taskId: "b1", date: "2026-07-14", status: "miss", source: "catch-up", at: at + 1 });
    const outs = await listOutcomes();
    expect(outs[0].status).toBe("done"); // the GPS 성공 survives the catch-up
    expect(outs[0].source).toBe("location");
  });
});
