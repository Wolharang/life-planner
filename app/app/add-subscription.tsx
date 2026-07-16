// 정기구독 입력 / 수정 (D96/D98). ADD is a Toss-style step wizard on a blank screen — 날짜 → 금액 → 결제처·결제수단
// → 제목 — decided fields stack above with light-grey labels. EDIT shows every field at once. The schedule
// (매월/매주/매일 + 결제일/요일) is chosen in a bottom sheet with scroll wheels, so a late 결제일 is one flick, not
// 31 taps. Saving runs materializeSubscriptions so a row due today lands in the log at once; editing the template
// changes only future rows, never ones already logged.

import { View, Text, Pressable, TextInput, ScrollView, Modal, StyleSheet, Animated, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  addSubscription,
  updateSubscription,
  deleteSubscription,
  listSubscriptions,
  materializeSubscriptions,
  subscriptionScheduleLabel,
  WEEKDAY_LABELS,
  type Subscription,
} from "@/core/data/subscriptionRepository";
import type { SubFrequency } from "@/core/data/types";
import { readableWon } from "@/core/logs/aggregate";
import { newId } from "@/core/data/id";
import { hapticDeleted, hapticSaved } from "@/core/ui/haptics";
import { ConfirmSheet } from "@/ui/Sheet";
import { Wheel } from "@/ui/Wheel";

const FAINT = "#B0B8C1";
const BRAND = "#3182F6";
type Step = "date" | "amount" | "extra" | "title";

const commas = (digits: string) => (digits ? Number(digits).toLocaleString("ko-KR") : "");
const scheduleLabel = (frequency: SubFrequency, dayOfMonth: number, weekday: number) =>
  subscriptionScheduleLabel({ frequency, dayOfMonth, weekday } as Subscription);

// **Module-scope, NOT defined inside the screen.** A component declared in the render body is a *new type* on
// every keystroke, so React unmounts+remounts its <TextInput> and the keyboard closes and reopens each digit.
// Hoisting them keeps the input mounted (D98 follow-up).
function AmountField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus: boolean }) {
  const num = parseInt(value.replace(/,/g, ""), 10) || 0;
  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: "700", color: BRAND }}>금액</Text>
      <View className="flex-row items-baseline" style={{ borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 8, marginTop: 6 }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(commas(t.replace(/[^0-9]/g, "")))}
          keyboardType="number-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor="#D1D6DB"
          className="text-ink flex-1"
          style={{ fontSize: 32, fontWeight: "700", letterSpacing: -1 }}
        />
        <Text style={{ fontSize: 20, fontWeight: "700", color: FAINT }}>원</Text>
      </View>
      {num > 0 && <Text style={{ fontSize: 13, color: FAINT, marginTop: 8 }}>{readableWon(num)}</Text>}
    </View>
  );
}

// A decided value shown above/below the current question, tappable to revisit it.
function DecidedField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginTop: 24 }}>
      <Text style={{ fontSize: 13, color: FAINT }}>{label}</Text>
      <View className="flex-row items-center justify-between" style={{ borderBottomWidth: 1, borderBottomColor: "#F2F4F6", paddingVertical: 10 }}>
        <Text style={{ fontSize: 19, fontWeight: "700", color: value ? "#191F28" : FAINT }}>{value || "선택"}</Text>
        <Text style={{ fontSize: 16, color: FAINT }}>⌄</Text>
      </View>
    </Pressable>
  );
}

export default function AddSubscription() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const editing = !!editId;

  const [orig, setOrig] = useState<Subscription | null>(null);
  const [step, setStep] = useState<Step>("date");
  const [sheetOpen, setSheetOpen] = useState(!editing); // ADD opens on the date sheet immediately

  // schedule
  const [frequency, setFrequency] = useState<SubFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [weekday, setWeekday] = useState(0);
  const [scheduleChosen, setScheduleChosen] = useState(editing);

  // fields
  const [amount, setAmount] = useState(""); // comma-formatted
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const s = (await listSubscriptions()).find((x) => x.id === editId);
      if (!s) return;
      setOrig(s);
      setFrequency(s.frequency ?? "monthly");
      setDayOfMonth(s.dayOfMonth ?? 1);
      setWeekday(s.weekday ?? 0);
      setAmount(commas(String(s.amount)));
      setStore(s.store ?? "");
      setPayment(s.payment ?? "");
      setName(s.name);
      setActive(s.active);
      setScheduleChosen(true);
    })();
  }, [editId]);

  const amountNum = parseInt(amount.replace(/,/g, ""), 10) || 0;
  const canSave = amountNum > 0;
  const schedText = scheduleChosen ? scheduleLabel(frequency, dayOfMonth, weekday) : "";

  const onScheduleSelect = (s: { frequency: SubFrequency; dayOfMonth: number; weekday: number }) => {
    setFrequency(s.frequency);
    setDayOfMonth(s.dayOfMonth);
    setWeekday(s.weekday);
    setScheduleChosen(true);
    setSheetOpen(false);
    if (!editing && step === "date") setStep("amount");
  };

  const save = async () => {
    if (!canSave) return;
    const now = Date.now();
    const sub: Subscription = {
      id: editId ?? newId("sub"),
      name: name.trim() || "정기구독",
      amount: amountNum,
      frequency,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
      weekday: frequency === "weekly" ? weekday : undefined,
      store: store.trim() || undefined,
      payment: payment.trim() || undefined,
      active,
      lastRun: orig?.lastRun,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
    };
    if (editing) await updateSubscription(sub);
    else await addSubscription(sub);
    await materializeSubscriptions(); // if today is a due occurrence, log it now
    hapticSaved();
    router.back();
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const doDelete = async () => {
    if (!editId) return;
    await deleteSubscription(editId);
    hapticDeleted();
    setConfirmDelete(false);
    router.back();
  };

  // ── wizard (ADD) ──────────────────────────────────────────────────────────
  const TITLES: Record<Step, string> = {
    date: "언제 결제하나요?",
    amount: "얼마를 결제하나요?",
    extra: "어디에 결제하나요?",
    title: "마지막으로\n정기구독 이름을 입력해주세요",
  };
  const primaryLabel = step === "title" ? "추가" : "다음";
  const primaryEnabled = step === "amount" ? canSave : step === "title" ? true : true;
  const onPrimary = () => {
    if (step === "amount") setStep("extra");
    else if (step === "extra") setStep("title");
    else if (step === "title") save();
  };

  const wizard = (
    <>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} className="mb-4">
          <Text className="text-ink" style={{ fontSize: 24 }}>←</Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.5, lineHeight: 33, marginBottom: 28 }}>
          {TITLES[step]}
        </Text>

        {step === "date" && (
          <DecidedField label="정기구독 날짜" value={schedText} onPress={() => setSheetOpen(true)} />
        )}

        {step === "amount" && (
          <>
            <AmountField value={amount} onChange={setAmount} autoFocus />
            <DecidedField label="결제 주기 · 날짜" value={schedText} onPress={() => setSheetOpen(true)} />
          </>
        )}

        {step === "extra" && (
          <>
            <Text style={{ fontSize: 14, color: "#8B95A1", lineHeight: 20, marginBottom: 6 }}>
              결제처와 결제수단이에요. 몰라도 괜찮아요 — 비워도 돼요.
            </Text>
            <TextInput
              value={store}
              onChangeText={setStore}
              placeholder="결제처 (예: 넷플릭스)"
              placeholderTextColor={FAINT}
              autoFocus
              className="text-ink"
              style={{ fontSize: 18, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 8 }}
            />
            <TextInput
              value={payment}
              onChangeText={setPayment}
              placeholder="결제수단 (예: 국민카드)"
              placeholderTextColor={FAINT}
              className="text-ink"
              style={{ fontSize: 18, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 8 }}
            />
            <DecidedField label="금액" value={readableWon(amountNum)} onPress={() => setStep("amount")} />
            <DecidedField label="결제 주기 · 날짜" value={schedText} onPress={() => setSheetOpen(true)} />
          </>
        )}

        {step === "title" && (
          <>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="이름 (예: 넷플릭스)"
              placeholderTextColor={FAINT}
              autoFocus
              className="text-ink"
              style={{ fontSize: 20, fontWeight: "700", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: BRAND }}
            />
            <DecidedField label="금액" value={readableWon(amountNum)} onPress={() => setStep("amount")} />
            <DecidedField label="결제 주기 · 날짜" value={schedText} onPress={() => setSheetOpen(true)} />
            {(store || payment) !== "" && (
              <DecidedField
                label="결제처 · 결제수단"
                value={[store, payment].filter(Boolean).join(" · ")}
                onPress={() => setStep("extra")}
              />
            )}
          </>
        )}
      </ScrollView>

      {step !== "date" && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 6 }}>
          <Pressable
            onPress={onPrimary}
            disabled={!primaryEnabled}
            className="items-center"
            style={{ backgroundColor: primaryEnabled ? BRAND : "#B0C9F5", borderRadius: 15, paddingVertical: 16 }}
          >
            <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>{primaryLabel}</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  // ── consolidated form (EDIT) ──────────────────────────────────────────────
  const editForm = (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={10} className="mb-3">
        <Text className="text-ink" style={{ fontSize: 24 }}>←</Text>
      </Pressable>
      <Text className="text-ink mb-6" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>정기구독 수정</Text>

      <AmountField value={amount} onChange={setAmount} autoFocus={false} />
      <DecidedField label="결제 주기 · 날짜" value={schedText} onPress={() => setSheetOpen(true)} />

      <View className="flex-row" style={{ gap: 12 }}>
        <TextInput
          value={store}
          onChangeText={setStore}
          placeholder="결제처 (선택)"
          placeholderTextColor={FAINT}
          className="text-ink flex-1"
          style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />
        <TextInput
          value={payment}
          onChangeText={setPayment}
          placeholder="결제수단 (선택)"
          placeholderTextColor={FAINT}
          className="text-ink flex-1"
          style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="이름 (예: 넷플릭스)"
        placeholderTextColor={FAINT}
        className="text-ink"
        style={{ fontSize: 17, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 20 }}
      />

      <Pressable
        onPress={save}
        disabled={!canSave}
        className="items-center"
        style={{ backgroundColor: canSave ? BRAND : "#B0C9F5", borderRadius: 15, paddingVertical: 16, marginTop: 34 }}
      >
        <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>저장</Text>
      </Pressable>
      <Pressable onPress={() => setConfirmDelete(true)} className="items-center mt-3 py-3">
        <Text className="text-warn" style={{ fontSize: 15 }}>삭제</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      {editing ? editForm : wizard}

      <ScheduleSheet
        visible={sheetOpen}
        initial={{ frequency, dayOfMonth, weekday }}
        onSelect={onScheduleSelect}
        onClose={() => setSheetOpen(false)}
      />

      <ConfirmSheet
        visible={confirmDelete}
        title="이 정기구독을 지울까요?"
        message="이미 기록된 지출은 남고, 앞으로 자동 추가만 멈춰요."
        confirmLabel="지우기"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}

// ── the schedule bottom sheet (매월/매주/매일 + 결제일/요일 wheels) ───────────────────────────────────────────
const FREQS: SubFrequency[] = ["monthly", "weekly", "daily"];
const FREQ_LABEL: Record<SubFrequency, string> = { monthly: "매월", weekly: "매주", daily: "매일" };
const DOM = Array.from({ length: 31 }, (_, i) => i + 1);
const WD = Array.from({ length: 7 }, (_, i) => i);
const ROW_H = 44;

function ScheduleSheet({
  visible,
  initial,
  onSelect,
  onClose,
}: {
  visible: boolean;
  initial: { frequency: SubFrequency; dayOfMonth: number; weekday: number };
  onSelect: (s: { frequency: SubFrequency; dayOfMonth: number; weekday: number }) => void;
  onClose: () => void;
}) {
  const [freq, setFreq] = useState<SubFrequency>(initial.frequency);
  const [dom, setDom] = useState(initial.dayOfMonth);
  const [wd, setWd] = useState(initial.weekday);

  // Drag-to-dismiss: the grab handle actually moves the sheet now. Pan lives on the header only, so the wheels
  // (ScrollViews) still take vertical drags for scrolling. Drag down past a threshold closes; a short drag springs
  // back. `ty` translates the whole card.
  const ty = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      // Claim on touch-down (the header has no tappable children) so the drag reliably engages, then also on move.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) ty.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110) Animated.timing(ty, { toValue: 700, duration: 180, useNativeDriver: true }).start(() => closeRef.current());
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
    }),
  ).current;

  // re-seed from the caller each time the sheet opens, and reset any leftover drag offset
  useEffect(() => {
    if (visible) {
      setFreq(initial.frequency);
      setDom(initial.dayOfMonth || 1);
      setWd(initial.weekday || 0);
      ty.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          className="bg-surface"
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24, transform: [{ translateY: ty }] }}
        >
          {/* grab area — drag this to move/dismiss the sheet */}
          <View {...pan.panHandlers}>
            <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "#E5E8EB", marginBottom: 18, marginTop: 4 }} />
            <Text className="text-ink" style={{ fontSize: 21, fontWeight: "800", letterSpacing: -0.4 }}>언제 결제하나요?</Text>
            <Text style={{ fontSize: 14, color: "#8B95A1", lineHeight: 20, marginTop: 8 }}>
              정한 날에 지출로 자동 기록돼요.{"\n"}매월·매주·매일 중에 고를 수 있어요.
            </Text>
          </View>

          <View style={{ flexDirection: "row", height: ROW_H * 5, marginTop: 16, justifyContent: "center" }}>
            <Wheel data={FREQS} value={freq} onChange={setFreq} format={(f) => FREQ_LABEL[f]} itemHeight={ROW_H} width={"40%" as never} />
            {freq === "monthly" && (
              <Wheel key="dom" data={DOM} value={dom} onChange={setDom} format={(v) => `${v}일`} itemHeight={ROW_H} width={"40%" as never} />
            )}
            {freq === "weekly" && (
              <Wheel key="wd" data={WD} value={wd} onChange={setWd} format={(v) => WEEKDAY_LABELS[v]} itemHeight={ROW_H} width={"40%" as never} />
            )}
            {freq === "daily" && (
              <View style={{ width: "40%", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 16, color: "#C4CBD4", fontWeight: "600" }}>매일 반복</Text>
              </View>
            )}
            {/* centre selection band */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: ROW_H * 2, height: ROW_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E5E8EB" }}
            />
          </View>

          <Pressable
            onPress={() => onSelect({ frequency: freq, dayOfMonth: dom, weekday: wd })}
            className="items-center"
            style={{ backgroundColor: BRAND, borderRadius: 15, paddingVertical: 16, marginTop: 18 }}
          >
            <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>선택</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
