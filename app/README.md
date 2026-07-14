# app/ — LifePlanner (React Native + Expo, Android-first)

The running app. **State (2026-07-14, evening): SHIPPED — v0.5.0.** Every phase incl. F0 is built and
device-verified. The lever works; what got built since v0.4.0 is **everything the app was already promising and
had no code behind**.

**Read before touching anything:**
- **The model (D62–D70).** One unit, the `TimeBlock` — **the alert tier says what the thing IS**: **없음** (holds
  the hour; never evaluated; answers itself as 지남) · **알림** (it matters) · **실행** (the lever). `kind`
  (일반/운동/러닝) is orthogonal. **Loudness is its own axis** (무음·진동·소리). **The execution moment is addressed
  to ONE phone** (D70) — everything syncs, only the *takeover* is scoped.
- **The words on screen are Korean, and they are not our words (D78).** 성공 · **미스** · 휴식. "실패" was tried and
  reverted: *a miss is neutral data — taupe, never red.* No internal names on buttons (no "S1", no "리드 타임").
- **The documents are the app's (D71–D74).** `src/content/legal.ts` **IS** the 약관/처리방침 — not a copy of one,
  and not a message. Consent is **evidence**: per-tick seconds, the device, the version of the words seen;
  create-only on the server. `legal.test.ts` fails the build if a never-collected term appears outside a denial.
- **Leaving works, and it is exact (D75/D76).** 회원 탈퇴 = **data first, account second**; alarms cancelled before
  storage; the outbox purged (`purgeFirestoreCache` — a write already handed to Firestore **cannot be recalled**;
  134 rows once came back). 모든 기록 삭제 **tombstones**, never hard-deletes — a hard delete is a deletion the other
  phone cannot hear, and it would push the whole account back. An **account tombstone** in the security rules
  makes 탈퇴 stick on every device.
- **Sync runs while the app is closed (D77)** — a background task, `startOnBoot: true`. **Best-effort by design:**
  Android decides when it runs. **Nothing depends on it** — the alarm is native and re-arms itself at boot.
- **아침 요약 (D78)** — one silent notification a day, per-block opt-out, previewed in the calendar. Fixed at 07:00.

> **Where the truth lives.** Product = `../docs/core/prd.md` (R1–R18) · decisions = `../docs/core/decisions.md`
> (**D1–D78** — D62–D70 changed the model, **D71–D78 made it a service**) · legal text = `src/content/legal.ts`
> (the drafts in `../reference/` are **superseded**) · "where are we" =
> `../docs/research/implementation-plan.md` → the Headline · history = `../docs/research/build-log.md` ·
> **what is still unverified = `../docs/research/device-test-checklist.md` (top of file).**

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
  day.tsx  add-block.tsx  #   day plan · block add/edit (the ONLY way in — D67 retired add-event.tsx)
  add-expense.tsx  add-meal.tsx
  summary.tsx  review.tsx #   day summary (R10) · 돌아보기 (R17)
  settings.tsx  onboarding.tsx  metrics.tsx
src/core/
  data/                   # entities + a Repository per entity (AsyncStorage today, Firestore at F0 — the
                          #   interface does NOT change: architecture §7). Alarm write-through lives HERE,
                          #   not in the screens (add/update/delete reconcile the alarm themselves).
  schedule/               # blockScheduler: fire = LIVE start − lead · D-1 snapshot · free slots
  notifications/          # alarm.ts (native bridge) · plainReminders.ts (soft path) · morningBrief.ts (D78)
                          #   · backgroundSync.ts (D77 — pulls + re-arms while the app is CLOSED)
  content/                # legal.ts (the 약관/처리방침 THEMSELVES) · notices.ts (공지사항)
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
