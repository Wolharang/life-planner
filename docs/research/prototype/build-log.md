# Build log

Chronological journal of the runnable app in `app/`: **what was built, problems hit, how they were
diagnosed and fixed, and how the implementation evolves.** Complements — does not replace —
`docs/research/prototype/implementation-plan.md` (the plan) and `docs/core/decisions.md` (product/architecture D-log).
Newest entries at the top. Working language: English (per CLAUDE.md); product/UI copy stays Korean.

---

## 2026-07-10 — Dev-bench removal (Phase 5 prep — "perfect prototype")

Stripped the developer/test surfaces so the build is the clean prototype the founder runs for the
measurement self-experiment (implementation-plan Phase 5 cleanup):
- **Removed the alarm spike harness** — deleted `app/app/alarm-test.tsx` and its `__DEV__` home-header
  link (`index.tsx`). The `/alarm-test` route is gone.
- **Removed `testAlarmSound`** — the diagnostic `Function("testAlarmSound")` in `LpAlarmModule.kt` (+ its
  now-orphaned imports: RingtoneManager/MediaPlayer/AudioAttributes/AudioManager/Handler/Looper) and the
  `alarm.testAlarmSound()` JS façade method.
- **Removed dead `seedIfEmpty()`** from `taskRepository.ts` — it was never called (no demo "헬스" seed can
  be injected); a fresh install now starts genuinely empty ("첫 할 일을 정해보자").

Kept on purpose: **측정 (metrics S1–S4)** — it is the measurement *instrument* for the self-experiment,
not a test harness; stays reachable (dev-build `__DEV__` link in Settings). `execution.tsx` (the JS
`/execution` route) kept as the legacy RN-handoff fallback — the live moment renders natively in
`ExecutionActivity`. `npm run typecheck` ✓ · `npm test` ✓; `prebuild --clean` re-run (native Kotlin
change). On-device build + the Phase-5 verification checklist are the next step.

---

## 2026-07-10 — Settings made fully functional (no stubs) — round #4

Made every Settings row real (removed the `soon()` "추후 구현 예정" stubs). Two mockup slots that are out
of the confirmed prototype scope were **replaced with in-scope real features** per the founder's decision,
rather than built as-labelled:

- **로그인/동기화 → 실행 준비 상태 card.** Account+cloud sync is deferred (PRD §7.2/R5 "no login or account
  anywhere", D35). The prominent card now shows live permission readiness (exact-alarm · full-screen-intent ·
  notifications via `alarm.*` + `notificationPermissionGranted()`) as "N/3 준비됨" and taps through to the
  existing `onboarding.tsx` to grant what's missing. Reuses §8 graceful-denial, no new surface.
- **화면 테마 → 배터리 최적화 제외 row.** A dark theme is full-app/later (design-system §1.4; the app stays
  light). Replaced with a real reliability control: status via `alarm.isIgnoringBatteryOptimizations()`, tap →
  `alarm.requestIgnoreBatteryOptimizations()` (the one grant onboarding doesn't cover; a killed process delays
  the alarm).

Real features implemented:
- **기본 리드 시간** (PRD R8 "a personal default lead, is optional and local"). New `settingsRepository.ts`
  (`lp.settings.v1`, same repo pattern). Settings row expands to preset chips (정각/15/30/60/직접). `add.tsx`
  pre-fills a NEW task's lead from it (edit still uses the task's own value).
- **백업 내보내기 / 가져오기** (local JSON, D2 + D24). New `backup.ts` + deps `expo-file-system`,
  `expo-sharing`, `expo-document-picker`. Export bundles every `lp.*` key + the native sound flag →
  `Sharing.shareAsync`. Import (via `DocumentPicker`) applies **merge** (append by per-key identity — tasks
  by id, outcomes by taskId|date|source, etc.) or **overwrite** (D24), then **re-arms alarms + reminders** for
  the resulting task set (cancel before∪after ids → `scheduleTask`/`scheduleReminders`) so restored tasks fire
  and dropped ones leave no ghost (R1). LOCAL only — no network, so R5's offline/no-account principle holds.

Scope notes: default-lead is PRD-sanctioned; backup/import is pulled into the prototype early (D2/D24 define
it; local-only so it doesn't breach R5). No confirmed D-entry added — these are additive prototype features
that don't overturn a decision. **NOT built (out of scope, per decision):** account login / cloud sync, dark
theme. `npm run typecheck` ✓ · `npm test` ✓; on-device pending (new native deps → `prebuild --clean` + run).

---

## 2026-07-10 — v5 "Toss-form" skin — round #3 (Add features restored + stability, PROVISIONAL)

- **Add:** restored the full PRD/D35 controls in the mockup's style — **언제 (실행 알림 시점)** lead presets
  (정각/15/30/60/직접 + custom minutes) and **단순 알림** multi-offset reminders, both as filled chips
  matching the 반복 segmented look. Save writes `leadMinutes = effectiveLead` and the selected
  `plainReminderOffsets` again (round #2 had hidden the UI and passed defaults through).
- **Stability hardening** (device reported crashes / instability):
  - The global `Text` font default is now **fully guarded** — patched only when `Text.render` is a
    function, wraps only valid elements, and both the install and the per-render clone are in `try/catch`
    so a font default can never take a render down.
  - **Fonts trimmed to the Regular cut only** (`Pretendard-Regular`, `GowunBatang-Regular`); the unused
    SemiBold/Bold files were referenced by no family name, so loading them only cost ~11MB of startup
    memory. Bold is synthesized from `fontWeight`.
  - `npx expo install --fix` → dependencies already aligned to SDK 52 (no version drift).
- **Native crash triaged — `java.lang.IllegalArgumentException: App react context shouldn't be created
  before` (expo.modules.devlauncher.…DevLauncherAppLoader).** This is an **expo-dev-client launcher race**
  (fires in `MainActivity.onCreate` before JS runs; the log showed the launch intent firing repeatedly),
  **not** app/JS/design code — `MainActivity`/`MainApplication` are stock generated. It is **dev-client
  only** (a release build has no dev-launcher). Remedy: uninstall + reinstall, then open once from the
  app icon (avoid repeated deep-link opens); `./gradlew clean` if it persists.

---

## 2026-07-10 — v5 "Toss-form" skin — round #2 (match reference mockups, PROVISIONAL)

Second iteration: rebuilt Home / Add / Settings to match three reference mockups pixel-for-intent.
Still provisional (see round #1 + `design-system.md §1` "⚠ 진행 중"). **Logic unchanged; typecheck + jest
green.**

- **Home:** date header (`M월 D일 요일`) + plain 설정 link; hero shows the nearest execution and the 오늘
  list shows **every** task (the nearest is echoed, not removed). 오늘 rows are grey cards with a **switch**
  that IS the R1 "오늘은 쉼" toggle (ON = 대기, OFF = 쉼 — *not* an alarm on/off switch). 지난 기록 = a dense
  log with a leading icon + relative day/time + **됨 / 미스 / 쉼** badge (gold-soft / taupe / grey).
- **Task icon** is **inferred from the title** (헬스→dumbbell, 러닝→runner, else a neutral clock) — purely
  cosmetic, never touches logic. Follow-up: a real `Task.kind`/icon field instead of keyword-matching.
- **Add:** rebuilt to the mockup — big time + blue underline, underlined 제목 / 첫 동작 메모, 실행 알림
  toggle, 반복 segmented (없음/매일/매주), 저장. The **lead-time presets + plain-reminder offsets UI are
  hidden this round** (return next round in the same style); their values are **preserved on save**
  (existing task's, or defaults 0 / []) so no PRD/D35 behaviour is lost — only the UI is deferred.
- **Settings:** rebuilt to the mockup (grey ground · white grouped cards · profile card · 일반 / 데이터).
  Only **소리** (real, native-stored) and the dev **측정** link are wired. The mockup's **로그인/동기화,
  기본 리드 시간, 화면 테마, 백업 내보내기/가져오기** are **out of the confirmed prototype scope** (D35
  local-only/no-account; theme = full-app; lead = per-task) → shown as **"추후 구현 예정" stubs** (tap →
  gentle alert), per the user's "fill real where it fits, else mark coming-soon" direction.

---

## 2026-07-10 — v5 "Toss-form" visual skin — round #1 (PROVISIONAL, not locked)

Applied an externally-commissioned redesign ("Toss-form + one craft moment") as the first of several
planned iteration rounds. **This is explicitly provisional** — the palette/type are being revised and are
NOT confirmed (docs kept accordingly: no new D-entry; D36 forest/gold stays the confirmed baseline; a
"⚠ 진행 중" note was added to `design-system.md §1`).

### What (code)
- **Palette pivot (in code only):** brand forest `#1B4332` → **Toss blue `#3182F6`** (all interactive), app
  bg → white with grey groups (`group/line #F2F4F6`), gold `#C9A227` → `#B0862A`, execution ground →
  warm-white `#FBFAF6`. `tailwind.config.js` replaced; header comment flags it provisional.
- **Custom fonts (new):** added `react-native-svg`, `expo-font`, `expo-splash-screen`; bundled **Pretendard**
  (Regular/SemiBold/Bold) + **GowunBatang** (Regular/Bold), both free OFL, under `app/assets/fonts/` (+ OFL
  texts). `_layout.tsx` loads them behind a splash gate and installs a global `Text.render` patch so
  Pretendard is the base family everywhere (instance `fontFamily` — e.g. the execution serif — still wins).
- **Execution moment:** serif (GowunBatang) commit/countdown/go/done voice + a **gold 도장(seal)** SVG that
  springs in on DONE, replacing the bordered check (still "one calm signal, no confetti"). **Logic unchanged.**
- **Home (`index.tsx`):** reskinned onto the Toss layout — next-execution **hero card**, grey **오늘** cards,
  dense **지난 기록** log with taupe/gold badges, pinned "＋ 할 일 추가" button. **All logic preserved**
  (catch-up net R6, permission banner §8, R1 "대기/쉼" skip toggle, real repositories).
- **Utility screens** (add/settings/metrics/onboarding/alarm-test): token/hardcode sweep — removed the deleted
  `divider`/`ink-faint` tokens (`border-line`/`text-faint`), swapped hardcoded forest `#1B4332` → blue and
  placeholder `#9AA39C` → `faint #B0B8C1`. Copy/flows untouched.

### Problems / decisions
- The v5 `tailwind.config.js` **dropped tokens the 6 wired screens used** (`divider`, `ink-faint`,
  `brand.deep`) → would have silently killed borders/faint text. Fixed by sweeping every screen to the new
  vocabulary (chose the sweep over back-compat aliases, per plan).
- The proposed `HomeScreen.tsx` was a **mock with fake arrays** — could not replace the wired `index.tsx`; its
  *visual structure* was ported onto the real data/logic instead. Its per-task workout/run icons were
  **omitted** (the `Task` model has no `kind` — no fabricated categorization).
- Brand forest→blue **conflicts with D36 + design-system**; per CLAUDE.md this was surfaced and the user chose
  the rebrand direction, but kept it **provisional** — hence docs record it as "진행 중", not confirmed.

### Verified
- `npm run typecheck` ✓ · `npm test` ✓ (scheduler suite green → execution/scheduling logic untouched).
- On-device build (`expo prebuild --clean` + `run:android`) pending — required because of the new native deps
  (react-native-svg) and bundled fonts; visual + alarm-fire verification happens there.

---

## 2026-07-10 — Multi-agent verification reconciliation (14 confirmed deviations) + fixes

A 103-agent verification workflow (spec-doc extraction → per-area conformance → skeptic + **Fable-5**
adversarial verify; **363 requirements, 394 OK, 45 raw → 14 adversarially-confirmed deviations**) cross-checked
the first manual pass and surfaced real issues it had missed. Triage/synthesis was done manually (the workflow
hit the session token limit during its synthesis stage). Fixed the confirmed, in-scope ones:

### Correctness
- **F5 — commit line showed the effective time, not the SET time (PRD R3).** With lead>0 (the seed is
  21:00 헬스 / lead 30) the lock-screen line read "20:30 헬스" — misquoting the user's own promise, which the
  commit-framing lever must never do. Threaded `leadMinutes` through the whole native path (AlarmItem → intent
  extras → AlarmReceiver → AlarmMirror → ExecutionActivity; JS `scheduleExactAlarm`/`alarm.schedule`/
  `scheduleTask`) and render `clock(intended + lead)`. Display-only — `intended` still keys the date + S1 delta.
- **F8 — a recurring task whose lead put the effective time in the past skipped today instead of firing ASAP
  (PRD R1).** `nextEffectiveFireAt` advanced to the next date whenever the *effective* time was past, even with
  the SET time still future. Now advances only when the SET time itself has passed (`d.getTime() <= now`),
  matching the one-shot branch (returns the past effective → setAlarmClock fires immediately). Also removes an
  R6 phantom-miss on the edit path.
- **F9 — the R6 never-fired reconstruction was wrong for WEEKLY (a bug in the prior Phase-4 fix).**
  `pastOccurrenceFires` anchored on *today's* weekday, so weekly tasks both missed real occurrences and
  synthesized phantom ones on the wrong weekday → false "놓쳤어요" cards + false `miss` auto-archives (an R7
  violation). Now anchored on the native mirror's armed `fireAt` (the true series/weekday) via
  `alarm.getScheduled()`; this also subsumes the "native will re-fire it" guard (anchor ≤ now → leave to the
  WorkManager backup). Daily behaviour unchanged.

### Real, lower-severity
- **F2 — status-bar "show" PendingIntent omitted note+createdAt** → opening the moment via the status-bar alarm
  icon lost the micro-start note + time-accurate line. Added the missing extras (now incl. lead) to
  `showPendingIntent`, matching the fire path.
- **F3 — native exec primary button was a square,** not the design-system pill. `brandButton` now uses a rounded
  `GradientDrawable` (radius 999) per design-system §1.5/§3/§4.2 (matches the RN reference).
- **F7 — §10 pre-commitment validity guard not measurable.** The commit→fire gap was never captured, so a
  last-minute-created occurrence counted fully into S2. index.tsx now stamps the task's `createdAt` onto each
  drained fire (JS-store lookup — no native change); metrics.tsx computes gap = intended − createdAt for
  execution-screen dones and flags "임박 생성(1시간 이내) N건 — 제외 시 S2 M%" ([TBD] threshold).
- **F10 — no first-run onboarding; POST_NOTIFICATIONS never requested (PRD §8, user-flows fatal).** Added
  `app/app/onboarding.tsx` (gated by `lp.onboarded.v1`): explains WHY before requesting, teaches the four
  mechanics, and drives the notification (runtime) + exact-alarm + FSI grants; denial falls through to the
  existing home banner. Added `requestNotificationPermission`/`notificationPermissionGranted` (lazy/defensive)
  — plain reminders were silently failing on Android 13+ without the runtime grant.
- **F11 — touch targets < 48dp (design-system §3 / A3).** Added hitSlop to the skip toggle, catch-up
  했어/미룸/나중에, and 설정 chip; widened the 했어↔미룸 gap (opposite, non-undoable outcomes → a mis-tap logging a
  false miss brushes no-guilt).
- **F12 — home row showed set time + lead suffix, not the effective fire time (PRD R1).** Row now shows the
  effective HH:mm with "(set time · N분 전)" as context.

### Documented as intentional / deferred (not changed)
- **F1 native re-arm is skip-unaware** — harmless while skips are today-only (every toggle re-arms via the
  skip-aware JS `nextEffectiveFireAt`); documented the load-bearing invariant on `nextFutureOccurrence` instead
  of adding a per-open `scheduleTask` self-heal (which would re-fire the F8 past-effective case).
- **Dev bench / `testAlarmSound`** — still needed for the pending overnight-Doze + Phase-5 dry run; removal moved
  into the Phase-5 exit-gate checklist (implementation-plan) so it isn't shipped into the measurement run.
- **Countdown active tick uses gold** — matches the RN reference (execution.tsx) and is documented as intended;
  left as-is (the stricter "gold only at DONE" reading is a wash).

### Verify / rebuild
`npm run typecheck` passes. **F2/F3/F5 touch Kotlin → a full `npx expo run:android` is required** (a Metro
reload won't pick up native changes); all JS fixes apply on reload. The new `/onboarding` route regenerates
expo-router types on the next `expo start`/`prebuild` (the `as never` cast is a temporary types-lag shim).
Device verification pending (founder).

---

## 2026-07-09 — Spec-vs-code verification pass (founder-requested audit) + conformance fixes

Ran a full audit against the spec: a multi-agent workflow (spec docs → per-code-area conformance →
adversarial verify incl. a **Fable-5 advisor** lens) **plus** a manual re-read of every screen/module against
PRD / decisions / data-model / design-principles / design-system / implementation-plan. **Verdict:** the
execution core (native R3 moment — light palette, COMMIT→5·4·3·2·1→merged micro+confirm→GO→DONE, no in-flow
miss, single gold DONE) and the alarm spine (`setAlarmClock`, FSI-over-lock, boot re-arm, WorkManager backup,
R8 sound) **conform to intent**. Found and fixed four conformance gaps + reconciled two docs. JS-only changes
(no Kotlin this pass) → a Metro reload picks them up.

### D1 (HIGH) — R6 "놓쳤어요" (never-fired) was unimplemented
- **Found:** `computeCatchUps` reacted only to native fire markers → only the *fired-but-not-done* path.
  A **recurring** occurrence missed because the device was **off** at fire time is advanced past by
  `BootReceiver` (leaves no marker), so it was **never surfaced** — contradicting PRD R6 + impl-plan Phase-4
  gate ("device-off-at-fire → 놓쳤어요"). The earlier autonomous-batch note ("WorkManager self-heal re-fires
  it") holds only for one-shots and no-reboot drops, **not** for reboot-advanced recurring occurrences.
- **Fix:** `taskScheduler.pastOccurrenceFires(task, from, now)` reconstructs past recurring occurrences from
  the recurrence rule (bounded by `createdAt` + a 30-day lookback). `computeCatchUps` now emits **two card
  kinds** — `missed` ("[제목] 놓쳤어요 — 지금이라도?") for never-fired, `fired` ("[제목], 아직 안 했죠 — 지금
  할까요?") for deferred — de-duped against markers/outcomes and auto-archived as `miss` past the 7-day window.
  A guard skips tasks the native mirror still holds **past-due** (WorkManager will re-fire those) so the JS and
  native backstops never double-surface; JS owns only the reboot-advanced case.

### D2 (HIGH) — §8 graceful-denial banner missing
- **Found:** no home banner when the OS denies exact-alarm / full-screen-intent → the lever "**dies silently**"
  (violates PRD §8 + design-system §4.3 "Permission/degraded banner"). The native readiness openers existed but
  nothing surfaced them.
- **Fix:** home checks `canScheduleExactAlarms()` + `canUseFullScreenIntent()` on open/resume and shows a
  persistent gentle banner **"실행 알림이 잠금화면을 못 뚫어요 — 켜기"** → one tap to the missing permission's settings.

### D3 (MEDIUM) — `skipped` / `pre-skip` outcome missing
- **Found:** PRD §7.1.0 defines a `skipped` outcome (source `pre-skip`) for the R1 "오늘은 쉼" toggle, but the
  types (`types.ts`, `outcomeRepository.ts`) and data-model §8.2 omitted it and the toggle recorded nothing →
  a pre-skipped occurrence never appeared in home history (R1 wants a `skipped` badge).
- **Fix:** added `skipped`/`pre-skip` to both type sets + data-model §8.2; `toggleSkip` records a `skipped`
  outcome on skip-on and removes it on un-skip (`removeOutcome`); home + metrics show a neutral **"쉼"** badge;
  `skipped` stays **out of the S2 denominator** (guilt-free, not a miss).

### D4 (LOW) — add-screen presets off-spec
- **Found:** plain-reminder presets were {10/30/60분} (PRD §7.1.0 wants {정각/15/30/60}); the specced "직접
  (custom)" option (PRD §7.1.0 + Phase 3 + design-system §4.3) was absent on both pickers.
- **Fix:** aligned plain-reminder presets to {정각/15/30/60}; added an opt-in **"직접"** custom to both the lead
  and plain-reminder pickers (collapsed by default, keeping setup light per §8).

### Doc reconcile (code was right, docs were stale)
- **design-system §4.3** "시작했어? confirm" row still listed the removed in-flow **"오늘은 못 해"** + "이탈은
  카운트다운 뒤" (pre-v0.5) → updated to the v0.5 merged micro+confirm (응/아직 only, no in-flow escape) + a v0.6
  **GO** row. **data-model §8.2** status/source enums reconciled to PRD §7.1.0.

### Verify
`npm run typecheck` **passes**. `npm run lint` unavailable (eslint not installed — pre-existing env gap, not
from this pass). Device verification still pending (founder). No native/Kotlin change this pass, so no rebuild
needed for these fixes; expo-notifications still needs the one-time `prebuild --clean` (prior note).

---

## 2026-07-09 — Remaining plan features (autonomous batch): R6 · Phase 5 · reminders · collision · no-guilt

Built the rest of `implementation-plan.md` in one pass (founder authorized "make it all, I'll verify after").
Not yet device-verified.

### R6 catch-up (Phase 4)
`PendingFires` (native) records "the moment appeared" on ExecutionActivity create; drained on open into
`firedRepository`. A fire with no `done` outcome for its date = **fired-but-not-done** → home shows a gentle card
"[title], 아직 안 했죠 — 지금 할까요?" [했어 / 미룸 / 나중에] (records source=catch-up). Auto-archive as miss after
~7 days [TBD]. Never-fired (device off) is still caught by the WorkManager self-heal (re-fire). "나중에" = once per
open (stays in the net, re-shows next open).
> **[Superseded 2026-07-09 — see the verification-pass entry above.]** The "WorkManager self-heal catches
> never-fired" claim is only true for one-shots / no-reboot drops. A **recurring** occurrence missed while the
> device was **off** is advanced past by `BootReceiver` on reboot (mirror fireAt → future), so WorkManager does
> **not** re-fire it. That gap is now filled by the JS never-fired derivation ("놓쳤어요" card).

### Phase 5 measurability (S1–S4)
`latencyRepository` (never pruned) logs every fire's latency. `app/app/metrics.tsx` (⚙ 설정 → 측정) computes
**S1** (±1min hit-rate + max delta), **S2** (execution-screen-done ÷ resolved; catch-up/miss shown separately),
**S3** (total done vs a hand-entered baseline), **S4** (return-after-miss %), + raw recent outcomes.

### Plain reminders (Phase 3, R2 soft path)
`expo-notifications` added. `plainReminders.ts` schedules **soft, silent** local notifications at chosen offsets
({10/30/60분 전}, multi-select in 할 일 추가); cancelled on delete; rescheduled on app open (recurring roll).
NOT lock-screen takeovers, not held to S1. Foreground handler in `_layout`.

### Collision queue (Phase 3 / R2)
`ExecutionActivity` (singleInstance) now **queues** occurrences that fire while one is showing (`onNewIntent` →
queue; `dismiss()` → next or finish) → sequential, never stacked over the lock screen.

### R7 no-guilt sweep
Audited: **no** streaks / consecutive counters / penalties anywhere; miss & 미룸 use taupe `miss` (never red);
catch-up gentle; DONE one calm gold mark; the in-flow miss button stays removed (v0.5). **Compliant.**

### Build (native + a new native dependency → prebuild required)
`npx expo install expo-notifications` → `npx expo prebuild --clean` → `npx expo run:android`.
- **Gotcha (hit on device):** expo-notifications' native module `ExpoPushTokenManager` links only via **prebuild**,
  not a plain `run:android` after install → `Cannot find native module 'ExpoPushTokenManager'` crashed the app (the
  import was at `_layout` module scope). **Hardened:** removed the `_layout` top-level import, and `plainReminders`
  now loads expo-notifications **lazily + defensively** (`require` in try/catch) so a missing native module makes
  reminders no-op instead of crashing the whole app. Reminders start working once the prebuild links it.

---

## 2026-07-09 — Phase 4 (in progress): settings + sound (R8)

### Slice 4a — settings screen + execution sound (built)
- `app/app/settings.tsx` — **실행 알림 소리** toggle (R8, default OFF = haptic-only), reachable via a **⚙ 설정**
  link on home.
- Stored **natively** (`SoundSetting`, SharedPreferences) so the execution moment reads it at fire time even when
  JS is dead: `alarm.getSound/setSound` → `LpAlarmModule` → `SoundSetting`. `ExecutionActivity` plays the default
  **alarm ringtone (looping)** during COMMIT when on, and stops it at the first interaction / on dismiss. Routed
  to the **ALARM stream** (`AudioAttributes.USAGE_ALARM`, via `MediaPlayer`) so it sounds even in **silent/vibrate
  mode**. The device's alarm volume was stuck low/unadjustable, so the moment now **maxes the ALARM stream while it
  plays and restores it on dismiss**, and sets `volumeControlStream = STREAM_ALARM` so the volume keys adjust the
  alarm on that screen. (The moment must be loud — C1 "딱 하나만 시끄럽게".)
- **Resolution:** the long "no sound" chase was simply the **in-app "실행 알림 소리" toggle being OFF** (default =
  haptic-only, per R8) — sound plays once enabled. Playback/URI/volume were verified with a temporary 🔊 diagnostic
  (`testAlarmSound`, `alarmVol=15/15`), now removed from the UI. Also re-confirmed: **Kotlin changes need a full
  `npx expo run:android`** — a Metro reload leaves native functions undefined (e.g. `testAlarmSound is not a function`).

### Next
R6 catch-up (missed / not-done net) · plain reminders (expo-notifications) · Phase 5 (S1–S4 measurability).

---

## 2026-07-09 — Phase 3 (in progress): task setup + home list + real scheduling (R1/R2)

### Slice 3a — create + home list + schedule (built; JS-only)
- `app/app/add.tsx` — 할 일 추가: time + title (required) · micro-start note · **execution-alarm toggle (default
  ON, §8)** · lead presets {정각/15/30/60분} · recurrence {한 번/매일/매주}. Validates title + time; a past set
  time with recurrence "한 번" is rejected ("이미 지난 시각이에요.").
- `app/src/core/schedule/taskScheduler.ts` — `nextEffectiveFireAt` (= set time − lead, next applicable date) +
  `scheduleTask` / `unscheduleTask`. On save → schedules the real exact alarm (carrying note + createdAt into the
  execution moment); recurring re-arming is native.
- `app/app/index.tsx` — home renders real tasks (set time · recurrence · lead · 예정/알람 꺼짐), reloads on focus,
  ＋ → /add, **long-press → delete cancels the alarm (no ghost — R1)**. Auto-seed removed (empty → invites create).
- `taskRepository.updateTask` added (for Phase-3b edit).

### Slice 3b — edit + pre-skip toggle (built; JS-only)
- `app/app/add.tsx` now handles **edit** (`?id`): prefill, preserve createdAt + skippedDates, save → `updateTask`
  + reschedule (same id → **editing the time moves the alarm**), plus a **삭제** action.
- `app/app/index.tsx`: **tap a task → edit**, **"예정" chip → toggle "오늘 쉼"** (pre-fire skip, re-togglable),
  skipped rows dim. `taskScheduler.nextEffectiveFireAt` now skips `skippedDates` → re-arms to the next
  non-skipped occurrence (or cancels a skipped one-shot). `Task.skippedDates` added.

### Slice 3c — outcome history (built)
- Home shows a **지난 실행** section (`outcomeRepository`, newest first): title · date · **완료/미룸** badge
  (미룸 = taupe `miss`, never red — B1). Outcomes carry a denormalized **title** so history survives task deletion
  — plumbed through the native path (`PendingOutcomes.record`/consume → `LpAlarmModule.consumePendingOutcomes` →
  home `sync` → `recordOutcome`) and the in-app preview.
- Home `sync` drains native outcomes then reloads (tasks + outcomes).

### Slice 3c (remaining) / Phase 4 — next
Plain reminders (expo-notifications, soft path) · then Phase 4 (R6 catch-up, R7 no-guilt sweep, R8 settings sound)
· Phase 5 (S1–S4 measurability).

---

## 2026-07-09 — Phase 2 (in progress): the execution moment (R3)

### Slice 2a — R3 state machine in RN (built; JS-only; testable standalone)
- `app/app/execution.tsx` — the full R3 machine per PRD §7.1 R3: COMMIT (time-accurate commit line +
  "시작할게") → COUNTDOWN (5·4·3·2·1, ~1s, haptic tick) → MICRO-START (task note or default
  "딱 첫 동작만 — 지금 일어나기") → CONFIRM ("시작했어?" · 응/아직/오늘은 못 해) → DONE ("안 하던 걸
  해냈다.") / MISS ("괜찮아. 미룬 건 실패가 아니라 데이터야." — taupe, never red) / PENDING (dismiss).
  Every state has its idle/auto landing (COMMIT-idle 30s → PENDING, MICRO-auto 10s → CONFIRM, CONFIRM-auto
  60s → PENDING) [TBD, Phase 5]. Commit line is time-accurate from `createdAt` (어제 / 아까 / N일 전 /
  neutral) — never a false "어제". Haptics on FIRING, each countdown tick, and DONE.
- `app/src/core/data/outcomeRepository.ts` — minimal outcome store (AsyncStorage): records done/miss with
  **source = execution-screen** (S2 measurability) + timestamp.
- Dev bench: "▶ 실행 화면 미리보기 (R3)" button opens `/execution` with sample params — walkable now via JS.

### Correction — founder feedback on the running R3 screen (→ PRD v0.5)
The first RN pass diverged from earlier founder direction; corrected across docs + code:
- **LIGHT, not dark.** The moment was mistakenly built on the "dark execution world"; the founder had
  repeatedly asked for a bright screen. `exec.*` tokens → light (`bg #F4F7F2`, dark ink); design-system
  §1.2/§1.4/§1.5 + token table + design-principles corrected; native `ExecutionActivity` recolored.
- **No in-flow "오늘은 못 해".** Restored the founder's original intent: an intentional skip is a **pre-fire,
  re-togglable "오늘은 쉼"** per-occurrence toggle (R1, built in Phase 3); once fired, only 응/아직. PRD R3
  table + §8 + R1 + 7.1.0 (`skipped` outcome) updated; design-principles A2 corrected.
- **MICRO-START + CONFIRM merged** onto one surface (removed the "했어 →"→"시작했어?" redundancy).
- Rebuilt `execution.tsx`: light, merged act step, gold-highlighted commit label, gold ✓ DONE, solid-brand
  action buttons, no in-flow miss.
- **GO propulsion beat added** (PRD v0.6): CONFIRM-응 → **"이제 그대로 나가."** → DONE — the micro-start (shoes
  on) isn't the goal, so the flow pushes the user to actually go before the calm "해냈다".

### Slice 2b — native lock-screen handoff (built, then corrected)
First tried a **custom-scheme deep link** into MainActivity — but in a **dev build the expo-dev-client launcher
intercepts `lifeplanner://…`** and shows a "Deep link received" chooser instead of routing to the app (would be
fine in a release build; not in dev). **Fixed** with the architecture §4 hybrid + a no-deep-link handoff:
- Fire → FSI launches **our own `ExecutionActivity`** (reliable over the lock screen, no launcher interception):
  a light **native COMMIT shell** — the time-accurate commit line + "시작할게".
- Tapping "시작할게" launches the app via the normal launch intent (no scheme) and finishes; on fire
  `AlarmNotifications` wrote a **`PendingExecution`** record (SharedPreferences).
- The RN app reads it on launch/resume (`LpAlarmModule.consumePendingExecution` → home `checkPending` + AppState)
  and opens `/execution` with `skipCommit=1`, so RN continues from the **countdown** (COMMIT was native → no
  double "시작할게").
- Alarm payload carries note + createdAt. Config plugin (MainActivity `showWhenLocked`) retained.
- Build (native only, no manifest change): `npx expo run:android`.
- **Dev-build limitation (confirmed on device):** launching the app from the alarm **crashes in the DEV build** —
  `IllegalArgumentException: App react context shouldn't be created before` (stack entirely
  `expo.modules.devlauncher`): the dev launcher permits only ONE React context, so re-launching MainActivity from
  the alarm throws. This is **dev-only** (both the deep-link and the native-shell→launch paths hit it). A
  **release APK has no dev launcher** — and the prototype ships as a **sideloaded release APK** (architecture §6).
  → **Validate the over-lock execution with a release build:** `npx expo run:android --variant release` (signs
  with the debug keystore, no Proguard — build.gradle/gradle.properties defaults; JS is bundled in, so cold-start
  is fast and Metro isn't needed at fire time). Keep the dev build + in-app preview for R3 UI iteration.
- **Nuance:** a **cold-killed** app *does* pass the dev launcher (fresh context) — only an **alive/backgrounded**
  relaunch hits the dev-launcher crash. So the dev build can be tested with the app **fully swipe-killed**.
- Fixed a JS **"navigate before mounting the Root Layout"** error on that cold-boot path: home waited for
  `useRootNavigationState().key` before navigating. (Superseded below.)

### Slice 2b (final) — execution moment rendered NATIVELY (the reliable answer)
The chain of failures (deep-link launcher dialog → native-shell→MainActivity dev-launcher crash → navigate-
before-mount → **keyguard requiring unlock** because `showWhenLocked` never applied to MainActivity) all trace to
one thing: **launching the RN app from the alarm fights the expo-dev-client (one React context) and the keyguard.**
Resolved by rendering the **whole R3 moment NATIVELY in `ExecutionActivity`** — which already showed reliably over
the lock screen. It now runs **COMMIT → 5·4·3·2·1 → MICRO+CONFIRM → GO → DONE fully over the lock screen without
unlock**, in dev AND release, with **no MainActivity launch** (no dev launcher, no keyguard). Light surface
(`Theme.Material.Light`), programmatic views + `Handler` timers + `Vibrator` haptics. `done` → `PendingOutcomes`
(SharedPreferences) → drained into the JS outcome store on next open (home `sync` → `recordOutcome`,
source=execution-screen). `app/app/execution.tsx` stays as the design reference / in-app preview (canonical UI is
now native). Build: `npx expo run:android` (native only, module manifest re-merges the theme).

---

## 2026-07-09 — Phase 1 (in progress): exact-alarm reliability spike — native module built

### Checkpoint decision (plan Phase 1)
Library (notify-kit / expo-alarm) vs custom Kotlin module → **custom**. Rationale: architecture §11
(Notifee archived → own the core path for supply-chain independence), §4 (the full app uses this same
module anyway), D34. Validate the eventual target directly.

### Built — local Expo module `app/modules/lp-alarm/` (autolinked; Expo Modules API, New Arch)
- `AlarmScheduler.kt` — `AlarmManager.setAlarmClock()` (Doze-piercing), cancel, recurrence next-occurrence.
- `AlarmReceiver.kt` — on fire: wakelock → full-screen-intent notification → re-arm next occurrence
  (recurrence) / evict one-shot → emit `onAlarmFired` if JS alive.
- `AlarmNotifications.kt` — category=ALARM, high-importance, **silent** channel (R8 default-off) +
  `setFullScreenIntent` → ExecutionActivity.
- `ExecutionActivity.kt` — `showWhenLocked`/`turnScreenOn`, dark exec surface showing `FIRED HH:mm:ss`
  + latency Δ (fired−intended) so the ±~1 min gate is observable on the lock screen. (Phase-2 replaces
  the body with the hybrid shell → RN execution moment.)
- `BootReceiver.kt` — re-arm all alarms from the mirror after BOOT / package-replace / TIME / TIMEZONE
  change, no JS (§11 layer 4).
- `AlarmMirror.kt` — SharedPreferences mirror of scheduled alarms (§9-②): a dead/rebooted process
  re-arms without loading the JS store.
- `LpAlarmModule.kt` — JS API: schedule / cancel / getScheduled + readiness (canScheduleExactAlarms,
  isIgnoringBatteryOptimizations) + settings openers (exact-alarm / battery / notifications) + onAlarmFired.
- JS `app/src/core/notifications/alarm.ts` (`requireNativeModule('LpAlarm')`, per §5); dev harness
  `app/app/alarm-test.tsx` (schedule +10/30/60s, readiness, fired-latency log) linked from home (temporary).
- Manifest: receivers + ExecutionActivity + WAKE_LOCK / REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (also app.json).

### Scope note (staged within Phase 1)
Covers §11 layers 1 (setAlarmClock) + 4 (self-re-registration). Layer 3 (WorkManager backup /
missed-detection) + layer 5 (JS catch-up sweep) are the next increment **before** the HARD gate is called.

### Bring-up on the real device (Galaxy A56, Android 15 / API 35)
- **Gradle compile failed** — `Unresolved reference: expo` (Module/ModuleDefinition/appContext). Cause: the
  module `android/build.gradle` was missing **`useCoreDependencies()`** (puts expo-modules-core on the
  compile classpath). **Fixed** → module compiles; autolinks as `lp-alarm (UNVERSIONED)`.
- **App-alive fire: PASS.** From the dev harness, at the set time ExecutionActivity showed full-screen
  ("테스트 +10s · FIRED 16:27:17 · **Δ +0.1s**") — far inside the ±~1 min gate. Scheduling → fire →
  full-screen surface → latency measurement all work.
- **Locked / killed fire: only heads-up, screen stayed off.** Cause: **Android 14+ denies
  `USE_FULL_SCREEN_INTENT` by default** for non-calling/alarm apps → the FSI degrades to a heads-up
  notification. **Fixed** by adding `canUseFullScreenIntent()` + `openFullScreenIntentSettings()`
  (`ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`) — §11 layer 2 — and a readiness row the user must grant.
- **Two Android behaviors to remember (not bugs):** (1) an FSI goes full-screen **only when the device is
  locked / screen-off**; while unlocked it is intentionally a heads-up. (2) **Force-stop cancels all
  alarms** (OS policy) — the "killed" trial must be **swipe-from-recents**, not Settings → Force stop.
- **Locked screen prompted the pattern instead of showing the surface.** Cause: ExecutionActivity called
  `requestDismissKeyguard()`, which on a **secure lock (pattern/PIN)** forces an auth prompt that hides the
  surface until unlock. **Fixed** by removing it — `showWhenLocked` + `turnScreenOn` alone show the surface
  OVER the lock screen and wake it **without** unlock (alarm-clock behavior). Also **guarded the
  settings-intent launcher** (try/catch) after the full-screen-intent settings button closed the app; the
  permission itself did grant (readiness turned green).

### Real-device gate — progress
- **Lock-screen pierce: PASS.** With full-screen-intent permission granted, a scheduled alarm wakes the
  screen and shows the surface **over the secure lock screen, no unlock** (Δ ~0.1s app-alive).
- **Reboot + locked: PASS.** After a reboot (OS booted, app NOT relaunched) with the phone locked, the
  alarm still fired full-screen — BootReceiver re-armed it from the native mirror (§11 layer 4 verified).
  (Firing *before* boot completes is impossible by design, not a defect.)
- **Swipe-killed + locked: PASS.** Closed from recents (not force-stop), locked → fired full-screen.
- **Powered-OFF: does not fire** — inherent (a powered-off phone runs nothing; it fires after boot). Not a
  defect; matches expectation.
- **Overnight-Doze: deferred/assumed.** Not yet run (takes a night); assumed to pass, revisited later.

### Added — §11 layer 3 (WorkManager backup) + layer 5 (catch-up)
- `AlarmBackupWorker.kt` — periodic (15 min) + on-open one-shot: scans the mirror; a PAST-DUE entry means
  the exact alarm was dropped (a correct fire removes/advances it) → fire it late (self-healing). Extracted
  `AlarmScheduler.fireNow()` shared by AlarmReceiver (exact) and the worker (catch-up).
- `LpAlarmModule.catchUp()` + `alarm.catchUp()`, called on app open (home mount). Worker scheduled in the
  module's OnCreate. WorkManager is "eventually", honoring Doze windows — a backstop, not the primary path.
- Dep: `androidx.work:work-runtime-ktx` added to the module gradle.

### Phase 1 gate: substantially MET ✅ (overnight-Doze pending)
Exact fire (Δ ~0.1s) + lock-screen pierce + swipe-killed + reboot all PASS on the real device (Galaxy A56,
Android 15). Only the overnight-Doze trial remains (deferred, assumed pass). Proceeding to Phase 2 (the
execution moment) on that assumption; Doze to be confirmed later. Added a specific-time (HH:MM) scheduler
to the dev bench for that overnight test.

---

## 2026-07-09 — Phase 0: skeleton + local persistence + design tokens ✅

### Built
- Expo SDK 52 **Dev Build** (New Architecture) + TypeScript + expo-router (`app/`).
- Design tokens from `docs/core/design-system.md` encoded in `app/tailwind.config.js` (NativeWind v4).
- Local-first data layer: `src/core/data/types.ts` (Task/Occurrence/Settings, mirrors data-model §8) +
  `taskRepository.ts` (AsyncStorage, Repository pattern per architecture §5; seeds a "21:00 헬스" daily task).
- Home screen `app/app/index.tsx` = 오늘 (task list) rendering the seeded task in the real tokens.

### Exit gate (R5)
오늘 shows the seeded "21:00 헬스" task and it persists across app kill/restart **and device reboot**.

### Problem — `npx expo run:android` → Metro 500 TransformError
`[BABEL] expo-router/entry.js: Cannot find module 'react-native-worklets/plugin'`

### Diagnosis
- Ruled out: install location (single `node_modules`/lockfile in `app/`, none at repo root) and versions
  (all SDK-52-aligned: expo 52.0.49, RN 0.76.9, nativewind 4.2.6, css-interop 0.2.6, reanimated 3.16.7).
- Root cause: `babel.config.js` used the `nativewind/babel` preset → delegates to
  `react-native-css-interop@0.2.6/babel.js`, which **unconditionally** adds `"react-native-worklets/plugin"`
  to its Babel plugins (source comment: *"Use this plugin in reanimated 4 and later"*). Our stack is
  **SDK 52 / Reanimated 3.16**, which has no `react-native-worklets` package → module-not-found → bundle fails.
  (`babel-preset-expo` auto-adds `react-native-reanimated/plugin`; Reanimated 3.16's plugin needs no worklets,
  so the reanimated side was fine — the culprit was `nativewind/babel`.)

### Fix
- Removed `"nativewind/babel"` from `app/babel.config.js`; kept `["babel-preset-expo", { jsxImportSource:
  "nativewind" }]`. NativeWind v4 className styling works via that jsxImportSource
  (`nativewind/jsx-runtime` → `react-native-css-interop/jsx-runtime`) + the `withNativeWind` metro
  transformer — this path never requires worklets. **Re-introduce `nativewind/babel` only when the app
  moves to Reanimated 4 (+ `react-native-worklets`).**
- Added `expo-dev-client` to `app/package.json` (Dev Build workflow / needed for Phase 1).
- Re-run recipe after a babel change: `npm install` → `npx expo start -c` (cache clear required) → reload.

### Result
Bundles cleanly; 오늘 shows the seeded "21:00 헬스" task. Phase 0 gate reached.

### Note (benign)
Android shows an "앱 호환성 / 16 KB page size — ELF alignment" warning (several prebuilt `.so` libs not
16 KB-aligned). This is an Android 15 forward-compat warning for debug/dev builds and does **not** block
execution. Revisit only when producing a production/release build targeting 16 KB-page devices.
