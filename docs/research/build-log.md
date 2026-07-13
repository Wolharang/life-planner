# Build log — Full app ("integrated day")

Chronological journal of the **full-app** build in `app/` (the phase after the completed trigger prototype).
Complements — does not replace — `docs/research/implementation-plan.md` (the F0–F5 plan) and
`docs/core/prd.md` (What/Why). The prototype's own history is `docs/research/prototype/build-log.md`.
Newest entries at the top. Working language English; UI copy stays Korean.

---

## 2026-07-11 — Device pass #3: the unstoppable alarm (D44) · alert model round 2 (D43)

### THE SERIOUS ONE — a tone playing with no screen and no notification (D44)
- **Symptom (founder):** the moment fired on the lock screen; the screen was cycled off→on; then **the alarm
  tone kept playing with no window and no notification** — nothing to tap, **no way to stop it**.
- **Cause:** the tone is a looping `MediaPlayer` owned by `ExecutionActivity`. If the activity survived but
  stopped being **visible**, the loop kept running — and (since the previous fix) its notification was
  already cancelled, so there was no way back to the screen that owned the sound.
- **Fix — the tone lives and dies with the screen it belongs to:** it stops on `onPause` (the instant we lose
  the foreground), resumes on `onResume` if the moment is still asking, and is **hard-capped** by its own
  handler that no phase change can clear. **No path can leave audio running without a visible way to stop it.**
- **And the ghost/return trade-off is now right:** the notification is cancelled **on resolution** (not on
  takeover) and answered occurrences are never replayed — but an **unanswered** moment KEEPS its notification,
  because that is the user's way *back* to it. (The previous fix cancelled too early: it removed the very
  thing that could have rescued this situation.)

### Alert model, round 2 (D43)
1. **`없음` removed** — a block you'd never be told about isn't worth adding. Two tiers: **알림 / 실행**.
2. **`실행` is now the DEFAULT** for a new block — the lever is the product; you should have to opt *out*.
3. **A soft alert can REPEAT** — 1 / 2 / 3 / 5 times, 5 minutes apart. One missable buzz is how a soft alert
   quietly becomes useless.
4. **Sound is per-block and independent of the tier** — the **execution moment can be vibration-only**, and a
   **soft alert can ring**. (Two questions — *how hard does it push* vs *how loud is it* — had been fused.)
   Threaded natively (`AlarmItem.sound` → intent → mirror), because the moment reads it at fire time.
   The soft path got a second channel (audible) since Android freezes a channel's sound after creation.
- Consequence in the catch-up net: **only an `execution` block can be "missed"** — a soft alert merely
  informed you, so it never manufactures a miss.

### "그냥 닫기" is now a real button
The optional fail-reason's escape was a faint text link — which reads as *"you really should write something"*.
That friction is exactly how an app quietly stops being used (C2/B1). It is now a **bordered pill of equal
weight** to 남기기, in both the home card and 돌아보기.

### Verified
`typecheck` ✓ · `31 tests` ✓ · `prebuild --clean --platform android` ✓.

---

## 2026-07-11 — The moment must be a ONE-SHOT: the stale notification could replay it

Second round of founder device findings. Answers + one more real defect.

### THE DEFECT — a finished moment could be re-run from the notification shade
- **Symptom (founder):** after 5·4·3·2·1 → "나간다" the screen closed, **but the notification stayed at the top
  of the phone**; tapping it **re-ran the same 진짜 했어? flow**.
- **Cause:** `ExecutionActivity` never cancelled the full-screen-intent notification that launched it. The
  notification only auto-cancels *when tapped* — so after the moment ended by any other route (answer, timeout,
  countdown → 나가), it lingered as a live re-entry point. Worse: tapping a stale **commit** notification would
  re-enter commit and **arm a SECOND 5-min re-check**.
- **Fix:** the moment is now explicitly a **one-shot**. `AlarmNotifications.cancel()` is called (a) the instant
  the activity takes over an occurrence and (b) again when it dismisses; plus a process-level `handled` guard
  so a duplicate intent can't replay an occurrence that was already answered.
- **Same class of ghost, found while fixing it:** the native moment arms its own `"<id>#recheck"` alarm, but
  **JS didn't know to cancel it** — so a block you resolved from the app (해냄 / 미룸) would still ask
  "진짜 했어?" five minutes later. `unscheduleBlock` now cancels it too, and `scheduleBlock` cancels it **only
  once the block is closed** (a still-open block must keep its re-check — an app-open re-arm would otherwise
  silently delete a follow-up the user is still owed). Covered by 3 new tests.

### The re-check also only arrived as a notification → **same cause, already fixed**
The founder saw the 5-min re-check arrive as a heads-up ("지금 — 테스트…") that had to be tapped. It travels the
**same** `AlarmScheduler → AlarmReceiver → showFullScreen` path as the commit, so **D41's "다른 앱 위에 표시"**
covers both. With that grant, the re-check takes over the screen by itself.

### "나간다 → the app just closes. Is that right?" → **yes, by design**
The moment's job is to **push you out the door**, not to hold you for paperwork (A2/A3: one tap, no decisions,
no typing — designed for the depleted self). So it ends. The outcome stays **pending** — deliberately **not** an
immediate miss (R14) — and the evaluation happens **later, in the app**: the home **catch-up card** ("아직 안
했죠 · 했어 / 미룸") and, if it becomes a miss, the optional one-line reason and **돌아보기** (R17). Nothing is
lost by closing.

### Verified
`typecheck` ✓ · `31 tests` ✓ · `prebuild --clean --platform android` ✓.
**Still unverified on a device:** the moment with the screen **OFF/locked** (the founder's pass was screen-on).

---

## 2026-07-11 — On-device findings: the moment must APPEAR · skin locked to v5 · alert tiers · sound

Founder ran the device pass. One real defect, one lock, two missing features. All four land here.

### 1. THE DEFECT — the moment only appeared as a notification you had to tap (D41)
- **Symptom:** at the fire time a **heads-up notification** appeared; the full-screen moment opened **only
  after tapping it**. Execution became opt-in at exactly the point the user is trying to avoid it — the lever
  was, in effect, off.
- **Diagnosis (not a regression):** Android launches a full-screen intent **immediately only while the screen
  is off/locked**. On an **unlocked, in-use** phone it degrades to a banner, and a BroadcastReceiver's direct
  `startActivity` is blocked by the **background-activity-start restriction** (Android 10+). Earlier tests
  happened to be run with the phone locked, which is why it "used to work".
- **Fix:** request **`SYSTEM_ALERT_WINDOW` ("다른 앱 위에 표시")**, which lifts that restriction → the moment
  appears at its time **in every state**. It is now a first-class grant: onboarding row, 실행 준비 상태 (n/4),
  and the home denial banner, which now says exactly what is lost ("화면을 켜고 쓰는 중엔 실행 화면이 안 떠요").
  **D41** logged; PRD **R7/R16** amended.

### 2. Skin LOCKED to v5 (D39)
The founder confirmed the blue "Toss-form" skin. **It was never the docs that made the code old** — the v5
reskin had simply only touched the JS screens; the docs were *recording* that state ("provisional"). Now:
`design-system.md` §1 is confirmed (D39 supersedes D36's forest/gold **colors**; D36's base-library choice
stands), and the **native `ExecutionActivity` is repainted to v5** — brand `#3182F6`, gold `#B0862A`, exec
ground `#FBFAF6`. **No screen is left on the old palette.** The invariants a reskin may never touch are
restated: miss = taupe (never red) · gold = the one DONE mark · the moment is LIGHT · no confetti.

### 3. Alert tiers: 없음 / 단순 알림 / 실행 알림 (D40 — supersedes D38)
The founder asked for a tier that **just tells you** (notification + vibration) without forcing the
full-screen flow. This **contradicted D38**, which I had written from spec §3.9 ("a block's only notification
is the cue") — so **D38 is superseded, and spec §3.9 is amended**: a block still carries **exactly one**
alert, now chosen from **three**. `TimeBlock.executionAlarm: boolean` → **`alert: none|soft|execution`**
(old data reads through a normalizer). `soft` rides the **quiet channel**, so R15's "only the cue pierces"
still holds *structurally*.
**Why this makes the lever stronger, not weaker:** without a soft tier the user must either over-apply the
lock-screen cue — destroying "one loud thing" (C1/D30), which is loud *because* it is rare — or get nothing.
The soft tier is what protects the cue's scarcity.

### 4. Sound: choosable tone, and silence = vibration-only (D42)
설정 → **소리** (off by default = **진동만**) → when on, **알림음**: pick from the device's alarm/notification
tones **with preview**, or follow the device default. Stored natively (`SoundSetting` + `TonePreview`) because
the moment reads it **at fire time**, when JS may be dead.

### Verified
`typecheck` ✓ · `28 tests` ✓ · `expo prebuild --clean --platform android` ✓ (SYSTEM_ALERT_WINDOW merged into
the manifest). **Needs a device pass:** grant "다른 앱 위에 표시" → the moment must now take over **while the
phone is unlocked and in use**, not just from the lock screen.

---

## 2026-07-11 — F5: 돌아보기 (R17) — plan vs actual, with the reason OPTIONAL

The last phase before the backend. The whole design tension here is **D5 (a fail needs a reason) vs B1 (never
nag, never guilt)**. Founder's call (2026-07-11): **offer the reason, never demand it** — you can always just
close, and an empty reason is a first-class outcome, not an unfinished task.

### What
- **Optional fail reason.** When a miss is recorded (the R6 catch-up "미룸"), the record is **already closed**;
  only *then* does a gentle card appear — "왜 못 했는지 한 줄 남길까요? · 안 남겨도 괜찮아요" — with **남기기 /
  그냥 닫기**. Nothing is blocked, nothing is re-asked. Writes `TimeBlock.failReason` (D5), which until now
  was declared and never written.
- **`/review` (돌아보기)** — month rollup **executed vs planned** (해냄 · 미스 · 쉼 · 계획), with the D-1 line:
  "그중 N개는 전날 미리 정해둔 것" (**D23** — the plan of record is judged, not the same-day edit) · **아직 안
  남긴 것**: past unresolved blocks markable 해냄/미스 right there (R17 acceptance) · **못 한 이유들**: every
  fail gathered in one place, each reason addable/editable/removable **later** (so a skipped reason isn't lost
  forever). Reachable from 설정 and the day summary.
- **What it deliberately does NOT do (D29/D5):** no success-rate score to optimize, **no quantitative
  plan-vs-actual** (planned 60min vs actual 90min), **no auto-suggestions** — the screen says so out loud:
  *"앱은 계획을 대신 고쳐주지 않아요. 이유를 모아둘 뿐이고, 다음 계획은 내가 정해요."* No streak (R14).

### Known gap (needs F0)
spec §3.6: "a block in the D-1 plan but **soft-deleted on the day counts as fail**". We hard-delete today —
tombstones (`deletedAt`) arrive with F0's sync model, so that rule lands then.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (28). No native change → no prebuild.

---

## 2026-07-11 — F4: 하루 요약 (R10) — the day, linked but not merged

The one place the two surfaces meet. Built exactly to the constraint the docs put on it: **integration is a
day-level LINK, never a merged timeline** (D32) — so the screen shows **two distinct sections** and no
interleaved list exists anywhere in the code.

### What
- **`DayAggregate`** (`types.ts`, data-model §2.6) + **`dayAggregate(date, blocks, expenses, meals)`**
  (`logs/aggregate.ts`) — **derived on read, never stored** (zero writes, the §6-3 cost guard). Returns the
  plan side (`blocksPlanned/Success/Fail/Skipped`, `workoutDone`, `runDone`) and the log side
  (`expenseTotal`, `kcalTotal`, `kcalByMeal`) as **separate fields**, which is what makes "two sections, not
  one timeline" structural rather than a rendering choice.
- **`/summary?date=`** — 계획·실행 (tally + the day's blocks with done/miss/쉼) · a divider · 기록 (지출
  총액 + category dots · 칼로리 합계 vs 목표 + per-meal). Reachable from the **calendar's day panel** and the
  **day view's 요약 chip** — never embedded *in* a plan surface (D32 holds: home/day still show no spend/meal).
- **D22 upheld and now centralized:** 운동/러닝 O·X is derived from success blocks in the aggregate; the
  기록 tab's inlined copy of that derivation was removed and now reads the same function.
- **No-guilt (R14):** done = one calm gold 해냄 · miss = **taupe, never red** · 쉼 = neutral · no streak, no
  score, no "달성률".

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (28 — **new `dayAggregate` tests**: per-status counts scoped to the day ·
workout flag derived from a *success* block of that kind (planned ≠ done) · plan-side and log-side totals stay
separate and day-scoped). No native change → no prebuild. On-device pending.

---

## 2026-07-11 — Internal audit against `docs/core/` — 12 deviations found and fixed

A strict conformance audit of the whole build against the core docs (PRD R1–R17 · spec · data-model ·
architecture · design-principles · decisions · CLAUDE.md cautions). Two independent passes (product/UX and
data/architecture). What follows is **only what was actually wrong**; each was verified before fixing.

### The lever was breakable (HIGH)
1. **The cue could die silently when notifications were denied (R16).** The home readiness banner watched
   exact-alarm + full-screen-intent, but the cue is delivered *as* a full-screen-intent **notification** —
   the native path swallows the `SecurityException` when POST_NOTIFICATIONS is missing. So the one grant
   that also kills the lever was the one grant nothing surfaced. → The banner now watches **all three** and
   deep-links to whichever is missing. **PRD R16 amended** to say so.
2. **The migration left ghost alarms and unarmed blocks.** `ensureMigrated()` rewrote storage only. A
   prototype `daily` task re-arms itself **natively** (mirror → receiver → boot), so it would have kept
   firing **forever** with no block behind it (poisoning the catch-up net and S1), while migrated blocks got
   **no alarm at all**. → Migration now **cancels every prototype alarm + soft reminder** and **arms the
   migrated blocks**; app-open now also **re-derives every alarm from the repositories** (`rearmBlockAlarms`,
   architecture §11 layer 4) so any mirror divergence self-heals.
3. **The migration could destroy the prototype's data.** `removeItem(LEGACY_KEY)` sat *outside* the `try`,
   so a corrupt *destination* or a failed write dropped the legacy key anyway → tasks gone, nothing written.
   → The legacy key is now dropped **only after** the new payload is safely persisted.
4. **`/execution` (the JS preview) wrote real S1 data and had an in-flow escape.** It was a live route that
   recorded outcomes with `source: "execution-screen"` — the exact source S1 counts — and offered an "아직"
   bail. It was also two flows out of date. → **Deleted.** `ExecutionActivity` is the single execution moment.
5. **Hardware Back was an in-flow escape.** One Back press mid-5·4·3·2·1 ended the moment — precisely what
   the countdown exists to prevent (A2, CLAUDE.md). → `onBackPressed` is now a **no-op**; the dead prototype
   views (which still carried an "아직" escape) were deleted.

### Policy that was unenforced (MED)
6. **The soft path had no channel**, so R3 advance alerts landed on the OS default (default sound, default
   lock-screen visibility) — the two notification intensities were distinguished only by accident. → A
   dedicated **`lp-soft-v1` channel: IMPORTANCE_DEFAULT · no sound · lock-screen PRIVATE**. R15 is now
   enforced by the channel, not by hope.
7. **The metrics screen graded the wrong things.** It used the prototype's S-numbering (S1=정시발화,
   S2=착수율) while PRD §4 defines S1=execution rate, S2=alarm reliability, **S3=D-1 planning adoption**
   (the biggest non-technical risk), S4=logging friction, S5=no-guilt return — so the two numbers the PRD
   says to watch hardest were swapped/absent. → Rebuilt to **S1–S5 as the PRD defines them**, incl. a real
   S3 (days planned the day before, from each block's `plannedAt`) and S4 (same-day logging share).
8. **The micro-start had no screen.** The R7 flow change (commit → re-check) quietly dropped "지금 신발 신기"
   — the 5-second first move A2 is built on. → It's back, on the commit card.
9. **`skipped` was modelled twice** (`status` *and* a boolean) and could diverge — a settled block could keep
   rendering as 쉼 and stay uncued. → Collapsed to the **single `status`** the doc defines.
10. **Alarm eviction lived in the screens**, so any path that didn't hand-pair it (a future Firestore
    listener, `saveBlocks`) would ghost. → Moved **behind the repository**: add/update/delete reconcile the
    alarm themselves (architecture §9-2).
11. **Ids were timestamps**, so two same-millisecond records collided (and would silently merge under
    last-write-wins). → `newId()` with entropy; data-model §0 corrected (it said UUID, the code didn't).
12. **≤2-tap logging was not actually ≤2 taps** — the expense form required a *name* as well as an amount
    (two keyboard trips). → **Only the amount is required**; a blank name falls back to the category. PRD R8
    + data-model §2.4 amended. Also added the `memo` field the doc had but no screen could write.

### Also corrected
Tone: "나가면 이긴다" (a competitive frame the docs never license) → **"딱 첫 동작만 하면 돼."**; a mixed
존댓말/반말 sentence in `/day`. Copy: 백업 복원이 아직 "할 일 N개"라 하던 것 → "블록 N개".
**Docs that were themselves stale:** architecture §4.1 (recurrence / per-task soft reminders — retired by
D37/D38), design-system §4.3 (Recurrence picker · Plain-reminder picker → the multi-date picker), the
"Task row" component, data-model §2.4/§2.5 (`name` missing, `mealType` enum wrong).

### Not defects (checked, left alone)
**R10 day summary** and **R17 evaluation** are absent because they are **F4/F5** — the plan's next phases, not
drift. The **native moment still runs the forest/gold palette** — that's blocked on the skin-lock decision
(prep P-e), not a bug. `failReason` is still never captured; it lands with R17 (flagged: misses recorded
today accrue without a reason).

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (24) · `expo prebuild --clean` ✓ (native changed: Back no-op, micro-start
on the commit card, dead views removed). **On-device verification is still required** for the native changes.

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
