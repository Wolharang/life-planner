// 하루 설계 — the day's time-block schedule (PRD R5 · spec §3.2 · D21: tap a calendar date → this).
// Free-form start–end intervals in clock order, plus the **free-slot hint** (H3/H10): the day's real
// empty gaps, tappable to place a block where it can actually happen — so an overloaded day doesn't
// quietly drop the workout. Editing here is plan design; the execution moment itself is unchanged (R7).

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { listBlocks, blocksOn, type TimeBlock } from "@/core/data/blockRepository";
import { freeSlots, isExecution, isSkipped, todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const KIND_LABEL: Record<TimeBlock["kind"], string> = { normal: "", workout: "운동", run: "러닝" };

function headerLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  const today = todayYmd();
  const rel = date === today ? " · 오늘" : date === shiftYmd(today, 1) ? " · 내일" : "";
  return `${m}월 ${d}일 (${wd})${rel}`;
}

export default function DayPlan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date || todayYmd());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  const load = useCallback(async () => {
    setBlocks(blocksOn(await listBlocks(), date));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const slots = freeSlots(blocks);
  const add = (start?: string, end?: string) =>
    router.push({ pathname: "/add-block", params: { date, ...(start ? { start } : {}), ...(end ? { end } : {}) } });

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
          {headerLabel(date)}
        </Text>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, -1))} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, 1))} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
          {/* R10 lives on its own screen — this surface stays plan/execution only (D32) */}
          <Pressable
            onPress={() => router.push({ pathname: "/summary", params: { date } })}
            className="bg-group rounded-full px-3 py-1.5"
            hitSlop={8}
          >
            <Text className="text-ink-soft" style={{ fontSize: 12, fontWeight: "700" }}>
              요약
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 110 }}>
        {blocks.length === 0 ? (
          <Text className="text-grey" style={{ fontSize: 14, paddingVertical: 20 }}>
            아직 이 날의 계획이 없어요. 아래에서 하나 놓아볼까요?
          </Text>
        ) : (
          blocks.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: "/add-block", params: { id: b.id } })}
              className="bg-group rounded-card flex-row items-center mb-2"
              style={{ padding: 14, opacity: isSkipped(b) ? 0.55 : 1 }}
            >
              <View style={{ width: 62 }}>
                <Text className="text-ink" style={{ fontSize: 15, fontWeight: "800", letterSpacing: -0.2 }}>
                  {b.start}
                </Text>
                {b.end && (
                  <Text className="text-grey" style={{ fontSize: 12, marginTop: 1 }}>
                    {b.end}
                  </Text>
                )}
              </View>
              <View className="flex-1 pr-2">
                <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>
                  {b.title}
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
                  {[
                    KIND_LABEL[b.kind],
                    b.location,
                    isSkipped(b) ? "오늘은 쉼" : b.alert === "execution" ? "실행 알림" : "알림",
                    b.status === "success" ? "해냄" : b.status === "fail" ? "미스" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "계획"}
                </Text>
              </View>
              {isExecution(b) && (
                <View className="bg-brand-soft rounded-full px-2.5 py-1">
                  <Text className="text-brand" style={{ fontSize: 11, fontWeight: "700" }}>
                    실행
                  </Text>
                </View>
              )}
            </Pressable>
          ))
        )}

        {/* free-slot hint — the day's real empty gaps (H3/H10) */}
        {slots.length > 0 && (
          <>
            <Text className="text-ink mt-6 mb-2 px-1" style={{ fontSize: 14, fontWeight: "800" }}>
              비어 있는 시간
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {slots.map((s) => (
                <Pressable
                  key={`${s.start}-${s.end}`}
                  onPress={() => add(s.start, s.end)}
                  className="bg-brand-soft"
                  style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}
                >
                  <Text className="text-brand" style={{ fontSize: 13, fontWeight: "700" }}>
                    {s.start}–{s.end}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-grey mt-2 px-1" style={{ fontSize: 12.5 }}>
              진짜로 비어 있는 시간이에요. 운동은 여기에 놓으면 실제로 하게 돼요.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, paddingHorizontal: 20 }}>
        <Pressable
          onPress={() => add()}
          accessibilityRole="button"
          accessibilityLabel="블록 추가"
          className="bg-brand items-center"
          style={{ borderRadius: 15, paddingVertical: 16, elevation: 4 }}
        >
          <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
            ＋ 블록 추가
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
