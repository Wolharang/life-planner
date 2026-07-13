// 블록 추가 / 수정 (PRD R5 · spec §3.2). A TimeBlock is a free-form start–end interval on ONE date
// (D14) — there is no recurrence in the full-app model. To cover "every day this week", the add mode
// lets you tick **several dates at once**: each becomes its own independent block (founder decision
// 2026-07-11) — convenience, not repetition.
//
// A block carries exactly ONE alert, chosen from three (**D40**, founder 2026-07-11): **없음** (silent) ·
// **알림** (a plain notification + vibration — it tells you, it forces nothing) · **실행** (the lock-screen
// execution moment, R7). Only 실행 pierces the lock screen (R15), and it stays rare *because* the soft tier
// now absorbs everything that doesn't need forcing.

import { View, Text, Pressable, TextInput, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addBlocks, updateBlock, deleteBlock, listBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { snapshotFor, todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { getSettings } from "@/core/data/settingsRepository";
import { newId } from "@/core/data/id";
import type { BlockAlert, BlockKind } from "@/core/data/types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const KINDS: { label: string; v: BlockKind }[] = [
  { label: "일반", v: "normal" },
  { label: "운동", v: "workout" },
  { label: "러닝", v: "run" },
];
const LEADS = [
  { label: "정각", v: 0 },
  { label: "10분 전", v: 10 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const LEAD_PRESET_VALUES = LEADS.map((l) => l.v);
// A block carries exactly one of these (D40). Default = 없음: the plan is just a plan until you say so.
const ALERTS: { label: string; v: BlockAlert }[] = [
  { label: "없음", v: "none" },
  { label: "알림", v: "soft" },
  { label: "실행", v: "execution" },
];
const MULTI_DAYS = 21; // how far the "여러 날에 추가" picker reaches

const pad = (n: number) => String(n).padStart(2, "0");
const dayNum = (d: string) => Number(d.split("-")[2]);
const weekday = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return WD[new Date(y, m - 1, dd).getDay()];
};
const dateLabel = (d: string) => {
  const [, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${weekday(d)})`;
};

export default function AddBlock() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string; start?: string; end?: string }>();
  const editId = params.id;
  const baseDate = params.date || todayYmd();

  const [orig, setOrig] = useState<TimeBlock | null>(null);
  const [dates, setDates] = useState<string[]>([baseDate]); // add mode: one block per ticked date
  const [dateStr, setDateStr] = useState(baseDate); // edit mode: the single date
  const [title, setTitle] = useState("");
  const [startH, setStartH] = useState((params.start ?? "21:00").split(":")[0]);
  const [startM, setStartM] = useState((params.start ?? "21:00").split(":")[1]);
  const [endOn, setEndOn] = useState(!!params.end);
  const [endH, setEndH] = useState((params.end ?? "22:00").split(":")[0]);
  const [endM, setEndM] = useState((params.end ?? "22:00").split(":")[1]);
  const [kind, setKind] = useState<BlockKind>("normal");
  const [location, setLocation] = useState("");
  const [alert, setAlert] = useState<BlockAlert>("none"); // silent by default (D40; "select few" get the cue)
  const [lead, setLead] = useState(0);
  const [leadCustomOn, setLeadCustomOn] = useState(false);
  const [leadCustom, setLeadCustom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New block: pre-fill the cue lead from the personal default (R13/D28).
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

  // Edit mode: prefill from the existing block.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const b = (await listBlocks()).find((x) => x.id === editId);
      if (!b) return;
      setOrig(b);
      setDateStr(b.date);
      setTitle(b.title);
      const [sh, sm] = b.start.split(":");
      setStartH(sh);
      setStartM(sm);
      if (b.end) {
        setEndOn(true);
        const [eh, em] = b.end.split(":");
        setEndH(eh);
        setEndM(em);
      }
      setKind(b.kind);
      setLocation(b.location ?? "");
      setAlert(b.alert);
      setLead(b.alarmLeadMinutes);
      if (!LEAD_PRESET_VALUES.includes(b.alarmLeadMinutes)) {
        setLeadCustomOn(true);
        setLeadCustom(String(b.alarmLeadMinutes));
      }
      setNote(b.microStartNote ?? "");
    })();
  }, [editId]);

  const effectiveLead = leadCustomOn ? Math.max(0, parseInt(leadCustom || "0", 10) || 0) : lead;
  const sh = parseInt(startH, 10);
  const sm = parseInt(startM, 10);
  const eh = parseInt(endH, 10);
  const em = parseInt(endM, 10);
  const validHm = (h: number, m: number) => !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
  const startValid = validHm(sh, sm);
  const endValid = !endOn || validHm(eh, em);
  const start = startValid ? `${pad(sh)}:${pad(sm)}` : "";
  const end = endOn && endValid ? `${pad(eh)}:${pad(em)}` : undefined;
  const orderValid = !end || end > start;
  const targetDates = editId ? [dateStr] : dates;
  const canSave = title.trim().length > 0 && startValid && endValid && orderValid && targetDates.length > 0;

  const toggleDate = (d: string) =>
    setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!canSave) {
      if (!startValid || !endValid) setError("시각이 올바르지 않아요.");
      else if (!orderValid) setError("끝나는 시각이 시작보다 빨라요.");
      else if (targetDates.length === 0) setError("날짜를 하나 이상 골라주세요.");
      return;
    }
    const now = Date.now();
    const common = {
      start,
      end,
      title: title.trim(),
      kind,
      location: location.trim() || undefined,
      alert,
      alarmLeadMinutes: effectiveLead,
      microStartNote: note.trim() || undefined,
    };

    if (editId && orig) {
      const live = { date: dateStr, start, end, title: common.title };
      const updated: TimeBlock = {
        ...orig,
        ...common,
        date: dateStr,
        ...snapshotFor(live, orig, now), // a same-day edit moves the alarm, never the plan of record (D23)
        updatedAt: now,
      };
      await updateBlock(updated); // the repository re-arms / cancels the alarm (architecture §9-2)
      router.back();
      return;
    }

    // Add: one independent block per ticked date (not a repeat — each is its own block).
    const created: TimeBlock[] = targetDates.map((date) => ({
      id: newId("block"),
      date,
      ...common,
      ...snapshotFor({ date, start, end, title: common.title }, null, now),
      status: "planned" as const,
      createdAt: now,
      updatedAt: now,
    }));
    await addBlocks(created); // arms each one
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    await deleteBlock(editId); // evicts the alarm → no ghost fire
    router.back();
  };

  const pickerDates = Array.from({ length: MULTI_DAYS }, (_, i) => shiftYmd(baseDate, i));

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
          {editId ? "블록 수정" : "블록 추가"}
        </Text>

        {/* title */}
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(null);
          }}
          placeholder="무엇을 할까요 (예: 헬스)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 19, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6" }}
        />

        {/* start – end */}
        <SectionLabel>시간</SectionLabel>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <HmInput value={startH} onChange={(v) => (setStartH(v), setError(null))} />
          <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700" }}>:</Text>
          <HmInput value={startM} onChange={(v) => (setStartM(v), setError(null))} />
          {endOn && (
            <>
              <Text className="text-grey" style={{ fontSize: 16, marginHorizontal: 6 }}>–</Text>
              <HmInput value={endH} onChange={(v) => (setEndH(v), setError(null))} />
              <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700" }}>:</Text>
              <HmInput value={endM} onChange={(v) => (setEndM(v), setError(null))} />
            </>
          )}
        </View>
        <View className="flex-row items-center justify-between" style={{ marginTop: 12 }}>
          <Text className="text-grey" style={{ fontSize: 13.5 }}>끝나는 시각도 정하기</Text>
          <Switch
            value={endOn}
            onValueChange={setEndOn}
            trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E8EB"
          />
        </View>

        {/* kind — a workout/run block marked success IS the workout record (D22) */}
        <SectionLabel>종류</SectionLabel>
        <View className="bg-group flex-row" style={{ borderRadius: 12, padding: 4 }}>
          {KINDS.map((o) => {
            const on = kind === o.v;
            return (
              <Pressable
                key={o.v}
                onPress={() => setKind(o.v)}
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

        {/* dates */}
        <SectionLabel>{editId ? "날짜" : "언제 (여러 날 선택 가능)"}</SectionLabel>
        {editId ? (
          <View className="flex-row items-center justify-between bg-group" style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
            <Pressable onPress={() => setDateStr((s) => shiftYmd(s, -1))} hitSlop={10} className="px-3 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
            </Pressable>
            <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>{dateLabel(dateStr)}</Text>
            <Pressable onPress={() => setDateStr((s) => shiftYmd(s, 1))} hitSlop={10} className="px-3 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {pickerDates.map((d) => {
                const on = dates.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      toggleDate(d);
                      setError(null);
                    }}
                    className="items-center"
                    style={{ backgroundColor: on ? "#3182F6" : "#F2F4F6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 46 }}
                  >
                    <Text style={{ color: on ? "#FFFFFF" : "#8B95A1", fontSize: 11, fontWeight: "600" }}>{weekday(d)}</Text>
                    <Text style={{ color: on ? "#FFFFFF" : "#4E5968", fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                      {dayNum(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text className="text-grey mt-2" style={{ fontSize: 12.5 }}>
              {dates.length > 1
                ? `${dates.length}개의 날에 각각 하나씩 만들어요 (반복이 아니라 각각 따로예요)`
                : "여러 날을 누르면 그 날마다 하나씩 만들어요"}
            </Text>
          </>
        )}

        {/* location */}
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="장소 (선택)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />

        {/* 알림 (D40) — a block carries exactly ONE of these three. Keeping a *soft* tier is what lets
            the execution cue stay rare and therefore loud ("one loud thing", C1/D30). */}
        <SectionLabel>알림</SectionLabel>
        <View className="bg-group flex-row" style={{ borderRadius: 12, padding: 4 }}>
          {ALERTS.map((o) => {
            const on = alert === o.v;
            return (
              <Pressable
                key={o.v}
                onPress={() => setAlert(o.v)}
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
                <Text className={on ? "text-ink" : "text-grey"} style={{ fontSize: 14.5, fontWeight: on ? "700" : "500" }}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="text-grey mt-2" style={{ fontSize: 12.5, lineHeight: 18 }}>
          {alert === "execution"
            ? "그 시각에 잠금화면을 뚫고 실행 화면이 떠요. 미루기 쉬운 일(운동)에만 쓰세요."
            : alert === "soft"
              ? "진동과 함께 알림만 와요. 화면을 뚫지 않고, 아무것도 강요하지 않아요."
              : "아무 알림도 오지 않아요. 계획으로만 남아요."}
        </Text>

        {alert !== "none" && (
          <>
            <SectionLabel>언제</SectionLabel>
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
                <Text className="text-grey" style={{ fontSize: 14 }}>분 전</Text>
              </View>
            )}
            {alert === "execution" && (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="첫 동작 (예: 지금 신발 신기)"
              placeholderTextColor="#B0B8C1"
              className="text-ink"
              style={{ fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 18 }}
            />
            )}
          </>
        )}

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
            {editId || dates.length <= 1 ? "저장" : `${dates.length}개 날에 저장`}
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

function HmInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, 2))}
      keyboardType="number-pad"
      maxLength={2}
      className="bg-group text-ink text-center"
      style={{ fontSize: 18, width: 58, paddingVertical: 10, borderRadius: 10 }}
    />
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 26, marginBottom: 10 }}>
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
