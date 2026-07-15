// The animated loading screen (the launch/splash). The native splash (expo-splash-screen) is now a PLAIN WHITE
// screen — no logo — so this overlay can draw the logo "from nothing": the clock is stroked on as if drawn, then
// the "LifePlanner" wordmark is written on one letter at a time, and finally the whole thing fades to reveal the app.
//
// Why SVG (not the PNG icon): a bitmap can't be "drawn". The clock is rebuilt as SVG strokes so each line can be
// revealed by animating strokeDashoffset from its full length to 0 — the classic draw-on. react-native-svg +
// Reanimated were already deps, so this adds nothing.
//
// Calm but brisk (the no-guilt ethos, minus the dawdle): single-pass strokes and a per-letter rise — no bounce,
// no confetti — kept to ≈ 1.2s so it reads once and gets out of the way on every launch.
import { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

const BRAND = "#3182F6"; // token: brand
const WORD = "LifePlanner";
const CLOCK_SIZE = 150;
const H = Dimensions.get("window").height;

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

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const ring = useSharedValue(RING_LEN); // strokeDashoffset: full = hidden, 0 = fully drawn
  const ticks = useSharedValue(TICK_LEN);
  const check = useSharedValue(CHECK_LEN);
  const wordN = useSharedValue(0); // how many letters have resolved (0 → WORD.length)
  const cover = useSharedValue(1); // whole-overlay opacity for the final fade

  useEffect(() => {
    // Kept deliberately BRISK (~1.2s total): the launch animation must clear fast and hand off to the app — an
    // intro the user sees on every open should read once and get out of the way. The three strokes overlap
    // heavily so the clock still reads as "drawn" without dwelling.
    // 1) ring, 2) ticks, 3) checkmark — overlapping into one continuous drawing motion.
    ring.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.quad) });
    ticks.value = withDelay(240, withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }));
    check.value = withDelay(380, withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
    // 4) the wordmark writes on, one letter at a time (starts before the clock fully finishes).
    wordN.value = withDelay(480, withTiming(WORD.length, { duration: 440, easing: Easing.inOut(Easing.quad) }));
    // 5) a hair of hold, then a quick fade-out that hands control to the app.
    cover.value = withDelay(
      980,
      withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: ticks.value }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: check.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, coverStyle]} pointerEvents="none">
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
