// Account (PRD R4 · F0). v5 skin — grey ground, white grouped cards, matching /settings.
//
// The whole point of this screen is what it does NOT do: it never blocks anything. The app is fully usable
// with no account (D20) — this screen only turns **sync** on. So it opens by saying so, in plain Korean, and
// a failure to log in is stated as a fact and never as a fault (B2/R14: the app does not scold).
//
// Sync is not a feature of the lever. Losing it costs you the other phone; it must never cost you the moment.

import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  authErrorMessage,
  firebaseAvailable,
  googleAvailable,
  onAccountChanged,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  type Account,
} from "@/core/data/firebase";

type Mode = "signIn" | "signUp";

export default function AccountScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAccountChanged(setAccount), []);

  const available = firebaseAvailable();
  const withGoogle = googleAvailable();

  const google = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(authErrorMessage(e)); // "" when the user simply backed out of the sheet
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signUp") await signUp(email, password);
      else await signIn(email, password);
      setPassword("");
      // The sync engine is watching the auth state (app/_layout) — it pushes this device's rows up, then
      // starts listening. Nothing to do here.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-group">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
          계정
        </Text>
        <Text className="text-grey" style={{ fontSize: 14, lineHeight: 21, marginBottom: 20 }}>
          로그인은 <Text style={{ fontWeight: "700" }}>기기 간 동기화</Text>만 켜요. 로그인하지 않아도 앱의 모든 기능은
          그대로 동작하고, 로그아웃해도 이 기기의 기록은 지워지지 않아요.
        </Text>

        {!available ? (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600", marginBottom: 6 }}>
              이 빌드에서는 동기화를 쓸 수 없어요
            </Text>
            <Text className="text-grey" style={{ fontSize: 13, lineHeight: 20 }}>
              앱은 평소대로 쓰면 돼요. 모든 기록은 이 기기에 안전하게 저장돼요.
            </Text>
          </View>
        ) : account ? (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <Text className="text-grey" style={{ fontSize: 12, marginBottom: 4 }}>
              동기화 켜짐
            </Text>
            <Text className="text-ink" style={{ fontSize: 17, fontWeight: "600", marginBottom: 14 }}>
              {account.email ?? "로그인됨"}
            </Text>
            <Text className="text-grey" style={{ fontSize: 13, lineHeight: 20, marginBottom: 18 }}>
              일정·시간블록·지출·식사가 다른 기기와 자동으로 맞춰져요. 오프라인에서 바꾼 것은 연결되면 올라가요.
            </Text>
            <Pressable
              onPress={leave}
              disabled={busy}
              className="bg-group items-center"
              style={{ borderRadius: 12, paddingVertical: 14, opacity: busy ? 0.5 : 1 }}
            >
              <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600" }}>
                로그아웃
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <View className="flex-row" style={{ marginBottom: 16 }}>
              <Tab label="로그인" on={mode === "signIn"} onPress={() => setMode("signIn")} />
              <Tab label="가입" on={mode === "signUp"} onPress={() => setMode("signUp")} />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              placeholderTextColor="#B0B8C1"
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-group text-ink"
              style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 10 }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호 (6자 이상)"
              placeholderTextColor="#B0B8C1"
              autoCapitalize="none"
              secureTextEntry
              className="bg-group text-ink"
              style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 }}
            />

            {error ? (
              // A miss is neutral data and so is a failed login — stated, never scolded (no red-alarm UI).
              <Text className="text-grey" style={{ fontSize: 13, marginTop: 10 }}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              className="bg-brand items-center"
              style={{ borderRadius: 12, paddingVertical: 15, marginTop: 16, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                  {mode === "signUp" ? "가입하고 동기화 켜기" : "로그인하고 동기화 켜기"}
                </Text>
              )}
            </Pressable>

            {withGoogle && (
              <>
                <View className="flex-row items-center" style={{ marginVertical: 16 }}>
                  <View className="bg-group" style={{ flex: 1, height: 1 }} />
                  <Text className="text-faint" style={{ fontSize: 12, marginHorizontal: 10 }}>
                    또는
                  </Text>
                  <View className="bg-group" style={{ flex: 1, height: 1 }} />
                </View>
                <Pressable
                  onPress={google}
                  disabled={busy}
                  className="items-center"
                  style={{
                    borderRadius: 12,
                    paddingVertical: 15,
                    borderWidth: 1,
                    borderColor: "#E5E8EB",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600" }}>
                    Google로 계속하기
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={on ? "bg-brand" : "bg-group"}
      style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18, marginRight: 8 }}
    >
      <Text
        className={on ? "" : "text-grey"}
        style={{ fontSize: 14, fontWeight: "600", color: on ? "#FFFFFF" : undefined }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
