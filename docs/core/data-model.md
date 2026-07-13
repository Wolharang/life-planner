# LifePlanner — 데이터 설계 (Data Model)

> 이 서비스가 다루는 **모든 데이터의 종류·구조·관계**와 **각 데이터가 어디서 생성되고, 어떤 형태로 저장되고, 어떻게
> 연결되는지**. 기반: 개요(`docs/core/service-overview.md`) §3, `architecture.md`, `docs/core/spec.md §4`(스케치)를 상세 정본으로 확장, decisions.
> 스택 전제: 로컬 우선 + Firebase Firestore(사용자별 컬렉션) + 레퍼런스 앱 마이그레이션.

> **⚠️ 범위 안내 (full-app 단계) — 본문 §0–§7이 *전체 앱* 데이터 설계이고, 지금 지을 대상이다.** **완료된 트리거
> 프로토타입이 실제로 저장한 것은 §8**(완전 로컬 전용: uid·Firebase Auth·Firestore·serverTimestamp 동기화·툼스톤
> 없음; `app/`에 구현, 아카이브 `docs/research/prototype/`). §0–§7의 `/users/{uid}/…`·serverTimestamp·소프트삭제·
> 동기화가 full-app에서 프로토타입 §8 위에 얹힌다. (What의 정본 = `docs/core/service-overview.md` + `docs/core/spec.md`.)

---

## 0. 설계 원칙
- **로컬 우선(D2)**: 로컬 저장소가 진실 소스, Firestore는 사본. 모든 엔티티는 오프라인에서 생성·수정 가능.
- **사용자별 격리(D3)**: 모든 데이터는 `uid` 아래. 단일→다수 사용자 확장 시 재설계 없음.
- **클라이언트 생성 ID**: 각 레코드 `id`는 앱이 만든 **랜덤 ID**(`src/core/data/id.ts`) → 서버 없이(오프라인) 즉시
  생성. **시각만으로 만들면 안 된다** — 두 기기가 같은 밀리초에 오프라인 생성하면 같은 id가 나오고, last-write-wins가
  서로 무관한 두 레코드를 조용히 합쳐버린다. 동기화 충돌 순서는 **Firestore `serverTimestamp()`** 기준 last-write-wins(D17; 클라 `updatedAt`은 시계편차로 판정에 안 씀 — §6).
- **두 개의 조인 키**: **`uid`(소유)** + **`date`(하루 묶음, 기기 로컬 자정 기준)**. 하루가 통합의 단위(D6, "병합 아닌 연결" D32).
- **계획 vs 기록의 시간성 분리(D6)**: 시간블록은 **미리(D-1)** 만들고, 지출·식사는 **그 순간** 만든다.

## 1. 엔티티 한눈에
| 엔티티 | 계층 | 생성 시점 | 생성 위치(화면) | 평가 대상 |
|---|---|---|---|---|
| **User/Settings** | — | 가입 시 | 계정 화면 | — |
| **ImportantEvent** | 1 핵심 | 며칠~몇 주 전 | 월 달력 | ✗ (취소=삭제) |
| **TimeBlock** | 2 + 실행 + 3 평가 | **D-1**(당일 수정 가능) | Day 뷰 / 실행 카드 | ✓ 성공/실패 |
| **Expense** | 2 | **구매 그 순간** | Logs 탭 | ✗ |
| **MealEntry** | 2 | **식사 그 순간** | Logs 탭 | ✗ |
| **DayAggregate** | 파생 | 실시간 계산 | 하루 요약 | ✗ |

## 2. 엔티티 상세 (구조 · 생성 · 저장 · 연결)

### 2.1 User / Settings — 모든 데이터의 루트
| 필드 | 타입 | 필수 | 생성/출처 | 비고 |
|---|---|---|---|---|
| `uid` | string | ✓ | 가입(Firebase Auth) | 모든 컬렉션의 상위 키 |
| `loginId` | string | ✓ | 가입 | id+비밀번호(D12); 비밀번호는 **Auth가 보관, 우리 DB엔 없음** |
| `settings` | object | ✓ | 가입/설정 | `{ defaultLeadMinutes(D28), theme, … }` |
| `createdAt` | timestamp | ✓ | 자동 | |
- **저장**: 자격증명=Firebase Auth / 프로필·설정=`/users/{uid}`(문서).
- **연결**: 모든 엔티티가 `/users/{uid}/…` 하위.

### 2.2 ImportantEvent — 중요 일정 (계층1)
| 필드 | 타입 | 필수 | 생성/출처 | 비고 |
|---|---|---|---|---|
| `id` | string(UUID) | ✓ | 클라 생성 | |
| `title` | string | ✓ | 달력 추가 | |
| `date` | date `YYYY-MM-DD` | ✓ | 추가 | 캘린더 날짜 |
| `time` | time | ○ | 추가 | 시작 시각(선택) |
| `notifyLeadMinutes` | number | ○ | 추가 | 미설정 시 기본값(D28) |
| `color` | string | ○ | 추가 | 캘린더 카테고리 색(선택) |
| `memo` | string | ○ | 추가 | |
| `createdAt/updatedAt` | timestamp | ✓ | 자동 | 동기화 |
- **생성 위치/시점**: 월 달력 화면, 며칠~몇 주 전.
- **저장**: `/users/{uid}/events/{id}` + 로컬 미러. **현재 로컬 구현(2026-07-11)**: AsyncStorage `lp.events.v1`
  (`app/src/core/data/eventRepository.ts`) — Firestore/uid는 F0에서 인터페이스 뒤로 추가(architecture §7).
- **연결**: `uid` 소유, `date`로 달력에 표시. **TimeBlock과 FK 없음**(별도 레이어; 충돌 감지 안 함 D8). **평가 안 함**(취소=삭제).

### 2.3 TimeBlock — 시간 블록 + 실행 엔진 + 평가 (계층2·3의 중심)
가장 복잡한 엔티티. 세 묶음(계획 / 실행 / 평가) + **D-1 스냅샷**.
| 필드 | 타입 | 필수 | 생성/출처 | 비고 |
|---|---|---|---|---|
| `id` | string | ✓ | 클라 | |
| `date` | date | ✓ | D-1 설계 | 소속 하루 |
| `start` / `end` | time (**벽시계 로컬** HH:mm) | ✓ | D-1 | **자유 형식 구간**(D14); `date`의 로컬 시간대로 해석 — 절대시각 아님(tech-feasibility §7-1) |
| `title` | string | ✓ | D-1 | |
| `location` | string | ○ | D-1 | |
| `kind` | enum `normal\|workout\|run` | ✓ | D-1 | **운동 통합**(D22): 별도 기록 없음 |
| — 실행 — | | | | |
| `alert` | enum `soft\|execution` (**기본 `execution`**) | ✓ | D-1 | 이 블록이 갖는 **단 하나의** 알림(D40/D43). `execution`=핵심 레버(기본값). **발화는 live `start − alarmLeadMinutes` — 스냅샷 아님** |
| `alertSound` | boolean (기본 false) | ○ | D-1 | **진동만 vs 소리+진동**. 단계와 **독립**(D43): 실행도 무음일 수 있고, 알림도 울릴 수 있다. 톤 자체는 전역 설정 |
| `alertRepeat` | number (기본 1, ≤5) | ○ | D-1 | **`soft` 전용** — 5분 간격 반복 횟수(D43). 한 번 놓치면 그만인 알림은 무용지물이 되므로 |
| `alarmLeadMinutes` | number | ○ | D-1 | 리드타임(D28) |
| `microStartNote` | string | ○ | D-1 | "지금 신발 신기" |
| — D-1 스냅샷(평가 기준, D23) — | | | | |
| `snapStart/snapEnd/snapTitle` | … | ✓ | **미래엔 live 값 미러 → `date==오늘` 되면 고정** | 평가 기준(당일 수정과 분리). 미드나잇 잡 없이 자연 고정; **당일 생성 블록은 생성값=스냅샷** |
| `plannedAt` | timestamp | ✓ | D-1 | 스냅샷 시각 |
| — 평가(계층3) — | | | | |
| `status` | enum `planned\|success\|fail` | ✓ | 당일 | 성공/실패(D5) |
| `failReason` | string | ○(fail 시) | 당일 | 자유 텍스트; **정량 비교 없음**(D29) |
| `completedAt` | timestamp | ○ | 당일 | done 시각 |
| `createdAt/updatedAt` | timestamp | ✓ | 자동 | |
- **반복 없음(D37)**: TimeBlock은 **날짜별 단일 인스턴스**다(recurrence 필드 없음). "매일 헬스"는 **추가 화면에서 여러
  날짜를 한 번에 선택** → 날짜마다 **독립 블록**이 하나씩 생긴다(반복이 아니라 일괄 생성). 프로토타입의 `Recurrence`는 폐기.
- **알림은 하나뿐 — 두 단계 중 하나(D40 → D43로 개정)**: `alert` = **`soft`**(알림만 — 화면을 뚫지 않음) /
  **`execution`**(잠금화면 실행 순간). **기본값 = `execution`** — 레버가 곧 제품이므로 *빠지려면 명시적으로 빼야* 한다.
  **`none`은 폐지**(알림이 안 오는 블록은 넣을 이유가 없다; 옛 `none` 행은 `soft`로 읽는다).
  **소리(`alertSound`)는 단계와 독립** — 실행이 무음일 수도, 알림이 울릴 수도 있다(D43).
- **`status`**: `planned|success|fail` + **`skipped`**(발화 전 "오늘은 쉼" 토글 — 무죄책, 미스 아님, 실행률 분모에서 제외).
- **생성 위치/시점**: Day 뷰에서 **D-1 설계**(D6). 당일 수정 가능하되 **평가는 스냅샷 기준**(D23). 홈=실행 카드에서 실행/done.
- **저장**: `/users/{uid}/timeblocks/{id}` + 로컬 미러. **현재 로컬 구현(2026-07-11)**: AsyncStorage `lp.blocks.v1`
  (`app/src/core/data/blockRepository.ts`) — Firestore/uid는 F0에서 인터페이스 뒤로 추가(architecture §7).
- **연결**: `uid` 소유 · `date`로 하루에 묶임 · `kind=workout/run`+`status=success` → 하루 **운동 완료** 집계(D22) · `alert="execution"` → 네이티브 알람 예약 대상 · `alert="soft"` → 조용한 로컬 알림.

### 2.4 Expense — 지출(가계부) (계층2)
| 필드 | 타입 | 필수 | 생성/출처 | 비고 |
|---|---|---|---|---|
| `id` | string | ✓ | 클라 | |
| `date` | date | ✓ | 구매 순간 | |
| `timestamp` | timestamp | ✓ | 구매 순간 | 그때그때(D6) |
| `amount` | number | ✓ | 구매 | **원(KRW) 단일 통화**(D25). **유일한 필수 입력** — S4(≤2탭)를 지키기 위해 |
| `name` | string | ✓ | 구매 | 소비 이름(레퍼런스 `@expense_list`의 필수 필드). **비우면 카테고리명으로 자동 채움** — 키보드를 두 번 요구하지 않기 위해(S4) |
| `category` | enum(8 고정) | ✓ | 구매 | D16(아래) |
| `payment` | string | ○ | 구매 | 카드/결제수단 **자유 텍스트**(D26) |
| `store` | string | ○ | 구매 | |
| `memo` | string | ○ | 구매 | |
| `createdAt/updatedAt` | timestamp | ✓ | 자동 | |
- **생성 위치/시점**: **Logs 탭(별도 표면 D32)**, 돈 쓰는 순간. **사전 계획 아님.**
- **저장**: `/users/{uid}/expenses/{id}` + 로컬 미러. **마이그레이션 출처**: `reference/calculator.js` `@expense_list`(docs/research/reference-apps.md §A).
- **연결**: `date`로 하루에 묶여 DayAggregate에 **합산**. TimeBlock과 직접 연결 ✗(별도 표면).
- **고정 카테고리(D16, 8종)**: 주식 · 간식 · 문화생활 · 잡화소모 · 이동통신 · 대중교통비 · 뷰티 · 기타.

### 2.5 MealEntry — 식사/칼로리 (계층2)
| 필드 | 타입 | 필수 | 생성/출처 | 비고 |
|---|---|---|---|---|
| `id` | string | ✓ | 클라 | |
| `date` | date | ✓ | 식사 순간 | |
| `timestamp` | timestamp | ✓ | 식사 순간 | 그때그때(D6) |
| `foodName` | string | ✓ | 식사 | |
| `kcal` | number | ✓ | 식사 | **수동 입력만**(D27) |
| `detail` | string | ○ | 식사 | |
| `mealType` | enum **`아침\|점심\|저녁\|간식`** | ✓ | 식사 | **저장되는 값 자체가 한글 리터럴**(레퍼런스 `@diet_list`와 동일 · `KCAL_TARGET`의 키). 표시용이 아니라 **on-disk 열거값**이라, 영문 식별자로 바꾸려면 데이터 마이그레이션이 필요하다 — 그럴 이유가 없어 레퍼런스를 그대로 따른다 |
| `createdAt/updatedAt` | timestamp | ✓ | 자동 | |
- **사진 필드 없음(D19)** — Cloud Storage 유료 회피.
- **생성 위치/시점**: Logs 탭, 밥 먹는 순간.
- **저장**: `/users/{uid}/meals/{id}` + 로컬 미러. **마이그레이션 출처**: `reference/kcal.js` `@diet_list`(docs/research/reference-apps.md §B).
- **연결**: `date`로 하루에 묶여 합산 · **끼니 목표(D16)** 대비: 아침 400 / 점심 500 / 저녁 400 / 간식 200(하루 1500).

### 2.6 DayAggregate — 하루 요약 (파생 · 연결 지점)
| 필드 | 타입 | 출처 |
|---|---|---|
| `date` | date | id=date |
| `expenseTotal` | number | 그날 Expense 합 |
| `kcalTotal` / `kcalByMeal` | number/obj | 그날 MealEntry 합·끼니별 |
| `blocksPlanned/Success/Fail` | number | 그날 TimeBlock 집계 |
| `workoutDone` | number | `kind∈{workout,run}` & `success` |
- **성격**: **파생(derived)** — 그날의 TimeBlock+Expense+Meal에서 계산. "병합이 아니라 **연결**"(D32)의 실체.
- **저장 결정**: **기본은 클라이언트에서 실시간 계산(저장 안 함)** → Firestore **쓰기·비용 절감**(tech-feasibility §6-3).
  필요 시(과거 조회·내보내기 최적화) `/users/{uid}/days/{date}`에 캐시.
- **현재 구현(2026-07-11)**: `app/src/core/logs/aggregate.ts`의 **`dayAggregate(date, blocks, expenses, meals)`**
  — 순수 함수, 읽을 때 파생(저장 0). 화면은 `/summary?date=`. 계획 쪽 필드와 기록 쪽 필드를 **분리해서** 돌려주므로
  "두 개의 구분된 섹션"(D32)이 렌더링 취향이 아니라 **구조**로 강제된다. 운동/러닝 완료는 여기서 파생(D22).
- **연결**: 하루의 세 계층을 묶는 **유일한 롤업**. 하루 요약 화면·계획-대-실제 내보내기의 소스.

### 2.7 고정 설정값 (D16, 앱 상수)
8 가계부 카테고리 + 4 끼니 목표는 지금 **하드코딩(사용자 편집 불가, D16)**. 나중에 편집 가능해지면 `/users/{uid}.settings`로 이동.

## 3. 관계 (ER)
```
                       ┌────────────────────┐
                       │   User (uid)       │  Firebase Auth + /users/{uid}
                       └─────────┬──────────┘
        ┌──────────────┬─────────┼──────────────┬──────────────┐
        ▼              ▼         (소유: uid)      ▼              ▼
  ImportantEvent   TimeBlock                  Expense        MealEntry
  (달력·계층1)     (D-1설계+실행+평가)          (구매 순간)     (식사 순간)
        │              │                          │              │
     [date]         [date]                     [date]         [date]   ← 하루 묶음 키
        │              └───────────┬──────────────┴──────────────┘
   (독립 레이어,                    ▼
    FK 없음 D8)          ┌──────────────────────────────┐
                        │  DayAggregate(date) — 파생 롤업 │
                        │  블록 done/miss·지출합·칼로리합·운동완료 │
                        └──────────────────────────────┘
```
- **모든 것은 `uid`로 소유**되고 **`date`로 하루에 모인다.** 이 두 키가 전체 데이터의 뼈대.
- **ImportantEvent ↔ TimeBlock**: 같은 날짜에 공존하지만 **연결(FK) 없음** — 중요 일정(핵심)과 하루 설계(보조)는 별개
  레이어. (충돌 감지 안 함 D8 → 사용자가 달력에서 눈으로 보고 피함.)
- **TimeBlock → 운동 완료**: `kind`로 하루 운동 여부가 파생(별도 ActivityEntry 없음 D22).
- **평가**: TimeBlock 자신 안에서(status/failReason) + D-1 스냅샷 기준(D23). 다른 엔티티는 평가 안 함.

## 4. 저장 형태 (같은 데이터, 네 가지 표현)
| 표현 | 형태 | 용도 |
|---|---|---|
| **도메인 모델** | TypeScript `interface`(spec §4 타입) | 앱 코드가 쓰는 정본 |
| **로컬 저장** | 프로토타입=AsyncStorage · 전체앱=**Firestore 오프라인 지속성 캐시**(별도 SQLite 진실 소스 없음) | **진실 소스·오프라인** |
| **네이티브 알람 미러** | Android SharedPreferences(**파생 캐시**, 진실 소스 아님) | 킬드/재부팅 시 JS 없이 알람 재예약 |
| **클라우드** | Firestore 문서 `/users/{uid}/{컬렉션}/{id}` | 다기기 동기화 |
| **내보내기/가져오기** | 전 컬렉션 **JSON 번들** | 수동 백업 · **merge vs overwrite**(D24) |
- **레퍼런스 마이그레이션**: `@expense_list`→Expense, `@diet_list`→MealEntry 형태 변환(docs/research/reference-apps.md). 필드 매핑은 빌드 시.
- **로컬 저장(정정)** — 프로토타입=AsyncStorage. 전체앱은 **Firestore 오프라인 지속성이 곧 로컬 저장소**(캐시+큐+
  실시간+동기화를 SDK가 처리) → **별도 SQLite 진실 소스를 두면 이중 저장**이라 두지 않음. 무거운 로컬 분석이 필요해지면
  그때 **파생 읽기 전용** SQLite를 추가(진실 소스 아님). Repository 뒤에서 교체(architecture §5·§9).

## 5. 데이터 흐름 (생성 → 저장 → 동기화 → 집계)
1. **생성**(오프라인 가능): 화면에서 입력 → 클라 UUID 부여 → **로컬에 즉시 기록**(즉각 UX).
2. **동기화**: Firestore SDK가 백그라운드로 클라우드 반영 + 다른 기기 실시간 수신(오프라인이면 큐잉 후 재연결 시).
3. **집계**: DayAggregate는 로컬 데이터에서 **실시간 계산**(쓰기 없음).
4. **알림 재등록**: 동기화로 새/수정 TimeBlock(`alert≠none`)이 들어오면 각 기기가 **로컬 알람 재예약**(푸시 아님, D18). 재예약 데이터는 **네이티브 미러(SharedPreferences)**에서 읽고, **블록 생성·수정·소프트삭제마다 write-through, 삭제 시 eviction**(고스트 알람 방지).
5. **백업**: 사용자가 JSON 내보내기 → 가져올 때 서버 사본과 비교해 merge/overwrite(D24).

## 6. 동기화·정합성 규칙
- **ID**: 클라이언트 UUID(오프라인 생성). **충돌 판정**: **Firestore `serverTimestamp()`** 기준 last-write-wins(D17) —
  클라이언트 `updatedAt`은 시계 편차·DST로 순서가 깨지므로 판정에 쓰지 않고 낙관적 UX용으로만(tech-feasibility §7-2).
  **오프라인 엣지케이스**: `serverTimestamp`는 서버 도달 전 null → 두 기기가 *동시에 오프라인*으로 같은 레코드를 고치면
  '**나중에 동기화된 쪽이 이김**'(편집 시각 아님). 단일 사용자엔 사실상 무해; 다수 사용자 시 필드별 머지로 재검토.
- **삭제**: **소프트 삭제**(`deletedAt` 툼스톤) → 기기 간 전파(하드 삭제는 되살아날 위험). **읽기는 `deletedAt==null`
  필터 필수**; 중요일정 '삭제'(D8)도 소프트 삭제 툼스톤. JSON merge/overwrite(D24)는 툼스톤을 함께 처리(부활 방지).
- **날짜 경계**: `date`는 **기기 로컬 자정** 기준 `YYYY-MM-DD`(spec §4). 여행/시간대 변경 시 로컬 기준 유지.
- **비용 가드**: DayAggregate 파생(쓰기 0) · 리스너는 `uid`+해당 기간으로 좁게(tech-feasibility §6-3).
- **보안**: Firestore 규칙 `request.auth.uid == uid`인 문서만 접근(architecture §3).

## 7. 결정 근거 요약
| 설계 | 이유 | 근거 |
|---|---|---|
| 사용자별 컬렉션 + 클라 UUID | 오프라인 생성 + 단일→다수 확장 무재설계 | D2/D3 |
| `date`가 하루 조인 키(DayAggregate) | "통합=하루 단위 연결, 병합 아님" | D6/D32 |
| TimeBlock에 D-1 스냅샷 분리 | 당일 수정과 무관하게 계획-대-실제 평가 | D23 |
| 운동=TimeBlock.kind(별도 엔티티 없음) | 운동 통합, 데이터 단순화 | D22/D15 |
| 지출·식사=그 순간 생성, 별도 표면 | 계획과 시간성이 다름 | D6/D32 |
| 사진 필드 없음 | 유료 Cloud Storage 회피 | D19 |
| DayAggregate 파생(저장 선택) | Firestore 쓰기·비용 절감 | tech-feasibility §6-3 |
| 소프트 삭제 + **serverTimestamp** 충돌 판정 | 다기기 정합성(시계편차 회피) | D17, §6 |

## 8. 프로토타입 저장 (v0.3 — 트리거 프로토타입이 실제로 저장하는 것)

> **완전 로컬 전용.** 저장소 = 기기 로컬(예: AsyncStorage) 하나. **계정·uid·Firebase·Firestore·serverTimestamp·
> 툼스톤 없음.** 아래가 프로토타입의 실제 데이터 모델이며 PRD v0.3 §7.1.0의 저장 정본이다. 전체 앱 확장 시 §2–§7의
> 사용자별 Firestore 모델로 이행(Repository 뒤에서 교체, architecture §7).

### 8.1 Task (프로토타입 단위)
| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | string(UUID) | 클라 생성 |
| `title` | string | 커밋 문구·목록 표시 |
| `setTime` | time(**벽시계 로컬** HH:mm) | 발화 기준 시각(전체앱 TimeBlock의 `start`에 대응; `end`/`kind`는 프로토타입 미사용) |
| `microStartNote` | string○ | "지금 신발 신기" |
| `executionAlarm` | boolean(기본 false) | 잠금화면 실행 개입 대상 *(프로토타입 전용; 전체앱은 `alert` 3단계 — D40)* |
| `leadMinutes` | number(기본 **0**) | 유효 발화=`setTime − lead`. **미설정=0(정각)**(D28 재검토/D35), 프리셋 {0/15/30/60/custom} |
| `plainReminderOffsets` | number[] | **소프트** 알림 오프셋 다중선택 {0/15/30/60/custom}. 실행 알람과 별개(D35) |
| `recurrence` | enum `none\|daily\|weekly`(기본 none) | 반복 → 날짜별 **Occurrence**(8.2) 파생(D35) |
| `createdAt` | timestamp | **선약정 가드**(PRD §10): 커밋 문구 "어제/아까/…"·약정→발화 간격 계산 기준 |

### 8.2 Occurrence (반복 할 일의 발생·결과 — 규칙 기반)
반복 규칙에서 **필요할 때** 만드는 경량 결과 레코드(발화·해결되는 날만 실체화; 예정분은 규칙에서 계산).
| 필드 | 타입 | 비고 |
|---|---|---|
| `taskId` | string | 소속 Task |
| `date` | date `YYYY-MM-DD` | 이 발생의 날짜(기기 로컬 자정 기준) |
| `effectiveTime` | timestamp | 이 발생의 `setTime − lead` |
| `status` | enum `pending\|done\|miss\|skipped` | 결과(=전체앱 `planned\|success\|fail`에 대응; **`skipped`=사전 "오늘은 쉼"(R1) — 무죄책, 미스 아님**) |
| `source` | enum `execution-screen\|catch-up\|pre-skip`○ | **결과 기록 경로** — R3(실행화면) / R6(캐치업) / R1 "오늘은 쉼" 토글(**pre-skip**). **S2는 `execution-screen`만 집계**(캐치업·skipped는 분모에서 제외). pending이면 null |
| `outcomeAt` | timestamp○ | done/miss/skipped 기록 시각 |
- **비반복 Task**: 사실상 단일 occurrence(생성값=발생). 홈 이력·S2/S3·R6 캐치업은 모두 이 레코드에서 읽는다.
- **`skipped` 기록 규칙(R1)**: "오늘은 쉼" 토글 ON → 해당 날짜에 `status=skipped, source=pre-skip` 기록(홈 이력에 "쉼" 배지로 표시, 캐치업 대상에서 제외). 발화 전 토글 OFF → 그 기록을 제거해 재무장된 발생에 잔여 표식이 남지 않게 한다. PRD §7.1.0과 정합(충돌 시 PRD 우선).

### 8.3 Settings (프로토타입 — 로컬 단일 레코드, uid 아님)
| 필드 | 타입 | 비고 |
|---|---|---|
| `sound` | boolean(기본 **false**) | 실행 개입 소리 on/off(R8). off=햅틱만 |
| `defaultLeadMinutes`○ | number | 개인 기본 리드(선택) |
- 전체앱의 `/users/{uid}.settings`가 아니라 **기기 로컬 단일 설정 레코드**에 저장.

### 8.4 프로토타입 매핑·비적용
- **매핑**: Task↔전체앱 TimeBlock(`setTime`=`start`; `end`/`kind`/D-1 스냅샷 `snap*`/`plannedAt`=**전체앱 전용·프로토타입 미수집**). `pending/done/miss`≙`planned/success/fail`.
- **실제 이관(2026-07-11 구현)**: `lp.tasks.v1` → `lp.blocks.v1` **1회 자동 변환**(`blockRepository.ensureMigrated`,
  블록을 처음 읽을 때 수행 후 옛 키 삭제). id 유지 → 기존 outcome/fire/latency 기록이 그대로 블록에 붙는다.
  `kind`는 제목에서 추정(운동/러닝), `snap*`=생성값, `status="planned"`. **반복(daily/weekly)은 전체앱에 자리가 없어
  (D37) 오늘 날짜의 블록 하나로 이관**된다 — 미래 발생은 애초에 실체화된 적이 없다. 블록의 소프트 "단순 알림"은 폐기(D38).
- **비적용(프로토타입)**: `/users/{uid}` 컬렉션 · Firebase Auth/`loginId` · Firestore-as-store · `serverTimestamp` 충돌판정 · 소프트삭제 툼스톤 · DayAggregate(지출/칼로리 없음). 전부 §2–§7의 **전체 앱** 사항.

---
*이 문서는 spec §4 데이터 스케치의 상세 정본이다(전체 앱). 프로토타입 저장 정본은 §8. 필드가 바뀌면 함께 갱신한다.*
