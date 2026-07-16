// 정기구독 입력 / 수정 (D96). A recurring-spend template: name · amount (KRW) · 결제일 (1–31) · 결제처 · 결제수단 ·
// on/off. Managed only from here (never the normal 지출 form). Saving runs materializeSubscriptions so a row due
// today lands in the log at once. The generated monthly Expense is ordinary and editable; editing the template
// here changes only future rows, never ones already logged.

import { View, Text, Pressable, TextInput, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  addSubscription,
  updateSubscription,
  deleteSubscription,
  listSubscriptions,
  materializeSubscriptions,
  type Subscription,
} from "@/core/data/subscriptionRepository";
import { newId } from "@/core/data/id";
import { hapticDeleted, hapticSaved } from "@/core/ui/haptics";
import { ConfirmSheet } from "@/ui/Sheet";

const clampDay = (n: number) => Math.min(31, Math.max(1, n));

export default function AddSubscription() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;

  const [orig, setOrig] = useState<Subscription | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(1);
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const s = (await listSubscriptions()).find((x) => x.id === editId);
      if (!s) return;
      setOrig(s);
      setName(s.name);
      setAmount(String(s.amount));
      setDay(clampDay(s.dayOfMonth));
      setStore(s.store ?? "");
      setPayment(s.payment ?? "");
      setActive(s.active);
    })();
  }, [editId]);

  const amountNum = parseInt(amount.replace(/,/g, ""), 10);
  const canSave = !isNaN(amountNum) && amountNum > 0;

  const save = async () => {
    if (!canSave) {
      setError("금액을 적어주세요.");
      return;
    }
    const now = Date.now();
    const sub: Subscription = {
      id: editId ?? newId("sub"),
      name: name.trim() || "정기구독",
      amount: amountNum,
      dayOfMonth: clampDay(day),
      store: store.trim() || undefined,
      payment: payment.trim() || undefined,
      active,
      lastMonth: orig?.lastMonth,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
    };
    if (editId) await updateSubscription(sub);
    else await addSubscription(sub);
    // If today is (or is past) the 결제일, log it right away instead of waiting for the next app open.
    await materializeSubscriptions();
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

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} className="mb-3">
          <Text className="text-ink" style={{ fontSize: 24 }}>←</Text>
        </Pressable>
        <Text className="text-ink mb-5" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>
          {editId ? "정기구독 수정" : "정기구독"}
        </Text>

        {/* amount — first, biggest */}
        <View className="flex-row items-baseline" style={{ borderBottomWidth: 2, borderBottomColor: "#3182F6", paddingBottom: 8 }}>
          <TextInput
            value={amount}
            onChangeText={(t) => {
              setAmount(t.replace(/[^0-9]/g, ""));
              setError(null);
            }}
            keyboardType="number-pad"
            autoFocus={!editId}
            placeholder="0"
            placeholderTextColor="#D1D6DB"
            className="text-ink flex-1"
            style={{ fontSize: 34, fontWeight: "700", letterSpacing: -1 }}
          />
          <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>원 / 월</Text>
        </View>

        {/* name */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="이름 (예: 넷플릭스)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 17, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 26 }}
        />

        {/* 결제일 — 1–31, clamped to a short month's last day when it comes around */}
        <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 26, marginBottom: 10 }}>
          결제일
        </Text>
        <View className="flex-row items-center justify-between bg-group" style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={() => setDay((d) => clampDay(d - 1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>매월 {day}일</Text>
          <Pressable onPress={() => setDay((d) => clampDay(d + 1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>
        <Text className="text-grey" style={{ fontSize: 12, marginTop: 6 }}>
          29·30·31일은 그 달에 없으면 말일에 추가돼요.
        </Text>

        {/* 결제처 · 결제수단 (optional) */}
        <View className="flex-row" style={{ gap: 12 }}>
          <TextInput
            value={store}
            onChangeText={setStore}
            placeholder="결제처 (선택)"
            placeholderTextColor="#B0B8C1"
            className="text-ink flex-1"
            style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 20 }}
          />
          <TextInput
            value={payment}
            onChangeText={setPayment}
            placeholder="결제수단 (선택)"
            placeholderTextColor="#B0B8C1"
            className="text-ink flex-1"
            style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 20 }}
          />
        </View>

        {/* on/off */}
        <View className="flex-row items-center justify-between" style={{ marginTop: 26 }}>
          <View className="flex-1" style={{ paddingRight: 12 }}>
            <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>자동 추가 켜기</Text>
            <Text className="text-grey mt-0.5" style={{ fontSize: 12.5, lineHeight: 18 }}>
              끄면 다음 결제일부터 지출에 추가되지 않아요.
            </Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ true: "#3182F6", false: "#D1D6DB" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D6DB"
          />
        </View>

        {error && (
          <Text className="text-warn mt-4" style={{ fontSize: 13 }}>{error}</Text>
        )}

        <Pressable
          onPress={save}
          disabled={!canSave}
          className="items-center"
          style={{ backgroundColor: canSave ? "#3182F6" : "#B0B8C1", borderRadius: 15, paddingVertical: 16, marginTop: 32 }}
        >
          <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>저장</Text>
        </Pressable>

        {editId && (
          <Pressable onPress={() => setConfirmDelete(true)} className="items-center mt-3 py-3">
            <Text className="text-warn" style={{ fontSize: 15 }}>삭제</Text>
          </Pressable>
        )}
      </ScrollView>

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
