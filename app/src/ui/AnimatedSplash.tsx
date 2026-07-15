// The animated loading screen (the launch/splash the founder asked for). The native splash (expo-splash-screen)
// is a plain white background with the clock icon — the same clock — so the hand-off to THIS overlay is seamless:
// the clock is already on screen and holds its place while the "LifePlanner" wordmark rises in beneath it, then
// the whole thing fades out and reveals the app.
//
// Calm by design (the product's no-guilt ethos): a single gentle "breath" of the clock and a soft fade — no
// bounce, no confetti. The clock uses the exact same asset as the native splash and the app icon, so it can't
// visibly jump at the moment the native splash is dismissed.
import { useEffect } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const CLOCK = require("../../assets/adaptive-icon.png"); // same clock as the app icon + native splash
const CLOCK_SIZE = 150; // must match `imageWidth` of the expo-splash-screen plugin (app.json) → no jump
const H = Dimensions.get("window").height;

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const cover = useSharedValue(1); // whole-overlay opacity — drives the final fade-out
  const clockScale = useSharedValue(1); // starts at rest to match the static native splash
  const wordOpacity = useSharedValue(0);
  const wordShift = useSharedValue(14);

  useEffect(() => {
    // The clock breathes once — a small, slow grow-and-settle. It begins at scale 1 (identical to the native
    // splash) so the hand-off shows no flicker; only then does it come alive.
    clockScale.value = withSequence(
      withTiming(1.06, { duration: 540, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 440, easing: Easing.inOut(Easing.quad) }),
    );
    // The wordmark rises and fades in just after the clock starts moving.
    wordOpacity.value = withDelay(180, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    wordShift.value = withDelay(180, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
    // Hold the finished logo briefly, then fade the overlay out and hand control to the app.
    cover.value = withDelay(
      1200,
      withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const clockStyle = useAnimatedStyle(() => ({ transform: [{ scale: clockScale.value }] }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordShift.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, coverStyle]} pointerEvents="none">
      {/* clock stays exactly centered (matches the native splash); the wordmark is absolute so it does not shove
          the clock upward, keeping the two frames aligned. */}
      <Animated.Image source={CLOCK} resizeMode="contain" style={[styles.clock, clockStyle]} />
      <Animated.Text style={[styles.word, wordStyle]}>LifePlanner</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  clock: { width: CLOCK_SIZE, height: CLOCK_SIZE },
  word: {
    position: "absolute",
    top: H / 2 + CLOCK_SIZE / 2 + 4, // just below the centered clock
    fontSize: 29,
    fontWeight: "800",
    color: "#3182F6", // token: brand
    letterSpacing: -0.4,
  },
});
