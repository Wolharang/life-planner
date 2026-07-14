// 약관 및 개인정보 처리 동의 — the list, with the date each document was agreed to.
//
// This screen exists because consent that can only be read *once*, at the moment you are trying to get past
// it, is not really available at all. Here it is a standing record: what you agreed to, and when.
//
// The date is the user's own — not the document's. "26. 07. 14." on a row means *you* said yes that day.

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LEGAL_DOCS, LEGAL_ORDER, shortDate } from "@/content/legal";
import { getConsent, type ConsentRecord } from "@/core/data/consentRepository";

const ymd = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function LegalListScreen() {
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentRecord | null>(null);

  useEffect(() => {
    getConsent().then(setConsent);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center" style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 17, fontWeight: "700", marginLeft: 16 }}>
          약관 및 개인정보 처리 동의
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}>
        <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
          필수 동의 내용
        </Text>

        {LEGAL_ORDER.map((key) => {
          const at = consent?.agreedAt?.[key];
          return (
            <Pressable
              key={key}
              onPress={() => router.push({ pathname: "/legal/doc", params: { doc: key } })}
              className="flex-row items-center"
              style={{ paddingVertical: 20 }}
            >
              <Text className="text-ink" style={{ flex: 1, fontSize: 16, fontWeight: "700" }}>
                {LEGAL_DOCS[key].title}
              </Text>
              {/* Blank until they actually agree — a date here that nobody earned would be a small lie. */}
              {at ? (
                <Text className="text-grey" style={{ fontSize: 15, marginRight: 10 }}>
                  {shortDate(ymd(at))}
                </Text>
              ) : null}
              <Text className="text-faint" style={{ fontSize: 17 }}>
                ›
              </Text>
            </Pressable>
          );
        })}

        {!consent && (
          <Text className="text-faint" style={{ fontSize: 12.5, lineHeight: 19, marginTop: 16 }}>
            아직 동의한 기록이 없어요. 가입할 때 동의하게 돼요.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
