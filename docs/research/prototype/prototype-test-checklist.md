# LifePlanner — Prototype Test Checklist

> **Purpose.** The complete, on-device checklist to validate the trigger-prototype MVP before the founder
> starts the N-week self-experiment. Every R1–R8 acceptance criterion, S1–S4 measurability, the reliability
> gate (kill / Doze / reboot), the product-caution invariants, and the newly added Settings features.
>
> **Gate (PRD Definition of Done):** all R1–R8 pass on the **real target device**, S1–S4 are measurable,
> and the founder can start the self-test. Items marked **[TBD]** are values to *decide/record*, not pass/fail.
>
> Run on a **real Android device** (SM_A566S or similar) — the alarm cannot be trusted on an emulator.
> Working language: English (per CLAUDE.md); in-app copy is quoted in Korean.

---

## 0. Build & launch (do this first)

- [ ] `cd app && npx expo prebuild --clean` completes (Android; iOS/CocoaPods failure is expected & irrelevant — Android-first).
- [ ] `npx expo run:android` installs and the app **launches without crashing** (the earlier dev-launcher
      `App react context shouldn't be created before` race is gone; if it recurs, fully uninstall then reinstall
      and open from the app icon, not the repeated deep link).
- [ ] First launch routes to **onboarding** (fresh install, `lp.onboarded.v1` unset).
- [ ] Fonts load with no flash of system font (Pretendard everywhere; execution serif = GowunBatang).
- [ ] No "알람 테스트" link on the home header; there is **no `/alarm-test` route** (dev bench removed).
- [ ] Fresh install starts **empty** ("첫 할 일을 정해보자") — no seeded demo task.

## 1. R1 — Task setup & home list

- [ ] Add a task: time + "무엇을"(title) required; save is disabled until both are set.
- [ ] Saving a one-shot task in the **past** is blocked ("이미 지난 시각이에요.").
- [ ] Execution alarm defaults **ON**; 반복 = 없음/매일/매주; 첫 동작 메모 optional.
- [ ] New task appears on **home**: hero "다음 실행" card (nearest) + it also shows in the **오늘** list.
- [ ] Edit a task (tap the row) → prefilled; changing the time **moves** the alarm (verify §2 fires at the new time).
- [ ] Delete (long-press → 삭제) removes it **and cancels its alarm** — no ghost fire at the old time (R1).
- [ ] **오늘은 쉼**: toggle a today occurrence OFF via the 오늘 switch → armed alarm re-arms to the next
      non-skipped date; toggle back ON → re-armed for today. Re-togglable, guilt-free.
- [ ] A skipped occurrence shows a **쉼** record in 지난 기록 (source = 사전 쉼) and is excluded from catch-up.

## 2. R2 — Firing reliability (the make-or-break gate)

> Fire time = **set time − lead**. Tolerance target **[TBD ~±1 min]** (S1).

- [ ] Fires at the effective time with the screen **on, app foreground**.
- [ ] Fires with the app **backgrounded**.
- [ ] Fires after the app is **force-killed** (swiped from recents).
- [ ] Fires over the **lock screen** (full-screen intent pierces the lock — the moment appears, not just a heads-up).
- [ ] **Lock + Doze**: lock the device and leave it idle so it enters Doze; the alarm still fires within tolerance.
- [ ] **Overnight-Doze trial** (the still-deferred one): schedule for an early-morning time, leave the phone
      locked & idle overnight, confirm it fires within tolerance the next morning.
- [ ] Fires after a **reboot** (schedule, reboot the phone, confirm it still fires — BootReceiver re-arms).
- [ ] **Recurring** (daily/weekly) re-arms the next occurrence after firing (fires again the next day/week).
- [ ] **Collision**: two tasks at the same minute both surface (queued, none dropped).
- [ ] **Lead > 0**: a task set 21:00 / lead 30 fires at **20:30**, and the commit line quotes **21:00** (SET time), not 20:30.
- [ ] **Lead into the past** (set time still future, set−lead already past) → fires **ASAP**, not skipped to tomorrow.
- [ ] **Plain reminders** (단순 알림 offsets) arrive as ordinary notifications at each chosen offset, distinct
      from the lock-screen cue; multi-offset all arrive; recurring reminders keep rolling after app open.
- [ ] Denying exact-alarm / full-screen-intent surfaces the **home permission banner** (never fails silently, §8).

## 3. R3 — Lock-screen execution moment (the heart)

- [ ] The moment is **LIGHT** (warm-white), never a dark takeover.
- [ ] Flow: **COMMIT → 5·4·3·2·1 → 첫 동작 + 시작했어? → GO → DONE / PENDING**.
- [ ] COMMIT line is time-accurate ("아까/어제/N일 전 네가 …라고 정했잖아") and **never a false "어제"**.
- [ ] **No in-flow escape**: once fired, the only responses are **응(시작했어)** / **아직** — there is no
      "오늘은 못 해" here (that only exists as the pre-fire 오늘은 쉼 toggle).
- [ ] "응, 시작했어" → GO beat ("이제 그대로 나가.") → **DONE**: one calm **gold 도장(seal)**, "안 하던 걸
      해냈다." — **no confetti**, no streak, no score.
- [ ] "아직" or idle timeout → **PENDING** (dismiss), recorded as unresolved (not a punished miss).
- [ ] Haptics fire per phase; countdown ticks 5→1.

## 4. R4 — Outcome recording (source-tagged)

- [ ] A moment "done" records **source = execution-screen**.
- [ ] A catch-up resolution records **source = catch-up**.
- [ ] A pre-fire skip records **status = skipped, source = pre-skip**.
- [ ] History ("지난 기록") shows each with the right relative time + badge (**됨 / 미스 / 쉼**), survives task deletion (denormalized title).

## 5. R5 — Local persistence / offline

- [ ] Turn on **airplane mode** → every feature works identically (add, fire, record, catch-up, settings, backup).
- [ ] There is **no login / account** anywhere in the app.
- [ ] Kill & relaunch → tasks, outcomes, history, settings all persist.

## 6. R6 — Missed / not-done catch-up

- [ ] **Fired-but-not-done** (answered 아직 / timed out) → home shows **"{title}, 아직 안 했죠"** with 했어/미룸/나중에.
- [ ] **Never-fired** (device off at the effective time, or alarm not armed) → home shows **"{title} 놓쳤어요"**.
- [ ] **Weekly** never-fired reconstruction is correct (no phantom "놓쳤어요" on the wrong weekday).
- [ ] "했어" → done (catch-up); "미룸" → miss; "나중에" → dismissed, **re-appears on the next app open**.
- [ ] Unresolved past the window **[TBD ~7 days]** auto-archives as a (guilt-free) miss and drops out of the net.

## 7. R7 — No-guilt invariants (product cautions — must all hold)

- [ ] **No streaks, consecutive counters, penalties, or shame UI** anywhere.
- [ ] A **miss is taupe `#8B7E74`, never red** — check the 미스 badge and metrics.
- [ ] Success is **one calm gold signal** — gold appears ONLY for DONE (and the commit label), never on buttons.
- [ ] The execution moment stays **bright**; the only intentional skip is the pre-fire 오늘은 쉼.
- [ ] Catch-up copy is gentle ("지금이라도?", "지금 할까요?"), never accusatory.

## 8. R8 — Settings (all functional, no stubs)

- [ ] **실행 준비 상태** card shows live "N/3 준비됨" (exact alarm · 잠금화면 · 알림); tap → onboarding to grant the rest; returning updates the count.
- [ ] **소리** toggle (default OFF = haptic-only) persists and is read at fire time even when JS is dead (turn on → next fire plays sound).
- [ ] **기본 리드 시간**: pick e.g. "30분 전" → open **할 일 추가** (new) and the lead is pre-filled to 30분 전; **직접(custom)** value also pre-fills; editing an existing task still uses that task's own lead.
- [ ] **배터리 최적화 제외**: shows 해제됨 / 제한 있음; tapping when restricted opens the system dialog; status refreshes on return.
- [ ] **백업 내보내기**: tap → OS share sheet with a `lifeplanner-backup-*.json`; the file contains tasks/outcomes/fires/missed/latencies/baseline/onboarded/settings + the sound flag.
- [ ] **가져오기 → 병합**: on a second device (or after adding tasks) import a backup with 병합 → new items appear, existing ones are not duplicated; **restored tasks' alarms are re-armed** (they fire at their times).
- [ ] **가져오기 → 덮어쓰기**: import with 덮어쓰기 → dataset fully replaced; dropped tasks leave **no ghost alarm**; new set is armed.
- [ ] Import of a non-LifePlanner / corrupt JSON shows a friendly error, changes nothing.
- [ ] **측정 (S1–S4)** link present (dev build) → opens metrics.
- [ ] Settings contains **no "추후 구현 예정" stub** anywhere.

## 9. S1–S4 — Measurability (측정 screen)

> The instrument must *compute* from real captured data. Targets are **[TBD]**.

- [ ] **S1 · 정시 발화**: after several fires, shows "within-tolerance / total" and max error; matches observed reality.
- [ ] **S2 · 착수율**: shows execution-screen done ÷ resolved (%), lists 그 순간 실행 / 캐치업 완료 / 미룸; flags **임박 생성(1시간 이내)** and the excluded %.
- [ ] **S3 · 행동 변화**: total done vs the hand-entered **baseline** (record the founder's pre-prototype count).
- [ ] **S4 · 무죄책 복귀**: % of missed occurrences that later got a done for the same task.
- [ ] Raw log ("원자료") lists recent outcomes with source + status.

## 10. [TBD] calibration — decide & record before the self-experiment

- [ ] **S1 tolerance** (currently ~±1 min) — confirm the value from the reliability trials.
- [ ] **R3 timings** — COMMIT idle (30s), MICRO auto (60s), GO beat (3.5s): confirm they feel right on-device.
- [ ] **R6 catch-up window** (~7 days) & never-fired lookback (30 days).
- [ ] **S2 / S3 targets** and **§10 pre-commit gap** threshold (1h "임박 생성").
- [ ] **S3 baseline weeks** and the founder's recorded baseline number.

## 11. Regression sweep (design/skin is provisional — re-check each round)

- [ ] Every screen: blue interactive, white/grey surfaces, no leftover forest-green; Pretendard applied.
- [ ] Execution moment: warm-white + serif + gold seal (unchanged by skin edits).
- [ ] Typecheck (`npm run typecheck`) and unit tests (`npm test`) green.

---

### Sign-off
When §§1–9 pass on-device and §10 values are recorded, the prototype is **validation-complete** and the
founder can begin the N-week self-experiment. *(2026-07-10: the founder confirmed the prototype runs and
declared it complete — the full-app docs were promoted to `docs/core/service-overview.md` etc. and this
prototype was archived under `docs/research/prototype/`.)*
