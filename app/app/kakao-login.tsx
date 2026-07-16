// 카카오 로그인 (D99) — the browser dance runs INSIDE this WebView so the Kakao REST key never ships in the APK
// (D93). The screen loads the Worker's /kakao/login, which 302-redirects to Kakao's consent page; after login
// Kakao redirects to the Worker's /kakao/callback, which mints a Firebase custom token and posts it back to this
// WebView. We hand the result to the account screen (kakaoAuth bridge) — it owns the sign-in + consent logic,
// exactly as it does for Google — and pop back.

import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Stack, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { kakaoLoginUrl } from "@/core/data/firebase";
import { resolveKakaoResult, type KakaoResult } from "@/core/data/kakaoAuth";

export default function KakaoLogin() {
  const router = useRouter();
  const done = useRef(false);
  const [loading, setLoading] = useState(true);

  // A fresh state nonce per open. Not security-critical here (the token is minted server-side and single-use),
  // just binds this WebView session. Date.now()+random is fine — no crypto need.
  const url = useMemo(() => kakaoLoginUrl(`s${Date.now()}${Math.floor(Math.random() * 1e6)}`), []);

  const finish = (r: KakaoResult) => {
    if (done.current) return; // the callback can fire more than once as the page settles
    done.current = true;
    resolveKakaoResult(r);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 py-2" style={{ gap: 4 }}>
        <Pressable onPress={() => finish({ cancelled: true })} hitSlop={10} className="pr-2 py-1">
          <Text className="text-ink" style={{ fontSize: 24 }}>←</Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 17, fontWeight: "700" }}>카카오 로그인</Text>
      </View>

      <View className="flex-1">
        <WebView
          source={{ uri: url }}
          incognito // don't persist a Kakao session — each login is a fresh choice
          onLoadEnd={() => setLoading(false)}
          onMessage={(e) => {
            try {
              const d = JSON.parse(e.nativeEvent.data) as KakaoResult;
              if (d?.token) finish({ token: d.token, email: d.email });
              else finish({ error: d?.error || "unknown" });
            } catch {
              finish({ error: "parse" });
            }
          }}
        />
        {loading && (
          <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-bg" pointerEvents="none">
            <ActivityIndicator color="#3182F6" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
