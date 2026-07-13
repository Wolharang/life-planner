# Build log — Full app ("integrated day")

Chronological journal of the **full-app** build in `app/` (the phase after the completed trigger prototype).
Complements — does not replace — `docs/research/implementation-plan.md` (the F0–F5 plan) and
`docs/core/prd.md` (What/Why). The prototype's own history is `docs/research/prototype/build-log.md`.
Newest entries at the top. Working language English; UI copy stays Korean.

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
