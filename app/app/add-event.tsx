// 일정 추가 / 수정 (PRD R1). Important event on the month calendar: title (required), date (editable),
// optional time, a bar color, memo. Local-only (eventRepository); advance notification (R3) + sync (R2)
// come with the full-app backend. Modeled on add.tsx.

import { View, Text, Pressable, TextInput, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addEvent, updateEvent, deleteEvent, listEvents, type ImportantEvent } from "@/core/data/eventRepository";
import { todayYmd } from "@/core/schedule/taskScheduler";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const COLORS = ["#3182F6", "#B0862A", "#46466B", "#3C7A89", "#B5533C", "#7C5295", "#8B7E74"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${wd})`;
}
function shiftDay(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + delta));
}

export default function AddEvent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const editId = params.id;

  const [orig, setOrig] = useState<ImportantEvent | null>(null);
  const [dateStr, setDateStr] = useState<string>(params.date || todayYmd());
  const [title, setTitle] = useState("");
  const [timeOn, setTimeOn] = useState(false);
  const [hh, setHh] = useState("09");
  const [mm, setMm] = useState("00");
  const [color, setColor] = useState(COLORS[0]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Edit mode: load the event and prefill.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const e = (await listEvents()).find((x) => x.id === editId);
      if (!e) return;
      setOrig(e);
      setDateStr(e.date);
      setTitle(e.title);
      if (e.time) {
        setTimeOn(true);
        const [h, m] = e.time.split(":");
        setHh(h);
        setMm(m);
      }
      setColor(e.color || COLORS[0]);
      setMemo(e.memo ?? "");
    })();
  }, [editId]);

  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  const timeValid = !timeOn || (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59);
  const canSave = title.trim().length > 0 && timeValid;

  const save = async () => {
    if (!canSave) {
      if (!timeValid) setError("시각이 올바르지 않아요.");
      return;
    }
    const nowMs = Date.now();
    const event: ImportantEvent = {
      id: editId ?? `event-${nowMs}`,
      title: title.trim(),
      date: dateStr,
      time: timeOn ? `${pad(h)}:${pad(m)}` : undefined,
      color,
      memo: memo.trim() || undefined,
      createdAt: orig?.createdAt ?? nowMs,
      updatedAt: nowMs,
    };
    if (editId) await updateEvent(event);
    else await addEvent(event);
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    await deleteEvent(editId);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} className="mb-3">
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink mb-6" style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}>
          {editId ? "일정 수정" : "일정 추가"}
        </Text>

        {/* date — editable by day */}
        <Text className="text-ink" style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
          날짜
        </Text>
        <View className="flex-row items-center justify-between bg-group" style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={() => setDateStr((s) => shiftDay(s, -1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
            {dateLabel(dateStr)}
          </Text>
          <Pressable onPress={() => setDateStr((s) => shiftDay(s, 1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>

        {/* title */}
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(null);
          }}
          placeholder="일정 제목"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 19, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 20 }}
        />

        {/* time (optional) */}
        <View className="flex-row items-center justify-between" style={{ marginTop: 24 }}>
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
            시각 지정
          </Text>
          <Switch
            value={timeOn}
            onValueChange={setTimeOn}
            trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E8EB"
          />
        </View>
        {timeOn && (
          <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
            <TextInput
              value={hh}
              onChangeText={(t) => {
                setHh(t.replace(/[^0-9]/g, "").slice(0, 2));
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={2}
              className="bg-group text-ink text-center"
              style={{ fontSize: 18, width: 60, paddingVertical: 10, borderRadius: 10 }}
            />
            <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700" }}>:</Text>
            <TextInput
              value={mm}
              onChangeText={(t) => {
                setMm(t.replace(/[^0-9]/g, "").slice(0, 2));
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={2}
              className="bg-group text-ink text-center"
              style={{ fontSize: 18, width: 60, paddingVertical: 10, borderRadius: 10 }}
            />
          </View>
        )}

        {/* color */}
        <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 10 }}>
          색
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: c,
                borderWidth: color === c ? 3 : 0,
                borderColor: "#191F28",
              }}
            />
          ))}
        </View>

        {/* memo */}
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="메모 (선택)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />

        {error && (
          <Text className="text-warn mt-4" style={{ fontSize: 13 }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={save}
          disabled={!canSave}
          className="items-center"
          style={{ backgroundColor: canSave ? "#3182F6" : "#B0B8C1", borderRadius: 15, paddingVertical: 16, marginTop: 36 }}
        >
          <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
            저장
          </Text>
        </Pressable>

        {editId && (
          <Pressable onPress={remove} className="items-center mt-3 py-3">
            <Text className="text-warn" style={{ fontSize: 15 }}>
              삭제
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
