// Settings (PRD R8). v5 skin — mockup layout (grey ground · white grouped cards), now FULLY functional
// (no "추후 구현 예정" stubs). Two mockup slots that are out of the confirmed prototype scope were
// replaced with in-scope real features per the founder's decision (2026-07-10):
//   • 로그인/동기화 (deferred: account+cloud, PRD §7.2/R5/D35) → 실행 준비 상태 card (re-runs onboarding).
//   • 화면 테마 (deferred: full-app/later, design-system §1.4; app stays light) → 배터리 최적화 제외 row.
// Real features: 소리 (native), 기본 리드 시간 (R8 optional/local), 백업 내보내기/가져오기 (local JSON, D2/D24).

import { View, Text, Pressable, Switch, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Stack, useRouter, useFocusEffect } from "expo-router";
import { alarm } from "@/core/notifications/alarm";
import { notificationPermissionGranted } from "@/core/notifications/plainReminders";
import { getSettings, updateSettings } from "@/core/data/settingsRepository";
import { exportBackup, importBackup, type ImportMode } from "@/core/data/backup";
import { onAccountChanged, type Account } from "@/core/data/firebase";

const LEADS = [
  { label: "정각", v: 0 },
  { label: "15분 전", v: 15 },
  { label: "30분 전", v: 30 },
  { label: "1시간 전", v: 60 },
];
const leadLabel = (v: number) => LEADS.find((l) => l.v === v)?.label ?? `${v}분 전`;

export default function Settings() {
  const router = useRouter();

  const [sound, setSound] = useState(false);
  const [tone, setTone] = useState(""); // "" = the device's default alarm tone
  const [tones, setTones] = useState<{ title: string; uri: string }[]>([]);
  const [toneOpen, setToneOpen] = useState(false);
  const [ready, setReady] = useState<{ exact: boolean; fsi: boolean; notif: boolean; overlay: boolean }>({
    exact: true,
    fsi: true,
    notif: true,
    overlay: true,
  });
  const [battery, setBattery] = useState(true);
  const [lead, setLead] = useState(0);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadCustom, setLeadCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => onAccountChanged(setAccount), []);

  const refresh = useCallback(async () => {
    setSound(safeBool(() => alarm.getSound()));
    setBattery(safeBool(() => alarm.isIgnoringBatteryOptimizations()));
    setTone(safeStr(() => alarm.getAlarmTone()));
    setTones(safeList(() => alarm.listAlarmTones()));
    setReady({
      exact: safeBool(() => alarm.canScheduleExactAlarms()),
      fsi: safeBool(() => alarm.canUseFullScreenIntent()),
      notif: await notificationPermissionGranted(),
      overlay: safeBool(() => alarm.canDrawOverlays()),
    });
    setLead((await getSettings()).defaultLeadMinutes);
  }, []);

  // Re-read on focus so returning from onboarding / a system settings screen shows fresh status.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleSound = (v: boolean) => {
    setSound(v);
    alarm.setSound(v);
    if (!v) {
      alarm.stopPreview();
      setToneOpen(false);
    }
  };

  const pickLead = async (v: number) => {
    setLead(v);
    setLeadOpen(false);
    setLeadCustom("");
    await updateSettings({ defaultLeadMinutes: v });
  };
  const applyLeadCustom = async () => {
    const v = Math.max(0, parseInt(leadCustom || "", 10));
    if (isNaN(v)) return;
    await pickLead(v);
  };

  const requestBattery = () => {
    if (battery) return;
    safeBool(() => (alarm.requestIgnoreBatteryOptimizations(), true));
  };

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert("내보내기 실패", String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = (mode: ImportMode) => {
    if (busy) return;
    setBusy(true);
    (async () => {
      try {
        const r = await importBackup(mode);
        if (r.imported) {
          await refresh();
          Alert.alert("가져오기 완료", `${mode === "merge" ? "병합" : "덮어쓰기"} 완료 · 블록 ${r.blocks}개.`);
        }
      } catch (e) {
        Alert.alert("가져오기 실패", String((e as Error)?.message ?? e));
      } finally {
        setBusy(false);
      }
    })();
  };
  const promptImport = () => {
    Alert.alert("가져오기", "기존 데이터와 어떻게 합칠까요?", [
      { text: "병합 (새 항목만 추가)", onPress: () => doImport("merge") },
      { text: "덮어쓰기 (전체 교체)", style: "destructive", onPress: () => doImport("overwrite") },
      { text: "취소", style: "cancel" },
    ]);
  };

  const readyN =
    (ready.exact ? 1 : 0) + (ready.fsi ? 1 : 0) + (ready.notif ? 1 : 0) + (ready.overlay ? 1 : 0);
  const allReady = readyN === 4;

  return (
    <SafeAreaView className="flex-1 bg-group">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="mb-4">
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>

        {/* 실행 준비 상태 — replaces the login/sync card; re-runs onboarding to grant permissions */}
        <Pressable onPress={() => router.push("/onboarding" as never)} className="bg-surface flex-row items-center" style={{ borderRadius: 18, padding: 16 }}>
          <View
            className="items-center justify-center"
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: allReady ? "#F7EFD6" : "#E8F3FF" }}
          >
            <Text style={{ fontSize: 24 }}>{allReady ? "⚡" : "🔔"}</Text>
          </View>
          <View className="flex-1" style={{ marginLeft: 14 }}>
            <Text className="text-ink" style={{ fontSize: 17, fontWeight: "800" }}>
              실행 준비 상태
            </Text>
            <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
              {allReady ? "정확한 알람·잠금화면·알림·화면 위 표시 모두 켜짐" : `${readyN}/4 준비됨 · 탭해서 마저 켜기`}
            </Text>
          </View>
          <Text className="text-faint" style={{ fontSize: 20 }}>
            ›
          </Text>
        </Pressable>

        {/* 일반 */}
        <GroupLabel>일반</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Row>
            <View className="flex-1 pr-3">
              <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                소리 (새 블록 기본값)
              </Text>
              <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                {sound ? "새 블록은 소리 + 진동으로 시작해요" : "새 블록은 진동만 (블록마다 바꿀 수 있어요)"}
              </Text>
            </View>
            <Switch
              value={sound}
              onValueChange={toggleSound}
              trackColor={{ true: "#3182F6", false: "#E5E8EB" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E8EB"
            />
          </Row>

          {/* 알림음 고르기 — only meaningful when sound is on (otherwise it's vibration-only). */}
          {sound && (
            <>
              <Divider />
              <Pressable onPress={() => setToneOpen((v) => !v)}>
                <Row>
                  <Text className="text-ink flex-1" style={{ fontSize: 16, fontWeight: "700" }}>
                    알림음
                  </Text>
                  <Text className="text-brand" style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                    {tones.find((t) => t.uri === tone)?.title ?? "기기 기본"}
                  </Text>
                  <Text className="text-faint" style={{ fontSize: 18, marginLeft: 4 }}>
                    {toneOpen ? "⌄" : "›"}
                  </Text>
                </Row>
              </Pressable>
              {toneOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                  <Text className="text-grey" style={{ fontSize: 12, marginBottom: 8 }}>
                    누르면 미리 들어볼 수 있어요.
                  </Text>
                  <ToneRow
                    title="기기 기본 알람음"
                    on={tone === ""}
                    onPress={() => {
                      alarm.stopPreview();
                      alarm.setAlarmTone("");
                      setTone("");
                    }}
                  />
                  {tones.map((t) => (
                    <ToneRow
                      key={t.uri}
                      title={t.title}
                      on={tone === t.uri}
                      onPress={() => {
                        alarm.setAlarmTone(t.uri);
                        setTone(t.uri);
                        alarm.previewTone(t.uri); // hear it before committing
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          )}
          <Divider />
          <Pressable onPress={() => setLeadOpen((v) => !v)}>
            <Row>
              <Text className="text-ink flex-1" style={{ fontSize: 16, fontWeight: "700" }}>
                기본 리드 시간
              </Text>
              <Text className="text-brand" style={{ fontSize: 14, fontWeight: "600" }}>
                {leadLabel(lead)}
              </Text>
              <Text className="text-faint" style={{ fontSize: 18, marginLeft: 4 }}>
                {leadOpen ? "⌄" : "›"}
              </Text>
            </Row>
          </Pressable>
          {leadOpen && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text className="text-grey" style={{ fontSize: 12, marginBottom: 8 }}>
                새 할 일에 기본으로 채워질 값이에요.
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {LEADS.map((o) => (
                  <Chip key={o.v} label={o.label} on={lead === o.v} onPress={() => pickLead(o.v)} />
                ))}
              </View>
              <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                <TextInput
                  value={leadCustom}
                  onChangeText={setLeadCustom}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="직접(분)"
                  placeholderTextColor="#B0B8C1"
                  className="bg-group text-ink text-center"
                  style={{ fontSize: 15, width: 96, paddingVertical: 10, borderRadius: 10 }}
                />
                <Pressable onPress={applyLeadCustom} className="bg-group" style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text className="text-ink-soft" style={{ fontSize: 14, fontWeight: "600" }}>
                    적용
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          <Divider />
          <Pressable onPress={requestBattery}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  배터리 최적화 제외
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  꺼두면 절전에 알람이 지연·차단될 수 있어요
                </Text>
              </View>
              <Text className={battery ? "text-brand" : "text-warn"} style={{ fontSize: 14, fontWeight: "600" }}>
                {battery ? "해제됨" : "제한 있음"}
              </Text>
              {!battery && (
                <Text className="text-faint" style={{ fontSize: 18, marginLeft: 4 }}>
                  ›
                </Text>
              )}
            </Row>
          </Pressable>
        </View>

        {/* 데이터 */}
        <GroupLabel>데이터</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Pressable onPress={doExport} disabled={busy}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  백업 내보내기
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  모든 할 일·기록을 JSON 파일로 저장·공유
                </Text>
              </View>
              <Text className="text-faint" style={{ fontSize: 18 }}>
                {busy ? "…" : "›"}
              </Text>
            </Row>
          </Pressable>
          <Divider />
          <Pressable onPress={promptImport} disabled={busy}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  가져오기
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  백업 파일에서 병합 또는 덮어쓰기로 복원
                </Text>
              </View>
              <Text className="text-faint" style={{ fontSize: 18 }}>
                {busy ? "…" : "›"}
              </Text>
            </Row>
          </Pressable>
        </View>

        {/* 계정 — login enables SYNC and nothing else; the app is whole without it (R4/D20). */}
        <GroupLabel>계정</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Link href="/account" asChild>
            <Pressable>
              <Row>
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                    로그인 · 동기화
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                    {account ? account.email ?? "동기화 켜짐" : "로그인하면 다른 기기와 자동으로 맞춰져요"}
                  </Text>
                </View>
                <Text className="text-faint" style={{ fontSize: 18 }}>
                  ›
                </Text>
              </Row>
            </Pressable>
          </Link>
        </View>

        {/* 돌아보기 — 계획 대 실제 (R17). Counts + the collected reasons; no score, no auto-suggestion (D29/D5). */}
        <GroupLabel>돌아보기</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Link href="/review" asChild>
            <Pressable>
              <Row>
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                    계획 대 실제
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                    이 달의 해냄·미스와, 못 한 이유들
                  </Text>
                </View>
                <Text className="text-faint" style={{ fontSize: 18 }}>
                  ›
                </Text>
              </Row>
            </Pressable>
          </Link>
        </View>

        {/* 측정 — the self-experiment's instrument (S1–S5, PRD §4), dev-only */}
        {__DEV__ && (
          <>
            <GroupLabel>개발</GroupLabel>
            <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
              <Link href="/metrics" asChild>
                <Pressable>
                  <Row>
                    <View className="flex-1 pr-3">
                      <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                        측정 (S1–S5)
                      </Text>
                      <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                        실행률 · 알람 신뢰성 · 전날 계획 · 기록 마찰 · 무죄책 복귀
                      </Text>
                    </View>
                    <Text className="text-faint" style={{ fontSize: 18 }}>
                      ›
                    </Text>
                  </Row>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ToneRow({ title, on, onPress }: { title: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between"
      style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F2F4F6" }}
    >
      <Text className={on ? "text-brand" : "text-ink"} style={{ fontSize: 14, fontWeight: on ? "700" : "500" }} numberOfLines={1}>
        {title}
      </Text>
      {on && (
        <Text className="text-brand" style={{ fontSize: 14, fontWeight: "700" }}>
          ✓
        </Text>
      )}
    </Pressable>
  );
}

function safeStr(fn: () => string): string {
  try {
    return fn() ?? "";
  } catch {
    return "";
  }
}

function safeList<T>(fn: () => T[]): T[] {
  try {
    return fn() ?? [];
  } catch {
    return [];
  }
}

function safeBool(fn: () => boolean): boolean {
  try {
    return !!fn();
  } catch {
    return false;
  }
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-grey" style={{ fontSize: 13, fontWeight: "700", marginTop: 26, marginBottom: 8, marginLeft: 4 }}>
      {children}
    </Text>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-center" style={{ paddingHorizontal: 16, paddingVertical: 15 }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View className="bg-group" style={{ height: 1, marginLeft: 16 }} />;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: on ? "#3182F6" : "#F2F4F6", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}
    >
      <Text style={{ color: on ? "#FFFFFF" : "#4E5968", fontSize: 14, fontWeight: on ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}
