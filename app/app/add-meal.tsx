// 식사 기록 / 수정 (PRD R9 · reference-apps §B4 input screen). Logged **when you eat**: meal type
// (아침/점심/저녁/간식) · food name (required) · detail · kcal (**manual only**, D27). **No photo** (D19),
// and **no 운동/러닝 record** — a workout is a TimeBlock marked success (D22). Bar: ≤2 taps + a number (S4).

import { View, Text, Pressable, TextInput, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addMeal, updateMeal, deleteMeal, listMeals, type MealEntry } from "@/core/data/mealRepository";
import { KCAL_TARGET, MEAL_ICON, MEAL_TYPES } from "@/core/logs/constants";
import { stampFor } from "@/core/logs/aggregate";
import { todayYmd, shiftYmd } from "@/core/schedule/blockScheduler";
import { newId } from "@/core/data/id";
import { hapticDeleted, hapticSaved } from "@/core/ui/haptics";
import type { MealType } from "@/core/data/types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const dateLabel = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${WD[new Date(y, m - 1, dd).getDay()]})`;
};

/** The meal you're most likely logging right now — so the common case is one tap fewer. */
function mealTypeNow(now = new Date()): MealType {
  const h = now.getHours();
  if (h < 11) return "아침";
  if (h < 15) return "점심";
  if (h < 21) return "저녁";
  return "간식";
}

export default function AddMeal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const editId = params.id;

  const [orig, setOrig] = useState<MealEntry | null>(null);
  const [date, setDate] = useState(params.date || todayYmd());
  const [mealType, setMealType] = useState<MealType>(mealTypeNow());
  const [foodName, setFoodName] = useState("");
  const [detail, setDetail] = useState("");
  const [kcal, setKcal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<MealEntry[]>([]);

  /** The same S4 friction-killer as the expense screen: your last few meals are one tap each. Manual kcal
   *  (D27) is exactly the field people give up on — so don't ask for it twice for the same food. */
  useEffect(() => {
    if (editId) return;
    (async () => {
      const all = await listMeals(); // newest first
      const seen = new Set<string>();
      const picks: MealEntry[] = [];
      for (const m of all) {
        const key = `${m.foodName}|${m.kcal}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push(m);
        if (picks.length === 6) break;
      }
      setRecent(picks);
    })();
  }, [editId]);

  const applyRecent = (m: MealEntry) => {
    setFoodName(m.foodName);
    setKcal(String(m.kcal));
    setDetail(m.detail ?? "");
    setError(null);
  };

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const m = (await listMeals()).find((x) => x.id === editId);
      if (!m) return;
      setOrig(m);
      setDate(m.date);
      setMealType(m.mealType);
      setFoodName(m.foodName);
      setDetail(m.detail ?? "");
      setKcal(m.kcal ? String(m.kcal) : "");
    })();
  }, [editId]);

  const kcalNum = kcal.trim() === "" ? 0 : parseInt(kcal, 10); // blank = 0, as in the reference app
  const canSave = foodName.trim().length > 0 && !isNaN(kcalNum);

  const save = async () => {
    if (!canSave) {
      setError("음식 이름을 적어주세요.");
      return;
    }
    const now = Date.now();
    const meal: MealEntry = {
      id: editId ?? newId("meal"),
      date,
      timestamp: orig?.date === date ? orig.timestamp : stampFor(date, now),
      mealType,
      foodName: foodName.trim(),
      detail: detail.trim() || undefined,
      kcal: kcalNum,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
    };
    if (editId) await updateMeal(meal);
    else await addMeal(meal);
    hapticSaved();
    router.back();
  };

  // Deleting a record is destructive and there is no undo, so it never happens on one tap. The reference
  // apps both asked (reference-apps.md §A4/§B4) and we quietly dropped the ask when porting them.
  const remove = () => {
    if (!editId) return;
    Alert.alert("이 식사를 지울까요?", "되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "지우기",
        style: "destructive",
        onPress: async () => {
          await deleteMeal(editId);
          hapticDeleted();
          router.back();
        },
      },
    ]);
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
        {recent.length > 0 && !editId && (
          <View style={{ marginBottom: 16 }}>
            <Text className="text-grey" style={{ fontSize: 12.5, marginBottom: 8 }}>
              최근
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {recent.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => applyRecent(m)}
                  className="bg-group"
                  style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, marginRight: 8 }}
                >
                  <Text className="text-ink" style={{ fontSize: 13, fontWeight: "600" }}>
                    {m.foodName} · {m.kcal}kcal
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text className="text-ink mb-5" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>
          {editId ? "식사 수정" : "식사"}
        </Text>

        {/* meal type — pre-picked from the clock */}
        <View className="bg-group flex-row" style={{ borderRadius: 12, padding: 4 }}>
          {MEAL_TYPES.map((m) => {
            const on = mealType === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMealType(m)}
                className="flex-1 items-center"
                style={{
                  borderRadius: 9,
                  paddingVertical: 11,
                  backgroundColor: on ? "#FFFFFF" : "transparent",
                  ...(on
                    ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }
                    : {}),
                }}
              >
                <Text style={{ fontSize: 15 }}>{MEAL_ICON[m]}</Text>
                <Text className={on ? "text-ink" : "text-grey"} style={{ fontSize: 13.5, fontWeight: on ? "700" : "500", marginTop: 2 }}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="text-grey mt-2" style={{ fontSize: 12.5 }}>
          {mealType} 목표 {KCAL_TARGET[mealType]}kcal
        </Text>

        {/* food name (required) */}
        <TextInput
          value={foodName}
          onChangeText={(t) => {
            setFoodName(t);
            setError(null);
          }}
          placeholder="무엇을 먹었나요 (예: 연어 포케)"
          placeholderTextColor="#B0B8C1"
          autoFocus={!editId}
          className="text-ink"
          style={{ fontSize: 18, fontWeight: "600", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 24 }}
        />

        {/* kcal — manual only (D27) */}
        <View className="flex-row items-baseline" style={{ borderBottomWidth: 2, borderBottomColor: "#3182F6", paddingBottom: 6, marginTop: 20 }}>
          <TextInput
            value={kcal}
            onChangeText={(t) => setKcal(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#D1D6DB"
            className="text-ink flex-1"
            style={{ fontSize: 28, fontWeight: "700", letterSpacing: -0.8 }}
          />
          <Text className="text-ink" style={{ fontSize: 17, fontWeight: "700" }}>
            kcal
          </Text>
        </View>

        {/* detail (optional) */}
        <TextInput
          value={detail}
          onChangeText={setDetail}
          placeholder="상세 (예: 식당, 소스 종류)"
          placeholderTextColor="#B0B8C1"
          className="text-ink"
          style={{ fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F6", marginTop: 12 }}
        />

        {/* date */}
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
