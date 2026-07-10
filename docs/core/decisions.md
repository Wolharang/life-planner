# LifePlanner — Decision Log

> Confirmed decisions with rationale. Newest at top. Written in English; user-facing answers in Korean.
>
> **Phase note (2026-07-10):** the **trigger prototype is built and validated** (founder-confirmed running);
> the project has moved to the **full "integrated day" app** phase. **D35 is the prototype-scoped decision**
> (trigger-first scope + v0.3 choices); **D28** carries an inline "for the prototype, lead = 0" refinement, and
> **D13 / D30 / D31 / D32** are re-scoped *by* D35 (not annotated inline). **D36 is NOT prototype-only history —
> it is the live, app-wide design foundation** (base design system + forest/gold baseline; `design-system.md`
> was promoted to core precisely as that foundation). The active product truth is now
> `docs/core/service-overview.md` + `docs/core/spec.md`; the prototype build/plan docs are archived under
> `docs/research/prototype/` (state snapshot: `PROTOTYPE-STATE.md`); the design foundation lives on in
> `docs/core/design-system.md` + `app/`.

## 2026-07-09 — Trigger-prototype scope & v0.3 product decisions

### D36. Base design system: shadcn-for-RN (react-native-reusables / gluestack-ui v2 on NativeWind), skinned with our tokens
- **Decision**: The base UI system is the **shadcn-style, own-your-components approach for React Native** —
  **react-native-reusables** (or **gluestack-ui v2**), both built on **NativeWind (Tailwind)** — **skinned with the
  LifePlanner design tokens** (`docs/core/design-system.md`). Standard screens use these validated,
  accessible, copy-paste components restyled to the calm forest/gold palette; the **execution moment is
  hand-built** on the tokens. Considered and set aside: **Material 3 (React Native Paper)** — most validated /
  Android-native / best states-and-a11y out-of-box, but imposes Material's look, which fights the bespoke calm
  aesthetic (design-principles B1/B2/C1); **Apple HIG** (iOS language, not an RN component lib; Android-first);
  **Ant Design** (web-centric, weak native-RN fit).
- **Rationale (user, 2026-07-09)**: prefers the shadcn approach — **full aesthetic control + validated
  accessibility primitives**, over inheriting a branded look. Fits the stack (RN + Expo + NativeWind, free D10) and
  the AI-assisted solo workflow (Tailwind = large training data, D11). A "validated system" and "our tokens" are
  **complementary**: we skin a validated base, not hand-roll everything.
- **Note**: pairs with `docs/core/design-system.md` (tokens) and `docs/research/prototype/user-flows.md`. Owning the
  copy-paste components means we **verify their default/pressed/disabled/error states** against design-system §4.2.
- **Note (2026-07-10, provisional — NOT a new decision)**: the *visual skin* is being iterated in code
  (a "Toss-form" experiment: blue interactive · white ground · serif execution voice — see
  `docs/core/design-system.md §1` "⚠ 진행 중" and `docs/research/prototype/build-log.md`). **The palette/type are
  not yet locked** — this D36 forest/gold decision stands as the confirmed baseline until a future round
  confirms a rebrand, at which point a new D-entry supersedes it. Do not read the current code skin as
  confirmed truth.

### D35. Build the trigger prototype first; its v0.3 product choices (scope-locked)
- **Decision (scope)**: Build **only the execution lever** first (the trigger prototype — exact-time alarm +
  lock-screen execution moment + no-guilt local logging) and **defer the entire integrated day** (calendar,
  budget, calorie, multi-device sync, plan-vs-actual evaluation) to a **post-prototype phase**. This
  **operationalizes D30** (execution engine = the heart; calendar/budget/calorie = supporting context) and
  **narrows D31/D32's S2 solution to its riskiest lever**; it re-scopes D4's "calendar = the heart" ordering **for
  the prototype only** (the calendar is excluded from the prototype, not from the product). Canonical: `docs/research/prototype/prd.md`.
- **Decision (v0.3 product choices)** — logged so they aren't silently pivotable:
  - **Plain reminders** = a *soft, multi-offset* notification tier per task (offsets {정각/15/30/60분/custom},
    multi-select), **distinct** from the execution cue — an explicit **refinement of D13**: D13's "select few,
    minimize spam" now means the *heavy* lock-screen cue stays rare, while opt-in soft reminders are allowed and
    unobtrusive (consistent with D30's "don't minimize the cue itself").
  - **Recurrence** = none / daily / weekly, producing **one occurrence per date**, each with its own outcome
    (net-new; no prior decision covered repetition — D14/D22 were single-instance).
  - **The "오늘은 못 해" (miss) opt-out is placed AFTER the 5·4·3·2·1 countdown** (the counter-deliberation lever
    must run before any escape) — core to D30/D31/D32.
  - **Sound** supported, **default haptic-only** (user-toggleable).
  - **Outcome `source`** (execution-screen vs catch-up) recorded; **S2 counts execution-screen `done` only**.
  - **Lead-time default = 0** for the prototype (fire at set time) with presets — **revises D28** (see its note).
- **Precedence**: where the PRD (v0.3) and a decision diverge, the PRD wins for *what the product does*, and the
  divergence is annotated in this log (as done for D28).
- **Rationale**: validate the biggest uncertainty (the lever) in minimal form before building the rest; keep the
  prototype's added surface (recurrence / reminders / sound) minimal and lever-serving.

## 2026-07-06 — Initial planning decisions

### D1. Platform: mobile-first, Android priority
- **Decision**: Build as a mobile app. Android has higher priority than iOS; primary checking and testing on Android.
- **Rationale**: The user primarily uses and tests on Android; notifications and always-with-you nature fit mobile.

### D2. Storage & sync: local-first + manual JSON + Firebase cloud sync
- **Decision**: Local-first storage. Support manual JSON export/import. Cloud sync is central to the core
  calendar feature (all data auto-syncs across the user's devices once logged in). **Firebase** is the backend
  (confirmed in D17), with **last-write-wins**. JSON import uses **merge vs overwrite** (see D24).
- **Rationale**: Firebase offers offline caching, a mature mobile SDK, realtime sync, no pause on inactivity,
  and a generous free tier — a strong fit for local-first + multi-device sync at zero cost. (Backend and
  conflict handling now concretized in D17/D24.)

### D3. Scope: single user first, staged expansion
- **Decision**: Single user for now. Expansion path: "one user, many devices" → "many individuals each using it."
- **Rationale**: Keeps auth/permissions simple and MVP light; sharing is deferred.

### D4. Feature priority: three tiers
- **Decision**:
  - **Core** — calendar of important events (advance entry, cloud auto-sync, advance notifications).
  - **Secondary** — D-1 day-level time-block planning linked to calendar dates + in-the-moment budget and
    calorie/workout tracking.
  - **Later** — plan-vs-actual evaluation of the time-block schedule.
- **Rationale**: The calendar of important events is the heart of the product; tracking and evaluation build on it.

### D5. Evaluation: success/fail + failure reason on D-1 time blocks
- **Decision**: Evaluation checks whether each **D-1 time-block** was carried out on the day
  (**success/fail**), and on failure the user records a **reason**. Later the app exports success/fail rates
  and collects the failure reasons in one place for the user to review; the app does **not** auto-suggest
  adjustments — the user adjusts their own future plans. Important events are **not** evaluated — a canceled
  important event is deleted.
- **Rationale**: The behavioral goal is "did I do what I planned for the day"; reasons + rates give the user
  the raw material to self-correct without the app being prescriptive.

### D6. Integration principle & entry timing
- **Decision**: Unify calendar / budget / calorie into one app. Time-block plans are pre-entered by D-1;
  spending and calorie/meal entries are recorded **in the moment** (at purchase / at eating), not pre-entered.
- **Rationale**: Matches how the data actually arises — plans are foreseeable, spending/eating are events.

### D7. Existing budget/calorie apps: references (`reference/calculator.js`, `reference/kcal.js`)
- **Decision**: Two complete, working apps exist — budget (`reference/calculator.js`) and calorie
  (`reference/kcal.js`) — both built with **React Native + Expo**. They are used as **references** for how
  the secondary features work. How much can be leveraged depends on the tech-stack choice
  (see D11): each is a **standalone app**, so literal drop-in reuse isn't possible — with React Native we
  **reference & port (참고·이식)** much of the logic; with Flutter we'd reimplement in Dart using these as a guide.
- **Rationale**: The apps already implement local-first storage, JSON export/import (merge vs overwrite),
  categories, and daily/monthly totals — valuable regardless of stack. But the stack is chosen on best fit
  for the goal (D11), not on reuse convenience.

### D8. Conflict detection: intentionally not a feature
- **Decision**: No dedicated schedule-conflict detection.
- **Rationale**: Because all important events sit on the calendar, the user sees existing events when adding
  a new one, so double-booking is naturally avoided without extra logic.

### D9. Working language convention
- **Decision**: All repository artifacts (docs, future code, comments) are written in English; final replies
  to the user are translated into Korean.
- **Rationale**: Keeps artifacts conventional/portable while keeping communication in the user's language.

### D10. Zero paid services (cost constraint)
- **Decision**: The project uses **free services only** — no paid cloud, no paid subscriptions, no billed
  services. The cloud sync backend must be a free tier (e.g. Firebase free tier); tools and libraries should
  be free/open-source. (This is a project-cost constraint, and is unrelated to the household-budget feature,
  which stays.)
- **Rationale**: The user does not want to spend money running the project.

### D11. Tech stack: React Native + Expo (CONFIRMED 2026-07-06)
- **Decision**: Build LifePlanner with **React Native + Expo** (TypeScript). Flutter and Kotlin/Jetpack
  Compose were evaluated and rejected for this project.
- **Rationale** (after researching all three across performance, polish, notifications, DX, and AI-assisted
  coding):
  - **Least code to write**: the two reference apps are already RN/Expo (integrate, not rebuild), plus the
    npm ecosystem is the largest, so most features have ready libraries.
  - **Strongest AI-assisted coding**: TS/JS has the most LLM training data, so a PM-led, Claude Code–driven
    build gets the most accurate assistance — matches the intended development mode.
  - **Fastest solo iteration**: Expo removes native config/Gradle friction (Fast Refresh, EAS free tier). **Note: "Expo Go" is superseded by D34 — the build uses an Expo Dev Build** (native modules).
  - **Sufficient for this app's needs**: polish is proven (Bluesky/Instagram/Discord are RN); reliable
    the execution cue's exact-alarm + full-screen intent is achievable (native module, D34) and advance-event
    alerts use non-exact expo-notifications;
    the app is not compute-heavy, so native's perf edge isn't needed.
  - **Cross-platform** keeps iOS open at no cost, even though Android-only is acceptable now.
  - Rejected: **Flutter** — would discard the reference apps and has the weakest AI corpus of the three.
    **Kotlin/Compose** — cleanest language + best native Android integration, but requires rebuilding the
    reference apps, slower builds, and a steeper learning curve for a non-JVM, PM-led workflow.
- **Concrete guidance for the build**: Expo SDK with the New Architecture (Fabric) enabled; Reanimated for
  60fps animations; Notifee (or expo-notifications) for scheduled/exact notifications; Firebase for sync
  (D2); consider Skia or react-native-calendars for the calendar UI.

### D12. Auth: ID + password first, Google login later
- **Decision**: ID + password as the primary sign-in so the same user can log in across devices. Google
  social login is a later addition — candidate approach: generate a virtual ID/password bound to the Google
  account and sign in through that.
- **Rationale**: Simple to build first; social login can layer on without changing the core model.

### D13. Notifications kept minimal
- **Decision**: Notifications fire for **important events** and only a **select few** time blocks that
  clearly warrant one. Deliberately minimize notification **spam** to avoid annoyance. **(→ D30 revisits this: the
  exact-time execution cue on flagged blocks is the core lever and is exempt from minimization.)**
- **Rationale**: Advance alerts for important events are a core value; over-notifying erodes trust and gets
  muted.

### D14. Time-block schedule is free-form intervals
- **Decision**: Time blocks are **free-form start–end intervals** (not fixed hourly slots), each with a
  title and optional location. Example day: `10:00–13:00 lecture`, `13:00–14:00 lunch (visit Seocho post
  office)`, `14:00–19:00 lab`, `20:30–22:00 gym`.
- **Rationale**: Real days don't fit uniform slots; free intervals match how the user actually plans.

### D15. Unify workout/run tracking with time-block planning + evaluation
- **Decision**: The calorie app's **운동 / 러닝** activity records (docs/research/reference-apps.md §B) are **unified** with
  LifePlanner's time-block workout planning and its success/fail evaluation — one concept, not two separate
  "did I work out" trackers.
- **Rationale**: A workout is planned as a D-1 time block, executed, then evaluated; a duplicate activity log
  would fragment the same fact.

### D16. Keep reference apps' fixed categories and kcal targets as-is
- **Decision**: Adopt the existing apps' fixed values verbatim: budget's **8 categories** (주식/간식/문화생활/
  잡화소모/이동통신/대중교통비/뷰티/기타) and calorie's **4 meal categories** with per-meal kcal targets
  (아침 400 / 점심 500 / 저녁 400 / 간식 200; daily 1500). No user-configurable categories/targets for now.
- **Rationale**: The user is satisfied with the current sets; keeping them fixed simplifies the first build
  and preserves parity with the reference apps.

### D17. Backend concretized: Firebase (Firestore + Auth), Spark free plan
- **Decision**: Use **Cloud Firestore** as the sync data store and **Firebase Authentication** (email/password
  first, Google later) for accounts, on the **Spark (free) plan** — no billing card.
- **Rationale**: Firestore is the recommended store for new, multi-entity apps and provides built-in offline
  caching + realtime listeners, which directly delivers the core "auto-sync across all the user's devices"
  feature (write on one device → propagates to all logged-in devices; last-write-wins). Free-tier limits
  (1 GB storage; 50k reads / 20k writes / 20k deletes per day; 50k MAU auth; unlimited FCM) vastly exceed a
  personal app's needs. Realtime Database was considered but is better for simple single-tree/twitch-speed
  sync, not our multi-entity model.
- **Note**: Firestore is chosen over Realtime Database; revisit only if a specific need arises.

### D18. Advance notifications are on-device (local), not paid push
- **Decision**: Advance alerts are **local scheduled notifications** on each device (expo-notifications /
  Notifee), not server push. When an important event syncs to another device via Firestore, that device
  **schedules its own local notification**.
- **Rationale**: Delivers "all devices alert before the event" with **zero paid infrastructure** — no Cloud
  Messaging server needed. Exact-time/Doze handling is an OS-level concern handled the same way natively or in
  RN (docs/core/decisions.md context from stack research).

### D19. Drop meal photos (free-plan only)
- **Decision**: **Remove the meal-photo feature entirely.** The calorie app's photo attach / photo viewer
  (docs/research/reference-apps.md §B) is not carried into LifePlanner.
- **Rationale**: Firebase Cloud Storage (needed to sync images across devices) requires the paid Blaze plan as
  of 2026-02-03, which violates the free-only constraint (D10). Dropping photos keeps the entire app on the
  free Spark plan. Meals are still recorded with name, kcal, details, and category.

### D20. Account model: local-first, login enables sync
- **Decision**: The app is **usable immediately without an account** (local storage). **Logging in enables
  cloud sync** from that point across the user's devices.
- **Rationale**: Best fit for the local-first principle; no forced onboarding friction, sync is opt-in.

### D21. Calendar views: month + tap-date day view
- **Decision**: **Monthly view** as the main calendar (important events marked); **tapping a date opens that
  day's time-block (day) view**. No separate week view for now.
- **Rationale**: Matches the user's described flow (see the month, drill into a day's hourly plan) with the
  least UI complexity.

### D22. Workout unification: success on a workout time-block = workout done
- **Decision**: A workout/run is planned as a **time block** with `kind = workout | run`. Marking that block
  **success** records the workout as done. The calorie app's separate **운동/러닝 O/X activity records are
  dropped** (no standalone `ActivityEntry`); the "today workout/run done" summary is **derived** from
  time-blocks of that kind marked success. An unplanned workout is handled by adding a block on the day
  (same-day editing is allowed, D23) and marking it success.
- **Rationale**: One source of truth for "did I work out," consistent with D15; avoids duplicate trackers.

### D23. Plan editable on the day; evaluation vs the D-1 snapshot
- **Decision**: Time-block plans **can be edited on the day**, but **evaluation compares actual completion
  against the plan as it stood at D-1** (the day before). Implementation: snapshot the day's plan at the D-1
  boundary (the "plan of record"); later same-day edits don't change that snapshot.
- **Rationale**: Keeps flexibility while making evaluation honest about "did I do what I planned yesterday."

### D24. JSON import conflict: merge vs overwrite (reference-app style)
- **Decision**: On JSON import, offer **merge** (append items whose id isn't already present) or **overwrite**
  (replace), exactly as the reference apps do (docs/research/reference-apps.md §A6/§B5). This replaces the earlier
  "server vs local" wording. Firestore remains the live sync store; JSON import/export is a manual backup path
  that applies to the local/synced dataset.
- **Rationale**: Reuses a proven, already-built interaction; simplest mental model.

### D25. Single currency (KRW / 원)
- **Decision**: Budget uses a **single currency, KRW (원)**, as in the reference app. No multi-currency.
- **Rationale**: Personal, domestic use; simplest.

### D26. Card/payment: free-text entry
- **Decision**: Card/payment method stays **free-text** per entry (as in the reference app); no managed card list.
- **Rationale**: Simple and flexible; matches existing behavior.

### D27. Calorie: manual entry only
- **Decision**: Calories are **entered manually**; no calorie-lookup database for now.
- **Rationale**: Free-only + simplicity; a (free-tier) lookup can be revisited later.

### D28. Notification lead-time: per-event, with a default
- **Decision**: Lead-time is **configurable per important event** *and per flagged time block* (the execution
  cue fires at `start − lead`; e.g. "N minutes before"); if unset, a **default lead-time** applies (default
  value to be set in design, e.g. 30 min).
- **Rationale**: Flexible per event without forcing input every time.
- **(→ D30 / prototype (prd.md v0.3) / D35 revisits.)** For the **trigger-prototype execution cue**, the unset
  default = **fire AT the set time (lead 0)**, offered with presets {정각 / 15 / 30 / 60분 / custom}; the ~30 min
  nonzero default is **full-app-only**. (D30 reframed the lever as an *exact-time cue* = lead 0; D28 predates it and
  simply wasn't revisited.) The **plain-reminder tier** (multi-offset soft notifications) is added in D35.

### D34. Confirmed full tech stack & infrastructure ("balanced option ①") — 2026-07-08
- **Decision**: The complete build stack/infra is confirmed: **React Native + Expo with a *Dev Build*** (Custom
  Dev Client; **Expo Go ruled out**) + TypeScript; a **thin custom Kotlin native module** for the core alarm
  (AlarmScheduler + full-screen ExecutionActivity + boot/timezone receivers); **Firebase (Cloud Firestore +
  Auth, Spark free)** on a **thick-client + BaaS topology (no custom server, local-first)**. Extends D11 (named
  only "RN + Expo") and D17 (Firebase). Design authority: `docs/core/architecture.md` + `docs/core/data-model.md`.
- **Rationale**: chosen over Native-Android (Kotlin) and Flutter — RN+Expo fits the user's JS/TS + AI-assisted
  solo workflow, keeps iOS open (cross-platform), and reuses the RN/Expo reference apps; the **alarm-reliability
  ceiling is OS-bound, not framework-bound**, so RN + a native module loses nothing vs pure Kotlin while keeping
  those wins. Firebase is the only backend with true mobile **offline persistence**, free + **no-pause** (vs
  Supabase's 7-day free-tier pause).
- **Build-gating design decisions** (logged so they aren't silently pivotable): per-user Firestore collections +
  security rules; **conflict resolution by Firestore `serverTimestamp()`** (not client clock); soft-delete
  tombstones; **Firestore offline persistence = the sole full-app local store** (no separate SQLite source-of-
  truth); sideload → Play ($25) deployment. Details in architecture.md / data-model.md.
- **Consequence**: D11's "Expo Go" rationale is superseded (Dev Build is the real path); the prototype builds on
  this exact stack, so there is **no mid-course pivot**.

### D33. Primary persona = P1 (design target locked) — 2026-07-07
- **Decision**: Of the three personas (`docs/research/personas/overview.md`), **P1 (혼자선 실행이 안 되는 계획형
  학생 = 본인) is the single *primary* persona** — the design target the interface is optimized for. **P2 and P3
  remain *secondary*** (kept, not deleted): the same execution lever serves them at their own break-point on the
  shared intention→action chain.
- **Rationale (user)**: "Primary는 P1으로 두는 게 적절 — **P1도 큰 틀에서 보면 P3과 동일한 특성**을 보이기 때문."
  P1 and P3 share the same underlying failure (goal-set → can't execute / sustain), so optimizing for P1 also
  covers P3; and P1 is the **founder-persona** (richest first-hand interview data, fastest to validate) with the
  strongest efficacy fit (implementation intentions help the *motivated-but-can't-execute* most). Method basis:
  **Cooper** (design for one primary; secondaries are satisfied — `docs/research/personas/overview.md`),
  instructions.md §퍼소나 (persona = a *tool* to find the core problem, not the target itself), **JTBD** (a job
  shared across personas is top-priority).
- **Consequence**: keeps all 3 personas + a narrow target → **no profile deletion, no mass re-correction** (the
  S2 core loop already serves the shared hole). If LifePlanner later becomes a **product for others** (Q10), P3's
  larger segment may drive *messaging*, but the **design target stays P1** because P1 ≈ P3 at the core.

### D32. UX form = S2 (execution-card-first); SEPARATE plan/execution from in-the-moment logs — 2026-07-07
- **Decision**: The chosen UX shape of D3 is **S2 (execution-card-first)** (`docs/research/solutions.md`): the **home = today's
  execution cards** (flagged blocks), and the alarm expands a card into the **execution mission** (5·4·3·2·1 +
  haptic). **Planned schedule/execution and in-the-moment logs are SEPARATE surfaces — NOT one merged timeline**
  (this explicitly rejects S1).
- **Rationale (user's insight)**: planned items (일정) are pre-set and simply executed → viewed directly; spending
  and meals are **not pre-planned** — they're added **as they happen**. Mixing planned + logged on one timeline is
  awkward (different temporal natures). So calendar/plan/execution is one surface; expense/meal logging is a
  separate fast surface. **"Integration" = one app + day-level linkage** (a day aggregates its blocks, spend, meals),
  **not** a single visual timeline.
- **Consequence**: build-plan screens updated — home = execution cards; calendar tab (plan only); **separate
  quick-log** for expense/meal; a day summary *links* (not merges) the two.
- **CONFIRMED** via comparison scoring (`docs/research/solutions.md`), 2026-07-07: **S2 = 13 > S1 = 10 > S3 = 6** (사용자 가치 +
  검증 용이성 + (6−구현 복잡도)). User selected S2. Implementation plan finalized in `docs/research/features/execution-integrated-day.md`.

### D31. First solution: D3 "Execution-engineered integrated day" (hybrid) — 2026-07-07
- **Decision**: After an HMW sprint (`docs/research/hmw.md`), the user voted **C1 (execution moment) + C5 (integrated
  fast-logging day)** and chose solution draft **D3 (hybrid)**: an **integrated My Day timeline + one-tap logging
  + free-slot placement (C5)**, plus a **moment-of-execution intervention on user-flagged blocks (C1)** — commit
  framing + micro-start + optional 출발/도착, gentle. Build plan: `docs/research/features/execution-integrated-day.md`.
- **Rationale**: matches the North Star (D30) and the user's daily-use priority; references (Alarmy/Fogg for the
  execution moment; Structured/one-tap widgets for the integrated fast day) validate the approach; scoping the
  core narrow makes it fastest to validate (lean).

### D30. Product North Star: an EXECUTION ENGINE (the core differentiator) — 2026-07-07
- **Decision**: LifePlanner's differentiator is **not** its feature list (calendar/budget/calorie/reminders all
  already exist). It is being **designed end-to-end to make the user actually DO the future / self-improvement
  tasks — especially exercise — that they would skip even if written in existing apps.** Calendar, budget, and
  calorie are **supporting context** for this execution goal, not the point. (User: "기존 앱들에 아무리 적어도
  하지 않을 미래 설계·운동 같은 미래에 할 일을, 이 앱을 씀으로써 실행할 수 있게 한다면 그게 최고의 기능이다.")
- **The engine = a stack of evidence-based levers around each skip-prone task, not a bare reminder**: exact-time
  cue + alarm (implementation intentions, d≈0.65); **realistic-slot placement** via the integrated day view (find
  the real free slot — cf. the user's empty-lunch gym discovery — so they don't skip on overloaded days);
  **micro-start** (Atomic-Habits "just put your shoes on"; cf. inst2.md's task-splitting app); **no-guilt /
  return-after-miss** (defuse the what-the-hell effect); optional **temptation bundling**; and the
  **plan-vs-actual evaluation loop** that makes future plans realistic → higher execution over time.
- **Consequence**: **revisit D13** — the execution alarm is the product's heart, not something to "minimize"
  (minimize *spam*, not the execution cue).
- **Rationale**: resolves the differentiation doubt (open-questions Q9). The value is real and proven by the
  user's own life (gym-lunch story); the edge is doing the one thing existing apps don't — **engineering
  execution** — rather than being a prettier integration. The user would use it daily if the integration beats
  the scattered apps.

### D29. Evaluation depth: binary + reason only (quantitative deferred)
- **Decision**: Evaluation stays **success/fail + free-text failure reason** (D5). Quantitative comparison
  (planned 60m vs actual 90m) is **not** built now; deferred as a possible later enhancement.
- **Rationale**: Keeps the first build simple; matches the user's stated need.
