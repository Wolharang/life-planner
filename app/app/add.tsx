// 할 일 추가 / 수정 (PRD R1 / §8). Required = time + title; execution-alarm defaults ON. On save:
// persist + (re)schedule the exact alarm — editing the time MOVES the alarm (same id → replaces).
// With ?id it edits an existing task (preserving createdAt + skippedDates) and offers delete.
//
// v5 skin round #3 (PROVISIONAL) — the mockup form (big time + blue underline · underlined 제목 / 첫 동작
// 메모 · 실행 알림 toggle · 반복 segmented · 저장) NOW restored with the full PRD/D35 controls in the same
// style: 언제(실행 알림 시점, lead presets + 직접) and 단순 알림(multi-offset), both as filled chips.

import { View, Text, Pressable, TextInput, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addTask, updateTask, deleteTask, listTasks } from "@/core/data/taskRepository";
import { scheduleTask, unscheduleTask } from "@/core/schedule/taskScheduler";
import { scheduleReminders, cancelReminders } from "@/core/notifications/plainReminders";
import { getSettings } from "@/core/data/settingsRepository";
import type { Recurrence, Task } from "@/core/data/types";

const pad = (n: number) => String(n).padStart(2, "0");

// Presets per PRD §7.1.0 / impl-plan Phase 3: {정각 · 15 · 30 · 60 · 직접(custom)}.
const LEADS = [
  { label: "정각", v: 0 },
  { label: "15분 전", v: 15 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const LEAD_PRESET_VALUES = LEADS.map((l) => l.v);
const RECURRENCES: { label: string; v: Recurrence }[] = [
  { label: "없음", v: "none" },
  { label: "매일", v: "daily" },
  { label: "매주", v: "weekly" },
];
const REMINDERS = [
  { label: "정각", v: 0 },
  { label: "15분 전", v: 15 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const REMINDER_PRESET_VALUES = REMINDERS.map((r) => r.v);

export default function AddTask() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();

  const [orig, setOrig] = useState<Task | null>(null);
  const [hh, setHh] = useState("21");
  const [mm, setMm] = useState("00");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [execOn, setExecOn] = useState(true); // default ON (§8)
  const [lead, setLead] = useState(0);
  const [leadCustomOn, setLeadCustomOn] = useState(false);
  const [leadCustom, setLeadCustom] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [plainOffsets, setPlainOffsets] = useState<number[]>([]);
  const [reminderCustom, setReminderCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New task: pre-fill the lead from the personal default (R8 optional/local, settingsRepository).
  useEffect(() => {
    if (editId) return;
    (async () => {
      const s = await getSettings();
      if (s.defaultLeadMinutes && !LEAD_PRESET_VALUES.includes(s.defaultLeadMinutes)) {
        setLeadCustomOn(true);
        setLeadCustom(String(s.defaultLeadMinutes));
      } else {
        setLead(s.defaultLeadMinutes);
      }
    })();
  }, [editId]);

  // Edit mode: prefill from the existing task.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const t = (await listTasks()).find((x) => x.id === editId);
      if (!t) return;
      setOrig(t);
      const [h, m] = t.setTime.split(":");
      setHh(h);
      setMm(m);
      setTitle(t.title);
      setNote(t.microStartNote ?? "");
      setExecOn(t.executionAlarm);
      setLead(t.leadMinutes);
      if (!LEAD_PRESET_VALUES.includes(t.leadMinutes)) {
        setLeadCustomOn(true);
        setLeadCustom(String(t.leadMinutes));
      }
      setRecurrence(t.recurrence);
      setPlainOffsets(t.plainReminderOffsets ?? []);
    })();
  }, [editId]);

  const effectiveLead = leadCustomOn ? Math.max(0, parseInt(leadCustom || "0", 10) || 0) : lead;
  const togglePlain = (v: number) =>
    setPlainOffsets((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const addReminderCustom = () => {
    const v = parseInt(reminderCustom || "", 10);
    if (isNaN(v) || v < 0) return;
    setPlainOffsets((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setReminderCustom("");
  };

  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  const timeValid = !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
  const canSave = timeValid && title.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    if (recurrence === "none") {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) {
        setError("이미 지난 시각이에요.");
        return;
      }
    }
    const task: Task = {
      id: editId ?? `task-${Date.now()}`,
      title: title.trim(),
      setTime: `${pad(h)}:${pad(m)}`,
      microStartNote: note.trim() || undefined,
      executionAlarm: execOn,
      leadMinutes: effectiveLead,
      plainReminderOffsets: plainOffsets,
      recurrence,
      skippedDates: orig?.skippedDates ?? [],
      createdAt: orig?.createdAt ?? Date.now(),
    };
    if (editId) await updateTask(task);
    else await addTask(task);
    scheduleTask(task); // same id → moves/replaces the alarm; off → cancels
    await scheduleReminders(task); // soft plain reminders (independent of the execution alarm)
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    unscheduleTask(editId);
    await cancelReminders(editId);
    await deleteTask(editId);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {/* header */}
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="mb-3">
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink mb-6" style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}>
          {editId ? "할 일 수정" : "할 일 추가"}
        </Text>

        {/* big time — blue underline */}
        <View
          className="flex-row items-center mb-8"
          style={{ borderBottomWidth: 2, borderBottomColor: "#3182F6", paddingBottom: 8 }}
        >
          <TextInput
            value={hh}
            onChangeText={(t) => {
              setHh(t.replace(/[^0-9]/g, "").slice(0, 2));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={2}
            className="text-ink"
            style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1, padding: 0, width: 52, textAlign: "center" }}
          />
          <Text className="text-ink" style={{ fontSize: 40, fontWeight: "800", marginHorizontal: 2 }}>
            :
          </Text>
          <TextInput
            value={mm}
            onChangeText={(t) => {
              setMm(t.replace(/[^0-9]/g, "").slice(0, 2));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={2}
            className="text-ink"
            style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1, padding: 0, width: 52, textAlign: "center" }}
          />
        </View>

        {/* 제목 — underlined */}
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(null);
          }}
          placeholder="제목"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 19, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6" }}
        />

        {/* 첫 동작 메모 — underlined */}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="첫 동작 메모"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 19, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 4 }}
        />

        {/* 실행 알림 */}
        <View className="flex-row items-center justify-between" style={{ marginTop: 28 }}>
          <View className="flex-1 pr-3">
            <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
              실행 알림
            </Text>
            <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
              정한 시각에 잠금화면을 뚫어요
            </Text>
          </View>
          <Switch
            value={execOn}
            onValueChange={setExecOn}
            trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E8EB"
          />
        </View>

        {/* 언제 (실행 알림 시점) — lead presets, active only when 실행 알림 is on */}
        <SectionLabel>언제</SectionLabel>
        <View style={{ opacity: execOn ? 1 : 0.4 }}>
          <ChipRow>
            {LEADS.map((o) => (
              <Chip
                key={o.v}
                label={o.label}
                on={!leadCustomOn && lead === o.v}
                onPress={() => {
                  if (!execOn) return;
                  setLeadCustomOn(false);
                  setLead(o.v);
                }}
              />
            ))}
            <Chip label="직접" on={leadCustomOn} onPress={() => execOn && setLeadCustomOn(true)} />
          </ChipRow>
          {leadCustomOn && (
            <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
              <TextInput
                value={leadCustom}
                onChangeText={setLeadCustom}
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
        </View>

        {/* 반복 — segmented */}
        <SectionLabel>반복</SectionLabel>
        <View className="bg-group flex-row" style={{ borderRadius: 12, padding: 4 }}>
          {RECURRENCES.map((o) => {
            const on = recurrence === o.v;
            return (
              <Pressable
                key={o.v}
                onPress={() => {
                  setRecurrence(o.v);
                  setError(null);
                }}
                className="flex-1 items-center"
                style={{
                  borderRadius: 9,
                  paddingVertical: 12,
                  backgroundColor: on ? "#FFFFFF" : "transparent",
                  ...(on
                    ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }
                    : {}),
                }}
              >
                <Text className={on ? "text-ink" : "text-grey"} style={{ fontSize: 15, fontWeight: on ? "700" : "500" }}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 단순 알림 (선택 · 여러 개) — soft multi-offset reminders, distinct from the execution cue */}
        <SectionLabel>단순 알림 · 여러 개 선택</SectionLabel>
        <ChipRow>
          {REMINDERS.map((o) => (
            <Chip key={o.v} label={o.label} on={plainOffsets.includes(o.v)} onPress={() => togglePlain(o.v)} />
          ))}
          {plainOffsets
            .filter((v) => !REMINDER_PRESET_VALUES.includes(v))
            .sort((a, b) => a - b)
            .map((v) => (
              <Chip key={`c${v}`} label={`${v}분 전 ✕`} on onPress={() => togglePlain(v)} />
            ))}
        </ChipRow>
        <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
          <TextInput
            value={reminderCustom}
            onChangeText={setReminderCustom}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="직접(분)"
            placeholderTextColor="#B0B8C1"
            className="bg-group text-ink text-center"
            style={{ fontSize: 15, width: 96, paddingVertical: 10, borderRadius: 10 }}
          />
          <Pressable onPress={addReminderCustom} className="bg-group" style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text className="text-ink-soft" style={{ fontSize: 14, fontWeight: "600" }}>
              추가
            </Text>
          </Pressable>
        </View>

        {error && (
          <Text className="text-warn mt-4" style={{ fontSize: 13 }}>
            {error}
          </Text>
        )}

        {/* 저장 */}
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
    <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 28, marginBottom: 10 }}>
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
