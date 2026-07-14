// 약관 및 개인정보 처리 동의 — the standing record: what was agreed to, when, and on which phone.
//
// Consent that can only be read *once*, at the moment you are trying to get past it, is not really available
// at all. Here it stands: each item with **the second it was ticked** — they are separate acts, so they carry
// separate times — and the device it was given on.

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AGE_CONSENT, LEGAL_DOCS, shortDate } from "@/content/legal";
import {
  CONSENT_ITEMS,
  getConsent,
  type ConsentItem,
  type ConsentRecord,
} from "@/core/data/consentRepository";

const p2 = (n: number) => String(n).padStart(2, "0");

/** "26. 07. 14." — the date the row was agreed. */
const dateOf = (ms: number) => {
  const d = new Date(ms);
  return shortDate(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
};

/** "14:22:07" — to the second, because that is what was asked for and what a record is worth. */
const timeOf = (ms: number) => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};

const titleOf = (item: ConsentItem) =>
  item === "age" ? "만 19세 이상 확인" : LEGAL_DOCS[item].title;

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

        {CONSENT_ITEMS.map((item) => {
          const at = consent?.agreedAt?.[item];
          const isAge = item === "age"; // a statement, not a document — nothing to open
          return (
            <Pressable
              key={item}
              disabled={isAge}
              onPress={() => router.push({ pathname: "/legal/doc", params: { doc: item } })}
              className="flex-row items-center"
              style={{ paddingVertical: 18 }}
            >
              <Text className="text-ink" style={{ flex: 1, fontSize: 15.5, fontWeight: "700" }}>
                {titleOf(item)}
              </Text>

              {/* Blank until they actually agree — a date nobody earned would be a small lie. */}
              {at ? (
                <View style={{ alignItems: "flex-end", marginRight: isAge ? 0 : 10 }}>
                  <Text className="text-grey" style={{ fontSize: 14 }}>
                    {dateOf(at)}
                  </Text>
                  <Text className="text-faint" style={{ fontSize: 11.5, marginTop: 1 }}>
                    {timeOf(at)}
                  </Text>
                </View>
              ) : null}

              {!isAge && (
                <Text className="text-faint" style={{ fontSize: 17 }}>
                  ›
                </Text>
              )}
            </Pressable>
          );
        })}

        {consent ? (
          <View className="bg-group" style={{ borderRadius: 12, padding: 14, marginTop: 16 }}>
            <Text className="text-grey" style={{ fontSize: 12.5, lineHeight: 19 }}>
              동의한 기기 · {consent.deviceLabel}
            </Text>
            <Text className="text-faint" style={{ fontSize: 11.5, lineHeight: 18, marginTop: 3 }}>
              약관 버전 {consent.version}
            </Text>
          </View>
        ) : (
          <Text className="text-faint" style={{ fontSize: 12.5, lineHeight: 19, marginTop: 16 }}>
            아직 동의한 기록이 없어요. 가입할 때 동의하게 돼요.
          </Text>
        )}

        <Text className="text-faint" style={{ fontSize: 11.5, lineHeight: 18, marginTop: 14 }}>
          {AGE_CONSENT.replace("[필수] ", "")}는 문서가 아니라 확인 항목이라 따로 열어볼 내용이 없어요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
