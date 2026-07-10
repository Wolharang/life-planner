# LifePlanner — Design Principles

> **Role.** The design principles that steer every UX / product decision — the tie-breakers to reach for when a
> choice is unclear. **Derived from the customer profiles** (`docs/research/personas/overview.md`) and the
> service overview (`docs/core/service-overview.md`).
>
> **How to read (and the bar every principle clears).** Each principle **starts from a specific scene** in *your
> customers' lives* (a P1/P2/P3 pain or verbatim interview line) and is **derived from it** — so nothing here is a
> general UX truism ("be clean", "be simple") that would apply to any app. Format per principle:
> **장면 (the customer scene) → 원칙 (what it forces) · 거부한다 (a real competitor move it rules out) · 함의 (do/don't).**
> If a "principle" can't name a specific customer scene it came from, it doesn't belong here.
>
> Body English; customer scenes & product voice quoted in Korean. Citations: **[R#-n]** P1 interview · **F#**
> foundation · **[S#]** research · **§** service-overview · **D#** decision.

## The one design north star
> **Produce one real execution at the pre-committed moment — without guilt.** Every principle below serves this,
> and every one is traceable to a specific thing your customers actually do or fail to do.

---

## Group A — Make execution happen (the core lever)

### A1. 계획이 죽는 그 시각에 개입을 놓는다 — Put the intervention exactly where the plan dies
- **장면.** P1은 **미리 설계해도 저녁이 되면 헬스장을 안 간다**[R1-14]. 계획·목표는 이미 있는데 *그 순간* 아무것도
  붙잡아주지 않아, "아 맞다 가야하는데…" 하다 **~10분 만에** 무너진다[R2-1] (personas: P1·P3은 '계획'이 아니라 '그
  순간 착수'에서 무너짐).
- **→ 원칙.** 앱의 단 하나의 개입을 **P1이 실제로 무너지는 바로 그 시각(저녁 그 순간)에 정확히 놓는다** — 계획 짜는 때도,
  나중에 돌아보는 때도 아니다.
- **거부한다.** 계획 단계에서 돕는 것으로 끝나는 캘린더/투두(구글·카카오) — 정작 실패하는 저녁엔 아무것도 안 한다.
- **함의.** ✓ 설계 노력의 대부분을 '실행의 순간'에 · 큐는 그 시각에 잠금화면을 뚫는다. ✗ 계획·회고 화면을 예쁘게 만들고
  정작 그 순간을 비워두지 말 것.

### A2. "헬스 가기"가 아니라 "지금 신발 신기"를 시킨다 — Ask for the 5-second first move, not the task
- **장면.** P1의 실제 싸움은 문턱의 **~10분** — "아 맞다 가야하는데… 꼭 가야 할까… 그래도 가야지, 기록까지 해놨는데"[R1-13]
  — 이지, 운동 *중*이 아니다. 착수만 넘기면 지속은 쉽다[F2].
- **→ 원칙.** 그 순간 요구하는 것은 **몸을 움직이는 5초짜리 첫 동작 하나**("지금 신발 신기")뿐. 5·4·3·2·1을 **어떤
  이탈구보다 먼저** 돌려 미루는 뇌가 끼어들 틈을 없앤다.
- **거부한다.** 큰 과제("헬스 가기")를 통째로 들이미는 투두 모델 · 시작 전 준비/설정 단계.
- **함의.** ✓ 과제를 5초 동작으로 쪼갠다 · **일단 시작되면 인-플로우 이탈구는 없다**(5·4·3·2·1을 무엇보다 먼저 돌림).
  "오늘은 쉼"은 **발화 *전* 사전 토글**로만 끈다(전등처럼 다시 켤 수 있음). ✗ 그 순간 타이핑·선택을 요구하거나, **일단
  시작된 뒤 도망칠 구멍("오늘은 못 해")을 두지 말 것** — 그건 착수 전에 미리 끄는 것이다.

### A3. 소진된 저녁의 나를 기준으로 실행 화면을 만든다 — Design the moment for the depleted self
- **장면.** P1의 실패 **1순위 원인은 피곤함**[R1-5, R1-15]; 저녁 소진은 실행기능을 떨어뜨려 회피를 키운다[F3]. 계획은
  의욕 넘칠 때 짜지만 *실행*은 지친 상태에서 일어난다.
- **→ 원칙.** 실행 화면은 **원탭·무결정·무타이핑** — 지친 밤의 P1이 아무 판단 없이 통과할 수 있어야 한다.
- **거부한다.** 의욕 넘치는 온보딩/데모 상태의 사용자를 기준으로 한 해피패스 설계(대부분의 앱이 이렇게 한다).
- **함의.** ✓ 기본값은 지친 상태에 맞춰 미리 정해둔다 · 10분 지연을 탓하지 않는다. ✗ 실행 시점에 설정·읽기·선택을 넣지 말 것.

---

## Group B — Protect the person (inviolable)

### B1. 미스를 절대 벌하지 않는다 — Never punish a miss
- **장면.** P3은 매년 **신년에 헬스 등록 → 며칠 나가다 하루 빠지면 "에라 모르겠다" → 관두기**를 반복한다
  (abstinence-violation / what-the-hell [S24]). 스트릭 죄책감은 습관앱 이탈(~90%/30일)의 큰 원인[S13]; 미스 하나는
  습관을 깨지 않는다[F5].
- **→ 원칙.** 앱 어디에도 **스트릭·연속 성공 카운터·벌칙·수치 UI가 없다.** 미스는 담담히 데이터로 남고 복귀는 무마찰,
  성공은 담백한 역량 신호다.
- **거부한다.** 습관앱의 최다 관행인 **스트릭**(Habitica·Streaks·Duolingo) — 의도적으로 버린다.
- **함의.** ✓ 미스=내일 다시 돌아오는 중립 사건, 캐치업도 "아직 안 했죠"로 부드럽게. ✗ "N일 연속"·리셋 경고·다그침·요란한
  축하(과한 축하는 다음 미스의 부담을 키움) 없음.

### B2. 앱은 상사가 아니라 '어제의 나'로 말한다 — The app speaks as yesterday's-me, not a boss
- **장면.** P1을 움직인 건 **"내가 기록까지 해놨는데"**라는 *자기* 약속 감각이지, 남의 잔소리가 아니다[R1-13/R2];
  자율 동기가 통제 동기를 이긴다[F4/SDT].
- **→ 원칙.** 커밋 문구는 **어제의 내가 한 약속**을 비춘다("어제 네가 21:00 헬스라고 정했잖아"), 차분한 어른 톤으로.
- **거부한다.** 코치/감시자/수치심 유발 톤(Boss-as-a-Service, 군기반장형 앱)과 유아적 마스코트·아기 말투.
- **함의.** ✓ 문구는 사용자의 계획을 거울처럼 · 커밋은 실제 정한 시점에 정확. ✗ 명령·조작·죄책감·귀여운 캐릭터 없음.

---

## Group C — Stay light (attention & upkeep)

### C1. 딱 하나만 시끄럽게, 나머지는 침묵한다 — One loud thing; silent everywhere else
- **장면.** P1은 **스팸 앱이 중요한 알림을 묻어버려서 폰을 무음으로 해둔 적**이 있다[R2-14]. 그런데도 실행 큐는 제품의
  심장이라 줄이면 안 된다[D30].
- **→ 원칙.** 시끄러운 것은 **오직 하나 — 사전 약정한 순간의 잠금화면 실행 개입.** 단순 알림·앱 나머지는 옵트인·조용히
  (소리 기본 끔).
- **거부한다.** *양쪽 극단 모두* — 또 하나의 알림 스패머가 되는 것, **그리고** 소심한 배너로 묻히는 것.
- **함의.** ✓ 전체화면 개입은 플래그된 순간에만 · 단순 알림은 조용하고 옵트인 · 두 강도를 절대 섞지 않음. ✗ 일상적 알림 남발,
  소프트 알림을 개입처럼 위장하기 없음.

### C2. 도구가 행동보다 무거우면 버려진다 — If the tool outweighs the act, it dies
- **장면.** P1은 **연결이 필요해서 네이버 가계부를 버렸고**, 칼로리 앱은 **"숙제 같아서" 자꾸 잊는다**[R1-10]. 직접
  만든 시스템은 유지비 > 실행이 되면 ~2주에 죽는다(Notion 신드롬, §4).
- **→ 원칙.** 앱을 굴리는 수고가 **그 앱이 촉발하는 행동보다 가벼워야** 한다. 익숙한 것(달력·가계부·칼로리)은 관례를
  그대로 따라 학습 0, 낯선 소수만 온보딩, 디자인 예산은 실행의 순간에.
- **거부한다.** 올인원 '라이프 OS'(Notion식) · 설정벽 · 연결 의존. "기능 더 많음"은 여기서 가치가 아니다.
- **함의.** ✓ 오프라인·즉시 2탭 기록 · 관례 재사용 · 낯선 4개만 안내[S26][S27]. ✗ 실행에 도움 안 되면서 유지비만 늘리는 기능 없음.

---

## Group D — What we optimize for

### D1. 성공은 앱 화면이 아니라 헬스장에 있다 — Success lives at the gym, not on the screen
- **장면.** P1이 꼽은 성공은 **텅 빈 점심시간에 *실제로 헬스장에 간 것***[R1-13] — 앱을 오래 들여다본 게 아니다. 안티지표는
  '최적화할 스트릭'이다[Q6, S14].
- **→ 원칙.** 우리가 재고 설계하는 성공은 **현실의 행위**(그 순간의 '해냈다')와 정체성 전환("의지박약한 나 → 계획대로
  사는 나")이지, 체류시간이 아니다. 앱이 성공하면 오히려 **덜 열게** 될 수도 있다.
- **거부한다.** 주의경제 플레이북 — 참여 루프·리텐션 다크패턴·허영 스트릭·DAU/체류시간을 성공 지표로 삼기.
- **함의.** ✓ 큐 뒤의 '해냈다'(실행 이벤트)를 측정 · 현실의 성취를 조용히 축하. ✗ 참여 유도·조작적 리텐션 없음.

---

## Priority when principles conflict (decisive)
모든 것은 **A1 — 그 순간 하나의 실제 실행을 만드는 것**을 위해 존재한다. 충돌하면 이 고정 서열로 푼다:

1. **불가침: B1(미스를 안 벌함)·B2(상사 아님)가 어떤 '완수 넛지'보다 우선.** 죄책감·명령 톤은 P3의 what-the-hell 이탈을
   불러 장기 실행을 파괴한다. *오늘의 완수를 올리는 넛지가 죄책감/명령 어감을 띠면 → 그 넛지를 버린다.*
2. **그 순간 > 주변부: A2·A3·C1이 C2·D1과 부딪히면 앞이 우선.** 실행 큐의 잠금화면 개입은 "방해 최소화"를 덮어쓴다(그게
   C1의 내장 예외, D30).
3. **무엇을 더할 땐 C2가 관문** — 실행을 만들어낼 때만 자리값을 한다. 기본은 뺄셈.
4. **결과를 참여와 바꾸지 않는다(D1).**

**한 줄 테스트:** *죄책감·강압·유지비·소음 없이 지금 실제 실행을 만드는 쪽을 택하라.*

## Cross-references
- Personas / F1–F8 / interview tags (the scenes above) → `docs/research/personas/overview.md`
- Problem / differentiation / philosophy → `docs/core/service-overview.md` (§1, §4, §10)
- Prototype application → `docs/research/prototype/prd.md` §8 · User flows → `docs/research/prototype/user-flows.md` · Decisions (D13/D30, D33) → `docs/core/decisions.md`
