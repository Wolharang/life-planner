// 하루 요약 (PRD R10 · spec §3.5 · D32). The ONE place the two surfaces meet — and they meet as
// **two distinct sections**, never as a merged timeline: "통합 = 하나의 앱 + 하루 단위 연결, 병합이 아니다."
//
// Everything here is **derived on read** (data-model §2.6 `DayAggregate` — no writes, no stored rollup).
// 운동/러닝 O·X comes from success blocks (D22), not from a log entry. No-guilt holds: a miss is taupe
// data (never red), a done is one calm gold mark, and there is no streak or score anywhere (R14).

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { listBlocks, blocksOn, type TimeBlock } from "@/core/data/blockRepository";
import { onSyncApplied } from "@/core/data/sync";
import { listExpenses, type Expense } from "@/core/data/expenseRepository";
import { listMeals, type MealEntry } from "@/core/data/mealRepository";
import { todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { categoryDistribution, dayAggregate, won } from "@/core/logs/aggregate";
import { CATEGORY_COLOR, DAILY_KCAL_TARGET, KCAL_TARGET, MEAL_ICON, MEAL_TYPES } from "@/core/logs/constants";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

function headerLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  const today = todayYmd();
  const rel = date === today ? " · 오늘" : date === shiftYmd(today, -1) ? " · 어제" : "";
  return `${m}월 ${d}일 (${wd})${rel}`;
}

export default function Summary() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date || todayYmd());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);

  const reload = useCallback(() => {
    listBlocks().then(setBlocks);
    listExpenses().then(setExpenses);
    listMeals().then(setMeals);
  }, []);
  useFocusEffect(reload);
  // R2: a change that arrived from the other phone must show up **without** navigating away and back.
  useEffect(() => onSyncApplied(reload), [reload]);


  const agg = dayAggregate(date, blocks, expenses, meals);
  const dayBlocks = blocksOn(blocks, date);
  const dayExpenses = expenses.filter((e) => e.date === date);
  const dayMeals = meals.filter((m) => m.date === date);
  const dist = categoryDistribution(dayExpenses);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3 }}>
          {headerLabel(date)}
        </Text>
        <View className="flex-row" style={{ gap: 10 }}>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, -1))} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, 1))} hitSlop={10}>
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
        {/* ── SECTION 1 — 계획·실행 (the plan surface's side of the day) ─────────────── */}
        <SectionTitle>계획 · 실행</SectionTitle>

        {dayBlocks.length === 0 ? (
          <Text className="text-grey" style={{ fontSize: 13.5, paddingVertical: 12 }}>
            이 날은 계획한 블록이 없어요.
          </Text>
        ) : (
          <>
            <View className="bg-group rounded-card" style={{ padding: 16 }}>
              <View className="flex-row" style={{ gap: 18 }}>
                <Tally label="성공" value={agg.blocksSuccess} tone="gold" />
                <Tally label="실패" value={agg.blocksFail} tone="miss" />
                <Tally label="휴식" value={agg.blocksSkipped} tone="faint" />
                <Tally label="남음" value={agg.blocksPlanned} tone="ink" />
              </View>
              {/* D22 — the workout record IS a success block of that kind */}
              <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 12 }}>
                🏃 운동 {agg.workoutDone ? "O" : "X"} · 👟 러닝 {agg.runDone ? "O" : "X"}
                <Text className="text-faint"> · 블록에서 자동</Text>
              </Text>
            </View>

            <View style={{ marginTop: 10 }}>
              {dayBlocks.map((b) => (
                <View key={b.id} className="flex-row items-center" style={{ paddingVertical: 8 }}>
                  <Text className="text-ink" style={{ fontSize: 13, fontWeight: "700", width: 48 }}>
                    {b.start}
                  </Text>
                  <Text className="text-ink flex-1" style={{ fontSize: 14.5 }} numberOfLines={1}>
                    {b.title}
                  </Text>
                  <StatusBadge status={b.status} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* the two sides are deliberately separated — never one interleaved timeline (D32) */}
        <View style={{ height: 1, backgroundColor: "#F2F4F6", marginTop: 26 }} />

        {/* ── SECTION 2 — 기록 (the log surface's side of the day) ───────────────────── */}
        <SectionTitle>기록</SectionTitle>

        <View className="bg-group rounded-card" style={{ padding: 16 }}>
          <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
            지출
          </Text>
          <Text className="text-ink" style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.6, marginTop: 2 }}>
            {won(agg.expenseTotal)}
          </Text>
          {dist.length > 0 && (
            <View className="flex-row flex-wrap mt-2" style={{ gap: 10 }}>
              {dist.slice(0, 4).map((d) => (
                <View key={d.category} className="flex-row items-center" style={{ gap: 5 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_COLOR[d.category] }} />
                  <Text className="text-ink-soft" style={{ fontSize: 12 }}>
                    {d.category} {won(d.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="bg-group rounded-card mt-2" style={{ padding: 16 }}>
          <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
            칼로리
          </Text>
          <Text className="text-ink" style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.6, marginTop: 2 }}>
            {agg.kcalTotal}
            <Text style={{ fontSize: 14, fontWeight: "700" }}> / {DAILY_KCAL_TARGET}kcal</Text>
          </Text>
          <View style={{ marginTop: 8, gap: 3 }}>
            {MEAL_TYPES.map((m) => (
              <Text key={m} className="text-ink-soft" style={{ fontSize: 12.5 }}>
                {MEAL_ICON[m]} {m} [{agg.kcalByMeal[m]}/{KCAL_TARGET[m]}]
              </Text>
            ))}
          </View>
          {dayMeals.length === 0 && dayExpenses.length === 0 && (
            <Text className="text-faint" style={{ fontSize: 12, marginTop: 8 }}>
              이 날의 기록은 아직 없어요.
            </Text>
          )}
        </View>

        {/* R17 — 계획 대 실제는 자기 화면에서 (하루 요약은 '연결'만, 평가는 별개) */}
        <Pressable
          onPress={() => router.push("/review")}
          className="bg-group rounded-card flex-row items-center justify-between mt-5"
          style={{ paddingHorizontal: 14, paddingVertical: 12 }}
        >
          <Text className="text-ink" style={{ fontSize: 13.5, fontWeight: "700" }}>
            돌아보기 · 계획 대 실제
          </Text>
          <Text className="text-grey" style={{ fontSize: 16, fontWeight: "700" }}>
            ›
          </Text>
        </Pressable>

        <Text className="text-faint" style={{ fontSize: 12, marginTop: 16, lineHeight: 18 }}>
          하루를 한곳에 모으되 섞지는 않아요 — 계획·실행과 그때그때의 기록은 서로 다른 일이니까요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: "gold" | "miss" | "faint" | "ink" }) {
  const color = tone === "gold" ? "#B0862A" : tone === "miss" ? "#8B7E74" : tone === "faint" ? "#B0B8C1" : "#191F28";
  return (
    <View>
      <Text style={{ fontSize: 20, fontWeight: "700", color, letterSpacing: -0.4 }}>{value}</Text>
      <Text className="text-grey" style={{ fontSize: 11.5, marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}

/** done = one calm gold mark · miss = taupe, NEVER red · 휴식 = neutral (R14). */
function StatusBadge({ status }: { status: TimeBlock["status"] }) {
  if (status === "success") {
    return (
      <View className="bg-gold-soft rounded-full px-2.5 py-1">
        <Text className="text-gold" style={{ fontSize: 11, fontWeight: "700" }}>
          성공
        </Text>
      </View>
    );
  }
  if (status === "fail") {
    return (
      <View className="bg-miss-soft rounded-full px-2.5 py-1">
        <Text className="text-miss" style={{ fontSize: 11, fontWeight: "700" }}>
          실패
        </Text>
      </View>
    );
  }
  if (status === "skipped") {
    return (
      <View className="bg-group rounded-full px-2.5 py-1">
        <Text className="text-faint" style={{ fontSize: 11, fontWeight: "600" }}>
          휴식
        </Text>
      </View>
    );
  }
  return (
    <Text className="text-faint" style={{ fontSize: 11 }}>
      계획
    </Text>
  );
}
