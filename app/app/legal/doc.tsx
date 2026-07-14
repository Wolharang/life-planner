// One policy document, in full.
//
// Reachable from the tick boxes at signup (you cannot meaningfully agree to a document you cannot open) and
// from the standing consent list.
//
// /legal/doc?doc=terms|privacy|location

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LEGAL_DOCS, shortDate, type LegalKey } from "@/content/legal";
import { LegalBody } from "@/ui/LegalBody";

export default function LegalDocScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const key: LegalKey = doc === "privacy" || doc === "location" ? doc : "terms";
  const document = LEGAL_DOCS[key];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}>
        <Text className="text-ink" style={{ fontSize: 25, fontWeight: "700", marginBottom: 16 }}>
          {document.title}
        </Text>

        {/* The version chip. No ▾: there is exactly one version of this document, and an arrow that opens
            nothing is a small lie. When a second version ships, this becomes the picker. */}
        <View
          className="self-start"
          style={{ borderWidth: 1, borderColor: "#E5E8EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}
        >
          <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "500" }}>
            {shortDate(document.effectiveDate)} 시행
          </Text>
        </View>

        <View className="bg-group" style={{ height: 1, marginTop: 20, marginBottom: 22 }} />

        <LegalBody blocks={document.blocks} />
      </ScrollView>
    </SafeAreaView>
  );
}
