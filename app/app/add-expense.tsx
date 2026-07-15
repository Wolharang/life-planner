// 지출 입력 / 수정 (PRD R8 · reference-apps §A4 input screen). Logged **in the moment money is spent**:
// category (8 fixed, D16) · name (required) · amount (KRW, required, D25) · store · payment (free text,
// D26). The bar for this screen is **S4: ≤2 taps + the amount** — so the date defaults to today, the
// category is one tap, and the amount field is focused first.

import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addExpense, updateExpense, deleteExpense, listExpenses, type Expense } from "@/core/data/expenseRepository";
import { addMeal } from "@/core/data/mealRepository";
import { CATEGORY_COLOR, EXPENSE_CATEGORIES } from "@/core/logs/constants";
import { CategoryIcon } from "@/ui/icons/LogIcons";
import { stampFor } from "@/core/logs/aggregate";
import { newId } from "@/core/data/id";
import { hapticDeleted, hapticSaved } from "@/core/ui/haptics";
import { todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { ConfirmSheet } from "@/ui/Sheet";
import type { ExpenseCategory, MealType } from "@/core/data/types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const dateLabel = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${WD[new Date(y, m - 1, dd).getDay()]})`;
};

/** Default the 주식 → meal type by the clock, like the meal screen (아침/점심/저녁). */
function mealTypeNow(now = new Date()): MealType {
  const h = now.getHours();
  return h < 11 ? "아침" : h < 17 ? "점심" : "저녁";
}

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
  const [recent, setRecent] = useState<Expense[]>([]);
  // 주식/간식 → optional link into the meal log (founder). Only offered when ADDING (editing an expense does
  // not re-link — the meal was already created at add time, and re-linking would duplicate it).
  const [mealType, setMealType] = useState<MealType>(mealTypeNow());
  const [kcal, setKcal] = useState("");

  /**
   * **The friction-killer S4 is graded on.** `features/execution-integrated-day.md §3.5` specifies "a fast
   * sheet **with presets**", and `references-solutions.md` names "preset chips + 최근/빈도 one-tap" as *the*
   * answer to logging friction. Neither was built: this was a blank full-screen form, and the one number you
   * must type was the *least* of the work. Your last few purchases are one tap each — the same 편의점 커피, the
   * same 점심, over and over. That is what "≤2 taps" actually means in a real day.
   */
  useEffect(() => {
    if (editId) return;
    (async () => {
      const all = await listExpenses(); // newest first
      const seen = new Set<string>();
      const picks: Expense[] = [];
      for (const e of all) {
        const key = `${e.category}|${e.name}|${e.amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push(e);
        if (picks.length === 6) break;
      }
      setRecent(picks);
    })();
  }, [editId]);

  const applyRecent = (e: Expense) => {
    setCategory(e.category);
    setName(e.name);
    setAmount(String(e.amount));
    setStore(e.store ?? "");
    setPayment(e.payment ?? "");
    setError(null);
  };

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
  // 주식/간식 spending can also be a meal — offer the link (add mode only).
  const linksMeal = !editId && (category === "주식" || category === "간식");
  const kcalNum = parseInt(kcal.replace(/,/g, ""), 10) || 0;

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

    // Link 주식/간식 into the meal log when a calorie was entered (0 → cancelled, no meal). The food name is
    // the expense name; the meal memo is the store + memo (구매처 + 메모); 주식 uses the chosen 끼니, 간식 → 간식.
    if (linksMeal && kcalNum > 0) {
      const detail = [store.trim(), memo.trim()].filter(Boolean).join(" ");
      await addMeal({
        id: newId("meal"),
        date,
        timestamp: expense.timestamp,
        mealType: category === "간식" ? "간식" : mealType,
        foodName: expense.name,
        detail: detail || undefined,
        kcal: kcalNum,
        createdAt: now,
        updatedAt: now,
      });
    }

    hapticSaved();
    router.back();
  };

  // Deleting a record is destructive and there is no undo, so it never happens on one tap.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = () => {
    if (editId) setConfirmDelete(true);
  };
  const doDelete = async () => {
    if (!editId) return;
    await deleteExpense(editId);
    hapticDeleted();
    setConfirmDelete(false);
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
        <Text className="text-ink mb-5" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>
          {editId ? "지출 수정" : "지출"}
        </Text>

        {/* 최근 — one tap fills the whole form (S4). The same coffee, the same lunch, over and over. */}
        {recent.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text className="text-grey" style={{ fontSize: 12.5, marginBottom: 8 }}>
              최근
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {recent.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => applyRecent(e)}
                  className="bg-group flex-row items-center"
                  style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, marginRight: 8, gap: 5 }}
                >
                  <CategoryIcon category={e.category} size={15} color={CATEGORY_COLOR[e.category]} />
                  <Text className="text-ink" style={{ fontSize: 13, fontWeight: "600" }}>
                    {e.name} · {e.amount.toLocaleString()}원
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

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
            style={{ fontSize: 34, fontWeight: "700", letterSpacing: -1 }}
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
                <CategoryIcon category={c} size={22} color={on ? "#FFFFFF" : CATEGORY_COLOR[c]} />
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

        {/* 식사 연동 — 주식/간식만 (D6). 칼로리를 적으면 식사 기록에 자동으로 함께 남고, 0이면 연동하지 않는다. */}
        {linksMeal && (
          <View style={{ marginTop: 26 }}>
            <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
              식사 기록에 함께 추가
            </Text>
            <Text className="text-grey" style={{ fontSize: 12.5, lineHeight: 18, marginBottom: 10 }}>
              {category === "간식"
                ? "칼로리를 적으면 식사의 ‘간식’에 자동으로 함께 기록돼요. 0이면 추가하지 않아요."
                : "끼니를 고르고 칼로리를 적으면 식사에 자동으로 함께 기록돼요. 0이면 추가하지 않아요."}
            </Text>
            {category === "주식" && (
              <View className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
                {(["아침", "점심", "저녁"] as MealType[]).map((m) => {
                  const on = mealType === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMealType(m)}
                      className={on ? "bg-brand" : "bg-group"}
                      style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
                    >
                      <Text
                        className={on ? "" : "text-ink"}
                        style={{ fontSize: 14, fontWeight: "700", color: on ? "#FFFFFF" : undefined }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View className="flex-row items-baseline" style={{ borderBottomWidth: 1, borderBottomColor: "#F2F4F6", paddingBottom: 6 }}>
              <TextInput
                value={kcal}
                onChangeText={(t) => setKcal(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#D1D6DB"
                className="text-ink flex-1"
                style={{ fontSize: 18, fontWeight: "700" }}
              />
              <Text className="text-grey" style={{ fontSize: 15, fontWeight: "600" }}>
                kcal
              </Text>
            </View>
          </View>
        )}

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

      <ConfirmSheet
        visible={confirmDelete}
        title="이 지출을 지울까요?"
        message="되돌릴 수 없어요."
        confirmLabel="지우기"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}
