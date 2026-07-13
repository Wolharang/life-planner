# PRD — LifePlanner (Full App: the Integrated Day)

> **This document's role.** The single canonical source of **What** the full app must do and **Why** — the
> guardrail an implementer (human or AI) checks at every "is this the right direction?" moment. It does **not**
> specify **How** (APIs, schema, framework code); the How lives in `docs/core/architecture.md`,
> `docs/core/data-model.md`, and the build sequence in `docs/research/implementation-plan.md`. Where this PRD and
> those documents disagree about *what the product should do*, **this PRD wins**. Confirmed decisions are logged in
> `docs/core/decisions.md` (cited inline as **D#**); the readable narrative is `docs/core/service-overview.md`.
>
> **Scope = the full "integrated day" app**, built **on top of the completed, founder-validated trigger prototype**
> (`docs/research/prototype/PROTOTYPE-STATE.md`). The execution lever (native exact-alarm + lock-screen moment) is
> **reused, not rebuilt**; this PRD adds the calendar, D-1 time-block planning, in-the-moment budget & calorie
> logging, day summary, cloud sync, and (Later) plan-vs-actual evaluation.
>
> **Instruction to an implementing AI agent.** This PRD is written to be **self-contained**: you should be able to
> understand *what to build and why* from this file (+ its cited How-docs) without reading prior conversation.
> Every requirement (**R1–R18**) carries **acceptance criteria** — meeting them = "done" — and a **priority
> (P0/P1/P2)**. Placeholders marked `[TBD]` are deliberately unset (numeric targets, a few constants); **do not
> invent values — leave them and flag them.**
>
> **Language note.** This document is **English**. The app's end user is Korean and single (the founder), so **all
> UI copy the app displays is Korean**. Korean UI strings are quoted verbatim in bold with an English gloss in
> parentheses **for this document's readers only — implement the Korean string, not the gloss.**

---

## 1. Title & Change History

- **Product (working title):** LifePlanner — a **no-guilt execution engine** (a tool that, without nagging or
  inducing guilt, helps the user *actually execute* a plan — not merely track or remind) delivered as one
  **integrated personal day** (calendar + time-block plan + in-the-moment budget/calorie logging).
- **Document:** Full-App PRD · **version v1.0** · 2026-07-10 · status: **draft (canonical)**.
- **Authoring context:** the convergence of the full pre-work (problem validation → 3 personas → differentiation
  → HMW → solution S2 → architecture/data/tech-feasibility) **plus** the completed trigger prototype that
  validated the riskiest piece (the execution lever). Written per the PRD method in
  `docs/research/instructions.md` (12-component structure).

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-07-10 | Initial full-app PRD. Extends the archived trigger-prototype PRD (`docs/research/prototype/prd.md`) from the execution lever to the whole integrated day. Requirements R1–R17 with acceptance criteria + P0/P1/P2. *(R18, the catch-up net, was added 2026-07-11 — it was built from the prototype but had no requirement number.)* Reuses the validated prototype execution module (R7). |

---

## 2. Background & Context

**The essential problem = the intention–action gap.** People know what they want to do yet, *at the moment*, do
not do it. This is **a structure problem, not a motivation problem** (F1): the will is already there ("I want to
work out"); what's missing is the **structure** that ties the action to a fixed moment. Surface-wise this looks
like "an app that merges calendar + budget + calorie," but integration is the surface — **the heart is crossing
"the 10 minutes between plan and execution."**

**The story (data → insight → decision).**
- **Founder interview (the seed):** *"정해놓지 않으면 아무것도 안 하고 자거나 유튜브 보거나 해서 아무 성과가 안
  나오는데, 정해놓으면 뭐라도 결과가 나온다."* (If I don't fix it in advance I do nothing; if I fix it, something
  gets done.) The concrete win: a gym block set for the empty lunch hour → the alarm fired → he went despite not
  wanting to → more regular visits (the "gym-lunch story", persona-1). `[R1-9, R1-13]`
- **Behavioral science (F1–F8, `docs/research/personas/overview.md`):** implementation intentions ("if-then" tied
  to a cue) roughly *triple* follow-through — meta-analysis **d≈0.65** (Gollwitzer & Sheeran 2006, 94 studies,
  F1); **initiation** is the hard part (F2); **fatigue** degrades execution (F3, the founder's #1 failure cause);
  **autonomous > controlled** motivation — guilt/pressure backfire (F4, why streak apps fail); a habit takes
  ~66 days and **one miss is fine** (F5); **structure creates freedom** (F6); empty time is captured by
  variable-reward feeds (F7); temporal landmarks re-trigger aspiration but fade without structure (F8).
- **Market signals:** ~**67%** of gym memberships go unused; ~**90%** of habit-tracker users quit within 30 days
  (largely via streak-guilt); ~**41%** of to-do items are never done; notification override runs high. The
  "resolves-but-can't-do" person is everywhere. `[S12][S13][A1][A2]`
- **The three concrete pains (founder):** ① **not following through** (evening fatigue beats the plan — "계획을
  해도 안 지켜진다"); ② **scattered, flawed tools** (KakaoTalk calendar doesn't sync to a new phone or show
  offline; the calorie app "feels like homework" so kcal is forgotten then dumped as 400/500/400; the budget app
  misses auto-transfers so the monthly total drifts); ③ **calendar sync failure** (an event added on one phone
  didn't appear on another → a double-booking caught too late; and **no advance notification reached all
  devices**).

**The one question this product answers:** *Can an app make the user actually **do** the pre-planned, skip-prone
task (especially exercise) at the moment — gently, without guilt — while quietly gathering the rest of the day
(spend, meals) so it all lives in one place?* The trigger prototype validated that the **execution lever fires and
runs**; this PRD builds the day around it. **The differentiator is the execution engine (D30), not the feature
list** — calendar/budget/calorie already exist everywhere; making you *do* the thing does not.

---

## 3. Goals & Overview

**One sentence.** *"전날 미리 정해둔 운동·할 일을, 그 시각이 되면 앱이 짧게 개입해 실제로 시작하게 만들고, 지출·식사는
그 순간 몇 번의 탭으로 남기는, 죄책감 없이 혼자 쓰는 개인용 앱."* (A personal, no-guilt app that makes you actually
start the tasks you pre-planned, at their time, and logs spending/meals in a couple of taps as they happen.)

**Goals (SMART — each measurable; targets `[TBD]`, calibrated by the founder self-experiment).**
- **G1 — Execution.** For **flagged** time-blocks, the user **actually starts** at the cued moment at a rate
  meaningfully above a plain calendar reminder (measured by S1 over `[TBD]` weeks).
- **G2 — Integration that's kept.** The user records the day (events, blocks, spend, meals) **in one app** with
  logging friction low enough (≤2 taps, S4) that it doesn't die of maintenance within the ~2-week "Notion
  window" (C2).
- **G3 — Reliable multi-device sync.** An event/plan created on one device appears on all the user's logged-in
  devices, with an advance alert on each — fixing the KakaoTalk pain (R1–R3).
- **G4 — No guilt.** Never punish a miss; success is one calm signal — so the user *returns* after a miss instead
  of the "what-the-hell" collapse (S5).
- **G5 — Free & personal.** Everything runs on **free tiers only** (D10), fully **offline-capable**, no forced
  account.

**Non-goals.** This is **not** an engagement/DAU product (D1 design-principle — success lives at the gym, not on
the screen); **not** sold on feature-parity with best-in-class single apps (we are not 10× at calendar, budget,
calorie, or auto-scheduling individually); **not** a team/collaboration/work tool; **not** a defensible "moat" —
the recipe is copyable, so quality of the execution moment is the only edge.

**Glossary (coined terms).**
- **Execution moment** — the short lock-screen intervention on a flagged block at its cued time (commit →
  5·4·3·2·1 → micro-start → "시작했어?" → GO → DONE), reused from the prototype.
- **No-guilt execution engine** — the product's identity: helps you execute without streaks, penalties, or shame.
- **Time-block** — a free-form start–end interval on a day's plan (D14); may be `kind = normal | workout | run`.
- **Flagged block** — a time-block with **실행 알림** (the execution cue) turned on; only these get the moment (D13/D30).
- **D-1 snapshot** — the day's plan frozen at the day-before boundary; drives **evaluation only**, never
  scheduling (D23).
- **Two surfaces (D32)** — plan/execution is one surface; in-the-moment spend/meal logging is a *separate* surface;
  "integration" = one app + **day-level linkage**, not one merged timeline.

---

## 4. Success Metrics

> Metrics are **grading criteria** (how we verify the goals), not aspirations — each is an **observable action**,
> not a feeling. Targets are `[TBD]`, set by the founder self-experiment. Instrumentation is free (Firebase
> Analytics/Crashlytics, Spark). Design-principle D1 governs: measure real-world action, never screen-time.

- **S1 — Execution rate (core).** Of flagged blocks whose cue fired, the share **marked done via the execution
  moment** (source = execution moment, not a later catch-up), per week ≥ `[TBD]`. This is *the* differentiator's proof.
- **S2 — Alarm reliability.** The execution cue fires within **±`[TBD: provisionally 1 minute]`** of `start − lead`
  under app-kill / lock+Doze / reboot, over the lock screen.
- **S3 — D-1 planning adoption (the watched risk).** # of days the user actually **creates a next-day (D-1)
  time-block plan** (baseline today ≈ 0). The whole flow depends on a step that is **not yet a habit** → this is
  the single biggest adoption risk; if it stays ~0, the "secondary" tier fails regardless of quality.
- **S4 — Logging friction.** Share of expense/meal entries logged **within a few minutes** of the event, and each
  in **≤2 taps** — so calories/spend stop being forgotten and back-filled.
- **S5 — No-guilt return.** After a missed occurrence, the share where the user **later does the same task-type**
  (the anti-"what-the-hell" event) — held **without** a streak.
- **Falsification condition.** If, over `[TBD]` weeks of honest use, the flagged-block execution rate (S1) is **no
  better than plain calendar reminders**, the core lever has failed → stop and redesign (the product's survival
  depends only on the execution lever working; the integrated day is supporting context, D30).
- **Anti-metric (deliberately NOT optimized).** **No streak counter**, no consecutive-day count, no DAU/session-time
  target. Optimizing a streak backfires (F4/F5/D1).

---

## 5. Personas

> Grounded in the founder's **33 interview answers** (P1) + research (P2/P3). Full profiles:
> `docs/research/personas/`. The three are **not different customers** — they break at different points of **one
> chain** (*distal goal → plan → the exact moment (start) → sustain*) but share **one job (JTBD): turn an
> intention into an action.** Design target = **P1 (D33)**; the same lever serves P2/P3 at their break-point.

- **P1 — PRIMARY: "혼자선 실행이 안 되는 계획형 학생" (the founder).** Planner-type who *loves* planning but,
  alone, loses to evening **fatigue** (his #1 failure cause). Vacation student (lectures + a project + weekend
  part-time), multi-device, domestic (KRW), cost-conscious (free-only). **Break-point = the exact moment (~10-min
  gap).** What works *for him*: only **exact time + "must do now" + an alarm** produces action; a vague "저녁에
  운동" does not. Success = "한 달 동안 설계대로 매일 헬스장 감"; failure = "미래 설계를 해도 헬스장을 안 감."
  **Adoption caveat (critical):** he does **not** currently do D-1 time-block planning — he only pre-records
  *important events* in KakaoTalk; on overloaded days he **omits** exercise. Volume (design sizing): important
  events ~15/mo, daily blocks ~5–6, expenses ~4/day, meals ~5/day. Chosen as primary because P1 has the richest
  data, the strongest efficacy fit (implementation intentions help the *motivated-but-can't-execute* most), and
  **P1 ≈ P3** at the core (so optimizing for P1 also covers P3) — D33/Cooper.
- **P2 — SECONDARY: "구조를 잃어 시간을 허비하는 사람" (heavy short-form user).** Abundant unstructured time lost
  to Instagram/TikTok/YouTube; short-form loops degrade the faculty to act and make him *forget what he meant to
  do* (F7). **Break-point = the plan stage** (never forms a plan). The same exact-time structure + re-cue supplies
  what the feed erodes.
- **P3 — SECONDARY: "착수에서 무너지는 자기계발러" (repeating New-Year gym quitter).** Has the goal, can't sustain;
  one miss → **"what-the-hell"** collapse. **Break-point = the exact moment + relapse.** Served by the exact-time
  cue (start) **plus** no-guilt / "one miss is fine" (F5/D1) — which is why **no-guilt is inviolable** for him.
- **Anti-persona.** People who act spontaneously without planning ("계획 안 해도 즉흥으로 잘 실천하는 사람"); people
  content with separate best-in-class calendar/budget/calorie apps. We do **not** design for them.

---

## 6. User Scenarios / Stories

**Scenario A — P1, the gym-lunch win (setup → trigger → action → result).**
*Setup:* the night before, P1 designs tomorrow: `13:00–14:00 점심` and, seeing a real empty gap, adds
`13:10–13:50 헬스` as a **flagged** workout block with micro-start "지금 신발 신기." *Trigger:* at 13:10 the phone,
locked, is pierced by the execution moment: **"어제 네가 13:10 헬스라고 정했잖아"** (Yesterday you set 13:10 gym) →
5·4·3·2·1 → **"딱 첫 동작 — 지금 신발 신기"** → **"시작했어?"** (Did you start?). *Action:* P1 taps **"응"** (yes),
gets a GO beat **"이제 그대로 나가."** (now just go). *Result:* he goes ~10 min late but **goes**; the block is
DONE with one calm gold mark, **no streak, no confetti**. Over a month, more regular visits.

**Scenario B — in-the-moment logging.** At a convenience store P1 pays; from the **기록 (Logs)** tab he taps
category **간식**, types the amount, taps save — **2 taps + a number**, done, synced. At lunch he logs the meal's
name + kcal the same way. Neither appears on the plan/execution surface (D32).

**Scenario C — multi-device sync (fixes the Kakao pain).** P1 adds an important event **"토 14:00 알바"** on his
tablet. Within seconds it appears on his phone's month calendar; both devices schedule their own advance alert.
Adding a new event, he already **sees** the existing Saturday event → no double-booking (D8).

**User stories (As … I want … so that …).**
- As P1, I want the app to **intervene at the exact time** on the tasks I flag, so that I actually start instead of
  scrolling. (R7)
- As P1, I want my important events to **sync to every device with an advance alert**, so that I never miss or
  double-book one. (R1–R3)
- As P1, I want to **log spend/meals in ≤2 taps as they happen**, so that they stop being forgotten. (R8–R9)
- As P3, I want a **missed day to be neutral**, so that one slip doesn't make me quit. (R14)

---

## 7. Requirements / Features

### 7.0 — Data & behavior model (canonical fields: `docs/core/data-model.md`)
Entities: **ImportantEvent** (date, time, title, notifyLeadMinutes, color, memo) · **TimeBlock** (date, start–end,
title, location?, `kind`, `alert` (`soft|execution`, default `execution` — D43/D45 removed D40's `none`) +
`alarmLeadMinutes` + `microStartNote` + `alertSound` (per-block) + `alertLeads` (≤3, soft only), D-1 snapshot
`snapStart/snapEnd/snapTitle/plannedAt`, `status` planned|success|fail, `failReason`) · **Expense** (timestamp,
category[8 fixed D16], amount[KRW D25], payment[free-text D26], store, name) · **MealEntry** (mealType[아침/점심/
저녁/간식], foodName, detail, kcal[manual D27], **no photo** D19) · **DayAggregate** (derived totals) ·
**User/Settings** (uid, loginId, settings{defaultLeadMinutes, sound, …}). Join keys = **uid** (owner) + **date**
(the day, device-local midnight). Client-generated ids; sync order by Firestore **`serverTimestamp()`**
last-write-wins; soft-delete tombstones (`deletedAt`). *How = data-model.md / architecture.md.*

### 7.1 — Included

> Each requirement = **what must happen + acceptance criteria (meeting them = done) + priority**. *How* is not
> specified here. The execution moment (R7) is the **already-built, validated** prototype module — reused.

**R1 — Important-events calendar.** **[P0]** A monthly calendar marks dates carrying important events; the user can
add/edit/delete an event (title, date, time, notify-lead, memo, optional color). Canceling an event **deletes** it
(soft-delete tombstone for sync); events are **not** evaluated (D5).
- *Acceptance:* month grid marks event dates (today highlighted, "+N more", swipe months, prominent quick-add);
  add/edit/delete works; a deleted event disappears on all devices; matches `spec.md §3.1`.

**R2 — Multi-device cloud sync.** **[P0]** With a logged-in account, **all** data (events, blocks + snapshots +
evaluations, expenses, meals) syncs across the user's devices; a write on one propagates to others via realtime
listeners (**last-write-wins** by serverTimestamp); Firestore's offline cache keeps the app usable offline.
- *Acceptance:* an event added on device A appears on logged-in device B within seconds; edits made offline sync on
  reconnect; a user **cannot** read another uid's data (enforced by security rules).

**R3 — Advance notification for important events.** **[P0]** Each device schedules a **local** notification at
`time − notifyLeadMinutes` (per-event lead, default if unset, D28) — **not** paid server push (D18).
- *Acceptance:* the alert fires at the right time on **every** logged-in device; when an event syncs in, that
  device schedules its own local alert.

**R4 — Account & auth (sync enabler).** **[P0]** The app is **fully usable without an account** (local); **logging
in enables sync** from that point (D20). Auth = **email + password** *and* **Google** (D12, revised by **D52**
2026-07-13 — Google is no longer "later"). Both doors end at the same `uid`; sync keys off `uid` alone.
**Kakao is deferred** (D52): Firebase Auth has no Kakao provider, and minting a Firebase custom token from a
Kakao identity needs a **server** holding a service-account key — on Firebase that is Cloud Functions → the
**Blaze plan → a billing card**, which **D10 (free only) forbids**.
- *Acceptance:* every feature works offline with **no** account; login (either door) turns sync on; logout stops
  sync but keeps local data; password is held by Firebase Auth, never in our DB.

**R5 — D-1 time-block planning.** **[P0]** Tapping a date opens that day's **time-block schedule**; blocks are
**free-form start–end intervals** (D14) with title, optional location, `kind = normal|workout|run`, and **one
alert, one of two (D40/D43)**: **알림** (a plain notification — it tells you and forces nothing; it arrives at up to
**3 moments the user chooses** (e.g. 1시간 전 · 15분 전 · 정각), D45) · **실행 알림** (the lock-screen execution cue + micro-start note).
**Default = 실행 알림** (the lever is the product — you opt *out*). **Sound is an independent per-block
choice** (default off = **vibration only**): the moment may be silent, an alert may ring. Plans are **editable on the day**, but a **D-1 snapshot** is frozen for evaluation; the alarm always
follows the **live** `start − lead` (D23). A block belongs to **one date and does not repeat**; to cover a
routine, the add screen places the same block on **several dates at once**, each an independent block (D37).
- *Acceptance:* create blocks for tomorrow; a `workout` block is marked as such; ticking N dates creates N
  independent blocks (**not** a repeat rule); editing on the day moves the live alarm but **not** the snapshot; a
  workout block marked success = the workout is done (D22, no separate activity log).

**R6 — My Day = execution cards.** **[P0]** Home shows today's blocks as **action cards** (next-up highlighted;
flagged blocks prominent); tap a card → detail; **mark done**. A **free-slot hint** appears when adding a block
(real empty gaps, so a workout lands where it'll actually happen). This is a **plan/execution-only** surface —
spend/meals are **not** shown here (D32).
- *Acceptance:* today's blocks render as cards; done can be marked; **no** expense/meal appears on this surface.

**R7 — Execution moment on flagged blocks (the heart — reuses prototype infra).** **[P0]** At `start − lead` on a
**flagged** block, the app pierces the lock screen with a **commit line** ("어제 네가 …라고 정했잖아") and the user
acknowledges ("응, 할게") and leaves. **~5 minutes later** (founder decision 2026-07-11; `[TBD]` value) the app
re-opens over the lock screen with a **re-check: "진짜 했어?"** (did you really do it?):
- **"응, 했어"** → **DONE** (one calm gold signal "안 하던 걸 해냈다"; **no confetti/streak**).
- **"아직 안 했어"** → **5·4·3·2·1 countdown** → **"지금 나가."** (pushes them out) → dismiss; the outcome stays
  **pending** (a neutral, no-guilt catch-up later — never an immediate "miss" punishment).
The commit card also carries the **micro-start** ("딱 첫 동작 — 지금 신발 신기", A2: ask for the 5-second first
move, not the task). The moment is **LIGHT** (never a dark takeover); **no in-flow "can't-today" escape** — the
commit's only response is the acknowledgement **"응, 할게"**, and the re-check's are **응 했어 / 아직 안 했어**
(neither is an escape; **the hardware Back button is a no-op** — it was a silent side door out of the
countdown). The intentional skip is the **pre-fire, re-togglable "오늘은 쉼"** per-occurrence toggle. *(This revises the prototype flow COMMIT→immediate
5·4·3·2·1→micro-start→GO; the counter-deliberation countdown now runs on the re-check's "아직 안 했어", not before
commit — see the design-principles A2 note.)*
- *Acceptance:* the moment appears **whether the phone is locked or in use** (D41); the commit fires within **±`[TBD: 1 min]`** (S2) over the lock screen under kill/Doze/reboot; a
  re-check re-opens ~5 min after commit; "응, 했어" records DONE; "아직 안 했어" runs the countdown then leaves with
  **no** immediate miss; DONE shows one calm gold mark, a miss is never red; reuses the prototype's native alarm
  module (`app/modules/lp-alarm`).

**R8 — In-the-moment expense logging.** **[P0]** A **separate 기록 (Logs)** surface logs an expense **when money is
spent**: amount, **category (8 fixed, D16)**, payment (**free-text**, D26), store, name, memo; **KRW only** (D25);
monthly total + per-day subtotals + category distribution. Port `reference/calculator.js` (fields/logic).
**Only the amount is required** — the reference app's mandatory *name* is the single biggest friction, and a
forgotten log is the problem we're solving, so a blank name falls back to the category (C2/S4).
- *Acceptance:* log an expense in **≤2 taps** + amount (**no second keyboard trip**); monthly total & category
  distribution match the reference app; entries sync; **not** shown on the plan/execution surface.

**R9 — In-the-moment meal/calorie logging.** **[P0]** The Logs surface logs a meal **when eating**: mealType
(아침/점심/저녁/간식), foodName (required), detail, **kcal (manual, D27)**; **no photo** (D19). Per-meal targets
(아침 400 / 점심 500 / 저녁 400 / 간식 200; daily 1500, D16); today's summary vs target. Port `reference/kcal.js`.
- *Acceptance:* log a meal in **≤2 taps** + a number; today's kcal-vs-target summary shows; **no** photo field
  exists; workouts/runs are **not** logged here (they are time-blocks, D22).

**R10 — Day summary (links, not merges).** **[P1]** One place shows the day's **blocks (done/miss)** and that day's
**spend / calorie totals** as **distinct sections** (day-level integration, D32) — never interleaved on one
timeline. Workout/run "done" flags are **derived** from success blocks of that kind (D22).
- *Acceptance:* the summary shows both sections without merging them into one list.

**R11 — Local-first persistence & offline.** **[P0]** All data lives locally (Firestore offline persistence = the
sole local store, D34) and survives restart/reboot; **no network is required for any feature**.
- *Acceptance:* every feature works **identically in airplane mode**; changes sync when connectivity returns.

**R12 — JSON backup export/import.** **[P1]** Manual JSON **export**, and **import** offering **merge** (add items
whose id isn't present) or **overwrite** (replace), exactly as the reference apps do (D24). Firestore stays the
live sync store; JSON is a manual backup path.
- *Acceptance:* export produces a valid JSON file; import merge/overwrite both work and re-derive scheduling; a
  corrupt/foreign file is rejected with a gentle message, changing nothing.

**R13 — Minimal settings.** **[P1]** App-level preferences: the **alarm tone** (pick from the device's tones
with preview, or follow the device default — D42; read natively at fire time; whether a given block *uses* a
tone is a per-block choice, D43) — **and a tone may never outlive the moment it belongs to (D44)**;
**default lead-time** (per-event/-block default if unset — full-app default e.g. **`[TBD: ~30 min]`**, D28);
account/sync; backup (R12); battery-optimization guidance. Settings persist and take effect on the next firing.
- *Acceptance:* the sound switch **pre-fills new blocks** and gates the tone picker (**D49** — what actually
  fires is the *block's own* flag, D43, so the switch may never silently override a per-block choice); the
  default lead pre-fills new blocks/events. **Note:** the default lead currently **ships as `0` (정각)** — R13's
  `[TBD ~30분]` is still an open founder call.

**R14 — No-guilt principle (INVIOLABLE, cross-cutting).** **[P0]** **No** streaks, consecutive-day counters,
penalties, or shame UI anywhere; a **miss is neutral** (taupe `#8B7E74`, **never red**); success is **one calm gold
signal**; returning after a miss is **frictionless** (a gentle catch-up, never a "you broke your streak").
- *Acceptance:* no streak/penalty/red-miss UI exists on any screen; a missed occurrence is shown as neutral data; a
  later return carries no barrier or guilt copy.

**R15 — Notification discipline (cross-cutting policy).** **[P0]** **Two distinct mechanisms, never conflated:**
(a) the **soft path** — important-event advance alerts **and** a block's optional 단순 알림 (D40) — a standard
**non-exact** local notification on a **quiet channel** (DEFAULT importance · no sound · lock-screen PRIVATE):
it informs, it never pierces; (b) the **execution cue** — the native **exact-alarm + full-screen** path (the
core lever, **NOT minimized**, D30). A block carries **exactly one** alert, and there are **two** of them
(`soft | execution`; **execution is the default** — you opt *out* of the lever, D43). A `soft` alert arrives at up
to **3 moments the user picks** (D45). **Sound is an independent per-block axis** — the execution moment may be
silent, a soft alert may ring (D43).
The soft tier is what **keeps the cue rare** — and therefore loud (C1/D30). Sound default off = vibration only.
- *Acceptance:* soft alerts don't pierce the lock screen (enforced by the **channel**, not by convention); the
  execution cue does — **in every state, not only when the phone is locked** (D41); the two are never disguised
  as each other; no everyday notification spam.

**R16 — First-run onboarding & permissions (enabler).** **[P0]** Explain **why** before requesting; drive the
notification / exact-alarm / full-screen-intent / battery-optimization grants; any denial falls through to a
persistent, gentle home banner (never fail silently). **Four grants gate the lever, and the banner watches all
four**: **notifications** (the cue is delivered *as* a full-screen-intent **notification** — denied kills it),
**exact-alarm**, **full-screen-intent**, and **"다른 앱 위에 표시"** (D41 — without it the moment only takes over a
**locked** screen; while the phone is in use it degrades to a banner the user must tap, which is not a cue).
- *Acceptance:* permissions are requested with rationale, not cold; a denied grant — **including notifications and
  overlay** — surfaces a one-tap banner to the right setting; the lever never fails silently, and the moment
  appears at its time **whether the phone is locked or in use**.

**R17 — Plan-vs-actual evaluation (LATER).** **[P2 / Later]** Per time-block **success/fail + free-text
failReason** (D5), evaluated against the **D-1 snapshot** (D23); a simple month rollup of executed-vs-planned and a
place that collects the failure reasons. **No** auto-suggestions, **no** quantitative dashboard (D29).
**The reason is OFFERED, never demanded** (founder, 2026-07-11 — the only way D5 and B1 can both hold): the miss
is recorded **first**, then a skippable prompt appears; **"그냥 닫기" is a first-class answer**, and a reason can
be added later from 돌아보기 instead. Nothing is ever blocked on a reason, and a missing one is never chased.
- *Acceptance:* a block is markable success/fail, **with or without** a reason; a reason can be added/edited/
  removed later; a month view shows executed vs planned counts (and how many were pre-committed at D-1); **no**
  streak, score, or suggestion appears anywhere on the screen.

**R18 — The no-guilt catch-up net (the miss half of the lever).** **[P0]** A flagged block whose moment fired
but was left unanswered, **or never fired at all** (device off, alarm never armed), must **not** silently
become a miss. On the next app open the home surface offers a **gentle prompt** — **"[제목] 아직 안 했죠"**
(it fired) / **"[제목] 놓쳤어요"** (it never did) — with **했어 / 미룸 / 나중에**. Unresolved past a window it
is **auto-archived as a neutral miss** (never chased). A miss may carry an **optional** one-line reason
(R17). Outcomes record their **source** (`execution-screen` / `catch-up` / `pre-skip`) so **S1 counts only what
the moment itself produced** — a catch-up "했어" is a real win but not the lever's proof.
- *Acceptance:* an unanswered/never-fired occurrence appears as a gentle prompt on the next open, never as an
  immediate miss; resolving it records the outcome with `source = catch-up`; dismissing ("나중에") re-shows it on
  a later open; nothing anywhere scolds. Constants (recorded, not guessed): catch-up window **7 days**,
  never-fired reconstruction lookback **30 days**.

### 7.2 — Excluded (deliberately not built now)
- **Kakao login** (D52 — needs a server to mint a Firebase custom token; the Blaze plan a server implies breaks
  D10's free-only rule). *Google login is now **included**, not excluded — D52 revises D12.* **Quantitative evaluation dashboards / auto
  adjustment** (D29 — evaluation is binary + reason only). **Meal photos** (D19 — would need paid Cloud Storage).
  **Multi-user sharing / collaboration** (single-user, D3). **iOS** (Android-first, D1; iOS lock-screen takeover is
  OS-limited). **Barcode / calorie-DB lookup** (manual only, D27). **Streak counters / penalties / stakes /
  body-double / aggressive auto-scheduling** (backfire — F4/D1). **P1 opt-in levers deferred:** geofence trigger,
  <2s logging widgets (Quick-Settings/NFC/Shortcuts), capacity-aware free-slot *suggestion*, 출발/도착 인증,
  temptation bundling (all `docs/research/features/execution-integrated-day.md` §4 P1). **Business model /
  monetization** (open-questions Q10 — non-blocking; today = personal + free).

---

## 8. Design Considerations (principle level — visual design is separate)

Governing principles (`docs/core/design-principles.md`; tie-breaker order there is decisive):
- **A — Make execution happen.** Put the intervention exactly where the plan dies; ask for the **5-second first
  move**, not the whole task; design the moment for the **depleted evening self** (one-tap, no decisions, no typing).
- **B — Protect the person (inviolable).** **Never punish a miss** (B1); the app speaks as **"어제의 나"** (yesterday's
  me), not a boss (B2) — calm, adult, no mascots/shame.
- **C — Stay light.** **One loud thing** — only the flagged execution cue pierces; everything else is quiet/opt-in
  (C1). If the tool outweighs the act, it dies — reuse familiar conventions (calendar/budget/calorie), spend the
  design budget on the moment (C2).
- **D — Optimize for real-world action, not screen-time** (D1).
- **Product cautions (CLAUDE.md):** execution moment is **light**; **no in-flow "can't today" escape** (only
  pre-fire 오늘은 쉼); **no guilt** (miss = taupe, never red; one calm gold DONE, no confetti); the exact-time cue is
  the core lever, deliberately **not** minimized.
- **Two surfaces (D32):** plan/execution (calendar + My Day) vs in-the-moment logs (spend/meal) are separate; the
  day summary **links** them, never merges.
- **Design system:** tokens in `docs/core/design-system.md` — the skin is **LOCKED to v5 "Toss-form"** (blue/gold,
  **D39**, 2026-07-11); D36's forest/gold *colors* are superseded (its no-guilt *semantics* — calm gold DONE, taupe
  miss, never red — survive unchanged). Every screen, **including the native execution moment**, is on v5.
- **Beyond-PRD (per instructions.md):** IA + full-app user-flows, per-screen states (초기/입력중/유효/무효/에러/로딩)
  and transitions, business rules, and exception/recovery paths are authored at each screen's build phase
  (`implementation-plan.md`); the prototype's `user-flows.md` is the template.

---

## 9. System Requirements (What-level non-functional — no How)

- **Platform:** Android-first (D1); iOS later. Personal, single-user.
- **Offline-first:** usable with no connectivity; syncs when available (R11).
- **Reliability:** the execution cue is the make-or-break path; target fire within **±`[TBD: 1 min]`** under
  kill/Doze/reboot — 100% is impossible (OEM battery killers), so defense-in-depth + self-healing is required
  (architecture §11: setAlarmClock + WorkManager backup + boot/timezone re-register + app-open catch-up).
- **Free only (D10):** free tiers / FOSS only — Firebase **Spark** (no billing card); local notifications (no push
  server); **no photos** (avoids paid Cloud Storage, D19); no Cloud Functions.
- **Data portability:** JSON export/import (R12).
- **Stack (What-level; How = architecture.md):** RN + Expo **Dev Build** + a **thin custom Kotlin alarm module** +
  Firebase (Firestore + Auth) on a thick-client/BaaS, local-first topology (D34). Reuses the validated prototype.

---

## 10. Assumptions, Constraints & Dependencies

**Assumptions under test (the real hypotheses):**
- **A1 — Efficacy.** A gentle execution prompt (commit + micro-start) meaningfully raises follow-through over a
  plain reminder — *the whole differentiator*. Directional evidence is encouraging (implementation intentions
  d≈0.65; just-in-time prompts move exercise) but honest limits: II helps the *motivated-but-can't-execute* most,
  is weaker for low motivation, and app-administered is weaker than person-to-person; effect is small-to-medium
  (gap shrinks, not closes). **Only the self-experiment settles it** (S1/falsification).
- **A2 — Adoption of D-1 planning.** The user will actually create next-day time-block plans once it's fast +
  integrated — **not a current habit** (S3, the biggest non-technical risk).
- **A3 — Logging friction.** ≤2-tap logging removes enough friction that spend/calories stop being forgotten (S4).

**Constraints:**
- **Free-tier only (D10):** Firebase Spark limits (≈50k reads / 20k writes / day, 1 GB) far exceed personal use;
  **cost cliff at scale** (~$10/mo @5k DAU, ~$300/mo @100k) — kept low by local-first + scoped listeners + no
  photos; this is Q10 (non-blocking for the personal app).
- **Android OS reality:** exact-alarm permission (A12+) + Doze + **OEM background killers** → per-second all-device
  guarantee is impossible; **full-screen-intent** is default-granted only to call/alarm apps on A14+ → fine for the
  personal build, **gated at public release** (declare alarm-core in Play Console or graceful heads-up fallback).
- **No paid infra:** no server push, no Cloud Storage/Functions.

**Dependencies:**
- The **validated trigger prototype** (`app/` + `docs/research/prototype/PROTOTYPE-STATE.md`) — R7 reuses its native
  alarm module and execution moment unchanged.
- **Firebase** (Firestore/Auth, Spark) for sync; **reference apps** `reference/calculator.js` (budget) &
  `reference/kcal.js` (calorie) as the port source for R8/R9 (their full field/screen inventory =
  `docs/research/reference-apps.md`, the migration spec).
- Android OS alarm/full-screen-intent/boot behavior; `expo-notifications` for advance alerts.

---

## 11. Release & Experiment Plan

- **Build sequence:** `docs/research/implementation-plan.md` — **F0** backend (Auth + Firestore repos behind the
  existing Repository interface + rules + prototype→full-app storage cutover) → **F1** calendar (R1–R3) → **F2**
  time-blocks + reuse execution (R5–R7) → **F3** logs, porting the reference apps (R8–R9) → **F4** day summary
  (R10) → **F5** evaluation (R17, Later). Each phase has a Definition of Done; nothing changes the validated
  execution lever.
- **Experiment:** the **founder self-experiment** is the validation — instrument S1–S5 (free Firebase Analytics),
  watch **S3 (D-1 adoption)** and **S1 (execution rate)** especially, and apply the **falsification condition**
  honestly. `[TBD]` targets/constants are set from real runs.
- **Deployment:** sideload → Google Play (one-time $25) when ready; iOS later (D1).

---

*This PRD is the **yardstick**: a feature or change is "right" only if it serves the goals (§3) and passes the
relevant requirement's acceptance criteria (§7) without violating the inviolable no-guilt principles (§8). When in
doubt, re-read §2 (why) and R7/R14 (the heart).*
