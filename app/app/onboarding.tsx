// First-run onboarding (PRD §8 / user-flows §1, flagged 치명). Explains WHY the lever needs its
// permissions BEFORE requesting (never a cold request), teaches the four novel mechanics, and drives the
// notification / exact-alarm / full-screen-intent grants. Shown once (AsyncStorage flag); any denial
// falls through to the persistent home banner (never fail silently). Light palette — the app is bright.

import { View, Text, Pressable, ScrollView, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState, type ReactNode } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { alarm } from "@/core/notifications/alarm";
import {
  requestNotificationPermission,
  notificationPermissionGranted,
} from "@/core/notifications/plainReminders";

export const SEEN_KEY = "lp.onboarded.v1";

export default function Onboarding() {
  const router = useRouter();
  const [notif, setNotif] = useState(true);
  const [exact, setExact] = useState(true);
  const [fsi, setFsi] = useState(true);
  const [overlay, setOverlay] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setExact(alarm.canScheduleExactAlarms());
      setFsi(alarm.canUseFullScreenIntent());
      setOverlay(alarm.canDrawOverlays());
    } catch {
      // native unavailable (dev skew) — leave granted so onboarding never blocks
    }
    setNotif(await notificationPermissionGranted());
  }, []);

  // Re-check when returning from a system settings screen.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const s = AppState.addEventListener("change", (st) => {
        if (st === "active") refresh();
      });
      return () => s.remove();
    }, [refresh])
  );

  const finish = async () => {
    await AsyncStorage.setItem(SEEN_KEY, "1");
    router.replace("/");
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-ink font-semibold mt-2" style={{ fontSize: 26, lineHeight: 34 }}>
          정한 시각에,{"\n"}잠금화면을 뚫고 개입해요
        </Text>
        <Text className="text-ink-soft mt-3" style={{ fontSize: 15, lineHeight: 22 }}>
          계획이 무너지는 바로 그 순간, 앱이 잠금화면 위로 떠서 '딱 첫 동작'만 하게 만들어요. 그러려면 아래
          권한이 필요해요.
        </Text>

        <View className="mt-6" style={{ gap: 10 }}>
          <Mechanic n="①" t="실행의 순간" d="정한 시각에 잠금화면 위로 떠서 5·4·3·2·1 뒤 딱 첫 동작만." />
          <Mechanic n="②" t="오늘은 쉼" d="못 하는 날은 미리 꺼둘 수 있어요 — 죄책감 없이." />
          <Mechanic n="③" t="놓쳐도 괜찮아" d="놓친 건 다음에 이어서. 스트릭·벌점은 없어요." />
          <Mechanic n="④" t="소리는 기본 꺼짐" d="평소엔 진동만. 원하면 설정에서 소리를 켜요." />
        </View>

        <Text className="text-ink-soft mt-8 mb-2" style={{ fontSize: 13 }}>
          권한 (지금 다 켜지 않아도 돼요)
        </Text>
        <PermRow
          label="알림 허용"
          hint="단순 알림·실행 알림에 필요해요"
          done={notif}
          onPress={async () => {
            await requestNotificationPermission();
            refresh();
          }}
        />
        <PermRow
          label="정확한 알람 허용"
          hint="정한 시각에 정확히 울리게 해요"
          done={exact}
          onPress={() => alarm.openExactAlarmSettings()}
        />
        <PermRow
          label="잠금화면 표시 허용"
          hint="잠금화면을 뚫고 실행 화면을 띄워요"
          done={fsi}
          onPress={() => alarm.openFullScreenIntentSettings()}
        />
        <PermRow
          label="다른 앱 위에 표시 허용"
          hint="폰을 쓰는 중에도 그 시각에 바로 실행 화면이 떠요 (없으면 알림만 오고, 눌러야 떠요)"
          done={overlay}
          onPress={() => alarm.openOverlaySettings()}
        />

        <Pressable
          onPress={finish}
          className="rounded-full items-center mt-8"
          style={{ backgroundColor: "#3182F6", paddingVertical: 16 }}
        >
          <Text className="text-white font-semibold" style={{ fontSize: 17 }}>
            시작하기
          </Text>
        </Pressable>
        <Text className="text-faint text-center mt-3" style={{ fontSize: 12 }}>
          거부해도 홈에서 언제든 다시 켤 수 있어요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Mechanic({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <View className="bg-surface border border-line rounded-card px-4 py-3 flex-row">
      <Text className="text-brand font-semibold" style={{ fontSize: 15, marginRight: 10 }}>
        {n}
      </Text>
      <View className="flex-1">
        <Text className="text-ink font-semibold" style={{ fontSize: 14 }}>
          {t}
        </Text>
        <Text className="text-ink-soft mt-0.5" style={{ fontSize: 12, lineHeight: 17 }}>
          {d}
        </Text>
      </View>
    </View>
  );
}

function PermRow({
  label,
  hint,
  done,
  onPress,
}: {
  label: string;
  hint: string;
  done: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-line rounded-card px-4 py-3.5 flex-row items-center justify-between mb-2"
    >
      <View className="flex-1 pr-3">
        <Text className="text-ink font-semibold" style={{ fontSize: 15 }}>
          {label}
        </Text>
        <Text className="text-ink-soft mt-0.5" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      </View>
      {done ? (
        <Text className="text-brand font-semibold" style={{ fontSize: 14 }}>
          ✓ 됨
        </Text>
      ) : (
        <View className="bg-brand rounded-full px-3.5 py-1.5">
          <Text className="text-white font-semibold" style={{ fontSize: 12 }}>
            켜기
          </Text>
        </View>
      )}
    </Pressable>
  );
}
