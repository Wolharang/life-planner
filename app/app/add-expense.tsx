// 지출 입력 / 수정 (PRD R8 · reference-apps §A4 input screen). Logged **in the moment money is spent**:
// category (8 fixed, D16) · name (required) · amount (KRW, required, D25) · store · payment (free text,
// D26). The bar for this screen is **S4: ≤2 taps + the amount** — so the date defaults to today, the
// category is one tap, and the amount field is focused first.

import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addExpense, updateExpense, deleteExpense, listExpenses, type Expense } from "@/core/data/expenseRepository";
import { CATEGORY_COLOR, CATEGORY_ICON, EXPENSE_CATEGORIES } from "@/core/logs/constants";
import { stampFor } from "@/core/logs/aggregate";
import { newId } from "@/core/data/id";
import { todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import type { ExpenseCategory } from "@/core/data/types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const dateLabel = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${WD[new Date(y, m - 1, dd).getDay()]})`;
};

export default function AddExpense() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const editId = params.id;

  const [orig, setOrig] = useState<Expense | null>(null);
  const [date, setDate] = useState(params.date || todayYmd());
  const [category, setCategory] = useState<ExpenseCategory>("주식");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const e = (await listExpenses()).find((x) => x.id === editId);
      if (!e) return;
      setOrig(e);
      setDate(e.date);
      setCategory(e.category);
      setName(e.name);
      setAmount(String(e.amount));
      setStore(e.store ?? "");
      setPayment(e.payment ?? "");
      setMemo(e.memo ?? "");
    })();
  }, [editId]);

  const amountNum = parseInt(amount.replace(/,/g, ""), 10); // the reference app strips commas
  // The bar is **≤2 taps + the amount** (S4/R8): only the amount is genuinely required. A blank name
  // falls back to the category (간식 → "간식"), so logging never demands the keyboard twice — the
  // reference app's "name required" gate was the single biggest friction, and forgotten logs are the
  // problem we're solving (C2).
  const canSave = !isNaN(amountNum) && amountNum > 0;

  const save = async () => {
    if (!canSave) {
      setError("금액을 적어주세요.");
      return;
    }
    const now = Date.now();
    const expense: Expense = {
      id: editId ?? newId("expense"),
      date,
      // the reference apps' convention: the CHOSEN date + the current clock time
      timestamp: orig?.date === date ? orig.timestamp : stampFor(date, now),
      name: name.trim() || category,
      amount: amountNum,
      category,
      store: store.trim() || undefined,
      payment: payment.trim() || undefined,
      memo: memo.trim() || undefined,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
    };
    if (editId) await updateExpense(expense);
    else await addExpense(expense);
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    await deleteExpense(editId);
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
        <Text className="text-ink mb-5" style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}>
          {editId ? "지출 수정" : "지출"}
        </Text>

        {/* amount — first, biggest: the one number that must be typed */}
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
            style={{ fontSize: 34, fontWeight: "800", letterSpacing: -1 }}
          />
          <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>
            원
          </Text>
        </View>

        {/* category — one tap (8 fixed, D16) */}
        <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 26, marginBottom: 10 }}>
          분류
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {EXPENSE_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                className="items-center"
                style={{
                  width: "23%",
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: on ? CATEGORY_COLOR[c] : "#F2F4F6",
                }}
              >
                <Text style={{ fontSize: 17 }}>{CATEGORY_ICON[c]}</Text>
                <Text
                  style={{ fontSize: 11.5, fontWeight: on ? "700" : "500", color: on ? "#FFFFFF" : "#4E5968", marginTop: 3 }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* name (required) */}
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="이름 (선택 — 비우면 분류 이름)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 17, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 26 }}
        />

        {/* store · payment (optional) */}
        <View className="flex-row" style={{ gap: 12 }}>
          <TextInput
            value={store}
            onChangeText={setStore}
            placeholder="구매처 (예: GS25)"
            placeholderTextColor="#B0B8C1"
            className="text-ink flex-1"
            style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 6 }}
          />
          <TextInput
            value={payment}
            onChangeText={setPayment}
            placeholder="결제수단 (예: 네이버페이)"
            placeholderTextColor="#B0B8C1"
            className="text-ink flex-1"
            style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 6 }}
          />
        </View>

        {/* memo (optional) — data-model §2.4 */}
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="메모 (선택)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 6 }}
        />

        {/* date — defaults to today; only touched when back-filling */}
        <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginTop: 26, marginBottom: 10 }}>
          날짜
        </Text>
        <View className="flex-row items-center justify-between bg-group" style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, -1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>‹</Text>
          </Pressable>
          <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>{dateLabel(date)}</Text>
          <Pressable onPress={() => setDate((d) => shiftYmd(d, 1))} hitSlop={10} className="px-3 py-1">
            <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700" }}>›</Text>
          </Pressable>
        </View>

        {error && (
          <Text className="text-warn mt-4" style={{ fontSize: 13 }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={save}
          disabled={!canSave}
          className="items-center"
          style={{ backgroundColor: canSave ? "#3182F6" : "#B0B8C1", borderRadius: 15, paddingVertical: 16, marginTop: 32 }}
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
