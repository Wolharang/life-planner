# LifePlanner — Decision Log

> Confirmed decisions with rationale. Newest at top. Written in English; user-facing answers in Korean.
>
> **Phase note (2026-07-10):** the **trigger prototype is built and validated** (founder-confirmed running);
> the project has moved to the **full "integrated day" app** phase. **D35 is the prototype-scoped decision**
> (trigger-first scope + v0.3 choices); **D28** carries an inline "for the prototype, lead = 0" refinement, and
> **D13 / D30 / D31 / D32** are re-scoped *by* D35 (not annotated inline). **D36 is NOT prototype-only history —
> it is the live, app-wide design foundation** (base design system + forest/gold baseline; `design-system.md`
> was promoted to core precisely as that foundation). The active product truth is now
> `docs/core/service-overview.md` + `docs/core/spec.md`; the prototype build/plan docs are archived under
> `docs/research/prototype/` (state snapshot: `PROTOTYPE-STATE.md`); the design foundation lives on in
> `docs/core/design-system.md` + `app/`.

## 2026-07-14 (later) — the security review, and account recovery

### D79. 준회원/정회원 — email verification and password reset, by LINK (the constraint chose the mechanism)
- **The gap a security review found.** The app exposed email/password signup but had **no password reset** —
  forget the password and the account is lost forever. The checklist item "비밀번호 리셋 발송 제한" was moot because
  the *feature did not exist*; the finding was the absence, not a rate limit.
- **인증번호(numeric OTP) was asked for; it is not free-tier-feasible, and I said so before building** (a request
  can conflict with the constraints — surface it, don't silently diverge). Firebase Auth's email verification and
  password reset are **link-based**, not code-based. A typed 6-digit email OTP needs a server to generate/store/
  verify the code (Cloud Function = paid Blaze, or an external mail service) **and** a place an *unauthenticated*
  client may write — which our rules forbid. Both break **free-services-only**. The founder chose the **link**
  mechanism, which achieves the actual goals (recover a password · prove the email is real) for free, no backend,
  no native change, no prebuild.
- **준회원 → 정회원.** An email/password signup issues a uid and is **fully usable immediately** — 준회원. Signup
  fires `sendEmailVerification()` (best-effort: a failed send must never fail the signup). Clicking the link makes
  them **정회원**. **A Google sign-in is 정회원 from the first moment** — Google already verified the address, so the
  same `verified` gate that unlocks reset makes every Google user a full member with nothing to click.
- **Membership is DERIVED, never stored** (`accountFromUser`): `verified = emailVerified`, `google` = carries the
  google.com provider. Read live from Auth, so it cannot drift — **and nothing new leaves the phone, so the
  처리방침 is unchanged** (no new 수집항목). Pinned by `firebase.account.test.ts`.
- **Password reset is offered only to email accounts, and it is a logged-OUT action** — you use it *because* you
  cannot sign in, so we cannot read 정회원 status there (not authenticated; email-enumeration protection hides it).
  **That is not a hole, it is why the model holds: the reset link goes only to that inbox, and completing the reset
  requires reading it — the very proof that makes someone 정회원.** A 준회원 who resets has thereby shown the address
  is theirs. Google accounts are told, in plain Korean, to sign in with Google (their password is Google's, not
  ours). Firebase rate-limits the send; the message stays neutral and never reveals whether an email is registered.
- **The 준회원 banner blocks nothing** (D20/R14): it names a benefit ("이메일 인증을 하면 비밀번호를 되찾을 수 있어요"),
  in neutral taupe, never a warning; it auto-checks once per login for a link clicked in the browser (`reload`,
  because `emailVerified` is cached), and offers 인증했어요 / 메일 다시 보내기.
- **The security review's other five items already passed** (verified against the deployed ruleset, not asserted):
  unauthenticated data access denied · per-user isolation by `request.auth.uid == uid` · no admin path exists
  (single-user app, D3) · 처리방침 page ships (`legal.ts`) · 회원 탈퇴 destroys the account and its data (D75/D76).
- **Email address change, verified (follow-up).** `changeEmail` = `verifyBeforeUpdateEmail(new)`: the link goes to
  the **new** inbox and the email swaps **only when it is clicked**, so a typo cannot strand the account and a
  momentary session-holder cannot silently move it; **Firebase also alerts the old address.** Email accounts only
  — a Google email is Google's to change. `auth/requires-recent-login` becomes "다시 로그인한 뒤 시도해 주세요",
  never a dead end.
- **Graceful failure when Firebase does not answer cleanly.** `auth/too-many-requests` (Firebase's *global* send
  quota, not the user's fault) → "지금은 메일을 보낼 수 없어요 … 잠시 후 다시"; the unknown/default branch now guides
  ("요청을 처리하지 못했어요 … 다시 시도") with the code appended, instead of dead-ending.
- **A device-local daily send budget** (`rateLimit.ts`) — the founder's anti-abuse cap, so one device cannot drain
  the shared quota and lock others out. AsyncStorage is per-install, so this *is* the "기기 기반" limit with no
  device id to read. **비밀번호 재설정 1/day** (tightest — logged out, any address), **이메일 변경 3/day**,
  **인증 메일 재발송 3/day**, device-global per action (not per email — a per-email counter would let one device
  mail N addresses). A no-network attempt is **refunded** so it never costs the day's only reset. Pinned by
  `rateLimit.test.ts`.

## 2026-07-14 (later) — leaving, and the day it must survive

### D78. 아침 요약 — a briefing, not a cue · and the words on the screen are not our words
- **아침 요약 (founder).** One notification each morning at **07:00**, listing what the day holds. **Silent by
  construction** — its own channel with `sound: null`, `vibrationPattern: null`, never the lock screen. It is a
  **briefing, not a cue**: *every needless buzz spends the budget that keeps the one loud thing loud* (C1/D30),
  and the one loud thing is the execution moment, never this.
- **Per-block opt-out** (`inBrief`, default in). *A briefing that lists a standing 강의 and the commute every
  morning is a briefing nobody reads by the third day.* The calendar previews **the exact text that will
  arrive** and lets you add/remove a block right there — *a preview that is not the real thing is just another
  promise to check later.*
- **Scheduled per day, never as a repeat.** A local notification's text is fixed when it is scheduled, so a
  daily repeat could only say something generic ("오늘 일정을 확인하세요") — a notification carrying no
  information, which is exactly what we refuse to be. 14 days are cut individually and rebuilt on every plan
  change. **A day with nothing in it gets no briefing**: an empty notification at 7am is worse than none.
- ***A briefing is a statement about the morning it was sent.*** Edit today's plan at 09:00 and today's briefing
  does **not** go out again — 07:00 has been and gone. Tomorrow's is re-cut immediately. (Pinned by test.)
- **The screens were written for us, not for him** (founder: *"무슨 기능 버튼인지 이해할 수 없다"*). Every hard
  label was an internal name that escaped: 실행 준비 상태 → **알람 권한 4가지** · 기본 리드 시간 → **미리 알림 시간** ·
  측정 (S1–S5) → **나의 실행 기록** ("S1–S5" are *our* hypotheses) · "what-the-hell 붕괴", "대용값", "JSON".
  **A number nobody can read is not a measurement, it is a decoration.**
- **Vocabulary: 해냄 → 성공 · 쉼 → 휴식. 미스 STAYS 미스.** "실패" was tried and reverted, by the founder, on the
  product's own grounds: *a miss is neutral data* — taupe, never red, no guilt anywhere. The colour was already
  obeying that; **the word was doing the judging the colour refuses to do.**

### D77. Sync must run while the app is CLOSED — the briefing exposed a hidden precondition
- **The founder's question:** *"재부팅 후 앱을 한 번도 켜지 않은 기기는 동기화가 되는가?"* It did not. **Sync only ran
  while a screen was up** — a hidden precondition of being *correct*, invisible until 아침 요약 needed it.
- Edit tomorrow on phone A, leave phone B rebooted and unopened, and **B briefs you from a plan that no longer
  exists.** Two phones, two different mornings, and nothing in either to say which is true.
- **The wrong fix, tried and cut (by the founder):** make ONE phone the briefing device. **The briefing is a
  notification, and notifications go to every phone** — only the execution moment is addressed to one (D70),
  *because only it takes the screen*. **Silencing a phone to hide a sync gap is not a fix, it is a cover-up.**
- **The fix:** `syncPullOnce()` (reconcile against the server, no listeners) driven by a **periodic background
  task** (`expo-background-fetch`, `startOnBoot: true`). It pulls, **re-arms alarms** (a headless task has no
  `startSync` hooks, so a block another phone moved would land in storage and never re-arm), and re-cuts the
  briefings. **`startOnBoot` is the whole point: the phone that most needs repairing is exactly the one that was
  rebooted and never opened.**
- **Best-effort, and said so.** Android decides when background work runs (Doze, standby). It is a **repair, not
  a guarantee** — what it buys is that "what this phone last knew" is usually minutes old instead of days.
  **Nothing depends on it:** the execution alarm is a native exact alarm that re-arms itself at boot and never
  needed the app to be open.

### D76. 탈퇴 on one phone must stick on ALL of them — the account tombstone
- **The founder's question:** *"다른 기기에서 동기화가 시작될 때쯤 또 다른 기기에서 탈퇴를 한다면?"* The hole was real
  and worse than a race. The other phone is still logged in, still holds every row, and — the part that bites —
  **its Firebase ID token stays valid for up to an hour after the user is deleted.** Its reconcile's own rule is
  *"a row the cloud has never seen is pushed up"*, and after the wipe the cloud has seen nothing. **It would push
  the entire deleted account back**, under a uid with no user behind it: data nobody can read, nobody can delete.
- **No client fix reaches it** — the offending device is another phone, possibly an older build, acting in good
  faith. So the door is shut where it cannot be argued with: **the security rules**.
- **The account tombstone** (`users/{uid}.closedAt`) is written **first**, before a single row is deleted, and is
  **awaited** — if it cannot land, 탈퇴 **fails**: *better to tell the user to retry than to destroy an account we
  cannot keep shut.* Rules refuse every write to a closed account, and the tombstone can never be edited away or
  deleted — a client that could remove it would simply resume the resurrection it prevents.
- **It carries the user's choice** (`wipeDevices`). "기기 기록도 함께 지우기" is a decision about the **account**, but
  only one handset is in your hand when you make it. Every device honours it: signs out, erases if asked, returns
  to the main screen, **and says which of the two happened**. *"모든 기기에서 지웠다" must not quietly mean "지운
  폰에서만 지웠다".*
- **Readable without a login** (`allow get: if true`, `list` denied). A phone offline longer than a token lives is
  signed out by **Firebase itself** on reconnect — *an owner-only read is unreadable exactly when it is needed.*
  `checkClosedWhileSignedOut()` asks on its behalf with the uid it last synced as.
- **The tombstone is permanent, and it is NOT 개인정보** (founder, and he was right — I had written the opposite
  into the 처리방침). 개인정보보호법 제2조 제1호 나목 turns on **결합 용이성**: by the time it exists, the Auth user is
  deleted (the only place an email ever lived), every Firestore document of that account is gone, and the app
  sends data nowhere but Firebase. **No mapping from the uid back to a person survives**, so there is nothing to
  combine it with. ***Writing "we retain this" into a 처리방침 is not caution — it tells the user we kept something
  about them, which is exactly what we did not do.***

### D75. Leaving — 회원 탈퇴 and 모든 기록 삭제 (the clauses that had no code behind them)
- 이용약관 제6조 and 처리방침 제7조 **already promised** 탈퇴 and 파기. **There was no implementation.** *The emptiest
  kind of clause, because the user cannot discover it is empty.*
- **회원 탈퇴: data first, account second.** Delete the Firebase user first and the rules stop recognising the
  owner — the documents become unreachable **and undeletable**, stranded forever while the app claims 파기.
  `deleteCurrentUser()` now **throws** instead of quietly signing out: swallowing the failure is fine for undoing
  an empty signup and **a lie for 탈퇴**.
- **Alarms are cancelled before storage.** An alarm lives in the OS, not in our data. *A moment firing for a task
  that no longer exists, seconds after the user asked us to erase everything, is the app failing in the one place
  it must be trusted.*
- **Whether this phone's records go is the user's choice.** *Leaving the service is not the same as giving up what
  you wrote.*
- **모든 기록 삭제 TOMBSTONES; it must not hard-delete.** It did, and **the button was quietly undoing itself**: a
  hard delete leaves no trace, so the other phone saw rows *"the cloud has never heard of"* and **pushed the whole
  account back**. A tombstone is how a deletion travels. (회원 탈퇴 keeps the hard delete — the account is being
  destroyed and the tombstone refuses every write anyway.)
- **`purgeFirestoreCache()` — a verified data leak, not a theory.** After the founder's 탈퇴, the server held **134
  meal documents under a uid with no Auth user**, written *during* the withdrawal. The cause was not the delete:
  it was **Firestore's outbox**. A write already handed to the SDK **cannot be recalled** — only the SDK's whole
  local state can be discarded (`terminate()` + `clearPersistence()`). Hence the app restarts after 탈퇴.
  ***"We deleted your data" must not be a race we sometimes lose.***
- **The UI is a sheet, not `Alert.alert`.** The OS dialog is one-word buttons in whatever order the platform
  likes — the format least likely to be read, for the question most in need of reading. **Each option says what
  SURVIVES.** Destructive rows use `warn` (#B5533C), never alarm-red.

### D74. Consent belongs to the ACCOUNT, and it is evidence — not state
- **Per-tick seconds** (founder): the four ticks are four separate acts. *One timestamp stamped over all four at
  submit would be a record of the **submit**, not of the consents.* Unticking clears the time.
- **It goes to the server with the account.** It lived only in AsyncStorage, so logging in on a second phone
  showed an empty 동의 내역 — same person, same account, no consent in sight. It carries the **device** (D70's id +
  label) and the **version of the words they saw**; a `LEGAL_VERSION` bump is what re-asks them.
- **It is NOT a synced row.** `sync.ts` is last-write-wins with tombstones — right for a block you edit, **wrong
  for evidence**, which a later write must never overwrite. Its own `consents` collection, **create-only** by the
  rules. ***A consent record the client can rewrite is not a record of anything.*** (Firestore rules are
  OR-evaluated, so the wildcard's `update` had to be *explicitly withheld* — being "more specific" was not enough.)
- **The age is asked, and kept.** 이용약관 제5조 lets the 기관 refuse 만 18세 이하, but *a discretion with no way to
  exercise it is a discretion in name only* — so there is a fourth tick, and it is recorded (처리방침 제2조 ④).

## 2026-07-14 — the app becomes a service someone else could use

### D73. Consent gates SIGNUP, never LOGIN — and an account we refuse must leave nothing behind
- **The founder:** pressing **Google로 계속하기 on the 로그인 tab** bounced an existing account to 가입 and demanded
  the tick boxes. ***Asking again for a consent the user already gave is not caution — it is a wall in front of
  a door they own.***
- **The knot: one button, two acts.** Google is a **login** for someone who has an account and a **signup** for
  someone who does not — and Firebase only says which **afterwards** (`isNewUser`). The first version resolved
  that by refusing everyone: *punishing the majority to catch the minority.*
- **Decision.** 가입 tab → ticks up front. **로그인 tab → no ticks.** If the sign-in turns out to have *created*
  an account, it is **deleted** (`deleteCurrentUser`) and the user is sent to 가입. **An account we refused must
  not be left standing on the server** — the next login would find it and treat it as long-consented.
- **`holdSync()` / `releaseSync()` — the part that was nearly a data leak.** Sync starts the *instant* auth
  reports a user. Without a hold, those milliseconds are enough to push every local row to the uid we are about
  to delete — and **deleting an auth user does NOT delete its documents.** We would have taken the account back
  and **left the data on the server**: precisely what the consent gate exists to prevent. Sync is now held
  across the decision; only a login that survives it turns sync on.
- **Both failure modes are silent, so they are pinned by test** (`syncGate.test.ts`, verified to fail on an
  injected regression): a hold never released = **sync off forever with the app saying nothing** (this is how
  180 imported expenses once sat undelivered while the app reported everything synced); a hold released anyway
  = the rejected account gets the data.
- **Consent asks 4 things, in one short line each** (D72 cut the subtitles): **만 19세 이상** — a *statement*, no
  보기 link — plus the three documents. The age tick is how 이용약관 제5조's discretion is actually exercised: *a
  discretion with no way to exercise it is a discretion in name only.*

### D72. A 약관 is an instrument, not a message
- **The founder, reading the shipped text:** *"「서비스는 의료·안전 목적의 도구가 아닙니다」 같은 건 '약관'이 아니라
  전달하는 메시지이다. 「최소한만 모읍니다. 기기 고유번호는 수집하지 않습니다」 같은 건 방침이 아니다."* He was right.
- I had corrected the drafts' *content* (D71) and then filled them with **reassurance prose**. A 약관 is
  **normative** — it defines, allocates duties, and disclaims liability, in 조·항·호. A 개인정보 처리방침 states the
  **statutory items of 개인정보보호법 제30조**. Neither is a place to comfort the reader. ***A document that
  comforts instead of binding is worth nothing at the moment it is actually needed.***
- **The substance survived; the form changed.** "의료 목적의 도구가 아닙니다" → **이용약관 제14조 (서비스의 성격 및
  면책)**, citing 「의료기기법」. "최소한만 모읍니다" → **처리방침 제2조**'s exhaustive item list + **제10조 (자동 수집
  장치를 설치·운영하지 아니합니다)**. "지금은 위치를 수집하지 않습니다" → **위치약관 제3조 ②**: collection is
  *conditioned* on the permission and the feature being on — which is the same fact, stated as a rule.
- The 처리방침 follows **개인정보보호법 제30조** item order.
- **The party is 기관, and the contact is an office.** I had renamed it to **"운영자(개인)"** and signed it with
  the founder's personal name. Restored to **LifePlanner(이하 “기관”)**, contact **LifePlanner 담당자**.
  ***A document that binds an individual by name binds the wrong thing.***
- **No sentences in parentheses** (founder's rule). Parentheses are for a **heading** — 제1조 (목적) — a
  **single-word marker** — (필수) (선택) (TLS) — or the definitional `(이하 “…”)`. *"기기 식별값 (실행 알람을
  표시할 기기의 지정에 한하여 이용합니다)"* became **제2조 ③**, its own 항. **A qualification that matters belongs
  in a clause; one hidden in brackets is one nobody reads.**
- **The 기관 is NOT a 위치정보사업자, and the document says so** (founder): 위치정보법 제9조's 신고 duty binds those
  who provide the service **사업으로 영위** — as a business. This one is free, so it **cannot file**, and I was
  wrong to say it must. The location terms therefore **disclaim the status** (제2조 ①), drop the remedies that
  presuppose it (방송통신위원회 재정), and instead **bind the 기관 by contract** to the same protections (제2조 ②).
  *Claiming a status you do not hold is not extra caution; it is a false statement about who you are.*
- **The messages did not disappear — they moved to where messages belong:** the one-line summary under each
  consent row, and 공지사항. `legal.test.ts` now fails the build if a legal document contains a highlighted
  aside (the `note` block) or the app's friendly 해요체. *A clause that needs a highlight to be believed is not
  a clause.*

### D71. The app IS the policy document — and it may only claim the collection it actually performs
- **Signup asks for all three, and all three are 필수** (founder, 2026-07-14): 서비스 이용약관 · 개인정보 처리방침 ·
  위치기반서비스 이용약관. Effective **2026-07-14**.
- **`app/src/content/legal.ts` is the document.** The first attempt baked the founder's `reference/*.md` drafts
  into the bundle and rendered their markdown. That was wrong twice over: **the drafts leaked their own
  scaffolding onto the screen** (`(초안)` in the title; `## 8.` on *two different clauses*), and **they described
  an app we never built** — 결제 기록, IMEI, Mac Address, 체중·신장·프로필 사진, 협력회사로부터의 제공, 팩스 수집.
- ***A privacy policy that claims collection we do not perform is not caution — it is a false statement about
  the user's data***, and it takes on duties we never owed. So 제2조 was rewritten from the code that actually
  collects: 이메일/비밀번호 또는 Google uid · blocks · expenses · meals · **기기 이름** (D70 uploads it, so the user
  is owed the sentence) · 동의 기록 · Firebase의 접속 기록/IP. Nothing else. `legal.test.ts` **fails the build** if
  a never-collected term (IMEI, 결제, 사진, …) appears anywhere but in a sentence that denies it — and if any 조
  number repeats, which is exactly how the draft ended up with two 제8조.
- **The drafts in `reference/` are superseded**, kept as the source they were drawn from. The generator and its
  drift test are gone: there is no copy to drift, because there is no copy.
- **Location: 필수 동의, zero collection.** The app requests no location permission today. The document says so
  in its own opening note, and says the consent will be re-confirmed *at the device permission* when the feature
  it exists for — spotting that you actually walked into the gym — is built.
- **Google is gated too.** For a first-time user, "Google로 계속하기" is not a login — **it is the signup**. Gate
  only the email form and an account gets minted with no consent behind it at all.
- **The tick is recorded** (`lp.consent.v1`: **per document**, when, and the **version of the words they saw**).
  A tick that leaves no trace is theatre — we could not say we have consent, nor tell whether the text they
  agreed to is the text we still ship. A `LEGAL_VERSION` bump is *what re-asks them*. The per-document date is
  what the 동의 내역 screen shows on each row.
- **공지사항 is not decoration — the terms oblige it** (제3조 2항: a change is announced **in-app**, 7 days ahead,
  30 if it disadvantages the user). Without that screen the app could not keep its own terms. Static and
  in-bundle: a notice you cannot read offline is worse than one shipped in the binary.
- **The links sit quiet at the bottom of 계정.** Nothing on that shelf helps you do the thing at 7am. Findable
  when looked for, invisible when not — but *reachable*, because consent you can only read once, while trying to
  get past it, is not really available at all.

## 2026-07-13 (late) — the two-device test, and what it exposed

### D70. A cue that goes off in three rooms is not a cue — the moment is addressed to ONE phone
- **The founder, on the two-device test:** with sync working, an `실행` block **fired the full-screen moment on
  every logged-in phone at once**. Three phones lighting up together does not say *"do it now"* — it asks
  **"where am I supposed to do this?"** The intervention's entire power is that it is **unambiguous**; three of
  it is none of it.
- **Decision.** The account remembers its **devices**, and an `실행` block **names the phone(s) that may take the
  screen**. Default = **the phone you were holding when you planned it** — you plan on the phone you use.
  Editable: pick another, or several, or all.
- **Everything still syncs. Only the takeover is addressed.** The phones you did *not* name still **tell** you —
  **one buzz + a notification**, at the same moment, on the quiet channel. *Being unaware is a different failure
  from being interrupted in three rooms at once*, and we refuse both.
- **Two fallbacks, both deliberately LOUD.** A block with no `executeOn` (everything written before D70) fires
  **everywhere**; so does a block whose phone hasn't identified itself yet. **An alarm on the wrong phone is an
  annoyance; an alarm on *no* phone is the product failing.** The device is therefore registered **before any
  alarm is armed**, so that fallback stays the emergency it is meant to be and never becomes routine.
- (Confirmed while here: the quiet channel's vibration is `[0, 220, 120, 220]` — **two short buzzes, once**. It
  does not drone.)

### D69. The far future has to be reachable — the editor gets a calendar
- **The gap.** The block editor offered a **21-day chip row** (add mode) and a **‹ › that moved one day at a
  time** (edit mode). So anything genuinely *ahead* — 9월 2일 개강, 12월의 시험, 두 달 뒤의 결혼식 — was in
  practice **unenterable**: you would tap the arrow eighty times, or give up.
- **This mattered more after D67.** Once "important events" *became* blocks, the block editor is the **only**
  door onto the calendar — and it could not reach the dates that people put important events on. The unification
  would have quietly cost the app the very thing the calendar was for.
- **Decision.** A month calendar opens from the editor: any month, any date. It keeps the **multi-date** add
  (D37 — N dates = N independent blocks, never a repeat rule); in edit mode it collapses to one.
- The chip row stays: it is for **"soon"** (tonight, this weekend), which is what the day-planning habit (S3)
  actually needs, and it is one tap faster than a calendar for exactly that.

### D68. A `없음` block answers itself — it is never asked, and it is never counted
- **The founder:** *"이렇게 추가되는 알림 없는 일정은 굳이 '해냄'을 누르는 등 체크하게 할 필요가 없다."* Correct, and it
  matters more than it looks.
- **A `없음` block is context, not a commitment** (D67). It holds an hour so the day is honest — 강의, 이동, 알바 —
  and it **happens to you**. Asking *"did you do it?"* is absurd; demanding a tap to clear it turns the honest
  day into a **chore list**, which is exactly the maintenance death (C2) the product is built to avoid. The
  moment you must *tend* your calendar, you stop keeping one.
- **Decision.** Once its time passes, a `없음` block simply flows into 지난 기록 as **지남** — neutral grey, no
  verdict, nobody passed or failed anything. It is **derived, never recorded**: no outcome row is written, so
  it cannot enter the evidence store the self-experiment reads (S1/S5). *A 강의 that happened exactly as planned
  is not a datum about the lever.*
- Nor is it counted in the day summary or in 돌아보기: counting it would make **every honest day look like a day
  of unfinished business**. No 해냄 button, no 쉼 switch — there is nothing to skip.

### D67. ONE unit. The alert tier *is* what the thing is. (`ImportantEvent` is retired)
- **The founder's report.** He added a block with 알림 없음 — and **it did not appear on the calendar**. The
  month showed a free afternoon that was not free. Meanwhile a calendar "일정" had no effect on the day plan.
  **Two ways to put a thing on a day, and they did not know about each other.**
- **The two entities were always the same thing.** An `ImportantEvent` (date · time · title · notify-lead ·
  color · memo, never evaluated) is a `TimeBlock` with **`alert: "none"`** and no end time. Keeping both forced
  the user to answer a question that has nothing to do with their life — *"is this a 일정 or a 블록?"* — and then
  punished the answer: pick 블록 and your commitment vanishes from the calendar. **A calendar that hides half
  your commitments is worse than none: it does not merely omit, it actively tells you the day is free.** That
  is also the whole point of D62 — a block is *an hour that is taken*, and an hour that is taken must be visible
  where you go looking for free hours.
- **Decision (founder's own design).** **The unit is the block. The alert tier says what it is:**
  · **없음** — it just holds the hour. Context, **not evaluated** (exactly what R1 always said of an event).
  · **알림** — it matters; it tells you.
  · **실행** — the lever; it makes you.
  **Kind** (일반 / 운동 / 러닝) is orthogonal to all three. `색` and `메모` move onto the block.
- **Consequence.** `/add-event` and `eventRepository` are **gone**; the calendar's ＋ adds a block; the month grid
  draws **every** block; the `events` collection leaves sync. A one-time migration folds `lp.events.v1` into
  blocks (a notify-lead becomes `soft`, none becomes `none`; ids, color and memo preserved).
- **Why now.** It contradicts **PRD R1/R3 and D4's layer split** — whose stated basis was *temporality* (events
  weeks ahead, blocks the night before). **Real use falsified that**: the founder reached for a block to design
  his calendar, and the calendar lied to him. And it is the cheapest possible moment — **zero events exist**,
  locally or in the cloud. Two weeks from now it would be a data migration with data in it.

### D65. Loudness has THREE settings

### D65. Loudness has THREE settings — 무음 · 진동 · 소리 (revises D43's boolean)
- **The gap.** D43 made loudness a per-block boolean: **소리 + 진동**, or **진동만**. There was no way to simply
  **be seen**. So a block added only so the day is honest (강의, 이동 — the very blocks D62 brought `none` back
  for) still **buzzed your leg**, every single time.
- **A vibration is not free.** Every needless buzz spends the budget that keeps the **one loud thing loud**
  (C1/D30). If the phone twitches twenty times a day, the twenty-first — the one that matters — is just another
  twitch. The quiet end of the axis has to actually be quiet.
- **Decision.** Loudness is one choice with three settings, still **independent of the tier** (D43): a `soft`
  alert can be silent, and **so can the execution moment** — it takes the screen and says nothing at all. *The
  screen IS the intervention; the noise was only ever its escort.*
- **Three notification channels**, because Android freezes a channel's sound **and its vibration** at creation
  and you can only ever ship another one. Old rows read forward (`loudnessOf`): a pre-D65 block lands where its
  owner left it and **can never become silent by accident**.

### D66. Sync must never claim a write landed when it didn't
- **The failure (found on the second device).** The founder imported his budget history — 180 expenses — logged
  in on the other phone, and **not one expense was there**. Meals had synced; expenses had not.
- **Two faults, and the second is the one that matters.**
  1. Firestore's outbox **jammed**: 400 writes were queued at import, the meals drained, and the 180 expenses
     sat there **undelivered, unrejected, and unretried**. Clearing the queue and re-pushing landed all 180 in
     seven seconds, with zero failures — nothing was ever wrong with the data.
  2. **The app declared them synced.** A Firestore snapshot **layers your own un-sent writes on top of the
     server's state**, so `reconcile` read "the cloud has all 180 of these", pushed nothing, and never tried
     again. The app was confidently, permanently wrong — and said so to nobody.
- **Decision.** The reconcile — the one moment we decide **what the cloud is missing** — reads with
  `source: "server"`, never the cache. And because a write is **fire-and-forget by necessity** (awaiting it
  hangs the save button offline), the app now **keeps books**: what it handed over, what actually landed, and
  it **shows the difference** on the account screen ("아직 올라가지 못한 기록 N건").
- **The rule.** *"We don't wait" must never become "we don't know."* A number the user can see is the entire
  distance between "eventually consistent" and "your year of receipts is gone and nobody said so."

## 2026-07-13 (night) — what the device found that no audit could

### D62. "없음" comes back — a block is an HOUR, not only an alert (revises D43)
- **D43 deleted the `none` tier** with the reasoning: *"a block you'd never be told about isn't worth adding."*
  **That reasoning mistook a block for an alert.** A block is also **an hour of your day that is taken.**
- **The founder's case (2026-07-13):** 강의, 알바, 이동 must be on the plan **so the day is honest** — so the
  free-slot hint doesn't offer a gap that isn't free, so you don't double-book, so **tomorrow's workout lands
  somewhere it can actually happen**. That is *calendar design*, and it has nothing to do with wanting a
  notification. Forcing such a block to carry one means being **pestered about a lecture you are already sitting
  in** — and every needless notification spends the budget that keeps the **one loud thing loud** (C1/D30).
- **Decision.** Three tiers again: **없음** (silent; it holds the hour and never speaks) · **알림** · **실행**
  (still the default). A `none` block arms nothing, is not the lever's business, and is not in S1.

### D63. Moving a settled block to a new time RE-OPENS the occurrence
- **The device failure, and it is the worst kind — the app looked broken and the founder looked wrong.** He
  missed a block, **moved it to a later time to actually do it**, committed at the moment ("응, 할게") — and the
  app showed **미스** immediately and **"진짜 했어?" never came.**
- **The cause.** The block kept `status: "fail"` from the earlier miss. So: the card read 미스 before the new
  time had even arrived · the old `miss` outcome still keyed `taskId|date`, so when the moment fired again the
  catch-up net saw the occurrence as **already resolved and threw the fire marker away** · and `scheduleBlock`
  cancels `<id>#recheck` for any block that is not `planned`, so **the re-check was cancelled**. **The alarm
  rang into an app that had already decided the answer.**
- **"I missed the 15:58 gym, I'll move it to 17:27 and do it" is the most natural thing a person does with this
  product** — and it was the one thing the product silently refused to let work.
- **Decision.** If a **settled** block's `start`/`date` moves, the occurrence is **re-opened**: status back to
  `planned`, verdict cleared, stale outcome and fire/missed markers removed. It cannot fire by accident —
  `settle()` and the 쉼 toggle don't move the clock. **Evaluation stays honest** because the **D-1 snapshot does
  not move** (D23): 돌아보기 still knows you promised 15:58; you just get to actually do the thing.

### D64. A deletion made while LOGGED OUT must still reach the cloud
- **The device failure:** the founder deleted blocks **while logged out**, then logged in — and **every one of
  them came back**.
- **The cause.** `syncRemove` is a **no-op with no account** (no `uid` → no document to tombstone), which is
  correct as far as it goes — but it means the deletion left **no trace anywhere**. The cloud still held the
  rows from an earlier session, and the login reconcile honestly handed them straight back. **D53/D54 closed
  resurrection for deletes made while logged *in*; this was the same bug in the state the app spends most of its
  life in** — an app that insists you don't need an account (D20).
- **Decision.** A delete **always** writes a **local tombstone** (`lp.tombstones.v1`), account or not. At the
  next reconcile those are pushed up as real tombstones and the rows are buried. Kept 180 days — long enough to
  outlive any plausible logged-out gap.
- **The general rule, and it is the third time today:** *an invariant that must survive being offline or logged
  out cannot live in the code path that only runs when you are online and logged in.*

## 2026-07-13 — the full audit (5 independent auditors: PRD · spec/data/arch · design · research · code)

### D57. An alarm means a WALL CLOCK, not an instant
- **Bug.** The native mirror stored only `fireAt` (an epoch), so `BootReceiver`'s TIMEZONE_CHANGED handler
  re-armed **the same instant** in the new zone. Fly one zone east and "21:00 헬스" arrives at **22:00 local**.
  The layer built to survive a timezone change was doing the one thing such a change must undo. Same class of
  failure for DST, and for a user correcting a wrong system clock.
- **Decision.** A block's `start` **is a wall clock** (data-model §2.3: "절대시각 아님") — nine in the evening
  *wherever you are*. The mirror now carries the wall clock the alarm **means** (`wallDate` + `wallMinute`), and
  the instant is **re-derived in whatever zone we are in**. The stored epoch is a cache, not the truth.
- **The exception, and why it is not one:** the **re-check** (`#recheck`) keeps its absolute instant. It is a
  genuine *interval* — "five minutes after you committed" — not an appointment. Re-timing it to a wall clock
  would be the same error in reverse.

### D58. Templates: planning is something you PICK, not something you COMPOSE (the S3 mitigation)
- **The gap.** PRD §4 names **S3 (does the founder actually make a next-day plan?) the single biggest
  non-technical risk** — "if it stays ~0, the whole flow fails regardless of quality" — and the research
  answered it (essence §3, HMW H1) with **templates**. **None of it was built.** The only S3 support in the app
  was a nudge row saying "go plan tomorrow", which asks for **exactly the effort that is at risk**. The gap was
  never logged as a scope cut; it simply vanished.
- **Decision.** The last day you actually planned can be **copied into another day in one tap** (`/day`).
- **The rule that keeps it honest:** each copy is an **independent new block** (D37 — still no recurrence),
  **planned now** (`plannedAt = now`, snapshot = the copied values). So S3 keeps measuring the real habit and
  **cannot be gamed by the feature built to support it** — copying tomorrow's plan tonight *is* planning ahead;
  copying it on the day is not, and the number will say so.

### D59. P-d is DONE now — the reference apps' own data can finally get in
- **The lie in the plan.** `implementation-plan.md` recorded **P-d (reference-app migration) as "done inside
  F3"**. Only the **field mapping** was done. The **data** had no path in — and `backup.ts` *rejected* any file
  whose `app !== "lifeplanner"`, so the founder's own `expense_backup_*.json` / `diet_backup_*.json` **bounced
  off the app built to replace those apps.** Half of "one integrated day" (G2) was unreachable.
- **Decision.** The reference exports (bare JSON arrays) import directly. Rows are sniffed, not trusted:
  `amount` → Expense, `kcal` → MealEntry.
- **What we refuse to import, and why it matters:** the calorie app logged **러닝/운동 as diet rows**. Here a
  workout **is a TimeBlock marked success** (D22) — importing them as meals would **invent calories nobody ate**
  and corrupt every kcal total. They are dropped, and the dialog **says how many**, because a silent drop is a
  lie. Photos are dropped too (D19).

### D60. Measurement: S1 counts only the LEVER's universe; S5 matches the task, not the id
- **S1 was grading the lever with blocks the lever never touched.** Its denominator was *every* outcome, so a
  강의 or 점심 block carrying a plain `알림` — which the execution moment never fires on — could be ticked from
  home or 돌아보기 and land in S1. Those can only drag it **down** (a soft block cannot produce an
  `execution-screen` done). PRD §4's falsification condition is *"if S1 is no better than a plain reminder, the
  lever has failed → stop and redesign"*: **a working lever could have been thrown away on a number that was
  measuring something else.** S1 now counts only `alert === "execution"` blocks.
- **S5 was structurally 0% forever.** It looked for "a later `done` with the same `taskId`", but **D37 killed
  recurrence** — a block belongs to one date and gets a fresh id per date, so two outcomes can never share an
  id. It was a leftover from the prototype's recurring `Task`. It now matches **the task's name**, which is what
  actually recurs (헬스 missed Monday, 헬스 done Wednesday).
- **The instrument shipped behind `__DEV__`** — so the **release build the self-experiment runs on had no
  instrument at all**. Two weeks of honest use and nothing to read at the end. It is a real 자가실험 section now.
- **The log can be corrected.** There was no way to delete a record. You cannot run an honest self-experiment on
  a log you cannot correct, and **a false record is worse than none, because we reason from it** — this device
  carries test blocks, prototype leftovers, and outcomes the bugs above *invented*. Long-press a line to remove
  it; 설정 → **기록 초기화** clears the **evidence** (never the plan) for day zero.

### D61. "아직" is an event worth recording — the log shows what happened, not only what was decided
- Answering **"아직 안 했어"** deliberately records **nothing** (R7: the outcome stays *pending*, never an instant
  miss). But 지난 기록 showed **outcomes only**, so the answer left **no trace at all**. The founder looked for
  what he had just done, found nothing, and read the nearest unrelated line as his own.
- **An app that keeps no record of your answer looks like an app that didn't hear you.** The fire marker already
  knew; it simply was not shown. **"아직" is neutral data** — taupe, never red, **not a miss**, and it does not
  enter S1. Nothing about the no-guilt model changes; only the silence does.

## 2026-07-13 — words that lied (found on the device)

### D56. A miss may only be recorded by someone who said they missed it — "미룸" → "안 했어"
- **The failure.** The catch-up card (R18) offered **했어 / 미룸 / 나중에**. **미룸** ("postponed") recorded a
  **permanent, irreversible miss** — while the button right next to it, **나중에**, really did only defer the
  prompt. **Two buttons that both read as "I'll do it later", doing opposite things.** The founder pressed
  미룸 meaning *defer*, and the app heard *I failed*, closed the occurrence, and asked him for a reason.
- **Decision.** The button says what it does: **안 했어** — the same words the execution moment already uses
  ("아직 안 했어"). **나중에** keeps deferring. **A miss is now only ever recorded by someone who said they
  missed it.** The PRD's own R18 wording carried the bad name and has been corrected too — fixing only the code
  would have let the document put it back.
- **Why this matters more than a label.** A false miss is not a cosmetic error: **S1 is the number the whole
  product lives or dies by** (the falsification condition). A word that quietly logs failures the user never
  admitted poisons the only evidence we have — and it does it while claiming to be the no-guilt path.
- **Related, same day, same root:** the home card's **해냄** — a filled pill in the settled-badge slot, a noun,
  reading as a *verdict* ("the app says I did it") when it was in fact a *button* offering to record one. Now
  an outlined **했어요** (first person; an answer you give), and the card states its own state ("아직 안 했어요",
  taupe, never red) instead of leaving the user to infer it.
- **The rule to keep:** *for any control that writes an outcome, the label must be the outcome.* If a word
  could plausibly mean "not now", it may not mean "failed".

## 2026-07-13 — F0 (backend)

### D55. A "<id>#recheck" alarm is NOT an orphan — the sweep that kept alarms honest was eating the lever
- **The device failure (founder, 2026-07-13):** commit → **"응, 할게"** → the **~5-minute re-check never came**,
  and the block was sitting in the app as a **miss**. The heart of R7 — *the moment comes back and asks
  "진짜 했어?"* — silently did not happen.
- **The cause.** `rearmBlockAlarms()` compares every **armed alarm id** against the set of **block ids** and
  cancels anything unmatched ("orphan alarm → evict", architecture §11 layer 4). But the native moment arms its
  own follow-up under the id **`<blockId>#recheck`** — and **no block has that id, and none ever will**. So every
  in-flight re-check looked like a ghost and **was cancelled**. Open the app inside those five minutes and the
  follow-up died; the moment never returned and the catch-up net (R18) later recorded a neutral **miss**.
  `scheduleBlock` had been written *carefully* to preserve the re-check (it only cancels one once the block is
  resolved, with a comment saying exactly why) — and the orphan sweep next door undid that care.
- **F0 turned a latent bug into a constant one.** The sweep now also runs on **every Firestore snapshot** (the
  sync apply-hook), so merely **reconnecting** — coming out of airplane mode — could kill the follow-up.
- **Decision.** An alarm is an orphan only when **the block it belongs to is gone**, and a re-check **belongs to
  the block whose id it carries**: strip the `#recheck` suffix before deciding. An armed re-check whose block
  still exists is left **untouched** — it is the lever mid-flight, not a leak.
- **Tested** (`blockRepository.test.ts`): an in-flight `#recheck` survives a re-arm; an alarm whose block is
  gone still gets evicted **along with its re-check**. This is the second time a "tidy-up" nearly cost the
  product its heart — **any sweep that cancels alarms must be able to name what it is cancelling.**

### D54. A tombstone is TERMINAL — a queued write from an offline device must not undo a delete
- **The hole D53 did not close** (found by the founder walking three devices through a week, before any device
  ran it). D53 made *our* cutover refuse to push over a tombstone. But a device's edits are **already queued
  inside Firestore's own disk-backed offline queue at the moment they are made**, and that queue flushes
  **unconditionally on reconnect** — it never passes through our reconcile, which only governs what *we choose*
  to push. Walk it: Mon all three devices hold X · Tue **B (offline) deletes X** (tombstone → B's queue) ·
  Wed **A (online) edits X** · Thu **C (offline) edits X** (edit → C's queue) · Fri **B reconnects** → the
  tombstone lands, X is dead, A drops it · Sat **C reconnects** → C's Thursday write flushes. It carried
  `deletedAt: null`, so it **overwrote the tombstone: the deleted block came back — and re-armed its alarm.**
- **Decision: `deletedAt` is never sent on a push, and can never be cleared.** A row's payload simply omits the
  field (`putPayload`), so `merge: true` leaves any tombstone standing and a late write lands harmlessly on a
  dead document. **The security rules enforce it server-side too** — an update that moves `deletedAt` from
  non-null to null is **rejected** — so a future client bug cannot resurrect anything either.
- **This is honest for this product: there is no "undelete."** A block you re-create gets a **new id**. So
  "once dead, always dead" costs us nothing and buys the guarantee that matters: **a block you deleted can
  never come back and take your lock screen.**
- **The general lesson, worth keeping:** *reconcile-on-reconnect cannot police writes that were queued before
  the reconnect.* Any invariant that must survive an offline device must be enforced **in the shape of the
  write itself** (and at the server), not in the client's decision to send it.
- Tested (`putPayload`, `sync.test.ts`) with the three-device week written into the test's comment, because
  this failure needs 3 devices, an offline window, and a delete to reproduce — it would never surface by hand.

### D53. Rejoining the cloud is a MERGE against real server state — never a blind push, never a blind pull
- **The bug this exists to kill (found by the founder's question, before any device ever ran it).** The first
  cutover simply **pushed every local row up at login**. That **resurrects the dead**: phone B deletes block X
  (leaving a `deletedAt` tombstone); phone A is offline and still holds X; A comes back and pushes X with
  `deletedAt: null`, **overwriting the tombstone**. The deleted workout returns — **and re-arms its alarm**. A
  block you deleted must never come back and take your lock screen. That is the lever turned against the user.
- **Decision — act only on what the SERVER says, and merge row by row.** The cutover no longer runs at login. It
  runs on the **first server snapshot** (`metadata.fromCache === false`), the only thing that knows what is
  really there *and what is a tombstone*. Per row:
  - cloud says **deleted** → drop it locally too. The deletion wins; **we never push over a tombstone**.
  - cloud has **never seen it** → push (this is the real cutover: rows made while logged out).
  - cloud has it and **ours is newer** (`updatedAt`) → push ours. This also **repairs a permanently failed
    push** (a rules rejection, bad data): every session reconciles, so a dropped write is not lost forever.
  - otherwise → **the cloud's row wins**, untouched (a stale local row can never overwrite a fresh remote one).
- **Both directions are destructive if taken on a guess**, which is why nothing happens before the server
  speaks: projecting a cold, empty cache would **erase** a phone full of plans; pushing blindly would
  **resurrect**. Until the server answers, the device runs on local storage — exactly as it does logged out.
- **`updatedAt` (a client clock) is used here, and §6 forbids client clocks for *conflict resolution*.** No
  contradiction: this is not conflict resolution. Concurrent writes are still settled **server-side,
  last-write-wins**. This is only "which side holds something the other lacks", where the client clock is the
  only signal that exists at all.
- **Transient failures are Firestore's problem, and it solves them:** `set()` is queued in a disk-backed cache
  and retried across restarts, in order. We never await it (an offline save would hang the screen forever).
  **Permanent** failures fall through to the next session's reconcile.
- **Tested as a pure function** (`planReconcile`, `sync.test.ts`) — the resurrection case has a test with the
  scenario written into its name, because this is a failure that would only surface on a second device, weeks in.

### D52. Google sign-in is IN (revises D12's "later"). Kakao is BLOCKED by free-only (D10) — deferred
- **Google — decided, built.** D12 said "id+password first, Google later" and PRD §7.2 excluded it. The founder
  enabled Google in the Firebase console (2026-07-13) and re-issued `google-services.json`, so **Google is now a
  first-class login**, alongside email/password. Both doors end at the same `uid`; nothing downstream cares which
  one was used, because sync keys off `uid` alone.
  - The **web** OAuth client id (`client_type: 3`) is the one Google Sign-In needs — *not* the Android one. It is
    **read from `google-services.json` at build time** (`app.config.js` → `extra.googleWebClientId`) rather than
    hardcoded, because hardcoding it into a tracked file would leak back into git exactly what gitignoring that
    file kept out. No file → empty id → the Google button simply doesn't render, and email/password still works.
  - The registered **SHA-1 must match the keystore that signs the build**, or Google sign-in fails with an opaque
    `DEVELOPER_ERROR`. Verified for the debug keystore. **A Play release build is signed with a different key —
    its SHA-1 must be added to the console before release, or login breaks in production only.**
- **Kakao — deferred, and here is the honest reason.** Firebase Auth **has no Kakao provider**. The only way a
  Kakao identity can become a Firebase `uid` is a **custom token**, which must be minted **server-side** with the
  Admin SDK and a **service-account private key that can never ship inside the app**. On Firebase that means
  **Cloud Functions → the Blaze plan → a billing card**, which **D10 (free tiers only, no card) forbids**.
  - A free-tier third-party worker (Cloudflare Workers / Vercel free) *could* mint the token, so this is not
    impossible — but it adds a deployable service, a private key to guard, and a **new single point of failure in
    front of login**, for a **single-user personal app that already has two working doors**.
  - **Decision: not now.** Revisit only if a real second user appears who wants Kakao. **Login is not the
    product; the lever is** (D30). No account is even required to use the app (D20).

### D51. AsyncStorage stays the store of record; Firestore is a MIRROR that switches on at login
- **The collision.** **D34** says "Firestore offline persistence = the sole local store." **D20/R4** say the
  app is **fully usable with no account**. These cannot both be literally true: with no account there is no
  `uid`, and with no `uid` there is **no document path to write to**. A "Firestore-only" build would have
  nowhere to put a block until the user logged in — i.e. the app would be *unusable* until it had an account,
  which is precisely what D20 forbids.
- **Decision.** **AsyncStorage remains the local store of record.** Firestore is a **mirror**: repository
  mutations push each row up (`syncPut`/`syncRemove`), and a realtime listener projects the cloud back down
  into the same AsyncStorage keys the screens already read. Logged out — and in any build without Firebase —
  the app is byte-for-byte the local-first app it was before F0.
- **Consequence (good).** **R11** ("works identically in airplane mode") holds *for free* rather than
  depending on Firestore's cache being warm. The **Repository interfaces do not change**, so no screen and no
  native code moved (architecture §7). D34's *stack* (RN + Expo + Kotlin + Firestore/Auth on Spark) stands
  unchanged — only its "sole local store" clause is superseded.
- **Consequence (the trap this avoids).** The cutover **pushes before it subscribes**. A listener writes the
  snapshot into local storage, so subscribing first would let a fresh account's **empty** cloud land on top of
  a phone full of real plans and **erase them**. Ordering is the whole safety argument.
- **Deletes are soft** (`deletedAt` tombstones, data-model §6) and hard deletes are **denied by the security
  rules**: a hard delete propagates as *nothing*, so the other device would never hear about it and would push
  the row straight back up.
- **Not synced, on purpose:** the measurement/catch-up stores (`lp.outcomes/fires/missed/latencies`,
  data-model §2.7). They are **this device's record of what the lever actually did** — evidence (S1–S5), not
  shared state. Merging two devices' fire logs would corrupt the self-experiment.
- **A remote change must move the alarm, not just the row.** A block created on the other phone re-arms its
  alarm here (the sync engine's apply hooks call `rearmBlockAlarms`), because alarm discipline lives in the
  repository layer (architecture §9-2) and sync enters through that same layer.

## 2026-07-11 — Cleanups the docs owed the code

### D49. The global 설정 → 소리 switch is a DEFAULT, not a gate
- **Problem found in the doc audit:** after D43 made sound **per-block**, the native moment reads only the
  block's own flag — so the global switch **did nothing at fire time**, while the settings screen still said
  "실행 순간에 알림음". A future agent would "fix" this by re-wiring the global switch into the firing path
  (breaking D43) or by deleting the switch (breaking D42's tone picker).
- **Decision:** the global switch is **the default for NEW blocks** (and the gate for the **알림음** picker).
  **What fires is always the block's own `alertSound`** — a global toggle may never silently override an alarm
  the user set per block. Copy says so: "소리 (새 블록 기본값)".

### D50. Rules the code must keep, that look like redundancies (recorded so they aren't "simplified" away)
- **The `<id>#recheck` alarm is cancelled only when the block is no longer `planned`.** `scheduleBlock` also
  runs on every app-open re-arm; cancelling it unconditionally would **silently delete the pending 5-min
  "진짜 했어?"** whenever the user opened the app within those five minutes.
- **`expo-notifications` is `require`d lazily and defensively.** A static import crashes the whole app when the
  native module isn't linked yet (before a `prebuild` + rebuild) instead of degrading to "no soft alerts".
- **The `recurrence` plumbing (JS type + native `EXTRA_RECURRENCE`) is vestigial but kept.** D37 retired
  recurrence; every block schedules with `"none"`. It stays only so old native mirror rows still parse. Do not
  build on it; do not resurrect it.
- **The outcome/fire/miss/latency records still use the field name `taskId`** — the value is a **TimeBlock id**
  (the migration preserved ids). Renaming it means migrating four stores for nothing.

## 2026-07-11 — Other apps' overlays

### D48. The moment renders as an OVERLAY window and re-claims the top — because an activity always loses
- **Problem (founder, on-device):** 캐시워크 (a lock-screen/ad app) draws **over** the execution moment, so
  the moment is up but the user sees an ad.
- **Why it isn't a small bug:** such apps use a `TYPE_APPLICATION_OVERLAY` window, and **an overlay is always
  above every ordinary activity**. While the moment is *only* an Activity, it **structurally loses** — no
  amount of flags fixes that. Android also offers **no "always topmost" grade** (if it did, ad apps would own
  it). Within the overlay layer the rule is simply: **the most recently added window is on top.**
- **Decision:** the moment **renders into its own overlay window** (the Activity stays underneath to do what
  only an Activity can: turn the screen on, show over the keyguard, own the lifecycle), and while it is
  **unanswered** it **re-asserts itself every ~2s** (detach + re-attach → back on top of whatever appeared
  over it). It needs the **"다른 앱 위에 표시"** grant we already require (D41); without it we fall back to a
  plain activity, and an overlay app can still cover us — which the readiness banner already warns about.
- **Bounded by design (B1/R14):** we out-*layer* other apps; we do not trap the user. The answers are always
  one tap away, and leaving still just leaves the outcome pending.
- **Tied to D46:** the overlay window is torn down when the activity stops — a window that outlived the
  moment would be exactly the "state that runs unseen" that D46 forbids.

## 2026-07-11 — The moment exists only on screen

### D46. Nothing about the execution moment advances while it is not visible (generalizes D44)
- **Problem (founder, on-device):** mid **5·4·3** the user pressed something, the countdown vanished and the
  app's **main screen** appeared. Same *class* of bug as the tone that rang on with no window: **the moment
  kept living after it stopped being visible** — its timers ran in the background and quietly *ended* it.
- **Decision — the moment is a thing that exists ON SCREEN, and nowhere else.** While it isn't in the
  foreground: **every timer freezes**, the tone stops, and no phase can advance. On return it **resumes at
  the same phase**. Losing the foreground can therefore never *finish* a moment — only an answer (or a
  timeout it was actually awake for) can. An unanswered moment always still exists, with its notification
  still there to return to. Supporting guards: the screen may not sleep under it (`FLAG_KEEP_SCREEN_ON`),
  `DONE` is idempotent (a resumed phase must not double-record), and **predictive back (Android 13+) is
  consumed too** — it *ignores* the `onBackPressed` override, which would have silently reopened the
  in-flow escape R7/A2 forbid.
- **Rule going forward:** any new state in the moment (timer, sound, animation) must be **tied to
  visibility**. If it can run unseen, it is a bug.

### D47. Prevent first, re-summon second — coming back is the app's job, not the user's
- **Founder's challenge:** "is this solution *keeping the screen on*, or *pausing and resuming*? If it's the
  latter, we need a way back — so preventing the screen from going away is the better solution."
- **Honest split of what is even possible:**
  · **Auto screen-off (timeout) — PREVENTED.** `FLAG_KEEP_SCREEN_ON` (+ `turnScreenOn`/`showWhenLocked`):
    while the moment is up, the screen does not time out. This is the layer that should do the work.
  · **The user pressing power / home / recents — CANNOT be blocked by any app.** Android reserves that, and
    an app that *could* trap you on a screen would be a worse product than this one is trying to be (B1: we
    never coerce; the only intentional skip is the pre-fire "오늘은 쉼").
- **Decision:** for the second case the moment **re-summons itself** rather than waiting to be tapped —
  the background activity start that the **"다른 앱 위에 표시"** grant (D41) already buys us. **Bounded**
  (3 attempts): it **insists, it never traps**. After that the notification remains as the way back and the
  outcome simply stays **pending** (no guilt, R14).
- **Net:** the moment's visibility is now defended by *prevention* where prevention is possible, and by
  *self-return* where it isn't — instead of relying on the user to tap a notification.

## 2026-07-11 — Alert model, round 3

### D45. A soft alert's moments are CHOSEN, not repeated on an interval (revises D43-3)
- **Problem with D43's fixed 5-minute repeat (founder):** nobody wants "every 5 minutes". They want
  **their own moments** — *"an hour before, 15 minutes before, and on the dot."* A repeat interval is the
  app deciding when to nag; a list of leads is the user deciding when to be told.
- **Decision:** `soft` blocks carry **`alertLeads: number[]`** — minutes before `start`, **one entry per
  notification, max 3**. Default = **one** notification (as today). The add screen offers **＋ 알림 추가** →
  pick **정각 / 5분 / 15분 / 30분 / 1시간 전 / 직접(분)**; each added moment shows as a removable chip.
  Duplicates collapse; the block's "next fire" is its **earliest** chosen moment.
- **`alertRepeat` (the interval) is dropped.** Old rows read forward to a single lead.
- **Unchanged:** max 3 keeps a soft alert from turning into spam (C1) — it informs, it never forces.

## 2026-07-11 — Alert model, round 2 (from the second device pass)

### D43. Two tiers, not three · 실행 is the DEFAULT · repeat · sound is per-block (revises D40)
- **Decisions (founder, 2026-07-11, on-device):**
  1. **`none` is removed.** A block you would never be told about isn't worth adding. `alert` = **`soft` |
     `execution`** only. (Old `none` rows read forward as `soft`.)
  2. **`execution` is the DEFAULT for a new block.** The lever is the product (D30) — you should have to
     *opt out* of being made to do the thing, not opt in.
  3. **A soft alert may REPEAT** (`alertRepeat`, 5-min spacing, ≤5). A single missable buzz is how a soft
     alert quietly becomes useless.
  4. **Sound is per-block and independent of the tier** (`alertSound`, default off = **vibration only**):
     the **execution moment can be silent**, and a **soft alert can ring**. Two separate questions — *how
     hard does it push* (tier) and *how loud is it* (sound) — were wrongly fused into one.
- **Kept from D40:** exactly **one** alert per block; only `execution` may pierce the lock screen (R15) —
  the soft tier rides a quiet channel (silent or audible, both DEFAULT importance, lock-screen PRIVATE).

### D44. The alarm tone may never outlive the screen it belongs to (safety)
- **Problem (founder, on-device):** the moment fired on the lock screen, the screen was cycled off→on, and
  then **the tone kept playing with no window and no notification** — nothing to tap, no way to stop it. A
  no-guilt app that traps the user in an unstoppable alarm is a contradiction, and it is also just *scary*.
- **Decision:** the tone belongs to the **moment on screen**, so it lives and dies with it: it stops the
  instant the activity loses the foreground (`onPause`), resumes if the moment comes back, and is
  **hard-capped** regardless. **No path may leave audio running without a visible way to stop it.**
- **Also:** a finished moment must leave **no tappable ghost** — its notification is cancelled on
  resolution and answered occurrences are never replayed; but an **unanswered** moment keeps its
  notification, because that is the user's way *back* to it.

## 2026-07-11 — Skin lock · alert tiers · the moment must actually appear

### D39. Design skin LOCKED: v5 "Toss-form" (supersedes D36's forest/gold baseline)
- **Decision (founder, 2026-07-11)**: the **v5 skin is confirmed** — `brand #3182F6` blue · white ground +
  grey groups (`#F2F4F6`) · **gold `#B0862A`** as the single DONE signal · execution ground `#FBFAF6` ·
  Pretendard (UI) + GowunBatang (execution voice). This **supersedes D36's forest/gold color baseline**
  (D36's *base library* choice — shadcn-style own-your-components on NativeWind — still stands).
- **Invariants unchanged by the reskin**: `miss #8B7E74` taupe — **never red**; gold = the **one** DONE mark
  (never buttons); the execution moment is **LIGHT**; no confetti; no in-flow escape.
- **Consequence**: `design-system.md` §1 stops being "provisional", and the **native execution moment**
  (`ExecutionActivity.kt`) — the last screen still on the old palette — is repainted to the v5 tokens.
  *(The native screen was old not because a doc said so, but because the reskin had only touched the JS
  screens; the doc was merely recording that state.)*

### D40. A block's alert has THREE tiers: 없음 / 단순 알림 / 실행 알림 (supersedes D38)
- **Decision (founder, 2026-07-11)**: a TimeBlock still carries **exactly one** alert, but now chooses from
  **three**: **`none`** (silent — the plan is just a plan) · **`soft`** (a plain **notification + vibration**
  at `start − lead`; it *tells* you and **forces nothing** — no full-screen, no lock-screen takeover) ·
  **`execution`** (the core lever: exact alarm + the full-screen moment, R7).
- **Supersedes D38** ("a block's only notification is the execution cue"), which had been read straight from
  spec §3.9. **spec §3.9 is amended**: "exactly one notification type" now means *one of three tiers*, not
  *only the cue*.
- **Rationale**: most blocks (강의, 점심, 알바) don't need forcing — they need **telling**. Without a soft
  tier the user must either over-use the lock-screen cue (destroying "one loud thing", C1/D30 — the cue is
  loud precisely *because* it is rare) or get nothing at all. The soft tier is what **protects** the lever's
  scarcity. It rides the quiet channel (DEFAULT importance · no sound · lock-screen PRIVATE), so **R15's
  "only the cue pierces" still holds structurally**.

### D41. The execution moment must appear **even while the phone is in use** → "다른 앱 위에 표시"
- **Problem (founder, on-device 2026-07-11)**: at the fire time only a **heads-up notification** appeared;
  the moment opened **only after tapping it** — i.e. execution became opt-in at exactly the point the user is
  trying to avoid it. **This is not a code regression**: Android launches a full-screen intent immediately
  **only while the screen is off/locked**; on an unlocked, in-use phone it degrades to a banner, and a
  BroadcastReceiver's direct `startActivity` is blocked by the background-activity-start restriction (A10+).
- **Decision**: request **`SYSTEM_ALERT_WINDOW` ("다른 앱 위에 표시")**, which lifts that restriction so the
  moment appears at its time **in every state**. It joins exact-alarm / FSI / notifications as a **first-class
  grant** in onboarding, the 실행 준비 상태 card, and the home denial banner (R16 — never fail silently).
- **Trade-off accepted**: it is a heavier permission, but the lever is the product (D30); a cue you must tap
  to obey is not a cue. Denial degrades gracefully (the banner explains exactly what is lost).

### D42. The execution sound is choosable, and silence means vibration-only
- **Decision**: 설정 → **소리** (off by default = **vibration only**) and, when on, **알림음** — pick from the
  device's alarm/notification tones (with preview), or follow the device default. Read **natively at fire
  time** (`SoundSetting`), since JS may be dead. Consistent with C1 (quiet by default) and R13.

## 2026-07-11 — Full-app build decisions (F2: time-blocks)

### D37. No recurrence on a TimeBlock; instead, add the same block to SEVERAL DATES at once
- **Decision (founder, 2026-07-11)**: The full-app `TimeBlock` stays **strictly per-date, with no recurrence
  field** — the model in `data-model.md` §2.3 / `spec.md` §3.2 is kept as written. To cover the practical need
  the prototype's `recurrence` served ("매일 21시 헬스"), the **add-block screen lets the user tick several dates
  at once**; each ticked date produces **its own independent block**. The UI says so plainly
  (**"반복이 아니라 각각 따로예요"**).
- **This supersedes D35's prototype-only `Recurrence`** (`none|daily|weekly`), which D35 itself flagged as a
  prototype addition ("net-new; no prior decision covered repetition — D14/D22 were single-instance").
- **Rationale**: A recurring rule and a *plan of record* fight each other — a repeat has no `date`, so it has no
  D-1 snapshot (D23), no per-day `status` (D5), and nothing for the day view (D21) to own. Independent per-date
  blocks keep evaluation honest and each day editable, while bulk-add keeps the entry cost near zero.
- **Consequence**: the prototype's `Task` is retired; existing tasks migrate to blocks (data-model §8.4). Since a
  repeat's future dates were never materialized, a migrated recurring task lands as **one block on today** — the
  founder re-places it with the multi-date picker.

### ~~D38. A TimeBlock carries exactly ONE notification: the execution cue~~ — **SUPERSEDED by D40 (2026-07-11)**
- ~~**Decision**: a block's only notification is the **execution cue**; the prototype's per-task soft
  multi-offset "단순 알림" (D35) is dropped for blocks.~~
- **Superseded**: D40 keeps "exactly one alert per block" but makes it a choice of **three** (없음 / 단순 알림 /
  실행 알림). D38's *rationale* survives inside D40 — the cue stays unmistakable — but the conclusion was wrong:
  banning the soft tier didn't protect the cue, it **pushed users to over-apply the cue** (or get nothing).
- What D38 got right and D40 keeps: the prototype's **multi-offset** per-task reminder stack is still gone (one
  alert, one lead), and only the execution cue may pierce the lock screen (R15).

## 2026-07-09 — Trigger-prototype scope & v0.3 product decisions

### D36. Base design system: shadcn-for-RN (react-native-reusables / gluestack-ui v2 on NativeWind), skinned with our tokens
- **Decision**: The base UI system is the **shadcn-style, own-your-components approach for React Native** —
  **react-native-reusables** (or **gluestack-ui v2**), both built on **NativeWind (Tailwind)** — **skinned with the
  LifePlanner design tokens** (`docs/core/design-system.md`). Standard screens use these validated,
  accessible, copy-paste components restyled to the calm forest/gold palette; the **execution moment is
  hand-built** on the tokens. Considered and set aside: **Material 3 (React Native Paper)** — most validated /
  Android-native / best states-and-a11y out-of-box, but imposes Material's look, which fights the bespoke calm
  aesthetic (design-principles B1/B2/C1); **Apple HIG** (iOS language, not an RN component lib; Android-first);
  **Ant Design** (web-centric, weak native-RN fit).
- **Rationale (user, 2026-07-09)**: prefers the shadcn approach — **full aesthetic control + validated
  accessibility primitives**, over inheriting a branded look. Fits the stack (RN + Expo + NativeWind, free D10) and
  the AI-assisted solo workflow (Tailwind = large training data, D11). A "validated system" and "our tokens" are
  **complementary**: we skin a validated base, not hand-roll everything.
- **Note**: pairs with `docs/core/design-system.md` (tokens) and `docs/research/prototype/user-flows.md`. Owning the
  copy-paste components means we **verify their default/pressed/disabled/error states** against design-system §4.2.
- **Note (2026-07-10, provisional — NOT a new decision)**: the *visual skin* is being iterated in code
  (a "Toss-form" experiment: blue interactive · white ground · serif execution voice — see
  `docs/core/design-system.md §1` "⚠ 진행 중" and `docs/research/prototype/build-log.md`). **The palette/type are
  not yet locked** — this D36 forest/gold decision stands as the confirmed baseline until a future round
  confirms a rebrand, at which point a new D-entry supersedes it. Do not read the current code skin as
  confirmed truth.

### D35. Build the trigger prototype first; its v0.3 product choices (scope-locked)
- **Decision (scope)**: Build **only the execution lever** first (the trigger prototype — exact-time alarm +
  lock-screen execution moment + no-guilt local logging) and **defer the entire integrated day** (calendar,
  budget, calorie, multi-device sync, plan-vs-actual evaluation) to a **post-prototype phase**. This
  **operationalizes D30** (execution engine = the heart; calendar/budget/calorie = supporting context) and
  **narrows D31/D32's S2 solution to its riskiest lever**; it re-scopes D4's "calendar = the heart" ordering **for
  the prototype only** (the calendar is excluded from the prototype, not from the product). Canonical: `docs/research/prototype/prd.md`.
- **Decision (v0.3 product choices)** — logged so they aren't silently pivotable:
  - **Plain reminders** = a *soft, multi-offset* notification tier per task (offsets {정각/15/30/60분/custom},
    multi-select), **distinct** from the execution cue — an explicit **refinement of D13**: D13's "select few,
    minimize spam" now means the *heavy* lock-screen cue stays rare, while opt-in soft reminders are allowed and
    unobtrusive (consistent with D30's "don't minimize the cue itself").
  - **Recurrence** = none / daily / weekly, producing **one occurrence per date**, each with its own outcome
    (net-new; no prior decision covered repetition — D14/D22 were single-instance).
  - **The "오늘은 못 해" (miss) opt-out is placed AFTER the 5·4·3·2·1 countdown** (the counter-deliberation lever
    must run before any escape) — core to D30/D31/D32.
  - **Sound** supported, **default haptic-only** (user-toggleable).
  - **Outcome `source`** (execution-screen vs catch-up) recorded; **S2 counts execution-screen `done` only**.
  - **Lead-time default = 0** for the prototype (fire at set time) with presets — **revises D28** (see its note).
- **Precedence**: where the PRD (v0.3) and a decision diverge, the PRD wins for *what the product does*, and the
  divergence is annotated in this log (as done for D28).
- **Rationale**: validate the biggest uncertainty (the lever) in minimal form before building the rest; keep the
  prototype's added surface (recurrence / reminders / sound) minimal and lever-serving.

## 2026-07-06 — Initial planning decisions

### D1. Platform: mobile-first, Android priority
- **Decision**: Build as a mobile app. Android has higher priority than iOS; primary checking and testing on Android.
- **Rationale**: The user primarily uses and tests on Android; notifications and always-with-you nature fit mobile.

### D2. Storage & sync: local-first + manual JSON + Firebase cloud sync
- **Decision**: Local-first storage. Support manual JSON export/import. Cloud sync is central to the core
  calendar feature (all data auto-syncs across the user's devices once logged in). **Firebase** is the backend
  (confirmed in D17), with **last-write-wins**. JSON import uses **merge vs overwrite** (see D24).
- **Rationale**: Firebase offers offline caching, a mature mobile SDK, realtime sync, no pause on inactivity,
  and a generous free tier — a strong fit for local-first + multi-device sync at zero cost. (Backend and
  conflict handling now concretized in D17/D24.)

### D3. Scope: single user first, staged expansion
- **Decision**: Single user for now. Expansion path: "one user, many devices" → "many individuals each using it."
- **Rationale**: Keeps auth/permissions simple and MVP light; sharing is deferred.

### D4. Feature priority: three tiers
- **Decision**:
  - **Core** — calendar of important events (advance entry, cloud auto-sync, advance notifications).
  - **Secondary** — D-1 day-level time-block planning linked to calendar dates + in-the-moment budget and
    calorie/workout tracking.
  - **Later** — plan-vs-actual evaluation of the time-block schedule.
- **Rationale**: The calendar of important events is the heart of the product; tracking and evaluation build on it.

### D5. Evaluation: success/fail + failure reason on D-1 time blocks
- **Decision**: Evaluation checks whether each **D-1 time-block** was carried out on the day
  (**success/fail**), and on failure the user records a **reason**. Later the app exports success/fail rates
  and collects the failure reasons in one place for the user to review; the app does **not** auto-suggest
  adjustments — the user adjusts their own future plans. Important events are **not** evaluated — a canceled
  important event is deleted.
- **Rationale**: The behavioral goal is "did I do what I planned for the day"; reasons + rates give the user
  the raw material to self-correct without the app being prescriptive.

### D6. Integration principle & entry timing
- **Decision**: Unify calendar / budget / calorie into one app. Time-block plans are pre-entered by D-1;
  spending and calorie/meal entries are recorded **in the moment** (at purchase / at eating), not pre-entered.
- **Rationale**: Matches how the data actually arises — plans are foreseeable, spending/eating are events.

### D7. Existing budget/calorie apps: references (`reference/calculator.js`, `reference/kcal.js`)
- **Decision**: Two complete, working apps exist — budget (`reference/calculator.js`) and calorie
  (`reference/kcal.js`) — both built with **React Native + Expo**. They are used as **references** for how
  the secondary features work. How much can be leveraged depends on the tech-stack choice
  (see D11): each is a **standalone app**, so literal drop-in reuse isn't possible — with React Native we
  **reference & port (참고·이식)** much of the logic; with Flutter we'd reimplement in Dart using these as a guide.
- **Rationale**: The apps already implement local-first storage, JSON export/import (merge vs overwrite),
  categories, and daily/monthly totals — valuable regardless of stack. But the stack is chosen on best fit
  for the goal (D11), not on reuse convenience.

### D8. Conflict detection: intentionally not a feature
- **Decision**: No dedicated schedule-conflict detection.
- **Rationale**: Because all important events sit on the calendar, the user sees existing events when adding
  a new one, so double-booking is naturally avoided without extra logic.

### D9. Working language convention
- **Decision**: All repository artifacts (docs, future code, comments) are written in English; final replies
  to the user are translated into Korean.
- **Rationale**: Keeps artifacts conventional/portable while keeping communication in the user's language.

### D10. Zero paid services (cost constraint)
- **Decision**: The project uses **free services only** — no paid cloud, no paid subscriptions, no billed
  services. The cloud sync backend must be a free tier (e.g. Firebase free tier); tools and libraries should
  be free/open-source. (This is a project-cost constraint, and is unrelated to the household-budget feature,
  which stays.)
- **Rationale**: The user does not want to spend money running the project.

### D11. Tech stack: React Native + Expo (CONFIRMED 2026-07-06)
- **Decision**: Build LifePlanner with **React Native + Expo** (TypeScript). Flutter and Kotlin/Jetpack
  Compose were evaluated and rejected for this project.
- **Rationale** (after researching all three across performance, polish, notifications, DX, and AI-assisted
  coding):
  - **Least code to write**: the two reference apps are already RN/Expo (integrate, not rebuild), plus the
    npm ecosystem is the largest, so most features have ready libraries.
  - **Strongest AI-assisted coding**: TS/JS has the most LLM training data, so a PM-led, Claude Code–driven
    build gets the most accurate assistance — matches the intended development mode.
  - **Fastest solo iteration**: Expo removes native config/Gradle friction (Fast Refresh, EAS free tier). **Note: "Expo Go" is superseded by D34 — the build uses an Expo Dev Build** (native modules).
  - **Sufficient for this app's needs**: polish is proven (Bluesky/Instagram/Discord are RN); reliable
    the execution cue's exact-alarm + full-screen intent is achievable (native module, D34) and advance-event
    alerts use non-exact expo-notifications;
    the app is not compute-heavy, so native's perf edge isn't needed.
  - **Cross-platform** keeps iOS open at no cost, even though Android-only is acceptable now.
  - Rejected: **Flutter** — would discard the reference apps and has the weakest AI corpus of the three.
    **Kotlin/Compose** — cleanest language + best native Android integration, but requires rebuilding the
    reference apps, slower builds, and a steeper learning curve for a non-JVM, PM-led workflow.
- **Concrete guidance for the build**: Expo SDK with the New Architecture (Fabric) enabled; Reanimated for
  60fps animations; Notifee (or expo-notifications) for scheduled/exact notifications; Firebase for sync
  (D2); consider Skia or react-native-calendars for the calendar UI.

### D12. Auth: ID + password first, Google login later
- **Decision**: ID + password as the primary sign-in so the same user can log in across devices. Google
  social login is a later addition — candidate approach: generate a virtual ID/password bound to the Google
  account and sign in through that.
- **Rationale**: Simple to build first; social login can layer on without changing the core model.

### D13. Notifications kept minimal
- **Decision**: Notifications fire for **important events** and only a **select few** time blocks that
  clearly warrant one. Deliberately minimize notification **spam** to avoid annoyance. **(→ D30 revisits this: the
  exact-time execution cue on flagged blocks is the core lever and is exempt from minimization.)**
- **Rationale**: Advance alerts for important events are a core value; over-notifying erodes trust and gets
  muted.

### D14. Time-block schedule is free-form intervals
- **Decision**: Time blocks are **free-form start–end intervals** (not fixed hourly slots), each with a
  title and optional location. Example day: `10:00–13:00 lecture`, `13:00–14:00 lunch (visit Seocho post
  office)`, `14:00–19:00 lab`, `20:30–22:00 gym`.
- **Rationale**: Real days don't fit uniform slots; free intervals match how the user actually plans.

### D15. Unify workout/run tracking with time-block planning + evaluation
- **Decision**: The calorie app's **운동 / 러닝** activity records (docs/research/reference-apps.md §B) are **unified** with
  LifePlanner's time-block workout planning and its success/fail evaluation — one concept, not two separate
  "did I work out" trackers.
- **Rationale**: A workout is planned as a D-1 time block, executed, then evaluated; a duplicate activity log
  would fragment the same fact.

### D16. Keep reference apps' fixed categories and kcal targets as-is
- **Decision**: Adopt the existing apps' fixed values verbatim: budget's **8 categories** (주식/간식/문화생활/
  잡화소모/이동통신/대중교통비/뷰티/기타) and calorie's **4 meal categories** with per-meal kcal targets
  (아침 400 / 점심 500 / 저녁 400 / 간식 200; daily 1500). No user-configurable categories/targets for now.
- **Rationale**: The user is satisfied with the current sets; keeping them fixed simplifies the first build
  and preserves parity with the reference apps.

### D17. Backend concretized: Firebase (Firestore + Auth), Spark free plan
- **Decision**: Use **Cloud Firestore** as the sync data store and **Firebase Authentication** (email/password
  first, Google later) for accounts, on the **Spark (free) plan** — no billing card.
- **Rationale**: Firestore is the recommended store for new, multi-entity apps and provides built-in offline
  caching + realtime listeners, which directly delivers the core "auto-sync across all the user's devices"
  feature (write on one device → propagates to all logged-in devices; last-write-wins). Free-tier limits
  (1 GB storage; 50k reads / 20k writes / 20k deletes per day; 50k MAU auth; unlimited FCM) vastly exceed a
  personal app's needs. Realtime Database was considered but is better for simple single-tree/twitch-speed
  sync, not our multi-entity model.
- **Note**: Firestore is chosen over Realtime Database; revisit only if a specific need arises.

### D18. Advance notifications are on-device (local), not paid push
- **Decision**: Advance alerts are **local scheduled notifications** on each device (expo-notifications /
  Notifee), not server push. When an important event syncs to another device via Firestore, that device
  **schedules its own local notification**.
- **Rationale**: Delivers "all devices alert before the event" with **zero paid infrastructure** — no Cloud
  Messaging server needed. Exact-time/Doze handling is an OS-level concern handled the same way natively or in
  RN (docs/core/decisions.md context from stack research).

### D19. Drop meal photos (free-plan only)
- **Decision**: **Remove the meal-photo feature entirely.** The calorie app's photo attach / photo viewer
  (docs/research/reference-apps.md §B) is not carried into LifePlanner.
- **Rationale**: Firebase Cloud Storage (needed to sync images across devices) requires the paid Blaze plan as
  of 2026-02-03, which violates the free-only constraint (D10). Dropping photos keeps the entire app on the
  free Spark plan. Meals are still recorded with name, kcal, details, and category.

### D20. Account model: local-first, login enables sync
- **Decision**: The app is **usable immediately without an account** (local storage). **Logging in enables
  cloud sync** from that point across the user's devices.
- **Rationale**: Best fit for the local-first principle; no forced onboarding friction, sync is opt-in.

### D21. Calendar views: month + tap-date day view
- **Decision**: **Monthly view** as the main calendar (important events marked); **tapping a date opens that
  day's time-block (day) view**. No separate week view for now.
- **Rationale**: Matches the user's described flow (see the month, drill into a day's hourly plan) with the
  least UI complexity.

### D22. Workout unification: success on a workout time-block = workout done
- **Decision**: A workout/run is planned as a **time block** with `kind = workout | run`. Marking that block
  **success** records the workout as done. The calorie app's separate **운동/러닝 O/X activity records are
  dropped** (no standalone `ActivityEntry`); the "today workout/run done" summary is **derived** from
  time-blocks of that kind marked success. An unplanned workout is handled by adding a block on the day
  (same-day editing is allowed, D23) and marking it success.
- **Rationale**: One source of truth for "did I work out," consistent with D15; avoids duplicate trackers.

### D23. Plan editable on the day; evaluation vs the D-1 snapshot
- **Decision**: Time-block plans **can be edited on the day**, but **evaluation compares actual completion
  against the plan as it stood at D-1** (the day before). Implementation: snapshot the day's plan at the D-1
  boundary (the "plan of record"); later same-day edits don't change that snapshot.
- **Rationale**: Keeps flexibility while making evaluation honest about "did I do what I planned yesterday."

### D24. JSON import conflict: merge vs overwrite (reference-app style)
- **Decision**: On JSON import, offer **merge** (append items whose id isn't already present) or **overwrite**
  (replace), exactly as the reference apps do (docs/research/reference-apps.md §A6/§B5). This replaces the earlier
  "server vs local" wording. Firestore remains the live sync store; JSON import/export is a manual backup path
  that applies to the local/synced dataset.
- **Rationale**: Reuses a proven, already-built interaction; simplest mental model.

### D25. Single currency (KRW / 원)
- **Decision**: Budget uses a **single currency, KRW (원)**, as in the reference app. No multi-currency.
- **Rationale**: Personal, domestic use; simplest.

### D26. Card/payment: free-text entry
- **Decision**: Card/payment method stays **free-text** per entry (as in the reference app); no managed card list.
- **Rationale**: Simple and flexible; matches existing behavior.

### D27. Calorie: manual entry only
- **Decision**: Calories are **entered manually**; no calorie-lookup database for now.
- **Rationale**: Free-only + simplicity; a (free-tier) lookup can be revisited later.

### D28. Notification lead-time: per-event, with a default
- **Decision**: Lead-time is **configurable per important event** *and per flagged time block* (the execution
  cue fires at `start − lead`; e.g. "N minutes before"); if unset, a **default lead-time** applies (default
  value to be set in design, e.g. 30 min).
- **Rationale**: Flexible per event without forcing input every time.
- **(→ D30 / prototype (prd.md v0.3) / D35 revisits.)** For the **trigger-prototype execution cue**, the unset
  default = **fire AT the set time (lead 0)**, offered with presets {정각 / 15 / 30 / 60분 / custom}; the ~30 min
  nonzero default is **full-app-only**. (D30 reframed the lever as an *exact-time cue* = lead 0; D28 predates it and
  simply wasn't revisited.) The **plain-reminder tier** (multi-offset soft notifications) is added in D35.

### D34. Confirmed full tech stack & infrastructure ("balanced option ①") — 2026-07-08
- **Decision**: The complete build stack/infra is confirmed: **React Native + Expo with a *Dev Build*** (Custom
  Dev Client; **Expo Go ruled out**) + TypeScript; a **thin custom Kotlin native module** for the core alarm
  (AlarmScheduler + full-screen ExecutionActivity + boot/timezone receivers); **Firebase (Cloud Firestore +
  Auth, Spark free)** on a **thick-client + BaaS topology (no custom server, local-first)**. Extends D11 (named
  only "RN + Expo") and D17 (Firebase). Design authority: `docs/core/architecture.md` + `docs/core/data-model.md`.
- **Rationale**: chosen over Native-Android (Kotlin) and Flutter — RN+Expo fits the user's JS/TS + AI-assisted
  solo workflow, keeps iOS open (cross-platform), and reuses the RN/Expo reference apps; the **alarm-reliability
  ceiling is OS-bound, not framework-bound**, so RN + a native module loses nothing vs pure Kotlin while keeping
  those wins. Firebase is the only backend with true mobile **offline persistence**, free + **no-pause** (vs
  Supabase's 7-day free-tier pause).
- **Build-gating design decisions** (logged so they aren't silently pivotable): per-user Firestore collections +
  security rules; **conflict resolution by Firestore `serverTimestamp()`** (not client clock); soft-delete
  tombstones; **Firestore offline persistence = the sole full-app local store** (no separate SQLite source-of-
  truth); sideload → Play ($25) deployment. Details in architecture.md / data-model.md.
- **Consequence**: D11's "Expo Go" rationale is superseded (Dev Build is the real path); the prototype builds on
  this exact stack, so there is **no mid-course pivot**.

### D33. Primary persona = P1 (design target locked) — 2026-07-07
- **Decision**: Of the three personas (`docs/research/personas/overview.md`), **P1 (혼자선 실행이 안 되는 계획형
  학생 = 본인) is the single *primary* persona** — the design target the interface is optimized for. **P2 and P3
  remain *secondary*** (kept, not deleted): the same execution lever serves them at their own break-point on the
  shared intention→action chain.
- **Rationale (user)**: "Primary는 P1으로 두는 게 적절 — **P1도 큰 틀에서 보면 P3과 동일한 특성**을 보이기 때문."
  P1 and P3 share the same underlying failure (goal-set → can't execute / sustain), so optimizing for P1 also
  covers P3; and P1 is the **founder-persona** (richest first-hand interview data, fastest to validate) with the
  strongest efficacy fit (implementation intentions help the *motivated-but-can't-execute* most). Method basis:
  **Cooper** (design for one primary; secondaries are satisfied — `docs/research/personas/overview.md`),
  instructions.md §퍼소나 (persona = a *tool* to find the core problem, not the target itself), **JTBD** (a job
  shared across personas is top-priority).
- **Consequence**: keeps all 3 personas + a narrow target → **no profile deletion, no mass re-correction** (the
  S2 core loop already serves the shared hole). If LifePlanner later becomes a **product for others** (Q10), P3's
  larger segment may drive *messaging*, but the **design target stays P1** because P1 ≈ P3 at the core.

### D32. UX form = S2 (execution-card-first); SEPARATE plan/execution from in-the-moment logs — 2026-07-07
- **Decision**: The chosen UX shape of D3 is **S2 (execution-card-first)** (`docs/research/solutions.md`): the **home = today's
  execution cards** (flagged blocks), and the alarm expands a card into the **execution mission** (5·4·3·2·1 +
  haptic). **Planned schedule/execution and in-the-moment logs are SEPARATE surfaces — NOT one merged timeline**
  (this explicitly rejects S1).
- **Rationale (user's insight)**: planned items (일정) are pre-set and simply executed → viewed directly; spending
  and meals are **not pre-planned** — they're added **as they happen**. Mixing planned + logged on one timeline is
  awkward (different temporal natures). So calendar/plan/execution is one surface; expense/meal logging is a
  separate fast surface. **"Integration" = one app + day-level linkage** (a day aggregates its blocks, spend, meals),
  **not** a single visual timeline.
- **Consequence**: build-plan screens updated — home = execution cards; calendar tab (plan only); **separate
  quick-log** for expense/meal; a day summary *links* (not merges) the two.
- **CONFIRMED** via comparison scoring (`docs/research/solutions.md`), 2026-07-07: **S2 = 13 > S1 = 10 > S3 = 6** (사용자 가치 +
  검증 용이성 + (6−구현 복잡도)). User selected S2. Implementation plan finalized in `docs/research/features/execution-integrated-day.md`.

### D31. First solution: D3 "Execution-engineered integrated day" (hybrid) — 2026-07-07
- **Decision**: After an HMW sprint (`docs/research/hmw.md`), the user voted **C1 (execution moment) + C5 (integrated
  fast-logging day)** and chose solution draft **D3 (hybrid)**: an **integrated My Day timeline + one-tap logging
  + free-slot placement (C5)**, plus a **moment-of-execution intervention on user-flagged blocks (C1)** — commit
  framing + micro-start + optional 출발/도착, gentle. Build plan: `docs/research/features/execution-integrated-day.md`.
- **Rationale**: matches the North Star (D30) and the user's daily-use priority; references (Alarmy/Fogg for the
  execution moment; Structured/one-tap widgets for the integrated fast day) validate the approach; scoping the
  core narrow makes it fastest to validate (lean).

### D30. Product North Star: an EXECUTION ENGINE (the core differentiator) — 2026-07-07
- **Decision**: LifePlanner's differentiator is **not** its feature list (calendar/budget/calorie/reminders all
  already exist). It is being **designed end-to-end to make the user actually DO the future / self-improvement
  tasks — especially exercise — that they would skip even if written in existing apps.** Calendar, budget, and
  calorie are **supporting context** for this execution goal, not the point. (User: "기존 앱들에 아무리 적어도
  하지 않을 미래 설계·운동 같은 미래에 할 일을, 이 앱을 씀으로써 실행할 수 있게 한다면 그게 최고의 기능이다.")
- **The engine = a stack of evidence-based levers around each skip-prone task, not a bare reminder**: exact-time
  cue + alarm (implementation intentions, d≈0.65); **realistic-slot placement** via the integrated day view (find
  the real free slot — cf. the user's empty-lunch gym discovery — so they don't skip on overloaded days);
  **micro-start** (Atomic-Habits "just put your shoes on"; cf. inst2.md's task-splitting app); **no-guilt /
  return-after-miss** (defuse the what-the-hell effect); optional **temptation bundling**; and the
  **plan-vs-actual evaluation loop** that makes future plans realistic → higher execution over time.
- **Consequence**: **revisit D13** — the execution alarm is the product's heart, not something to "minimize"
  (minimize *spam*, not the execution cue).
- **Rationale**: resolves the differentiation doubt (open-questions Q9). The value is real and proven by the
  user's own life (gym-lunch story); the edge is doing the one thing existing apps don't — **engineering
  execution** — rather than being a prettier integration. The user would use it daily if the integration beats
  the scattered apps.

### D29. Evaluation depth: binary + reason only (quantitative deferred)
- **Decision**: Evaluation stays **success/fail + free-text failure reason** (D5). Quantitative comparison
  (planned 60m vs actual 90m) is **not** built now; deferred as a possible later enhancement.
- **Rationale**: Keeps the first build simple; matches the user's stated need.
