// 캘린더 (PRD R1) — the month view of **the day itself**. One unit: the TimeBlock (D67).
//
// There used to be two things you could put on a day — an "important event" and a "block" — and the user had
// to answer a question that has nothing to do with their life: *which one is this?* Worse, the answer had
// consequences they never asked for: a block added to hold an hour **did not appear on the calendar**, so the
// month showed a free afternoon that was not free.
//
// Now the **alert tier IS the answer**: 없음 = it just holds the hour · 알림 = it matters · 실행 = the lever.
// Kind (일반/운동/러닝) is orthogonal. There is one place to add, and one thing to add.
// Local-only for now (eventRepository / blockRepository); cross-device sync (R2) comes with F0.

import { View, Text, Pressable, ScrollView, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useMemo, useState, useEffect } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { listBlocks, blocksOn, groupByDate as groupBlocksByDate, type TimeBlock } from "@/core/data/blockRepository";
import { isSkipped } from "@/core/schedule/blockScheduler";
import { onSyncApplied } from "@/core/data/sync";
import { isExecution, todayYmd } from "@/core/schedule/blockScheduler";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const BRAND = "#3182F6";
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Cell = { date: Date; key: string; day: number; inMonth: boolean; weekday: number };

// 42 cells (6 weeks) covering the month, starting on the Sunday on/before the 1st.
function monthCells(viewYear: number, viewMonth: number): Cell[] {
  const startWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const start = new Date(viewYear, viewMonth, 1 - startWeekday);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: d, key: ymd(d), day: d.getDate(), inMonth: d.getMonth() === viewMonth, weekday: d.getDay() });
  }
  return cells;
}

export default function Calendar() {
  const router = useRouter();
  const today = todayYmd();
  const now = new Date();

  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m = 0-based
  const [selected, setSelected] = useState<string>(today);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  const reload = useCallback(() => {
    listBlocks().then(setBlocks);
  }, []);
  useFocusEffect(reload);
  // R2: a change that arrived from the other phone must show up **without** navigating away and back.
  useEffect(() => onSyncApplied(reload), [reload]);

  /**
   * **The month grid must show the whole day, not half of it.**
   *
   * It drew bars for `ImportantEvent` only, so a block — the thing that actually *takes* an hour of your day —
   * left the calendar blank. You could add 강의 as a block, look at the month, see a free afternoon, and plan a
   * workout straight into it. **A calendar that hides half your commitments is worse than no calendar**: it
   * doesn't merely omit, it actively tells you the day is free.
   *
   * That is also the whole reason D62 brought `없음` back — a block is *an hour that is taken*. An hour that is
   * taken has to be visible where you look for free hours.
   *
   * Events and blocks stay separate entities (data-model §2.2); only the *drawing* is unified.
   */
  const blocksByDate = groupBlocksByDate(blocks);
  const marksFor = (key: string) => {
    const bs = (blocksByDate[key] ?? []).map((b) => ({
      id: b.id,
      // The lever's blocks read as the brand; a block that only holds the hour reads as neutral weight. Gold
      // is never spent here — it marks ONE thing, and that is a DONE (design-system §1.1).
      color: b.color || (isSkipped(b) ? "#D1D6DB" : b.alert === "execution" ? BRAND : "#B0B8C1"),
    }));
    return bs;
  };
  const cells = monthCells(view.y, view.m);

  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(today);
  };

  // R1 acceptance: **swipe months** — the standard calendar convention (S26/C2: reuse what people
  // already know, spend the design budget on the moment). Only claims clearly-horizontal drags, so a
  // day tap and the detail panel's scroll still win.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -40) shiftMonth(1); // drag left → next month
          else if (g.dx >= 40) shiftMonth(-1);
        },
      }),
    [view.y, view.m]
  );
  const selBlocks = blocksOn(blocks, selected);
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selWeekday = WD[new Date(sy, sm - 1, sd).getDay()];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* month header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.4 }}>
          {view.y}년 {view.m + 1}월
        </Text>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Pressable onPress={goToday} className="bg-group rounded-full px-3 py-1.5" hitSlop={8}>
            <Text className="text-ink-soft" style={{ fontSize: 12, fontWeight: "700" }}>
              오늘
            </Text>
          </Pressable>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} className="px-2 py-1">
            <Text className="text-ink" style={{ fontSize: 22, fontWeight: "700" }}>
              ‹
            </Text>
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} className="px-2 py-1">
            <Text className="text-ink" style={{ fontSize: 22, fontWeight: "700" }}>
              ›
            </Text>
          </Pressable>
        </View>
      </View>

      {/* weekday row */}
      <View className="flex-row px-2">
        {WD.map((w) => (
          <View key={w} style={{ width: "14.2857%", alignItems: "center", paddingVertical: 4 }}>
            <Text className="text-grey" style={{ fontSize: 12, fontWeight: "600" }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* square month grid — swipe left/right to change month (R1) */}
      <View className="flex-row flex-wrap px-2" {...swipe.panHandlers}>
        {cells.map((c) => {
          const isToday = c.key === today;
          const isSelected = c.key === selected;
          const marks = marksFor(c.key);
          return (
            <Pressable
              key={c.key}
              onPress={() => setSelected(c.key)}
              style={{ width: "14.2857%", aspectRatio: 1, padding: 2.5 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: 4,
                  backgroundColor: isSelected ? "#E8F3FF" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isToday ? BRAND : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: isToday || isSelected ? "700" : "500",
                      color: isToday ? "#FFFFFF" : c.inMonth ? "#191F28" : "#B0B8C1",
                    }}
                  >
                    {c.day}
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                {marks.slice(0, 3).map((m) => (
                  <View
                    key={m.id}
                    style={{ height: 5, borderRadius: 3, marginTop: 2, backgroundColor: m.color }}
                  />
                ))}
                {marks.length > 3 && (
                  <Text className="text-grey" style={{ fontSize: 9, fontWeight: "600", marginTop: 1 }}>
                    +{marks.length - 3}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* selected-day detail */}
      <View className="flex-1" style={{ borderTopWidth: 1, borderTopColor: "#F2F4F6", marginTop: 6 }}>
        <View className="flex-row items-center justify-between px-5 pt-4 pb-1">
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
            {sm}월 {sd}일 <Text className="text-grey" style={{ fontSize: 14, fontWeight: "600" }}>{selWeekday}</Text>
          </Text>
          <Link href={{ pathname: "/add-block", params: { date: selected } }} asChild>
            <Pressable className="bg-brand rounded-full px-3.5 py-1.5">
              <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
                ＋ 추가
              </Text>
            </Pressable>
          </Link>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }}>
          {selBlocks.length === 0 ? (
            <Text className="text-grey" style={{ fontSize: 14, paddingVertical: 18 }}>
              이 날은 아무것도 없어요.
            </Text>
          ) : (
            selBlocks.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push({ pathname: "/add-block", params: { id: b.id } })}
                className="flex-row items-start bg-group rounded-card mb-2"
                style={{ padding: 13, opacity: isSkipped(b) ? 0.55 : 1 }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 4,
                    backgroundColor: b.color || (b.alert === "execution" ? BRAND : "#B0B8C1"),
                  }}
                />
                <View className="flex-1" style={{ marginLeft: 11 }}>
                  <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>
                    {b.title}
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
                    {b.start}
                    {b.end ? `–${b.end}` : ""}
                    {/* The tier is the label — it says what this thing IS, not merely how it rings. */}
                    {isSkipped(b)
                      ? " · 오늘은 휴식"
                      : b.alert === "execution"
                        ? " · 실행"
                        : b.alert === "soft"
                          ? " · 알림"
                          : ""}
                    {b.memo ? ` · ${b.memo}` : ""}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          {/* the day's time-block plan (D21) — tap through to design/edit the whole day */}
          <Pressable
            onPress={() => router.push({ pathname: "/day", params: { date: selected } })}
            className="flex-row items-center justify-between mt-5 mb-2"
          >
            <Text className="text-ink" style={{ fontSize: 14, fontWeight: "700" }}>
              하루 설계
            </Text>
            <Text className="text-brand" style={{ fontSize: 12.5, fontWeight: "700" }}>
              {selBlocks.length > 0 ? `${selBlocks.length}개 · 열기 ›` : "짜기 ›"}
            </Text>
          </Pressable>

          {/* R10 — the day summary links the two surfaces (it does not merge them, D32) */}
          <Pressable
            onPress={() => router.push({ pathname: "/summary", params: { date: selected } })}
            className="bg-group rounded-card flex-row items-center justify-between mb-2"
            style={{ paddingHorizontal: 14, paddingVertical: 11 }}
          >
            <Text className="text-ink" style={{ fontSize: 13.5, fontWeight: "700" }}>
              하루 요약
            </Text>
            <Text className="text-grey" style={{ fontSize: 16, fontWeight: "700" }}>
              ›
            </Text>
          </Pressable>
          {selBlocks.length === 0 ? (
            <Text className="text-grey" style={{ fontSize: 13 }}>
              이 날의 시간 계획은 아직 없어요.
            </Text>
          ) : (
            selBlocks.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push({ pathname: "/add-block", params: { id: b.id } })}
                className="flex-row items-center"
                style={{ paddingVertical: 7 }}
              >
                <Text className="text-ink" style={{ fontSize: 13, fontWeight: "700", width: 46 }}>
                  {b.start}
                </Text>
                <Text className="text-ink-soft flex-1" style={{ fontSize: 13.5 }} numberOfLines={1}>
                  {b.title}
                </Text>
                {isExecution(b) && (
                  <View className="bg-brand-soft rounded-full px-2 py-0.5">
                    <Text className="text-brand" style={{ fontSize: 10.5, fontWeight: "700" }}>
                      실행
                    </Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/** The event's advance-alert lead (R3), read back in the user's words. */
function leadLabel(min: number): string {
  if (min === 0) return "정각 알림";
  if (min % 1440 === 0) return `${min / 1440}일 전`;
  if (min % 60 === 0) return `${min / 60}시간 전`;
  return `${min}분 전`;
}
