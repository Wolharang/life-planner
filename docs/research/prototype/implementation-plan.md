# Implementation Plan — LifePlanner Trigger Prototype (MVP)

> **Role.** This is the **pre-code build sequence** for the trigger prototype scoped by `docs/research/prototype/prd.md`. It
> answers *in what order to build* and *what must be true to advance*. The *What/Why* is the PRD; the *How-design*
> (topology, the native alarm module, storage, deployment) is `docs/core/architecture.md` /
> `docs/core/data-model.md` / `docs/research/tech-feasibility.md`. **No code is written until the user explicitly
> says go** (CLAUDE.md planning rule) — this document is the plan, not the build.

## Guiding principles
1. **Risk-first.** The **exact-alarm reliability** is the product's core dependency and biggest risk (PRD §10, S1;
   the H14 spike). It is validated **before any polish**. If it cannot be met, **stop and reconsider the lever**
   (PRD falsification) — do not build a beautiful app on an alarm that doesn't fire.
2. **Thin vertical slices.** Each phase delivers a **runnable, testable increment on the real device**, not a
   horizontal layer. You can always demo the newest slice end-to-end.
3. **Real-device validation.** Reliability (Doze / lock / reboot / OEM battery policy) can be trusted **only on the
   actual target Android phone** — never an emulator.
4. **Hard exit gates.** A phase is "done" only when its gate — **observable, on the real device** — passes. Do not
   advance on a half-gate. The PRD's acceptance criteria are the phase's test cases.
5. **Traceability.** Every phase maps to PRD requirements (R#) and metrics (S#).

---

## Phase 0 — Runnable shell + local persistence
- **Goal:** the app installs and runs on the founder's real Android device, with on-device persistence proven.
- **Prerequisites (state before starting):** Node + JDK 17 + Android SDK / platform-tools (ADB) + Android Studio
  (for `expo prebuild`), and — critically — a **real, OEM-representative Android device with USB debugging** (the
  whole plan hinges on "never an emulator").
- **Build:** dev-build project skeleton; a blank home screen; local storage wired; the native-alarm module
  scaffolded (empty) **via an Expo config plugin + `expo prebuild`** (this native/prebuild wiring is the first real
  hurdle — not merely "low risk"); exact-alarm / full-screen permissions declared (not yet used). **Deliverable:**
  backfill CLAUDE.md's "Build / test / run" section with the real build / install / run / single-test commands once
  the loop exists.
- **Covers:** R5 (persistence baseline), §9 platform.
- **✅ Exit gate:** app launches on the **real target device**; a value written to local storage **survives app
  restart AND device reboot**; the build→install→run loop is repeatable; CLAUDE.md build commands are filled in.
- **Risk / test:** the native config-plugin / prebuild wiring is the notable risk (not the RN app itself); manual on device.

## Phase 1 — Exact-alarm reliability **SPIKE** (the make-or-break gate)
- **Goal:** prove an exact-time event fires and **pierces the lock screen** under kill / lock / Doze / reboot,
  within the S1 tolerance. This is the single riskiest thing in the product.
- **Build:** native exact-alarm scheduling; on fire, launch a **full-screen placeholder over the lock screen**
  ("FIRED HH:MM:SS"); **reschedule after reboot**; a backup check (WorkManager-style) + a missed-detection stub;
  drive the exact-alarm + full-screen permission + OEM battery-exemption prompts. **Checkpoint (decide here):**
  library (notify-kit / expo-alarm) **vs. custom Kotlin module** — the custom path (AlarmScheduler + FSI activity +
  BootReceiver + config plugin) is far more than wiring a library; scope it before committing.
- **Covers:** R2, S1, dependency §10; R6 detection stub.
- **✅ Exit gate (HARD):** across repeated trials on the **real device**, the alarm fires **within ±`[TBD: ~1 min]`**
  of target when **(a) the app is killed**, **(b) the screen is locked and the phone left idle overnight (Doze)**,
  and **(c) after a reboot**; the full-screen surface appears over the lock screen; measured latencies are recorded.
  **If this cannot be met after mitigation, STOP** — the lever's core assumption has failed; reconsider direction
  (PRD §4 falsification, §10).
- **Risk / test:** **highest**; real device, OEM-representative, overnight-Doze + reboot + task-killed trials.

## Phase 2 — The execution moment (R3, the heart)
- **Goal:** the full R3 state machine runs end-to-end from a **real** alarm fire.
- **Build:** FIRING → COMMIT (time-accurate line) → COUNTDOWN (5·4·3·2·1) → MICRO-START → CONFIRM
  (응/아직/오늘은 못 해) → DONE / MISS / PENDING; haptics; a sound-if-enabled hook; the state idle/auto timeouts;
  outcome persisted with **source = execution-screen**. The flow **loads the occurrence's `createdAt` + id/date at
  fire time** (local store, or carried in the native mirror payload — architecture §9-②) so the commit line's time
  phrasing and the outcome attach to the right occurrence.
- **Covers:** R3; R4 (partial); R8 (sound hook).
- **✅ Exit gate:** from a real scheduled alarm the sequence runs over the lock screen **uninterrupted**; **every
  branch** (done / 아직→pending / 못 해→miss) and **every timeout** (COMMIT-idle→PENDING, MICRO-auto→CONFIRM,
  CONFIRM-auto→PENDING) is reachable and correct; the commit line shows the real title/time with correct time
  phrasing (never a false "어제") — exercised with a real or stubbed `createdAt` across the 어제/아까/지난주
  branches; outcome + source persist; the surface renders within the `[TBD]` bound (via the minimal native shell).
- **Risk / test:** medium; manual on device, walking every branch and every timeout.

## Phase 3 — Task setup, home list, recurrence, plain reminders (real input + surfaces)
- **Goal:** the user can create/edit/delete real tasks and see them; recurrence generates occurrences; the
  execution alarm is scheduled from real task data; plain reminders fire.
- **Build:** the **home list** (upcoming + recent-history rows with outcome badges); task create/edit/delete (time,
  title, micro-start note, execution-alarm + **lead presets {정각/15/30/60분/custom}**, **plain reminders
  multi-offset**, **recurrence none/daily/weekly**); creation-time recorded; past-**set**-time rejection + warning; **effective-time-already-past (future set time + lead) → fire immediately**;
  **delete cancels alarm + reminders (no ghost)**; recurrence → per-occurrence scheduling; soft plain reminders at
  offsets; same-effective-time **collision → sequential queue**.
- **Covers:** R1, R2 (full), part of R8.
- **✅ Exit gate:** a **recurring flagged task with a lead** fires its execution alarm at the right effective time
  for **consecutive occurrences**; editing the time **moves** the alarm; deleting → **no ghost fire**; plain
  reminders appear at the chosen offsets; home rows + badges are correct; a past **set** time is rejected with the
  warning; an already-past **effective** time (future set time + lead) **fires immediately**; two same-time
  occurrences **queue** (never stacked over the lock screen).
- **Risk / test:** medium; on device, including a multi-day recurrence run and a delete-no-ghost check.

## Phase 4 — Catch-up, outcome history, no-guilt, settings (the net + the observation surface)
- **Goal:** the reliability/honesty net and the observation surface are complete, and no-guilt is verified
  everywhere.
- **Build:** R6 catch-up (both copies — "놓쳤어요" for never-fired, "아직 안 했죠" for fired-but-abandoned;
  dismiss / once-per-open / `[TBD: ~7 day]` auto-archive); the **outcome-history** view in home (the §3(d)
  observation surface, distinct from a dashboard); the settings **sound toggle (default off)**; a full **no-guilt
  sweep**.
- **Covers:** R6, R4 (full, incl. source), R7, R8.
- **✅ Exit gate:** forcing **device-off-at-fire** → "놓쳤어요" on next open; forcing **"아직"/timeout** →
  "아직 안 했죠"; both record done/miss with **source = catch-up**; the history shows all outcomes with their source;
  the catch-up prompt shows **at most once per app open** (no nag); a UI sweep confirms **zero** streak / guilt /
  nag anywhere; the sound toggle works and defaults to off.
- **Risk / test:** medium; on device, with forced-miss and forced-abandon scenarios.

## Phase 5 — End-to-end validation + measurability → hand off to the real self-experiment
- **Goal:** the whole loop runs on the real device for several days, and **S1–S4 are actually computable**, so the
  founder can begin the real multi-week self-test (the actual validation).
- **Build:** a multi-day E2E run on device; confirm that **outcome + source + creation-time + commit→fire gap** are
  captured so S1/S2/S3/S4 compute; set/confirm the provisional `[TBD]` timing values; a way to read the raw
  outcome data (to compute S2/S3); record the founder's **pre-prototype baseline** (§4 S3).
- **Covers:** S1–S4 measurability, the validity guard (§10).
- **✅ Exit gate:** a multi-day dry run shows alarms **within tolerance** (S1 measurable), **execution-screen-done
  vs catch-up-done distinguishable** (S2 measurable), **behavior-vs-baseline computable** (S3), and
  **return-after-miss observable** (S4); the baseline is recorded. → The prototype is **READY for the founder's
  N-week self-experiment.**
- **Before starting the self-experiment (cleanup checklist):** remove the temporary alarm dev bench —
  the home **"⏰ 알람 테스트"** Link (`app/app/index.tsx`), the `/alarm-test` route (`app/app/alarm-test.tsx`),
  and the `testAlarmSound` diagnostic (`LpAlarmModule.kt` + `alarm.ts`). It is deliberately kept through
  Phases 1–5 as the overnight-Doze + dry-run instrument; gating its removal here (not only in a code comment)
  keeps it from being shipped into the measurement run. (Kotlin removal needs a full `run:android` rebuild.)
- **Risk / test:** the integration gate; several real days.

---

## Definition of Done (whole MVP)
All **R1–R8 acceptance criteria pass on the real target device**, **S1–S4 are measurable**, and the founder can
**start the N-week self-test**. (The self-test itself — the real validation of the lever — happens *after* the
build and is judged against §4 S1–S3 + the falsification condition.)

## After the MVP
Run the real self-experiment → evaluate against S1–S3 (and the falsification condition). **If it works** → expand
toward the full "integrated day" app (direction materials promoted to `docs/core/service-overview.md` +
`docs/core/spec.md`, with personas/features under `docs/research/`). **If not** → redesign the
lever or reconsider direction (PRD §4 / §10).

## `[TBD]` values to set
**Phase 1 uses the PRD's provisional values for its gate** (esp. S1 fire tolerance ±~1 min); **final calibration is
Phase 5.** Values: S1 fire tolerance (±min) · R3 timings (COMMIT-idle / MICRO-auto / CONFIRM-auto / render bound) ·
R6 auto-archive days · S2/S3 targets + S3 baseline weeks — provisional placeholders in the PRD until the founder
sets them (only S1's provisional value participates in an earlier gate, Phase 1).

## Cross-cutting
- **Testing is primarily manual on the real device** — reliability cannot be trusted on an emulator.
- **Sequence rationale:** risk-first (P1 alarm gate) → the differentiator (P2 execution) → real data feeding it
  (P3) → the net + observation (P4) → measurability + hand-off (P5). Each slice is demoable end-to-end.
- **No code until the user's explicit go.**
