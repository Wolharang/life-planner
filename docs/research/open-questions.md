# LifePlanner — Open Questions

> Unresolved questions to settle before/while building. Move items to `docs/core/decisions.md` once decided.
> Written in English; user-facing answers in Korean.

## Constraint reminder: zero paid services

Everything must run on **free tiers only** — no paid cloud, no paid subscriptions, no billed services.
All questions below are constrained by this (see docs/core/decisions.md D10).

## Q1. Tech stack — RESOLVED: React Native + Expo (docs/core/decisions.md D11)

Confirmed 2026-07-06 after evaluating Flutter, React Native/Expo, and Kotlin/Jetpack Compose across
performance, polish, notifications, developer experience, and AI-assisted coding. **React Native + Expo**
was chosen (least code-to-write via reference-app reuse + npm; strongest AI-assisted coding in TS/JS; fastest
solo iteration; sufficient polish/notification capability; keeps iOS optional). Flutter (weakest AI corpus,
reference apps discarded) and Kotlin (rebuild + steeper curve, Android-only) were rejected.

## Q2. Firebase specifics — RESOLVED
- Store: **Firestore** (over Realtime Database). Auth: **Firebase Auth** id+password, Google later.
  Free **Spark** tier is more than enough (D17). Notifications: **local, on-device** (D18). JSON-import
  conflict: **merge vs overwrite** (D24). Realtime listeners (push), not polling. (docs/core/decisions.md D17, D18, D24)
- Deferred to design (implementation detail, not a spec gap): exact Firestore document layout (per-user
  collections) and default notification lead-time value.

## Q3. Notifications — RESOLVED
- Lead-time is **per-event with a default** (D28). Notifications are **local, on-device** (D18), spam-minimized —
  important events + a select few time blocks (D13) — **but the exact-time execution cue on flagged blocks is the
  core lever and is NOT minimized (D30 revisits D13; see Q9).** Repeat/snooze not in scope for now.

## Q4. Budget — RESOLVED
- 8 fixed categories (D16); **single currency KRW** (D25); **free-text card/payment** (D26).

## Q5. Calorie / meal + workout — RESOLVED
- Fixed targets (D16); workouts unified into time-blocks, standalone O/X dropped (D15, D22); photos dropped
  (D19); **manual kcal entry only** (D27).

## Q6. Plan-vs-actual evaluation depth — RESOLVED
- **Binary success/fail + free-text failure reason only**; quantitative comparison deferred (D5, D29).

## Q7. Calendar UX — RESOLVED (structure)
- **Month view + tap-date day view** (D21); pains captured in spec §3.1. Finer visual design (density,
  styling) is a design-stage task, not a spec gap.

## Q8. Data model reconciliation — RESOLVED
- Final entities: ImportantEvent, TimeBlock (with kind + D-1 snapshot), Expense, MealEntry, DayAggregate,
  Account/Sync (spec §4). No standalone ActivityEntry (D22), no meal image (D19). Migration from the
  reference `@expense_list` / `@diet_list` shapes to the unified schema is a build-time task.

---

> **Status (2026-07-06):** spec-level questions Q1–Q8 resolved. **A new CRITICAL strategic question (Q9) is now
> open** — see below.

## Q9 (CRITICAL) — Differentiation: does this app need to exist? (raised 2026-07-07)

The user's own doubt after seeing the research: *"딱히 특출난 기능이 없다. 이미 있는 것들을 모아놓은 것 같다. 굳이
이런 앱이 필요할까?"* This is the right question to answer **before** designing the solution (inst2.md: 기존 대안과
차별성). The tension is real:
- As a **feature list**, LifePlanner = calendar + budget + calorie + reminders — all of which already exist, and
  the gym-reminder use case can already be done in Google/Kakao Calendar. No novel *feature*.
- Candidate real **holes / differentiators** to test (not yet decided):
  1. **Plan-vs-actual evaluation loop** to make future plans realistic — *no mainstream calendar does this*.
  2. **Integration for realistic placement** — seeing the day's load + calories + spending in one place so a gym
     block is placed in a *real* free slot (the user omits exercise when the day feels overloaded — Q5).
  3. **Zero-friction integrated capture** — the user's calorie logging fails because it's slow/forgettable (Q4).
  4. **No-guilt exact-time execution** as a design stance (vs. streak apps) + **free multi-device sync** (Kakao pain).
- Honest risk: some candidates are thin (a reminder ≈ existing calendars); the product's survival depends on
  picking the **one real hole** and cutting the undifferentiated rest. Also note (Q4): D-1 time-block planning is
  **not a current habit** of the user → adoption risk for the "secondary" tier.
- **Next step**: decide whether to (a) narrow the product around the strongest hole, (b) pivot, or (c) proceed
  as an integrated personal planner accepting "integration + execution mechanism" as the value. Resolve before Day-2 solution design.
- **RESOLVED (2026-07-07)**: direction = **execution engine** (docs/core/decisions.md **D30**). The differentiator is
  making the user actually *do* the future/self-improvement tasks (esp. exercise) that existing apps fail to make
  them do — the calendar/budget/calorie are supporting context. The product is worth building as a daily personal
  tool (the user would use it daily if the integration beats the scattered apps). D13 (notification minimization)
  is to be revisited since the execution alarm is now the core lever.

## Q10 (strategic) — Business model, product-target & cost-at-scale (raised 2026-07-07)
- **Free-only (D10) is right for the *personal tool*, but a *product* needs a business model.** Firebase is free
  small (Spark), but at scale it costs (~$1–10/mo small; can hit ~$270/mo at 500k reads/day). A "cost-conscious
  student" persona won't fund a scaled product.
- **The space DOES monetize** (habit-app market ~$2.1B by 2031; Finch $15–70/yr; freemium standard) — so "target =
  broke individuals who won't pay" is a mis-frame. Likely product target = **planner-types frustrated enough by
  not-following-through to pay for something that actually works** (overlaps Finch's payers).
- **Also (competitive-analysis correction)**: the execution niche is **not empty** (D/R, Boss-as-a-Service, Amira,
  GoalsWon, Focusmate, Tiimo/Inflow) — our differentiation narrows to *self-contained + integrated + no-guilt cue
  engine*. Confirm this still clears the "why switch" bar for a paying segment.
- **Open**: (a) stay a free personal tool, or (b) go product → freemium / one-time (not ads); (c) does the persona/
  target need a **product-phase revision** (add willingness-to-pay)? Resolve before scaling. **Doesn't block the MVP.**
