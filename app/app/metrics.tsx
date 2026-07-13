// 측정 — the self-experiment's grading instrument. It must grade against the **canonical PRD §4**
// metrics, not the prototype's older numbering (they had S1/S2 swapped and no D-1 adoption at all — the
// instrument disagreeing with the criteria is how a founder fools himself):
//   S1 실행률 (core, the differentiator's proof — execution-moment `done` only)
//   S2 알람 신뢰성 (±[TBD 1분] under kill/Doze/reboot)
//   S3 D-1 계획 채택 (the biggest NON-technical risk — days a next-day plan was actually made)
//   S4 기록 마찰 (spend/meal logged the same day it happened, ≤2 taps)
//   S5 무죄책 복귀 (after a miss, the same task-type gets done later — held WITHOUT a streak)
// Read-only, derived from the local logs. No streak is computed anywhere (anti-metric, R14/D1).

import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listOutcomes, type OutcomeRecord } from "@/core/data/outcomeRepository";
import { listLatencies, type Latency } from "@/core/data/latencyRepository";
import { listBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { listExpenses } from "@/core/data/expenseRepository";
import { listMeals } from "@/core/data/mealRepository";

const BASELINE_KEY = "lp.baseline.v1";
const S2_TOLERANCE_MS = 60_000; // [TBD ~1 min], PRD S2 (alarm reliability)

export default function Metrics() {
  const router = useRouter();
  const [outs, setOuts] = useState<OutcomeRecord[]>([]);
  const [lats, setLats] = useState<Latency[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [logStamps, setLogStamps] = useState<{ date: string; createdAt: number }[]>([]);
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    (async () => {
      setOuts(await listOutcomes());
      setLats(await listLatencies());
      setBlocks(await listBlocks());
      const [ex, me] = [await listExpenses(), await listMeals()];
      setLogStamps([...ex, ...me].map((e) => ({ date: e.date, createdAt: e.createdAt })));
      setBaseline((await AsyncStorage.getItem(BASELINE_KEY)) ?? "");
    })();
  }, []);

  const saveBaseline = (v: string) => {
    setBaseline(v);
    AsyncStorage.setItem(BASELINE_KEY, v);
  };

  const ymd = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // S1 — EXECUTION RATE (core). Of the flagged occurrences that were resolved, the share marked done
  // **via the execution moment itself** (source = execution-screen). Catch-up dones are counted, but
  // separately: they are not the lever's proof. A pre-skip is neither — it's out of the denominator.
  const execDone = outs.filter((o) => o.status === "done" && o.source === "execution-screen").length;
  const catchDone = outs.filter((o) => o.status === "done" && o.source === "catch-up").length;
  const miss = outs.filter((o) => o.status === "miss").length;
  const resolved = execDone + catchDone + miss;
  const s1 = resolved ? Math.round((100 * execDone) / resolved) : 0;

  // Validity guard (PRD §10) — a cue committed minutes before it fires is a well-timed reminder, not the
  // pre-commitment lever. Flag those and show S1 with them excluded.
  const PRECOMMIT_MIN_MS = 60 * 60 * 1000; // [TBD]
  const latByOcc = new Map(lats.map((l) => [`${l.taskId}|${l.date}`, l]));
  const lastMinute = outs.filter((o) => {
    if (o.status !== "done" || o.source !== "execution-screen") return false;
    const l = latByOcc.get(`${o.taskId}|${o.date}`);
    return l?.createdAt != null && l.intended - l.createdAt < PRECOMMIT_MIN_MS;
  }).length;
  const s1Excl =
    resolved - lastMinute > 0 ? Math.round((100 * (execDone - lastMinute)) / (resolved - lastMinute)) : 0;

  // S2 — ALARM RELIABILITY: fired within ±[TBD 1분] of start − lead, under kill / lock+Doze / reboot.
  const s2n = lats.length;
  const s2within = lats.filter((l) => Math.abs(l.deltaMs) <= S2_TOLERANCE_MS).length;
  const s2maxSec = (lats.reduce((m, l) => Math.max(m, Math.abs(l.deltaMs)), 0) / 1000).toFixed(1);

  // S3 — D-1 PLANNING ADOPTION (the biggest non-technical risk, baseline ≈ 0): the number of days whose
  // plan was actually made **the day before or earlier** — read off each block's own `plannedAt`, so it
  // measures the habit, not the app's use. Days planned only on the day itself don't count.
  const plannedAhead = new Set(blocks.filter((b) => ymd(b.plannedAt) < b.date).map((b) => b.date));
  const plannedDays = new Set(blocks.map((b) => b.date));
  const s3 = plannedAhead.size;

  // S4 — LOGGING FRICTION: the share of spend/meal entries recorded **on the day they happened** (a
  // same-day proxy for "within a few minutes" — the app can't see the purchase itself). [TBD] target.
  const sameDay = logStamps.filter((e) => ymd(e.createdAt) === e.date).length;
  const s4 = logStamps.length ? Math.round((100 * sameDay) / logStamps.length) : 0;

  // S5 — NO-GUILT RETURN: after a miss, the same task-type is done later. Held WITHOUT a streak.
  const missOcc = outs.filter((o) => o.status === "miss");
  const returned = missOcc.filter((m) =>
    outs.some((o) => o.taskId === m.taskId && o.status === "done" && o.date > m.date)
  ).length;
  const s5 = missOcc.length ? Math.round((100 * returned) / missOcc.length) : 0;

  const totalDone = execDone + catchDone;

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
          title="S1 · 실행률 (핵심)"
          value={resolved === 0 ? "—" : `${s1}%`}
          desc={`그 순간 실행 ${execDone} · 캐치업 완료 ${catchDone} · 미룸 ${miss}. S1 = 그 순간 실행 ÷ 처리된 발생 (캐치업 완료는 별도 집계 — 레버의 증거가 아니에요).${
            lastMinute > 0 ? ` 임박 생성(1시간 이내) ${lastMinute}건 — 제외 시 ${s1Excl}%.` : ""
          }`}
        />

        <Stat
          title="S2 · 알람 신뢰성"
          value={s2n === 0 ? "—" : `${s2within}/${s2n}`}
          desc={`발화 ${s2n}회 중 ${s2within}회가 ±1분 내. 최대 오차 ${s2maxSec}초. (킬드/잠금/재부팅 포함)`}
        />

        <Stat
          title="S3 · 전날 계획 (최대 리스크)"
          value={`${s3}일`}
          desc={`하루 전(또는 그 이전)에 계획한 날 ${s3}일 / 계획이 있는 날 ${plannedDays.size}일. 이 습관이 안 붙으면(≈0) 나머지가 아무리 좋아도 흐름 전체가 안 돌아요.`}
        />

        <Stat
          title="S4 · 기록 마찰"
          value={logStamps.length === 0 ? "—" : `${s4}%`}
          desc={`지출·식사 ${logStamps.length}건 중 ${sameDay}건은 그 날 바로 기록. (몰아서 넣지 않았다는 신호 — '수 분 내'의 대용값)`}
        />

        <Stat
          title="S5 · 무죄책 복귀"
          value={missOcc.length === 0 ? "—" : `${s5}%`}
          desc={`미룬 ${missOcc.length}건 중 ${returned}건은 이후 같은 일을 다시 해냄 (what-the-hell 붕괴 없이 복귀). 스트릭은 쓰지 않아요.`}
        />

        <Stat
          title="참고 · 기준선 대비"
          value={`${totalDone}회`}
          desc="앱으로 실제 해낸 총 횟수. 앱 없이 같은 기간에 했던 횟수(기준선)를 적어 비교하세요."
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
