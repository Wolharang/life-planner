# PRD — LifePlanner Trigger Prototype (MVP)

> **📦 ARCHIVED (2026-07-10).** The trigger prototype is **built and validated**; this PRD is kept as the
> record of that completed sub-phase. The **active full-app product truth is now `docs/core/service-overview.md`
> + `docs/core/spec.md`.** Prototype state snapshot: `docs/research/prototype/PROTOTYPE-STATE.md`.

> **This document's role.** This PRD is the single canonical source of **What** the product must do and **Why**
> — the guardrail an implementer (human or AI) checks at every "is this the right direction?" moment. It does
> **not** specify **How** (tech stack, APIs, data schema, frameworks); the How lives in
> `docs/core/architecture.md`, `docs/core/data-model.md`, and `docs/research/tech-feasibility.md`. Where this PRD
> and those documents disagree about *what the product should do*, **this PRD wins**.
>
> **Scope = the trigger prototype only.** The full "integrated day" (calendar, budget, calorie, multi-device
> sync, plan-vs-actual evaluation) is the phase *after* this prototype succeeds; its design materials are
> preserved under `docs/research/` (post-prototype).
>
> **Instruction to an implementing AI agent.** This document is written to be **self-contained**: you should be
> able to build the prototype's *purpose* from this file alone, without reading the rest of the repository or any
> prior conversation. Every requirement (R1–R8) carries **acceptance criteria** — meeting them means "done."
> Placeholders marked `[TBD]` are deliberately unset (numeric targets and a few timing values); **do not invent
> values** — leave them and flag them.
>
> **Language note.** This document is in **English**. The app's end user is Korean and single (the founder), so
> **all UI copy the app displays is in Korean**. Korean UI strings below are quoted verbatim with an English gloss
> in parentheses **for this document's readers only** — implement the Korean string, not the gloss.

---

## 1. Title & Change History

- **Product (working title):** LifePlanner — a **no-guilt execution engine** (a tool that, without nagging or
  inducing guilt, helps the user *actually execute* a plan — not merely track or remind).
- **Document:** Trigger-Prototype PRD · **version v0.3** · 2026-07-08 · status: **draft (canonical)**.
- **Authoring context:** the convergence of the full pre-work (problem validation → 3 personas → differentiation
  → HMW → solution S2 → architecture / data / tech-feasibility → repeated audits). This PRD deliberately carves
  off **only the most uncertain and most important piece — the execution lever** — to validate it in minimal form.

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-07-08 | Initial draft, trigger-prototype scope (Korean). |
| v0.2 | 2026-07-08 | Rewritten in English; behavior-complete + fully self-contained (exact UI copy, R3 state machine, acceptance criteria). |
| v0.3 | 2026-07-08 | Review-driven revision (3-lens adversarial audit). Closed core-loop gaps: defined the PENDING leaf & reconciled it with catch-up; specified R3 timing/timeouts; added the home/list surface & a minimal outcome-history view; made the commit line time-accurate (no hardcoded "어제"); added an outcome **source** so the core metric S2 is measurable. Encoded user decisions: lead default 0 with presets {정각/15/30/60분/custom} **+ a separate multi-offset plain-reminder layer**; the "can't today" opt-out **moved to after the countdown**; **simple daily/weekly recurrence**; **sound supported, default haptic-only**. Added a minimal settings requirement (R8) and a pre-commitment validity guard. |
| v0.4 | 2026-07-09 | User-flow re-check (`docs/research/prototype/user-flows.md`), design-level only: 할 일 추가 screen **defaults execution-alarm ON** (data default stays false); required = time + title; first-run **permission onboarding** (explain → request → graceful-denial banner). §8 updated. |
| v0.5 | 2026-07-09 | Implementation-feedback correction (founder, on the running R3 screen). (1) The execution moment is **LIGHT, not dark** — the earlier "dark execution world" contradicted repeated founder direction and is dropped (design-system + tokens corrected). (2) **No in-flow "오늘은 못 해"**: an intentional skip is a **pre-fire, re-togglable "오늘은 쉼"** per-occurrence toggle (R1); once fired, only 응/아직 (restores the founder's original PRD intent). (3) **MICRO-START + CONFIRM merged** onto one surface (removes the "했어 →"→"시작했어?" redundancy). R3 table, R1, §8, 7.1.0 outcome updated; adds `skipped`. |
| v0.6 | 2026-07-09 | R3 refinement (founder, on the light R3 screen): the micro-start (e.g. 신발 신기) **isn't the goal** — added a brief **GO propulsion beat** ("이제 그대로 나가.") between CONFIRM-응 and DONE, so the flow pushes the user to actually go *before* the calm "해냈다". R3 state 4 added; acceptance updated. |

---

## 2. Background & Context

**The essential problem = the intention–action gap.** People know what they want to do yet, *at the moment*, do
not do it. This is **a structure problem, not a motivation problem**: the will is already there ("I want to work
out"); what is missing is the **structure** that ties the action to a fixed moment. The heart of the product is a
single thing — **crossing "the 10 minutes between plan and execution."**

**Why build the trigger first.** The whole product (calendar, budget, calorie, evaluation) has exactly one heart:
*making the user actually do the pre-planned task at the moment* (the execution engine). Every other feature has
value **only if this lever actually works.** So before building the integrated day, we validate the **biggest
uncertainty — the execution lever — in minimal form.** (An MVP here is a **Build–Measure–Learn instrument**, not a
finished product.)

**Evidence already gathered (summary; deeper sources preserved under `docs/research/`):**
- The founder's own "gym-at-lunch" case: with a task fixed to an exact time the day before, the reminder fires and
  — after ~10 minutes of hesitation — they *actually go*.
- **Implementation intentions** (pre-committing *when/where/how* an action happens, i.e. an if-then plan tied to a
  situational cue) raise follow-through with a **meta-analytic effect size d ≈ 0.65** (a "medium-to-large" effect;
  Gollwitzer & Sheeran 2006, 94 studies) — and the effect is **stronger, not weaker, for people who struggle with
  self-regulation.**
- Market signals: ~67% of gym memberships go unused; ~90% of habit-app users churn within 30 days. "People who
  resolve but don't do it" are everywhere.
- **Honest caveats (do not over-read results):** (a) an app-delivered self-administered prompt is **weaker than a
  human intervention**, so the *realized* effect is **small-to-medium — below the d ≈ 0.65 lab figure — not
  magic**; (b) the effect is **motivation-dependent**: if baseline motivation is near-zero, no prompt moves the
  person (this makes P1 — "motivated but can't act" — favorable, and a near-zero-motivation day a risk). A null
  result must therefore be read against these preconditions, not only as "the lever failed."

**The one question this prototype answers:**
> *"For a task I set the night before (especially exercise), if — at the set time — the app breaks through the
> lock screen and briefly intervenes, do I (P1) actually **start** the thing I would normally skip?"*

---

## 3. Goals & Overview

**One sentence (prototype edition):**
> *"A minimal app that, at a time you set the night before, **breaks through the lock screen and briefly
> intervenes** to make you **actually start** the task."*

**Goals.**
- (a) **Intervene reliably** at the set time — even when the phone is locked, idle in power-save, or was rebooted.
- (b) **Collapse the initiation threshold** via **commit framing → 5·4·3·2·1 → micro-start**.
- (c) **Record the outcome without guilt** (done / miss; a miss is data, not failure).
- (d) **Observe and measure** whether this lever actually changes the founder's behavior — via a **minimal in-app
  outcome history** (R4/§7.1) that shows past occurrences and their done/miss result. (This is a plain list, **not**
  an analytics dashboard — dashboards remain out of scope, §7.2.)

**Non-goals (in this prototype).** The integrated day, multi-device sync, statistics/dashboards, and polished
visual design are **out** — all belong to the next phase. (Full exclusion list in §7.2.)

**Glossary of coined terms** (used throughout):
- **Execution moment / execution lever** — the at-the-set-time lock-screen intervention that makes the user start (R3).
- **Commit framing** — reminding the user the task is **a promise *they themselves* made earlier**, not an external order.
- **5·4·3·2·1** — Mel Robbins' "5-second rule": count down and *move* before the procrastinating brain intervenes.
- **Micro-start** — reduce the task to a single 5-second first physical action (e.g. "put your shoes on now"),
  so the threshold to begin collapses.
- **No-guilt** — no streaks, no penalties, no shame UI; a miss is recorded plainly as data.
- **Plain reminder** — a *soft* heads-up notification (no lock-screen takeover), distinct from the execution moment;
  a task may have several at different offsets. It is a convenience, **not** the lever being tested.

---

## 4. Success Metrics (observable behavior · targets are placeholders)

> Metrics are defined as **observable, measurable behavior**, not feelings. Target numbers marked `[TBD]` are
> calibrated *with* the prototype; do not invent them.

- **S1 — Technical reliability.** The **execution intervention** fires **within ±`[TBD: provisionally 1 minute]`**
  of its effective time, even when the app is killed, the screen is locked, the device is in power-save (long
  idle), and **after a reboot**. (Soft *plain reminders* are best-effort and not held to this bar.)
- **S2 — Initiation rate (core).** Of flagged occurrences, the **share marked `done` from the execution screen
  itself (source = R3)** ≥ `[TBD]`. **Catch-up `done` (source = R6) is reported separately, not counted in S2** —
  a catch-up `done` means the in-the-moment lever did *not* catch the user, so folding it in would overstate the
  lever.
- **S3 — The founder's own behavior change.** Over `[TBD]` weeks of use, the normally-skipped target behavior
  (e.g. exercise) **increases vs a pre-prototype baseline** (baseline = the count of that behavior in the last
  `[TBD]` weeks *without* the prototype, measured before starting).
- **S4 — No-guilt return.** After a missed occurrence, the user **executes the next occurrence** (returns without a
  "what-the-hell" collapse).
- **Falsification condition.** If over `[TBD]` weeks S1/S2/S3 fall short of target, treat it as **"the lever does
  not work (in this form)"** → redesign the lever or reconsider direction. (The prototype is allowed to *fail*;
  that is a valid, valuable result. Read a null against the §2 preconditions before concluding.)
- **Anti-metric (deliberately NOT optimized).** No streak / consecutive-success counter as a success metric.

---

## 5. Personas

- **P1 — Primary (the founder; the prototype is validated on this person).** A planning-type student who *enjoys
  planning precisely* but, alone in the evening, loses to fatigue and cannot start what they planned — the failure
  happens **at the exact moment of initiation** (a ~10-minute gap between "I should" and "I did"). Signature story:
  plans an evening gym block; the reminder fires; thinks *"아 맞다 가야하는데… 꼭 가야 할까… 그래도 가야지, 기록까지
  해놨는데"* ("oh right, I should go… must I?… fine, I'll go, I even logged it") and leaves ~10 minutes late but
  *does* go. **Does not currently pre-plan the next day** (the biggest adoption risk). This prototype exists to
  prove the lever on P1.
- **P2 — Context only (not a prototype target).** Loses external structure (job-seeker / freelancer / student on
  break) and pours the day into SNS / short-form video with no output — breaks **at the plan stage** (never plans).
- **P3 — Context only (not a prototype target).** The New-Year gym registrant who goes a few days, misses one,
  then quits in a "what-the-hell" collapse (one slip → total abandonment) and repeats yearly. Breaks **at the exact
  moment like P1**, plus **relapse**. **P1 ≈ P3** (both have the goal but can't initiate/sustain), so a lever that
  works for P1 extends to P3.
- **Anti-persona.** Someone who executes spontaneously without any planning; and someone content using separate
  best-in-class calendar / budget / calorie apps.

---

## 6. User Scenarios / Stories

**Scenario A — happy path (recurring exercise).** The night before, P1 creates a task **"21:00 헬스"** ("21:00
gym"), turns the **execution alarm on**, picks a **30-minute lead** from the presets, sets **recurrence = 매일**
(daily), and adds the micro-start note **"지금 신발 신기"** ("put your shoes on now"). (They could also add a soft
**plain reminder** 1 hour before; and leave sound off — vibration only, the default.) The next day at **20:30** the
phone vibrates and a full-screen surface appears **over the lock screen**: **"어제 네가 21:00 헬스라고 정했잖아."**
("Yesterday you decided on 21:00 gym.") → a **5·4·3·2·1** countdown → **"지금 신발 신기"** → **"시작했어?"** ("Did
you start?") → P1 taps yes → a plain signal: **"안 하던 걸 해냈다."** ("You did the thing you usually skip.") Because
the task recurs daily, the same cue returns tomorrow.

**Scenario B — miss → return.** One evening P1 does not execute — at "시작했어?" taps **"오늘은 못 해"** (or lets it
lapse). The app induces **no self-blame** (miss = data). The next day's occurrence arrives, and this time P1
executes. (This is the behavior S4 measures.)

**Scenario C — reliability.** P1 locks the phone and leaves it idle for hours (power-save); the execution
intervention still fires on time. P1 **reboots** the phone; scheduled occurrences persist and still fire. If the
phone was off at the fire time, P1 sees a gentle catch-up prompt on next open (R6).

**User stories.**
- *As P1, I want* to fix a task with an exact time in advance, *so that* the app can catch me at that moment.
- *As P1, I want* a lock-screen-piercing intervention at the set time, *so that* I move before my procrastinating
  brain talks me out of it.
- *As P1, I want* not to be blamed on days I miss, *so that* I return the next day instead of giving up.

---

## 7. Requirements / Features (Included / Excluded)

> Each requirement = **what must happen + acceptance criteria (meeting them = done)**. *How* is not specified here.

### 7.1 Included (the entirety of this prototype)

**7.1.0 The data the prototype handles (behavior level, not storage schema).**
A **task** — the prototype's unit — consists of:
- **set time** — a specific wall-clock time (interpreted in the device's local time). With recurrence, it applies
  to each occurrence's date.
- **title** — short text (e.g. "헬스"); shown in the commit line and lists.
- **micro-start note** — optional short text (e.g. "지금 신발 신기"); shown at the micro-start step.
- **execution alarm** — on/off. Only tasks with this ON get the R2/R3 lock-screen intervention.
  - **lead** — how far before *set time* the execution fires. **Default 0 (fire at the set time)** when unset. When
    the user sets it, offer presets **{정각 (at time) · 15분 전 · 30분 전 · 1시간 전 · 사용자 지정 (custom)}**. The
    effective fire time = *set time − lead*.
- **plain reminders** — optional, **multi-select** soft heads-up notification(s) at any of **{정각 · 15분 전 ·
  30분 전 · 1시간 전 · 사용자 지정}** (choose several). These are *soft* (no lock-screen takeover), distinct from the
  execution alarm; a task may have both.
- **recurrence** — **없음 (none) · 매일 (daily) · 매주 (weekly)**. A recurring task produces one **occurrence** per
  repeat date; interventions and outcomes are per occurrence.
- **outcome** (per occurrence) — one of `pending` / `done` / `miss` / `skipped`, plus **source**
  (`execution-screen` = R3, `catch-up` = R6, or `pre-skip` = the R1 "오늘은 쉼" toggle) and a timestamp. (`skipped` =
  turned off in advance; distinct from `miss`, equally guilt-free.)

*Behavior-to-schema note:* `pending / done / miss` ≙ data-model `planned / success / fail`; the prototype "task"
maps to the data model's TimeBlock (its `end` and `kind` are unused here). Storage is defined in `data-model.md`;
this PRD defines only what each feature reads/writes.

**R1 — Task setup & the home list.** The user can create, edit, and delete a task (fields in 7.1.0) from a simple
**home list surface** — the prototype's only home.
- **Home list sub-spec.** The list shows **upcoming occurrences first**, then a **recent-history section** of past
  occurrences with their outcome. Each row shows: **title · effective time · execution-alarm on/off · recurrence
  marker · outcome badge** (`pending`/`done`/`miss`/`skipped`, for past rows). Each **upcoming** occurrence also
  carries a **"오늘은 쉼" (skip-today) toggle** — a pre-fire, **re-togglable** switch that suppresses *only that
  occurrence's* execution intervention. It is the **sole** intentional-skip path (there is no in-flow escape — R3).
  There is a prominent **create** action; empty
  state invites the first task. Past `done`/`miss` occurrences are visible here (this doubles as the §3(d)
  observation surface).
- *Acceptance:* Creating a task persists it (survives app restart **and** device reboot) and records its **creation
  time**. Editing the set time / lead **moves the intervention to the new effective time** (the intervention always
  follows the task's *current* effective time). Deleting a task removes it **and cancels any pending intervention
  and plain reminders** (no ghost alarm). Only tasks with **execution alarm ON** get the R2/R3 intervention. A task
  whose **set time** is in the past is rejected with a clear message — **"이미 지난 시각이에요."** ("That time has
  already passed."). If a lead pushes the **effective** time into the past while the set time is still future, the
  execution fires **as soon as possible** (immediately). Toggling **"오늘은 쉼"** on before the effective time makes
  that occurrence **not fire** (recorded `skipped`, no guilt); toggling it off again before fire **restores** the
  intervention. The home list's row content, ordering, and outcome badges are all present and correct.

**R2 — Firing (the core risk).** For a task with execution alarm ON, the **execution intervention must fire at its
effective time** for **each occurrence**, regardless of device state; any **plain reminders** fire (softly) at
their offsets.
- *Acceptance:* The execution intervention fires **within ±`[TBD: provisionally 1 minute]`** of the effective time,
  measured with the screen **locked and the device idle (power-save)**; fires when the **app has been killed**;
  **survives reboot** (occurrences scheduled before a reboot still fire after). If the device is powered **off** at
  the effective time, the miss is caught by R6. **Plain reminders** appear at their chosen offsets as ordinary
  (soft, dismissible) notifications — best-effort, not held to the ±tolerance. If **two execution occurrences share
  an effective time**, they are shown **one at a time** (queued sequentially), never stacked over the lock screen.
  *(The OS mechanism is specified in `architecture.md` / `tech-feasibility.md`; this PRD requires only the behavior.)*

**R3 — The lock-screen execution moment (the heart of the product).** When a flagged occurrence fires, **without
requiring the phone to be unlocked**, a full-screen surface runs the following sequence. Exact copy, states, and
timing:

| # | State | What the user sees / feels | Exact UI copy (Korean; gloss) | Transition out |
|---|---|---|---|---|
| 0 | **FIRING** | Full-screen surface launches over the lock screen; a haptic pulse. **Sound only if the sound setting is on** (default off — R8). | — | immediately → COMMIT |
| 1 | **COMMIT** | The commit line (reflects the occurrence's real title & set time), framed as the user's own prior promise. **Single** forward action — no opt-out here (so the 5-second rule runs before any escape). | line (time-accurate, see below); **"시작할게"** (I'll start) | button → COUNTDOWN · idle `[TBD: ~30s]` → PENDING |
| 2 | **COUNTDOWN** | Large **5 → 4 → 3 → 2 → 1**, auto-advancing (~1 s each), a light haptic tick per number. | **"5 · 4 · 3 · 2 · 1"** | auto → MICRO-START |
| 3 | **MICRO-START + CONFIRM** (merged) | The single first physical action shown **with** the one light check on the same surface (BeReal-style). **No in-flow escape** — the only intentional skip is the *pre-fire* "오늘은 쉼" toggle (R1), never here. | note (e.g. **"지금 신발 신기"**) or default **"딱 첫 동작만 — 지금 일어나기"** · **"시작했어?"** (Did you start?) · **"응, 시작했어"** (Yes) · **"아직"** (Not yet) | "응…" → GO · "아직" or auto `[TBD: ~60s]` → PENDING |
| 4 | **GO** (propulsion) | The first move (e.g. shoes on) is **not** the goal — a brief push to **actually go / do it** before the calm close (shoes-on ≠ done). Forward-only, no escape. | **"이제 그대로 나가."** (Now head straight out.) · **"여기서 멈추면 아까워."** (Don't waste it by stopping here.) | tap / auto `[TBD: ~3s]` → DONE |
| — | **DONE** (terminal) | One calm competence signal. **No** streak, score, or confetti. Dismiss. | **"안 하던 걸 해냈다."** (You did the thing you usually skip.) | dismiss |
| — | **PENDING** (leaf) | The surface simply dismisses — **no further screen, no auto re-fire** (there is no snooze; §7.2). The occurrence stays `pending` and is surfaced later by catch-up (R6). | — | dismiss |
| — | **(SKIP — not an in-flow state)** | An occurrence the user turned off **in advance** via the "오늘은 쉼" toggle (R1, re-togglable) simply **never fires**, recorded `skipped` (no guilt). The only *after-the-fact* miss is catch-up auto-archive (R6, `miss`). There is **no** in-flow miss button. | (pre-fire toggle) | — |

- **Commit line — time-accurate (no hardcoded "어제").** It names the occurrence's set time + title and refers to
  **when the task was actually created**: created the prior day → **"어제 네가 [21:00 헬스]라고 정했잖아"**; created
  earlier today → **"아까 네가 [21:00 헬스]라고 정했잖아"**; created several days/weeks earlier → **"[지난주 / N일 전]에
  네가 [21:00 헬스] 하기로 정했잖아"**; if uncertain, the neutral **"네가 [21:00 헬스] 하기로 정해뒀잖아"**. It must never
  say "어제" for a task not created the day before.
- *Acceptance:* The surface appears over the lock screen **fully interactive within `[TBD: provisionally 1 s]`** of
  firing (this render bound is separate from S1's fire-time tolerance). The COMMIT line shows the occurrence's
  **actual title and set time** and is time-accurate per the rule above. COUNTDOWN → MICRO-START+CONFIRM → **GO** →
  DONE runs **uninterrupted**, with **no in-flow escape** — an intentional skip is the pre-fire "오늘은 쉼" toggle
  (R1), never a mid-flow button. Every state has a defined exit including its idle/auto-timeout landing (COMMIT idle
  → PENDING; MICRO-START+CONFIRM auto → PENDING; GO auto → DONE). Success shows **no** streak/score/celebration; a
  skip/miss shows **no** negative-emotion UI.

**R4 — Outcome recording (no-guilt).** Each occurrence is recorded as **`done` / `miss` / `pending`** with its
**source** (`execution-screen` R3 or `catch-up` R6). Success is the single plain competence signal; a miss is
recorded plainly (miss = data).
- *Acceptance:* The outcome + source + timestamp persist, tied to the occurrence and its date, and appear in the
  home history (R1). The success view has no exaggerated celebration/score/streak; the miss view has no
  guilt-inducing UI. (A free-text "reason for miss" is **excluded** — deferred to the evaluation loop, §7.2.)

**R5 — Local persistence (offline).** Tasks, occurrences, outcomes, and settings are stored **on-device** and
survive app restart and reboot. **No network, account, or cloud is required for any feature.**
- *Acceptance:* Every feature works **identically in airplane mode / fully offline**; there is **no login or
  account** anywhere.

**R6 — Missed / not-done catch-up (reliability + honesty net).** The next time the user opens the app, any
**occurrence whose effective time has passed while still `pending`** is surfaced gently — **whether the
intervention never fired (e.g. device off) OR it fired and the user deferred/abandoned it** (the "아직"/timeout
path). The two cases use **different, both-gentle** copy:
- never fired → **"[제목] 놓쳤어요 — 지금이라도?"** ("Missed [title] — do it now anyway?")
- fired but not done → **"[제목], 아직 안 했죠 — 지금 할까요?"** ("[title] — not done yet; do it now?")
- *Acceptance:* On next launch, each unresolved past-due occurrence shows the correct catch-up prompt, from which
  the user can mark `done`/`miss` (recorded with source = `catch-up`). The prompt is **dismissible**; if dismissed
  without choosing, it may reappear on a later launch but **shows at most once per app open** (no nagging, no
  counter — R7). An occurrence still unresolved after `[TBD: provisionally 7 days]` is auto-archived as `miss`.

**R7 — No-guilt principle (cross-cutting requirement).** Across the **entire app** there are **no streaks, no
consecutive-success counters, no penalties, and no guilt-inducing UI.**
- *Acceptance:* No screen shows "N일 연속" (streak), reset warnings, or nagging/scolding copy. Returning after a
  miss is frictionless, and the catch-up net (R6) never scolds.

**R8 — Minimal settings.** A small settings surface holds app-level preferences.
- **sound** — on / **off (default)**: when on, the execution moment (R3 FIRING) also plays an audible alarm tone;
  when off, it is haptic-only. (Plain reminders follow ordinary notification behavior.)
- *Acceptance:* The sound setting persists and takes effect on the next firing; with sound off, the intervention is
  vibration-only. (Any additional preference, e.g. a personal default lead, is optional and local.)

### 7.2 Excluded (not this prototype = preserved as next-phase material)

Deliberately **not built** (value comes only after the lever is validated; materials under `docs/research/`):
the important-events **calendar / month view** · **multi-device cloud sync** · **account / login** · **budget
(spending)** · **calorie / meal** · **plan-vs-actual evaluation dashboard / success-rate export / fail-reason
collection** · **geofence** · **widget** · **quick-settings tile** · **free-slot suggestion** · **departure/arrival
verification** · **precommitment / stakes** · **social / body-double** · **multi-user** · **photos** · **iOS** ·
**snooze / re-fire of the execution cue** (the catch-up net R6 covers "was busy at the time") · **statistics
dashboards** (the plain outcome history in R1 is not a dashboard). *(Note: the excluded item is the calendar
month-view surface; per-task **plain reminders** in R1 are in scope.)*

---

## 8. Design Considerations (principle level — visual design is separate)

- **Commit tone.** Remind the user it is **their own earlier promise**, not an external command. Calm and
  **adult** — never nagging or childish. The commit line is always time-accurate (never a false "어제").
- **No-guilt.** Plant **no negative emotion** on a miss. There is **no in-flow "can't today" escape** — an
  intentional skip is a **pre-fire, re-togglable "오늘은 쉼"** per-occurrence switch (R1), so once the moment fires the
  only responses are 응/아직. Success is a **plain competence signal**, not loud celebration. The catch-up net is gentle.
- **Low-friction & immediacy.** Split initiation into a **single 5-second first action** (micro-start). "시작했어?"
  asks **once, lightly, then disappears.** The execution surface appears **fast** (render bound, R3).
- **Two alert intensities, not spam.** The **execution moment** (lock-screen takeover) fires only on the few
  flagged occurrences, at the pre-committed time — the core lever, deliberately not minimized. **Plain reminders**
  are ordinary soft notifications the user opts into per task; keep them unobtrusive.
- **Sound is opt-in.** Default is vibration-only; sound is a user setting (R8), so the app is quiet by default.
- **Add-screen default (user-flow re-check).** The 할 일 추가 (task-add) screen presents the **execution-alarm toggle
  ON by default** — the prototype's point is the execution cue, so a task must not be *accidentally* created with no
  intervention. (The *data* default stays `false`, 7.1.0 / R8; this is only the ADD UI's initial selection.) Required
  fields = **time + title only**; lead / note / plain reminders / recurrence are collapsed, keeping setup light for
  the depleted-state user.
- **Onboarding & permissions (user-flow re-check).** The lever dies silently if the OS exact-alarm / full-screen
  permission is denied. So first-run **explains *why* before requesting** ("정한 시각에 잠금화면을 뚫으려면…"), and on
  denial the app **never fails silently** — a persistent home banner + one-tap to settings. Onboarding teaches only
  the four novel mechanics.
- **Accessibility.** Consider screen readers, font scaling, and color contrast.

---

## 9. System Requirements (What-level non-functional requirements — no How)

- **Platform:** Android (primary). iOS is out of scope.
- **Fully offline / on-device:** every feature (tasks, occurrences, outcomes, settings) works with no network,
  account, or cloud.
- **Reliability:** the execution intervention withstands **lock / power-save / reboot** and fires within
  ±`[TBD]` of the effective time (= R2 / S1).
- **Cost:** **free.** No paid services or subscriptions.
- **Scope:** single user (the founder), a personal device, local data only.
- *(How these are achieved is decided by `architecture.md` / `tech-feasibility.md` — this PRD does not dictate the
  implementation.)*

---

## 10. Assumptions, Constraints & Dependencies

- **Assumptions (under test):**
  - **A1 (core hypothesis).** The set-time intervention (commit + 5·4·3·2·1 + micro-start) **meaningfully raises
    actual initiation over a plain reminder.** ← precisely what the prototype exists to prove or disprove.
  - **A2 (behavioral premise).** The user **actually pre-sets tasks in advance** (and, being recurring, keeps them
    running). If this does not happen there is nothing to intervene on → an **observation point** (the largest
    adoption risk for the next phase).
- **Validity guard (why the result is trustworthy).** The lever under test is *implementation intentions* — an
  action **pre-bound in advance**. So the prototype **records each task's creation time** and the **gap between
  commitment and firing**; an occurrence created moments before it fires is **not** a genuine pre-commitment, and
  such cases are flagged when reading S2/S3 so a well-timed last-minute reminder is not mistaken for the lever.
- **Constraints:** free only · Android · personal / local · **execution-lever focus** (build nothing from the §7.2
  exclusion list; keep recurrence/reminders/settings minimal).
- **Dependency:** **the device/OS's exact-alarm reliability** — the prototype's **biggest risk and core validation
  target**, subject to OEM power-save policies (hence the safety net R6 and the metric S1).

---

*If this prototype passes S1–S3, it expands into the full "integrated day" app (direction materials under
`docs/research/`). If it fails, the lever is redesigned or the direction reconsidered. **This PRD is the yardstick
for that judgment.***
