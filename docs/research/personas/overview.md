# LifePlanner — Customer Profile (Overview)

> **This is the shared overview.** Each persona is its own file (see **Personas** below):
> [persona-1](docs/research/personas/persona-1-planner-student.md) · [persona-2](docs/research/personas/persona-2-sns-timewaster.md) · [persona-3](docs/research/personas/persona-3-execution-weak.md).
> Shared scientific foundations (F1–F8), segmentation, anti-persona, POV, the six-question mapping, and **all
> references [S#]** live here; the persona files cite them.
>
> **Method.** A persona is **discovered from data, not invented** (docs/research/instructions.md §퍼소나) — a tool to find the
> core problem. We favor **psychographic/behavioral** traits over demographics, and frame with **JTBD** and a
> **POV problem statement**.
>
> **Sourcing.** Persona 1 = the user's own **33 interview answers** (2 rounds), tagged `[R1-n]` / `[R2-n]`.
> Personas 2 & 3 = **behavioral-science + market research**, tagged `[S#]` → see **§9 References** (with
> evidence tiers ★ / ◐ / ○). Body in English; the user's Korean words are quoted verbatim as data.
> §8 maps this profile to the inst2.md **six-question** customer-profile method.

---

## The 3 personas at a glance

| | **P1 · 혼자선 실행이 안 되는 계획형 학생** | **P2 · 구조를 잃어 시간을 허비하는 사람** | **P3 · 착수에서 무너지는 자기계발러** |
|---|---|---|---|
| **In a line** | Plans precisely but can't self-start alone | Has free time but no structure, so it leaks away | Sets goals but can't cross the starting line |
| **Who** | Vacation student (lectures + project + weekend job) | Heavy SNS user — most of the day on IG/Threads/X/YouTube/TikTok, no output | The New-Year gym registrant: joins → a few days → quits, every year |
| **Sharpest pain** | Doesn't follow through (evening fatigue) | Hours vanish into short-form feeds; produces nothing | Getting started is hard; then one miss → "what the hell" → register-quit cycle repeats |
| **Core lever** | Exact-time cue + reminder | A designed day (time structure) | Exact cue + micro-start, no guilt |
| **Success signal** | A month of planned gym, actually done | Empty day filled with executed blocks | Starts, and sustains without streak-guilt |

**The shared "hole" (드릴과 구멍): all three hire LifePlanner to turn an *intention* into an *action*.** The
calendar/reminders/trackers are only the mechanism.

### Primary vs secondary — one chain, where each breaks (the design target)
The three are **not different customers; they break on ONE chain** — *distal goal → make a plan → the exact
moment (start) → sustain*:
- **P2** never forms the plan (**at the plan stage** — structure vacuum).
- **P1 & P3** have the goal/plan but can't cross the **exact-moment start** (the ~10-min gap) — **P1 ≈ P3**.
- **P3** additionally **relapses**: one miss → "what-the-hell" → repeat drop-out (which is *why* P3 especially needs no-guilt).

Because a persona is a *tool to find the core problem* (instructions.md §퍼소나) and the **same JTBD
(intention→action) is shared by all three**, that job is the **top-priority thing to build** (JTBD rule: a job
shared across personas is prioritized). Per **Cooper**, we **design for a single *primary* persona and let the
others be *satisfied secondaries* — not deleted**:
- **Primary = P1** — founder-persona (richest, first-hand data), the exact-moment lever is both the
  **strongest-evidence fit** (implementation intentions help the *motivated-but-can't-execute* most) **and the
  sole differentiator**. The interface is optimized for P1's break-point.
- **Secondary = P2, P3** — served by the **same lever at their own break-point** (P2 additionally needs
  effortless plan-creation/templates; P3 additionally needs no-guilt persistence). Designing well for P1
  *satisfies* them; it does not *delete* them.
- **Locked: primary = P1 (D33, 2026-07-07).** **P1 ≈ P3 at the core** — both are *goal-set → can't
  execute / sustain* — so optimizing for P1 **also covers P3**; that is *why* P1 is a safe primary even if the
  eventual market looks like P3. If LifePlanner becomes a **product for others** (Q10), P3's larger segment may
  drive *messaging*, but the **design target stays P1**.

This resolves any "profile ↔ dev-target mismatch": the target was **always the shared hole with P1 as primary**;
the core loop (S2 execution card) already serves it, so **no mass re-correction is needed** — only this explicit
labeling. `[S1]`

---

## 0. Scientific foundation (why the shared problem is solvable)

The user states the core job plainly:
> "정해놓지 않으면 아무것도 안 하고 자거나 유튜브 보거나 해서 아무 성과가 안 나오는데, 정해놓으면 뭐라도 결과가 나온다." `[R1-9]`

Research reframes this as **an architecture problem, not a willpower problem** — and names the fix. These
findings are the canonical basis for all three personas (persona files reference them, not repeat them):

- **F1 — Implementation intentions.** An "if-then" plan specifying **when/where/how**, tied to a **situational
  cue**, roughly *triples* follow-through (meta-analysis, **d≈0.65**). The 'when' cue gains **salience** and the
  response becomes **quasi-automatic**; "the intention–behavior gap is… an architecture problem, and if-then
  planning is the architectural fix." This is **exactly** the user's self-found lever: exact time + "지금 해야
  한다" + alarm. `[R1-16, R2-4, R2-5]` `[S1]`
- **F2 — Initiation is the hard part.** Starting needs prefrontal "activation energy"; **once in progress,
  continuation is easier than initiation**. Fixes: **micro-steps**, body-doubling. Matches the user's ~10-min
  "그래도 가야지" battle at the moment of starting. `[R2-1]` `[S2]`
- **F3 — Fatigue degrades execution.** Tiredness/overload weakens executive function → avoidance rises; the
  user's #1 failure cause is 피곤함. `[R1-5, R1-15]` `[S3]`
- **F4 — Autonomous > controlled motivation (SDT).** Value-aligned reasons sustain behavior; **guilt/pressure
  does not** — explaining why the user's pride/guilt doesn't carry to the next day `[R2-6, R2-7]`, and why
  streak-guilt apps fail. `[S4]`
- **F5 — Habits are slow; one miss is fine.** Automaticity takes **~66 days (range 18–254)** and **a single
  missed day does not break the curve**; stable cues speed it. This matters because the **abstinence-violation /
  "what-the-hell" effect** turns one lapse into total collapse ("I blew it, try again next year"). → **Never
  punish a miss**; reframe it as a single event, not failure. `[S5][S24]`
- **F6 — Structure creates freedom.** Decision-making is finite (decision fatigue); pre-deciding via
  time-blocking cuts cognitive load, and the prefrontal cortex works best when it can **anticipate a task's
  duration**. → A designed day is itself an intervention. `[S6]`
- **F7 — Empty time is captured by variable-reward feeds.** Social media is a **"digital slot machine"**; the
  real competitor for a free hour is the algorithm. Heavy **short-form video** use also **degrades attention and
  prospective memory** — people literally forget what they meant to do. → Fill time with a concrete cued plan and
  **re-cue the forgotten action**. `[S7][S19]`
- **F8 — Temporal landmarks re-trigger aspiration (Fresh Start Effect).** New Year / a new week / a birthday create
  a "new me" mental account that spikes goal-setting (e.g., +33% exercise at a week's start), but the boost fades
  without structure. → Use landmarks to onboard/re-engage, but supply structure so motivation doesn't collapse. `[S22]`

**Product thesis (all 3):** the **exact-time cue + a timely reminder + the felt commitment of having recorded
it** is the architectural fix that converts intention → action. **Guilt/streaks are the wrong lever.**

---

## 1. Segmentation (psychographic / behavioral)

| Axis | **P1** | **P2** | **P3** |
|---|---|---|---|
| **Structure source** | Mostly fixed schedule + short free gaps `[R1-1]` | External deadlines/boss gone → **structure vacuum** | Structure may exist, but **initiation energy is low** |
| **Where it breaks** | Private resolutions at night (fatigue) `[R1-5,19]` | The whole day leaks to feeds/sleep | **The start**; continuation is easier |
| **Core motive** | Output accumulation + waste-aversion `[R2-8]` | Restore time structure & purpose | Turn self-improvement into action |
| **Why current tools fail** | Scattered, flawed calendar/calorie/budget `[R1-10]` | No structure → the "vortex" | Habit apps: streak-guilt, too many items |
| **Key intervention** | Exact-time cue + reminder | Give the day a structure (time-blocks) | Exact cue + micro-start, no guilt |

---

## Personas (separate files)
- **P1 — [혼자선 실행이 안 되는 계획형 학생](docs/research/personas/persona-1-planner-student.md)** (본인; primary interview data)
- **P2 — [구조를 잃어 시간을 허비하는 사람](docs/research/personas/persona-2-sns-timewaster.md)** (heavy SNS user; research-grounded)
- **P3 — [착수에서 무너지는 자기계발러](docs/research/personas/persona-3-execution-weak.md)** (repeating New-Year gym quitter; research-grounded)

---

## 5. Anti-persona (who this is NOT for) `[R1-18]`
- **Spontaneous people** who act well without planning ("계획 안 해도 즉흥으로 잘 실천하는 사람").
- People content with separate best-in-class calendar / calorie / budget apps.

---

## 6. Cross-persona solution implications (hypotheses for the design phase — not yet spec decisions)
1. **The exact-time cue + timely reminder + felt commitment is the core lever** for all three (F1). It lives on
   *time blocks* (the "secondary" tier) — **revisit whether it deserves more prominence vs. spec D13's
   "minimize."** `[R1-16, R2-1]` `[S1]`
2. **Lower the initiation threshold** — support a "next smallest step" / micro-start, not just "gym 21:00." `[S2]`
3. **Never punish a missed day** — a single miss doesn't break habit formation; streak-reset guilt is a top cause
   of abandonment. Show progress without an all-or-nothing streak. `[S5][S13]`
4. **Frame plans as *approach*, keep tracked items few (~3–5)**, and connect to the user's own values (autonomy). `[S14][S4]`
5. **Give the day a structure** — a designed day is itself the value for P2 (restores time structure). `[S10]`
6. **Consider temptation bundling** (strongest-evidence follow-through technique) — let a wanted activity ride
   alongside a planned block. `[S15]`
7. **Low-friction, offline, immediate capture** — they abandon tools that are a chore or need connectivity. `[R1-10, R2-9]`
8. **Design around fatigue and the ~10-minute delay** — don't assume instant compliance. `[R2-1][S3]`

## 7. POV problem statement (shared)
> **Planner-minded people who lack a reliable structure to start — a fixed-schedule student defeated by evening
> fatigue, a structureless job-seeker whose day leaks into YouTube, and a goal-setter who can't cross the
> starting line — all fail at the same seam: turning intention into action. They need a tool that fixes
> intentions at an exact time and cues them at that moment on every device, because for them the exact-time cue
> (not willpower, guilt, or streaks) is the architecture that makes starting happen.**

---

## 8. Six-Question coverage & additions (inst2.md method)

The persona files answer the inst2.md six questions; this section maps them and fills the two that were
under-covered — **Q3 (mental model / reference research)** and **Q6 (observable success)**. Q4/Q5 depth (current-
behavior flow and an empathy map) is deepened via interview (P1) and web (P2/P3).

**Coverage map.** Q1 Persona → each persona's Identity/Snapshot · Q2 JTBD → each persona's JTBD · Q4 Current
behavior → each persona's "Current alternatives & why they fail" · Q5 Emotions/hesitation → each persona's Pains +
user scenarios. Q3 and Q6 below.

### Q3 — Mental model & reference research (follow the standard, guide the new)
Users know "this kind of app" already; follow the **standard**, and only introduce the **new** with first-run guidance.
- **Calendar (standard to follow)** `[S26]`: month grid with **today highlighted**; on mobile, favor an **agenda
  (chronological list)** with a compact month on top; a date shows 2–3 items + **"+N more"**; **swipe to change
  month**; **category color-coding**; a prominent **quick-add**; reminders expected. Keep it decluttered.
- **Budget / calorie (standard)**: already embodied by the reference apps (`docs/research/reference-apps.md` §A/§B) — category
  grid, day-grouped list with daily/monthly totals, FAB add, JSON export/import. Reuse these conventions.
- **Habit apps (follow selectively)** `[S27]`: calendar/grid dashboard, **few-tap check-in**, done/missed state
  dots, simple progress charts. **Deliberately DROP the streak counter** — it is the one convention we reject
  (F5 / persona-3: streak-guilt drives abandonment).
- **New to LifePlanner (needs onboarding)**: the **exact-time execution alarm on time-blocks** (the core lever);
  **plan-vs-actual** check + failure reason; **integrated same-day calorie/expense** entry from the schedule; the
  **D-1 plan snapshot**. These are non-standard → introduce with first-run guidance so they don't confuse.

### Q6 — Observable success (measurable actions, per persona; for later MVP metrics)
Define success as an **observable action**, not "satisfaction," so it can be measured (Mixpanel/Amplitude/GA later).
- **Core (all three)**: user **taps the exact-time reminder → marks the time-block done** (the execution event).
- **P1**: the concrete success he named (Q6) — during a free vacation stretch, **going to the gym at the empty
  lunch hour he'd normally skip** (set the time → alarm fired → went *despite not wanting to* → more regular visits
  + better workout efficiency because the gym was uncrowded). Measure: # of planned gym blocks **executed / week**. `[R1-13]`
- **P2**: a formerly empty day records **≥ N executed blocks**; self-reported drop in scrolling.
- **P3**: **returns after a missed day** (the anti-"what-the-hell" event) and holds a modest cadence — *not* a streak.
- **Anti-metric**: do **not** optimize a streak counter — it backfires (persona-3).

---

## 9. References & evidence strength

Tier: **★** peer-reviewed / meta-analysis · **◐** reputable industry / institution · **○** blog / secondary summary.
Where a ○ source reports a stronger underlying study, that is noted.

- **[S1] Implementation intentions (if-then), d≈0.65** — ○ summaries of the ★ Gollwitzer & Sheeran (2006)
  94-study meta-analysis. [goalsandprogress](https://goalsandprogress.com/implementation-intentions-gollwitzer-how-to/) · [pomogolo](https://pomogolo.com/blog/implementation-intentions)
- **[S2] Task initiation / activation energy; micro-steps** — ○ [envisionadhd](https://www.envisionadhd.com/single-post/why-starting-is-hard-the-science-of-task-initiation-in-adult-adhd-and-what-actually-helps) · [helloklarity](https://www.helloklarity.com/post/breaking-the-first-step-barrier-how-micro-steps-can-help-adhd-brains-overcome-task-initiation-problems/)
- **[S3] Executive function weakened by fatigue/overload** — ○ [effectivestudents](https://effectivestudents.com/articles/executive-dysfunction-vs-procrastination/)
- **[S4] Self-Determination Theory (autonomous > controlled)** — ◐ [urmc.rochester.edu](https://www.urmc.rochester.edu/community-health/patient-care/self-determination-theory) · ○ [sweetinstitute](https://sweetinstitute.com/the-self-determination-theory-in-behavior-change-and-motivation/)
- **[S5] Habit formation ~66 days; one miss doesn't break it** — ○ summaries of the ★ Lally et al. (2010) study. [taskcoach](https://taskcoach.ai/blog/habit-formation-real-curve-lally-66-days/) · [mentalzon](https://mentalzon.com/en/post/7770/66-days-to-build-a-new-habit-why-it%E2%80%99s-not-a-myth-but-real-habit-psychology)
- **[S6] Decision fatigue; time-blocking cognition** — ○ (cites ★ Baumeister & MIT McGovern) [timeblockingtool](https://timeblockingtool.com/the-psychology-of-time-blocking-decision-fatigue-flow/) · [cool-timer](https://cool-timer.com/blog-pages/science-behind-time-blocking)
- **[S7] Doomscrolling variable-reward loop** — ★ Sharpe & Spooner (2025) [SAGE](https://journals.sagepub.com/doi/10.1177/17579139251331914) · ○ [neuroconnections](https://neuroconnectionsproject.substack.com/p/doomscrolling-how-scrolling-on-social)
- **[S8] Unemployment/job-search depression & loss of routine** — ◐ [healthline](https://www.healthline.com/health/depression/job-search-depression) · ○ [firststep](https://firststepsrecovery.com/what-is-unemployment-depression/)
- **[S9] Freelancer/remote mental health & procrastination** — *caveats:* 55%/64%/62% are a single Viking survey; "isolated workers 40% lower dopamine" is a secondary "Stanford" claim (primary unverified). ◐ [allwork](https://allwork.space/2024/04/how-to-stop-procrastinating-seven-practical-strategies-for-remote-workers/) · ○ [withmoxie](https://www.withmoxie.com/blog/where-to-find-support-for-mental-health-for-freelancers) · [flowster](https://flowster.app/easy-hacks-to-conquer-procrastination-for-freelancers/)
- **[S10] Jahoda latent deprivation (time structure, purpose, status)** — ★ meta-analytic [NCBI/PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10017486/)
- **[S11] Time-blocking effectiveness** — *caveats:* "73% work-life / 42% stress" and "40h≈60h (Newport)" are secondary/vendor figures. ◐ [akiflow](https://akiflow.com/blog/best-time-blocking-planner-apps/) · ○ [super-productivity](https://super-productivity.com/blog/timeboxing-productivity-science/) · [cool-timer](https://cool-timer.com/blog-pages/science-behind-time-blocking)
- **[S12] Gym/New-Year-resolution failure stats** (67% unused; ~8% keep resolutions — U. of Scranton) — ◐ [glofox](https://www.glofox.com/blog/6-new-years-resolution-gym-statistics-you-need-to-know/) · ○ [mirrorsdelivered](https://mirrorsdelivered.com/blogs/industry-news-trends/eye-opening-unused-gym-memberships-statistics) · [cftfit](https://www.cftfit.com/blog/new-years-resolution-failures-dont-be-a-statistic)
- **[S13] Habit-tracker abandonment rates & causes** — ○ [mooremomentum](https://mooremomentum.com/blog/why-do-90-of-people-quit-habit-trackers-within-30-days/) · [intentional-life](https://medium.com/the-intentional-life/why-most-habit-trackers-fail-and-what-actually-works-4481602de878)
- **[S14] Streak / loss-aversion psychology; ~3–5 habit sweet spot; approach vs avoidance** — *caveat:* 58.9%/47.1% is blog-reported. ○ [thisisglance](https://thisisglance.com/learning-centre/how-can-loss-aversion-psychology-transform-app-retention) · [plotline](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps)
- **[S15] Temptation bundling (+51% gym; strongest evidence)** — ★ Milkman/Volpp et al. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S074959782030385X) · [NBER](https://www.nber.org/roybal/6418-evaluation-temptation-bundling)
- **[S16] Tiny Habits (Fogg)** — ○ vendor/self-reported [tinyhabits](https://tinyhabits.com/)
- **[S17] Two-minute rule / Zeigarnik effect** — ◐ [todoist](https://www.todoist.com/inspiration/two-minute-rule)
- **[S18] Social-media usage time** (global ~2h21m/day; **Gen Z ~4h**; young people ~6.5h online; TikTok/YouTube/IG) — ◐ [Pew 2025](https://www.pewresearch.org/internet/2025/11/20/americans-social-media-use-2025/) · [Statista](https://www.statista.com/statistics/433871/daily-social-media-usage-worldwide/) · ○ [demandsage](https://www.demandsage.com/average-time-spent-on-social-media/)
- **[S19] Short-form video → attention, inhibitory control & prospective-memory harm ("TikTok brain")** — ★ systematic review, 98,299 participants / 71 studies. [medRxiv](https://www.medrxiv.org/content/10.1101/2025.08.27.25334540v2.full) · ◐ APA via [Euronews](https://www.euronews.com/culture/2025/11/24/tiktok-scrolling-can-cause-brain-rot-according-to-new-american-psychological-association-s) · [Vice](https://www.vice.com/en/article/tiktoks-shorts-and-reels-are-melting-your-attention-span-study-finds/)
- **[S20] Passive SNS use → loneliness/FOMO paradox; 30-min/day cut reduces loneliness+depression** — ★ Baylor study; Hunt et al. 2018 ("No More FOMO"). [Baylor](https://news.web.baylor.edu/news/story/2025/social-medias-double-edged-sword-study-links-both-active-and-passive-use-rising) · [Frontiers](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1108467/full) · [Guilford](https://guilfordjournals.com/doi/10.1521/jscp.2018.37.10.751)
- **[S21] Reducing SNS/screen overuse — structured-activity replacement, app limits, tech-free routines (multicomponent)** — ★ RCT/reviews. [PMC RCT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11846175/) · [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10140095/)
- **[S22] Fresh Start Effect — temporal landmarks motivate aspiration** — ★ Dai, Milkman & Riis (2014), Management Science. [INFORMS](https://pubsonline.informs.org/doi/10.1287/mnsc.2014.1901) · [Wharton PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)
- **[S23] Why people quit the gym / the annual cycle** (over-intensity, 41% too tired, boredom/no structure, intimidation, cost 54%; 50%/6mo, 80%/yr) — ○ trainer/industry. [gopathfit](https://gopathfit.com/why-most-people-quit-the-gym-by-mid-january-and-how-to-avoid-it/) · [incrediblegoa](https://www.incrediblegoa.org/fitness/the-psychology-behind-why-people-quit-the-gym-after-two-months-of-new-year-and-how-to-make-a-fitness-lifestyle/)
- **[S24] Abstinence-violation / "what-the-hell" effect** (one lapse → total collapse) — ◐ established clinical concept. [Psychology Today](https://www.psychologytoday.com/us/blog/stigma-addiction-and-mental-health/202309/the-abstinence-violation-effect-and-overcoming-it) · [ScienceDirect topics](https://www.sciencedirect.com/topics/psychology/abstinence-violation)
- **[S25] Identity-based habits & self-efficacy** (believable-yet-aspirational; identity > outcome goals) — ★ self-efficacy [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8137900/) · ○ [drpaulmccarthy](https://www.drpaulmccarthy.com/post/why-identity-based-habits-work-when-everything-else-fails)
- **[S26] Calendar/planner UX conventions** (month grid + mobile agenda, "+N more", swipe nav, color categories, quick-add, reminders) — ◐ [Eleken](https://www.eleken.co/blog-posts/calendar-ui) · [UX Patterns](https://uxpatterns.dev/patterns/data-display/calendar) · [UI-Patterns](https://ui-patterns.com/patterns/EventCalendar)
- **[S27] Habit-tracker UI conventions** (grid dashboard, few-tap check-in, done/missed dots, streak counter) — ○ [RapidNative](https://www.rapidnative.com/blogs/habit-tracker-calendar) · [UX case study](https://downloadfreebie.com/designing-a-habit-tracker-app-ux-ui-case-study/)
