# Build log — Full app ("integrated day")

Chronological journal of the **full-app** build in `app/` (the phase after the completed trigger prototype).
Complements — does not replace — `docs/research/implementation-plan.md` (the F0–F5 plan) and
`docs/core/prd.md` (What/Why). The prototype's own history is `docs/research/prototype/build-log.md`.
Newest entries at the top. Working language English; UI copy stays Korean.

---

## 2026-07-11 — F3: 기록 탭 real — expense + meal logging (reference apps ported)

The **기록** tab stops being a stub. Both reference apps are ported per their migration spec
(`reference-apps.md` §A/§B) — logic and field shapes, not the code: they were standalone single-file apps.

### What
- **Entities** — `Expense` (date, timestamp, name, amount **KRW** D25, category **8 fixed** D16, store,
  payment **free text** D26) and `MealEntry` (date, timestamp, mealType 아침/점심/저녁/간식, foodName, detail,
  **kcal manual only** D27). **No photo field** (D19). **No 운동/러닝 activity record** (D22) — see below.
- **`src/core/logs/constants.ts`** — the 8 categories with the reference apps' identity **colors + emoji**,
  the meal icons, and the per-meal kcal targets. **Reconciled a reference bug** the spec flagged (§B1): the
  daily target is now **derived** (`sum = 1500`) instead of a hard-coded literal that could desync.
- **`src/core/logs/aggregate.ts`** — pure: month filter · month total · **category distribution** ·
  **day sections** · **today's kcal-vs-target summary** · `stampFor` (the reference convention: the chosen
  date + the current clock time). Reused later by the day summary (R10).
- **Repositories** `lp.expenses.v1` / `lp.meals.v1` (same Repository pattern → F0 swaps them to Firestore).
  Both keys added to the JSON backup's merge map (R12).
- **Screens** — `(tabs)/logs.tsx`: 지출 / 식사 segmented, month nav, the summary card (총 지출 + distribution
  bar + top-3 legend / kcal vs target per meal), day-grouped list. `/add-expense` + `/add-meal`: **amount and
  food name are focused first**, the category/meal type is one tap (meal type is pre-picked from the clock) —
  the S4 bar is **≤2 taps + a number**.
- **D22 upheld:** the 식사 summary's **운동/러닝 O·X is derived from that day's TimeBlocks** marked success
  ("블록에서 자동"), not logged here. **D32 upheld:** nothing from this surface appears on home/My Day.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (24 — **new `aggregate.test.ts`**: month-scoped total, category split
+ ratio, day sections newest-first, KRW formatting, per-meal kcal vs target ignoring other days, derived
1500 daily target, `stampFor`). **No native change → no prebuild.** On-device pending: log an expense and a
meal in ≤2 taps; the month total / distribution / kcal summary read correctly.

---

## 2026-07-11 — F2: TimeBlock + day plan + My Day (Task fully retired)

The prototype's `Task` is **gone**; the app now runs on the full-app **`TimeBlock`** (data-model §2.3) — one
system, one integrated day. Two founder decisions were logged first (**D37**, **D38**) because the code had
drifted from the docs.

### Decisions taken before coding
- **D37 — no recurrence.** The docs' TimeBlock is strictly **per-date**; the prototype's `daily|weekly` had no
  home in it (no `date` → no D-1 snapshot, no per-day status, nothing for the day view to own). Kept the docs;
  replaced the need with **multi-date add**: tick N dates → **N independent blocks** (the UI says "반복이 아니라
  각각 따로예요"). Migrated recurring tasks land as **one block on today**.
- **D38 — one notification per block.** spec §3.9 as written: a block's only alert is the **execution cue**. The
  prototype's soft per-task "단순 알림" is dropped for blocks; the soft path lives on as the event advance
  notification (R3).

### What
- **`TimeBlock`** (`types.ts`) — date · start/end · title · location · kind(normal|workout|run) · executionAlarm
  + alarmLeadMinutes + microStartNote · **skipped** (the pre-fire "오늘은 쉼") · **snapStart/snapEnd/snapTitle/
  plannedAt** (D-1 snapshot) · status(planned|success|fail|**skipped**) · failReason · completedAt.
- **`blockRepository`** (`lp.blocks.v1`) — CRUD + `blocksOn` + `groupByDate`, and the **one-time Task migration**
  (`lp.tasks.v1` → blocks, **ids preserved** so existing outcomes/fires/latencies stay attached, then the old key
  is dropped). `kind` is guessed from the title. Old (prototype) JSON backups still import — the restore lands
  as tasks and the next read migrates them.
- **`blockScheduler`** — `blockFireAt` = **live** `date+start − lead` (D23: the snapshot never schedules);
  `scheduleBlock`/`unscheduleBlock` (one-shot; skipped/off/past → cancel); **`snapshotFor`** (mirrors while the
  date is future, **freezes by itself once the date arrives** — no midnight job; a block created on the day
  snapshots its creation values); **`pastUnfiredBlocks`** (R6 never-fired net, now trivially date-based);
  **`freeSlots`** (the day's real empty gaps).
- **`/day`** (new) — the day's schedule in clock order + the **free-slot hint** ("진짜로 비어 있는 시간이에요.
  운동은 여기에 놓으면 실제로 하게 돼요") which pre-fills the add screen's start/end.
- **`/add-block`** (replaces `/add`) — title · start(–end) · kind · **multi-date picker (21 days)** · location ·
  execution cue + lead + micro-start.
- **Home = My Day** — today's blocks as execution cards (next-up hero), the "오늘은 쉼" switch **only before the
  moment** (no in-flow escape), a calm **해냄** after it, plus a **"내일 하루 설계하기"** nudge (S3, the biggest
  adoption risk). Catch-up net (R6), permission banner (§8) and the no-guilt outcome model carry over unchanged.
  Outcomes now also write back to the block (`status`/`completedAt`) so R17 evaluation can read it off the block.
- **Calendar** — the selected-day panel gained a **하루 설계** section (that day's blocks) opening `/day` (D21).
- Retired: `taskRepository`, `taskScheduler` (+test), `/add`.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (17 — **new `blockScheduler.test.ts`** covers: fire = live start − lead;
cue off / skipped → no fire; snapshot mirrors-then-freezes; same-day edit does **not** move the plan of record;
never-fired reconstruction skips blocks the native backup will still re-fire; free-slot gaps). **No native change
→ no prebuild.** On-device pending: migration of existing tasks, multi-date add, `/day` free slots, a flagged
block firing the execution moment.

---

## 2026-07-11 — F1 완결분: important-event advance notification (R3, local · no backend)

**Why now (a plan correction).** F1's advance notification was filed as "waits for F0 (backend)". A code
audit showed that's wrong: **R3/D18 specify a *local* notification** (explicitly **not** paid server push),
and `src/core/notifications/plainReminders.ts` (expo-notifications) already exists. So R3 needs **no
backend** — **F0 gates only R2 (cross-device propagation)**. F1 is now complete except R2.

### What
- **`plainReminders.ts` (reframed as "the SOFT notification path", R15a)** — gained the event path next to
  the task path: `scheduleEventNotification(event)` · `cancelEventNotification(id)` ·
  `rearmEventNotifications(events)` · the pure `eventNotifyAt(event, lead, now)`. Alert time =
  `date+time − lead`; **lead = `event.notifyLeadMinutes`, else the personal default** (R3 "default if
  unset", R13/D28 — read lazily from `settingsRepository`, so the module's time math stays import-clean).
  Identifiers `${eventId}-e` (task reminders are `${taskId}-r${offset}` — no collision).
  **An untimed event gets no alert** — R3 is defined on `time − lead`, and inventing a time was rejected.
- **`add-event.tsx`** — a **알림** lead section (정각 / 10분 / 30분 / 1시간 / 하루 전 + 직접), shown only when
  시각 지정 is on; new events pre-fill the personal default. Save schedules (same id → replaces), delete
  cancels. Copy states the R15 discipline plainly: **"조용한 알림이에요 — 잠금화면을 뚫지 않아요."**
- **Re-arm** — home's app-open drain (`(tabs)/index.tsx`) and **backup import** (`backup.ts`) both call
  `rearmEventNotifications`, which drops *all* event alerts (incl. ghosts of deleted events) then
  reschedules the current set. Survives reboot / reinstall / restore.
- **`(tabs)/calendar.tsx`** — the selected-day detail shows the set lead ("🔔 30분 전").

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (**new** `plainReminders.test.ts`: lead counted back from local
date+time · 하루 전 · 정각 · untimed → none · past → none). **No native change → no prebuild** (JS only);
Metro reload suffices. On-device check pending: set an event 30분 전 → the quiet alert arrives, and it does
**not** pierce the lock screen.

---

## 2026-07-11 — Execution moment: delayed "진짜 했어?" re-check (R7 flow change, native)

Founder-directed change to the core lever (native `ExecutionActivity`). **New flow:** COMMIT ("…하기로 했잖아")
→ acknowledge ("응, 할게") + the app **arms a ~5-min follow-up alarm** and dismisses → 5 min later it re-opens
over the lock screen at **RECHECK ("진짜 했어?")**: **"응, 했어"** → DONE; **"아직 안 했어"** → 5·4·3·2·1 → **"지금
나가."** → dismiss (outcome stays **pending** — no-guilt catch-up, never an immediate miss). Replaces the prior
COMMIT→immediate-countdown→micro-start→GO. Invariants held: light, no in-flow "can't-today" escape, no guilt.

### What (native, `app/modules/lp-alarm/`)
- Threaded a new **`EXTRA_MODE`** ("commit" | "recheck") through `AlarmScheduler` (const + `AlarmItem.mode` +
  fire/show PendingIntents), `AlarmReceiver`, and `AlarmNotifications.showFullScreen`. JS path unaffected (`mode`
  defaults to "commit"; `LpAlarmModule.scheduleExactAlarm` unchanged).
- `ExecutionActivity`: reads `mode`; on **commit** it records the fire marker + `scheduleRecheck()` (a transient
  one-shot `AlarmItem(id="<taskId>#recheck", fireAt=now+5m, recurrence="none", mode="recheck")`, `persist=false`)
  then shows commit (button → dismiss); on **recheck** it renders "진짜 했어?" → 응했어=`render("done")`
  (existing `recordDone`), 아직안했어=`leave` 5·4·3·2·1 → `leavego` → dismiss. The re-check id's `#recheck` suffix
  is stripped so outcomes key the original task. The old commit→countdown→act→go views are kept but unreached.
- Outcomes: **no JS change** — "응, 했어" records `done` via the existing `PendingOutcomes`; "아직 안 했어" records
  nothing (pending → the R6 catch-up net resolves it later).

### Notes / risks
- **Native (Kotlin) — not compile-checkable here** (gradle compiles only at `run:android`); reviewed carefully.
  Needs **`prebuild --clean` + `run:android`** on a real device to verify.
- Edge: a re-check crossing local midnight would date the `done` to the next day (rare; accepted, `[TBD]`).
- The native moment still uses the **prototype forest/gold palette** (the v5 Toss-form skin only touched the JS
  preview `execution.tsx`, which is NOT the live moment) — reskinning the native moment to v5 is a separate task.
- Docs updated: PRD **R7** flow + acceptance; **design-principles A2** revision note.

---

## 2026-07-11 — Bottom tabs + month calendar (R1, local-first)

First full-app UI feature. **Note on order:** built the calendar **UI local-first ahead of F0** (the backend
phase) at the founder's direction — legitimate, because the Repository pattern lets the storage impl swap to
Firestore later behind the same interface (architecture §7). So this is F1's UI on a local store; F1's sync
(R2) + advance notification (R3) still wait on F0.

### What
- **Bottom tab bar** (`app/app/(tabs)/_layout.tsx`) — expo-router `(tabs)` group: **홈 · 캘린더 · 기록**
  (react-native-svg icons; active = brand blue, inactive = grey). Restructured the app from a flat Stack:
  moved the home screen `index.tsx → (tabs)/index.tsx`; non-tab screens (add, execution, settings,
  onboarding, metrics, add-event) stay at the `app/app/` root and push over the tabs via the root Stack.
  **기록** is a placeholder for now (the real expense/meal logs = R8/R9, a later feature).
- **Calendar screen** (`app/app/(tabs)/calendar.tsx`, PRD R1) — a **square-cell month grid** (7×6, CSS
  `aspectRatio: 1`, no measuring): date number top-left; a day with events shows a **horizontal colored bar**
  (color = `event.color`, up to 2 bars + "+N"); today = a filled brand circle; selected day = brand-soft cell.
  Prev/next month + **오늘**. Tapping a day selects it and the **panel below the grid** lists that day's events
  in detail (color dot + title + time + memo), with **＋ 일정 추가**; empty → gentle "이 날은 일정이 없어요".
- **ImportantEvent data** — new `ImportantEvent` entity in `src/core/data/types.ts` (id, title, date, time?,
  notifyLeadMinutes?, color?, memo?, createdAt, updatedAt — mirrors data-model §2.2) + a local
  `eventRepository.ts` (`lp.events.v1`, same AsyncStorage Repository pattern as taskRepository, +
  `groupByDate`). Added `lp.events.v1` → id to `backup.ts` merge keys so events are covered by JSON
  backup/restore.
- **Add/edit event** (`app/app/add-event.tsx`) — modeled on add.tsx: title (required), date (editable by day),
  optional time (Switch + HH:mm), a bar **color** (preset chips), memo; save/edit/delete.

### Scope / deferred
- **Sync (R2)** and **advance notification (R3)** are NOT in this change — they land with the backend (F0).
- The tab bar exists ahead of the full IA build-out; **기록** is a stub; 돌아보기/평가 (F5) not present.

### Verified
- `npm run typecheck` ✓ · `npm test` ✓ (route/type + scheduler logic intact). New native deps: none
  (react-native-svg already present) → no prebuild; a Metro reload suffices. On-device visual check pending
  (founder): tab switching, the square calendar, add-event → colored bar appears, tap-day → detail panel.
