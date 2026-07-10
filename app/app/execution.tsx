// The execution moment — PRD §7.1 R3. LIGHT warm-white surface (per founder direction; the earlier dark
// world is dropped). Flow: COMMIT → COUNTDOWN(5·4·3·2·1) → MICRO-START+CONFIRM → GO → DONE / PENDING.
//
// v5 skin (PROVISIONAL, iterating): serif commit line (the "이전의 나" voice), gold 도장(seal) as the
// single DONE signal (replaces confetti). Logic UNCHANGED — no in-flow escape (once fired the only
// responses are 응/아직); no-guilt; gold reserved for the one competence signal.

import { View, Text, Pressable, Animated } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Rect, Path } from "react-native-svg";
import { recordOutcome } from "@/core/data/outcomeRepository";

type Phase = "commit" | "countdown" | "act" | "go" | "done" | "pending";

// Provisional R3 timings (PRD [TBD] — calibrated in Phase 5).
const COMMIT_IDLE_MS = 30_000;
const ACT_AUTO_MS = 60_000; // merged MICRO-START+CONFIRM auto → PENDING
const GO_AUTO_MS = 3_500; // GO propulsion beat → DONE
const COUNT_STEP_MS = 1_000;

const DEFAULT_MICRO = "딱 첫 동작만 — 지금 일어나기";
const GOLD = "#B0862A"; // refined old-gold — the ONE success signal
const FAINT = "#B4AC98";
const SERIF = "GowunBatang"; // the execution-moment voice only

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function calendarDayDiff(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  a.setHours(0, 0, 0, 0);
  const b = new Date(toMs);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// Time-accurate commit line (R3) — never a false "어제". Returns the sentence split around the label
// so the label can be highlighted (the one gold accent besides DONE).
function commitParts(createdAt: number, now: number): { before: string; after: string } {
  const d = calendarDayDiff(createdAt, now);
  if (d <= 0) return { before: "아까 네가 ", after: "라고 정했잖아" };
  if (d === 1) return { before: "어제 네가 ", after: "라고 정했잖아" };
  if (d <= 13) return { before: `${d}일 전에 네가 `, after: " 하기로 정했잖아" };
  return { before: "네가 ", after: " 하기로 정해뒀잖아" };
}

export default function Execution() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string;
    title?: string;
    note?: string;
    intended?: string;
    createdAt?: string;
    skipCommit?: string; // "1" when launched from the alarm (the native shell already did COMMIT)
  }>();

  const title = params.title || "헬스";
  const note = params.note && params.note.length > 0 ? params.note : "";
  const intended = params.intended ? Number(params.intended) : Date.now();
  const createdAt = params.createdAt ? Number(params.createdAt) : Date.now() - 20 * 3_600_000;
  const taskId = params.taskId || "preview";

  const label = `${pad(new Date(intended).getHours())}:${pad(new Date(intended).getMinutes())} ${title}`;
  const parts = commitParts(createdAt, Date.now());
  const dateStr = ymd(intended);

  const [phase, setPhase] = useState<Phase>(params.skipCommit === "1" ? "countdown" : "commit");
  const [count, setCount] = useState(5);

  // seal press-in animation (replaces confetti — one calm signal)
  const sealScale = useRef(new Animated.Value(1.25)).current;
  const sealOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  // "응, 시작했어": they crossed initiation → record done, then a GO push before the calm DONE.
  const confirmStarted = useCallback(() => {
    recordOutcome({
      taskId,
      title,
      date: dateStr,
      status: "done",
      source: "execution-screen",
      at: Date.now(),
    }).catch(() => {});
    setPhase("go");
  }, [taskId, dateStr, title]);

  // Idle / auto timeouts + phase-entry haptics (every state has a defined landing — R3). No in-flow miss.
  useEffect(() => {
    if (phase === "pending") {
      dismiss();
      return;
    }
    if (phase === "commit") {
      const t = setTimeout(() => setPhase("pending"), COMMIT_IDLE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "act") {
      const t = setTimeout(() => setPhase("pending"), ACT_AUTO_MS);
      return () => clearTimeout(t);
    }
    if (phase === "go") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const t = setTimeout(() => setPhase("done"), GO_AUTO_MS);
      return () => clearTimeout(t);
    }
    if (phase === "done") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.spring(sealScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
        Animated.timing(sealOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    }
  }, [phase]);

  // COUNTDOWN ticker: 5→1, ~1s each, a light haptic tick per number.
  useEffect(() => {
    if (phase !== "countdown") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (count <= 1) {
      const t = setTimeout(() => setPhase("act"), COUNT_STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c - 1), COUNT_STEP_MS);
    return () => clearTimeout(t);
  }, [phase, count]);

  const startCountdown = () => {
    setCount(5);
    setPhase("countdown");
  };

  return (
    <View className="flex-1 bg-exec-bg items-center justify-center px-9">
      {phase === "commit" && (
        <>
          <Text className="text-exec-soft" style={{ fontSize: 13, letterSpacing: 2, marginBottom: 16 }}>
            내가 정한 약속
          </Text>
          <Text className="text-exec-ink text-center" style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 40 }}>
            {parts.before}
            <Text style={{ fontFamily: SERIF, color: GOLD, fontWeight: "700" }}>{label}</Text>
            {parts.after}
          </Text>
          <BrandButton label="시작할게" onPress={startCountdown} />
        </>
      )}

      {phase === "countdown" && (
        <>
          <Text className="text-exec-ink" style={{ fontFamily: SERIF, fontSize: 112, fontWeight: "700" }}>
            {count}
          </Text>
          <View className="flex-row" style={{ gap: 15, marginTop: 10 }}>
            {[5, 4, 3, 2, 1].map((n) => (
              <Text
                key={n}
                style={{ fontSize: 13, letterSpacing: 2, color: n === count ? GOLD : FAINT, fontWeight: "600" }}
              >
                {n}
              </Text>
            ))}
          </View>
        </>
      )}

      {phase === "act" && (
        <>
          <Text className="text-exec-soft" style={{ fontSize: 13, letterSpacing: 2, marginBottom: 12 }}>
            딱 첫 동작
          </Text>
          <Text
            className="text-exec-ink text-center"
            style={{ fontSize: 27, lineHeight: 38, fontWeight: "700" }}
          >
            {note || DEFAULT_MICRO}
          </Text>

          <View style={{ height: 1, backgroundColor: "#E7E9E4", alignSelf: "stretch", marginVertical: 34 }} />

          <Text className="text-exec-ink" style={{ fontSize: 22, fontWeight: "700", marginBottom: 26 }}>
            시작했어?
          </Text>
          <BrandButton label="응, 시작했어" onPress={confirmStarted} big />
          <Pressable onPress={() => setPhase("pending")} className="mt-6">
            <Text className="text-exec-soft" style={{ fontSize: 15 }}>
              아직
            </Text>
          </Pressable>
        </>
      )}

      {phase === "go" && (
        <View className="items-center">
          <Text
            className="text-exec-ink text-center"
            style={{ fontFamily: SERIF, fontSize: 28, fontWeight: "700", lineHeight: 40 }}
          >
            이제 그대로 나가.
          </Text>
          <Text className="text-exec-soft text-center" style={{ fontSize: 16, marginTop: 14 }}>
            여기서 멈추면 아까워.
          </Text>
          <BrandButton label="나간다 →" onPress={() => setPhase("done")} big />
        </View>
      )}

      {phase === "done" && (
        <>
          <Animated.View
            style={{
              opacity: sealOpacity,
              transform: [{ scale: sealScale }, { rotate: "-3deg" }],
              marginBottom: 24,
            }}
          >
            <Svg width={96} height={96} viewBox="0 0 100 100">
              <Rect x={10} y={10} width={80} height={80} rx={14} fill="none" stroke={GOLD} strokeWidth={3} />
              <Path
                d="M32 52 L45 66 L70 36"
                fill="none"
                stroke={GOLD}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
          <Text
            className="text-center"
            style={{ fontFamily: SERIF, color: GOLD, fontSize: 25, fontWeight: "700", lineHeight: 34 }}
          >
            안 하던 걸 해냈다.
          </Text>
          <DismissLink onPress={dismiss} />
        </>
      )}

      {phase === "pending" && null}
    </View>
  );
}

function BrandButton({ label, onPress, big }: { label: string; onPress: () => void; big?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-brand rounded-full mt-12"
      style={{ paddingHorizontal: big ? 48 : 40, paddingVertical: big ? 18 : 16 }}
    >
      <Text className="text-white" style={{ fontSize: big ? 20 : 19, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function DismissLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-12">
      <Text className="text-exec-soft" style={{ fontSize: 15 }}>
        닫기
      </Text>
    </Pressable>
  );
}
