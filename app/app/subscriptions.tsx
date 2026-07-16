// 정기구독 관리 (D96/D98) — reached from the 오늘 button's left on the 지출 tab. A subscription is a template: on
// each occurrence of its schedule (매월/매주/매일) it auto-adds an ordinary 지출 row (category 정기구독). Here the
// user sees the list, flips each one on/off in place, taps one to edit, or adds a new one. Generation lives in
// subscriptionRepository (materializeSubscriptions), run on 기록 focus + app open — not here.
//
// **Design (D98):** background-free rows (no grey cards) — name + a chevron over a "매월 11일 · 75,000원" line,
// toggle at the right — matching the bank-app reference the founder gave.

import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  listSubscriptions,
  setSubscriptionActive,
  subscriptionScheduleLabel,
  type Subscription,
} from "@/core/data/subscriptionRepository";
import { won } from "@/core/logs/aggregate";

export default function Subscriptions() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);

  const reload = useCallback(() => {
    listSubscriptions().then(setSubs);
  }, []);
  useFocusEffect(reload);

  const toggle = async (s: Subscription, active: boolean) => {
    setSubs((cur) => cur.map((x) => (x.id === s.id ? { ...x, active } : x))); // optimistic
    await setSubscriptionActive(s.id, active);
    reload();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center px-5 pt-3 pb-2" style={{ gap: 4 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} className="pr-2 py-1">
          <Text className="text-ink" style={{ fontSize: 24 }}>←</Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>
          정기구독
        </Text>
      </View>
      <Text className="text-grey px-5" style={{ fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
        정한 날에 지출로 자동 추가돼요. 끄면 그때부터 멈춰요.
      </Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 }}>
        {subs.length === 0 ? (
          <Text className="text-grey text-center mt-20" style={{ fontSize: 14, lineHeight: 21 }}>
            아직 정기구독이 없어요.{"\n"}아래에서 추가해 보세요.
          </Text>
        ) : (
          subs.map((s) => (
            <View key={s.id} className="flex-row items-center" style={{ paddingVertical: 16 }}>
              {/* tap the body to edit */}
              <Pressable
                onPress={() => router.push({ pathname: "/add-subscription", params: { id: s.id } } as never)}
                className="flex-1"
                style={{ opacity: s.active ? 1 : 0.5, paddingRight: 12 }}
              >
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <Text className="text-ink" style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.4 }} numberOfLines={1}>
                    {s.name || "정기구독"}
                  </Text>
                  <Text className="text-grey" style={{ fontSize: 16, fontWeight: "600", marginTop: 1 }}>›</Text>
                </View>
                <Text className="text-grey" style={{ fontSize: 14, marginTop: 5 }} numberOfLines={1}>
                  {subscriptionScheduleLabel(s)}
                  <Text className="text-faint">{"   ｜   "}</Text>
                  {won(s.amount)}
                </Text>
              </Pressable>

              <Switch
                value={s.active}
                onValueChange={(v) => toggle(s, v)}
                trackColor={{ true: "#3182F6", false: "#D1D6DB" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D6DB"
              />
            </View>
          ))
        )}
      </ScrollView>

      {/* add — same pinned-primary pattern as the 기록 tab */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, paddingHorizontal: 20 }}>
        <Pressable
          onPress={() => router.push("/add-subscription" as never)}
          accessibilityRole="button"
          accessibilityLabel="정기구독 추가"
          className="bg-brand items-center"
          style={{ borderRadius: 15, paddingVertical: 16, elevation: 4 }}
        >
          <Text className="text-white" style={{ fontSize: 16, fontWeight: "700" }}>
            ＋ 정기구독 추가
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
