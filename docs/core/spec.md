# LifePlanner — Feature Spec (draft)

> Status: **draft, planning stage.** This document is the single source of truth for *what* we build.
> Written in English; discussion answers are delivered to the user in Korean.

## 1. Goal and scope

**Goal.** Design the future in advance, execute it, and evaluate plan-vs-actual so plans get more realistic
over time. Personal use.

More precisely: by designing tasks ahead of time, the user actually **performs things they would otherwise
have skipped** when nothing was planned. Pre-committing the day makes those tasks happen, so the user ends
up doing **more** and completing given tasks **regularly and quickly**. That behavioral outcome — not just
the plan-vs-actual bookkeeping — is the real target.

**Scope tiers** (priority order — the authoritative statement is **D4** in `docs/core/decisions.md`; also `docs/core/service-overview.md` §3):

- **Core**: calendar of important events with cloud auto-sync and advance notifications.
- **Secondary**: D-1 day-level time-block planning linked to calendar dates, plus in-the-moment budget and
  calorie/workout tracking.
- **Later**: plan-vs-actual evaluation of the time-block schedule.

**Out of MVP for now**: multi-user sharing, plan-vs-actual analytics dashboards, third-party calorie DB integration.

## 2. Core concepts and terms

- **Important event** — a significant appointment placed on a calendar date in advance (can be added weeks
  to months ahead). Cloud-synced and notified. If canceled, it is **deleted** (a soft-delete tombstone for sync consistency — data-model §6; not evaluated).
- **Time-block schedule** — a detailed day plan made of **free-form start–end intervals** (not fixed hourly
  slots; see D14), designed by **D-1** and linked to that calendar date. This is what gets evaluated.
- **Plan** — the intended time-block schedule for the day.
- **Actual** — whether each planned time block was actually carried out, checked on the day.
- **Evaluation** — success/fail per time block, and the aggregated plan-vs-actual difference.

## 3. Feature specs (by priority)

### 3.1 Core — Calendar of important events
- Monthly calendar view; dates carrying important events are visually marked.
- Add/edit/delete an important event on a date (title, date, time, notify-at time, memo).
- **Cloud auto-sync (Firebase)**: important events propagate to **all** of the user's logged-in devices.
- **Advance notification**: a notification fires at a configured time (minutes/hours) **before** the event,
  on all devices, alerting the user that the important event exists.
- Conflict handling is **not a dedicated feature**: because all important events sit on the calendar, when
  the user adds a new one they already see any existing events on that date, so double-booking is naturally
  avoided. No collision-detection logic is planned.

> **Why this is core (pain points with KakaoTalk calendar, from the user):**
> (1) an event added on one phone did **not** appear on another → the user missed an existing important
> event and double-booked; and (2) there was **no** advance notification, before an important event's start
> time, pushed to all phones. LifePlanner's core exists to fix exactly these two gaps.

### 3.2 Secondary — Day-level time-block planning
- **Tapping a date** (from the monthly view, D21) opens that day's **time-block schedule**.
- Blocks are **free-form start–end intervals** (not fixed hourly slots), each with a title and **optional
  location**. Example day: `10:00–13:00 lecture`, `13:00–14:00 lunch (visit Seocho post office)`,
  `14:00–19:00 lab`, `20:30–22:00 gym`.
- Designed by **D-1** for the next day and linked to the calendar date.
- **Editable on the day.** The execution **alarm always follows the LIVE `start − alarmLeadMinutes`**; the frozen
  **D-1 snapshot** drives **evaluation only** and never scheduling (D23).
- Workouts/runs are planned as blocks with `kind = workout | run` (to raise follow-through); marking such a
  block success = the workout is done (D22).
- **Every block carries exactly one alert** (§3.9, D43): **알림** (a plain notification) or **실행** (the cue) —
  **`실행` is the default**. The "select few" of the original plan is now the set the user *leaves* on 실행; the
  soft tier is what lets that set stay small. The cue itself is deliberately **not** minimized (D30).

### 3.3 Secondary — Household budget (spending), in-the-moment
- Logged **when money is actually spent**, tied to date/time.
- Fields: amount, category, **card/payment (free-text, D26)**, store/merchant, name/memo.
- **Single currency: KRW / 원** (D25).
- Totals: monthly total, per-day subtotals, category distribution.
- **Reference**: fully specified from the existing app in `docs/research/reference-apps.md` §A (`reference/calculator.js`).
  Preserve every feature/field listed there unless a decision drops it.

### 3.4 Secondary — Calorie/meal + workout, in-the-moment
- Meals logged **when eaten**: food name, **kcal (manual entry only, D27)**, details, meal category
  (아침/점심/저녁/간식). **No photos** (dropped for the free plan, D19).
- Today summary with per-meal kcal vs target and daily total.
- **Workout/run done is derived from time-blocks** (`kind = workout | run` marked success, D22) — there is
  **no** separate 운동/러닝 O/X record. The today summary reads O/X from those blocks.
- **Reference**: fully specified from the existing app in `docs/research/reference-apps.md` §B (`reference/kcal.js`).
  Preserve every feature/field listed there **except** photos (D19) and standalone activity records (D22).

### 3.5 Secondary — Integration
- Budget and calorie/meal entries attach to the same day, unifying the previously scattered
  calendar / budget / calorie apps into one place.
- Note: time-block plans are pre-entered by D-1; spending/calorie entries are recorded in the moment
  (at purchase / at eating), not pre-entered.

### 3.6 Later — Plan-vs-actual evaluation
- On the day, mark each time block (from the **D-1 snapshot**, D23) as **success/fail** (e.g. "gym at 20:30
  planned but not attended → fail").
- On **fail**, record a **reason** (free text). Evaluation is **binary + reason only**; quantitative
  comparison is deferred (D29).
- Later: export **success/fail rates** and gather all recorded **failure reasons** in one place for the user
  to review. The app does **not** auto-suggest changes — the user self-adjusts future plans.
- Important events are excluded from evaluation.
- A block that was in the D-1 plan but **soft-deleted on the day counts as fail** (planned, not done); a block
  **created on the day** (D22) uses its creation values as its snapshot (no prior D-1 state).

### 3.7 Export / import (data portability)
- Manual **JSON** backup export (mirrors the reference apps' export; see `docs/research/reference-apps.md` §A5/§B5).
- Import: offer **merge** (add items whose id isn't present) or **overwrite** (replace), exactly as the
  reference apps do (D24). JSON is a manual backup path over the local/synced dataset; Firestore stays the
  live sync store.

### 3.8 Multi-device sync (mechanism)
- Backend: **Cloud Firestore** on the Firebase **Spark (free) plan** (docs/core/decisions.md D17).
- **Account model (D20)**: the app is usable **without an account** (local); **logging in enables sync**.
- **Sync scope**: once logged in, **all data** — important events, time blocks (incl. D-1 snapshots and
  evaluations), expenses, meals — syncs per user.
- Same user logged in on multiple devices; a write on one device propagates via Firestore's realtime
  listeners to all other logged-in devices (**last-write-wins**). Firestore's offline cache keeps the app
  usable offline and syncs on reconnect.
- Auth: **Firebase Authentication**, ID + password first; Google login later (docs/core/decisions.md D12, D17).
- **Free-plan only**: all synced data is text/numbers in Firestore. Meal photos are dropped (docs/core/decisions.md
  D19), so Firebase Cloud Storage (paid since 2026-02-03) is never needed.

### 3.9 Notifications (kept minimal)
- **On-device local scheduled notifications** (expo-notifications / Notifee) — no paid server push
  (docs/core/decisions.md D18). Each device schedules its own alerts after events sync in.
- Fire for **important events**, with a **per-event lead-time** (default applied if unset, D28), on all devices.
- Also allowed on a **select few** time blocks that clearly warrant it.
- Deliberately minimize notification **spam** (docs/core/decisions.md D13) — **but the precisely-scheduled
  execution cue on flagged time blocks is the product's core lever and is NOT minimized (D30 revisits D13).**
- **Two distinct mechanisms** (do not conflate): (a) the **soft path** = standard **non-exact**
  `expo-notifications` on a quiet channel (DEFAULT importance · no sound · lock-screen PRIVATE) — it informs and
  **never pierces**; (b) the **execution cue** = the native **exact-alarm + full-screen** path (Android 12+
  exact-alarm + FSI + **"다른 앱 위에 표시"**, D41 — without the last one it only takes over a *locked* screen).
- **A block carries exactly ONE alert — one of two (D40 → D43, revises this section):** `soft` (a plain
  notification — tells you, forces nothing; arrives at up to **3 moments the user picks**, D45) · `execution`
  (the cue). **Default = `execution`** — the lever is the product, so you opt *out*, not in. There is no
  "silent block" option. **Sound is a separate axis** (`alertSound`, default off = vibration only): the
  execution moment may be silent and a soft alert may ring (D43). Important events use the soft path (R3).

## 4. Data model sketch (draft)

> **Canonical field definitions live in `docs/core/data-model.md`** — the list below is a sketch; names/structure
> follow `docs/core/data-model.md`.

- **ImportantEvent**: id, date, time, title, **notifyLeadMinutes** (per-event offset before start; default if
  unset, D28), color (optional), memo, createdAt/updatedAt.
- **TimeBlock** (day plan): id, date, **start–end** (free-form interval), title, **location** (optional),
  **kind** (`normal | workout | run`), **alert** (`soft | execution` — **default `execution`**; the `none` tier of
  D40 was **removed** by D43/D45) (+ alarmLeadMinutes, microStartNote, **alertSound** per-block, **alertLeads** =
  the ≤3 moments a `soft` alert arrives at),
  **snapStart / snapEnd / snapTitle + plannedAt** (frozen D-1 values for evaluation, D23),
  **status** (`planned | success | fail`), **failReason**, completedAt, updatedAt.
- **Expense** (per `docs/research/reference-apps.md` §A2): id, date, timestamp, category (one of 8 fixed, D16),
  amount (KRW), payment (free-text), store, memo, updatedAt. *(icon is derived from the fixed category, not stored.)*
- **MealEntry** (per §B2, minus photo): id, date, timestamp, **mealType** (아침/점심/저녁/간식), **foodName**, detail, kcal, updatedAt.
- **DayAggregate** (derived): totals for spending/calories per day; monthly/all-time rollups; per-meal kcal
  vs target; **workout/run done flags derived from workout/run TimeBlocks marked success (D22)**.
- **Account / Settings**: uid, loginId (id+password auth), settings; login optional, enables sync (D20).
  (device / lastSynced are managed by the Firestore SDK, not modeled by us.)

> Field shapes for Expense / MealEntry are taken directly from the existing apps — see the full inventory in
> `docs/research/reference-apps.md`. Keep the shared record convention (string id, ms timestamp = chosen date + current
> clock time, category). **No standalone ActivityEntry** — workouts live as TimeBlocks (D22).
> **Day boundary**: "today" / "D-1" are computed against the device's **local midnight**.

## 5. Non-functional requirements

- **Offline-first**: usable without connectivity; sync when available (Firebase offline caching).
- **Data portability**: JSON export/import with merge-vs-overwrite (as in the reference apps).
- **Android-first**: primary target and test platform; iOS is a later expansion.
- **Zero paid services**: free tiers / free-and-open-source only (docs/core/decisions.md D10).
