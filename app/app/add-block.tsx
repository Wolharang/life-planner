// 블록 추가 / 수정 (PRD R5 · spec §3.2). A TimeBlock is a free-form start–end interval on ONE date
// (D14) — there is no recurrence in the full-app model. To cover "every day this week", the add mode
// lets you tick **several dates at once**: each becomes its own independent block (founder decision
// 2026-07-11) — convenience, not repetition.
//
// A block carries exactly ONE alert, chosen from three (**D40**, founder 2026-07-11): **없음** (silent) ·
// **알림** (a plain notification + vibration — it tells you, it forces nothing) · **실행** (the lock-screen
// execution moment, R7). Only 실행 pierces the lock screen (R15), and it stays rare *because* the soft tier
// now absorbs everything that doesn't need forcing.

import { View, Text, Pressable, TextInput, Switch, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addBlocks, updateBlock, deleteBlock, listBlocks, preCommitted, type TimeBlock } from "@/core/data/blockRepository";
import { snapshotFor, todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { getSettings } from "@/core/data/settingsRepository";
import { newId } from "@/core/data/id";
import { MonthPicker } from "@/ui/MonthPicker";
import { listDevices, selfDeviceId, type DeviceRecord } from "@/core/data/deviceRepository";
import { hapticDeleted, hapticSaved } from "@/core/ui/haptics";
import { alarm } from "@/core/notifications/alarm";
import { backgroundLocationGranted, requestBackgroundLocationPermission } from "@/core/geo/location";
import { loudnessOf, type BlockAlert, type BlockKind, type BlockLoudness } from "@/core/data/types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const KINDS: { label: string; v: BlockKind }[] = [
  { label: "일반", v: "normal" },
  { label: "운동", v: "workout" },
  { label: "러닝", v: "run" },
];
const LEADS = [
  { label: "정각", v: 0 },
  { label: "15분 전", v: 15 }, // was 10 — 설정 offers 15, so a default set there landed here as "직접"
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const LEAD_PRESET_VALUES = LEADS.map((l) => l.v);
// A block carries exactly one of these (D40 → D43 → **D62**). **Default = 실행**: the lever is the product,
// so a new block gets it unless you say otherwise.
//
// **없음 is back (D62).** D43 removed it because "a block you'd never be told about isn't worth adding" — but
// that mistook a block for an alert. A block is also **an hour of your day that is taken**: 강의, 알바, 이동 have
// to be on the plan so the day is honest — so the free-slot hint doesn't offer a gap that isn't free, and
// tomorrow's workout lands where it can actually happen. Forcing them to carry a notification means being
// pestered about a lecture you are already sitting in.
const ALERTS: { label: string; v: BlockAlert }[] = [
  { label: "없음", v: "none" },
  { label: "알림", v: "soft" },
  { label: "실행", v: "execution" },
];
// A soft alert arrives at the moments the USER picks (D45) — not on a fixed interval. Max 3.
const SOFT_LEAD_PRESETS = [
  { label: "정각", v: 0 },
  { label: "5분 전", v: 5 },
  { label: "15분 전", v: 15 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const MAX_ALERTS = 3;
// The loudness axis (D65) — three settings, independent of the tier.
const LOUDNESS: { label: string; v: BlockLoudness }[] = [
  { label: "무음", v: "silent" },
  { label: "진동", v: "vibrate" },
  { label: "소리", v: "sound" },
];
const leadText = (v: number) => (v === 0 ? "정각" : v % 60 === 0 ? `${v / 60}시간 전` : `${v}분 전`);
const MULTI_DAYS = 21; // how far the "여러 날에 추가" picker reaches
// Calendar bar colours — carried over from the retired ImportantEvent (D67). Gold is absent on purpose: it
// marks ONE thing, and that is a DONE (design-system §1.1).
const CAL_COLORS = ["#3182F6", "#46466B", "#3C7A89", "#7C5295", "#8B7E74"];

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
  const [inBrief, setInBrief] = useState(true); // 아침 요약에 넣을지 — 기본은 넣음 (undefined = 포함)
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
  const [memo, setMemo] = useState("");
  const [color, setColor] = useState("");
  const [alert, setAlert] = useState<BlockAlert>("execution"); // the lever is the default (D43)
  const [loudness, setLoudness] = useState<BlockLoudness>("vibrate"); // D65 — 무음/진동/소리
  const [leads, setLeads] = useState<number[]>([0]); // soft only: the moments the user picked (D45)
  const [addingLead, setAddingLead] = useState(false);
  const [leadInput, setLeadInput] = useState("");
  const [lead, setLead] = useState(0);
  const [leadCustomOn, setLeadCustomOn] = useState(false);
  const [leadCustom, setLeadCustom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  // D70 — which phone(s) take the screen. Defaults to this one: you are planning on the phone you are holding.
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [executeOn, setExecuteOn] = useState<string[]>([]);

  // Manual verdict override (workout/run 실행 blocks). The GPS auto-verdict is a *default* — the user can flip
  // it here and, on 미스, write the reason. Only shown for a settled workout/run 실행 block.
  const [verdict, setVerdict] = useState<"success" | "fail" | null>(null);
  const [failText, setFailText] = useState("");

  useEffect(() => {
    (async () => {
      const me = await selfDeviceId();
      setSelfId(me);
      setDevices(await listDevices());
      if (!editId) setExecuteOn([me]);
    })();
  }, [editId]);

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
      // The global 설정 → 소리 switch is the DEFAULT for a new block (D49) — the block's own flag is what
      // actually fires (D43), so the switch cannot silently govern alarms the user thinks he set per block.
      try {
        // The global 설정 → 소리 switch is the DEFAULT for a new block (D49) — the block's own choice is what
        // actually fires (D43), so the switch can never silently govern an alarm the user set per block.
        setLoudness(alarm.getSound() ? "sound" : "vibrate");
      } catch {
        // native not linked (dev skew) — keep the vibration default
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
      setMemo(b.memo ?? "");
      setColor(b.color ?? "");
      setInBrief(b.inBrief !== false);
      setAlert(b.alert);
      setLoudness(loudnessOf(b));
      setLeads(b.alertLeads?.length ? b.alertLeads : [b.alarmLeadMinutes]);
      // A pre-D70 block names nobody → it fires everywhere. Show that honestly rather than pretending it was
      // scoped to a phone the user never chose.
      setExecuteOn(b.executeOn?.length ? b.executeOn : []);
      setLead(b.alarmLeadMinutes);
      if (!LEAD_PRESET_VALUES.includes(b.alarmLeadMinutes)) {
        setLeadCustomOn(true);
        setLeadCustom(String(b.alarmLeadMinutes));
      }
      setNote(b.microStartNote ?? "");
      setVerdict(b.status === "success" || b.status === "fail" ? b.status : null);
      setFailText(b.failReason ?? "");
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
  // The manual-verdict section: only for a settled workout/run 실행 block (the ones auto-eval judges).
  const showVerdict =
    !!editId &&
    !!orig &&
    (orig.kind === "workout" || orig.kind === "run") &&
    orig.alert === "execution" &&
    (orig.status === "success" || orig.status === "fail");
  const canSave =
    title.trim().length > 0 &&
    startValid &&
    endValid &&
    orderValid &&
    targetDates.length > 0 &&
    (alert !== "soft" || leads.length > 0);

  // Earliest first; the block's own lead mirrors the first moment so the rest of the app can show it.
  const sortedLeads = [...new Set(leads)].sort((a, b) => b - a).slice(0, MAX_ALERTS);
  const addLead = (v: number) => {
    if (leads.length >= MAX_ALERTS || leads.includes(v)) return;
    setLeads((prev) => [...prev, v]);
    setAddingLead(false);
    setLeadInput("");
  };
  const addLeadCustom = () => {
    const v = parseInt(leadInput || "", 10);
    if (isNaN(v) || v < 0) return;
    addLead(v);
  };

  const toggleDate = (d: string) =>
    setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!canSave) {
      if (!startValid || !endValid) setError("시각이 올바르지 않아요.");
      else if (!orderValid) setError("끝나는 시각이 시작보다 빨라요.");
      else if (targetDates.length === 0) setError("날짜를 하나 이상 골라주세요.");
      else if (alert === "soft" && leads.length === 0) setError("알림 시점을 하나 이상 골라주세요.");
      return;
    }
    const now = Date.now();
    const common = {
      start,
      end,
      title: title.trim(),
      kind,
      location: location.trim() || undefined,
      memo: memo.trim() || undefined,
      color: color || undefined,
      // Empty = every device (the pre-D70 behaviour). Only meaningful for `execution`.
      executeOn: alert === "execution" && executeOn.length > 0 ? executeOn : undefined,
      alert,
      alertLoudness: loudness,
      inBrief: inBrief ? undefined : false, // undefined = included; only the exclusion is worth storing
      alertLeads: alert === "soft" ? sortedLeads : undefined,
      alarmLeadMinutes: alert === "soft" ? (sortedLeads[0] ?? 0) : effectiveLead,
      microStartNote: note.trim() || undefined,
    };

    if (editId && orig) {
      const live = { date: dateStr, start, end, title: common.title };
      // Manual verdict override, when this is a settled workout/run 실행 block. A flip (or an edited reason) marks
      // the verdict `manual` so auto-eval never overwrites the user's own call; leaving it untouched changes
      // nothing. On 성공 the reason is cleared — a reason is only meaningful for a miss.
      const verdictChanged =
        !!verdict &&
        (verdict !== orig.status || (verdict === "fail" && failText.trim() !== (orig.failReason ?? "").trim()));
      const verdictFields =
        showVerdict && verdict
          ? {
              status: verdict,
              failReason: verdict === "fail" ? failText.trim() || undefined : undefined,
              evalSource: verdictChanged ? ("manual" as const) : orig.evalSource,
            }
          : {};
      const updated: TimeBlock = {
        ...orig,
        ...common,
        date: dateStr,
        ...snapshotFor(live, orig, now), // a same-day edit moves the alarm, never the plan of record (D23)
        ...verdictFields,
        updatedAt: now,
      };
      await updateBlock(updated); // the repository re-arms / cancels the alarm (architecture §9-2)
      await ensureLocationForAutoEval();
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
    hapticSaved();
    await ensureLocationForAutoEval();
    router.back();
  };

  // Auto-evaluation needs location — ask for it at the moment it turns on (a workout/run 실행 block is saved),
  // not buried in onboarding a user may have skipped. Only prompts when it is actually missing.
  const ensureLocationForAutoEval = async () => {
    if ((kind === "workout" || kind === "run") && alert === "execution") {
      if (!(await backgroundLocationGranted())) {
        await requestBackgroundLocationPermission();
      }
    }
  };

  // Deleting a record is destructive and there is no undo, so it never happens on one tap. The reference
  // apps both asked (reference-apps.md §A4/§B4) and we quietly dropped the ask when porting them.
  const remove = () => {
    if (!editId) return;
    // A pre-committed block deleted on its own day records a **miss** (spec §3.6) — otherwise deleting is a
    // silent, cost-free "can't today", the one escape R7 forbids. It must never happen behind the user's
    // back, so the dialog says so plainly — and says it without a threat: no penalty, just a record.
    const willCount =
      orig != null && orig.status === "planned" && preCommitted(orig) && orig.date <= todayYmd();
    Alert.alert(
      "이 블록을 지울까요?",
      willCount
        ? "어제 미리 정해둔 오늘 일이라, 지우면 '안 함'으로 남아요. 벌점은 없어요 — 그냥 기록이에요.\n알림도 함께 꺼져요."
        : "알림도 함께 꺼져요. 되돌릴 수 없어요.",
      [
      { text: "취소", style: "cancel" },
      {
        text: "지우기",
        style: "destructive",
        onPress: async () => {
          await deleteBlock(editId);
          hapticDeleted();
          router.back();
        },
      },
    ]);
  };

  const pickerDates = Array.from({ length: MULTI_DAYS }, (_, i) => shiftYmd(baseDate, i));
  // Dates chosen from the calendar that the chip row cannot show — so the count doesn't silently vanish.
  const farDates = dates.filter((d) => !pickerDates.includes(d));

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} className="mb-3">
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink mb-6" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>
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
          // The arrows nudge a day; the calendar reaches anywhere. Moving a block to 9월 2일 used to mean
          // tapping › fifty times.
          <>
          <View className="flex-row items-center justify-between bg-group" style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
            <Pressable onPress={() => setDateStr((s) => shiftYmd(s, -1))} hitSlop={10} className="px-3 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
            </Pressable>
            <Pressable onPress={() => setCalOpen(true)} hitSlop={8} className="px-2 py-1">
              <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>{dateLabel(dateStr)}</Text>
            </Pressable>
            <Pressable onPress={() => setDateStr((s) => shiftYmd(s, 1))} hitSlop={10} className="px-3 py-1">
              <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
            </Pressable>
            </View>
            <CalendarButton onPress={() => setCalOpen(true)} />
          </>
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
            {/* **The far future has to be reachable.** The chips only run 3 weeks out (they are for "soon" —
                tonight, this weekend), so 9월 개강 or 12월 시험 simply could not be entered. The app *is* a
                calendar; it just never handed one to the editor. */}
            <CalendarButton
              onPress={() => setCalOpen(true)}
              badge={farDates.length > 0 ? `먼 날짜 ${farDates.length}개` : undefined}
            />
            <Text className="text-grey mt-2" style={{ fontSize: 12.5 }}>
              {dates.length > 1
                ? `${dates.length}개의 날에 각각 하나씩 만들어요 (반복이 아니라 각각 따로예요)`
                : "여러 날을 누르면 그 날마다 하나씩 만들어요"}
            </Text>
          </>
        )}

        <MonthPicker
          visible={calOpen}
          single={!!editId}
          initial={editId ? dateStr : dates[dates.length - 1] ?? baseDate}
          value={editId ? [dateStr] : dates}
          onChange={(ds) => {
            if (editId) setDateStr(ds[0] ?? dateStr);
            else setDates(ds);
            setError(null);
          }}
          onClose={() => setCalOpen(false)}
        />

        {/* location */}
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="장소 (선택)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />

        {/* memo + colour — absorbed from the retired "important event" (D67). A block IS the calendar item. */}
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="메모 (선택)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6" }}
        />

        <View style={{ marginTop: 20 }}>
          <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
            캘린더 색
          </Text>
          <View className="flex-row" style={{ gap: 10 }}>
            {CAL_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(color === c ? "" : c)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: "#191F28",
                }}
              />
            ))}
          </View>
        </View>

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
        {/* **Three tiers, three sentences.** This branched only on `execution`, so 없음 and 알림 shared one line
            — and it said "알림만 와요" for the tier whose entire point is that **nothing arrives**. The tier is
            what the thing IS (D67); describing two of them identically undoes that. */}
        <Text className="text-grey mt-2" style={{ fontSize: 12.5, lineHeight: 18 }}>
          {alert === "execution"
            ? "그 시각에 잠금화면 위로 실행 화면이 떠요"
            : alert === "soft"
              ? "알림만 와요. 화면은 뜨지 않아요"
              : "알림이 오지 않아요. 시간만 잡아둬요"}
        </Text>

        {/* **아침 요약에 넣을지.** Independent of the alert tier: a 없음 block still belongs in the day's briefing
            (that is often the whole reason it exists), and a standing 강의 may not — a briefing that lists
            everything is a briefing nobody reads by the third day. */}
        <Pressable
          onPress={() => setInBrief((v) => !v)}
          className="bg-surface flex-row items-center"
          style={{
            marginTop: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#E5E8EB",
            paddingHorizontal: 16,
            paddingVertical: 13,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "700" }}>
              아침 요약에 넣기
            </Text>
            <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }}>
              {inBrief ? "아침 요약에 들어가요" : "아침 요약에서 빼요"}
            </Text>
          </View>
          <Switch
            value={inBrief}
            onValueChange={setInBrief}
            trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
            thumbColor="#FFFFFF"
          />
        </Pressable>

        {/* 실행 결과 — the manual verdict for a settled workout/run 실행 block. The GPS auto-verdict is a default;
            this is where the user overrides it. Words per D78: 성공 · **미스** (never 실패); a miss is taupe
            (#8B7E74), never red, and its reason is asked without judgement (R14 — the app does not scold). */}
        {showVerdict && (
          <View style={{ marginTop: 18 }}>
            <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700" }}>
              실행 결과
            </Text>
            <Text className="text-grey mt-0.5 mb-2" style={{ fontSize: 12.5 }}>
              {orig?.evalSource === "location" ? "위치로 자동 판정됐어요. 직접 바꿀 수 있어요." : "직접 바꿀 수 있어요."}
            </Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={() => setVerdict("success")}
                className={verdict === "success" ? "bg-brand" : "bg-group"}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text
                  className={verdict === "success" ? "" : "text-ink"}
                  style={{ fontSize: 14, fontWeight: "700", color: verdict === "success" ? "#FFFFFF" : undefined }}
                >
                  성공
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVerdict("fail")}
                className={verdict === "fail" ? "" : "bg-group"}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: verdict === "fail" ? "#8B7E74" : undefined, // taupe, never red (D78)
                }}
              >
                <Text
                  className={verdict === "fail" ? "" : "text-ink"}
                  style={{ fontSize: 14, fontWeight: "700", color: verdict === "fail" ? "#FFFFFF" : undefined }}
                >
                  미스
                </Text>
              </Pressable>
            </View>
            {verdict === "fail" && (
              <TextInput
                value={failText}
                onChangeText={setFailText}
                placeholder="무슨 일이 있었는지 남겨둘 수 있어요 (선택)"
                placeholderTextColor="#B0B8C1"
                multiline
                className="bg-group text-ink"
                style={{
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  marginTop: 10,
                  minHeight: 60,
                  textAlignVertical: "top",
                }}
              />
            )}
          </View>
        )}

        {/* 무음 / 진동 / 소리 (D65) — independent of the tier (D43): the moment can be silent, an alert can ring.
            무음 exists because a buzz is not free: a block added only so the day is honest (강의, 이동) must be
            able to *appear* without vibrating your leg for the twentieth time, and every needless buzz spends
            the budget that keeps the one loud thing loud (C1/D30). */}
        {alert !== "none" && (
          <View style={{ marginTop: 18 }}>
            <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700" }}>
              알림 방식
            </Text>
            <Text className="text-grey mt-0.5 mb-2" style={{ fontSize: 12.5 }}>
              {loudness === "silent"
                ? alert === "execution"
                  ? "화면만 떠요. 소리도 진동도 없어요"
                  : "소리도 진동도 없어요"
                : loudness === "sound"
                  ? "소리 + 진동"
                  : "진동만"}
            </Text>
            <View className="flex-row" style={{ gap: 8 }}>
              {LOUDNESS.map((l) => (
                <Pressable
                  key={l.v}
                  onPress={() => setLoudness(l.v)}
                  className={loudness === l.v ? "bg-brand" : "bg-group"}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
                >
                  <Text
                    className={loudness === l.v ? "" : "text-ink"}
                    style={{ fontSize: 14, fontWeight: "700", color: loudness === l.v ? "#FFFFFF" : undefined }}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 어느 기기에서 실행할까 (D70). Only the execution tier takes a screen, and this only matters once the
            account has more than one phone. Everything still SYNCS everywhere — only the takeover is addressed;
            the phones you don't pick still tell you, with one buzz and a notification, at the same moment. */}
        {alert === "execution" && devices.length > 1 && (
          <View style={{ marginTop: 22 }}>
            <Text className="text-ink" style={{ fontSize: 15, fontWeight: "700" }}>
              어느 기기에서 실행할까요
            </Text>
            <Text className="text-grey mt-0.5 mb-2" style={{ fontSize: 12.5, lineHeight: 18 }}>
              고르지 않은 기기에서도 알림은 와요 (1회 진동). 화면을 뚫고 뜨는 건 고른 기기에서만이에요.
            </Text>
            <View style={{ gap: 8 }}>
              {devices.map((d) => {
                const on = executeOn.length === 0 || executeOn.includes(d.id);
                return (
                  <Pressable
                    key={d.id}
                    onPress={() =>
                      setExecuteOn((prev) => {
                        const cur = prev.length === 0 ? devices.map((x) => x.id) : prev;
                        const next = cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id];
                        // Naming nobody would be a block with no lever at all — never what anyone meant.
                        return next.length === 0 ? [d.id] : next;
                      })
                    }
                    className={on ? "bg-brand-soft" : "bg-group"}
                    style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={on ? "text-brand" : "text-grey"} style={{ fontSize: 14, fontWeight: "700" }}>
                        {d.label}
                        {d.id === selfId ? " (이 기기)" : ""}
                      </Text>
                      <Text className={on ? "text-brand" : "text-faint"} style={{ fontSize: 15, fontWeight: "700" }}>
                        {on ? "✓" : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* 알림 시점 (D45) — the user picks WHEN, up to 3 moments. Not a fixed repeat interval: nobody
            wants "every 5 minutes"; they want "an hour before, 15 minutes before, and on the dot". */}
        {alert === "soft" && (
          <>
            <SectionLabel>알림 시점</SectionLabel>
            <ChipRow>
              {sortedLeads.map((v) => (
                <Chip
                  key={v}
                  label={`${leadText(v)} ✕`}
                  on
                  onPress={() => setLeads((prev) => prev.filter((x) => x !== v))}
                />
              ))}
              {leads.length < MAX_ALERTS && !addingLead && (
                <Chip label="＋ 알림 추가" on={false} onPress={() => setAddingLead(true)} />
              )}
            </ChipRow>

            {addingLead && (
              <View style={{ marginTop: 10 }}>
                <ChipRow>
                  {SOFT_LEAD_PRESETS.filter((o) => !leads.includes(o.v)).map((o) => (
                    <Chip key={o.v} label={o.label} on={false} onPress={() => addLead(o.v)} />
                  ))}
                </ChipRow>
                <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                  <TextInput
                    value={leadInput}
                    onChangeText={(t) => setLeadInput(t.replace(/[^0-9]/g, "").slice(0, 4))}
                    keyboardType="number-pad"
                    placeholder="직접(분)"
                    placeholderTextColor="#B0B8C1"
                    className="bg-group text-ink text-center"
                    style={{ fontSize: 15, width: 96, paddingVertical: 10, borderRadius: 10 }}
                  />
                  <Pressable onPress={addLeadCustom} className="bg-brand rounded-full px-4 py-2.5">
                    <Text className="text-white" style={{ fontSize: 13, fontWeight: "700" }}>
                      추가
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setAddingLead(false)} className="px-3 py-2.5">
                    <Text className="text-grey" style={{ fontSize: 13 }}>
                      취소
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text className="text-grey mt-2" style={{ fontSize: 12.5 }}>
              {leads.length === 0
                ? "알림 시점을 하나 이상 골라주세요."
                : `${sortedLeads.map(leadText).join(" · ")}에 알려줘요. (최대 ${MAX_ALERTS}개)`}
            </Text>
          </>
        )}

        {/* 실행 알림의 시점 — the soft tier has its own 알림 시점 list above */}
        {alert === "execution" && (
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

/**
 * **달력에서 고르기** — the way to any date, not just the next three weeks.
 *
 * It was a small grey pill tucked under the chips, easy to miss and easy to mistake for a label. It is the
 * only door to 9월 개강 or 12월 시험, so it now reads as a door: full width, white, a hairline border. The chips
 * are for *soon*; this is for *anywhere*.
 */
function CalendarButton({ onPress, badge }: { onPress: () => void; badge?: string }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface flex-row items-center"
      style={{
        marginTop: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E8EB",
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <Text style={{ fontSize: 16, marginRight: 10 }}>🗓️</Text>
      <Text className="text-ink" style={{ flex: 1, fontSize: 14.5, fontWeight: "700" }}>
        달력에서 고르기
      </Text>
      {badge ? (
        <Text className="text-brand" style={{ fontSize: 12.5, fontWeight: "700", marginRight: 8 }}>
          {badge}
        </Text>
      ) : null}
      <Text className="text-faint" style={{ fontSize: 16 }}>
        ›
      </Text>
    </Pressable>
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
