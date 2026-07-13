# On-device verification — full app (pre-Firebase)

> **Role.** The founder-run acceptance pass for everything built **before the backend (F0)**: the prototype's
> execution lever *as it now stands* plus F1–F5. Run it on a **real Android device** (never an emulator — the
> alarm can't be trusted there). Analogous to the prototype's own checklist
> (`docs/research/prototype/prototype-test-checklist.md`), but for the full app.
>
> Each item names the requirement it proves. **Anything that fails here outranks all new work.**

## 0. Build

```bash
cd app
npm install && npx expo install --fix
npx expo prebuild --clean --platform android   # native changed (Back no-op, commit-card micro-start)
npx expo run:android                            # real device, USB
```
- [ ] The app installs and opens without the dev-launcher crash.
- [ ] First run shows **onboarding**, explains *why* before asking, and **all four** grants go through:
      notification · exact alarm · full-screen intent · **다른 앱 위에 표시** · (+ battery optimization). **(R16/D41)**

## 1. The lever — the execution moment (R7, the heart)

Make a block for **~2 minutes from now**: 홈 → ＋ 블록 추가 → 제목 "테스트" · 시간 = now+2m · **실행 알림 ON** ·
리드 = 정각 · 첫 동작 = "지금 신발 신기" → 저장. **Lock the phone and put it down.**

- [ ] At the exact minute the screen **wakes and the moment covers the lock screen**. **(R7/S2)**
- [ ] **NOW THE ONE THAT FAILED:** repeat with the phone **UNLOCKED and in use** → the moment must **take over
      by itself**, not merely post a notification you have to tap. (Needs "다른 앱 위에 표시" — **D41**.)
- [ ] Its colors are the **v5 blue/gold** skin (D39), not the old forest/gold.
- [ ] It is **LIGHT/bright** — not a dark takeover. **(CLAUDE.md caution)**
- [ ] It shows the commit line ("…하기로 했잖아") **and the micro-start "딱 첫 동작 — 지금 신발 신기"**. **(A2)**
- [ ] **Back button does nothing** — you cannot escape the moment with it. **(R7 / A2 — newly fixed)**
- [ ] Tap **"응, 할게"** → it closes.
- [ ] **~5 minutes later it re-opens by itself at "진짜 했어?"**. **(R7 re-check — the founder change; never
      yet verified on a device)**
- [ ] **"응, 했어"** → one calm **gold** DONE mark. No confetti, no streak. **(R14)**
- [ ] Repeat with **"아직 안 했어"** → **5·4·3·2·1** → **"지금 나가."** → closes, and the outcome stays
      **pending** (it appears later as a gentle catch-up, **not** an immediate miss). **(R7/R14)**
- [ ] **The re-check ALSO takes over by itself** (not just a heads-up you must tap) — same D41 grant.
- [ ] **NO notification is left in the shade** after the moment ends (by answer, by 나가, or by timeout).
      Pull down the shade and check. Tapping around must **not** re-run "진짜 했어?". **(the one-shot fix)**
- [ ] Mark a block **해냄** in the app right after its commit → **no "진짜 했어?" arrives 5 minutes later**.

### The failure modes that matter
- [ ] **App killed** (swipe from recents) → the moment still fires. **(S2)**
- [ ] **Reboot** the phone before the fire time → it still fires. **(architecture §11 L4)**
- [ ] **Deny notifications** in system settings → the **home banner appears** ("실행 알림이 잠금화면을 못 뚫어요")
      and taps through to the right setting. **(R16 — this was the silent-death bug)**
- [ ] **오늘은 쉼** toggle OFF on a future block → no fire. Toggle it back ON → it fires again. **(R7)**
      The toggle **disappears** once the moment has passed (no in-flow escape).

### Alert tiers (D40) and sound (D42)
- [ ] A block set to **알림** (soft) → at its time you get **a notification + vibration only** — no full-screen,
      no lock-screen takeover, nothing forced.
- [ ] A block set to **없음** → nothing fires at all.
- [ ] 설정 → **소리 OFF** → the moment vibrates but is **silent**. **소리 ON** → **알림음** lets you pick a tone
      (tap = preview) and the moment plays **that** tone.

## 2. Migration from the prototype (must not lose or ghost anything)

If the device still has prototype data (`할 일`s):
- [ ] Old tasks appear as **today's blocks** on 홈, with their titles/times. **(data-model §8.4)**
- [ ] Old **history/records are still attached** (지난 기록 shows them).
- [ ] A previously **recurring** task does **not** keep firing on later days with nothing behind it.
      **(the ghost-alarm bug — fixed, needs proof)**
- [ ] Its old **soft reminders** no longer fire. **(D40)**

## 3. F1 — calendar + events (R1/R3)

- [ ] 캘린더 tab: square month grid, date top-left, today highlighted.
- [ ] **Swipe left/right changes month** (and ‹ › still work). **(R1)**
- [ ] Add an event (＋ 일정 추가) with a color → a **colored bar** appears in that day's cell.
- [ ] Tap a day → the panel below lists that day's **events + 하루 설계 + 하루 요약**.
- [ ] Set an event with a time and **30분 전** alert → the alert arrives ~30 min before, is **quiet**, and
      **does not pierce the lock screen**. **(R3/R15 — the whole point of the separate channel)**

## 4. F2 — day plan + My Day (R5/R6)

- [ ] 캘린더 → a date → **하루 설계**: blocks in clock order.
- [ ] **비어 있는 시간** chips show the day's real gaps; tapping one pre-fills the new block's start/end. **(H3)**
- [ ] ＋ 블록 추가 → tick **several dates** → **one independent block per date** (not a repeat). **(D37)**
- [ ] 홈 = **오늘의 블록 카드**, next one as the hero. **No 지출/식사 anywhere on 홈.** **(D32)**
- [ ] "내일 하루 설계하기" opens tomorrow's plan. **(S3)**
- [ ] Edit a block **on the day** → the alarm moves, and 돌아보기 still judges it against the D-1 plan. **(D23)**

## 5. F3 — 기록 (R8/R9)

- [ ] 기록 tab → **＋ 지출** → type an amount, tap a category, 저장 → **that's it** (no name needed). **(S4: ≤2탭)**
- [ ] Month total + the category bar + top-3 legend match what you entered.
- [ ] **＋ 식사** → the meal type is **pre-picked from the clock**; food name + kcal → 저장.
- [ ] 오늘의 기록 shows kcal vs target per meal, and **운동/러닝 O·X** flips to **O** only when a workout
      **block** is marked 해냄. **(D22 — never logged here)**
- [ ] No plan/block appears on this tab. **(D32)**

## 6. F4 / F5 — 하루 요약 · 돌아보기 (R10/R17)

- [ ] **하루 요약** (from the calendar day panel or 하루 설계 → 요약): **two separate sections** — 계획·실행 /
      기록 — never one merged timeline. **(D32)**
- [ ] Miss a block, then on 홈 tap the catch-up's **미룸** → a card offers a one-line reason → **"그냥 닫기"
      works and nothing nags you again**. **(D5 ∧ B1)**
- [ ] **설정 → 돌아보기**: this month's 해냄/미스/쉼/계획 counts, "그중 N개는 전날 미리 정해둔 것" (D23), and
      **못 한 이유들** — add / edit / remove a reason **later**. **(R17)**
- [ ] Nowhere is there a **streak, a score, a 달성률, or a red "실패"**. **(R14 — inviolable)**

## 7. Data safety (R11/R12)

- [ ] **Airplane mode**: every feature still works. **(R11)**
- [ ] 설정 → **백업 내보내기** → a JSON file. **가져오기(병합)** on top of it → nothing is duplicated, and
      alarms are re-armed (no ghosts). **(R12/D24)**
- [ ] Force-close and reopen → nothing is lost.

---

## Result

Record the outcome here (date · device · Android version), and file anything that failed as the **next work**,
ahead of F0. The prototype's own gate applies unchanged: **if the moment doesn't fire reliably, nothing else
matters.**
