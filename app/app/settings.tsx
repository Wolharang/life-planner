// Settings (PRD R8). v5 skin — mockup layout (grey ground · white grouped cards), now FULLY functional
// (no "추후 구현 예정" stubs). Two mockup slots that are out of the confirmed prototype scope were
// replaced with in-scope real features per the founder's decision (2026-07-10):
//   • 로그인/동기화 (deferred: account+cloud, PRD §7.2/R5/D35) → 실행 준비 상태 card (re-runs onboarding).
//   • 화면 테마 (deferred: full-app/later, design-system §1.4; app stays light) → 배터리 최적화 제외 row.
// Real features: 소리 (native), 기본 리드 시간 (R8 optional/local), 백업 내보내기/가져오기 (local JSON, D2/D24).

import { View, Text, Pressable, Switch, TextInput, ScrollView, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Stack, useRouter, useFocusEffect } from "expo-router";
import { alarm } from "@/core/notifications/alarm";
import { notificationPermissionGranted } from "@/core/notifications/plainReminders";
import { getSettings, updateSettings } from "@/core/data/settingsRepository";
import { rescheduleMorningBrief } from "@/core/notifications/morningBrief";
import { exportBackup, importBackup, type ImportMode } from "@/core/data/backup";
import { onAccountChanged, type Account } from "@/core/data/firebase";
import { evidenceCount, resetEvidence } from "@/core/data/evidence";
import { eraseAllRecords } from "@/core/data/erase";
import { Sheet, ConfirmSheet } from "@/ui/Sheet";

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
  const [briefOn, setBriefOn] = useState(true);
  const [briefTime, setBriefTime] = useState("07:00");
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
    const st = await getSettings();
    setLead(st.defaultLeadMinutes);
    setBriefOn(st.morningBriefOn);
    setBriefTime(st.morningBriefTime);
  }, []);

  // Any change to the briefing must re-cut the next two weeks of notifications — they carry the day's actual
  // list, so a stale one would describe a day that no longer exists.
  const saveBrief = async (patch: { morningBriefOn?: boolean; morningBriefTime?: string }) => {
    if (patch.morningBriefOn !== undefined) setBriefOn(patch.morningBriefOn);
    if (patch.morningBriefTime !== undefined) setBriefTime(patch.morningBriefTime);
    await updateSettings(patch);
    await rescheduleMorningBrief();
  };

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
      setNotice({ msg: `내보내지 못했어요. ${String((e as Error)?.message ?? e)}`, exit: false });
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
          if (r.reference) {
            // A reference-app file (P-d). Say exactly what landed — and what we refused to invent: the
            // calorie app logged 러닝/운동 as diet rows, but a workout is a TimeBlock here (D22), so
            // importing them as meals would have conjured food that was never eaten.
            const { expenses, meals, droppedActivities } = r.reference;
            const parts = [
              expenses ? `지출 ${expenses}건` : "",
              meals ? `식사 ${meals}건` : "",
            ].filter(Boolean).join(" · ");
            setNotice({
              msg: `${parts || "가져올 항목이 없었어요"}.${
                droppedActivities
                  ? `\n\n운동·러닝 기록 ${droppedActivities}건은 식사로 넣지 않았어요. 여기서 운동은 일정에서 ‘성공’으로 표시하는 것이라, 먹지도 않은 칼로리를 지어낼 수는 없어요.`
                  : ""
              }`,
              exit: false,
            });
          } else {
            setNotice({
              msg: `${mode === "merge" ? "지금 기록에 더했어요" : "전부 바꿨어요"} · 일정 ${r.blocks}개`,
              exit: false,
            });
          }
        }
      } catch (e) {
        setNotice({ msg: `불러오지 못했어요. ${String((e as Error)?.message ?? e)}`, exit: false });
      } finally {
        setBusy(false);
      }
    })();
  };
  // ── 기록 삭제 ──────────────────────────────────────────────────────────────────────────────────────
  // **Two different acts, one door.** 기록 초기화 wipes the *evidence* (성공·미스·발화) and leaves the plan —
  // it is how day zero is made, and a false record is worse than none because we would reason from it.
  // 모든 기록 삭제 wipes everything you ever wrote, and on the server too.
  //
  // They used to sit on different screens, which meant the destructive one nobody expected (모든 기록 삭제) was
  // filed under 계정, next to 회원 탈퇴. Records belong with records. What must never happen is choosing one
  // while meaning the other, so each option **says what survives**, and the irreversible step stands alone.
  const [eraseOpen, setEraseOpen] = useState(false);
  const [confirmErase, setConfirmErase] = useState<null | "evidence" | "all">(null);
  const [evidenceN, setEvidenceN] = useState(0);
  const [notice, setNotice] = useState<null | { msg: string; exit: boolean }>(null);

  const openErase = async () => {
    if (busy) return;
    setEvidenceN(await evidenceCount());
    setEraseOpen(true);
  };

  const runErase = async (what: "evidence" | "all") => {
    setBusy(true);
    try {
      if (what === "evidence") {
        await resetEvidence();
        setConfirmErase(null);
        setNotice({ msg: "실행 기록을 초기화했어요. 0일차부터 다시 셉니다.", exit: false });
        await refresh();
      } else {
        const wasSynced = !!account;
        const { failed } = await eraseAllRecords();
        setConfirmErase(null);
        setNotice({
          msg: failed > 0 ? `기록을 지웠어요. ${failed}건은 서버에서 지우지 못했어요.` : "모든 기록을 지웠어요.",
          // Wiping the cloud copy also discards Firestore's pending uploads, which terminates the instance —
          // otherwise a row queued a moment before the delete would land a moment after it, and the record the
          // user just destroyed would be back. A terminated instance cannot be reused, so the app restarts.
          exit: wasSynced,
        });
        if (!wasSynced) await refresh();
      }
    } catch {
      setConfirmErase(null);
      setNotice({ msg: "지우지 못했어요. 연결을 확인하고 다시 시도해 주세요.", exit: false });
    } finally {
      setBusy(false);
    }
  };

  // The OS dialog again: two one-word buttons for a choice where one of them **throws away everything you have
  // now**. Each option must say what happens to the records already on this phone.
  const [importOpen, setImportOpen] = useState(false);

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

        {/* 계정 — the FIRST thing in 설정 (founder, 2026-07-13). Login enables **sync** and nothing else: the
            app is whole without it (R4/D20), so this card offers, it never demands. No warning icon and no
            "서비스를 이용하려면" — that would be a lie here, and this app does not pressure (B2/R14).
            Signed in, it shows only the **id**; a password is never displayed anywhere. */}
        <Pressable
          onPress={() => router.push("/account")}
          className="bg-surface"
          style={{ borderRadius: 24, padding: 22, marginBottom: 4 }}
        >
          <View className="flex-row items-start">
            <View className="flex-1 pr-3">
              <Text className="text-grey" style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
                {account ? "동기화" : "로그인"}
              </Text>
              <Text className="text-ink" style={{ fontSize: 24, fontWeight: "700", lineHeight: 33 }}>
                {account ? "다른 기기와 자동으로\n맞춰지고 있어요" : "다른 기기에서도 그대로 쓰려면\n로그인하세요"}
              </Text>
            </View>
            <View
              className="items-center justify-center"
              style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: account ? "#F7EFD6" : "#E8F3FF" }}
            >
              <Text style={{ fontSize: 26 }}>{account ? "✓" : "↻"}</Text>
            </View>
          </View>

          {!account && (
            <Text className="text-grey" style={{ fontSize: 13, lineHeight: 19, marginTop: 10 }}>
              로그인하지 않아도 앱은 그대로 다 쓸 수 있어요. 로그인은 다른 기기와 기록을 맞추는 용도예요.
            </Text>
          )}

          <View
            className="bg-brand items-center"
            style={{ borderRadius: 16, paddingVertical: 17, marginTop: 18 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
              {account ? "계정 관리" : "로그인 하기"}
            </Text>
          </View>

          {account && (
            <View className="flex-row items-center" style={{ marginTop: 16 }}>
              <View
                className="bg-group items-center justify-center"
                style={{ width: 30, height: 30, borderRadius: 8 }}
              >
                <Text style={{ fontSize: 14 }}>👤</Text>
              </View>
              <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600", marginLeft: 10 }}>
                아이디: {account.email ?? "로그인됨"}
              </Text>
            </View>
          )}
        </Pressable>

        {/* 실행 준비 상태 — the permissions that gate the LEVER. Sync is optional; this is not. */}
        <GroupLabel>알람이 제때 울리게</GroupLabel>
        <Pressable onPress={() => router.push("/onboarding" as never)} className="bg-surface flex-row items-center" style={{ borderRadius: 18, padding: 16 }}>
          <View
            className="items-center justify-center"
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: allReady ? "#F7EFD6" : "#E8F3FF" }}
          >
            <Text style={{ fontSize: 24 }}>{allReady ? "⚡" : "🔔"}</Text>
          </View>
          <View className="flex-1" style={{ marginLeft: 14 }}>
            <Text className="text-ink" style={{ fontSize: 17, fontWeight: "700" }}>
              알람 권한 4가지
            </Text>
            <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
              {allReady
                  ? "모두 허용됨 — 알람이 정확한 시각에 화면을 띄울 수 있어요"
                  : `4개 중 ${readyN}개만 허용됨 — 눌러서 나머지를 켜 주세요. 안 켜면 알람이 안 뜰 수 있어요`}
            </Text>
          </View>
          <Text className="text-faint" style={{ fontSize: 20 }}>
            ›
          </Text>
        </Pressable>

        {/* 일반 */}
        <GroupLabel>알림 방식</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Row>
            <View className="flex-1 pr-3">
              <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                소리로 알리기
              </Text>
              <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                {sound
                  ? "새로 만드는 일정은 소리와 진동으로 알려요. 일정마다 따로 바꿀 수 있어요"
                  : "새로 만드는 일정은 진동으로만 알려요. 일정마다 따로 바꿀 수 있어요"}
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
                    알람 소리
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
                    눌러서 미리 들어볼 수 있어요
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
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  미리 알림 시간
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  새 일정을 시작 시각보다 몇 분 먼저 알릴지 정해요. ‘정각’은 시작 시각에 딱 맞춰 알려요
                </Text>
              </View>
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
                  절전 모드에서 제외
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  켜 두지 않으면 절전 기능이 알람을 늦추거나 막을 수 있어요
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
        <GroupLabel>내 기록 백업</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Pressable onPress={doExport} disabled={busy}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  파일로 내보내기
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  일정·지출·식사 기록을 파일 하나로 저장해요. 기기를 바꿀 때 쓰세요
                </Text>
              </View>
              <Text className="text-faint" style={{ fontSize: 18 }}>
                {busy ? "…" : "›"}
              </Text>
            </Row>
          </Pressable>
          <Divider />
          <Pressable onPress={() => setImportOpen(true)} disabled={busy}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  파일에서 불러오기
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  내보낸 파일을 다시 읽어와요. 지금 기록에 더하거나, 전부 바꿀 수 있어요
                </Text>
              </View>
              <Text className="text-faint" style={{ fontSize: 18 }}>
                {busy ? "…" : "›"}
              </Text>
            </Row>
          </Pressable>
        </View>

        {/* 돌아보기 — 계획 대 실제 (R17). Counts + the collected reasons; no score, no auto-suggestion (D29/D5). */}
        <GroupLabel>돌아보기</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Link href="/review" asChild>
            <Pressable>
              <Row>
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                    이 달 돌아보기
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                    이번 달에 무엇을 해냈고 무엇을 못 했는지, 그 이유까지
                  </Text>
                </View>
                <Text className="text-faint" style={{ fontSize: 18 }}>
                  ›
                </Text>
              </Row>
            </Pressable>
          </Link>
        </View>

        {/* 자가실험 — the instrument the founder grades the product on (S1–S5, PRD §4).
            It was behind `__DEV__`, which meant the RELEASE build the self-experiment actually runs on
            shipped **without the instrument** — two weeks of honest use and nothing to read at the end.
            The falsification condition (§4) cannot fire on a number nobody can see. */}
        <GroupLabel>기록 관리</GroupLabel>
        <View className="bg-surface" style={{ borderRadius: 18, overflow: "hidden" }}>
          <Link href="/metrics" asChild>
            <Pressable>
              <Row>
                <View className="flex-1 pr-3">
                  <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                    나의 실행 기록
                  </Text>
                  <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                    알람이 울렸을 때 실제로 몇 번 했는지, 알람은 제때 울렸는지
                  </Text>
                </View>
                <Text className="text-faint" style={{ fontSize: 18 }}>
                  ›
                </Text>
              </Row>
            </Pressable>
          </Link>

          <Divider />

          {/* Day zero. The measurement stores carry test blocks, prototype leftovers, and outcomes the
              bugs we just fixed invented — a false miss is worse than no data, because we would reason
              from it. This wipes the EVIDENCE (outcomes/fires/missed/latencies), not the plan. */}
          <Pressable onPress={openErase} disabled={busy}>
            <Row>
              <View className="flex-1 pr-3">
                <Text className="text-ink" style={{ fontSize: 16, fontWeight: "700" }}>
                  기록 삭제
                </Text>
                <Text className="text-grey mt-0.5" style={{ fontSize: 13 }}>
                  성공·미스 기록만 지우거나, 모든 기록을 지울 수 있어요. 로그인했다면 다른 기기의 기록도 함께 지워져요
                </Text>
              </View>
              <Text className="text-faint" style={{ fontSize: 18 }}>
                ›
              </Text>
            </Row>
          </Pressable>
        </View>
      </ScrollView>

      {/* Each option says **what survives** — that is the only thing that keeps these two apart in a hurry. */}
      <Sheet
        visible={importOpen}
        title="파일에서 불러오기"
        message="내보낸 파일을 읽어와요. 지금 이 기기에 있는 기록은 어떻게 할까요?"
        onClose={() => setImportOpen(false)}
        actions={[
          {
            label: "지금 기록에 더하기",
            desc: "지금 있는 기록은 그대로 두고, 파일에만 있는 것을 새로 넣어요.",
            onPress: () => {
              setImportOpen(false);
              doImport("merge");
            },
          },
          {
            label: "전부 바꾸기",
            desc: "지금 이 기기의 일정·지출·식사 기록을 모두 지우고, 파일의 내용으로 채워요.",
            danger: true,
            onPress: () => {
              setImportOpen(false);
              doImport("overwrite");
            },
          },
        ]}
      />

      <Sheet
        visible={eraseOpen}
        title="기록 삭제"
        message="무엇을 지울까요? 되돌릴 수 없어요."
        onClose={() => setEraseOpen(false)}
        actions={[
          {
            label: "실행 기록만 초기화",
            desc:
              evidenceN === 0
                ? "지울 실행 기록이 없어요. 이미 0일차예요."
                : `성공·미스·발화 ${evidenceN}건을 지우고 0일차부터 다시 세요. 일정·지출·식사는 그대로 남아요.`,
            disabled: evidenceN === 0,
            onPress: () => {
              setEraseOpen(false);
              setConfirmErase("evidence");
            },
          },
          {
            label: "모든 기록 삭제",
            desc: account
              ? "로그인한 계정의 기록을 지워요. 이 기기뿐 아니라 같은 계정을 쓰는 다른 기기에서도 사라져요. 계정 자체는 남아요."
              : "이 기기에 저장된 일정·지출·식사·실행 기록을 모두 지워요.",
            danger: true,
            onPress: () => {
              setEraseOpen(false);
              setConfirmErase("all");
            },
          },
        ]}
      />

      <ConfirmSheet
        visible={!!confirmErase}
        title={confirmErase === "all" ? "모든 기록을 지울까요?" : "실행 기록을 초기화할까요?"}
        message={
          confirmErase === "all"
            ? account
              ? "일정·지출·식사·실행 기록이 모두 지워져요. 같은 계정으로 로그인한 다른 기기에서도, 인터넷에 연결되는 순간 함께 지워져요. 계정 자체는 남아요. 되돌릴 수 없어요."
              : "이 기기에 저장된 일정·지출·식사·실행 기록이 모두 지워져요. 되돌릴 수 없어요."
            : "성공·미스·발화 기록이 지워지고 0일차부터 다시 세요. 계획은 그대로 남아요. 되돌릴 수 없어요."
        }
        confirmLabel={busy ? "지우는 중…" : confirmErase === "all" ? "모두 지우기" : "초기화하기"}
        busy={busy}
        onConfirm={() => runErase(confirmErase === "all" ? "all" : "evidence")}
        onClose={() => setConfirmErase(null)}
      />

      <Sheet
        visible={!!notice}
        title={notice?.msg ?? ""}
        message={notice?.exit ? "앱을 종료해요. 다시 열면 처음 상태로 시작해요." : undefined}
        onClose={() => (notice?.exit ? BackHandler.exitApp() : setNotice(null))}
        actions={notice?.exit ? [{ label: "앱 종료", onPress: () => BackHandler.exitApp() }] : []}
        cancelLabel={notice?.exit ? "앱 종료" : "확인"}
      />
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
