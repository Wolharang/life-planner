// 측정 (PRD §4 / Phase 5): makes S1–S4 computable from the on-device logs, so the founder can judge the
// self-experiment. Read-only, from outcomeRepository + latencyRepository (+ a hand-entered baseline for S3).

import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listOutcomes, type OutcomeRecord } from "@/core/data/outcomeRepository";
import { listLatencies, type Latency } from "@/core/data/latencyRepository";

const BASELINE_KEY = "lp.baseline.v1";
const S1_TOLERANCE_MS = 60_000; // [TBD ~1 min], PRD S1

export default function Metrics() {
  const router = useRouter();
  const [outs, setOuts] = useState<OutcomeRecord[]>([]);
  const [lats, setLats] = useState<Latency[]>([]);
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    (async () => {
      setOuts(await listOutcomes());
      setLats(await listLatencies());
      setBaseline((await AsyncStorage.getItem(BASELINE_KEY)) ?? "");
    })();
  }, []);

  const saveBaseline = (v: string) => {
    setBaseline(v);
    AsyncStorage.setItem(BASELINE_KEY, v);
  };

  // S1 — fire reliability
  const s1n = lats.length;
  const s1within = lats.filter((l) => Math.abs(l.deltaMs) <= S1_TOLERANCE_MS).length;
  const s1maxSec = (lats.reduce((m, l) => Math.max(m, Math.abs(l.deltaMs)), 0) / 1000).toFixed(1);

  // S2 — initiation rate (core): done in the moment vs catch-up vs miss
  const execDone = outs.filter((o) => o.status === "done" && o.source === "execution-screen").length;
  const catchDone = outs.filter((o) => o.status === "done" && o.source === "catch-up").length;
  const miss = outs.filter((o) => o.status === "miss").length;
  const resolved = execDone + catchDone + miss;
  const s2 = resolved ? Math.round((100 * execDone) / resolved) : 0;

  // §10 validity guard — flag occurrences created just before firing (a well-timed last-minute reminder
  // is NOT the pre-commitment lever). gap = fire time − creation time, joined from the latency log.
  const PRECOMMIT_MIN_MS = 60 * 60 * 1000; // [TBD] a commit made <1h before firing isn't a genuine pre-commit
  const latByOcc = new Map(lats.map((l) => [`${l.taskId}|${l.date}`, l]));
  const lastMinute = outs.filter((o) => {
    if (o.status !== "done" || o.source !== "execution-screen") return false;
    const l = latByOcc.get(`${o.taskId}|${o.date}`);
    return l?.createdAt != null && l.intended - l.createdAt < PRECOMMIT_MIN_MS;
  }).length;
  const s2Excl =
    resolved - lastMinute > 0
      ? Math.round((100 * (execDone - lastMinute)) / (resolved - lastMinute))
      : 0;

  // S3 — behavior vs baseline (baseline = hand-entered count in the last weeks WITHOUT the prototype)
  const totalDone = execDone + catchDone;

  // S4 — no-guilt return: after a miss, a later done for the same task
  const missOcc = outs.filter((o) => o.status === "miss");
  const returned = missOcc.filter((m) =>
    outs.some((o) => o.taskId === m.taskId && o.status === "done" && o.date > m.date)
  ).length;
  const s4 = missOcc.length ? Math.round((100 * returned) / missOcc.length) : 0;

  const recent = outs.slice().reverse().slice(0, 15);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-ink font-semibold" style={{ fontSize: 22 }}>
            측정
          </Text>
          <Pressable onPress={() => router.back()} className="px-3 py-1.5">
            <Text className="text-ink-soft" style={{ fontSize: 14 }}>
              닫기
            </Text>
          </Pressable>
        </View>

        <Stat
          title="S1 · 정시 발화"
          value={s1n === 0 ? "—" : `${s1within}/${s1n}`}
          desc={`발화 ${s1n}회 중 ${s1within}회가 ±1분 내. 최대 오차 ${s1maxSec}초. (킬드/잠금/재부팅 포함)`}
        />

        <Stat
          title="S2 · 착수율 (핵심)"
          value={resolved === 0 ? "—" : `${s2}%`}
          desc={`그 순간 실행 ${execDone} · 캐치업 완료 ${catchDone} · 미룸 ${miss}. S2 = 그 순간 실행 ÷ 처리된 발생 (캐치업 완료는 별도 집계).${
            lastMinute > 0 ? ` 임박 생성(1시간 이내) ${lastMinute}건 — 제외 시 ${s2Excl}%.` : ""
          }`}
        />

        <Stat
          title="S3 · 행동 변화"
          value={`${totalDone}회`}
          desc={`프로토타입으로 실제 해낸 총 ${totalDone}회. 프로토타입 전 같은 기간의 횟수(기준선)를 적어 비교.`}
        >
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <Text className="text-ink-soft" style={{ fontSize: 13 }}>
              기준선:
            </Text>
            <TextInput
              value={baseline}
              onChangeText={saveBaseline}
              keyboardType="number-pad"
              placeholder="예: 4"
              placeholderTextColor="#B0B8C1"
              className="bg-surface border border-line rounded-control text-ink text-center"
              style={{ fontSize: 15, width: 72, paddingVertical: 8 }}
            />
            <Text className="text-ink-soft" style={{ fontSize: 13 }}>
              회 → 지금 {totalDone}회
            </Text>
          </View>
        </Stat>

        <Stat
          title="S4 · 무죄책 복귀"
          value={missOcc.length === 0 ? "—" : `${s4}%`}
          desc={`미룬 ${missOcc.length}건 중 ${returned}건은 이후 같은 할 일을 다시 해냄 (what-the-hell 붕괴 없이 복귀).`}
        />

        <Text className="text-ink-soft mt-6 mb-2" style={{ fontSize: 13 }}>
          원자료 (최근 결과)
        </Text>
        {recent.length === 0 ? (
          <Text className="text-faint" style={{ fontSize: 12 }}>
            아직 없음.
          </Text>
        ) : (
          recent.map((o, i) => (
            <View key={i} className="flex-row justify-between py-1.5 border-b border-line">
              <Text className="text-ink" style={{ fontSize: 13 }}>
                {o.title || "실행"} · {o.date} ·{" "}
                {o.source === "catch-up" ? "캐치업" : o.source === "pre-skip" ? "사전 쉼" : "실행화면"}
              </Text>
              <Text
                className={
                  o.status === "done"
                    ? "text-brand"
                    : o.status === "skipped"
                      ? "text-faint"
                      : "text-miss"
                }
                style={{ fontSize: 12, fontWeight: "600" }}
              >
                {o.status === "done" ? "완료" : o.status === "skipped" ? "쉼" : "미룸"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  title,
  value,
  desc,
  children,
}: {
  title: string;
  value: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <View className="bg-surface border border-line rounded-card px-4 py-3.5 mb-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-ink font-semibold" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text className="text-brand font-semibold" style={{ fontSize: 20 }}>
          {value}
        </Text>
      </View>
      <Text className="text-ink-soft mt-1" style={{ fontSize: 12, lineHeight: 18 }}>
        {desc}
      </Text>
      {children}
    </View>
  );
}
