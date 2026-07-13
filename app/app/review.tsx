// 돌아보기 — 계획 대 실제 (PRD R17 · spec §3.6 · D5/D23/D29). The LATER phase, built last on purpose.
//
// What the docs allow, and nothing more:
//  · **Binary success/fail + a free-text reason** (D5). No score, no rate-as-a-target, **no quantitative
//    plan-vs-actual comparison** (D29: "계획 60분 vs 실제 90분" is explicitly NOT built).
//  · **The app never suggests a fix** (D5) — it collects the reasons in one place and the user adjusts.
//  · Evaluation reads the **D-1 snapshot** (D23): a plan edited on the day is judged against what was
//    promised the night before, not against the edit.
//  · **No guilt** (B1/R14): a miss is taupe data, the reason is optional everywhere, and a month with
//    misses is presented as information — never as failure, and never as a streak.

import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { listBlocks, updateBlock, type TimeBlock } from "@/core/data/blockRepository";
import { recordOutcome } from "@/core/data/outcomeRepository";
import { blockStartAt, todayYmd } from "@/core/schedule/blockScheduler";
import { inMonth, monthKey } from "@/core/logs/aggregate";

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayLabel = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}.${d}`;
};

export default function Review() {
  const router = useRouter();
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => setBlocks(await listBlocks()), []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const month = monthKey(view.y, view.m);
  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const monthBlocks = inMonth(blocks, month);
  const success = monthBlocks.filter((b) => b.status === "success");
  const fail = monthBlocks.filter((b) => b.status === "fail");
  const skipped = monthBlocks.filter((b) => b.status === "skipped");
  // D23 — what was actually promised the night before (the plan of record), vs everything planned at all.
  const preCommitted = monthBlocks.filter((b) => ymdOf(b.plannedAt) < b.date);

  // Past blocks still unresolved → markable here (R17 acceptance: "markable success/fail with a reason").
  const today = todayYmd();
  const pending = monthBlocks
    .filter((b) => b.status === "planned" && (b.date < today || blockStartAt(b) <= Date.now()))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const mark = async (b: TimeBlock, status: "success" | "fail") => {
    const at = Date.now();
    await recordOutcome({
      taskId: b.id,
      title: b.title,
      date: b.date,
      status: status === "success" ? "done" : "miss",
      source: "catch-up", // not the execution moment → S1 keeps counting only the lever's own proof
      at,
    });
    await updateBlock({
      ...b,
      status,
      completedAt: status === "success" ? at : undefined,
      updatedAt: at,
    });
    if (status === "fail") {
      setEditing(b.id); // offer the reason right away — but it stays optional
      setDraft("");
    }
    load();
  };

  const saveReason = async (b: TimeBlock) => {
    const text = draft.trim();
    if (text) await updateBlock({ ...b, failReason: text, updatedAt: Date.now() });
    setEditing(null);
    setDraft("");
    load();
  };

  const clearReason = async (b: TimeBlock) => {
    await updateBlock({ ...b, failReason: undefined, updatedAt: Date.now() });
    setEditing(null);
    setDraft("");
    load();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3 }}>
          돌아보기
        </Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Text className="text-ink-soft" style={{ fontSize: 13, fontWeight: "700" }}>
            {view.m + 1}월
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
        {/* month rollup — executed vs planned. Counts, not a score (D29). */}
        <View className="bg-group rounded-card" style={{ padding: 16 }}>
          <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
            이 달의 계획 대 실제
          </Text>
          <View className="flex-row mt-3" style={{ gap: 20 }}>
            <Tally label="해냄" value={success.length} color="#B0862A" />
            <Tally label="미스" value={fail.length} color="#8B7E74" />
            <Tally label="쉼" value={skipped.length} color="#B0B8C1" />
            <Tally label="계획" value={monthBlocks.length} color="#191F28" />
          </View>
          <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 18 }}>
            그중 <Text style={{ fontWeight: "700" }}>{preCommitted.length}개</Text>는 전날 미리 정해둔
            것이었어요 (평가 기준 = 그때의 계획, D-1).
          </Text>
        </View>

        {/* still open — markable, so nothing quietly rots as "planned" forever */}
        {pending.length > 0 && (
          <>
            <SectionTitle>아직 안 남긴 것</SectionTitle>
            {pending.map((b) => (
              <View key={b.id} className="flex-row items-center" style={{ paddingVertical: 9 }}>
                <Text className="text-grey" style={{ fontSize: 12, width: 38 }}>
                  {dayLabel(b.date)}
                </Text>
                <Text className="text-ink flex-1" style={{ fontSize: 14.5 }} numberOfLines={1}>
                  {b.title}
                </Text>
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => mark(b, "success")}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    className="bg-gold-soft rounded-full px-3 py-1"
                  >
                    <Text className="text-gold" style={{ fontSize: 11.5, fontWeight: "700" }}>
                      해냄
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => mark(b, "fail")}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    className="bg-group rounded-full px-3 py-1"
                  >
                    <Text className="text-ink-soft" style={{ fontSize: 11.5 }}>
                      미스
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* the point of the whole screen: the reasons, gathered in one place (D5) */}
        <SectionTitle>못 한 이유들</SectionTitle>
        {fail.length === 0 ? (
          <Text className="text-grey" style={{ fontSize: 13.5, paddingVertical: 10 }}>
            이 달엔 미스가 없어요.
          </Text>
        ) : (
          fail.map((b) => (
            <View key={b.id} className="bg-group rounded-card mb-2" style={{ padding: 13 }}>
              <View className="flex-row items-center">
                <Text className="text-grey" style={{ fontSize: 12, width: 38 }}>
                  {dayLabel(b.date)}
                </Text>
                <Text className="text-ink flex-1" style={{ fontSize: 14.5, fontWeight: "700" }} numberOfLines={1}>
                  {b.title}
                </Text>
                <Pressable
                  onPress={() => {
                    setEditing(editing === b.id ? null : b.id);
                    setDraft(b.failReason ?? "");
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Text className="text-brand" style={{ fontSize: 12, fontWeight: "700" }}>
                    {b.failReason ? "고치기" : "사유 남기기"}
                  </Text>
                </Pressable>
              </View>

              {editing === b.id ? (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="예: 야근, 너무 피곤함 (안 써도 괜찮아요)"
                    placeholderTextColor="#B0B8C1"
                    autoFocus
                    className="bg-surface text-ink mt-2.5"
                    style={{ fontSize: 14, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                  />
                  <View className="flex-row items-center mt-2" style={{ gap: 14 }}>
                    <Pressable onPress={() => saveReason(b)} className="bg-brand rounded-full px-4 py-1.5">
                      <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
                        저장
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setEditing(null)} className="px-2 py-1.5">
                      <Text className="text-faint" style={{ fontSize: 12 }}>
                        그냥 닫기
                      </Text>
                    </Pressable>
                    {b.failReason && (
                      <Pressable onPress={() => clearReason(b)} className="px-2 py-1.5">
                        <Text className="text-faint" style={{ fontSize: 12 }}>
                          지우기
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : (
                <Text className={b.failReason ? "text-ink-soft" : "text-faint"} style={{ fontSize: 13, marginTop: 6, marginLeft: 38 }}>
                  {b.failReason ?? "사유 없음"}
                </Text>
              )}
            </View>
          ))
        )}

        <Text className="text-faint" style={{ fontSize: 12, marginTop: 18, lineHeight: 18 }}>
          앱은 계획을 대신 고쳐주지 않아요. 이유를 모아둘 뿐이고, 다음 계획은 내가 정해요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-ink" style={{ fontSize: 15, fontWeight: "800", marginTop: 22, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <Text style={{ fontSize: 21, fontWeight: "800", color, letterSpacing: -0.4 }}>{value}</Text>
      <Text className="text-grey" style={{ fontSize: 11.5, marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}
