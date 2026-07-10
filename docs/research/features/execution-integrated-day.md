# Feature Build Plan — "실행이 설계된 통합 하루" (Execution-engineered Integrated Day)

> Solution **D3 (hybrid)** in the **S2 (execution-card-first)** UX form — **CONFIRMED 2026-07-07** via comparison
> scoring (S2=13 > S1=10 > S3=6; `docs/research/solutions.md`), docs/core/decisions.md **D31/D32**. Serves the North Star (D30: execution
> engine) via the user's vote **C1 (execution moment) + C5 (integrated fast-logging day)**, with plan/execution
> and in-the-moment logs on **separate surfaces** (D32). See `docs/research/hmw.md`, `docs/research/solutions.md`, `docs/research/references-solutions.md`.
> Status: **CONFIRMED implementation plan — pre-code** (no code until the user says go; CLAUDE.md, inst2.md Day-3+).

## 1. One-line service overview (the "한 문장" test)
**"내가 안 하던 미래의 일(운동 등)을, 통합된 하루에 미리 정확한 시각으로 박아두면, 그 순간 실제로 하게 만들고,
지출·식사는 그 자리에서 초고속으로 남기는 앱."** (Existing apps *record/remind*; this one *makes you execute*.)

## 2. Core loop
Plan (important events weeks ahead + D-1 time blocks) → **My Day timeline** on the day → **execution
intervention** on flagged blocks at the exact time (commit + micro-start + optional 출발/도착) → **one-tap log**
spending/meals as they happen → mark **done/miss** → **sync** across devices. No streak, no guilt.

## 3. Screens (MVP)
1. **Month calendar** — important events marked. Follow standards (S26): month grid, today highlighted, "+N more",
   swipe to change month, category color, prominent quick-add, advance notification.
2. **Home = Today's execution cards (S2, D32)** — the day's **time blocks as actionable cards** (next-up
   highlighted; flagged blocks prominent); tap a card → detail; **mark done**. This is a **plan/execution-only
   surface — spending/meals are NOT shown here** (they're a separate surface, §5 — planned vs in-the-moment differ).
   A **free-slot hint** appears when adding a block (real empty gaps so a workout lands where it'll happen, H3/H10).
3. **Add/edit time block** — free-form start–end, title, optional location, `kind` (normal/workout/run),
   **flag "실행 알림"** (per-event lead time, D28), optional **micro-start note** ("지금 신발 신기").
4. **Execution moment (core recipe, user-chosen 2026-07-07)** — at the cued time on **flagged** blocks: a prompt
   (Notifee) with **commit framing** ("어제 네가 21:00 헬스라고 정했잖아") → a **5-4-3-2-1 countdown into a guided
   micro-start** (Mel Robbins 5-sec rule + Routinery/Tiimo first step "지금 신발 신기") + a **gentle phone haptic**
   → a **short "시작했어?" window** (BeReal-style) → optional **출발 → (N분 뒤) 도착?** check. On success, an
   **ethical micro-reward = competence signal** ("안 하던 걸 해냈다"), **no streak**; a miss is **data, not failure**.
   Only on user-flagged blocks (avoids spam; the D13 revisit in D30). **Kept gentle** — the persistent re-alert &
   precommitment levers were considered but **deferred** (user prefers non-aggressive). See `docs/research/references-solutions.md` §B/§D.
5. **Log — a SEPARATE surface (its own tab, D32)** — calorie/expense added **in the moment** (at purchase / at
   eating), via a fast bottom-sheet with **presets** (P1: home/lock-screen widget + Android Quick-Settings tile +
   Siri/NFC/Shortcuts, S27/one-tap refs). Reuse `reference/calculator.js` (budget) & `reference/kcal.js` (calorie,
   **minus photo**, D19). Kept off the plan/execution surface (§2) because planned vs logged differ in nature.
6. **Day summary — links, not merges** — one place shows the day's **blocks (done/miss)** and that day's **spend /
   calorie totals** as **distinct sections** (day-level integration per D32), not interleaved on one timeline.
7. **Account & sync** — Firebase Auth (id+password, D12); local-first, all data syncs via Firestore (D2/D17);
   JSON export/import merge-vs-overwrite (D24).

## 4. Scope — build order
- **P0 (build first / MVP)**: month calendar + important events + **advance notification on all devices**;
  My Day timeline; add time-block with flag + micro-start; **execution-moment notification** (commit +
  micro-start); fast calorie/expense logging (reuse ref apps); **local-first + Firebase sync + JSON import/export**.
- **P1**: **capacity-aware free-slot suggestion** (Reclaim-style: place the workout in a *real* free gap; on an
  overloaded day suggest a **smaller slot, not a skip**) with **buffers from past actual times** (planning-fallacy
  mitigation); 출발/도착 인증; **<2s logging** via home/lock-screen widget + Quick-Settings tile + Siri / NFC tag /
  Apple Shortcuts; **learn repeat log entries** (Expensify-style).
- **P1 chosen lever — geofence trigger** (user's pick, 2026-07-07): a location-based execution cue for
  location-bound tasks ("집을 나섰나?" / "헬스장 근처"), strong for the gym use case. Tech: `expo-location` +
  background geofencing (TaskManager) + location permission; validate battery/background reliability alongside
  the alarm spike. (`docs/research/references-solutions.md` §B-6, `[T4]`.)
- **Not planned (deferred):** commitment/stakes, social/body-double, barcode calorie — revisit later if needed.
- **Defer (Later)**: plan-vs-actual **evaluation loop** (C4, spec §3.6); temptation bundling; Google login;
  quantitative evaluation.

## 5. Success metrics (observable — Q6)
- **Core**: # of **flagged blocks marked "done" after the execution prompt / week** (the execution event).
- **User's own bar (P1)**: a month with the **planned gym block executed** ≥ target (the empty-lunch success).
- **Friction**: share of spending/meal entries logged **within a few minutes** of the event (calorie-forgetting).
- **Adoption**: # of days the user actually **created a next-day (D-1) plan** (currently ~0 → the aspirational habit).
- **Anti-metric**: no streak counter to optimize (it backfires, §4).

## 6. Implementation approach (per confirmed decisions)
- **Stack**: React Native + Expo, New Architecture (D11).
- **Notifications**: execution cue = **native exact-alarm module (AlarmManager) + full-screen intent**
  (Notifee-fork / custom module, D34); advance-event alerts = **non-exact expo-notifications** (D18). **Key risk
  (H14)**: Android 12+ exact-alarm permission + Doze + full-screen-intent → spike this first (it gates the core lever).
- **Backend**: Firebase **Firestore + Auth**, Spark free tier (D17); offline cache = local-first (D2).
- **Reuse**: `reference/calculator.js` → budget module; `reference/kcal.js` → calorie/workout (drop photo, D19).
  Workouts unify into time-blocks (D22); success/fail + reason on time blocks (D5, evaluation deferred).
- **Data model**: per `docs/core/spec.md` §4 (ImportantEvent, TimeBlock w/ kind + D-1 snapshot, Expense, MealEntry, DayAggregate, Account/Sync).
- **Cost**: free only (D10) — no paid cloud/storage (photos dropped, D19).

## 7. Top assumptions to validate (hypotheses)
1. **A gentle execution prompt (commit + micro-start) meaningfully raises follow-through** over a plain reminder
   — the whole differentiator. (Evidence: Alarmy/Fogg; user's gym-lunch story. Test with a prototype.)
2. The user will **actually start doing D-1 planning** once it's fast + integrated (currently ~0, adoption risk).
3. **One-tap logging** removes enough friction that calories stop being forgotten.

## 8. Verification (when built)
Drive the core loop end-to-end on Android: create a D-1 workout block (flagged) → alarm fires at the exact time
→ micro-start prompt → mark done → entry syncs to a 2nd logged-in device; log an expense/meal in ≤2 taps; works
offline then syncs. Confirm the execution prompt fires reliably under Doze.

## 9. Next steps (inst2.md / init1.txt)
- **Revisit spec D13** — ✅ done: spec §3.2/§3.9 now carry the D30 execution-cue exception (spam minimized, cue not).
- (Design sprint) **Storyboard** the 4–5 key moments (esp. the execution moment) → **prototype** → **user test**
  (the user themselves, per "애완 MVP").
- Then **tech review** (Day 3): spike the Android exact-alarm/full-screen-intent risk before broad coding.
