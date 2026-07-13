# Full-App Implementation Plan — "Integrated Day"

> **Role.** The phased, gated build sequence for the **full "integrated day" app** that layers on top of the
> completed trigger prototype. Analogous to the prototype's plan (now `docs/research/prototype/implementation-plan.md`),
> but for the full product. **Status: pre-code planning.** Written while the reorg context was fresh (2026-07-10) so
> the plan survives a context reset.
>
> **Truth sources this plan assembles (do not duplicate them — reference):** WHAT = `docs/core/spec.md` §3 +
> `docs/core/service-overview.md` §3; HOW = `docs/core/architecture.md` §5/§6/§7/§11; DATA = `docs/core/data-model.md`;
> SCREENS/IA = `docs/research/information-architecture.md` §8 + `docs/research/features/execution-integrated-day.md` §3;
> DESIGN = `docs/core/design-system.md` + `docs/core/design-principles.md`; DECISIONS = `docs/core/decisions.md`.
> Body English; UI copy Korean.

## Context (why this plan)
The **trigger prototype is built and validated** (`docs/research/prototype/PROTOTYPE-STATE.md`): native exact-alarm
layer + the execution moment + local AsyncStorage + no-guilt logging. The docs cover *what/how/data/design* in
detail, but there was **no full-app build sequence**, and several setup items (Firebase project, security rules,
reference-app migration, storage cutover, skin lock) were deferred as "build-time tasks." This plan fills that gap:
a dependency-ordered set of phases, each with a **Definition of Done (DoD)**, so a solo+AI build can proceed without
re-deriving the sequence.

## Foundation principle — extend, don't rebuild (architecture §7)
- **Keep unchanged:** the native alarm layer (`app/modules/lp-alarm`), the execution feature/moment, the haptics,
  and the **Repository interfaces** (`EventRepository`/`BlockRepository`/…). Features call interfaces, not storage.
- **The only storage change:** swap the AsyncStorage repository *implementation* for a Firestore-backed one
  **behind the same interface** (Firestore offline persistence = the local store). Features + native code don't move.
- **Local-first, free-only, Android-first, no-guilt invariants** all carry over (design-principles; D2/D10/D1).

## What's built vs what to build
> ⚠ **This table was the ORIGINAL plan (2026-07-10). It is history.** The live status is
> **"Build progress (live) — CURRENT STATE"** at the bottom of this file — F1–F5 are **done**; only F0 remains.

| Area | Then (prototype) | Now (2026-07-11) |
|---|---|---|
| Native alarm + execution moment | ✅ | ✅ reused, hardened (D41/D44/D46/D47/D48) |
| Calendar / important events | ✗ | ✅ **F1** (sync still needs F0) |
| Time-block planning (D-1) + My Day | ✗ | ✅ **F2** |
| Logs — expense + meal | ✗ | ✅ **F3** |
| Day summary · evaluation | ✗ | ✅ **F4 · F5** |
| Storage | AsyncStorage repos | ⬜ **F0** — Firestore-backed repos (same interface) + Auth + sync |

## Cross-cutting prep (resolve at the phase that needs it — listed once here)
- **P-a · Firebase project** (F0): create Spark(free)-tier project(s) **dev + prod**; enable **Auth (id+password**,
  D12/D20; Google later); wire `@react-native-firebase` (or Firebase JS SDK) via config plugin + `google-services.json`
  per env. Needs `expo prebuild --clean` (native).
- **P-b · Security rules + indexes** (F0): author `firestore.rules` — per-user isolation `request.auth.uid == uid`,
  and enforce soft-delete read discipline (`deletedAt == null`); add composite indexes as queries demand. Deploy via
  Firebase CLI. (architecture §3/§6 give the concept; write the actual file.)
- **P-c · Storage cutover** (F0): migrate the running prototype's local data into the full-app model per
  **data-model §8.4** (prototype `Task` → `TimeBlock`; add `uid`/serverTimestamp/tombstones). Preserve existing local
  outcomes/history. One-time on first login; keep working offline if never logged in.
- **P-d · Reference-app migration mapping** (F3): field-map `@expense_list`→`Expense`, `@diet_list`→`MealEntry`
  (table below). Port the compute logic (monthly totals, category distribution) from the reference apps.
- ~~**P-e · Design-skin lock**~~ **DONE (D39, 2026-07-11)** — v5 "Toss-form" is **confirmed**; `design-system.md`
  §1 is no longer provisional and the native execution moment was repainted to match. Nothing left here.
- **P-f · Resolve small [TBD]s**: full-app **default lead-time** (D28, e.g. 30 min — differs from prototype's 0);
  miss auto-archive window (~7d) and render caps (architecture §11). Set when their feature lands.

## Phases (dependency-ordered; each has a DoD gate)

### F0 — Backend foundation: Auth + Firestore repos + sync + rules  ← **the only phase left**

> **⚠ FOUNDER-ONLY STEPS (an agent cannot do these — it will stall or invent a config):**
> 1. **Create the Firebase project(s)** in the console on the **Spark (free) plan** — no billing card (D10/D17).
>    dev + prod if you want the split; one is fine to start.
> 2. **Enable Auth → Email/Password** (id+password first; Google later, D12).
> 3. **Download `google-services.json`** and put it in `app/` (it is gitignored — never commit it).
> 4. **Firebase CLI login** (`npx firebase login`) so the security rules can be deployed.
>
> **What the agent then does, and the ONE rule it must not break:** the Firestore implementation goes
> **behind the existing Repository interfaces** (`app/src/core/data/*Repository.ts`) — **screens and the native
> alarm layer do not change** (architecture §7). If a screen ends up importing Firestore, the refactor is wrong.
>
> **The cutover (P-c) must preserve the measurement/catch-up stores** (`lp.outcomes/fires/missed/latencies`,
> data-model §2.7) — they are the lever's evidence (S1–S5) and the catch-up net (R18); losing them silently
> destroys the self-experiment.
- P-a Firebase project + `@react-native-firebase` wiring; **Account screen** (`/account`): app usable **without**
  login (local), **login enables sync** (D20). id+password Auth (D12).
- Implement the **Firestore-backed Repository** behind the existing interfaces; Firestore **offline persistence** is
  the local store; conflict = `serverTimestamp()` **last-write-wins** (data-model §6). Collections
  `/users/{uid}/{events,timeblocks,expenses,meals}` (data-model §2).
- P-b security rules + P-c storage cutover.
- **DoD:** logged-in write on device A propagates to device B via realtime listeners; app fully works **offline** then
  syncs on reconnect; rules deployed (a user can't read another uid); **the prototype execution moment still fires**
  (regression check); prototype's local data survives the cutover.

### F1 — Core: Calendar of important events (spec §3.1)
- `/calendar`: month view (S26 standards — today highlight, +N more, swipe month, category color, prominent quick-add);
  `ImportantEvent` CRUD (title, date, time, `notifyLeadMinutes`, memo, color); **advance notification** = **non-exact**
  `expo-notifications` (D18) on all devices; cloud auto-sync.
- **DoD:** event added on device A appears on B; advance notification fires at `time − notifyLeadMinutes`; canceled
  event = deleted (soft-delete tombstone, data-model §6); matches spec §3.1.

### F2 — Secondary: Time-block planning + execution (spec §3.2, features §3)
- `/timeblocks`: tap a calendar date (D21) → that day's **time-block schedule**; add/edit `TimeBlock` (free-form
  start–end, title, optional location, `kind = normal|workout|run`, **executionAlarm flag** + `alarmLeadMinutes` +
  `microStartNote`, D28). **D-1 snapshot** (`snapStart/snapEnd/snapTitle/plannedAt`) frozen for evaluation; alarm
  always follows the **LIVE** `start − alarmLeadMinutes` (D23).
- **My Day** = today's blocks as **execution cards** (S2/D32; next-up highlighted; flagged prominent); a **free-slot
  hint** when adding a block (H3/H10). **Reuse the prototype execution moment** on flagged blocks at the cued time.
- Plan/execution surface only — **spending/meals are NOT shown here** (D32).
- **DoD:** create a D-1 flagged workout block → alarm fires at block time over the lock screen → execution moment →
  mark done; D-1 snapshot frozen; editing the block on the day moves the alarm (live) but not the snapshot.

### F3 — Secondary: In-the-moment logs (spec §3.3/§3.4, separate surface D32)
- `/logs` (its **own tab**): fast bottom-sheet with presets; **Expense** + **MealEntry** added **in the moment**.
  Port `reference/calculator.js` (budget) and `reference/kcal.js` (calorie, **minus photo**, D19) — logic + shapes
  via P-d mapping. 8 fixed categories (D16), KRW (D25), free-text payment (D26); manual kcal only (D27).
- **DoD:** log an expense and a meal in **≤2 taps** each; monthly/day totals + category distribution match the
  reference apps; entries sync; **not** shown on the plan/execution surface.

### F4 — Day summary (spec §3.5, D32 "links not merges")
- `DayAggregate` (derived): one place shows the day's **blocks (done/miss)** and that day's **spend / calorie totals**
  as **distinct sections** — day-level integration, **not** interleaved on one timeline.
- **DoD:** day summary shows both sections without merging; workout/run done-flags derived from success blocks (D22).

### F5 — Later: Plan-vs-actual evaluation (spec §3.6, deferred)
- Binary **success/fail + free-text failReason** per time-block (D5); aggregate rates + collected reasons; **no**
  auto-suggestions, **no** quantitative dashboard (D29). Build only after F0–F4 are validated.
- **DoD:** each block markable success/fail with reason; a simple month rollup of executed vs planned.

## Reference-app → unified schema mapping (P-d detail)
| Source (AsyncStorage) | → Full-app entity | Field mapping |
|---|---|---|
| `@expense_list` (calculator.js) | **Expense** | id→id · timestamp→timestamp · category→category(8 fixed D16) · name→name · amount→amount(KRW) · store→store · payment→payment · icon = derived from category (not stored) · +`updatedAt`,`uid` |
| `@diet_list` (kcal.js) | **MealEntry** | mealType(아침/점심/저녁/간식) · foodName · detail · kcal(manual) · date/timestamp · **drop photo** (D19) · +`updatedAt`,`uid` |
| prototype `lp.tasks.v1` `Task` | **TimeBlock** | data-model §8.4: title→title · setTime→derive start (end optional) · executionAlarm/leadMinutes/microStartNote carry · recurrence→(full-app: per-date blocks) · +`kind`,`snap*`,`status`,`uid` |

## Deferred / out of MVP (do not build now)
- **Q10** business model / monetization (open-questions.md — explicitly non-blocking for MVP).
- **P1 levers** (features §4): capacity-aware free-slot suggestion, 출발/도착 인증, **geofence** trigger
  (`expo-location`), <2s logging widgets (Quick-Settings tile / NFC / Shortcuts), learn-repeat-entries.
- Google login (D12), quantitative evaluation (D29), multi-user sharing, iOS (D1), meal photos (D19, paid storage).

## End-to-end verification (when built — features §8)
On a real Android device, two logged-in devices: create a D-1 workout block (flagged) → **alarm fires at the exact
time under Doze** → micro-start prompt → mark done → the entry **syncs to the 2nd device**; log an expense/meal in
≤2 taps; works **offline** then syncs on reconnect. Per-phase: run that phase's DoD. Static: `npm run typecheck` +
`npm test` green each phase; commit per change (push on request — memory: git-commit-push-policy).

## Sequencing summary
**F0 (backend/auth/sync — the gate) → F1 (calendar) → F2 (time-blocks + reuse execution) → F3 (logs, port ref apps)
→ F4 (day summary) → F5 (evaluation, Later).** Prep P-a/P-b/P-c inside F0; P-d was done inside F3; **P-e is DONE (D39)**; P-f as each
feature lands. Nothing here changes the validated execution lever — it is reused, not rebuilt.

## Build progress (live) — CURRENT STATE (self-contained; updated 2026-07-11, after the device pass)

> The single **"where are we"** record — written to survive a context compaction. Read this + `docs/core/prd.md`
> and you know what exists, what's left, and what to be careful of. Detailed history: `docs/research/build-log.md`.
> **Local-first may run ahead of F0:** a feature's UI can sit on a local AsyncStorage repository and have its
> storage impl swapped to Firestore later behind the same interface (architecture §7) — only *sync* waits.

### Headline
**Everything before the backend is BUILT and founder-verified on a real device (2026-07-11).**
The app is a working "integrated day": calendar + day plan + the execution lever + logs + day summary +
review. **The only phase left is F0 (Firebase: Auth + Firestore + sync).**

### Repo / git
Private `origin = git@github.com:Wolharang/life-planner.git` (SSH, branch `main`). Policy (memory):
**commit after every change; push ONLY when the founder says to.** **Pushed through the doc-consolidation commit
(2026-07-11) — `main` is up to date with `origin/main`.**

### Phases
| Phase | State |
|---|---|
| **Prototype (foundation)** | ✅ complete, reused not rebuilt. Snapshot: `docs/research/prototype/PROTOTYPE-STATE.md` |
| **Nav shell** | ✅ bottom tabs 홈 · 캘린더 · 기록 (`app/app/(tabs)/`) |
| **F1 calendar (R1/R3)** | ✅ except **R2 sync** — month grid (square cells, event bars, month **swipe**), `ImportantEvent` (`lp.events.v1`), `/add-event`, **advance notification** (soft local alert; **R3 never needed F0** — D18 says local, not push) |
| **F2 time-blocks + execution (R5–R7)** | ✅ `TimeBlock` (`lp.blocks.v1`) · `blockScheduler` (fires at **live** `start − lead`; D-1 snapshot mirrors → freezes) · `/day` (day plan + free-slot hint) · `/add-block` (**multi-date add**) · **Home = My Day**. The prototype's `Task` is **retired** (one-time migration, ids preserved) |
| **F3 logs (R8/R9)** | ✅ `Expense` (`lp.expenses.v1`) + `MealEntry` (`lp.meals.v1`) + `logs/{constants,aggregate}.ts` + the real **기록 탭** + `/add-expense` · `/add-meal` (**amount/name only** → ≤2 taps). Ported per `reference-apps.md` |
| **F4 day summary (R10)** | ✅ `DayAggregate` **derived on read** + `/summary?date=` — 계획·실행 and 기록 as **two distinct sections** (D32) |
| **F5 evaluation (R17)** | ✅ `/review` 돌아보기 — month rollup vs the **D-1 plan of record**, fails gathered with **optional** reasons |
| **F0 backend (Auth + Firestore + rules + cutover)** | ⬜ **NOT started — the only thing left.** It gates **R2** (cross-device sync) and the two gaps below |

### The execution lever, as it now stands (all founder-driven, all device-verified)
COMMIT ("…하기로 했잖아" + the **micro-start**) → ack → **~5 min later** the moment **re-opens by itself** at
**"진짜 했어?"** → 응했어 = **DONE** (one calm gold mark) / 아직안했어 = **5·4·3·2·1 → "지금 나가."** → leaves,
outcome **pending** (never an immediate miss). Around it, the hard-won invariants (each from a real device bug):
- **It appears in every state** — locked *and* while the phone is in use (**"다른 앱 위에 표시"**, D41).
- **It out-layers other apps** — it renders as an **overlay window** and re-claims the top every ~2s, because an
  Activity can never beat an ad/lock-screen overlay (캐시워크 …) (**D48**).
- **It exists only on screen** — every timer freezes when it isn't visible, and resumes at the same phase; it can
  no longer end itself in the background (**D46**). The screen can't sleep under it.
- **It comes back by itself** if sent away unanswered — bounded to 3 re-summons: **insist, never trap** (**D47**).
- **The tone can never outlive its screen** — stops when not visible, hard-capped (**D44**).
- **No in-flow escape** — back button *and* predictive back are consumed (R7/A2). The only skip is the pre-fire
  **"오늘은 쉼"**.
- **One-shot** — a finished moment leaves no tappable ghost; an unanswered one keeps its notification as the way back.

### Alerts (the model, after 3 founder revisions)
A block carries **exactly one** alert, one of **two** (D40 → D43): **알림** (a plain notification; arrives at up
to **3 moments the user picks** — D45) · **실행** (the lever; **the default**). **Sound is a separate per-block
axis** (default off = **vibration only**): the moment may be silent, an alert may ring (D43). The tone itself is
a setting, with a picker + preview (D42). Only **실행** may pierce the lock screen (R15).

### Decisions taken during this phase (all in `docs/core/decisions.md`)
**D37** no recurrence → multi-date add · **D38** *(superseded)* · **D39** skin **LOCKED to v5** (blue/gold; the
native moment is repainted — no screen is on the old palette) · **D40/D43/D45** the alert model above ·
**D41** overlay grant · **D42** tone picker · **D44/D46/D47/D48** the moment's visibility/topmost/return rules.

### Open `[TBD]`s and known gaps
- **Genuinely undecided (a founder call, from the self-experiment):**
  · **default lead time** — PRD R13 says `[TBD ~30분]`, the code currently **ships `0` (정각)** (`settingsRepository.ts`).
  · **the R7 re-check delay** — **5 min, hard-coded** in `ExecutionActivity` (`RECHECK_DELAY_MS`). Could become a setting.
- **Decided in code, not yet promoted to a decision** (recorded here so nobody "fixes" them by guessing):
  catch-up window **7d** · never-fired lookback **30d** · free-slot day window **07:00–23:00, ≥30분** ·
  execution tone hard cap **60s** · re-summon **3 attempts / 700ms** · soft alert **≤3 moments**.
- **Needs F0:** **R2** cross-device sync · spec §3.6's "a D-1 block **soft-deleted** on the day counts as fail"
  (needs tombstones) · account/login (R4).
- **Not a gap, by decision:** no streaks/score/auto-suggestions anywhere (R14/D29).

### Where the truth lives
What/Why = `docs/core/prd.md` (R1–R18) · decisions = `docs/core/decisions.md` (D1–D50) · How =
`docs/core/architecture.md` + `docs/core/data-model.md` · build order = **this file** · history =
`docs/research/build-log.md` · device acceptance = `docs/research/device-test-checklist.md`.
