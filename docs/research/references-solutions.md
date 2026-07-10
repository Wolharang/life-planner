# LifePlanner — Solution References & Derived Mechanics (HMW C1 + C5)

> Deep reference collection for the prioritized HMWs (C1 execution-moment, C5 integrated fast-logging day),
> per `docs/research/instructions.md` 부록 B / init1.txt ("이 문제를 해결하는 유명 서비스들의 접근 + 타 도메인 유사 패턴을 최대한
> 많이"). Goal: not to copy features, but to see **approaches** and pick a differentiated combination for
> **D3** (docs/core/decisions.md D31). Sources tagged `[T#]` → §Sources (tiers ★ peer-reviewed / ◐ industry / ○ blog).

## A. Reference library — how others solve it (approach, not features)

### A-1. C1 · Make people actually act at the moment
- **Fogg Behavior Model (B=MAP)** — behavior fires when **motivation + ability + prompt** converge. Apps boost
  motivation (XP), ability (simplify), prompt (notification). Our lever sits here: exact-time **prompt** +
  **micro-start** (ability↑) + **commit** (motivation). `[T1]`
- **Micro-start / task-splitting** — **Tiimo**'s AI checklist breaks "do laundry" into visible micro-actions to
  beat task-initiation paralysis; **Routinery** *walks you through* a routine step-by-step with a timer, pushing
  you past the transition where people "lose time to scrolling"; Atomic Habits "just put your shoes on." `[T7]`
- **Time made visible** — **Tiimo/Structured** show the day as **colored blocks with a shrinking countdown ring**
  ("see time, don't calculate"), removing the blank-start overwhelm. `[T7]`
- **Timed prompt + short action window** — **BeReal**'s daily prompt + 2-min window drives a **~72% daily
  engagement** (unheard of); urgency + reciprocity. **Duolingo**: well-timed, personality-rich notifications turn
  external nudges into internal ("skipping feels wrong"); mascot lifted DAU +5%. `[T5]`
- **Commitment devices** — **StickK/Beeminder** = goal + **real consequence** + accountability; a BMJ RCT found
  ~**50% hit weight-loss goals vs ~10% control**; Beeminder's escalating pledge (present-tense loss aversion). `[T2]`
- **Body doubling** — **Focusmate** "just show up" with a partner on camera; presence makes the brain mirror focus
  and **start**; users log hundreds of sessions. `[T6]`
- **Social visibility / kudos** — **Strava**: activity visible to people who matter → more consistency; more kudos
  → more running; **weekly cadence** suits exercise better than daily. `[T3]`
- **Location / geofence triggers** — "when you arrive/leave" converts intention into **automatic execution** and
  offloads prospective memory; dwell-time triggers reduce false fires (but only ~20% of reminder cases). `[T4]`
- **Multimodal nudges + gentle escalation** — medication-adherence apps: personalized timing, push+SMS/voice,
  and **escalate only on repeated misses** (not guilt); 91.7% acceptability. `[T8]`
- **Miss = data, not failure** — Finch/Forest/Fabulous/Loop **sustain longer** than penalty-based apps. `[T1]`
- **Ethical micro-rewards ("Dopamine Lite")** — reward **predictable in type, variable in timing**; prefer
  **competence signals** ("you improved") over hedonic; avoid gambling-like variability. Intrinsic > extrinsic
  (overjustification effect) — use points only as a **bridge**. `[T9][T1]`

### A-2. C5 · Integrated day + ultra-fast logging
- **Fastest calorie logging** — barcode (<3s), **photo/AI meal scan** (~2.6s, ~95.6% accuracy), voice; but most
  are paywalled/cloud-bound. **Lose It** gives free barcode. → free-only path: **presets + voice/text parse**;
  photo dropped (D19). `[T10]`
- **Fastest expense** — **Expensify** photo→auto-extract (merchant/date/amount), auto-matches the card, **learns
  categories** for repeat merchants; **Finny** "Tap to Track" + voice + AI text + **offline/local**. `[T11]`
- **One-tap widgets** — lock-screen widget / Android Quick-Settings tile / presets save 2–3 taps, ~30–60% time
  per entry (TapDiary, Nutrola). `[T11]`
- **Integrated-day philosophies**:
  - **Sunsama** = a **daily planning ritual** ("what matters today, how long, **does the math work?**") — intention
    is the missing ingredient; slow by design → realistic, not wishful. `[T12]`
  - **Akiflow** = "**friction is the enemy of execution**" — kill the gap between "I need to do this" and "it's on
    my calendar"; keyboard-speed capture. `[T12]`
  - **Motion** = AI auto-schedule (rebuilds the day) — powerful but users dislike it **moving their focus block**;
    borrow "suggest a free slot," not aggressive auto-move. `[T12]`

## B. Derived mechanics for D3 (adopt / optional / reject) — mapped to HMWs

### Adopt (core MVP)
1. **Visual My Day timeline** — colored blocks + shrinking countdown (Tiimo/Structured). *(C5·H8; also frames C1)* `[T7]`
2. **Execution moment = guided micro-start** — at the exact time on flagged blocks: commit framing ("어제 네가
   21:00 헬스라고 정했잖아") → **first micro-step** ("지금 신발 신기") → optional next steps (Routinery-style) → a
   **short "시작했어?" window** (BeReal-style, gentle). *(C1·H2/H6)* `[T5][T7]`
3. **Realistic-slot ritual** — a light Sunsama-style "**does it fit?**" check when planning D-1, surfacing the real
   free gaps so a workout lands where it'll actually happen. *(C1·H3/H10; the user's empty-lunch insight)* `[T12]`
4. **Friction-killed logging** — preset chips + voice/text quick-add + (P1) widget/quick-tile; **learn repeat
   entries** (Expensify-style). *(C5·H12/H16)* `[T10][T11]`
5. **Ethical micro-reward, no guilt** — a **competence signal** on execution ("안 하던 걸 해냈다"), **miss = data**
   (no streak, no penalty), gentle escalation only on repeated misses. *(supports sustain; North Star / §4)* `[T9][T1][T8]`

### Optional (P1 / later — opt-in levers)
6. **Geofence trigger** for location-bound tasks ("집을 나섰나?", "헬스장 근처") — automatic execution cue. `[T4]`
7. **Commitment/stakes** (Beeminder-style opt-in pledge) for users who want real consequences. `[T2]`
8. **Social / body-double** — share a block to a friend or an accountability partner; weekly-cadence framing. `[T3][T6]`
9. **Barcode calorie** (free DB) for faster packaged-food logging. `[T10]`

### Reject (evidence says these backfire for us)
- **Streak counters** (guilt/what-the-hell), **RPG points as the core** (overjustification), **addictive variable
  reward**, **forced stakes by default**, **aggressive auto-scheduling** that moves the user's blocks. `[T1][T9][T12]`

## C. So what makes D3 differentiated (not "just an integration")
The combination — **a visual integrated day (Akiflow-friction + Sunsama-realism) whose flagged blocks get a
guided micro-start + short window at the exact time (Tiimo/Routinery/BeReal), rewarded by competence not streaks
(Dopamine-Lite), with logging so fast it's not forgotten (Expensify/one-tap)** — is a **specific, evidence-backed
recipe for execution** that no single existing app assembles. That recipe, not the feature list, is the moat.

---

## D. Deep-dive per top-voted HMW (after the rigorous vote) — expanded solution ideas
Targeted at the winners **H2 (9) ≫ H8 (6) > H3 ≈ H16 (4)**. "★" = adopt for D3.

### H2 · 알림 후 "그 순간" 실행 (최우선)
- ★ **5-4-3-2-1 카운트다운 → 마이크로 행동** (Mel Robbins 5초 법칙): 행동 충동은 5초 내 몸을 안 움직이면 뇌가
  죽인다; 역카운트가 전전두엽을 켜 감정에서 주의를 뗀다. 실행 순간 화면에 "5·4·3·2·1 → 신발 신기". `[T13]`
- ★ **끈질긴(스누즈-불가) 부드러운 재알림** (Due/Pillo/Alarmy/Alarmate): 한 번 울고 마는 게 아니라 **무시하면
  스스로 되돌아온다**(DnD 뚫기, 단 사용자가 켠 블록만·부드럽게). `[T16]`
- ★ **햅틱 넛지**(폰/워치 진동): Apple Watch 스탠드 넛지가 **기립 확률 +43.9%**(16만 명 관찰); 햅틱은 "압박이
  아니라 행동을 명확히" 한다. 폰 햅틱은 지금, 워치는 후순위. `[T15]`
- ○ **사전공약(Ulysses 계약)**: 유혹 창이 열리기 전 미리 묶기 + 대안에 마찰(블록 동안 폰 잠금, 헬스백 미리 싸두기
  리마인드). D-1 계획 자체가 사전공약. `[T14]`
- (기존) Fogg 프롬프트 · 마이크로 스텝(Tiimo/Routinery) · 짧은 창(BeReal) · 미스=데이터(Finch). `[T7][T5][T1]`

### H3 · 과부하 날에도 진짜 빈 슬롯에 배치
- ★ **용량 인지 빈 슬롯 제안**(Reclaim/Motion): 하루 부하를 보고 **진짜 빈 시간**에 운동을 제안(자동 이동 금지 —
  사용자가 싫어함); 과부하면 스킵 대신 **더 작은 슬롯/대안** 제안. `[T17]`
- ★ **계획 오류(planning fallacy) 완충**: 80%+가 소요시간 과소평가 → **과거 실제 시간 + 50% 버퍼**로 하루를 안 꽉
  채움(그래야 운동을 "무리"라며 안 뺌). 실제 vs 추정 피드백은 평가 루프와 연결. `[T18]`

### H16 · 2탭 이내 기록 (+ H12 칼로리 즉시)
- ★ **<2초 로그**: NFC 태그(헬스백·지갑에 붙여 탭) · **Siri 한마디** · 홈/잠금 위젯 · **Apple Shortcuts**로 앱 안
  열고 즉시 기록. "마찰 제거가 추적 습관 지속의 최대 예측 변수." 프리셋·최근·빈도 원탭. `[T19]`

### H8 · 통합 하루
- ★ **"하나의 연결된 시스템"**(LiveIt "5개 앱을 꿰맨 게 아니다" · Notion Life OS): 블록에 그날 지출·칼로리가
  **자동으로 붙는** 통합감 = 3개 앱 대비 진짜 차별. `[T20][T12]`

---

## Sources (this doc)
Tier: ★ peer-reviewed/RCT · ◐ industry/established · ○ blog/secondary.
- **[T1]** Habit/gamification mechanics; Fogg; miss=data; intrinsic>extrinsic — ○ [calmevo](https://calmevo.com/apps-like-habitica/) · [mindfulsuite](https://www.mindfulsuite.com/reviews/best-habit-tracker-apps)
- **[T2]** Commitment devices; StickK/Beeminder; BMJ RCT ~50% vs 10% — ◐/★ [pledgd](https://www.pledgd.com/blog/best-commitment-contract-apps) · [aihavit](https://blog.aihavit.com/en/commitment-devices-precommitment-strategy-effectiveness-2026)
- **[T3]** Fitness adherence; Strava kudos; weekly cadence — ◐ [trophy.so](https://trophy.so/blog/strava-gamification-case-study) · ○ [bodylogic](https://www.bodylogicphysicaltherapy.com/post/strava-and-kudos-how-this-app-is-motivating-people-to-maintain-their-fitness)
- **[T4]** Geofence / location triggers — ◐ [clevertap](https://clevertap.com/blog/location-based-push-notifications/) · ○ [yougot.ai](https://www.yougot.ai/blog/reminders/location-reminders/geofence-reminder-app)
- **[T5]** BeReal timed prompt (~72% DAU); Duolingo notifications — ○ [deconstructoroffun](https://www.deconstructoroffun.com/blog/2025/08/25/features-worth-stea-borrowing-lessons-from-duolingo-tinder-draftkings-cryptocom-bereal) · [digia](https://www.digia.tech/post/duolingo-habit-forming-reminders-retention-architecture/)
- **[T6]** Body doubling / Focusmate — ◐ [focusmate](https://www.focusmate.com/blog/adhd-body-double-productivity-accountability/)
- **[T7]** ADHD routine apps — Tiimo (visual timeline + AI checklist), Routinery (step timers), Structured — ◐ [tiimoapp](https://www.tiimoapp.com/) · [routinery](https://www.routinery.app/blog/best-routines-planner-apps)
- **[T8]** Medication-adherence nudges (personalized, multimodal, escalate on repeated miss) — ★/◐ [Acare](https://acarepro.abbott.com/articles/general-topics/digital-nudges-and-medication-adherence/) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8153195/)
- **[T9]** Ethical micro-rewards ("Dopamine Lite"); competence signals — ○ [atomichabit](https://atomichabit.app/blog/dopamine-lite-ethical-micro-rewards) · [uxmag](https://uxmag.medium.com/designing-for-dopamine-540224fb0979)
- **[T10]** Fast calorie logging (barcode/photo/voice; Lose It free) — ○ [nutriscan](https://nutriscan.app/blog/posts/myfitnesspal-vs-lose-it-2026-which-app-is-faster-d4cb63c7c2) · [welling](https://www.welling.ai/articles/cal-ai-vs-myfitnesspal-2026)
- **[T11]** Fast expense (Expensify auto-extract/learn; Finny tap-to-track/voice/offline; one-tap widgets) — ◐ [Expensify](https://www.expensify.com/) · ○ [getfinny](https://getfinny.app/blog/best-automatic-expense-trackers-2026)
- **[T12]** Integrated-day philosophies (Sunsama ritual, Akiflow friction, Motion auto-schedule) — ◐ [efficient.app](https://efficient.app/compare/motion-vs-sunsama) · ○ [rivva](https://blog.rivva.app/p/motion-vs-sunsama-vs-akiflow)
- **[T13]** 5 Second Rule — physically move within 5s or the brain kills the impulse (activates PFC) — ○ [Mel Robbins](https://www.melrobbins.com/book/the-5-second-rule/) · [CNBC](https://www.cnbc.com/2025/02/18/mel-robbins-this-5-second-rule-will-help-you-get-anything-done.html)
- **[T14]** Precommitment / Ulysses contract — raise friction on the bad option, commit before the temptation window — ○ [Effectiviology](https://effectiviology.com/precommitment/) · [ModelThinkers](https://modelthinkers.com/mental-model/ulysses-pact)
- **[T15]** Apple Watch haptic nudge → **+43.9% standing** (160k subjects) — ★ [Science Advances](https://www.science.org/doi/10.1126/sciadv.adi1752) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10516489/)
- **[T16]** Persistent / snooze-proof reminders (Due/Pillo/Alarmy/Alarmate) — re-alert until you act — ○ [YouGot](https://www.yougot.ai/blog/reminders/general-reminders/persistent-reminder-app) · [Alarmate](https://alarmate.app/)
- **[T17]** AI capacity-aware auto-scheduling (Reclaim/Motion) — schedule into free time, defend focus, auto-break — ◐ [Reclaim](https://reclaim.ai/) · [efficient.app](https://efficient.app/compare/motion-vs-reclaim)
- **[T18]** Planning fallacy (80%+ underestimate); mitigation = buffers/actual-vs-estimate/task-breakdown — ★ [ACM study](https://dl.acm.org/doi/10.1145/3663384.3663404) · ○ [ohai](https://www.ohai.ai/blog/planning-fallacy/)
- **[T19]** NFC / Siri / Shortcuts / widgets — trigger→saved entry in **<2s**; friction is the top predictor of habit stickiness — ○ [Finny](https://getfinny.app/blog/apple-shortcuts-expense-tracking-automations-2026) · [TagTrack](https://apps.apple.com/us/app/tagtrack-nfc-habit-tracker/id6754224455)
- **[T20]** "Life OS" all-in-one (LiveIt "one system", Notion) — designed as one connected system, not stitched — ○ [LiveIt](https://home.journalit.app/) · [Notion life-OS overview]
