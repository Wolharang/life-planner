# LifePlanner — app (React Native + Expo Dev Build)

The runnable MVP (the **trigger prototype**). Design/spec truth lives in `../docs/core/` (PRD,
architecture, data-model, decisions, design-principles) and `../docs/research/` (information-architecture,
user-flows, design-system, implementation-plan). This app implements it.

- **Stack (D34/D36):** React Native + Expo **Dev Build** (not Expo Go) · New Architecture · TypeScript ·
  NativeWind (design tokens in `tailwind.config.js`) · AsyncStorage (local-first) · a custom Kotlin exact-alarm
  module (Phase 1, not yet added).
- **Build order:** `../docs/research/implementation-plan.md` — **risk-first**: the exact-alarm reliability spike
  (Phase 1) is the make-or-break gate and must be validated on a **real Android device** (never an emulator).

## Prerequisites
Node 18+ · JDK 17 · Android SDK + platform-tools (`adb`) · Android Studio (for `expo prebuild`) · a **real,
OEM-representative Android device** with USB debugging on.

## Run (Phase 0)
```bash
cd app
npm install
# align versions to the installed Expo SDK if needed:
npx expo install --fix
# generate native android/ project (Dev Build; Expo Go can't host the native alarm module):
npx expo prebuild --clean
# build + install on the connected device:
npx expo run:android
```
You should see the **오늘** home screen with a seeded "21:00 헬스" task. Kill the app and reopen, then reboot
the device — the task must persist (Phase-0 exit gate: R5 local persistence).

## Status
- **Phase 0 (this commit):** project skeleton + NativeWind design tokens + local-first task repository + home
  list. ← toolchain + persistence baseline.
- **Phase 1 (next):** the native Kotlin exact-alarm module + full-screen ExecutionActivity — the make-or-break
  reliability spike (real-device: kill / lock / Doze / reboot, ±~1 min).
- Then Phase 2 execution moment (R3), Phase 3 task setup + recurrence + reminders, Phase 4 catch-up + settings,
  Phase 5 measurability. See the implementation plan.

## Layout
```
app/
  app/            expo-router routes (index = home)
  src/core/data/  domain types + repository (local-first; swap-behind-interface for full-app)
  tailwind.config.js   design tokens (= docs/research/design-system.md in code)
```
