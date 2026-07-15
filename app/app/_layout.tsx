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
import { AnimatedSplash } from "@/ui/AnimatedSplash";
import { eraseLocal } from "@/core/data/erase";
import { router } from "expo-router";
import { rearmBlockAlarms } from "@/core/data/blockRepository";
import { rescheduleMorningBrief } from "@/core/notifications/morningBrief";
import { registerBackgroundSync } from "@/core/notifications/backgroundSync";
import { registerSelf } from "@/core/data/deviceRepository";

// Global default font (v5): inject Pretendard as the base family for every <Text> so utility screens
// don't have to thread fontFamily through each node. Instance styles are placed AFTER the base in the
// array, so any explicit fontFamily set on a node (e.g. the launch wordmark's Baloo2) still wins.
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
  // **Block first paint on ONLY the fonts the first frame needs** — this gate is the blank-white time before
  // the launch animation can even start, so every byte here delays startup. Pretendard = the app body face;
  // Baloo2 = the launch wordmark. We deliberately do NOT load GowunBatang here: it's an 8.4 MB serif that no JS
  // screen actually references (the execution moment is a native activity with its own font), so blocking cold
  // start on it bought nothing but a longer white screen. If a JS screen ever needs the serif, load it lazily
  // (Font.loadAsync) so it never gates launch again.
  const [loaded, error] = useFonts({
    Pretendard: require("../assets/fonts/Pretendard-Regular.ttf"),
    Baloo2: require("../assets/fonts/Baloo2-Bold.ttf"), // launch wordmark only, not the app body
  });

  // Dismiss the NATIVE splash as soon as JS can paint — NOT after fonts load — so the JS AnimatedSplash starts
  // drawing WHILE the fonts load, and the intro overlaps the load instead of following it. The overlay is on
  // top (same white), so this never reveals raw/unstyled app content underneath.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // The animated loading screen runs on top of the app until its own fade-out completes. It is handed `ready`
  // (fonts resolved or errored) so it can fast-forward the moment the app is actually ready and hand off.
  const [splashDone, setSplashDone] = useState(false);

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

    // The briefings carry each day's actual list, so they are re-cut at every launch — after a reboot, a
    // reinstall, or a day simply passing.
    void rescheduleMorningBrief();

    // Keep the other phones honest even when this one is closed (D77): a periodic background pull, kept alive
    // across reboots by the OS. Best-effort by nature — Android decides when it runs — and nothing depends on
    // it: the alarm is native and re-arms itself at boot.
    void registerBackgroundSync();

    return stop;
  }, [identified]);

  // NOTE: we intentionally do NOT `return null` until fonts load. The app tree renders immediately (behind the
  // opaque AnimatedSplash overlay), so any brief flash-of-fallback-font while Pretendard loads is hidden; by the
  // time the overlay fades, `ready` is true and the app is fully styled.
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
      {!splashDone && <AnimatedSplash ready={loaded || !!error} onFinish={() => setSplashDone(true)} />}
    </SafeAreaProvider>
  );
}
