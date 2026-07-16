// 정기구독 관리 (D96) — the small editor reached from the 오늘 button's left on the 지출 tab. A subscription is a
// template: on its 결제일 each month it auto-adds an ordinary 지출 row (category 정기구독). Here the user sees the
// list, flips each one on/off in place, taps one to edit, or adds a new one. Generation itself lives in
// subscriptionRepository (materializeSubscriptions), run on 기록 focus and app open — not here.

import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  listSubscriptions,
  setSubscriptionActive,
  type Subscription,
} from "@/core/data/subscriptionRepository";
import { won } from "@/core/logs/aggregate";
import { CATEGORY_COLOR } from "@/core/logs/constants";
import { CategoryIcon } from "@/ui/icons/LogIcons";

const SUB_COLOR = CATEGORY_COLOR["정기구독"];

export default function Subscriptions() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);

  const reload = useCallback(() => {
    listSubscriptions().then(setSubs);
  }, []);
  useFocusEffect(reload);

  const toggle = async (s: Subscription, active: boolean) => {
    // optimistic — flip the row immediately, then persist
    setSubs((cur) => cur.map((x) => (x.id === s.id ? { ...x, active } : x)));
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
      <Text className="text-grey px-5" style={{ fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
        매달 정한 날에 지출로 자동 추가돼요. 끄면 그 달부터 추가되지 않아요.
      </Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 120 }}>
        {subs.length === 0 ? (
          <Text className="text-grey text-center mt-20" style={{ fontSize: 14, lineHeight: 21 }}>
            아직 정기구독이 없어요.{"\n"}아래에서 추가해 보세요.
          </Text>
        ) : (
          subs.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center bg-group rounded-card mb-2"
              style={{ paddingLeft: 13, paddingRight: 12, paddingVertical: 12, opacity: s.active ? 1 : 0.6 }}
            >
              {/* tap the body to edit */}
              <Pressable
                onPress={() => router.push({ pathname: "/add-subscription", params: { id: s.id } } as never)}
                className="flex-row items-center flex-1"
                style={{ gap: 11 }}
              >
                <View
                  className="items-center justify-center"
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${SUB_COLOR}2E` }}
                >
                  <CategoryIcon category="정기구독" size={19} color={SUB_COLOR} />
                </View>
                <View className="flex-1">
                  <Text className="text-ink" style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
                    {s.name || "정기구독"}
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 12.5 }} numberOfLines={1}>
                    {`매월 ${s.dayOfMonth}일 · ${won(s.amount)}`}
                    {[s.store, s.payment].filter(Boolean).length > 0
                      ? ` · ${[s.store, s.payment].filter(Boolean).join(" · ")}`
                      : ""}
                  </Text>
                </View>
              </Pressable>

              <Switch
                value={s.active}
                onValueChange={(v) => toggle(s, v)}
                trackColor={{ true: "#3182F6", false: "#D1D6DB" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D6DB"
                style={{ marginLeft: 6 }}
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
