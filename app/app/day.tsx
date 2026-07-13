// 하루 설계 — the day's time-block schedule (PRD R5 · spec §3.2 · D21: tap a calendar date → this).
// Free-form start–end intervals in clock order, plus the **free-slot hint** (H3/H10): the day's real
// empty gaps, tappable to place a block where it can actually happen — so an overloaded day doesn't
// quietly drop the workout. Editing here is plan design; the execution moment itself is unchanged (R7).

import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { listBlocks, blocksOn, addBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { newId } from "@/core/data/id";
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

  const [all, setAll] = useState<TimeBlock[]>([]);

  const load = useCallback(async () => {
    const rows = await listBlocks();
    setAll(rows);
    setBlocks(blocksOn(rows, date));
  }, [date]);

  /**
   * **Copy a day** — the S3 mitigation the docs designed and the build dropped.
   *
   * PRD §4 calls **S3 (does the founder actually make a next-day plan?) the single biggest non-technical
   * risk**: "if it stays ~0, the whole flow fails regardless of quality". The research answered it —
   * essence §3, HMW H1 — with **templates**: make planning something you *pick*, not something you *compose*.
   * None of it was built. The only S3 support in the app was a nudge row that says "go plan tomorrow", which
   * asks for the very effort that is at risk.
   *
   * So: the last day you actually planned becomes tomorrow's starting point, in one tap. Each copied block is
   * an **independent new block** (D37 — there is still no recurrence), planned *now*, so `plannedAt` honestly
   * records when the commitment was made and S3 measures the real habit rather than being gamed by the
   * feature meant to support it.
   */
  const source = useMemo(() => {
    const days = [...new Set(all.map((b) => b.date))].filter((d) => d < date).sort();
    const last = days[days.length - 1];
    return last ? blocksOn(all, last) : [];
  }, [all, date]);

  const copyDay = () => {
    if (source.length === 0) return;
    Alert.alert(
      `${source.length}개를 그대로 가져올까요?`,
      `${source[0].date}의 계획을 이 날에 복사해요. 시간·알림 설정도 함께 와요. 각각 따로 고칠 수 있어요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "가져오기",
          onPress: async () => {
            const now = Date.now();
            await addBlocks(
              source.map((b) => ({
                ...b,
                id: newId("block"),
                date,
                status: "planned" as const,
                failReason: undefined,
                completedAt: undefined,
                // The snapshot is the plan of record, and this plan is being made NOW.
                snapStart: b.start,
                snapEnd: b.end,
                snapTitle: b.title,
                plannedAt: now,
                createdAt: now,
                updatedAt: now,
              }))
            );
            load();
          },
        },
      ]
    );
  };

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
          <View style={{ paddingVertical: 16 }}>
            <Text className="text-grey" style={{ fontSize: 14 }}>
              아직 이 날의 계획이 없어요. 아래에서 하나 놓아볼까요?
            </Text>
            {source.length > 0 && (
              <Pressable
                onPress={copyDay}
                className="bg-brand-soft items-center"
                style={{ borderRadius: 14, paddingVertical: 14, marginTop: 14 }}
              >
                <Text className="text-brand" style={{ fontSize: 14, fontWeight: "700" }}>
                  {source[0].date}의 계획 {source.length}개 그대로 가져오기
                </Text>
                <Text className="text-grey" style={{ fontSize: 12, marginTop: 3 }}>
                  가져온 뒤 하나씩 고칠 수 있어요
                </Text>
              </Pressable>
            )}
          </View>
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
                    isSkipped(b)
                      ? "오늘은 쉼"
                      : b.alert === "execution"
                        ? "실행 알림"
                        : b.alert === "soft"
                          ? "알림"
                          : "알림 없음",
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
