# LifePlanner — HMW (솔루션 발산) / Solution Sprint

> Method: `docs/research/instructions.md` 부록 B (init1.txt). Diverge with **How-Might-We** from four lenses, then
> converge (journey map → affinity → vote → references → 3 solution drafts → pick → build plan).
> Grounded in the **North Star (D30): an execution engine** — make the user actually *do* the skip-prone
> future tasks (esp. exercise) — and the 3 personas in `docs/research/personas/overview.md`.

## Vision ↔ reality gap (the raw material for HMW)
- **Vision**: the user pre-fixes intentions at an exact time and **actually executes** them → does more, regularly.
- **Reality gaps** (from the profile): the user doesn't even do D-1 time-block planning today (only important
  events, Q4); a bare reminder isn't enough (the ~10-min "가기 싫은" battle; skips exercise on overloaded days,
  Q5); calorie logging is forgotten (slow); scattered apps, no free sync; a plain reminder ≈ what Google/Kakao
  Calendar already do (Q9). The engine must be **more than a reminder**.

---

## Diverge — HMW from 4 lenses

### ① Vision / reality gap
- **H1** 어떻게 하면 지금은 안 하는 "다음날 시간대 계획"을 부담 없이 **몇 초 만에** 짜게 할 수 있을까?
- **H2** 어떻게 하면 알림이 울린 그 **10분의 "가기 싫은" 순간**에 실제로 몸을 일으키게 할 수 있을까?
- **H3** 어떻게 하면 바쁜 날에도 운동 같은 자기개선 일을 "무리"라며 빼지 않고 **진짜 빈 시간**에 넣게 할 수 있을까?
- **H4** 어떻게 하면 "안 하던 일을 해냈다"는 **실행 성공을 체감**(작은 성취)하게 할 수 있을까?
- **H5** 어떻게 하면 **계획과 실제의 차이**를 보여줘 다음 계획을 더 현실적으로 짜게 할 수 있을까?

### ② Competition / similar services (approach, not features)
- **H6** 어떻게 하면 구글/카카오 캘린더의 "그냥 알림"을 넘어 **실행까지 이어지는 큐**를 줄 수 있을까?
- **H7** 어떻게 하면 습관앱의 **스트릭 죄책감 없이도** 지속 동기를 줄 수 있을까?
- **H8** 어떻게 하면 흩어진 캘린더+가계부+칼로리를 하나의 "하루"로 통합해 기존보다 **압도적으로 빠르게** 기록하게 할까?
- **H9** 어떻게 하면 타임블록 앱들이 놓친 **"실행 여부 평가"**를 자연스럽게 넣을 수 있을까?

### ③ Customer voice (research-grounded)
- **H10** 어떻게 하면 "덥고 사람 많아 가기 싫은" 같은 **실제 장벽**을 줄여 운동을 가게 할까? (빈 시간대 배치)
- **H11** 어떻게 하면 하루 빠진 뒤 **"에라 망했다"로 그만두지 않고 다음날 복귀**하게 할 수 있을까?
- **H12** 어떻게 하면 **칼로리 기록을 까먹지 않게**(식후 즉시·초고속) 만들 수 있을까?
- **H13** 어떻게 하면 **SNS로 새는 빈 시간을 실행 블록으로 대체**하게 할 수 있을까? (P2)

### ④ Technology (RN+Expo, Firebase, local notifications)
- **H14** 어떻게 하면 정확 시각 로컬 알림을 **Android Doze/권한 제약** 속에서도 안정적으로 울리게 할까?
- **H15** 어떻게 하면 Firestore로 **무료·오프라인·즉시 다기기 동기화**를 매끄럽게 할 수 있을까?
- **H16** 어떻게 하면 기록(칼로리·지출)을 **2탭 이내**로 입력하게 할 수 있을까?
- **H17** 어떻게 하면 기존 RN/Expo 참고 앱 코드를 실행 엔진에 **빠르게 통합**할 수 있을까?

---

## Affinity map (clusters)
- **C1 · 실행의 순간** — H2, H3, H10 (그 순간 움직이게 + 진짜 빈 슬롯 + 실제 장벽 낮추기) ← *가장 북극성 직결*
- **C2 · 실행 큐 설계** — H1, H6 (부담 없는 계획 + 알림을 넘어 실행까지 잇는 큐)
- **C3 · 무죄책 지속** — H4, H7, H11 (성취감 · 스트릭 없이 · 빠진 날 복귀)
- **C4 · 평가 루프** — H5, H9 (계획 vs 실제 → 현실적 계획)
- **C5 · 통합·초고속 기록** — H8, H12, H16, H13 (하루 통합 · 2탭 기록 · SNS 시간 대체)
- **C6 · 기술 기반(인에이블러)** — H14, H15, H17 (안정 알림 · 무료 동기화 · 코드 재사용)

## 4-perspective vote — per-HMW, 10 dots each (rigorous, init1.txt method)
Each lens distributes **10 votes** across the 17 HMWs by its own criterion (PM = business impact · Dev = ease in
the current stack · Designer = UX uplift · User = needed right now).

| HMW | PM | Dev | Des | User | **합** |
|---|--:|--:|--:|--:|--:|
| **H2 알림 후 그 순간 실행** | 3 | 1 | 3 | 2 | **9** |
| **H8 통합 하루 + 빠른 기록** | 2 | 1 | 2 | 1 | **6** |
| **H3 진짜 빈 슬롯 배치** | 1 | 0 | 1 | 2 | **4** |
| **H16 2탭 기록** | 0 | 2 | 1 | 1 | **4** |
| H1 부담 없는 계획 | 0 | 1 | 1 | 1 | 3 |
| H6 실행 큐 | 2 | 0 | 0 | 0 | 2 |
| H17 코드 재사용 | 0 | 2 | 0 | 0 | 2 |
| H15 무료·오프라인 동기화 | 0 | 2 | 0 | 0 | 2 |
| H12 칼로리 즉시 기록 | 0 | 0 | 0 | 2 | 2 |
| H5 평가 루프 | 1 | 0 | 0 | 0 | 1 |
| H4 성취 체감 | 0 | 0 | 1 | 0 | 1 |
| H7 무죄책 지속 | 0 | 0 | 1 | 0 | 1 |
| H13 SNS 시간 대체 | 1 | 0 | 0 | 0 | 1 |
| H14 정확 알림 안정 | 0 | 1 | 0 | 0 | 1 |
| H10 실제 장벽 낮추기 | 0 | 0 | 0 | 1 | 1 |
| H9 실행 평가(경쟁) · H11 복귀 | 0 | 0 | 0 | 0 | 0 |
| **계** | 10 | 10 | 10 | 10 | 40 |

**상위: H2(9) ≫ H8(6) > H3(4) ≈ H16(4) > H1(3).** → **C1(H2·H3) + C5(H8·H16)** 가 확실한 상위.

### 종합 & 확인 (init1.txt "확인할 것")
- **4관점이 일치하는가?** H2(그 순간 실행)에서 **이례적 합의** — PM·Des·User 모두 최상위. **유일한 이탈 =
  개발자**: 재사용·동기화·기록(H17·H15·H16)처럼 **쉬운 것**을 높이고 H2(풀스크린 인텐트+지오펜스=어려움)를 낮게 봄.
  개발자는 가치가 아니라 **실현성**으로 투표하니까. → **가장 가치 큰 H2가 가장 어렵다**는 신호이며, 그래서 **H2를
  먼저 기술 스파이크**해야 한다(리스크 선(先)해소).
- **사용자 관점의 고유 신호**: User만 **H12(칼로리 까먹음)·H3(과부하 시 스킵)**을 크게 봄 — 본인의 실제 페인.
  PM/Des는 낮게 본다. → 매일의 마찰은 사업/디자인 시각보다 당사자에게 더 크게 다가온다.
- **클러스터 투표(C1+C5)·사용자 투표와 일치하는가?** **YES** — top이 정확히 C1(H2·H3)+C5(H8·H16). 정밀 투표가
  거친 클러스터 투표를 **확증**한다.
- **내 직관 vs 분석이 같은가, 다르면 왜?** 내 **초기 거친 AI 투표는 C1 > C3≈C4 > C5**였으나, 정밀 per-HMW 투표는
  **C5(H8·H16)를 분명한 2위**로 끌어올려 **사용자 투표(C1+C5)와 일치**한다. 즉 정밀 방법이 내 초기 직관을
  **교정**했고 **사용자가 옳았다** — 나는 '매일 쓰게 하는 마찰 감소(H8·H16·H12)'를 과소평가했다. 이것이 "왜 달랐나"의 핵심.

---

## User vote & decision (2026-07-07)
- **User's vote: C1 (실행의 순간) + C5 (통합·초고속 기록).**
- **Divergence from the AI vote** (AI had C1 > C3 ≈ C4 > C5) and **why it's correct**: the AI weighted C3/C4 for
  differentiation and the broader personas (esp. P3); the **user weights C5 as the primary/daily user (P1)** —
  their own rule "통합이 더 나으면 매일 쓸 것" and a real current pain (calorie logging forgotten). C3 (streak-guilt)
  isn't the user's pain (minimal next-day emotion, R2-6/7); C4 (evaluation) was always the "Later" tier. Consistent
  with inst2.md's "나부터 매일 쓰고 싶은 것."
- **1순위 정의: "실행이 설계된 통합 하루" (Execution-engineered integrated day)** — make the moment-of-doing happen
  (C1) on top of a one-place, ultra-fast-to-log day (C5). Defer C3/C4. C6 is the enabler.

## References (C1 + C5) — how others solve it (approach, not features)
**C1 · make people actually act at the moment:**
- **Task-based alarms (Alarmy)**: the alarm won't dismiss until you do a **mission** (move, photo, scan) —
  grounded in the **Fogg model** (motivation + ability + **prompt**); when motivation exists but ability lacks,
  a demanding prompt + a **physical micro-action** "dramatically lowers the barrier to starting," and the tiny
  win builds momentum. [gadgethacks; mdpi 2020]
- **Self-set commitment**: people honor **their own** reminders more (matches "기록까지 해놨는데"); "Commit"
  nudges exactly when a commitment is about to lapse. [PMC]
- **Timely + implementation-intention reminders** raise adherence (right-moment cue). [PMC]

**C5 · integrated day + ultra-fast logging:**
- **One-tap logging** via **lock-screen widget / Android Quick-Settings tile / presets** — saves 2–3 taps,
  **30–60% time per entry**, no app open (TapDiary, Nutrola). [nutrientmetrics]
- **Integrated "My Day" timeline** (Structured, Brite, TickTick): unite events + tasks + habits in **one
  timeline** → "a **realistic** plan, not a wishful list" (directly supports realistic-slot placement, H3/H10).
  [structured.app; britetodo]

## Solution drafts (3) — for "실행이 설계된 통합 하루" (C1 + C5)
Each combines execution (C1) + integrated fast day (C5), weighted differently.

- **D1 · Action-Alarm-first (실행 미션 알림 중심).** Star = the exact-time block alarm becomes a **gentle
  mission**: micro-start ("지금 신발 신기"/"출발" 버튼) + optional 도착/인증; logging via quick tile. Fogg-style
  forced start. *가치:* 실행 최강(헬스-점심·Alarmy 근거). *단점:* 알림 공격성 위험(→ 사용자가 켠 블록만, 부드럽게).
  *복잡도:* 中.
- **D2 · Integrated-Timeline-first (통합 타임라인 허브 중심).** Star = **My Day 타임라인**(중요일정+블록+지출+식사
  한 화면) + **원탭 위젯 기록** + **빈 슬롯 추천**(진짜 빈 시간에 운동 배치). 실행 = 명확한 큐 + 원탭 완료(부드러움).
  *가치:* 매일 쓰는 허브(C5 우선)+칼로리 까먹음 해결. *단점:* 실행 개입이 약함(알림+완료탭). *복잡도:* 中~高.
- **D3 · Hybrid (통합 하루 + 실행 순간 개입) — 추천.** Base = 통합 타임라인·원탭 기록·빈 슬롯 추천(C5), **PLUS**
  사용자가 **플래그한 소수 블록**에만 **실행 순간 개입**(커밋 프레이밍 + 마이크로 스텝 + 선택적 출발/도착, 부드럽게)
  (C1). 무죄책·복귀는 가볍게. *가치:* 투표한 C1+C5 정확히 충족. *단점:* 범위 관리 필요. *복잡도:* 中.

## Compare (to converge)
| 기준 | D1 | D2 | **D3** |
|---|---|---|---|
| 사용자 가치(실행+매일사용) | 実行↑ 통합↓ | 통합↑ 실행↓ | **둘 다 ↑** |
| 구현 복잡도(낮을수록↑) | 中 | 中~高 | 中 |
| 검증 용이성(빨리 배우기) | 中 | 中 | **中~高(코어부터 좁게)** |
→ 잠정 추천 **D3(하이브리드)**: C1+C5 투표에 정확히 대응, 코어를 좁게 잡아 빨리 검증 가능. (사용자 확정 대기.)

## Next steps
1. ✅ User vote (C1+C5) · ✅ References · ✅ 3 solution drafts · ✅ **선택: D3 하이브리드** · ✅ 구현 계획
   (`docs/research/features/execution-integrated-day.md`, docs/core/decisions.md D31).
2. (다음) spec **D13 재조정** → 스토리보드(실행 순간 4~5컷) → 프로토타입 → 사용자 테스트 → 기술 검토(Android 정확 알람 스파이크).
