import "../global.css";
import React, { useEffect, useState } from "react";
import { Text as RNText } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { checkClosedWhileSignedOut, onAccountClosed, startSync } from "@/core/data/sync";
import { Sheet } from "@/ui/Sheet";
import { eraseLocal } from "@/core/data/erase";
import { router } from "expo-router";
import { rearmBlockAlarms } from "@/core/data/blockRepository";
import { registerSelf } from "@/core/data/deviceRepository";

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
  // **Identify this phone BEFORE any alarm is armed** (D70). `scheduleBlock` has to know which device it is on
  // to decide whether the moment belongs to it; if it doesn't know, it errs loud (fires everywhere) — an alarm
  // on the wrong phone is an annoyance, an alarm on *no* phone is the product failing. Registering first turns
  // that fallback from a routine occurrence into the emergency it is meant to be.
  const [identified, setIdentified] = useState(false);
  useEffect(() => {
    registerSelf()
      .catch(() => {
        // storage refused — the app still runs; blocks simply fall back to firing everywhere
      })
      .finally(() => setIdentified(true));
  }, []);

  // **The account was closed on another phone** (D76). This device finds out the moment it next talks to the
  // server, signs itself out, and says so — *a phone that silently logs itself out is a phone the user assumes
  // is broken.*
  //
  // **And it honours the choice that was made on the other phone.** "기기 기록도 함께 지우기" is a decision about
  // the account, not about the handset that happened to be in your hand — so the tombstone carries it, and
  // every device does the same thing. Otherwise "모든 기기에서 지웠다" would quietly mean "지운 폰에서만 지웠다".
  const [closed, setClosed] = useState<null | { wiped: boolean }>(null);
  useEffect(() => {
    if (!identified) return;
    onAccountClosed(async (wipeDevices) => {
      if (wipeDevices) {
        await eraseLocal();
        router.replace("/"); // whatever screen they were on is about to be a list of things that no longer exist
      }
      setClosed({ wiped: wipeDevices });
    });
    const stop = startSync({
      blocks: rearmBlockAlarms, // one unit now (D67) — a remote block arms its own alert here
    });

    // The phone that was offline too long: Firebase signed it out before we could ask. Ask anyway, using the
    // uid it last synced as — otherwise a device that reconnects a day later never learns, never wipes, and
    // never explains its own logout.
    void checkClosedWhileSignedOut();

    return stop;
  }, [identified]);

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
      <Sheet
        visible={!!closed}
        title="계정이 탈퇴되었어요"
        message={
          closed?.wiped
            ? "다른 기기에서 회원 탈퇴하면서 모든 기기의 기록을 지우기로 했어요. 이 기기의 기록도 지웠고, 로그아웃했어요."
            : "다른 기기에서 회원 탈퇴가 이루어졌어요. 이 기기는 로그아웃했고, 여기에 저장된 기록은 그대로 남아 있어요."
        }
        onClose={() => setClosed(null)}
        actions={[]}
        cancelLabel="확인"
      />
    </SafeAreaProvider>
  );
}
