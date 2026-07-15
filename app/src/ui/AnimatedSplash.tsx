// The animated loading screen (the launch/splash). It runs CONCURRENTLY with app startup and gets out of the
// way the instant the app is ready — the intro is there to cover a slow load, never to delay a fast one.
//
// How it behaves:
// - The native splash is a plain white screen; this overlay draws over the same white, so the hand-off is seamless.
// - The clock is SVG (font-independent), so it starts drawing immediately — while the fonts are still loading —
//   as the loading indicator.
// - The "LifePlanner" wordmark uses Baloo 2, so it is written on ONLY once `ready` is true (fonts resolved) — it
//   can never flash in a fallback font.
// - The moment `ready` flips true, `runFinish` fast-forwards whatever is left (~0.1s) and fades out → the app.
//   Fast startup → the whole thing is a brief blip; slow startup → the clock draws while you wait, then finishes
//   the instant it can.
//
// Calm by design (no bounce, no confetti), per the no-guilt ethos.
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

const BRAND = "#3182F6"; // token: brand
const WORD = "LifePlanner";
const CLOCK_SIZE = 150;
const H = Dimensions.get("window").height;
const SAFETY_MS = 4000; // never let a hung font load strand the launch on the splash

const ACircle = Animated.createAnimatedComponent(Circle);
const ALine = Animated.createAnimatedComponent(Line);
const APath = Animated.createAnimatedComponent(Path);

// Geometry in a 0..100 viewBox. Ring r=40; four ticks just inside it; a centered checkmark for the hands.
const RING_R = 40;
const RING_LEN = 2 * Math.PI * RING_R; // ≈ 251.3
const TICK_LEN = 9;
const TICKS = [
  { x1: 50, y1: 15, x2: 50, y2: 24 }, // 12
  { x1: 85, y1: 50, x2: 76, y2: 50 }, // 3
  { x1: 50, y1: 85, x2: 50, y2: 76 }, // 6
  { x1: 15, y1: 50, x2: 24, y2: 50 }, // 9
];
const CHECK_D = "M30 50 L48 64 L70 34";
const CHECK_LEN = 60; // measured length of the checkmark path

// One letter of the wordmark. It appears as the shared `driver` sweeps past its index — the letters resolve
// left-to-right, so the word reads as if being written.
function Letter({ ch, index, driver }: { ch: string; index: number; driver: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(Math.max(driver.value - index, 0), 1);
    return { opacity: p, transform: [{ translateY: (1 - p) * 9 }] };
  });
  return <Animated.Text style={[styles.letter, style]}>{ch}</Animated.Text>;
}

export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const ring = useSharedValue(RING_LEN); // strokeDashoffset: full = hidden, 0 = fully drawn
  const ticks = useSharedValue(TICK_LEN);
  const check = useSharedValue(CHECK_LEN);
  const wordN = useSharedValue(0); // how many letters have resolved (0 → WORD.length)
  const cover = useSharedValue(1); // whole-overlay opacity for the final fade
  const pulse = useSharedValue(1); // clock breath while WAITING on a slow load (so it never looks frozen)
  const finishing = useRef(false);

  // Finish fast and hand off. Called the instant the app is ready (or by the safety timeout). Guarded so it runs
  // once. Fast-forwards the clock (a no-op if already drawn), writes the wordmark quickly, then a short fade.
  const runFinish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    cancelAnimation(pulse); // stop the waiting breath and settle the clock to solid as it finishes
    pulse.value = withTiming(1, { duration: 110 });
    ring.value = withTiming(0, { duration: 110 });
    ticks.value = withTiming(0, { duration: 110 });
    check.value = withTiming(0, { duration: 110 });
    wordN.value = withTiming(WORD.length, { duration: 150, easing: Easing.out(Easing.quad) });
    cover.value = withDelay(
      160,
      withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(onFinish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  // Draw the clock at a leisurely pace right away — this plays under a slow load. If the app is already ready,
  // runFinish (below) immediately overrides these with the fast-forward, so nothing is wasted.
  useEffect(() => {
    ring.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.quad) });
    ticks.value = withDelay(240, withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }));
    check.value = withDelay(380, withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
    // Once the clock is drawn, if we're STILL waiting on the load, breathe gently — a slow load then reads as
    // "loading", not "frozen". runFinish cancels this the instant we're ready (or if we were ready all along).
    pulse.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 640, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 640, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The wordmark waits for readiness; the moment we're ready, finish.
  useEffect(() => {
    if (ready) runFinish();
  }, [ready, runFinish]);

  // Safety net: never strand the launch if fonts hang.
  useEffect(() => {
    const id = setTimeout(runFinish, SAFETY_MS);
    return () => clearTimeout(id);
  }, [runFinish]);

  // Stop any in-flight animations if we unmount mid-sequence.
  useEffect(
    () => () => {
      cancelAnimation(ring);
      cancelAnimation(ticks);
      cancelAnimation(check);
      cancelAnimation(wordN);
      cancelAnimation(cover);
      cancelAnimation(pulse);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.96 + pulse.value * 0.04 }], // 0.55→1 maps to a barely-there 0.982→1.0 breath
  }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: ticks.value }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: check.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, coverStyle]} pointerEvents="none">
      <Animated.View style={pulseStyle}>
        <Svg width={CLOCK_SIZE} height={CLOCK_SIZE} viewBox="0 0 100 100">
        <ACircle
          cx={50}
          cy={50}
          r={RING_R}
          stroke={BRAND}
          strokeWidth={5.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_LEN}
          animatedProps={ringProps}
        />
        {TICKS.map((t, i) => (
          <ALine
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={BRAND}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={TICK_LEN}
            animatedProps={tickProps}
          />
        ))}
        <APath
          d={CHECK_D}
          stroke={BRAND}
          strokeWidth={5.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LEN}
          animatedProps={checkProps}
        />
        </Svg>
      </Animated.View>
      <View style={styles.wordRow}>
        {WORD.split("").map((ch, i) => (
          <Letter key={i} ch={ch} index={i} driver={wordN} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  wordRow: {
    position: "absolute",
    top: H / 2 + CLOCK_SIZE / 2 + 2, // just below the centered clock
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  letter: {
    fontFamily: "Baloo2", // rounded logo face
    fontSize: 32,
    color: BRAND,
    letterSpacing: 0.2,
  },
});
