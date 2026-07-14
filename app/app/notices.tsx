// 공지사항.
//
// The terms oblige us to have this (제3조 3항: a change is announced **in-app**, 7 days ahead — 30 if it costs
// the user something). Without this screen the app could not keep its own terms.
//
// It is quiet by design. This is not a place to be sold to: a notice screen that fills up with promotions is
// how the one notice that mattered gets skipped.

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { NOTICES } from "@/content/notices";
import { LegalBody } from "@/ui/LegalBody";

export default function NoticesScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(NOTICES.find((n) => n.pinned)?.id ?? null);

  return (
    <SafeAreaView className="flex-1 bg-group">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="mb-4"
        >
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>

        <Text className="text-ink" style={{ fontSize: 26, fontWeight: "700", marginBottom: 6 }}>
          공지사항
        </Text>
        {/* A notice board says what is new — it does not introduce itself, and it is not a lobby for the
            terms. (The terms' 제3조 ③ duty to post changes here is met by posting them, not by advertising it.) */}
        <Text className="text-grey" style={{ fontSize: 14, lineHeight: 21, marginBottom: 20 }}>
          새로 바뀐 것을 여기에 적어요.
        </Text>

        {NOTICES.length === 0 ? (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <Text className="text-grey" style={{ fontSize: 14 }}>
              아직 공지가 없어요.
            </Text>
          </View>
        ) : (
          NOTICES.map((n) => {
            const on = open === n.id;
            return (
              <Pressable
                key={n.id}
                onPress={() => setOpen(on ? null : n.id)}
                className="bg-surface"
                style={{ borderRadius: 18, padding: 18, marginBottom: 10 }}
              >
                <View className="flex-row items-center" style={{ marginBottom: 4 }}>
                  {n.pinned && (
                    <Text className="text-brand" style={{ fontSize: 12, fontWeight: "700", marginRight: 6 }}>
                      중요
                    </Text>
                  )}
                  <Text className="text-faint" style={{ fontSize: 12 }}>
                    {n.date}
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <Text
                    className="text-ink"
                    style={{ flex: 1, fontSize: 15.5, fontWeight: "600", lineHeight: 23 }}
                  >
                    {n.title}
                  </Text>
                  <Text className="text-faint" style={{ fontSize: 14, marginLeft: 8 }}>
                    {on ? "▲" : "▼"}
                  </Text>
                </View>

                {on && (
                  <View style={{ marginTop: 12 }}>
                    <LegalBody blocks={n.body} />
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
