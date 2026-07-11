# LifePlanner — Information Architecture (IA)

> **Role.** How the service's **features and information are grouped, ordered, and labeled from the *user's*
> perspective** — the mental-model groups, the navigation hierarchy, and the labels (names). Derived from the
> service overview (`docs/core/service-overview.md` §3), the personas
> (`docs/research/personas/overview.md` — JTBD & mental model), the confirmed solution (**S2**, D32,
> `docs/research/features/execution-integrated-day.md`), and the design principles
> (`docs/core/design-principles.md`). Scope = **full app**; the **prototype subset** is marked in §6.
>
> Body in English; user-facing labels quoted in Korean (implement the Korean label).
>
> **Build status (2026-07-11):** the app now has a **bottom tab bar** — **홈 · 캘린더 · 기록** (expo-router
> `(tabs)`); 캘린더 is built (R1, local), 기록 is a placeholder, 돌아보기/평가 (F5) not yet present. This is an
> evolving subset of the full nav below (오늘/계획/기록/돌아보기 + 설정); labels/structure will converge as F1–F5 land.

## 1. The organizing logic (why this grouping, not a feature list)
The user does **not** think in features ("calendar", "budget", "calorie") — they think in **intent over time**:
**미리 정해두기 → 그 시각에 실행 → 그때그때 기록 → 돌아보기.** (This is the personas' shared JTBD *intention→action*
and the user's own words "다음날 계획 → 당일 실행 → 기록".) Three constraints fix the shape:
- **D32 (separate surfaces):** planned/execution and in-the-moment logs are **different in nature** (plans are
  pre-set; spending/eating are events) → they must **not** share one timeline. So "계획/실행" and "기록" are
  **separate top-level groups**.
- **Design A1/B2 (frame as intent, not tool):** label by what the user is *doing* (계획/기록/돌아보기), not by the
  mechanism (캘린더/가계부) — while keeping familiar sub-labels so recognition holds (**C2: follow conventions**).
- **Design A3/C1 (the moment comes to you):** **execution is not a place you navigate to** — the alarm *brings* it.
  So the execution moment sits **outside** the tab hierarchy as a triggered full-screen moment.

## 1.5 이름 규칙 (일관성 — 같은 것은 같은 이름으로)
한 개념 = 한 이름. 화면·문서 전체에서 아래 **사용자-대면 라벨**을 고정한다 (아래 트리·§8 화면 목록이 이를 따른다):
| 개념 | 사용자-대면 라벨(고정) | 뷰/맥락 표현 | 내부·전체앱 동의어 |
|---|---|---|---|
| 사용자가 정해 실행하는 단위 | **할 일** | "오늘의 할 일"이 **실행 카드**로 보임 | 시간 블록(time block) |
| 캘린더에 박는 중요한 약속 | **중요 일정** | 달력에 표시 | important event |
| 정한 시각의 개입 | **실행 / 실행의 순간** | 알람 발화 시 전체화면 | execution moment |
| 그때그때 남기는 것 | **기록** (지출·식사) | Log 탭 | expense / meal |
| 사후 확인 | **돌아보기** | 하루 요약·계획 대 실제 | evaluation |
- **실행 카드 = "오늘의 할 일"을 카드로 보여주는 뷰**(별개 개념 아님). **시간 블록**은 내부·전체앱 용어이고
  사용자-대면 라벨은 **할 일**로 통일한다. (§3의 영어 "blocks"도 이 "할 일"을 가리킨다.)

## 2. Information inventory (everything the service handles)
| Domain | Information |
|---|---|
| 중요 일정 (important events) | title, date, time, notify-lead, color, memo |
| 시간 블록 (D-1 plan) | start–end, title, location, kind, execution-alarm + lead + micro-note, plain reminders, recurrence, status/outcome |
| 실행의 순간 (execution moment) | commit → 5·4·3·2·1 → micro-start → "시작했어?" → done/miss/pending |
| 지출 (expense) | amount, category, payment, store, memo, day/month totals |
| 식사 (meal) | food, kcal, detail, meal-type, per-meal target vs total |
| 하루 롤업 (day aggregate) | spend total, kcal total, blocks done/miss, workout done |
| 평가 (evaluation) | success/fail + reason, rates, collected reasons |
| 계정·설정 | login, sync, JSON export/import, sound, default lead |

## 3. The user's mental-model groups → top-level structure
Four intent groups + a corner "me". (Each maps to a service tier and a persona job.)

| Group (label) | The user's intent | Contains | Why it's its own group |
|---|---|---|---|
| **오늘** (Today) ★home | "그 시각에 실행" | today's blocks as **execution cards** (S2); catch-up | the product's heart; execution-first landing (D32) |
| **계획** (Plan) | "미리 정해두기" | month **달력** (important events) → tap date → that day's **시간 블록** | planning-ahead layer; both calendar + blocks are "정해두기" |
| **기록** (Log) | "그때그때" | **지출** + **식사**, fast in-the-moment capture | separate from plan/execution by nature (D32) |
| **돌아보기** (Review) | "돌아보기" (no-guilt) | **하루 요약** + **계획 대 실제** (success/fail, reasons, rates) | the Later tier; reflection, not action |
| *(corner)* **설정·나** | "내 것 관리" | 계정·동기화 · 데이터(JSON) · 앱 설정(소리·기본 리드) | utility, not a daily destination |

> **The execution moment is NOT in the nav — because it's the *most* prominent surface, not a buried one.** The
> alarm fires → a **full-screen moment** appears (over the lock screen, or expands a card in **오늘**). It is a
> *triggered modal* that commandeers the whole screen **above every tab**, and its home **오늘** is the default
> landing — so the **core action (= success, S2) sits at the very top of the hierarchy**. You don't *go* to
> execution; it *comes* to you (design A3/C1). (By B1 we deliberately do **not** put a success *score/streak*
> dashboard at the top — the prominence is the *act*, not a metric.)

## 4. Hierarchy + labels (navigation → screen → items)

```
[하단 탭 바 — 모바일 관례(C2), 실행 우선 순서]

├─ 오늘            ★ 기본 홈 · "그 시각에 실행"
│    ├─ 오늘의 할 일(실행 카드)  다음 것 강조, 플래그된 것 부각 → 탭하면 상세 → done 표시
│    ├─ 놓친 것 캐치업        앱 열 때: "…놓쳤어요/아직 안 했죠" (부드럽게)
│    └─ ⟨알람 발화⟩ 실행의 순간   전체화면 모달(내비 밖): 커밋→5·4·3·2·1→마이크로→"시작했어?"
│
├─ 계획            "미리 정해두기"
│    ├─ 달력 (월간)          중요 일정 표시 · 스와이프 월 이동 · [+ 중요 일정 추가]
│    └─ ⟨날짜 탭⟩ 그날 설계    중요 일정 + 할 일  ·  [+ 할 일]:
│                             시각 · 제목 · 장소 · kind · 실행 알림+리드(프리셋)
│                             · 마이크로 스타트 노트 · 단순 알림(다중) · 반복
│
├─ 기록            "그때그때" (별도 표면, D32)
│    ├─ 지출                 금액·카테고리·결제·상점·메모 · 일/월 합계
│    └─ 식사                 음식·kcal·구분(아/점/저/간) · 끼니 목표 대비·일 합계
│
├─ 돌아보기         "돌아보기" (최하위 tier · 무죄책 톤)
│    ├─ 하루 요약            그날 블록 done/miss · 지출합 · 칼로리합 (구분 섹션 — 병합 아님, D32)
│    └─ 계획 대 실제         성공/실패 + 실패 사유 모음 · 성공률 내보내기 (앱이 제안 안 함, D5)
│
└─ ⟨코너 아이콘⟩ 설정·나
     ├─ 계정·동기화          로그인(id+비번) · 다기기 동기화
     ├─ 데이터               JSON 내보내기/가져오기 (merge / overwrite, D24)
     └─ 앱 설정              소리 on/off(기본 끔) · 기본 리드 · 알림
```

- **탭 수(3~4):** 핵심은 **오늘·계획·기록**. **돌아보기**는 최하위 tier라 별도 탭 대신 **오늘의 하루 요약 진입점**으로
  접어도 됨(4탭이 많으면). **설정**은 탭이 아니라 코너 아이콘(관례). → *권장: 풀앱=4탭+설정, 초기=3탭+설정.*

## 5. Labeling rationale (why these names)
- **Intent-forward, not tool-forward.** 탭은 **오늘/계획/기록/돌아보기**(행동)로, **캘린더/가계부/칼로리**(도구)로
  이름 짓지 않는다 (A1: 실행 엔진 지향, B2: 나의 의도를 비춤). 단, 화면 **안쪽** 라벨은 익숙한 **달력·지출·식사**를 그대로
  써 인지 비용 0 (C2: 관례 따르기).
- **"평가" → "돌아보기".** '평가'는 심판·죄책감을 연상 → **무죄책(B1)**에 맞게 **돌아보기**로. done/miss도
  '실패'보다 데이터로 보이게.
- **낯선 4개만 안내.** 정확 시각 실행 알림 · 계획 대 실제 · 통합 당일 기록 · D-1 스냅샷은 첫 실행 온보딩(Q3);
  나머지는 라벨만으로 이해되게(뺄셈 C2).
- **"오늘"이 기본 홈.** 앱을 열면 곧장 *그 순간 실행*으로(실행 우선 S2/D32) — 계획/기록보다 앞.
- **예측가능성 vs 의도 라벨(정직한 트레이드오프).** 대부분(오늘·기록·설정)은 예측가능+의도 둘 다 만족. **"돌아보기"만**
  예측가능성을 약간 내주고 무죄책 톤을 택함(대안 "결과/평가"는 더 예측가능하나 심판 어감). **"계획"**은 달력+할 일
  설계를 함께 담는 의도 라벨(대안 "캘린더"는 달력만 연상해 더 좁음). *단일 사용자 프로토타입은 표면이 '할 일 목록'
  하나뿐이라 예측가능성 논점이 사실상 없음 → 이 트레이드오프는 전체앱 확장 시 A/B로 검증.*

## 6. Prototype subset (지금 만드는 것)
The trigger prototype collapses the IA to **one surface + the moment**:

```
[프로토타입 IA]
├─ 홈 = 할 일 목록        ("오늘"의 최소판: 예정 + 최근 이력 + 캐치업)
│    └─ [할 일 추가/수정]  시각·제목·마이크로노트·실행알림+리드프리셋·단순알림·반복
├─ ⟨알람⟩ 실행의 순간      전체화면 모달 (내비 밖)
└─ 설정                  소리 on/off (기본 끔)
   ✗ 계획(달력) · ✗ 기록 · ✗ 돌아보기 · ✗ 계정·동기화  → 전부 프로토타입 이후
```
When the prototype validates and expands, the tabs **계획 · 기록 · 돌아보기** and **설정·나 → 계정·동기화** appear;
the home **할 일 목록** grows into **오늘의 할 일**(실행 카드 뷰). No restructure — just added tabs (architecture §7 "no pivot").

## 7. Cross-cutting
- **Two notification intensities (C1):** the **execution takeover** (오늘) vs **soft 단순 알림** (opt-in) — never
  blurred; quiet by default.
- **Day-level linkage, not merge (D6/D32):** 돌아보기's 하루 요약 *links* the day's blocks + spend + meals as
  distinct sections; it does not interleave them on one timeline.
- **Onboarding** targets only the four non-standard mechanics (§5, Q3).

## 8. 화면 목록 (각 화면의 목적 · 핵심 행동)

> 위 IA에서 도출. **핵심 행동 = 그 화면의 성공 정의**(사용자가 여기서 무엇을 해내면 성공인가). 객체 라벨은 §1.5 규칙.

| # | 화면 | IA 위치 | 목적(왜 있나) | 핵심 행동 (= 성공) | 프로토타입 |
|---|---|---|---|---|---|
| 1 | **오늘(홈)** | 오늘 | 오늘의 할 일을 실행 카드로 보여 *그 순간 실행*을 촉발 | 다음 할 일 확인 → **done 표시** (+ 캐치업) | ✅ (할 일 목록으로) |
| 2 | **할 일 상세** | 오늘/계획 | 한 할 일 보기·수정·완료 | **done 표시** / 수정 | ✅ |
| 3 | **실행의 순간**(모달) | 내비 밖·전체화면 | 착수 문턱을 무너뜨림 = **제품의 심장** | 커밋→5·4·3·2·1→마이크로→"시작했어?"→**done/miss** | ✅ |
| 4 | **캐치업**(배너/모달) | 오늘 | 놓친/미완을 **무죄책**으로 복구 | done/miss 남기기 | ✅ |
| 5 | **달력(월간)** | 계획 | 중요 일정 미리 박기·이중예약 방지 | 날짜 탭→그날 / [+ 중요 일정] | ✗ |
| 6 | **중요 일정 추가·수정** | 계획 | 중요 약속을 캘린더에 저장 | 제목·날짜·시각·알림·메모 **저장** | ✗ |
| 7 | **그날 설계**(날짜 뷰) | 계획 | 하루를 시간으로 설계(D-1) | 그날 **할 일 추가/수정** | ✗ |
| 8 | **할 일 추가·수정** | 계획 | 할 일을 정의 | 시각·제목·장소·kind·실행알림+리드·마이크로노트·단순알림·반복 **저장** | ✅ (간소판) |
| 9 | **지출 기록** | 기록 | 쓰는 순간 남김 | 금액·카테고리… **최소 탭 입력** | ✗ |
| 10 | **식사 기록** | 기록 | 먹는 순간 남김 | 음식·kcal·구분 **입력** | ✗ |
| 11 | **하루 요약** | 돌아보기 | 그날 블록·지출·칼로리를 **링크**(병합 X, D32) | 훑어보기 | ✗ |
| 12 | **계획 대 실제** | 돌아보기 | 성공/실패·사유 모아보기 | 사유 검토 · 성공률 내보내기 | ✗ |
| 13 | **설정·나** | 설정 | 계정·동기화·데이터·소리 | 로그인/동기화 · JSON · **소리 토글** | ✅ (소리만) |
| 14 | **온보딩**(첫 실행) | 전역 | 낯선 4개 기능 안내 | 이해 후 시작 | ✅ (실행 알림 1개) |

### 8.1 프로토타입 화면 세트 (지금 만드는 것 — 단일 표면 + 모달)
| 화면 | 목적 | 핵심 행동 (= 성공) |
|---|---|---|
| **홈 = 할 일 목록** | 할 일 만들고·보고, 놓친 것 복구 | [+ 할 일] · 예정/이력 보기 · 캐치업 처리 |
| **할 일 추가·수정** | 할 일을 정의 | 시각·제목·마이크로노트·실행알림+리드프리셋·단순알림·반복 **저장** |
| **실행의 순간**(모달) | 착수 개입(핵심) | 커밋→5·4·3·2·1→마이크로→"시작했어?"→**done/miss** |
| **캐치업**(홈 위) | 무죄책 복구 | done/miss |
| **설정** | 소리 | on/off 토글(기본 끔) |
- 위 5개가 프로토타입 전부. **5·6·7·9·10·11·12 + 13의 계정/데이터 = 프로토타입 이후**(계획·기록·돌아보기·계정 없음).

## Cross-references
- Service tiers + S2 screens → `docs/core/service-overview.md` §3
- Personas / JTBD / mental model → `docs/research/personas/overview.md`
- Confirmed S2 solution & screens (D31/D32) → `docs/research/features/execution-integrated-day.md`
- Design principles (labels/intent/two-intensities) → `docs/core/design-principles.md`
- Prototype scope → `docs/research/prototype/prd.md` §7 · Prototype↔full-app storage → `docs/core/data-model.md` §8
