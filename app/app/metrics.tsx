// 측정 — the self-experiment's grading instrument. It must grade against the **canonical PRD §4**
// metrics, not the prototype's older numbering (they had S1/S2 swapped and no D-1 adoption at all — the
// instrument disagreeing with the criteria is how a founder fools himself). This screen shows only the
// **positive, satisfying** cuts (no-guilt, R14/D1 — nothing here names a failure or a miss rate):
//   S1 실행률 (core, the differentiator's proof — execution-moment `done` only)
//   S3 D-1 계획 채택 (the biggest NON-technical risk — days a next-day plan was actually made)
//   S4 기록 마찰 (spend/meal logged the same day it happened, ≤2 taps)
//   + 앱을 쓴 뒤 실제로 해낸 횟수 (vs a self-entered no-app baseline)
// Read-only, derived from the local logs. No streak is computed anywhere (anti-metric, R14/D1).

import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactNode } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listOutcomes, type OutcomeRecord } from "@/core/data/outcomeRepository";
import { listBlocks, type TimeBlock } from "@/core/data/blockRepository";
import { listExpenses } from "@/core/data/expenseRepository";
import { listMeals } from "@/core/data/mealRepository";

const BASELINE_KEY = "lp.baseline.v1";

export default function Metrics() {
  const router = useRouter();
  const [outs, setOuts] = useState<OutcomeRecord[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [logStamps, setLogStamps] = useState<{ date: string; createdAt: number }[]>([]);
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    (async () => {
      setOuts(await listOutcomes());
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

  // S1 — EXECUTION RATE (core). Of the **flagged** occurrences that were resolved, the share marked done
  // **via the execution moment itself** (source = execution-screen). Catch-up dones are counted, but
  // separately: they are not the lever's proof. A pre-skip is neither — it's out of the denominator.
  //
  // **The denominator is the LEVER's universe, not every outcome.** It used to be every outcome in the
  // store — so a 강의 or 점심 block carrying a plain `알림` (soft) alert, which the execution moment never
  // touched, could be ticked 성공/미스 from home or 돌아보기 and land in S1. Blocks the lever never
  // intervened on were grading the lever. Worse, they drag it DOWN (a soft block can never produce an
  // `execution-screen` done), and PRD §4's falsification condition is "if S1 is no better than a plain
  // reminder, the lever has failed → stop and redesign". A working lever could have been thrown away on a
  // number that was measuring something else.
  const flagged = new Set(blocks.filter((b) => b.alert === "execution").map((b) => b.id));
  const levered = outs.filter((o) => flagged.has(o.taskId));
  const execDone = levered.filter((o) => o.status === "done" && o.source === "execution-screen").length;
  const catchDone = levered.filter((o) => o.status === "done" && o.source === "catch-up").length;
  const miss = levered.filter((o) => o.status === "miss").length;
  const resolved = execDone + catchDone + miss;
  const s1 = resolved ? Math.round((100 * execDone) / resolved) : 0;

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

        {/* These were written for us, not for him: "S1 · 실행률", "what-the-hell 붕괴", "대용값", "발화".
            A number nobody can read is not a measurement — it is a decoration. */}
        <Stat
          title="알람이 울렸을 때, 바로 한 비율"
          value={resolved === 0 ? "—" : `${s1}%`}
          desc={`알람이 울린 그 자리에서 바로 해낸 것 ${execDone}번, 나중에라도 해낸 것 ${catchDone}번이에요.\n전체화면이 뜨는 ‘실행’ 일정만 세요.`}
        />

        <Stat
          title="전날 미리 계획한 날"
          value={`${s3}일`}
          desc={`계획이 있던 날 ${plannedDays.size}일 중 ${s3}일은 하루 전에 미리 정해뒀어요.\n미리 정해두는 습관이 잘 붙고 있어요.`}
        />

        <Stat
          title="그날 바로 기록한 비율"
          value={logStamps.length === 0 ? "—" : `${s4}%`}
          desc={`지출·식사 기록 ${logStamps.length}건 중 ${sameDay}건은 그날 바로 적었어요.\n그때그때 잘 남기고 있어요.`}
        />

        <Stat
          title="앱을 쓴 뒤 실제로 해낸 횟수"
          value={`${totalDone}회`}
          desc="앱 없이 지내던 같은 기간에 몇 번이나 했는지 아래에 적어 두면, 앱이 정말 도움이 됐는지 견줘볼 수 있어요."
        >
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <Text className="text-ink-soft" style={{ fontSize: 13 }}>
              앱 없이 했던 횟수:
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
                {o.source === "catch-up" ? "캐치업" : o.source === "pre-skip" ? "사전 휴식" : "실행화면"}
              </Text>
              <Text
                className={
                  o.status === "done"
                    ? "text-gold"
                    : o.status === "skipped"
                      ? "text-faint"
                      : "text-miss"
                }
                style={{ fontSize: 12, fontWeight: "600" }}
              >
                {o.status === "done" ? "성공" : o.status === "skipped" ? "휴식" : "미스"}
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
