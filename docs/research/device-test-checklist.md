# On-device verification — full app

## ⚠ STILL UNVERIFIED (2026-07-14, evening · v0.5.0)

Everything else below has passed on the A56. These need **two phones**, or a clock, and each one would fail
**silently**:

### Two phones, same account
- [ ] **Propagation.** A block added on A appears on B within seconds — **and B arms its alert**, not just the row.
- [ ] **모든 기록 삭제 on A (logged in)** → B's records disappear too, and B's alarms are cancelled. *(This was
      broken until D75: a hard delete left no trace, so B pushed the whole account back.)*
- [ ] **회원 탈퇴 on A → "기기 기록도 함께 지우기"** → B, on its next connection: signs out, **erases its records**,
      returns to the main screen, and says so. Then again with **"기기 기록은 남기기"** → B keeps its rows. (D76)
- [ ] **Afterwards, query Firestore** (`users/{uid}` and the collection-group scan) → **zero orphaned documents**.
      This is the check that caught the 134 meals; do not skip it.
- [ ] **D70 device picker** — an `실행` block takes the screen **only** on the phone(s) it names; the others get
      one buzz + a notification at the same moment.

### The briefing (D78)
- [ ] **07:00** — one **silent** notification listing the day's blocks. No sound, no vibration, no lock screen.
- [ ] A block with **아침 요약에 넣기 off** is absent from it; the calendar's preview matches what actually arrived.
- [ ] **A day with no included blocks gets NO notification** (not an empty one).
- [ ] Edit today's plan **after** 07:00 → **no second briefing today**; tomorrow's reflects the change.

### The one that cannot be rushed (D77)
- [ ] **Phone B: reboot, do NOT open the app.** Change tomorrow's plan on A. Leave B overnight. Does B's 07:00
      briefing show A's change? **This is best-effort by design** — Android decides when background work runs — so
      a failure here is a *known limit*, not a bug. Record what actually happened either way.

---

> **F0 (backend) has its own pass: jump to "F0 — the backend" at the bottom.** The sections below are the
> pre-Firebase acceptance pass, which already **PASSED (2026-07-11)**. Re-run **§A (the lever)** after F0 —
> sync must not have touched it.

---

## F0 — the backend (Auth · sync · offline) — 2026-07-13

> **The stake.** F0 added a cloud *behind* the repositories. Nothing it does is worth breaking the lever or
> losing a row, so this pass is ordered by **what would hurt most if it broke**, not by what is new.
> Everything runs on the **`lifeplanne`** Firebase project. Console:
> https://console.firebase.google.com/project/lifeplanne/firestore

### F0-0 · Regression FIRST — the lever, with a cloud underneath it (R7 · the whole product)
Do this **before touching login**. If any of it fails, stop: F0 is not worth it.
- [ ] Add a block for ~2 min from now, alert = **실행** (the default). The **execution moment appears at its
      time** — locked *and* while the phone is in use (**D41**).
- [ ] Commit → ~5 min later **"진짜 했어?"** re-opens by itself (**R7**).
- [ ] **했어** → one calm gold DONE. **아직** → 5·4·3·2·1 → "지금 나가." → no immediate miss.
- [ ] Back button *and* gesture-back **do nothing** during the moment (no side door out).
- [ ] Kill the app from recents → the alarm **still fires** (native, not JS).

### F0-1 · Airplane mode — the bug that F0 introduced and this pass exists to catch (R11)
The cloud write used to be **awaited**, and offline it never resolves → the save button would hang forever.
- [ ] **Airplane mode ON.** Add a block → **the screen closes normally** and the block is in the list.
- [ ] Edit it, delete another one, log an expense and a meal → **every screen closes; nothing hangs.**
- [ ] The **execution moment still fires** in airplane mode (it never needed a network).
- [ ] Airplane mode **OFF** → within seconds the rows appear in the Firestore console.

### F0-2 · Account — login enables sync and **nothing else** (R4/D20)
- [ ] **Logged out**, every feature works: add/edit/delete blocks, events, expenses, meals. **Nothing is gated.**
- [ ] 설정 → **로그인 · 동기화** → **Google로 계속하기** → succeeds (**no `DEVELOPER_ERROR`** — that would mean
      the SHA-1 doesn't match the signing key).
- [ ] Also try **이메일 가입** (6+ char password) → succeeds.
- [ ] **Logout** → the app still holds **every local row**. Nothing disappears.

### F0-3 · Sync, with ONE device (the Firestore console plays the second phone)
- [ ] After login, the console shows `users/{uid}/blocks|events|expenses|meals` with your rows.
- [ ] **Console → add a field / change a block's `title`** → the phone's list updates **within seconds**,
      without a restart.
- [ ] **Console → change a block's `start` time** → the phone **re-arms the alarm at the new time** (a remote
      row must move the *alarm*, not just the row).
- [ ] **Reinstall test (the real proof).** Uninstall the app → reinstall → **log in** → **every row comes back**
      from the cloud.

### F0-4 · The delete that must never come back (D53/D54 — the two bugs found by reasoning, not by running)
This is the one that would bite weeks from now, silently. Run it exactly.
1. [ ] Create a block **X** (execution alert). Confirm it in the console.
2. [ ] **Airplane mode ON** on the phone.
3. [ ] In the **console**, set X's `deletedAt` to a number (e.g. `1`) — *this is the other phone deleting it.*
4. [ ] On the phone (still offline), **edit X** (change its title or time). *This queues a write.*
5. [ ] **Airplane mode OFF.**
- [ ] **X stays deleted.** It does **not** reappear in the app.
- [ ] **X's alarm is gone** — no execution moment fires for it, ever.
- [ ] The console still shows X with `deletedAt` set (the queued edit did **not** clear it).

### F0-5 · Isolation (P-b, security rules)
- [ ] The rules live on the server (ruleset released 2026-07-13). A second account cannot see the first's data
      — check by signing up a throwaway email: its collections are **empty**, not yours.

### F0 — Definition of Done
Every box above. **F0-0 and F0-4 are non-negotiable**: the lever must still fire, and a deleted block must
never come back and take the lock screen.

---

# The pre-Firebase pass (PASSED 2026-07-11)

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

### Alert tiers + sound (D40/D42/D43)
- [ ] A new block defaults to **실행**. **(D43)**
- [ ] A block set to **알림** → at its time you get **a notification only** — no full-screen, no lock-screen
      takeover, nothing forced.
- [ ] **＋ 알림 추가** → add **1시간 전 · 15분 전 · 정각** (max 3) → the notification arrives at **exactly those
      three moments**, each labelled with which one it is. **(D45)**
- [ ] Per-block **소리** OFF → **vibration only** (for BOTH tiers). ON → it rings — including an 알림-tier block.
- [ ] 설정 → **알림음**: pick a tone (tap = preview); the execution moment plays **that** tone.

### The moment must exist only on screen (D46) — check this one carefully
- [ ] During **5·4·3·2·1**, press **back / home / recents / the power button**. → The countdown must **not
      silently end the moment**. It freezes while away and **resumes at the same phase** when you come back
      (via its notification, which is still there because you haven't answered).
- [ ] The screen must **not sleep** while the moment is up (auto-timeout is prevented).
- [ ] Press **home** during the moment → it **pulls itself back** within a second (up to 3 times), rather
      than waiting for you to tap the notification. **(D47)** After that it stops insisting — it must never
      trap you; the notification stays as the way back and the outcome stays **pending**.
- [ ] You must **not** be able to leave the moment with **back** (button *or* gesture).

### Other apps' overlays (D48)
- [ ] With **캐시워크** (or any lock-screen/ad overlay app) installed and active, fire a moment → **ours is on
      top**. If theirs pops up again, ours **comes back on top within ~2 seconds**.
- [ ] Without the **"다른 앱 위에 표시"** grant this is expected to FAIL (we fall back to a plain activity) —
      the home banner must be telling you the grant is missing.

### The unstoppable-alarm guard (D44) — check this one carefully
- [ ] While the moment is on the lock screen **ringing**, turn the screen **off**, wait, turn it **on** again.
      → The tone must **never keep playing with no screen**. It stops when the moment isn't visible, and the
      moment must still be reachable (its notification is still there until you answer it).
- [ ] Leave a ringing moment untouched → the tone **stops by itself** (hard cap), it does not ring forever.

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

**2026-07-11 — PASSED (founder, real Android device).** The full pre-Firebase app is verified: the lever fires
and re-checks, it appears while the phone is in use, it stays on top of another app's overlay (캐시워크), it can't
be escaped or silently ended, and the tone can't outlive its screen. F1–F5 all behave.

Every failure this pass produced is fixed and logged: **D41** (only a heads-up notification appeared) · **D44**
(a tone rang on with no screen and no way to stop it) · **D46** (the countdown ran on in the background and ended
the moment) · **D47** (coming back must be the app's job, not the user's) · **D48** (another app's overlay covered
the moment). Full write-ups: `docs/research/build-log.md`.

**Still unverified:** firing with the screen **fully off** for a long idle period (Doze), and multi-day
reliability — those are for the founder self-experiment, not a single pass.

The prototype's gate applies unchanged: **if the moment doesn't fire reliably, nothing else matters.**
