# LifePlanner — 기술 개발 가능성 검토 (Tech Feasibility)

> **목적.** 확정 스택(**React Native + Expo**, D11) 위에서 서비스 개요·리서치의 핵심 기능이 **현재(2026) 기술로
> 구현 가능한지**, **어떤 제약**이 있는지, **유사 서비스는 어떻게** 하는지 정리한다. 지금 목표는 **"실행 트리거"
> 우선 프로토타입**(개요 §3 실행 엔진, D30)이므로 그 코어를 먼저, 전체 앱 기능은 그다음에 검토한다.
> 기준: 개요 §3·§6·§7, features 계획 §4·§6, **H14 리스크**. 조사일 2026-07-08.

---

## 0. 핵심 결론 (TL;DR)
1. **프로토타입은 Expo Go로 못 만든다 → Expo *Dev Build*(Custom Dev Client + config plugin)가 필수.** 정확 알람·풀스크린·
   네이티브 Firebase 모두 네이티브 모듈이 필요하기 때문. (JS만으로 되는 범위를 넘어선다.)
2. **정확 시각 트리거는 안드로이드에서 "된다. 단 100% 보장은 아니다."** `setAlarmClock()`/`setExactAndAllowWhileIdle()`
   + 정확 알람 권한 + 배터리 최적화 예외로 **Doze는 통과**하지만, 삼성/샤오미 등 **OEM 킬러**와 Android 15/16의 강화된
   Doze 때문에 **초 단위 정밀·전 기기 보장은 불가.** → **±수 초~분** 목표가 현실적. **이게 1순위 스파이크.**
3. **잠금화면 위 "실행의 순간" 풀스크린 takeover는 가능하나 게이트가 있다.** Android 14+는 `USE_FULL_SCREEN_INTENT`를
   **통화·알람 앱에만 기본 허용** → 개인 프로토타입은 그냥 켜면 되지만, **배포하려면 Play 선언 또는 사용자 권한 요청 +
   폴백**이 필요.
4. **iOS는 이 takeover가 훨씬 약하다.** 임의 앱은 잠금화면 풀스크린 점유 불가 → **Time-Sensitive 알림**(화면 켜고 Focus
   뚫음)이 현실적 상한. (iOS 26의 **AlarmKit**로 알람식 UI는 새로 가능.) → **안드로이드 우선(D1)이 기술적으로도 정답.**
5. **Notifee(고급 알림 라이브러리)가 2026-04 아카이브됨.** → 대안: **`react-native-notify-kit`**(Invertase 공인 포크) ·
   **`expo-alarm`**(AlarmManager+AlarmKit 래핑) · 또는 소형 **커스텀 네이티브 모듈.**

---

## 1. 프로토타입 코어 (반드시 되어야 하는 것)

### 1.1 정확 시각 로컬 알람 — *제품의 척추, 최대 리스크(H14)*
- **기술**: 네이티브 안드로이드 `AlarmManager`.
  - `setAlarmClock()` — 시스템이 알람 직전에 Doze를 빠져나오게 함(시계 앱과 동일 경로). **가장 신뢰도 높음.**
  - `setExactAndAllowWhileIdle()` — Doze 중에도 발화하나 **딥 Doze에선 최소 ~15분 간격** 제한.
  - 권한: **`SCHEDULE_EXACT_ALARM`**(Android 12+, 신규 설치 기본 거부) 또는 **`USE_EXACT_ALARM`**(Android 13+, 자동
    허용이나 "핵심 기능이 알람인 앱"만 허용 — Play 심사 대상).
  - RN 연결: expo-notifications만으로는 부족(고급 기능·풀스크린 한계) → **`react-native-notify-kit`(Notifee 포크)** 또는
    **`expo-alarm`**, 또는 **커스텀 네이티브 모듈** + Dev Build.
- **제약(현재)**:
  - **Doze/App Standby**: 일반 알람은 지연됨. exact-while-idle/setAlarmClock만 통과. `[T-alarm]`
  - **OEM 배터리 킬러**(삼성·샤오미·오포 등): 백그라운드 앱을 공격적으로 종료 → **초 단위·전 기기 보장 불가.** 완화책 =
    배터리 최적화 예외 요청(`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) + 사용자 안내 + 부팅 후 알람 재등록(`BOOT_COMPLETED`). `[T-oem]`
  - **Android 15/16 강화 Doze** — 더 공격적(16 초기 빌드엔 Doze 버그도 있었음). `[T-alarm]`
- **유사 서비스**: **Alarmy** — `setAlarmClock()` + 포그라운드 서비스(상시 알림) + 배터리 예외 유도로 "반드시 울리게".
  그럼에도 문서·리뷰가 "OEM에 따라 가끔 안 울림"을 인정 → **완벽 보장은 업계도 못 한다.** `[T-alarm]`
- **판정**: ✅ **구현 가능**, 단 **신뢰도 상한 존재.** 프로토타입에서 **가장 먼저 스파이크**해 "내 폰(안드로이드)에서 잠금·
  Doze 상태로 설정 시각 ±___초에 뜨는가"를 측정. features 계획의 합격선(±1분)으로 검증.

### 1.2 잠금화면 위 "실행의 순간" 풀스크린 (commit → 5·4·3·2·1 → 마이크로 스타트 → "시작했어?")
- **기술**: 네이티브 액티비티(`showWhenLocked=true`, `turnScreenOn=true`, `launchMode=singleTask`) + `WAKE_LOCK` +
  알림의 `setFullScreenIntent(..., category=ALARM)`. 착신전화 화면과 동일 패턴.
  - RN 라이브러리 존재: **`react-native-full-screen-notification-incoming-call`**(통화식 풀스크린) — 이를 "실행의 순간"
    화면으로 응용 가능. `[T-fsi-rn]`
- **제약(현재, Android 14+)**: **`USE_FULL_SCREEN_INTENT`가 통화·알람 앱에만 기본 허용.** 그 외 앱은 Play가 기본 권한
  회수 → **(a)** Play Console에서 알람 핵심기능 선언(승인 필요) 또는 **(b)** 앱 내에서 사용자에게 권한 요청 + 거부 시
  **헤드업 알림으로 우아하게 폴백.** `[T-fsi][T-fsi-policy]`
  - **프로토타입(개인·미배포)**: 그냥 권한 켜면 됨 → 제약 없음. **배포 시점에만 문제.**
- **유사 서비스**: 착신전화(WhatsApp/전화앱)·알람 앱이 정확히 이 메커니즘으로 잠금화면을 점유. `[T-fsi-rn]`
- **판정**: ✅ **프로토타입에선 문제없이 가능.** 배포용은 "알람 앱" 정체성으로 선언하거나 폴백 UX 설계 필요(개요 §6 반영).

### 1.3 5·4·3·2·1 카운트다운 + 마이크로 스타트 UI + 햅틱
- **기술**: 순수 RN UI(**Reanimated**, D11) + **`expo-haptics`**(진동·임팩트 피드백). 화면 로직은 자명하게 구현 가능.
- **제약**: 없음(트리거가 그 화면을 **제때 띄우느냐**가 관건이지, 화면 자체는 쉬움).
- **판정**: ✅ **쉬움.** 난이도는 전부 1.1/1.2(그 화면에 *도달*하는 것)에 있다.

### 1.4 최소 로컬 저장 (블록 1개 + 시각 설정 → done/miss 표시)
- **기술**: **AsyncStorage**(레퍼런스 앱과 동일) 또는 **expo-sqlite**. 프로토타입엔 AsyncStorage로 충분.
- **판정**: ✅ **쉬움**(레퍼런스 앱이 이미 이 방식).

> **프로토타입 범위 = 1.1 + 1.2 + 1.3 + 1.4.** 캘린더·가계부·칼로리·동기화는 프로토타입에 **불필요**(트리거 가설만
> 검증). "블록 하나 정해두고 → 그 시각에 잠금 뚫고 실행 화면 → 나갔나?"만 되면 코어 증명 완료.

---

## 2. 전체 앱 기능 (프로토타입 이후 — 기술만 미리 검토)

### 2.1 캘린더 + 중요일정 + 사전 알림
- **기술**: 캘린더 UI는 RN 라이브러리(react-native-calendars 등) 또는 자체. 사전 알림은 **expo-notifications 로컬 예약
  알림**(정확 시각이 덜 치명적이라 표준 API로 충분). 
- **제약**: 중요일정 사전 알림은 "몇 분 전 알림" 수준이라 1.1만큼 엄격하지 않음 → 표준 expo-notifications로 OK.
- **판정**: ✅ 쉬움~보통.

### 2.2 클라우드 동기화 (Firebase Firestore + Auth, 무료 Spark, 오프라인 우선 — D2/D17)
- **기술**: **`@react-native-firebase`**(네이티브 SDK) + **expo-dev-client + config plugin**(`google-services.json`
  경로를 app.json에). 네이티브 SDK라 **진짜 오프라인 지속성(offline persistence)** 제공. `[T-fb]`
  - 대안(JS SDK): Firebase JS SDK는 RN에서 오프라인 지속성이 약함 → `expo-firestore-offline-persistence` 폴리필 필요. `[T-fb-offline]`
- **제약**: Expo Go 불가(Dev Build 필요) — **단 1.1/1.2에서 이미 Dev Build를 쓰므로 추가 비용 없음.** 무료 Spark 한도 내
  운영(개요 §9 Q10: 규모 커지면 비용).
- **판정**: ✅ 가능(네이티브 Firebase 권장). **로컬 우선 → 로그인 시 동기화** 구조와 정합.

### 2.3 빠른 기록 (바텀시트) + 위젯/퀵설정 타일 (<2초, 2차)
- **기술**: 바텀시트 빠른 입력 = RN UI로 쉬움(레퍼런스 앱 참고). **홈 위젯** = `react-native-android-widget`(Expo config
  plugin) / iOS는 `expo-widgets`(WidgetKit). **퀵설정 타일** = `react-native-android-quick-settings-tiles`(TileService). `[T-widget]`
- **제약**: 위젯·타일은 **네이티브라 비자명**(별도 렌더·데이터 브리지). → features 계획대로 **2차(P1)**가 맞음.
- **판정**: ✅ 가능하나 2차. 바텀시트 기록만 MVP.

### 2.4 지오펜스 트리거 ("헬스장 근처/집 나섰나", 2차 선택 레버)
- **기술**: **expo-location** `startGeofencingAsync` + **TaskManager** 백그라운드 태스크. 고신뢰가 필요하면
  **`react-native-background-geolocation`**(transistorsoft, 모션감지로 배터리 −80%). `[T-geo]`
- **제약**: Android 11+ **"항상 허용" 배경 위치 권한**(별도 설정 화면), iOS 30초 실행 창, **OEM 배터리·저전력 간섭** →
  신뢰도·권한 부담 큼. 배터리 검증 필요.
- **판정**: ⚠️ 가능하나 **신뢰도·권한 민감 → 2차 유지.** 알람 스파이크와 함께 배터리 검증.

### 2.5 JSON 내보내기/가져오기 (merge-vs-overwrite, D24)
- **기술**: **expo-file-system** + **expo-sharing**(내보내기) + document picker(가져오기). 레퍼런스 앱이 이미 동일 패턴.
- **판정**: ✅ 쉬움.

---

## 3. 플랫폼 제약 요약 (Android vs iOS)

| 기능 | Android | iOS |
|---|---|---|
| **정확 시각 발화** | ✅ setAlarmClock/exact-while-idle (권한+배터리예외; OEM 상한) | ⚠️ 로컬 알림 예약은 되나 임의 코드 정시 실행 불가 |
| **잠금화면 풀스크린 takeover** | ✅ FSI+showWhenLocked (14+ 권한 게이트) | ❌ 임의 앱 불가 → **Time-Sensitive 알림**이 상한 (iOS 26 **AlarmKit**로 알람식 UI 가능) `[T-ios]` |
| **DND/무음 돌파** | 알람 채널로 가능 | Critical Alert = **Apple 엔티틀먼트 승인 필요** `[T-ios]` |
| **배경 지오펜스** | ✅ (항상 허용 권한) | ✅ (Always 권한, 30초 창) |
| **홈 위젯/퀵타일** | ✅ 네이티브 | ✅ WidgetKit |

→ **결론: "그 순간 잠금 뚫고 실행시키는" 코어 경험은 Android가 확실히 강하다.** iOS는 알림 수준으로 약화되므로,
**Android 우선(D1)이 제품 정체성과 기술 현실에 모두 맞는다.** (iOS는 Time-Sensitive/AlarmKit로 후속.)

---

## 4. 프로토타입 기술 스택 결정 (이 검토의 산출)
- **Expo Dev Build**(Custom Dev Client) — Expo Go ❌. `npx expo prebuild` + config plugin.
- **알람/풀스크린**: `react-native-notify-kit`(Notifee 포크) 또는 `expo-alarm` 먼저 시도 → 부족하면 **소형 커스텀 네이티브
  모듈**(AlarmManager + showWhenLocked 액티비티). 
- **UI**: RN + Reanimated + `expo-haptics`.
- **저장**: AsyncStorage(프로토타입) → 전체앱은 **Firestore 오프라인 지속성 = 로컬 저장소**(별도 SQLite 진실 소스 없음; SQLite는 후일 파생 읽기전용에 한함 — data-model §4).
- **권한 세트(Android)**: `USE_EXACT_ALARM`(또는 SCHEDULE_EXACT_ALARM), `USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`,
  `RECEIVE_BOOT_COMPLETED`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `POST_NOTIFICATIONS`(13+).

## 5. 가장 먼저 검증할 것 (스파이크 순서)
1. **알람 신뢰도 스파이크(최우선)**: Dev Build에서 setAlarmClock로 블록 1개 예약 → **폰 잠금 + 방치(Doze)** 상태에서
   설정 시각에 뜨는지, 지연(±초/분)이 얼마인지 측정. **본인 안드로이드 실기기**로. (개요 §6 합격선 ±1분.)
2. **풀스크린 takeover 스파이크**: 그 알람이 **잠금화면 위 전체화면**(showWhenLocked+FSI)으로 5·4·3·2·1 화면을 띄우는지.
3. **부팅/배터리 내구성 + 백업층**: 재부팅·배터리 최적화 On에서 살아남는지(예외 요청) + **WorkManager 백업 워커가 놓친 알람을 잡는지 + 앱 열 때 캐치업 프롬프트**(architecture §11 계층 3·5).
4. 통과하면 → 마이크로 스타트/햅틱 UI 붙이고 **"실제로 헬스장에 가게 되는가"를 본인에게 며칠 테스트**(효능 가설, 개요 §5/§8).

## 6. 비용 / 무료 가능성 재확인 (D10 준수)
**결론: 개발·프로토타입·개인 사용 = 100% 무료(신용카드 불필요) → D10 유지됨.** 유료는 **"공개 스토어 배포"에만**
발생하며 지금 계획 밖이다.

| 항목 | 무료? | 비고 |
|---|---|---|
| 앱 빌드(RN/Expo) | ✅ | **로컬 빌드 무제한 무료**; EAS 클라우드는 무료 월 15+15회 ([Expo pricing](https://expo.dev/pricing)) |
| 내 안드로이드 기기에서 실행 | ✅ | APK 사이드로드(ADB), **개발자 계정 불필요** ([Expo: build APK](https://docs.expo.dev/build-reference/apk/)) |
| DB·인증 (Firebase Spark) | ✅ **카드 불필요** | 하루 5만 읽기/2만 쓰기·1GB·인증 5만 MAU, **정지 없음** ([Firebase pricing](https://firebase.google.com/pricing)) |
| 로컬 알림(D18) | ✅ | 온디바이스 → 서버·푸시 비용 0 ([FCM free](https://rnfirebase.io/messaging/usage)) |
| JSON 내보내기/가져오기 · 지오펜스(2차) | ✅ | 기기 내 파일 · 기기 GPS |

**유료가 생기는 지점(전부 지금 계획 밖):**
- **Google Play 공개 배포 = 일회성 $25**(평생 1회, 구독 아님) — 사이드로드/개인 사용엔 불필요
  ([Play fee 2026](https://www.iconikai.com/blog/google-play-developer-account-fee-2026)).
- **Apple App Store = 연 $99** — iOS 후순위(D1)라 지금 불필요.
- **Firebase 규모 초과 → Blaze(카드 필요)** — 이미 Q10(규모 비용)에서 다룸(개인/소규모는 Spark 무료 내).

**피해야 할 유료 함정(이미 회피 중):**
- **Firebase Cloud Storage가 Spark에서 제거됨 → 사진 저장은 Blaze(카드) 필요.** → **사진 드롭(D19)이 이를 정확히 회피.**
- Cloud Functions = Blaze → 안 씀 · Google Maps *렌더링* = 과금 → 안 씀(지오펜스는 지도 렌더 불필요).
- **Supabase 무료는 7일 미사용 시 프로젝트 정지** → 간헐 사용 개인앱엔 부적합, **Firebase 선택(D17)이 옳았음**
  ([Supabase pricing](https://supabase.com/pricing)).
- **Vercel 불필요**(웹 호스팅·서버리스용; 우리 백엔드는 Firebase).

### 6-1. 기능별 비용 발생 여부 (설계된 전 기능 점검)
| 기능 | 비용? | 수준 |
|---|---|---|
| 실행 트리거(정확 알람·풀스크린·5·4·3·2·1·햅틱) | ❌ | 온디바이스·네이티브 → **$0 영구** |
| 로컬 알림(중요일정 사전알림 포함, D18) | ❌ | 온디바이스 → $0 |
| 캘린더·시간블록·가계부·칼로리·평가 | ⚠️ | 데이터가 Firestore로 **동기화될 때만**. **1인/개인 = 사실상 $0** |
| 클라우드 동기화(Firestore) | ⚠️ **유일한 변수 비용** | 무료 티어 내(§6-2) |
| 인증(Firebase Auth) | ❌ | **5만 MAU까지 무료** |
| JSON 백업 · 지오펜스 · 위젯 · 빌드/실행 | ❌ | 기기 내 처리 → $0 |

→ **설계된 기능 중 '구조적으로' 돈이 드는 건 클라우드 동기화(Firestore) 하나뿐.** 나머지는 전부 온디바이스이거나 넉넉한
무료 한도 내라 규모와 무관하게 $0.

### 6-2. 규모별 비용 추정 (Firestore = 유일 변수)
무료 한도(Spark=Blaze 무료 할당 동일): 하루 **5만 읽기 / 2만 쓰기 / 2만 삭제**, 1GB 저장, 10GB/월 전송, 인증 5만 MAU.
초과 시 Blaze 단가 ≈ 읽기 **$0.06/10만** · 쓰기 **$0.18/10만** · 삭제 $0.02/10만 · 저장 $0.15–0.26/GB
([Firestore pricing](https://cloud.google.com/firestore/pricing)).

| 규모 | 월 비용(대략) |
|---|---|
| **1인(본인)·개인** | **$0** (무료 한도의 <1% 사용) |
| 수십~수백 명 | **$0** (여전히 무료 안) |
| ~수천 DAU | ~$0–10 |
| 5,000 DAU | ~$10 |
| 100,000 DAU | ~$300 |

(출처: [Firebase 요금 예시](https://firebase.google.com/docs/firestore/billing-example) — 5k DAU≈$10 / 100k DAU≈$298;
개요 §9 Q10의 "$270/월 @ 50만 읽기/일"과 정합. Firebase 관례상 DAU ≈ 설치의 10%.)

### 6-3. 비용을 낮게 유지하는 설계 선택 + 정직한 유의점
- **의도적 절감 설계**: 로컬 우선(D2/D17 — 읽기를 캐시로 처리해 Firestore 읽기 최소화) · **사진 없음(D19 → Cloud
  Storage 유료 회피)** · 로컬 알림(서버·푸시 인프라 0) · 텍스트만(저장·전송 미미) · Cloud Functions 없음(Blaze 불필요).
- **유의점(구현 규율)**: Firestore 비용은 *기능*이 아니라 *동기화 구현*에 달림 — 실시간 리스너를 컬렉션 전체에 걸면
  변경마다 읽기가 폭증한다. **리스너를 사용자·날짜 단위로 좁히고 오프라인 캐시를 쓰면** 위 추정 안에 머문다.

## 7. 추가 기술 검토 (빌드 전 점검)
> §1–6 외에 이 서비스를 만들 때 필요한 나머지 기술 영역. **알람·시간 중심 앱**이라 시간/시계 관련이 가장 중요.

**점검 목록**
| 영역 | 상태 |
|---|---|
| 정확 알람·Doze·FSI·iOS(§1) · 비용(§6) · 의존성·리스크 완화(architecture §10·§11) | ✅ 완료 |
| **시간/시간대/시계 처리** | ⚠️ 7-1 |
| **동기화 충돌(시계 편차)** | ⚠️ 7-2 → data-model §6 정정 |
| **권한 UX·스토어 컴플라이언스** | ⚠️ 7-3 |
| **보안·프라이버시** | ⚠️ 7-4 |
| **관측성(크래시·지표)** | ⚠️ 7-5 |
| **테스트·스키마 마이그레이션** | ⚠️ 7-6 |
| 접근성·i18n·성능 | ▹ 표준(7-7) |

### 7-1. 시간/시간대/시계 (알람 앱 최대 함정)
- 알람은 **벽시계(로컬) 의미** — "21:00"은 어디 있든 그 지역 21:00. AlarmManager는 절대시각(RTC)이라 **시간대·DST·수동
  시간변경 후 어긋남.** → **`ACTION_TIMEZONE_CHANGED`/`TIME_CHANGED` 수신 시 재계산·재등록**(architecture §11 계층4 반영).
  블록 시각은 벽시계로 저장.
- 날짜 경계=기기 로컬 자정(spec §4); 시간대 변경 시 "오늘/D-1" 재계산.

### 7-2. 동기화 충돌 — 클라이언트 타임스탬프는 깨진다 (정정)
- **문제**: last-write-wins를 클라이언트 `updatedAt`로 판정하면 **시계 편차·DST·수동 변경**으로 오래된 편집이 이길 수
  있음(단일 기기도 DST로 깨짐, [근거](https://www.systemsarchitect.io/services/google-firestore/avoid-mistakes/pt/avoid-using-client-side-timestamps-for-critical-op)).
- **개선**: 충돌 순서는 **Firestore `serverTimestamp()`**로 판정(서버 일관 시각). 낙관적 `updatedAt`은 로컬 UX용으로만.
  → **data-model §6 정정.**

### 7-3. 권한 UX · 스토어 컴플라이언스
- **권한**: POST_NOTIFICATIONS(13+) · USE_EXACT_ALARM · USE_FULL_SCREEN_INTENT(14+ 게이트) · IGNORE_BATTERY_OPTIMIZATIONS ·
  RECEIVE_BOOT_COMPLETED · WAKE_LOCK · (2차)ACCESS_BACKGROUND_LOCATION.
- **UX**: 첫 실행 온보딩에서 **맥락과 함께 순차 요청**, 거부 시 우아한 강등(architecture §11 계층7); 정확알람·배터리
  예외는 설정 딥링크.
- **배포 시**: Play에서 FSI·정확알람 선언 + Data Safety 양식 + 개인정보처리방침. 사이드로드 프로토타입엔 불필요.

### 7-4. 보안 · 프라이버시
- **Firestore 규칙**(`auth.uid==uid`)이 유일한 서버측 방어 → 반드시 작성·배포. 저장 데이터(지출·식사·일정)는 개인정보나
  고민감도 아님 → MVP는 기기 잠금 의존, 후속 암호화 저장 검토. **개인용=최소 / 배포=필수.**

### 7-5. 관측성 (전부 무료 — Spark)
- **Firebase Crashlytics**(크래시) + **Analytics/GA4**(성공 지표 personas §8) — **둘 다 Spark 무료·무제한, Blaze
  불필요**([근거](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)). 알람 발화 실측 로그(§11 계층8)도 여기로.

### 7-6. 테스트 · 마이그레이션
- **테스트**: 순수 로직(Repository·집계·알람 시각 계산)=JS 단위 테스트; **네이티브 알람=실기기 수동·계측**(스파이크가 곧
  테스트); 핵심 루프 E2E는 Maestro(무료) 선택.
- **마이그레이션**: 로컬 저장에 `schemaVersion` → 업데이트 시 마이그레이션; 레퍼런스 앱→엔티티 매핑은 빌드 시 1회.

### 7-7. 표준 영역 (후속 메모)
접근성(실행 화면 스크린리더·폰트·대비) · i18n(KRW·로컬 시각 포맷) · 성능(FlatList 가상화, 실행 화면 콜드스타트는 §4
네이티브 셸로 완화, 앱 크기).

## 8. References (조사 2026-07-08)
- **[T-alarm]** 정확 알람·Doze — [Android Developers: Schedule alarms](https://developer.android.com/develop/background-work/services/alarms) · [Exact alarms denied by default (A14)](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms) · [Esper: A13 alarm restrictions](https://www.esper.io/blog/android-13-exact-alarm-api-restrictions) · [Doze & Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- **[T-oem]** OEM 배경 킬러 현실 — [ProAndroidDev: Beyond Doze](https://proandroiddev.com/beyond-doze-building-reliable-background-execution-on-modern-android-including-oem-realities-5fa0a6e05672) · [dev.to: 11 layers to survive OEMs](https://dev.to/stoyan_minchev/what-android-oems-do-to-background-apps-and-the-11-layers-i-built-to-survive-it-28bb)
- **[T-fsi]** 풀스크린 인텐트 제한(A14) — [Behavior changes A14](https://developer.android.com/about/versions/14/behavior-changes-14) · [AOSP: FSI limits](https://source.android.com/docs/core/permissions/fsi-limits) · [ProAndroidDev: FSI in 14/15](https://proandroiddev.com/full-screen-intent-fsi-notifications-in-android-14-15-what-changed-why-its-breaking-and-e5e862a75936)
- **[T-fsi-policy]** Play 정책 — [Play Console: FSI/foreground service](https://support.google.com/googleplay/android-developer/answer/13392821)
- **[T-fsi-rn]** RN 잠금화면 풀스크린 — [react-native-full-screen-notification-incoming-call](https://github.com/linhvovan29546/react-native-full-screen-notification-incoming-call)
- **[T-notif]** expo-notifications / Notifee 상태 — [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) · [notify-kit (Notifee 포크)](https://github.com/marcocrupi/react-native-notify-kit) · [expo-alarm (AlarmManager+AlarmKit)](https://github.com/vall370/expo-alarm)
- **[T-fb]/[T-fb-offline]** Firebase on Expo — [Expo: Using Firebase](https://docs.expo.dev/guides/using-firebase/) · [React Native Firebase](https://rnfirebase.io/) · [expo-firestore-offline-persistence](https://github.com/nandorojo/expo-firestore-offline-persistence)
- **[T-widget]** 위젯/퀵타일 — [react-native-android-widget](https://saleksovski.github.io/react-native-android-widget/) · [quick-settings-tiles](https://github.com/linhvovan29546/react-native-android-quick-settings-tiles)
- **[T-geo]** 배경 지오펜스 — [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/) · [react-native-background-geolocation](https://github.com/transistorsoft/react-native-background-geolocation)
- **[T-ios]** iOS 알림 한계 — [Apple: Time-Sensitive interruption level](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive) · [Dexcom: Critical Alerts](https://www.dexcom.com/en-us/faqs/what-are-ios-critical-alerts)
