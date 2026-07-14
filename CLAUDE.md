# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working language

- **Write all repository artifacts (docs, code, comments, commit messages) in English.**
- **Reply to the user in Korean.** Reasoning and work products may be in English; the delivered answer is
  Korean. The app's UI copy is Korean — implement the Korean string, not an English gloss.

## What this is & where the truth lives

**LifePlanner** is a **no-guilt execution engine**: it makes the user actually *do* a pre-planned task at the
moment (esp. exercise), which plan/track apps fail at. **The trigger-prototype MVP is built and running** — the
execution lever (exact-time alarm → lock-screen execution moment → no-guilt local logging + measurability) — and
its code lives in **`app/`** (React Native + Expo *Dev Build*, TypeScript, Android-first). **That prototype is now
the foundation; the active phase is the full "integrated day" app** (calendar of important events + D-1 time-block
planning + in-the-moment budget & calorie tracking + cloud sync), whose product truth is
`docs/core/service-overview.md`. The docs are the spec truth; `app/` implements them. **Do not discard the
prototype's design/foundations** — its exact state is captured in `docs/research/prototype/PROTOTYPE-STATE.md`.

| Need | Doc |
|---|---|
| **What / Why — canonical PRD, read first** | `docs/core/prd.md` (full-app PRD — R1–R17 w/ acceptance criteria) · narrative: `docs/core/service-overview.md` · feature detail: `docs/core/spec.md` |
| Design ethos / decision tie-breakers | `docs/core/design-principles.md` |
| Design system — tokens / skin (incl. current app skin) | `docs/core/design-system.md` |
| How — architecture · data model | `docs/core/architecture.md` · `docs/core/data-model.md` |
| **How to build — full-app phased plan** | `docs/research/implementation-plan.md` (F0 backend → F1 calendar → … F5 eval). **All phases done; read the Headline for the live state.** |
| **What is still UNVERIFIED on a device** | `docs/research/device-test-checklist.md` — **top of file** (two phones · the 07:00 briefing · the rebooted-and-never-opened phone) |
| Confirmed decisions (D-log) | `docs/core/decisions.md` |
| **Completed prototype (foundation · archived)** | `docs/research/prototype/` — PRD, build-log, plan, test-checklist, user-flows, **`PROTOTYPE-STATE.md`** |
| Personas · research / analysis | `docs/research/` (personas/, essence, features/, competitive-analysis, hmw, information-architecture, …) |
| **Legal — the shipped policy text** | **`app/src/content/legal.ts` IS the document** (D71) — structured, not markdown. `reference/*.md` (repo root) holds the founder's **superseded drafts**; they are no longer shipped. **Change a policy → edit `legal.ts`, bump `LEGAL_VERSION`, add a 공지사항** (the terms oblige advance notice). A new field that leaves the phone belongs in 개인정보 처리방침 제2조 **in the same commit**. **Location (D84):** the app is **not a 위치정보 business** (free, on-device, never transmits the fix) → the sensor fix is **discarded immediately, no retention** (do not re-add a 6-month log); a **saved gym's coordinates DO sync**, so they are in 제2조 제2항. |

`docs/core/` = the essential **full-app** product truth; `docs/research/` = everything else (personas, analysis,
process) **and the completed-prototype archive** (`docs/research/prototype/`). Keep `docs/core/` lean.

## Work rules

- **Consult the product truth before every reply** — the canonical full-app PRD `docs/core/prd.md` (What/Why,
  R1–R17); narrative `docs/core/service-overview.md`, feature detail `docs/core/spec.md`; the archived prototype
  PRD is `docs/research/prototype/prd.md`. Keep replies aligned to the PRD, and **surface any conflict** between a
  request and it instead of silently diverging.
- **Do not write code during the planning stage without an explicit request.** (This repo is not code-only — it
  also hosts direction Q&A, problem-spotting, and research.)
- **After any doc change, summarize it in the same reply** — which file/section, what was added / removed /
  corrected, and why (one line). Never edit a doc silently.
- **Keep `docs/core/` lean:** put a doc in core only if it is essential product truth; surveys / analysis /
  vision go to `docs/research/`. Prefer extending an existing core doc over adding one.
- **Free services only** — no paid cloud, subscriptions, or billed services.
- When something is unclear or a decision is needed, **ask at the end of the reply** rather than assume.

## Product cautions (violated before — do not repeat)

- The **execution moment is LIGHT / bright** — never a dark takeover.
- **No in-flow "can't today" escape.** The only intentional skip is a **pre-fire, re-togglable "오늘은 쉼"**
  per-occurrence toggle; once the moment fires, the only responses are 응 / 아직.
- **No guilt anywhere:** no streaks / consecutive counters / penalties; a **miss is neutral data** (taupe
  `#8B7E74`, **never red**); success is **one calm gold DONE** signal — no confetti.
- The **exact-time execution cue is the core lever** — deliberately **NOT** minimized (ordinary opt-in reminders
  stay quiet; the lock-screen cue does not).
- **The words are 성공 · 미스 · 휴식.** "실패" was tried and reverted (D78): *the colour already says a miss is
  neutral (taupe, never red) — a judging word undoes what the colour refuses to do.*
- **Only the execution moment is addressed to ONE phone** (D70), *because only it takes the screen.* Notifications
  — including the 아침 요약 — go to **every** phone (D77). **Silencing a device to hide a sync gap is a cover-up.**
- **Never claim more than is true.** The 처리방침 lists only what the code actually collects; a 약관 is an
  instrument, not a message; and **an obligation written on the 기관's behalf is a promise someone can hold it to**
  (D71/D72/D76). A test fails the build if this slips.

## Build / test / run

The app is in **`app/`** (see `app/README.md`). From `app/`:

- **Install:** `npm install`, then `npx expo install --fix` (align to the Expo SDK).
- **Native project (Dev Build):** `npx expo prebuild --clean` — Expo Go can't host the native alarm module.
- **Run on device:** `npx expo run:android` — a **real** Android device; the alarm can't be trusted on an emulator.
- **Typecheck:** `npm run typecheck` · **Test:** `npm test` (Jest; single test: `npm test -- <pattern>`).
- **Gotcha:** Kotlin / native changes need a full `npx expo run:android` — a Metro reload only updates JS; a new
  native dependency needs `npx expo prebuild --clean`.
- **Release build (how the founder actually runs it — standalone, no Metro):** `cd android && ./gradlew
  assembleRelease` → `adb install -r …/app-release.apk`. Signed with the **debug** keystore (D85), so
  **`prebuild --clean` must preserve `android/app/debug.keystore`** (back it up, restore it) — the **Kakao map
  key hash is that keystore's**, and a regenerated keystore = a new hash = a 401 blank map. Heap is kept at 6 GB
  by the `withReleaseHeap` config plugin (release R8 OOMs at 2 GB).
- **Gitignored keys (never commit):** `app/google-services.json` (Firebase) and `app/kakao.json` (Kakao native
  app key + REST key, D85). Both are injected at build via `app.config.js` → `extra.*`; absent → the feature
  degrades (Google button hidden / OSM map fallback), never breaks the build.

`app/tailwind.config.js` encodes the design system (`docs/core/design-system.md`).
