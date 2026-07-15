// 순서 바꾸기 (D92) — reached by long-pressing a row in 기록. Shows one day's 지출 or 식사 rows and lets you
// **drag by the ≡ handle** to reorder them. The order is stamped as `sortIndex` and mirrored to the other
// phones (reorderExpenses / reorderMeals → syncPut). Drag is done with PanResponder — the same primitive the
// calendar resize uses — so no native gesture library (and no prebuild) is needed.

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, PanResponder, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { listExpenses, reorderExpenses, type Expense } from "@/core/data/expenseRepository";
import { listMeals, reorderMeals, type MealEntry } from "@/core/data/mealRepository";
import { won } from "@/core/logs/aggregate";
import { CATEGORY_COLOR, MEAL_COLOR } from "@/core/logs/constants";
import { CategoryIcon, MealIcon } from "@/ui/icons/LogIcons";

const ROW_H = 66;
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type Row = Expense | MealEntry;
// Same order the list uses (aggregate.withinDay): unarranged rows float to the top by timestamp, arranged rows
// keep their manual order below.
const within = (a: Row, b: Row) => {
  const ai = a.sortIndex,
    bi = b.sortIndex;
  if (ai == null && bi == null) return b.timestamp - a.timestamp;
  if (ai == null) return -1;
  if (bi == null) return 1;
  return ai - bi;
};

function title(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 ${wd}요일`;
}

export default function ReorderLogs() {
  const router = useRouter();
  const { tab, date } = useLocalSearchParams<{ tab: "expense" | "meal"; date: string }>();
  const isExpense = tab !== "meal";

  const [list, setList] = useState<Row[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const all: Row[] = isExpense ? await listExpenses() : await listMeals();
      setList(all.filter((r) => r.date === date).sort(within));
    })();
  }, [date, isExpense]);

  const from = dragId ? list.findIndex((r) => r.id === dragId) : -1;

  const commit = (fromIdx: number) => {
    const to = hoverRef.current;
    if (to != null && to !== fromIdx) {
      const next = list.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(to, 0, moved);
      setList(next);
      const ids = next.map((r) => r.id);
      if (isExpense) reorderExpenses(ids);
      else reorderMeals(ids);
    }
    setDragId(null);
    setHover(null);
    hoverRef.current = null;
    dragY.setValue(0);
  };

  // One PanResponder per row, rebuilt only when the committed order changes (never mid-drag), so the active
  // gesture's handlers stay alive across the hover re-renders.
  const panders = useMemo(
    () =>
      list.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            setDragId(list[index].id);
            setHover(index);
            hoverRef.current = index;
            dragY.setValue(0);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          },
          onPanResponderMove: (_e, g) => {
            dragY.setValue(g.dy);
            const hi = clamp(index + Math.round(g.dy / ROW_H), 0, list.length - 1);
            if (hi !== hoverRef.current) {
              hoverRef.current = hi;
              setHover(hi);
              Haptics.selectionAsync().catch(() => {});
            }
          },
          onPanResponderRelease: () => commit(index),
          onPanResponderTerminate: () => commit(index),
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list],
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <View>
          <Text className="text-ink" style={{ fontSize: 20, fontWeight: "800" }}>
            순서 바꾸기
          </Text>
          <Text className="text-grey" style={{ fontSize: 13, marginTop: 2 }}>
            {title(String(date))} · {isExpense ? "지출" : "식사"}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} className="bg-group rounded-full px-4 py-2">
          <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
            완료
          </Text>
        </Pressable>
      </View>

      {list.length <= 1 ? (
        <Text className="text-grey text-center" style={{ marginTop: 40, fontSize: 14 }}>
          이 날은 바꿀 순서가 없어요.
        </Text>
      ) : (
        <>
          <Text className="text-faint" style={{ paddingHorizontal: 20, fontSize: 12.5, marginBottom: 6 }}>
            오른쪽 ≡ 손잡이를 눌러 위아래로 끌어요.
          </Text>
          <ScrollView scrollEnabled={dragId == null} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
            {list.map((item, i) => {
              const dragging = item.id === dragId;
              let shift = 0;
              if (dragId && !dragging && from >= 0 && hover != null) {
                if (hover > from && i > from && i <= hover) shift = -ROW_H;
                else if (hover < from && i >= hover && i < from) shift = ROW_H;
              }
              return (
                <Animated.View
                  key={item.id}
                  style={[
                    { height: ROW_H, justifyContent: "center", transform: [{ translateY: dragging ? dragY : shift }] },
                    dragging ? { zIndex: 20, elevation: 8 } : null,
                  ]}
                >
                  <View
                    className="flex-row items-center bg-surface"
                    style={{
                      borderRadius: 14,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: dragging ? "#DDE3EA" : "transparent",
                      shadowColor: "#191F28",
                      shadowOpacity: dragging ? 0.12 : 0,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    <RowBody item={item} isExpense={isExpense} />
                    <View {...panders[i].panHandlers} hitSlop={12} style={{ paddingLeft: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 22, color: "#B0B8C1", fontWeight: "700" }}>≡</Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function RowBody({ item, isExpense }: { item: Row; isExpense: boolean }) {
  if (isExpense) {
    const e = item as Expense;
    return (
      <>
        <View
          className="items-center justify-center"
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${CATEGORY_COLOR[e.category]}2E` }}
        >
          <CategoryIcon category={e.category} size={19} color={CATEGORY_COLOR[e.category]} />
        </View>
        <View className="flex-1" style={{ marginLeft: 11 }}>
          <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
            {e.name}
          </Text>
          <Text className="text-grey mt-0.5" style={{ fontSize: 12 }} numberOfLines={1}>
            {[e.category, e.store, e.payment].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "700" }}>
          {won(e.amount)}
        </Text>
      </>
    );
  }
  const m = item as MealEntry;
  return (
    <>
      <View
        className="items-center justify-center"
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${MEAL_COLOR[m.mealType]}2E` }}
      >
        <MealIcon meal={m.mealType} size={19} color={MEAL_COLOR[m.mealType]} />
      </View>
      <View className="flex-1" style={{ marginLeft: 11 }}>
        <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
          {m.foodName}
        </Text>
        <Text className="text-grey mt-0.5" style={{ fontSize: 12 }} numberOfLines={1}>
          {[m.mealType, m.detail].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "700" }}>
        {m.kcal}kcal
      </Text>
    </>
  );
}
