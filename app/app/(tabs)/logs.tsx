// 기록 (Logs) tab — placeholder. The real in-the-moment expense + meal logging (PRD R8/R9, ported from
// reference/calculator.js + reference/kcal.js) is a later feature; this reserves the tab for now.

import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Logs() {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-baseline justify-between px-5 pt-4 pb-2">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
          기록
        </Text>
      </View>
      <View className="flex-1 items-center justify-center px-10">
        <Text style={{ fontSize: 34, marginBottom: 12 }}>🧾</Text>
        <Text className="text-ink text-center" style={{ fontSize: 16, fontWeight: "700" }}>
          지출·식사 기록은 곧 만나요
        </Text>
        <Text className="text-grey text-center mt-2" style={{ fontSize: 13, lineHeight: 19 }}>
          쓴 순간·먹은 순간에 몇 번의 탭으로 남기는 기록 탭을 준비하고 있어요.
        </Text>
      </View>
    </SafeAreaView>
  );
}
