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
| Area | Prototype (done, in `app/`) | Full app (this plan builds) |
|---|---|---|
| Native alarm + execution moment | ✅ reuse as-is | reuse on flagged time-blocks |
| Storage | AsyncStorage repos | **Firestore-backed repos** (same interface) + Auth + sync |
| Calendar / important events | ✗ | **F1** |
| Time-block planning (D-1) + My Day | ✗ (single task list only) | **F2** (reuses execution) |
| Logs — expense + meal | ✗ | **F3** (port `reference/calculator.js` + `reference/kcal.js`) |
| Day summary | ✗ | **F4** |
| Plan-vs-actual evaluation | ✗ | **F5 (Later)** |

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
- **P-e · Design-skin lock** (before heavy UI, ≤F1): decide **v5 "Toss-form" (current code) vs D36 forest/gold**;
  record a confirmed D-entry in `decisions.md` and update `design-system.md` §1 (it's currently marked provisional).
  Building can proceed on the current v5 tokens; this just formalizes the choice.
- **P-f · Resolve small [TBD]s**: full-app **default lead-time** (D28, e.g. 30 min — differs from prototype's 0);
  miss auto-archive window (~7d) and render caps (architecture §11). Set when their feature lands.

## Phases (dependency-ordered; each has a DoD gate)

### F0 — Backend foundation: Auth + Firestore repos + sync + rules  ← gates all sync
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
→ F4 (day summary) → F5 (evaluation, Later).** Prep P-a/P-b/P-c inside F0; P-d inside F3; P-e before F1; P-f as each
feature lands. Nothing here changes the validated execution lever — it is reused, not rebuilt.
