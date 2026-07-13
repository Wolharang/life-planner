// 기록 (PRD R8/R9) — the in-the-moment log surface, kept **separate** from plan/execution (D32): nothing
// here appears on home/My Day, and no plan appears here. Two sections behind one segmented control:
// 지출 (budget) and 식사 (calories), ported from the reference apps (reference-apps.md §A/§B).
//
// The 식사 summary shows 운동/러닝 as O/X **derived from that day's TimeBlocks marked success** (D22) —
// there is no separate activity record. That derived line is the only thing the two surfaces share.

import { View, Text, Pressable, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { listExpenses, type Expense } from "@/core/data/expenseRepository";
import { listMeals, type MealEntry } from "@/core/data/mealRepository";
import { listBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { todayYmd } from "@/core/schedule/blockScheduler";
import { byDay, categoryDistribution, expenseTotal, inMonth, mealSummary, monthKey, won } from "@/core/logs/aggregate";
import { CATEGORY_COLOR, CATEGORY_ICON, DAILY_KCAL_TARGET, MEAL_ICON, MEAL_TYPES } from "@/core/logs/constants";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
type Tab = "expense" | "meal";

const dayHeader = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}.${d}. ${WD[new Date(y, m - 1, d).getDay()]}요일`;
};

export default function Logs() {
  const router = useRouter();
  const now = new Date();
  const today = todayYmd();

  const [tab, setTab] = useState<Tab>("expense");
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m = 0-based
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  useFocusEffect(
    useCallback(() => {
      listExpenses().then(setExpenses);
      listMeals().then(setMeals);
      listBlocks().then(setBlocks);
    }, [])
  );

  const month = monthKey(view.y, view.m);
  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const monthExpenses = inMonth(expenses, month);
  const monthMeals = inMonth(meals, month);
  const total = expenseTotal(monthExpenses);
  const dist = categoryDistribution(monthExpenses);
  const summary = mealSummary(meals, today);

  // D22: "did I work out today" is DERIVED from workout/run blocks marked success — never logged here.
  const doneToday = (kind: TimeBlock["kind"]) =>
    blocks.some((b) => b.date === today && b.kind === kind && b.status === "success");

  const sections = (tab === "expense" ? byDay(monthExpenses) : byDay(monthMeals)).map((s) => ({
    title: s.date,
    data: s.items as (Expense | MealEntry)[],
  }));

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* month control */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} className="px-2">
          <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
          {view.y}. {view.m + 1}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10} className="px-2">
          <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
        </Pressable>
      </View>

      {/* 지출 / 식사 */}
      <View className="bg-group flex-row mx-5" style={{ borderRadius: 12, padding: 4 }}>
        {(["expense", "meal"] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 items-center"
              style={{
                borderRadius: 9,
                paddingVertical: 10,
                backgroundColor: on ? "#FFFFFF" : "transparent",
                ...(on
                  ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }
                  : {}),
              }}
            >
              <Text className={on ? "text-ink" : "text-grey"} style={{ fontSize: 14.5, fontWeight: on ? "700" : "500" }}>
                {t === "expense" ? "지출" : "식사"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 104, paddingTop: 4 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          tab === "expense" ? (
            <View className="bg-group rounded-card mt-3" style={{ padding: 16 }}>
              <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
                이번 달 총 지출
              </Text>
              <Text className="text-ink" style={{ fontSize: 27, fontWeight: "800", letterSpacing: -0.7, marginTop: 4 }}>
                {won(total)}
              </Text>
              {dist.length > 0 && (
                <>
                  {/* category distribution bar */}
                  <View className="flex-row overflow-hidden" style={{ height: 8, borderRadius: 4, marginTop: 14 }}>
                    {dist.map((d) => (
                      <View key={d.category} style={{ flex: d.ratio, backgroundColor: CATEGORY_COLOR[d.category] }} />
                    ))}
                  </View>
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
                    {dist.slice(0, 3).map((d) => (
                      <View key={d.category} className="flex-row items-center" style={{ gap: 5 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_COLOR[d.category] }} />
                        <Text className="text-ink-soft" style={{ fontSize: 12 }}>
                          {d.category} {won(d.amount)}
                        </Text>
                      </View>
                    ))}
                    {dist.length > 3 && (
                      <Text className="text-faint" style={{ fontSize: 12 }}>
                        +{dist.length - 3}개 카테고리
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View className="bg-group rounded-card mt-3" style={{ padding: 16 }}>
              <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
                오늘의 기록
              </Text>
              <Text className="text-ink" style={{ fontSize: 27, fontWeight: "800", letterSpacing: -0.7, marginTop: 4 }}>
                {summary.total}
                <Text style={{ fontSize: 15, fontWeight: "700" }}> / {DAILY_KCAL_TARGET}kcal</Text>
              </Text>
              <View style={{ marginTop: 10, gap: 4 }}>
                {MEAL_TYPES.map((m) => {
                  const s = summary.byMeal[m];
                  return (
                    <Text key={m} className="text-ink-soft" style={{ fontSize: 12.5 }} numberOfLines={1}>
                      {MEAL_ICON[m]} {m} [{s.kcal}/{s.target}]
                      {s.names.length > 0 ? ` · ${s.names.join(", ")}` : ""}
                    </Text>
                  );
                })}
                {/* derived from time-blocks (D22) — the workout is never logged here */}
                <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 2 }}>
                  🏃 운동 {doneToday("workout") ? "O" : "X"} · 👟 러닝 {doneToday("run") ? "O" : "X"}
                  <Text className="text-faint"> · 블록에서 자동</Text>
                </Text>
              </View>
            </View>
          )
        }
        renderSectionHeader={({ section }) => {
          const items = section.data;
          const dayTotal =
            tab === "expense"
              ? won(expenseTotal(items as Expense[]))
              : `${(items as MealEntry[]).reduce((s, m) => s + m.kcal, 0)}kcal`;
          return (
            <View className="flex-row items-center justify-between mt-4 mb-1.5 px-1">
              <Text className="text-ink" style={{ fontSize: 13, fontWeight: "800" }}>
                {dayHeader(section.title)}
              </Text>
              <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
                {dayTotal}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) =>
          tab === "expense" ? (
            <ExpenseRow
              e={item as Expense}
              onPress={() => router.push({ pathname: "/add-expense", params: { id: item.id } })}
            />
          ) : (
            <MealRow m={item as MealEntry} onPress={() => router.push({ pathname: "/add-meal", params: { id: item.id } })} />
          )
        }
        ListEmptyComponent={
          <Text className="text-grey text-center mt-16" style={{ fontSize: 14 }}>
            {tab === "expense" ? "이 달의 지출 기록이 없어요." : "이 달의 식사 기록이 없어요."}
          </Text>
        }
      />

      {/* pinned primary action — the whole point is that logging is 2 taps away (S4) */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, paddingHorizontal: 20 }}>
        <Pressable
          onPress={() =>
            tab === "expense"
              ? router.push({ pathname: "/add-expense", params: { date: today } })
              : router.push({ pathname: "/add-meal", params: { date: today } })
          }
          accessibilityRole="button"
          accessibilityLabel={tab === "expense" ? "지출 기록" : "식사 기록"}
          className="bg-brand items-center"
          style={{ borderRadius: 15, paddingVertical: 16, elevation: 4 }}
        >
          <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
            {tab === "expense" ? "＋ 지출" : "＋ 식사"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ExpenseRow({ e, onPress }: { e: Expense; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center" style={{ paddingVertical: 9 }}>
      <View
        className="items-center justify-center"
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${CATEGORY_COLOR[e.category]}1A` }}
      >
        <Text style={{ fontSize: 15 }}>{CATEGORY_ICON[e.category]}</Text>
      </View>
      <View className="flex-1" style={{ marginLeft: 11 }}>
        <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
          {e.name}
        </Text>
        <Text className="text-grey mt-0.5" style={{ fontSize: 12 }} numberOfLines={1}>
          {[e.category, e.store, e.payment].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "700" }}>
        {won(e.amount)}
      </Text>
    </Pressable>
  );
}

function MealRow({ m, onPress }: { m: MealEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center" style={{ paddingVertical: 9 }}>
      <View className="bg-group items-center justify-center" style={{ width: 34, height: 34, borderRadius: 17 }}>
        <Text style={{ fontSize: 15 }}>{MEAL_ICON[m.mealType]}</Text>
      </View>
      <View className="flex-1" style={{ marginLeft: 11 }}>
        <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
          {m.foodName}
        </Text>
        <Text className="text-grey mt-0.5" style={{ fontSize: 12 }} numberOfLines={1}>
          {[m.mealType, m.detail].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "700" }}>
        {m.kcal}kcal
      </Text>
    </Pressable>
  );
}
