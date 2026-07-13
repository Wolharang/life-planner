// 캘린더 (PRD R1) — month calendar of important events. Square day cells (date number top-left); a day
// with events shows a horizontal colored bar. Tapping a day selects it and the panel below shows that
// day's events in detail. Local-only for now (eventRepository); sync + advance notification come later.

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { listEvents, groupByDate, type ImportantEvent } from "@/core/data/eventRepository";
import { todayYmd } from "@/core/schedule/taskScheduler";

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
  const [events, setEvents] = useState<ImportantEvent[]>([]);

  useFocusEffect(
    useCallback(() => {
      listEvents().then(setEvents);
    }, [])
  );

  const byDate = groupByDate(events);
  const cells = monthCells(view.y, view.m);

  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(today);
  };

  const selEvents = byDate[selected] ?? [];
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selWeekday = WD[new Date(sy, sm - 1, sd).getDay()];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* month header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
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

      {/* square month grid */}
      <View className="flex-row flex-wrap px-2">
        {cells.map((c) => {
          const isToday = c.key === today;
          const isSelected = c.key === selected;
          const dayEvents = byDate[c.key] ?? [];
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

                {dayEvents.slice(0, 2).map((e) => (
                  <View
                    key={e.id}
                    style={{ height: 6, borderRadius: 3, marginTop: 2, backgroundColor: e.color || BRAND }}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <Text className="text-grey" style={{ fontSize: 9, fontWeight: "600", marginTop: 1 }}>
                    +{dayEvents.length - 2}
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
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "800" }}>
            {sm}월 {sd}일 <Text className="text-grey" style={{ fontSize: 14, fontWeight: "600" }}>{selWeekday}</Text>
          </Text>
          <Link href={{ pathname: "/add-event", params: { date: selected } }} asChild>
            <Pressable className="bg-brand rounded-full px-3.5 py-1.5">
              <Text className="text-white" style={{ fontSize: 12, fontWeight: "700" }}>
                ＋ 일정 추가
              </Text>
            </Pressable>
          </Link>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }}>
          {selEvents.length === 0 ? (
            <Text className="text-grey" style={{ fontSize: 14, paddingVertical: 18 }}>
              이 날은 일정이 없어요.
            </Text>
          ) : (
            selEvents.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => router.push({ pathname: "/add-event", params: { id: e.id } })}
                className="flex-row items-start bg-group rounded-card mb-2"
                style={{ padding: 13 }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.color || BRAND, marginTop: 4 }} />
                <View className="flex-1" style={{ marginLeft: 11 }}>
                  <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>
                    {e.title}
                  </Text>
                  {(e.time || e.memo) && (
                    <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
                      {e.time ? e.time : ""}
                      {e.time && e.memo ? " · " : ""}
                      {e.memo ?? ""}
                    </Text>
                  )}
                  {e.time && e.notifyLeadMinutes != null && (
                    <Text className="text-grey mt-1" style={{ fontSize: 12 }}>
                      🔔 {leadLabel(e.notifyLeadMinutes)}
                    </Text>
                  )}
                </View>
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
