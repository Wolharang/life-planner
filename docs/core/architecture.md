# LifePlanner — 아키텍처 설계 (Architecture)

> 확정 스택(**RN + Expo Dev Build + TypeScript + Firebase**, 균형안①)과 개요·리서치·`tech-feasibility.md`를
> 바탕으로 한 **시스템 배치 · 통신 · 데이터/동기화 · 핵심 레버 네이티브 구조 · 코드 구조 · 배포**의 설계. 각 결정에
> 이유를 붙였다. 범위: **트리거 프로토타입 → 전체 앱**(같은 토대, 방향 전환 없음).

> **⚠️ 범위 안내 (full-app 단계).** 이 문서는 *전체 앱* 설계다. **트리거 프로토타입(완료 — `app/`에 구현, 상태
> 스냅샷 `docs/research/prototype/PROTOTYPE-STATE.md`)에서 이미 만든 부분 = §4 네이티브 알람 계층 + execution
> feature + 로컬 저장소(AsyncStorage) + 로컬 알림.** **나머지 — Firebase(Firestore·Auth·동기화·보안규칙 —
> §0·§1·§2·§3·§10·§11)와 §5 코드트리의 `/calendar`·`/logs`·`/evaluation`·`/account`·`/core/sync` — 가 지금
> full-app 단계에서 지을 대상이다** (프로토타입 토대 위에 확장; 방향 전환 없음). 프로토타입이 구현한 정합=§4.1,
> 저장=data-model §8.

---

## 0. 한눈에 — 아키텍처 스타일
**두꺼운 클라이언트(thick client) + 얇은 관리형 백엔드(BaaS).** 앱의 두뇌·데이터는 **기기 안**에 있고(로컬 우선),
클라우드(Firebase)는 **다기기 동기화용**으로만 붙는다. **커스텀 서버·API 계층이 없다**(Firebase SDK가 곧 데이터
API). 알림은 **온디바이스 로컬**(서버 푸시 없음).
- **왜**: 솔로 개발 + 무료(D10) + 오프라인 우선(D2/D17) + 운영 부담 0. 서버를 만들면 비용·유지·복잡도가 늘고 우리
  가치(오프라인에서도 즉시 작동)와 안 맞는다.

## 1. 시스템 배치 (Topology)

```
┌──────────────────────── ANDROID 기기 (thick client) ────────────────────────┐
│  React Native + Expo (TypeScript)                                            │
│  [Calendar] [TimeBlocks] [Execution*] [Logs] [Evaluation] [Account]  ← features│
│        │  repository 인터페이스 (features는 DB/Firestore를 직접 안 만짐)        │
│  ┌─────▼───────────────────────────────────────────────────────┐            │
│  │  Repositories (local-first)                                   │            │
│  └─────┬─────────────────────────────────┬─────────────────────┘            │
│  ┌─────▼───────────────────────────────────────────────┐                    │
│  │ Local store = 진실 소스·오프라인 (단일)                 │─ Firestore SDK ─┐ │
│  │ proto: AsyncStorage · 전체앱: Firestore 오프라인 캐시    │   (자동 동기화)  │ │
│  └──────────────────────────────────────────────────────┘                 │ │
│  ┌───────────── Native modules (Kotlin, Dev Build) ──────────────┐      │    │
│  │ AlarmScheduler(setAlarmClock)  ·  Haptics                       │      │    │
│  │ AlarmReceiver(BroadcastReceiver) → ExecutionActivity(FSI,잠금위) │      │    │
│  └──────────┬──────────────────────────────┬────────────────────┘      │    │
│      schedule│                       fire 정시│ → 잠금화면 풀스크린         │    │
└──────────────┼──────────────────────────────┼──────────────────────────┼────┘
        ┌──────▼──────┐                        ▼                          │
        │ 로컬 알림    │              Android OS: AlarmManager·알림·잠금화면  │
        │ (D18, 푸시X) │                                                   │
        └─────────────┘                                                   │
                             (동기화 전용; 없이도 앱 완전 동작)              │ HTTPS/WS
   ┌───────────────────── FIREBASE (관리형 BaaS, Spark 무료) ──────────────▼──┐
   │  Cloud Firestore  /users/{uid}/{events,timeblocks,expenses,meals}        │
   │  Firebase Auth (id+password)   ·  Security Rules: 사용자별 격리           │
   │  커스텀 서버 ✕ · API 계층 ✕ · Cloud Functions ✕ · Cloud Storage ✕(D19)   │
   └──────────────────────────────────────────────────────────────────────────┘
```
`*Execution = 제품의 척추(정확 알람 → 5·4·3·2·1 → 마이크로 스타트).`

- **구성요소**: ① RN/Expo UI(JS/TS) ② 로컬 저장소(기기 내 진실 소스) ③ 네이티브 알람 계층(OS 스케줄) ④ Firebase
  (동기화·인증) ⑤ Android OS 알람/알림. **커스텀 백엔드 서버는 없음.**
- **왜 이 배치**: 핵심 가치(중요 일정 다기기 자동 동기화)는 Firebase가, 핵심 레버(그 순간 실행)는 OS 알람 계층이
  담당. 둘은 독립적이라 **프로토타입은 ③⑤만으로**(클라우드 없이) 검증 가능.

## 2. 통신 방식 (Communication)
| 경로 | 방식 | 이유 |
|---|---|---|
| features ↔ 데이터 | **Repository 인터페이스**(직접 호출) | features가 저장소·동기화 세부를 모르게 → 교체 가능·테스트 용이 |
| 앱 ↔ 로컬 저장소 | 인프로세스 직접(캐시 우선 읽기) | 로컬 우선 → 즉시 UX, Firestore 읽기 최소화(비용, tech-feasibility §6-3) |
| 로컬 ↔ Firestore | **Firestore SDK가 자동 동기화**(오프라인 큐 + 실시간 리스너, HTTPS/WebSocket) | 직접 REST 안 짬 → 코드·서버 0. last-write-wins(D17) |
| JS ↔ 네이티브 모듈 | **New Architecture TurboModule/JSI**(함수 호출 + 이벤트) | 알람 예약/취소는 JS에서, "알람 발화·응답"은 네이티브→JS 이벤트 |
| 알람 → 화면 | AlarmManager→BroadcastReceiver→**FSI 액티비티**(잠금화면 위 전체화면) | OS 수준이라야 킬드/잠금 상태에서도 뜸(§4) |
| 다기기 알림 | **각 기기가 자기 로컬 알람을 스케줄**(푸시 아님, D18) | 서버·FCM 불필요·무료·오프라인 동작. *동기화 직후/앱 열 때 로컬 알람 재등록* |
| 인증 | Firebase Auth SDK(토큰 SDK 관리) | id+비번(D12), 서버 세션 관리 불필요 |

- **핵심 원칙**: **"쓸 땐 로컬에 즉시, 동기화는 SDK가 알아서."** 우리가 손으로 짜는 네트워크 코드는 (거의) 없다.

## 3. 데이터 · 저장 · 동기화
- **로컬이 진실 소스(local-first, D2)**: 모든 읽기/쓰기는 로컬 먼저 → 오프라인에서도 완전 동작, 즉각 반응.
  **로컬 저장소 = 프로토타입은 AsyncStorage, 전체앱은 Firestore 오프라인 지속성 캐시**(별도 SQLite 진실 소스를 두지 않음 — 이중 저장 금지, §9). *네이티브 알람 미러(SharedPreferences)는 진실 소스가 아닌 **파생 캐시**라 예외(§9).*
- **Firestore 구조 = 사용자별 컬렉션**(day-1부터):
  `/users/{uid}/events` · `/timeblocks` · `/expenses` · `/meals`. (`/days`는 DayAggregate **선택 캐시** — 기본 미생성·파생, data-model §2.6.) 모델은 data-model.md(정본)·spec §4.
  - **왜 처음부터 `/users/{uid}/`**: 지금은 단일 사용자지만 "다기기→여러 개인"(D3) 확장 시 **재설계 없이** 격리 유지.
- **보안 규칙(Firestore Security Rules)**: `request.auth.uid == uid`인 문서만 read/write → 사용자별 완전 격리.
  이게 **유일한 "백엔드 코드"**(서버 대신 선언적 규칙). Firebase CLI로 배포.
- **동기화 전략**: 로컬 쓰기 → Repository → (전체앱) Firestore 반영. **Firestore 오프라인 지속성**이 로컬 캐시+큐+
  실시간을 한 번에 처리하므로 **수동 동기화 엔진을 안 짬**. 충돌은 last-write-wins(D17).
- **비용 가드(구현 규율, tech-feasibility §6-3)**: 리스너를 **사용자·해당 날짜 범위로 좁게**, 캐시 우선 → 읽기 폭증 방지.

## 4. 핵심 레버 네이티브 아키텍처 (제품의 척추)
정확 시각에 잠금화면을 뚫고 실행 화면을 띄우는 부분. **JS로는 킬드 상태에서 코드가 안 도니 반드시 네이티브**(tech-feasibility §1).
- **Kotlin 구성**:
  - `AlarmScheduler` — `AlarmManager.setAlarmClock()`로 예약(Doze 통과, tech-feasibility §1.1).
  - `AlarmReceiver`(BroadcastReceiver) — 정시에 발화 → category=ALARM인 **full-screen-intent** 알림 생성.
  - `ExecutionActivity` — `showWhenLocked=true`·`turnScreenOn=true`·`WAKE_LOCK`으로 **잠금화면 위 전체화면**.
  - `BootReceiver`(`RECEIVE_BOOT_COMPLETED`) — 재부팅 후 알람 재등록.
- **화면을 네이티브 vs RN 어디로?** — **하이브리드 권장**: `ExecutionActivity`는 **즉시 뜨는 최소 네이티브 셸**("일어나 —
  21:00 헬스" + 시작 버튼)으로 *즉시성·신뢰성*을 보장하고, 버튼을 누르면 **RN 실행 플로우**(5·4·3·2·1 → 마이크로
  스타트 → "시작했어?")로 넘긴다.
  - **왜**: RN 콜드스타트 지연이 "정시 즉시 등장"을 해치지 않게 하되, 풍부한 UX는 JS/TS로 유지. (프로토타입은 단순화해
    RN 화면을 액티비티에 바로 호스팅해도 됨 — 지연 감수.)
- **배터리 내구성**: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 유도 + 사용자 안내(OEM 킬러 대응, tech-feasibility §1.1).
- **패키징**: `react-native-notify-kit`(Notifee 포크)/`expo-alarm` 우선 시도 → 부족하면 위를 **커스텀 네이티브 모듈 +
  Expo config plugin**으로. New Architecture TurboModule로 노출.

## 4.1 v0.3 프로토타입 정합 (PRD R2·R3·R6·R8과 맞물리는 부분)
> **⚠ 갱신 (2026-07-11, full-app).** **반복 없음(D37)** — full-app의 TimeBlock은 날짜별 단일 인스턴스라 알람은
> 전부 **1회성**(발화 후 재예약 없음); "매일 헬스"는 추가 화면의 **여러 날짜 일괄 생성**으로 만든다.
> **블록의 알림은 2단계 중 하나(D40→D43)** — `soft`/`execution`(**기본 `execution`**). `none`은 폐지. 소프트 경로(블록의 `soft` + 중요일정 R3)는
> 전용 채널(**IMPORTANCE_DEFAULT · 무음 · 잠금화면 PRIVATE**)로 격리해 "뚫지 않음"을 코드가 아니라 **채널이 보장**한다.
> **"다른 앱 위에 표시"(D41)** — FSI만으로는 **잠긴 화면**에서만 즉시 전체화면이 뜨고, 폰을 쓰는 중이면 헤드업으로
> 강등되며 리시버의 직접 `startActivity`는 백그라운드 실행 제한에 막힌다. 이 권한이 그 제한을 풀어 **상태와 무관하게**
> 그 시각에 실행 화면이 뜨게 한다.
- ~~**반복(recurrence, D35)**~~ **(폐기 — D37)** · ~~**Task의 다중 오프셋 단순 알림(D35)**~~ **(폐기 — D40이 블록의
  단일 `soft` 단계로 대체)**
- **소리(R8/D42)**: 실행 개입 소리는 **설정 `sound`(기본 false = 진동만)** + **알림음 선택**(기기 톤 목록에서 고르거나
  기기 기본을 따름; 발화 시각에 **네이티브가 읽음** — JS가 죽어 있을 수 있으므로). 채널은 무음으로 두고 **톤은 직접
  재생**해 default-off를 보장한다.
- **동시 발화 충돌(R2)**: `ExecutionActivity`를 **단일 인스턴스 + 네이티브 대기열**로 — 같은 유효시각의 두 발생은
  **순차로 하나씩**, 잠금화면 위에 겹치지 않게.
- **렌더 상한(R3)**: R3의 "지연 없이 즉시(≤[TBD])"를 지키려면 §4 하이브리드(**즉시 뜨는 최소 네이티브 셸** → RN)를
  **프로토타입에서도 유지**(“RN 화면 직접 호스팅” 지름길은 콜드스타트로 게이트를 조용히 깰 수 있어 지양).

## 5. 코드 구조 (Feature-first + Repository)
> **⚠ 실제 코드는 아래 트리를 쓰지 않는다 (2026-07-11).** 화면은 **expo-router 파일 라우팅**(`app/app/*.tsx`),
> 로직은 `app/src/core/{data,schedule,notifications,logs}`, Kotlin은 `app/modules/lp-alarm/android/`에 있다.
> **Repository 패턴이라는 핵심은 그대로**(features는 인터페이스만 호출; 저장소 구현만 F0에서 Firestore로 교체) —
> 다만 `/src/features/...` 디렉터리는 만들지 않았다. 실제 배치는 `app/README.md`를 보라. 아래 트리는 *의도*의 기록.
```
/src
  /app                # 내비게이션, 루트, providers(auth/theme)
  /features
    /calendar         # 중요 일정 (월 달력)
    /timeblocks       # D-1 설계 + My Day
    /execution        # ★핵심 레버: 트리거·5·4·3·2·1·마이크로 스타트·"시작했어?"
    /logs             # 지출 + 식사 (계획과 분리된 별도 표면, D32)
    /evaluation       # 계획 대 실제 (성공/실패 + 사유)
    /account          # 인증 + 동기화 설정
  /core
    /data             # 도메인 모델(spec §4), Repository 인터페이스+구현
    /sync             # Firestore 매퍼(전체앱 단계)
    /notifications    # 알람 스케줄 API (네이티브 모듈의 JS 측)
    /native           # 네이티브 브리지(alarm, haptics)
    /ui               # 공용 컴포넌트·테마
    /utils
/android/app/src/.../  # Kotlin: AlarmScheduler, AlarmReceiver, ExecutionActivity (config plugin)
```
- **feature-first**: 각 기능이 자기 UI·로직·화면을 갖는 자족 모듈. **execution이 척추**라 설계 노력의 대부분이 여기.
  - **왜**: 솔로+AI 코딩에 적합(한 폴더 = 한 관심사, AI에 맥락 주기 쉬움), execution을 깊게 파기 좋음.
- **Repository 패턴(핵심)**: features는 `EventRepository`·`BlockRepository` 같은 인터페이스만 호출. **구현**은
  프로토타입=로컬 전용(AsyncStorage), 전체앱=Firestore(오프라인 캐시=로컬 저장소). **features·네이티브 계층 코드는 안 바뀜.**
  - **왜(중요)**: 당신이 우려한 "갑자기 방향 달라짐"을 **구조로 차단** — 저장소가 바뀌어도 인터페이스가 같아 기능·핵심
    레버는 그대로.
- **상태관리**: 서버 상태/쿼리 = 로컬 저장소 반응형 조회(경량; 예 Zustand + repo, 또는 반응형 DB). 과설계 금지(솔로 MVP).
- **언어**: 전면 TypeScript. 네이티브 모듈만 Kotlin(최소 표면).

## 6. 배포 방식 (Deployment)
- **빌드**: **Expo Dev Build**(`npx expo prebuild` + config plugins). **로컬 빌드 무료·무제한**(또는 EAS 무료 티어).
  Expo Go는 네이티브 모듈 때문에 ✕.
- **프로토타입 배포**: **APK 사이드로드**(ADB/직접 설치)로 **본인 안드로이드 실기기**에. 스토어 불필요·**$0**.
- **전체 앱(이후)**: Google Play(**일회성 $25**) — AAB 빌드 후 제출. iOS는 후속(App Store 연 $99, D1).
- **백엔드 "배포"**: Firebase는 관리형 → 배포 없음. **Firestore 보안 규칙 + 인덱스만** Firebase CLI로 배포, Auth는 콘솔 설정.
- **환경 분리**: dev(로컬 + dev Firebase 프로젝트) ↔ prod(별도 Firebase 프로젝트). `google-services.json`을 환경별로.
- **업데이트**: JS-only 변경은 **EAS Update(OTA, 무료 티어)**로 재빌드 없이 배포 가능(네이티브 변경 시에만 재빌드). — 편의, 이후.
- **CI/CD**: 솔로 프로토타입은 수동 로컬 빌드로 충분. 이후 GitHub Actions/EAS로 자동화(무료 범위).

## 7. 프로토타입 vs 전체 앱 (무엇이 같고 무엇이 추가되나)
| | 프로토타입(트리거) | 전체 앱 |
|---|---|---|
| 네이티브 알람 계층(§4) | ✅ **그대로** | ✅ 동일 |
| execution feature + UI | ✅ **그대로** | ✅ 동일 |
| Repository 인터페이스 | ✅ | ✅ 동일 |
| 저장소 구현 | 로컬 전용(AsyncStorage) | Firestore 백업으로 **교체(인터페이스 불변)** |
| Firebase(동기화·인증) | ❌ 불필요 | ✅ 추가 |
| 캘린더/가계부/칼로리/평가 | ❌ | ✅ 추가(레퍼런스 앱 참고) |
| 배포 | 사이드로드 | Play($25) |

→ **바뀌는 건 저장소 구현과 "추가 기능"뿐. 검증 대상(알람·실행 화면)과 뼈대는 100% 재사용** = 방향 전환 없음.

## 8. 결정 요약 (결정 → 이유 → 근거)
| 결정 | 이유 | 근거 |
|---|---|---|
| Thick client + BaaS(서버 없음) | 솔로·무료·오프라인 우선·운영 0 | D2/D10/D17 |
| 커스텀 API 계층 없음(Firebase SDK=데이터 API) | 만들/유지/과금할 서버 0 | D17, tech-feasibility §6 |
| 로컬 우선(로컬이 진실 소스) | 오프라인 즉시 작동 + Firestore 읽기(비용) 최소화 | D2, tech-feasibility §6-3 |
| 로컬 알림(푸시 아님) | 서버 0·무료·오프라인 | D18 |
| 알람=네이티브 모듈(Kotlin) | 킬드/잠금 상태 정시 발화는 OS 수준만 가능 | tech-feasibility §1 |
| 실행 화면=네이티브 셸→RN 하이브리드 | 즉시성·신뢰성 보장 + UX는 JS/TS | tech-feasibility §1.2 |
| Repository 패턴(저장소 뒤로 숨김) | 프로토타입→전체앱 **방향 전환 방지** | 사용자 요구(Q3) |
| 사용자별 Firestore 컬렉션 + 보안규칙 | 단일→다수 사용자(D3) 재설계 없이 확장·격리 | D3 |
| Feature-first 구조 | 솔로+AI 코딩 적합, execution 척추 심화 | 개요 §3 |
| Dev Build + 사이드로드 | 네이티브 모듈 필수 + 무료·스토어 불필요 | tech-feasibility §0/§6 |

## 9. 데이터 흐름 & 개선안
**주요 경로**
1. **쓰기**: 화면 → Repository(클라 UUID + updatedAt) → 로컬 즉시 반영 → (전체앱) Firestore SDK가 오프라인 큐로 클라우드 동기화.
2. **읽기**: 화면 → Repository → **로컬 캐시 우선**(오프라인 OK); 리스너가 클라우드 변경을 로컬에 반영.
3. **동기화**: 기기A 쓰기 → Firestore → 기기B 리스너 → 로컬 갱신 → UI 반응. 충돌 순서 = **Firestore `serverTimestamp()`** 최신(D17; 클라 `updatedAt`은 시계편차로 판정에 안 씀 — data-model §6, tech-feasibility §7-2). 오프라인 동시편집은 'last-to-sync'(data-model §6).
4. **알람**: `alert="execution"` 블록 → 네이티브 스케줄 → OS → 정시 발화 → **FSI + "다른 앱 위에 표시"**(D41 — 잠금 여부와 무관하게 즉시 등장) → 실행 → done → Repository. `alert="soft"` 블록은 조용한 채널의 로컬 알림만(뚫지 않음).
5. **집계**: DayAggregate는 로컬에서 파생 계산(쓰기 0).

**발견된 비효율/불일치 → 개선안**
| # | 문제 | 개선 |
|---|---|---|
| 1 | **이중 저장(double-store) — 정정 완료** (과거 저장 모델이 로컬 SQLite 진실소스 ↔ Firestore 캐시로 이원화됐던 문제; 로컬 사본 2벌 → 중복·동기화 버그 위험이었음) | **전체앱은 Firestore 오프라인 지속성을 *유일한 로컬 저장소*로.** SDK가 캐시+큐+실시간+동기화 일괄 처리 → 커스텀 동기화 코드 0. (프로토타입만 AsyncStorage.) → **§3·data-model §4 정정 반영.** |
| 2 | **재부팅/킬드 후 알람 재예약** — BootReceiver가 재예약하려면 블록 데이터가 필요한데, 네이티브가 RN 저장소(AsyncStorage/Firestore 캐시)를 읽기 어려움 | **네이티브가 자기 소유 최소 미러(SharedPreferences)에 예약분(blockId·시각·제목·마이크로노트) 저장** → JS 없이 BootReceiver가 재예약. JS는 **블록 생성·수정·소프트삭제마다** 미러 write-through·삭제 시 eviction(고스트 알람 방지). |
| 3 | **동기화마다 알람 무차별 재등록** → 낭비·churn | **변경분(diff)만 + 근미래(오늘~내일) 범위만** 재조정; 포그라운드 복귀 시 1회 재조정. |
| 4 | **리스너 읽기 증폭**(비용) | 리스너를 **uid + 보이는 기간**으로 좁게, 안 쓰면 detach(tech-feasibility §6-3). |
| 5 | **DayAggregate 반복 계산**(월 뷰 30일) | **메모이즈**(해당 날짜 데이터 변경 시에만 재계산) — 로컬 계산이라 비용 아님, UX 최적화. |

**정합성 결론**: 개선 반영 시 흐름이 **한 벌의 로컬 저장소(Firestore 캐시) + SDK 자동 동기화 + 네이티브 알람 미러**로
단순화되어 "로컬 우선·비용 최소·방향 전환 없음" 원칙과 일치. 프로토타입↔전체앱은 **저장소 구현만** Repository 뒤에서 교체(§7).

## 10. 외부 의존성 (역할 · 비용 · 대체 · 장애 영향)
> **요약**: 런타임 외부 서비스는 **사실상 Firebase 하나**. 장애 시 "**동기화만**" 멈추고 앱·핵심 레버는 완전 동작 —
> 로컬 우선·로컬 알림·무서버 아키텍처의 직접 결과.

### A. 런타임 외부 서비스 (실제 SaaS 의존)
| 서비스 | 역할 | 비용 | 대체 가능 | 장애 시 영향 |
|---|---|---|---|---|
| **Firebase Firestore** | 다기기 동기화 + 클라우드 백업 | Spark 무료(하루 5만 읽기/2만 쓰기·**카드X**) → 수천 DAU부터 Blaze | 가능하나 대가 큼(Supabase=정지·오프라인 약함); **Repository가 교체비용↓** | **동기화·백업 중단, 앱은 완전 동작**(로컬 우선). 복구 시 자동 재동기화. **핵심 레버 무영향** |
| **Firebase Auth** | 사용자 식별·동기화 게이트(id+비번 D12) | 무료(5만 MAU) | 쉬움(타 auth/로컬 계정) | 신규 로그인·기기 추가 불가; **기존 세션은 오프라인 유지** |

### B. 빌드·배포 서비스 (런타임 아님 — 시점 의존만)
| 서비스 | 역할 | 비용 | 대체 | 장애 시 영향 |
|---|---|---|---|---|
| **EAS Build/Update** | 클라우드 빌드·OTA(선택) | 무료 티어(월 15+15) | **완전**(로컬 빌드·GitHub Actions) | 빌드/업데이트 시점만; **배포된 앱 무영향** |
| **Google Play / App Store** | 배포(전체앱 이후) | Play **$25 1회** / Apple $99/년 | 사이드로드·대체 스토어 | 배포만; **설치된 앱 무영향**. 프로토타입엔 불필요 |

### C. 플랫폼 의존성 (외부 SaaS 아님 — 그러나 핵심 레버의 기반)
| 대상 | 역할 | 비용 | 대체 | 장애/리스크 |
|---|---|---|---|---|
| **Android OS**(AlarmManager·알림·지오펜스) | **정확 알람 발화·풀스크린** = 핵심 레버 실행 기반 | 무료 | **불가**(OS 자체) | **가장 치명적.** 단, "가용성"이 아니라 **신뢰성** 문제 — OEM 배터리 킬러·Doze가 지연/누락(tech-feasibility §1). 완화: setAlarmClock·배터리 예외·부팅 재등록·네이티브 미러(§4·§9) |

### D. 라이브러리 의존성 (컴파일 포함 — 런타임 서비스 아님, 공급망 리스크)
| 라이브러리 | 역할 | 비용 | 리스크 / 대체 |
|---|---|---|---|
| notify-kit(Notifee 포크)/expo-alarm | 알람·FSI | 무료 | **Notifee 원본 2026-04 아카이브**(실사례) → 포크 또는 **커스텀 네이티브 모듈로 자립**(최종 방어) |
| @react-native-firebase | Firebase 브리지 | 무료 | 성숙·유지됨 |
| expo-haptics/location/file-system/sharing | 햅틱·위치·파일 | 무료 | Expo 공식·유지 |
| react-native-android-widget/quick-tiles(2차) | 위젯·타일 | 무료 | 커뮤니티 — 유지 상태 확인 후 채택 |
> 장애 = 런타임 중단이 아니라 **유지보수 리스크**(새 OS에서 깨지면 포크/교체). **핵심 알람은 커스텀 네이티브 모듈로 공급망 자립 가능.**

### E. 의도적으로 안 쓰는 외부 서비스 (의존·비용 축소)
Cloud Storage(사진 D19) · Cloud Functions · **FCM 푸시(로컬 알림 D18)** · Expo Push · Google Maps 렌더링(지오펜스는 GPS만).
→ 각각 비용·의존·복잡도를 없애 **의존 표면을 최소로** 유지.

### 전체 blast radius 결론
최악(Firebase 완전 장애)에도 **로컬 사용·핵심 실행 트리거는 계속 작동**; 잃는 건 **다기기 동기화·클라우드 백업**뿐.
유일한 "치명적 단일점"은 외부 SaaS가 아니라 **기기 OS의 알람 신뢰성** — 그래서 프로토타입 1순위 스파이크가 바로 그것(§7, tech-feasibility §1).

## 11. 핵심 의존성 리스크 완화 (defense-in-depth + self-healing)
> **정직한 전제**: **핵심 기능(실행 트리거)은 외부 SaaS엔 의존하지 않는다**(온디바이스) — 이건 아키텍처의 강점.
> 진짜 과의존은 **① OS 알람 신뢰성(플랫폼)** + **② 알람 라이브러리(공급망)**. 아래로 단일 실패점을 구조적으로 없앤다.

### 리스크 1 — OS 알람 신뢰성 (Doze·OEM 킬러) — 가장 중요
업계 정설: **"어떤 단일 메커니즘도 믿지 마라 — OEM마다 깨는 게 있다"**([dev.to 11 layers](https://dev.to/stoyan_minchev/what-android-oems-do-to-background-apps-and-the-11-layers-i-built-to-survive-it-28bb) · [nek12 신뢰성 가이드](https://nek12.dev/blog/en/how-to-make-android-notifications-100-reliable/)) → **다층 방어 + 자가 치유.**
| 계층 | 방법 | 역할 |
|---|---|---|
| 1 기본 | `setAlarmClock()` | Doze 직전 기상, 최고 신뢰도 |
| 2 권한·설정 | 배터리 최적화 예외 + OEM별 설정 온보딩(dontkillmyapp 식) | OEM 킬러 완화 |
| 3 **백업** | **WorkManager 주기 워커(~15분)가 "놓친 알람" 감지→즉시 발화**(JobScheduler 기반이라 OEM이 덜 건드림) | 누락 캐치업 |
| 4 **자가 재등록** | BOOT_COMPLETED · 정확알람 권한변경 · **시간대/시간 변경(TIMEZONE/TIME_CHANGED)** · 앱 포그라운드 진입 시 **저장소에서 재예약** | 재부팅·권한·시간대·킬드 복구 |
| 5 **자가 치유(UX)** | 앱 열 때 **유효시각이 지났는데 `pending`인 occurrence**를 스캔(=미발화 *또는* 발화 후 방치 양쪽 포괄). 두 경우 다른 문구: 미발화="[제목] 놓쳤어요 — 지금이라도?", 발화-후-방치="[제목] 아직 안 했죠 — 지금 할까요?". `[TBD~7일]` 지나면 자동 miss 보관(PRD R6) | 무음 실패·미완료를 부드러운 복구로 |
| 6 이중 트리거 | (2차) 지오펜스로 위치 기반 중복 큐 | 시간 알람 누락 시 보조 |
| 7 우아한 강등 | FSI 권한 거부 시 하이프라이어리티 헤드업 알림+소리 | 풀스크린 불가해도 알림은 감 |
| 8 계측 | 예약시각 vs 실제 발화 로그 → 상습 지연 기기 경고·설정 유도 | 측정→적응 |
> **구조 원리**: 단일 실패점을 **"여러 메커니즘 + 감지·복구"**로 전환 — OS가 알람을 떨궈도 시스템이 알아채고 복구.
> (주의: WorkManager는 정시 보장이 아니라 "결국 실행" → **백업/캐치업 전용**. 포그라운드 서비스는 Android 14 제약상
> 사용자가 앱을 쓰는 동안의 백스톱으로 한정.)

### 리스크 2 — 알람 라이브러리 공급망 (Notifee 아카이브)
- **완화(최종 방어): 핵심 경로를 우리 소유 얇은 커스텀 네이티브 모듈로.** AlarmScheduler + FSI 액티비티 +
  BootReceiver = 수백 줄 Kotlin을 **우리가 소유** → 남의 유지보수에 핵심 레버가 인질 잡히지 않음.
- notify-kit/expo-alarm는 초기 편의 래퍼로만; `notifications` 인터페이스 뒤에 두어 **features 안 건드리고 교체**.

### 리스크 3 — Firebase (핵심 아닌 동기화용이나 단일 벤더)
핵심 기능이 아니라 우선순위 낮지만, 구조적 완화가 **이미 내장**:
- **로컬 우선 자체가 최대 완화** — Firebase 없이도 앱·핵심 레버 완전 동작(동기화는 부가).
- **Repository/sync 추상화** → 벤더 교체(Supabase/PocketBase/커스텀) 시 features 불변 = 락인↓.
- **JSON 내보내기(D24)** → 데이터 사용자 소유·이식 가능(인질 아님) + 장기 장애 시 수동 동기화 폴백.
- **비용 절벽**: 스코프 리스너(§9)·Spark 내 유지; 한계 근접 시 이식 경로 존재.

### 결론
핵심 레버는 이미 **외부 SaaS 무의존**(강점). 남은 단일 실패점 = **OS 알람 신뢰성** → 위 8계층 방어+자가치유로 "발화
확률 최대화 + 실패 감지·복구"의 **회복탄력 시스템**으로 전환. 공급망은 **커스텀 모듈로 자립**, Firebase는
**로컬우선+추상화+내보내기**로 락인·장애 내성 확보. → 프로토타입 스파이크에 **계층 1·3·4·5**(기본 알람 + WorkManager
백업 + 재등록 + 캐치업)를 함께 검증하면 신뢰성을 실측할 수 있다.

---
*이 아키텍처는 확정 스택(균형안①) 위에서 개요·spec·decisions·tech-feasibility를 증류한 빌드 설계다. 스택이 바뀌면 이
문서도 함께 갱신한다.*
