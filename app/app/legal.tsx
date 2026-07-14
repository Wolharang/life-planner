// The policy documents, in full, inside the app.
//
// Reachable two ways, and both matter: from the tick boxes at signup (you cannot meaningfully agree to a
// document you cannot open) and from the quiet row at the bottom of 계정 — because consent that can only be
// read *once*, at the moment you are trying to get past it, is not really available at all.
//
// One route, three documents: /legal?doc=terms|privacy|location.

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LEGAL_DOCS, LEGAL_VERSION, type LegalKey } from "@/content/legal.generated";
import { DocText } from "@/ui/DocText";

export default function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const key: LegalKey = doc === "privacy" || doc === "location" ? doc : "terms";
  const document = LEGAL_DOCS[key];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center" style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-grey" style={{ fontSize: 14, marginLeft: 12 }}>
          {document.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}>
        <DocText body={document.body} />

        <Text className="text-faint" style={{ fontSize: 11.5, marginTop: 28, lineHeight: 18 }}>
          버전 {LEGAL_VERSION} · 이 문서가 바뀌면 시행 전에 공지사항으로 먼저 알려드려요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
