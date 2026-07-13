// 일정 추가 / 수정 (PRD R1 + R3). Important event on the month calendar: title (required), date
// (editable), optional time, **advance notification lead** (R3 — a soft local alert, it does NOT pierce
// the lock screen; that's the execution cue's job alone, R15), a bar color, memo. Local-only
// (eventRepository); cloud sync (R2) comes with the full-app backend. Modeled on add.tsx.

import { View, Text, Pressable, TextInput, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addEvent, updateEvent, deleteEvent, listEvents, type ImportantEvent } from "@/core/data/eventRepository";
import { scheduleEventNotification, cancelEventNotification } from "@/core/notifications/plainReminders";
import { getSettings } from "@/core/data/settingsRepository";
import { todayYmd } from "@/core/schedule/blockScheduler";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const COLORS = ["#3182F6", "#B0862A", "#46466B", "#3C7A89", "#B5533C", "#7C5295", "#8B7E74"];
// Advance-notification leads for an important event (D28; 하루 전 matters here, unlike a task's cue).
const LEADS = [
  { label: "정각", v: 0 },
  { label: "10분 전", v: 10 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
  { label: "하루 전", v: 1440 },
];
const LEAD_PRESET_VALUES = LEADS.map((l) => l.v);
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
  const [lead, setLead] = useState(0);
  const [leadCustomOn, setLeadCustomOn] = useState(false);
  const [leadCustom, setLeadCustom] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New event: pre-fill the lead from the personal default (R3 "default if unset", R13/D28).
  useEffect(() => {
    if (editId) return;
    (async () => {
      const d = (await getSettings()).defaultLeadMinutes;
      if (d && !LEAD_PRESET_VALUES.includes(d)) {
        setLeadCustomOn(true);
        setLeadCustom(String(d));
      } else {
        setLead(d);
      }
    })();
  }, [editId]);

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
      const el = e.notifyLeadMinutes ?? 0;
      setLead(el);
      if (!LEAD_PRESET_VALUES.includes(el)) {
        setLeadCustomOn(true);
        setLeadCustom(String(el));
      }
      setColor(e.color || COLORS[0]);
      setMemo(e.memo ?? "");
    })();
  }, [editId]);

  const effectiveLead = leadCustomOn ? Math.max(0, parseInt(leadCustom || "0", 10) || 0) : lead;
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
      notifyLeadMinutes: timeOn ? effectiveLead : undefined,
      color,
      memo: memo.trim() || undefined,
      createdAt: orig?.createdAt ?? nowMs,
      updatedAt: nowMs,
    };
    if (editId) await updateEvent(event);
    else await addEvent(event);
    await scheduleEventNotification(event); // same id → replaces; untimed/past → none (R3)
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    await cancelEventNotification(editId);
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

        {/* 알림 (R3) — a soft advance alert; needs a time to count back from */}
        {timeOn && (
          <>
            <SectionLabel>알림</SectionLabel>
            <ChipRow>
              {LEADS.map((o) => (
                <Chip
                  key={o.v}
                  label={o.label}
                  on={!leadCustomOn && lead === o.v}
                  onPress={() => {
                    setLeadCustomOn(false);
                    setLead(o.v);
                  }}
                />
              ))}
              <Chip label="직접" on={leadCustomOn} onPress={() => setLeadCustomOn(true)} />
            </ChipRow>
            {leadCustomOn && (
              <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                <TextInput
                  value={leadCustom}
                  onChangeText={(t) => setLeadCustom(t.replace(/[^0-9]/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="분"
                  placeholderTextColor="#B0B8C1"
                  className="bg-group text-ink text-center"
                  style={{ fontSize: 15, width: 84, paddingVertical: 10, borderRadius: 10 }}
                />
                <Text className="text-grey" style={{ fontSize: 14 }}>
                  분 전
                </Text>
              </View>
            )}
            <Text className="text-grey mt-2" style={{ fontSize: 13 }}>
              조용한 알림이에요 — 잠금화면을 뚫지 않아요
            </Text>
          </>
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {children}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: on ? "#3182F6" : "#F2F4F6", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}
    >
      <Text style={{ color: on ? "#FFFFFF" : "#4E5968", fontSize: 14, fontWeight: on ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}
