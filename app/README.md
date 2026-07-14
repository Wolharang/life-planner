# app/ — LifePlanner (React Native + Expo, Android-first)

The running app. **State (2026-07-14): SHIPPED — v0.4.0 (versionCode 6) runs standalone on the founder's phone
(no Metro, no laptop).** Every phase incl. **F0 (Firebase auth + sync)** is built and device-verified. The only
thing left is to **use it**: the product's survival turns on **S1** (execution rate) and **S3** (does he
actually plan the next day) — neither is a coding question.

**The model, after the two-device test (D62–D70) — read before touching anything:**
- **One unit: the `TimeBlock`.** `ImportantEvent` is **retired** (D67). The **alert tier says what the thing
  IS**: **없음** (only holds the hour — never evaluated; answers itself as 지남, D68) · **알림** (it matters) ·
  **실행** (the lever). `kind` (일반/운동/러닝) is orthogonal.
- **Loudness is its own 3-way axis** (D65): **무음 · 진동 · 소리**. The moment itself may be silent.
- **The moment is addressed to ONE phone** (D70) — everything syncs, only the *takeover* is scoped.
- **Sync never trusts the cache** (D66): reconcile reads `source: "server"`, because a snapshot layers your own
  **un-sent** writes on top of the server's — that lie silently swallowed 180 expenses.

> **Where the truth lives.** Product = `../docs/core/prd.md` (R1–R18) · decisions = `../docs/core/decisions.md`
> (D1–D70 — **D62–D70 are the newest and they changed the model**) · **"where are we" = `../docs/research/implementation-plan.md` → "Build progress (live) — CURRENT
> STATE"** · history = `../docs/research/build-log.md` · device acceptance =
> `../docs/research/device-test-checklist.md`.

## Run it

```bash
npm install && npx expo install --fix
npx expo prebuild --clean --platform android   # after ANY native change (Kotlin compiles only here)
npx expo run:android                            # a REAL device — the alarm can't be trusted on an emulator
npm run typecheck && npm test                   # static gates (Jest; single test: npm test -- <pattern>)
```
Expo Go cannot host the native alarm module — it must be a **Dev Build**.

**Grant all four permissions** on first run (onboarding drives them): notifications · exact alarm ·
full-screen intent · **다른 앱 위에 표시**. The last one is not optional: without it the moment only takes over a
*locked* screen (D41), and other apps' overlays can cover it (D48).

## Layout (the real one — `architecture.md` §5's `/src/features` tree was never adopted)

```
app/                      # expo-router routes (each file = a screen)
  (tabs)/                 #   홈(index) · 캘린더 · 기록  — the tab bar
  day.tsx  add-block.tsx  #   day plan · block add/edit
  add-event.tsx           #   important event add/edit
  add-expense.tsx  add-meal.tsx
  summary.tsx  review.tsx #   day summary (R10) · 돌아보기 (R17)
  settings.tsx  onboarding.tsx  metrics.tsx
src/core/
  data/                   # entities + a Repository per entity (AsyncStorage today, Firestore at F0 — the
                          #   interface does NOT change: architecture §7). Alarm write-through lives HERE,
                          #   not in the screens (add/update/delete reconcile the alarm themselves).
  schedule/               # blockScheduler: fire = LIVE start − lead · D-1 snapshot · free slots
  notifications/          # alarm.ts (native bridge) · plainReminders.ts (the soft path)
  logs/                   # constants (D16) + aggregate (month/day rollups, DayAggregate)
modules/lp-alarm/         # the Kotlin module: AlarmScheduler · AlarmReceiver · ExecutionActivity · …
tailwind.config.js        # the design tokens (v5 — LOCKED, D39)
```

## The one thing to be careful with

`modules/lp-alarm/.../ExecutionActivity.kt` **is** the execution moment (the product's heart). Its invariants
were each paid for with a real device bug — **do not regress them**: it appears in every state (D41) · renders
as an **overlay** and re-claims the top so other apps can't cover it (D48) · **exists only on screen** — every
timer freezes when it isn't visible and resumes at the same phase (D46) · **re-summons itself** when sent away
unanswered, bounded (D47) · its **tone can never outlive its screen** (D44) · **no in-flow escape** (back button
*and* predictive back are consumed). Kotlin compiles only at `run:android`.
