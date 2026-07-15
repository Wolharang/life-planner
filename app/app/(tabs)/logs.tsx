// 기록 (PRD R8/R9) — the in-the-moment log surface, kept **separate** from plan/execution (D32): nothing
// here appears on home/My Day, and no plan appears here. Two sections behind one segmented control:
// 지출 (budget) and 식사 (calories), ported from the reference apps (reference-apps.md §A/§B).
//
// The 식사 summary shows 운동/러닝 as O/X **derived from that day's TimeBlocks marked success** (D22) —
// there is no separate activity record. That derived line is the only thing the two surfaces share.

import { View, Text, Pressable, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { listExpenses, type Expense } from "@/core/data/expenseRepository";
import { listMeals, type MealEntry } from "@/core/data/mealRepository";
import { listBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { onSyncApplied } from "@/core/data/sync";
import { todayYmd } from "@/core/schedule/blockScheduler";
import { byDay, categoryDistribution, dayAggregate, expenseTotal, inMonth, mealSummary, monthKey, won } from "@/core/logs/aggregate";
import { CATEGORY_COLOR, DAILY_KCAL_TARGET, MEAL_COLOR, MEAL_TYPES } from "@/core/logs/constants";
import { CategoryIcon, MealIcon } from "@/ui/icons/LogIcons";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
type Tab = "expense" | "meal";
const pad = (n: number) => String(n).padStart(2, "0");

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
  // A day the user tapped. null = the default view: 지출 shows the whole month, 식사 shows today.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [catsExpanded, setCatsExpanded] = useState(false); // 지출 카테고리 전체 펼침
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  const reload = useCallback(() => {
    listExpenses().then(setExpenses);
    listMeals().then(setMeals);
    listBlocks().then(setBlocks);
  }, []);
  // Returning to the 기록 tab resets to the default view (month total / today), per the founder.
  useFocusEffect(
    useCallback(() => {
      setSelectedDay(null);
      reload();
    }, [reload]),
  );
  // R2: a change that arrived from the other phone must show up **without** navigating away and back.
  useEffect(() => onSyncApplied(reload), [reload]);


  const month = monthKey(view.y, view.m);
  const isCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const firstOfMonth = `${view.y}-${pad(view.m + 1)}-01`;
  const resetView = (y: number, m: number) => {
    setView({ y, m });
    setSelectedDay(null);
    setCatsExpanded(false);
  };
  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    resetView(d.getFullYear(), d.getMonth());
  };
  const goToday = () => resetView(now.getFullYear(), now.getMonth());

  const monthExpenses = inMonth(expenses, month);
  const monthMeals = inMonth(meals, month);

  // 식사 summary follows the tapped day; default is today (current month) or the shown month's 1st.
  const mealDay = selectedDay ?? (isCurrentMonth ? today : firstOfMonth);
  const summary = mealSummary(meals, mealDay);
  const [, mM, mD] = mealDay.split("-").map(Number);
  const mealSummaryLabel = mealDay === today ? "오늘의 기록" : `${mM}월 ${mD}일 기록`;
  const dayAgg = dayAggregate(mealDay, blocks, expenses, meals); // D22: 운동/러닝 derived for that day

  // 지출 summary: a tapped day shows that day's expenses; otherwise the whole month.
  const showExpenseDay = selectedDay != null;
  const expenseSource = showExpenseDay ? expenses.filter((e) => e.date === selectedDay) : monthExpenses;
  const total = expenseTotal(expenseSource);
  const dist = categoryDistribution(expenseSource);
  const [, eM, eD] = (selectedDay ?? today).split("-").map(Number);
  const expenseLabel = showExpenseDay
    ? `${eM}월 ${eD}일 지출`
    : isCurrentMonth
      ? "이번 달 총 지출"
      : `${view.m + 1}월 총 지출`;

  const sections = (tab === "expense" ? byDay(monthExpenses) : byDay(monthMeals)).map((s) => ({
    title: s.date,
    data: s.items as (Expense | MealEntry)[],
  }));

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* month control */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} className="px-1">
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3 }}>
            {view.y}. {view.m + 1}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} className="px-1">
            <Text className="text-grey" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>
        {!(isCurrentMonth && selectedDay == null) && (
          <Pressable onPress={goToday} className="bg-group rounded-full px-3 py-1.5" hitSlop={8}>
            <Text className="text-ink-soft" style={{ fontSize: 12, fontWeight: "700" }}>
              오늘
            </Text>
          </Pressable>
        )}
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
                {expenseLabel}
              </Text>
              <Text className="text-ink" style={{ fontSize: 27, fontWeight: "700", letterSpacing: -0.7, marginTop: 4 }}>
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
                  {/* legend — tap "+N개 카테고리" to reveal every category's amount, "접기" to collapse */}
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
                    {(catsExpanded ? dist : dist.slice(0, 3)).map((d) => (
                      <View key={d.category} className="flex-row items-center" style={{ gap: 5 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_COLOR[d.category] }} />
                        <Text className="text-ink-soft" style={{ fontSize: 12 }}>
                          {d.category} {won(d.amount)}
                        </Text>
                      </View>
                    ))}
                    {dist.length > 3 && (
                      <Pressable onPress={() => setCatsExpanded((v) => !v)} hitSlop={6}>
                        <Text className="text-faint" style={{ fontSize: 12 }}>
                          {catsExpanded ? "접기" : `+${dist.length - 3}개 카테고리`}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View className="bg-group rounded-card mt-3" style={{ padding: 16 }}>
              <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
                {mealSummaryLabel}
              </Text>
              <Text className="text-ink" style={{ fontSize: 27, fontWeight: "700", letterSpacing: -0.7, marginTop: 4 }}>
                {summary.total}
                <Text style={{ fontSize: 15, fontWeight: "700" }}> / {DAILY_KCAL_TARGET}kcal</Text>
              </Text>
              <View style={{ marginTop: 10, gap: 4 }}>
                {MEAL_TYPES.map((m) => {
                  const s = summary.byMeal[m];
                  return (
                    <View key={m} className="flex-row items-center" style={{ gap: 4 }}>
                      <MealIcon meal={m} size={14} color={MEAL_COLOR[m]} />
                      <Text className="text-ink-soft flex-1" style={{ fontSize: 12.5 }} numberOfLines={1}>
                        {m} [{s.kcal}/{s.target}]
                        {s.names.length > 0 ? ` · ${s.names.join(", ")}` : ""}
                      </Text>
                    </View>
                  );
                })}
                {/* derived from time-blocks (D22) — the workout is never logged here */}
                <Text className="text-ink-soft" style={{ fontSize: 12.5, marginTop: 2 }}>
                  🏃 운동 {dayAgg.workoutDone ? "O" : "X"} · 👟 러닝 {dayAgg.runDone ? "O" : "X"}
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
          // Tapping a day makes the summary card show THAT day (지출: that day's total · 식사: that day's kcal).
          // The selected day is marked by **bold**, not colour.
          const isSel = section.title === (tab === "meal" ? mealDay : selectedDay);
          return (
            <Pressable
              onPress={() => setSelectedDay(section.title)}
              className="flex-row items-center justify-between mt-4 mb-1.5 px-1"
            >
              <Text style={{ fontSize: 13, fontWeight: isSel ? "800" : "600", color: "#191F28" }}>
                {dayHeader(section.title)}
              </Text>
              <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600" }}>
                {dayTotal}
              </Text>
            </Pressable>
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
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${CATEGORY_COLOR[e.category]}2E` }}
      >
        <CategoryIcon category={e.category} size={19} color={CATEGORY_COLOR[e.category]} />
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
      <View
        className="items-center justify-center"
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${MEAL_COLOR[m.mealType]}2E` }}
      >
        <MealIcon meal={m.mealType} size={19} color={MEAL_COLOR[m.mealType]} />
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
