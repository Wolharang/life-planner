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
| **How to build — full-app phased plan** | `docs/research/implementation-plan.md` (F0 backend → F1 calendar → … F5 eval) |
| Confirmed decisions (D-log) | `docs/core/decisions.md` |
| **Completed prototype (foundation · archived)** | `docs/research/prototype/` — PRD, build-log, plan, test-checklist, user-flows, **`PROTOTYPE-STATE.md`** |
| Personas · research / analysis | `docs/research/` (personas/, essence, features/, competitive-analysis, hmw, information-architecture, …) |

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

## Build / test / run

The app is in **`app/`** (see `app/README.md`). From `app/`:

- **Install:** `npm install`, then `npx expo install --fix` (align to the Expo SDK).
- **Native project (Dev Build):** `npx expo prebuild --clean` — Expo Go can't host the native alarm module.
- **Run on device:** `npx expo run:android` — a **real** Android device; the alarm can't be trusted on an emulator.
- **Typecheck:** `npm run typecheck` · **Test:** `npm test` (Jest; single test: `npm test -- <pattern>`).
- **Gotcha:** Kotlin / native changes need a full `npx expo run:android` — a Metro reload only updates JS; a new
  native dependency needs `npx expo prebuild --clean`.

`app/tailwind.config.js` encodes the design system (`docs/core/design-system.md`).
