import "../global.css";
import React, { useEffect } from "react";
import { Text as RNText } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { startSync } from "@/core/data/sync";
import { rearmBlockAlarms } from "@/core/data/blockRepository";

// Global default font (v5): inject Pretendard as the base family for every <Text> so utility screens
// don't have to thread fontFamily through each node. Instance styles are placed AFTER the base in the
// array, so any explicit fontFamily (e.g. the execution moment's GowunBatang serif) still wins.
// Defensive: only patch when Text.render is really a function, only wrap valid elements, and never let a
// failure here take the app down (a font default must not be able to crash rendering).
try {
  const anyText = RNText as unknown as {
    render?: (...args: unknown[]) => unknown;
    __lpFontPatched?: boolean;
  };
  if (typeof anyText.render === "function" && !anyText.__lpFontPatched) {
    const prevRender = anyText.render;
    anyText.render = function render(...args: unknown[]) {
      const el = prevRender.apply(this, args);
      try {
        if (React.isValidElement(el)) {
          const props = el.props as { style?: unknown };
          return React.cloneElement(el, { style: [{ fontFamily: "Pretendard" }, props.style] } as never);
        }
      } catch {
        // never let the font default break a render — fall through to the original element
      }
      return el;
    };
    anyText.__lpFontPatched = true;
  }
} catch {
  // Text internals differ on this RN build — fall back to the system font rather than crash.
}

// Keep the splash up until the custom fonts are ready → no flash of the system font (v5 skin).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Family names here are what the global patch / execution serif reference. We load only the Regular
  // cut of each family (bold is synthesized from fontWeight) — the extra weight files were never
  // referenced by family name, so loading them only cost startup memory/time. Keeping it lean.
  const [loaded, error] = useFonts({
    Pretendard: require("../assets/fonts/Pretendard-Regular.ttf"),
    GowunBatang: require("../assets/fonts/GowunBatang-Regular.ttf"),
  });

  // Hide the splash once fonts resolve (or fail — never hang the app on a font error).
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Sync (R2/F0). Logged out — and in any build without Firebase — this does nothing at all and the app
  // is exactly the local-first app it was (D20/R11). The hooks are what make a REMOTE change real on this
  // device: a block created on the other phone must arm its alarm here, or sync would move rows without
  // moving the lever. Alarm reconciliation stays in the repository, as architecture §9-2 requires.
  useEffect(
    () =>
      startSync({
        blocks: rearmBlockAlarms, // one unit now (D67) — a remote block arms its own alert here
      }),
    [],
  );

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" }, // token: bg (v5)
        }}
      />
    </SafeAreaProvider>
  );
}
