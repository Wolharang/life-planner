# LifePlanner — Alternatives & Differentiation

> **What this is.** How people *currently* solve the problem LifePlanner targets — including **informal** methods
> (Excel, KakaoTalk, paper, memo, note-to-self) — with each alternative's **strengths / limits / real user pain**
> (web-sourced), then a **head-to-head differentiation check** and, where differentiation is weak, **directions to
> strengthen it**.
>
> **Method.** instructions.md **A-3 #4** (기존 대안과 차별성) + **B-5** ("더 좋다"가 아니라 "이것 없이는 안 된다";
> 간접 대안 엑셀·메모·카톡·수기도 전부 경쟁 상대) + inst2.md **Q3** (레퍼런스 연구). Companion to
> `docs/research/competitive-analysis.md` (why incumbents haven't solved it) and `docs/research/essence.md` §4
> (differentiation summary). Sources `[A#]` with tiers ★ peer-reviewed · ◐ reputable · ○ blog/secondary in §6.

---

## 1. The problem, restated (so we compare against the right thing)

LifePlanner's core job (D30 North Star) = **turn a pre-decided intention into an action at the moment** — chiefly
the self-improvement tasks (esp. exercise) people skip even when written down — wrapped in a **zero-maintenance
integrated day** (calendar + spending + meals), **free + auto-synced**, with a **plan-vs-actual loop**.

So "current alternatives" span **five jobs**. Nobody is a single competitor; users **stitch several tools + informal
habits** together. That stitching *is* the pain.

| Job | Formal tools | Informal / non-app methods |
|---|---|---|
| **A. Make myself DO the planned task** (core) | Alarmy, habit trackers (Finch/Streaks/Habitica), accountability (Focusmate) | **Willpower**, KakaoTalk "나에게 보내기", sticky note on the door, telling a friend |
| **B. Plan the day / schedule** | Google/KakaoTalk Calendar, Notion, Sunsama/Motion/Structured, TickTick | **Paper planner, bullet journal, wall calendar, Excel/Sheets, memo app** |
| **C. Budget** | 뱅크샐러드, Toss, 편한가계부 | **Excel, 수기 가계부, memo** |
| **D. Calorie / meal** | MyFitnessPal, FatSecret, 다이어트신 | **Paper food diary, memo, photos** |
| **E. Cross-device + evaluation** | (calendar sync) | **Manual re-entry, screenshots, none** |

---

## 2. Each alternative — strengths, limits, real user pain

### A. "Make myself do it" (the core job)
- **Willpower / mental resolutions.** ✔ zero setup. ✗ P1's own failure mode: "정해놓지 않으면 아무것도 안 하고
  자거나 유튜브" `[R1-9]`; evening fatigue kills it. Not a system — the thing our product replaces.
- **Alarmy (mission alarm).** ✔ **Proven to force action**: loud/escalating, can't power-off (restarts), "Wake Up
  Check" re-fires if ignored — users say it genuinely gets them up `[A4]`. ✗ **Wake-up ONLY**; hostile/deafening;
  no concept of arbitrary self-chosen tasks, no day, no logging. → *Proof the "hard-to-dismiss + do-a-task-to-clear"
  mechanism works; nobody applies it gently to general tasks.*
- **Habit trackers (Finch/Streaks/Habitica).** ✔ streak motivation, cute. ✗ **streak-guilt drives abandonment**;
  ~90% quit within 30 days; one miss → "what-the-hell" collapse `[S13][S24]` (full treatment in
  `docs/research/competitive-analysis.md`). Track state; don't help you *start*.
- **Accountability (Focusmate / body-doubling).** ✔ scheduling-with-a-person makes it happen. ✗ needs **another
  human + a booked slot**; free tier 3 sessions/wk then paid; "**another subscription is real friction**"; body
  doubling "clicks or it doesn't" `[A8]`. Not self-contained; not for a gym block.

### B. Plan the day / schedule
- **Google Calendar.** ✔ free, mature, reliable reminders, syncs. ✗ **notify-only** — and **notification fatigue is
  documented**: people override **49–96%** of alerts (a *clinical-alert* figure `[A1]`; directionally applies to any notify-only cue); alerts fail from priority-flattening, context-blind timing,
  and being easy to dismiss without acting `[A1]`. A calendar *tells*; it doesn't make you *do*. No budget/calorie,
  no plan-vs-actual.
- **KakaoTalk 톡캘린더.** ✔ everyone already has it, in-chat event add. ✗ **sync lag 30 min–1 hr (not instant)**
  `[A6]`; the incumbent P1 actually uses — pains: weak cross-device sync + no useful advance execution cue.
- **Notion / all-in-one.** ✔ infinitely customizable; can model the whole integrated day. ✗ **"most Notion systems
  fail after 2 weeks"**: maintenance overhead compounds, overwhelm from too many databases, "**a complex system
  reduces ability exactly when motivation is lowest**"; the fix is *subtraction* `[A5]`. → *People WANT our
  integrated day but abandon the DIY build because upkeep > doing.*
- **Sunsama / Motion / Structured.** ✔ real time-blocking, auto-schedule (Motion). ✗ **expensive** ($20–29/mo;
  "expensive vs Todoist $5 / Google free"), **work/project-oriented**, Sunsama plans only 2 wks, no execution push
  `[A9]`. Wrong customer (professionals), no personal integration, not free.
- **Paper planner / bullet journal / wall calendar.** ✔ tactile, flexible, no screen. ✗ **no reminder (rely on
  memory), no sync, easy to forget/ignore, visual clutter**; bullet-journal quitters cite **perfectionism + time
  cost** `[A10][A12]`.
- **Excel / Sheets.** ✔ total control, free. ✗ manual, tedious; no reminder; no mobile-moment capture; abandoned
  when entry > value.

### C. Budget
- **뱅크샐러드 / Toss (auto-link).** ✔ automatic capture. ✗ must **link all cards/accounts (privacy)**, 20–30 min
  setup, **free tier only 3 months of data**, premium for budget/annual `[A7]`.
- **편한가계부 (manual).** ✔ many *prefer* manual entry for awareness. ✗ still a separate app from everything else.
- **수기 가계부 (handwritten).** ✔ mindful. ✗ **time-consuming, error-prone, runs out of space** `[A7]`.

### D. Calorie / meal
- **MyFitnessPal.** ✔ huge food database. ✗ **only 23% still tracking after 6 months**; "food feels like
  accounting"; **shame** at logging, notification irritation, **disordered-eating association**, underestimated
  targets, database friction `[A3]`. Tedium + judgment → quit.

### E. Cross-device + evaluation
- **Manual re-entry / screenshots / nothing.** ✗ no personal tool closes the **plan-vs-actual** loop; scattered
  apps don't talk, so you re-enter or give up.

### Cross-cutting informal method
- **Note-to-self (KakaoTalk 나에게 보내기 / memo / texting yourself).** ✔ instant, frictionless capture; "a text is
  almost impossible to ignore" `[A11]`. ✗ **no time-cue, no structure — becomes a graveyard you never re-open**;
  capture ≠ execution.

---

## 3. Head-to-head — is LifePlanner *clearly* better?

Honest rule (B-5): to beat switching cost we must be **10× / can't-live-without**, not merely "nicer."

| Alternative | It wins at | It fails at | LifePlanner's edge | Verdict |
|---|---|---|---|---|
| Google/Kakao Calendar | free, sync, reliable notify | **notify ≠ do**; fatigue; no integ/eval | engineers the *doing*, not just the alert | **Better on the core job**, not on "calendar" |
| Alarmy | forces action (proven) | wake-only, hostile, no day | same commit mechanism, **gentle + any task** | **Clear gap we can own** |
| Habit trackers | streak motivation | streak-**guilt**, quit @30d | **no-guilt, miss=data** | **Better on retention stance** |
| Focusmate | human accountability | needs person+slot+$ | **self-contained cue, free** | **Better on friction/cost** |
| Notion / all-in-one | full customization | **dies of maintenance @2wk** | **zero-maintenance, purpose-built** | **Better on upkeep** |
| Sunsama/Motion | auto time-block | $20–29, work-only, no push | personal, free, execution push | **Better on target+price** |
| Paper / bullet journal | tactile, no screen | no reminder/sync, forget | timed cue + sync | **Better on reliability** |
| 뱅크샐러드 / MyFitnessPal | best-in-class *single* feature | siloed; MFP tedium/shame | integrated, no-shame, fast | **Loses on that one feature; wins on integration** |
| Excel / memo / note-to-self | free, total control | manual, no cue, graveyard | timed cue + structure + one place | **Better on follow-through** |

**Where we are NOT 10× (honest):** on any *single* feature a dedicated tool wins — calendar (Google), budget
(뱅크샐러드), calorie DB (MyFitnessPal), auto-scheduling (Motion), raw wake-force (Alarmy). We must **not** sell on
feature-parity.

**Where we ARE clearly better (the real differentiation — a *combination*, not one feature):**
1. **Execution-at-the-moment for *any* self-chosen task.** Calendars only notify (and notify-only demonstrably
   fails `[A1]`); Alarmy proves the force-mechanism but only for waking `[A4]`. **No tool engineers the crossing for
   an arbitrary planned task (esp. exercise).** This is a genuine, empty gap.
2. **Integration people actually keep.** Notion proves the integrated day is *wanted* but *abandoned* for upkeep
   `[A5]`; dedicated apps stay scattered. **Zero-maintenance, purpose-built integration** is the wedge.
3. **No-guilt retention stance.** To-do "monument to failures" `[A2]`, calorie shame `[A3]`, streak collapse
   `[S24]` — everyone punishes. **Never punishing a miss** is a defensible emotional position (Finch-proven).
4. **Free + instant-sync personal tool** vs Kakao's lag `[A6]` and $20–29/mo planners `[A9]`.
5. **Plan-vs-actual loop** — no personal-space tool closes it.

**Conclusion (matches essence.md §4):** differentiation is **real but is a *recipe*, not a single moat → copyable →
the defensibility is *implementation depth* (how well the execution moment is built).** On its own, "integrated planner" is weak;
"the tool that makes you actually do the thing, guilt-free, in one low-upkeep place" is strong **iff** the execution
lever truly works (efficacy caveats: essence.md §8, competitive-analysis.md T31/T32).

---

## 4. If differentiation is weak — how to strengthen it

Concrete directions, each tied to a pain above:

1. **Make the execution moment the *spine*, not a feature.** It is the only axis with no competitor for arbitrary
   tasks (Alarmy = wake-only). Go deep — commit framing → 5·4·3·2·1 → micro-start → haptic → short "started?"
   window — until it feels **categorically unlike a reminder**. Depth here is the only (weak) defensibility —
   implementation quality, **not a classical moat** (the recipe is copyable).
2. **Design the cue as explicitly *anti-notification-fatigue*.** Since notify-only fails at 49–96% override `[A1]`,
   our cue must be **(a) rare** (few flagged blocks, not spam — revisit D13), **(b) context-true** (fires only at
   the moment you pre-committed), **(c) friction-collapsing** (micro-start shrinks the action so it's *easier to do
   than to dismiss*). Position it as "not another notification."
3. **Beat Notion-syndrome by subtraction.** The integration's value is real but the DIY version dies of upkeep
   `[A5]`. Guardrail: **fast capture, few taps, no config**; never let calendar+budget+calorie+eval become the
   NASA-dashboard we replace. Ruthless simplicity is a feature.
4. **Own "no-guilt" as identity.** The to-do/calorie/streak shame pains are widespread and unaddressed; make
   miss=data + frictionless return a loud, deliberate stance (design + copy), not a quiet default.
5. **Optional commitment escalation (borrow Alarmy, gently).** Alarmy proves harder-to-dismiss works `[A4]`. Offer
   an **opt-in intensity**: e.g., a flagged block's cue re-fires once if you don't tap "시작했어," or a short
   full-screen moment — **no other human, no deafening alarm**. Applies the proven mechanism to the task domain =
   a concrete edge over both soft calendars and wake-only Alarmy.
6. **Treat plan-vs-actual as core value, not "later polish" — but NOT as a competitive moat (correction).** The
   loop is the product's stated purpose (make future plans realistic) and, over weeks, lets the app **personalize
   to this user** (place blocks in slots they actually keep, cue at times that work). That is real **user value**,
   so it may deserve a higher priority than "lowest." *Honest caveat (why this is not a moat):* it is per-user
   personalization / switching cost, **not** a barrier against a rival taking new users; it only matters after long
   use; and our own **JSON export keeps data portable by design** (free, no data hostage), which intentionally
   *lowers* lock-in. So sell the loop as **usefulness**, never as defensibility.

---

## 5. Open follow-ups (for later validation)
- Which single informal method does P1 *actually* rely on now (Kakao? memo? paper?) — the true switching baseline
  to beat. (Interview gap.)
- Does the opt-in commitment escalation (#5) help or annoy? → prototype A/B on P1.
- Where's the simplicity line so integration doesn't become Notion-syndrome? → scope in `docs/research/features/`.

---

## 6. References (tiers: ★ peer-reviewed · ◐ reputable · ○ blog/secondary)
- **[A1]** Notification/alert fatigue — why reminders stop working; **49–96% of clinical alerts overridden**;
  priority-flattening, context-blind timing, dismiss-without-acting — ★ [NCBI alert-fatigue review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5729261/) · ◐ [Psychology Today](https://www.psychologytoday.com/us/blog/social-instincts/202309/2-ways-to-avoid-notification-overload-and-digital-fatigue) · ○ [Akiflow](https://akiflow.com/blog/daily-reminder-habits-without-fatigue) · [MagicBell](https://www.magicbell.com/blog/how-to-use-attention-resistance-to-fight-notification-fatigue)
- **[A2]** To-do lists fail — **41% of items never completed**; "monument to failures"; discipline vs systems —
  ○ [fs.blog](https://fs.blog/the-psychology-of-the-to-do-list/) · [Fast Company](https://www.fastcompany.com/90890188/your-to-do-list-is-sabotaging-your-true-productivity-heres-what-to-do-instead) · [beyondtime](https://beyondtime.ai/blog/why-todo-lists-fail-and-what-to-do-instead)
- **[A3]** Calorie-tracking abandonment — **only 23% still tracking @6 mo**; shame, "food = accounting",
  disordered-eating association — ◐ [Newsweek](https://www.newsweek.com/fitness-apps-study-says-they-can-do-more-harm-than-good-10913928) · [StudyFinds](https://studyfinds.org/fitness-app-motivation-study-myfitnesspal/) · ○ [karinainkster](https://www.karinainkster.com/post/food-logging-pros-and-cons-of-myfitnesspal) · [GripRoom](https://www.griproom.com/fun/why-myfitnesspal-made-food-feel-like-accounting)
- **[A4]** Alarmy mission efficacy (loud/escalating/restart; **wake-only**) — ◐ [Google Play](https://play.google.com/store/apps/details?id=droom.sleepIfUCan&hl=en_US) · [Alarmy Wake-Up Missions](https://alar.my/en/blog/alarmy-wake-up-mission) · ○ [nomoresnooze review](https://www.nomoresnooze.co/p/alarmy-app-review)
- **[A5]** Notion all-in-one abandonment — **"fails after 2 weeks"**, maintenance overhead, complexity kills at low
  motivation, fix = subtract — ○ [Medium: Why Most Notion Systems Fail After 2 Weeks](https://medium.com/@2027611/why-most-notion-systems-fail-after-2-weeks-28494a190618) · [planwith.ai](https://planwith.ai/blog/why-notion-ai-planning-pages-get-abandoned) · [Notion Mastery](https://notionmastery.com/all-in-wonder-syndrome-when-notion-isnt-the-right-tool/)
- **[A6]** KakaoTalk 톡캘린더 — Kakao-account sync, **30 min–1 hr sync interval** — ◐ [Kakao 톡캘린더](https://www.kakaocorp.com/page/service/service/TalkCalendar)
- **[A7]** 가계부 apps + 수기 — 뱅크샐러드 privacy/20–30 min setup/3-mo free-tier; manual-entry preference (편한가계부);
  수기 time/error/space — ○ [종모워크 비교](https://jongmowork.com/budget-app/) · [뱅크샐러드](https://www.banksalad.com/articles/%EA%B0%80%EA%B3%84%EB%B6%80%EC%96%B4%ED%94%8C-%EC%B6%94%EC%B2%9C-%EC%93%B0%EB%8A%94%EB%B2%95-%EB%8F%88%EA%B4%80%EB%A6%AC)
- **[A8]** Focusmate — free 3/wk then £6.30–9.50/mo; scheduling-in-advance; "another subscription is real friction" —
  ○ [ND Toolkit](https://ndtoolkit.co.uk/body-doubling-apps-for-adhd-focusmate-vs-flow-club-vs-lunatask/) · [Focusmate](https://www.focusmate.com/)
- **[A9]** Time-blocking apps expensive/work-focused — Sunsama $20, Motion $29, 2-wk limit, no auto-priority;
  "expensive vs Todoist $5 / Google free" — ○ [Morgen](https://www.morgen.so/blog-posts/sunsama-vs-motion) · [Efficient App](https://efficient.app/compare/motion-vs-sunsama)
- **[A10]** Paper planner/sticky-note limits — no reminder (rely on memory), no sync, forget/stale, clutter —
  ○ [Calendar.com](https://www.calendar.com/blog/digital-calendar-vs-paper-planner-how-to-choose-the-right-scheduling-tool-for-you/) · [Mr. Pen](https://mrpen.com/blogs/all-things-mr-pen-blog/planner-hacks-how-to-use-sticky-notes-for-task-management-goal-setting)
- **[A11]** Note-to-self / texting yourself — instant capture, "a text is almost impossible to ignore"; but no
  time-cue/structure → graveyard — ○ [The Intelligence](https://theintelligence.com/41906/google-messages-note-to-self/) · [MakeUseOf](https://www.makeuseof.com/send-notes-reminders-messages-by-google-android/)
- **[A12]** Bullet-journal quit — perfectionism + time cost — ○ [Better Humans](https://betterhumans.pub/why-i-quit-bullet-journaling-80bf1eac5fee)
