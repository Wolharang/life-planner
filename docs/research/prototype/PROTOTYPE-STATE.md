# Prototype State Snapshot (2026-07-10)

> **Why this file exists.** The trigger prototype is **built, running, and founder-validated**; the project has
> moved to the full "integrated day" app. This snapshot records **exactly what the prototype is** so its design
> and foundations are **not lost or accidentally rebuilt** when the full app is layered on top. Nothing here is
> obsolete: `app/` is the live foundation the full app extends. Working language English; UI copy quoted Korean.

## Status
- **Trigger-prototype MVP = complete & running** (founder confirmed "정상 작동" on a real Android device, SM_A566S).
- Archived (this folder) as a completed sub-phase; **the code in `app/` stays as the foundation.**
- Active full-app product truth: `docs/core/service-overview.md` + `docs/core/spec.md`.

## What the prototype is
The **execution lever only**: exact-time alarm → lock-screen execution moment → no-guilt local logging +
measurability. Requirements **R1–R8 delivered**; **S1–S4** have a working measurement instrument
(`app/app/metrics.tsx`). Full acceptance list + on-device gate: `docs/research/prototype/prototype-test-checklist.md`.

## The runnable app — `app/` (DO NOT discard)
- **Stack:** React Native `0.76.9` + **Expo SDK 52** *Dev Build* (New Architecture / Fabric / bridgeless),
  TypeScript, **Android-first**. Router: `expo-router` (file-based).
- **Screens** (`app/app/`): `index.tsx` (home / 오늘 — hero + 오늘 switch-cards + 지난 기록 log), `add.tsx`
  (할 일 추가/수정 — big time, 반복 segmented, lead chips, 단순 알림), `execution.tsx` (**legacy RN fallback**
  route; the live moment renders **natively** in `ExecutionActivity`), `metrics.tsx` (S1–S4, dev-build link),
  `onboarding.tsx` (first-run permission grants), `settings.tsx` (fully functional — see below), `_layout.tsx`
  (font gate + global Pretendard default).

## Design skin — **v5 "Toss-form" (PROVISIONAL, PRESERVE)**
The current in-code skin (documented in `docs/core/design-system.md` §1). **It is provisional/iterating** — the
confirmed baseline (decision **D36**) is still the forest/gold palette; v5 is not locked. Both are recorded in
design-system.md. **Do not silently revert or overwrite it.**
- **Tokens live in `app/tailwind.config.js`** (NativeWind): brand **`#3182F6` (Toss blue)** = interactive;
  bg white + grey groups `group/line #F2F4F6`; **gold `#B0862A`** = the single DONE signal; **miss taupe
  `#8B7E74` (never red)**; execution ground **warm-white `#FBFAF6`**.
- **Fonts (free OFL, bundled `app/assets/fonts/`):** **Pretendard** (utility, global default via a `Text.render`
  patch in `_layout.tsx`) + **GowunBatang** serif (the execution-moment "voice" only). Only the Regular cut of
  each is loaded (bold is synthesized).
- **Execution moment craft:** serif commit line + **gold 도장(seal) SVG** on DONE (`react-native-svg`), no confetti.
- **Invariants (hold across any future skin):** execution moment = **light**; **no in-flow escape** (응/아직 only);
  no streaks/penalties; gold = DONE only; R1 "오늘은 쉼" pre-fire toggle.

## Native module — `app/modules/lp-alarm/` (local Expo module `LpAlarm`)
Exact-alarm scheduling + the fully-native lock-screen `ExecutionActivity` (COMMIT→5·4·3·2·1→첫 동작+확인→GO→
DONE), boot re-arm (`BootReceiver`), WorkManager backup scan, native `SoundSetting` (read at fire time even when
JS is dead). Config plugin: `app/plugins/withExecutionLockScreen.js`. JS façade: `app/src/core/notifications/alarm.ts`.

## Data (local-first, AsyncStorage — no account, fully offline)
Repos in `app/src/core/data/`: `lp.tasks.v1`, `lp.outcomes.v1`, `lp.fires.v1`, `lp.missed.v1`,
`lp.latencies.v1`; plus `lp.baseline.v1` (metrics), `lp.onboarded.v1` (onboarding), **`lp.settings.v1`**
(default lead), and the **native** sound flag. Scheduling: `app/src/core/schedule/taskScheduler.ts`. Plain
reminders: `app/src/core/notifications/plainReminders.ts`.

## Settings — fully functional (no stubs)
소리 (native) · **기본 리드 시간** (R8, `settingsRepository.ts`) · **배터리 최적화 제외** · **백업 내보내기/
가져오기** (local JSON, merge/overwrite per D2/D24, `app/src/core/data/backup.ts`) · **실행 준비 상태** card
(re-runs onboarding) · 측정 (dev-build). Two out-of-scope mockup slots (login/sync, dark theme) were
deliberately **replaced** with these real features, not built (PRD §7.2 / design-system §1.4).

## Dev-bench removed (Phase-5 cleanup)
Deleted: `alarm-test.tsx` + its home link, the native `testAlarmSound` diagnostic, and the unused
`seedIfEmpty()` demo seed. A fresh install starts empty.

## Key extra dependencies added during the prototype
`react-native-svg`, `expo-font`, `expo-splash-screen`, `expo-file-system`, `expo-sharing`,
`expo-document-picker` (all free, SDK-52 aligned). Base: `nativewind`, `expo-router`, `expo-notifications`,
`@react-native-async-storage/async-storage`, `expo-haptics`, `react-native-reanimated`.

## How to build / run / verify
```bash
cd app && npx expo prebuild --clean && npx expo run:android   # real Android device (alarm unreliable on emulator)
npm run typecheck && npm test
```
Verification checklist: `docs/research/prototype/prototype-test-checklist.md`.

## Not blocking the full app (optional prototype follow-ups)
- Set the provisional `[TBD]` values (S1 tolerance, R3 timings, R6 window, S2/S3 targets) from real runs.
- Record the founder's pre-prototype baseline; run the N-week self-experiment (evidence for S1–S4).
- Lock (or replace) the v5 skin → then promote to a confirmed D-entry in `docs/core/decisions.md`.

## Build history
Full round-by-round history: `docs/research/prototype/build-log.md`.
