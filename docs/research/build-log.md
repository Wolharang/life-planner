# Build log — Full app ("integrated day")

Chronological journal of the **full-app** build in `app/` (the phase after the completed trigger prototype).
Complements — does not replace — `docs/research/implementation-plan.md` (the F0–F5 plan) and
`docs/core/prd.md` (What/Why). The prototype's own history is `docs/research/prototype/build-log.md`.
Newest entries at the top. Working language English; UI copy stays Korean.

---

## 2026-07-14 (later) — a security review, and the account you could lose forever

The founder ran the app through a standard service-security checklist — twice. The first pass (unauthenticated
page access · per-user DB isolation · admin-page exposure) was a category mismatch: **we have no server, no URLs,
no admin path.** Translated to where those threats actually live — the Firestore rules — all three were already
shut: logged-out reads denied, every document gated on `request.auth.uid == uid`, and no privileged branch exists
to climb (single-user app, D3). The one deliberately public read is the account tombstone (`allow get: if true`),
and it holds nothing that identifies a person and cannot be enumerated (`list` denied).

The second pass found the real hole, and it was an **absence**: the app offered email/password signup but **no
password reset**. Forget the password and the account is gone. The checklist's "리셋 메일 발송 제한" was moot —
there was no reset to rate-limit.

**The founder asked for 인증번호 (a typed numeric code) for both signup verification and reset. I said no before
building it** — not a preference, a constraint. Firebase Auth does email by **link**, not code; a real email OTP
needs a server to mint/store/verify the code and a store an *unauthenticated* client may write to (our rules
forbid it). Both break free-services-only. He agreed, and chose the shape that reaches the same two goals — prove
the email is real, recover a lost password — for free: **준회원/정회원 by link.**

- Email signup → **준회원**: uid issued, every feature works, `sendEmailVerification()` sent best-effort. The link
  makes them **정회원**, which is what unlocks reset. **Google → 정회원 from the first moment** (Google already
  verified the address); we never ask them to verify and never offer to reset a password that is Google's, not
  ours.
- Membership is **derived, not stored** (`accountFromUser`: `verified = emailVerified`, `google` = the provider).
  So it cannot drift, **and nothing new leaves the phone — the 처리방침 does not change.** Guarded by
  `firebase.account.test.ts` (four cases = the whole model).
- **The subtle part, stated honestly.** Password reset is a *logged-out* action, so we cannot check 정회원 status
  when it runs (not authenticated; email-enumeration protection hides it anyway). That is not a gap — it is *why
  the model holds*: the link goes only to that inbox, and completing the reset requires reading it, which is the
  same proof that makes someone 정회원. A 준회원 who resets has, by that act, proven the address is theirs.
- The 준회원 banner **blocks nothing** (D20/R14) — a benefit named in neutral taupe, auto-rechecking once per login
  for a link clicked in the browser. (D79)

**Follow-up the same day** — email change, graceful failure, and an abuse cap:
- **이메일 주소 변경** via `verifyBeforeUpdateEmail`: the link goes to the *new* inbox and the address swaps only
  once it is clicked, and Firebase alerts the *old* address. A typo cannot strand the account. Email accounts only.
- **When Firebase does not answer cleanly, guide instead of dead-ending** — `auth/too-many-requests` (its global
  quota, not the user's fault) and the unknown branch now carry calm, actionable Korean.
- **A device-local daily budget** (`rateLimit.ts`): the founder's fix for "누군가 남용하면 Firebase 한도를 초과해
  다른 사람이 인증을 못 받는다." AsyncStorage is per-install, so it *is* the device-based limit — no id to read.
  Reset **1/day**, email change **3/day**, resend **3/day**, per action per device; a no-network attempt is
  refunded so it never burns the day's only reset. Guarded by `rateLimit.test.ts`.

No native change, no prebuild. Typecheck clean; **13 suites / 116 tests** (was 11/107).

**Third security pass — file upload/storage.** The category barely applies: the app has **no remote file storage**
(D19 dropped photos to stay free), so "only the uploader can read" and "delete DB + file together" have no
surface. The founder's sharper question was whether a JSON-disguised payload could exfiltrate data — and the
answer is **structural**: grep confirms **no eval / Function / dynamic import** and **no fetch/XHR/WebSocket**
anywhere, so `JSON.parse` output is inert data with nothing to run it and nowhere to send it. The residual is
local data injection, and I hardened the one local file path (`backup.ts`): a **generous 100 MB size cap** checked
*before* the file is read (OOM safety, never blocks a real multi-year backup), and a **`lp.`-namespace guard** so
an imported file can only write the app's own keys — it used to accept any key. Both live in a leaf
`backupGuards.ts` and are pinned by `backupGuards.test.ts`. Typecheck clean; **14 suites / 119 tests**. (D80)

**Fourth security pass — API & keys (a review, not a change).** No server, no browser: the only external APIs are
Firebase and Google Sign-In, and grep found nothing else — no analytics, no crash reporter, no third key. The
embedded Firebase API key and OAuth client id are **public identifiers, not secrets** — access is gated by
Firestore rules + Auth (already reviewed), not by hiding the key — and there is **no service-account key / admin
path at all**. `google-services.json` is gitignored anyway. Failure handling is thorough and surfaced (writes never
awaited → offline-safe; reconcile reads `source:server` and skips on failure; a pending/failed counter; auth
errors → calm Korean). Spark limits (≈50k reads / 20k writes a day) sit orders of magnitude above one founder's
usage; **live numbers are the founder's to read in the console.** Version check against the npm registry:
`@react-native-firebase` **25.1.0** and `@react-native-google-signin` **16.1.2** are **exactly latest** — but
**`expo` is 52.0.49 vs 57.x latest, five SDK majors behind.** Flagged as tracked debt; **not** upgraded in a
security pass, because an Expo bump drags RN + every expo-* package + a native rebuild and on-device re-test. (D81)

**Fifth security pass — notifications (a review, no code change).** Grep found exactly three sources, each with its
own channel: the **execution alarm** (native, IMPORTANCE_HIGH, bypassDnd, full-screen — the one loud thing, and the
only one that pierces the lock screen), the **soft reminders** (DEFAULT, never a heads-up, ≤3 per block), and the
**아침 요약** (silent DEFAULT channel, exactly 1/day at 07:00). **The app sends no advertising at all**, so the
정보통신망법 야간(21–08) 광고 차단 has no surface — stated precisely because the 07:00 brief *is* inside that window
and is fine only because it is not an ad. Consent to notify = the OS `POST_NOTIFICATIONS` permission (onboarding;
graceful denial). Every send is bounded (execution 1 + re-check + ≤3 re-summons; reminders ≤3/block; brief 1/day)
and there is **no server push**, so no mass-send vector exists. Email SPF/DKIM ride on Firebase's own authenticated
domain (we run no custom sender domain). Two forward guardrails recorded: adding any promotional notification needs
a separate opt-in + a 21–08 block, and a custom email domain would make SPF/DKIM/DMARC ours. (D82)

**Sixth security pass — realtime (a review, no code change; the hardened core).** One realtime capability:
Firestore `onSnapshot` on the four synced collections, live only foreground + logged in. Necessary-vs-not is
already split: **realtime foreground** (multi-device immediacy, and on Firestore no dearer than polling) and
**periodic pull background** (`syncPullOnce`, D77 — exactly the "주기적 갱신 대체" asked for). Nothing time-critical
depends on it — the native alarm is independent. Reconnect is covered three deep (SDK offline persistence +
auto-replay; caught listener errors; a `source:server` reconcile on every login, with the reconciled-mark cleared
on disable). Concurrent edits are multi-*device* not multi-user (D3), but the handling is the most battle-tested
code in the repo: last-write-to-reach-server wins (server-side, not client clock), terminal tombstones (the fix for
resurrected blocks), `source:server` reconcile (the fix for the 134 orphaned meals). (D83)

---

## 2026-07-14 (day) — the app becomes a service: consent, leaving, and the sync gap that only a briefing could find

**v0.5.0.** No new "features" in the product sense. What got built is everything the app was **already
promising** and had no code behind.

### The documents were describing an app we never built
The founder's three drafts sat in `reference/` and were reachable from nowhere. Wiring them up exposed two
layers of wrongness. First, the drafts leaked their own scaffolding onto the screen (`(초안)`, `## 8.` on *two*
different clauses) and claimed collection we do not perform: 결제 기록, IMEI, Mac Address, 체중, 프로필 사진,
협력회사로부터의 제공. **A privacy policy that claims collection we do not perform is not caution — it is a false
statement about the user's data.** Second, correcting for that, I wrote *reassurance prose* into the instrument:
"서비스는 의료 목적의 도구가 아닙니다", "최소한만 모읍니다". The founder cut it: **"그건 약관이 아니라 전달하는
메시지이다."** He was right. The substance survived, as clauses — 「의료기기법」 in 이용약관 제14조, 자동 수집 장치를
설치·운영하지 아니합니다 in 처리방침 제10조 — and the messages moved to where messages belong: the consent row and
공지사항. (D71/D72)

He corrected me three more times on the same file, each time on the same instinct: **do not claim more than is
true.** The party is **기관**, not a person by name. Parentheses hold headings and single words, never clauses —
*a qualification hidden in brackets is one nobody reads.* The 국외 이전 country is **미국**, not "미국 등 Google이
데이터센터를 운영하는 국가" — I checked the Firestore region (`nam5`) rather than hedge. And I had invented, twice,
obligations nobody asked for (a "성인 대상 서비스" declaration; a duty to hunt down and delete an under-age
account). **Every obligation written on the 기관's behalf is a promise someone can later hold it to.**

### Leaving — and 134 rows that came back from the dead
탈퇴 and 파기 were already promised by 이용약관 제6조 and 처리방침 제7조. There was **no implementation**. Built it —
and then queried Firestore directly rather than trust the "탈퇴했어요" the app had just printed.

**134 meal documents sat under a uid with no Auth user**, written *during* the withdrawal test. The cause was not
the delete. It was **Firestore's outbox**: rows this phone had already handed to the SDK flushed *after* the wipe,
re-creating what we had just destroyed, and then the account vanished out from under them. **A write already
handed to Firestore cannot be recalled** — only the SDK's entire local state can be discarded. Hence
`purgeFirestoreCache()` and the restart after 탈퇴. ***"We deleted your data" must not be a race we sometimes
lose.*** (D75)

Then the founder asked the question that found the rest of it: *"다른 기기에서 탈퇴를 한다면?"* The other phone's ID
token stays valid for **up to an hour** after the user is deleted, and its reconcile's rule is *"a row the cloud has
never seen is pushed up"* — after the wipe, the cloud has seen nothing. **It would have restored the entire deleted
account.** No client fix reaches another phone, so the door is shut in the **security rules**: an account tombstone,
written first, awaited, and impossible for any client to remove. It carries the user's wipe choice to the phones
that were not in their hand when they made it. (D76)

And he corrected me once more, on the law: **the uid we keep is not 개인정보.** 결합 용이성 is the test, and by the
time the tombstone exists there is no mapping left — the Auth user is gone, no Firestore document ever held an
email, nothing is sent anywhere but Firebase. *Declaring it as retained data would have told the user we kept
something about them, which is exactly what we did not do.*

### The briefing that found the sync gap
아침 요약 — one silent notification a day. Trivial on its face. But a notification's text is fixed **when it is
scheduled**, and that turned a hidden assumption into a visible bug: **sync only ran while the app was open.** A
phone rebooted and never opened would brief you from a plan another phone had already changed. Two phones, two
different mornings, and nothing to say which was true.

My first answer was to make **one** phone the briefing device. The founder cut it, correctly: **the briefing is a
notification, and notifications go to every phone — only the execution moment is addressed to one, because only it
takes the screen.** *Silencing a phone to hide a sync gap is a cover-up, not a fix.* So: a background task
(`startOnBoot: true`) that pulls server state, re-arms alarms, and re-cuts the briefings — **best-effort, and said
so in the code.** Android decides when it runs. Nothing depends on it: the lever is a native exact alarm that
re-arms itself at boot and never needed the app to be open. (D77/D78)

### And the screens, which had been written for us
*"무슨 기능 버튼인지 이해할 수 없다."* 실행 준비 상태. 기본 리드 시간. 측정 (S1–S5). "what-the-hell 붕괴". "대용값".
JSON. Every one an internal name that had escaped onto a button. **A number nobody can read is not a measurement,
it is a decoration.** All rewritten.

The one word we changed and changed back: **미스**. I renamed it 실패 on request; the founder then agreed with the
objection and reverted it himself. *A miss is neutral data — taupe, never red.* The colour was already obeying
that. **The word was doing the judging the colour refuses to do.**

## 2026-07-14 (small hours) — the two-device test, and the model it broke

The release was cut, so the founder did the thing we had been unable to do all along: **he used two phones.**
Everything that follows was found by *use*, not by reading — and one of it rewrote the product's core model.

**Sync said it had delivered writes it never sent (D66).** He imported his budget history — **180 expenses** —
logged in on the second phone, and **not one was there**. Two faults, and the second is the one that matters.
Firestore's outbox had **jammed**: 400 writes queued at import, the meals drained, and the 180 expenses sat
**undelivered, unrejected and unretried**. (Clearing the queue and re-pushing landed all 180 in seven seconds,
zero failures — nothing was ever wrong with the data.) But **the app declared them synced**: a Firestore
snapshot **layers your own un-sent writes on top of the server's state**, so `reconcile` read *"the cloud has
all 180 of these"*, pushed nothing, and never tried again. It was confidently, permanently wrong, and told
nobody. He found out by opening the Firebase console. The reconcile now reads with **`source: "server"`**, and
because a write is fire-and-forget by necessity, the app **keeps books** and shows what it still owes.
***"We don't wait" must never become "we don't know."***

**A block you deleted while LOGGED OUT came back on login (D64).** `syncRemove` is a no-op with no account —
correct, and therefore fatal: the deletion left **no trace anywhere**, and the cloud handed the rows straight
back. Deletes now always write a **local tombstone**. *Third time in one day: an invariant that must survive
being offline or logged out cannot live in the code path that only runs when you are online and logged in.*

**Rescheduling a missed block left it dead (D63).** He missed a block, **moved it later to actually do it**,
committed at the moment — and the app showed **미스** and **"진짜 했어?" never came**. The block kept
`status: fail`, so the catch-up net saw the occurrence as *already resolved*, **threw the fire marker away**,
and `scheduleBlock` cancelled the re-check. **The alarm rang into an app that had already decided the answer.**
*"I missed the 15:58 gym, I'll move it to 17:27 and do it"* is the most natural thing a person does with this
product, and it was the one thing it silently refused to allow.

**Google sign-in: the error that said nothing cost hours.** `accessToken cannot be empty` — **one missing
argument**. We had re-verified the SHA-1 against the actual APK signature, the web client id, the enabled
providers (all correct) and reached for "propagation delay" and "this device's Play Services may be patched".
All wrong. It hid that long because we **caught the error and replaced it with "로그인에 실패했어요"**. Surfacing
the code found it in one minute. ***An error that says nothing costs more than one that looks technical.***

### And then the model broke — in the right direction

**D62 — `없음` comes back.** D43 had deleted it ("a block you'd never be told about isn't worth adding"). That
**mistook a block for an alert**. A block is also **an hour of your day that is taken**: 강의, 알바, 이동 belong on
the plan *so the day is honest*.

**D67 — one unit; the tier IS what the thing is.** He added a `없음` block and **it did not appear on the
calendar**. The month showed a free afternoon that was not free. Two entities — `ImportantEvent` and
`TimeBlock` — that were **always the same thing**, forcing the user to answer a question that has nothing to do
with their life (*"is this a 일정 or a 블록?"*) and then punishing the answer. **A calendar that hides half your
commitments is worse than none: it does not merely omit, it actively tells you the day is free.**
`ImportantEvent` is **retired**. **없음** = it holds the hour · **알림** = it matters · **실행** = the lever.
*(Cheapest possible moment: zero events existed, locally or in the cloud.)*

**D68 — a `없음` block answers itself.** No 해냄 to press, no 쉼 to toggle; it flows into 지난 기록 as **지남**,
derived and never recorded. *A 강의 that happened exactly as planned is not a datum about the lever* — and
demanding a tap to clear it would turn the honest day into a chore list, which is the maintenance death (C2)
the product exists to avoid.

**D65 — 무음.** Loudness was a boolean, so the quiet end of it **still buzzed your leg**. A vibration is not
free: if the phone twitches twenty times a day, the twenty-first — the one that matters — is just another
twitch. Three settings now, still orthogonal to the tier: **the execution moment itself may be silent.** *The
screen IS the intervention; the noise was only ever its escort.*

**D69 — the far future.** After D67 the block editor became the **only** door onto the calendar — and it could
reach only 21 days (add) or one arrow-tap per day (edit). The unification would have quietly cost the app the
very thing the calendar was for. It opens a month calendar now.

**D70 — the moment is addressed to ONE phone.** With sync working, an `실행` block took over **every logged-in
phone at once**. Three phones lighting up together does not say *"do it now"* — it asks **"where am I supposed
to do this?"** The account remembers its devices; a block names the phone(s) that may take the screen (default:
the one you planned on). The others still **tell** you — one buzz, one notification. *Being unaware is a
different failure from being interrupted in three rooms, and we refuse both.* Fallbacks err **loud**: an alarm
on the wrong phone is an annoyance; **an alarm on no phone is the product failing**.

### Shipping state
**v0.4.0 (versionCode 6)** — release APK, signed with the same key (so Google sign-in keeps working), **runs
with no Metro and no laptop**. Icon shipped. Day zero was created deliberately (device reinstalled, Firestore
wiped): **the self-experiment cannot start on data carrying test blocks, prototype leftovers, and outcomes the
bugs invented. A false record is worse than none, because we would reason from it.**

---

## 2026-07-13 (night) — everything the audit found, fixed; release build; day zero

The founder's call: **"모든 것을 다 해결하고 가는 것이 좋다."** So the rest of the audit — every MEDIUM and LOW,
not just the HIGHs — was closed before cutting a release.

**The lever's safety net did not exist.** D47 ("insist, never trap") says the moment re-summons itself three
times and **the notification is then how you return to it**. The notification had a `fullScreenIntent` and **no
`contentIntent`**: tapping it did nothing. An unanswered occurrence, once sent away three times, was
**unreachable**, and its notification sat in the shade forever because only `dismiss()` cleared it — and
`dismiss()`, by definition, never ran. The whole re-summon design leaned on a way back that was a comment.

**Other things that fail in silence:** the alarm volume could stick at **MAX permanently** (a failed
`MediaPlayer` made the next call "save" MAX as the user's original level) · **one corrupt byte** in storage or
the native mirror took down every screen, save, edit and delete · **false misses** were manufactured for blocks
created *after* their own fire time (they never had a chance to fire) · **signing into a second account uploaded
the first account's data into it** · and **R2's "within seconds" actually meant "after you navigate away and
back"** — the data arrived, the screen never redrew.

**Designed features that had quietly gone missing:** the **recent-entry presets** that S4 is graded on (the docs
specify "a fast sheet WITH presets"; we shipped a blank form and then measured its friction) · **haptics**
(installed, never imported once — in an app used one-handed at a till, without looking) · **하루 요약 and
돌아보기 as reachable destinations** (the IA makes 돌아보기 top-level; it was two taps deep behind the volume
slider — *a surface you cannot find is a surface you do not have*) · and the moment's **serif voice**, which was
loaded at startup, **blocked the splash**, and was **used by nothing** — the design centrepiece shipping in the
wrong typeface.

**Release + day zero.** `assembleRelease` (signed with the same key, so Google sign-in keeps working) installs
and **runs with no Metro and no laptop**. The device was reinstalled and the founder's Firestore wiped, because
the self-experiment cannot start on data that carries test blocks, prototype leftovers, and outcomes the bugs we
just fixed *invented*. **A false record is worse than none — we would have reasoned from it.**

---

## 2026-07-13 (evening) — the pre-release audit: five auditors, eight silent killers

The founder refused to cut a release APK until the app had been checked against **every doc**, not just the
ones we happened to remember. Five independent agents audited in parallel — PRD R1–R18 · spec/data-model/
architecture · design/decisions · research-for-dropped-features · and **one adversarial bug hunt that was told
to ignore the docs entirely**.

**The most useful auditor was the one forbidden to read the docs.** It found the worst defects. Reading the
spec first induces *"this was decided, so it must be right"* — and four of today's data-destroying bugs sat in
code that matched its spec **exactly**.

### The eight that fail in silence (stage 1)
Every one of these produces no error, no crash, and nothing the founder would notice — until the
self-experiment was already built on a lie.

**Data loss.** Firestore **rejects `undefined`**, and the screens hand it rows full of them (a block with no end
time literally carries `end: undefined`). The rejection was thrown inside `fire()` and **swallowed**, so the row
never reached the cloud — and then the next snapshot, **seeing no such document, deleted it from the phone and
cancelled its alarm.** Saving a workout without an end time was enough to lose it. Underneath sat a rule that is
**false**: *"absent from the cloud ⇒ deleted."* A real deletion leaves a **tombstone** (D54); absent means the
cloud **never received it** — created offline, push failed, restored from a backup. The blind-projection path is
gone: every snapshot reconciles now, and reconcile cannot lose a row. Backup import, which wrote behind the
repositories' backs, was the third way to lose data the same way.

**The lever.** The ~5-minute re-check was scheduled with `persist = false` — an OS alarm with **no record behind
it**. Android drops an app's alarms on force-stop (a Samsung "close all" does exactly that) and on reboot, and
with nothing in the mirror **nothing could ever re-arm it**. *This is what the founder hit: he committed, closed
the app, and "진짜 했어?" never came.* **(And it corrects yesterday's diagnosis: D55's orphan sweep was not the
cause — the re-check was never in the mirror to be swept. The fix was still right; the reasoning was not.)*
Separately, a **failed** exact-alarm schedule was **mirrored as if it had succeeded**, so `pastUnfiredBlocks`
read the block as armed and **excluded it from the never-fired catch-up net** — the net disarmed by the very
failure it exists to catch.

**False outcomes** — and these are the worst, because they are not lost data but *invented* data, and we reason
from it. A **DONE answered after midnight** was filed against the **next day**: a 23:58 block answered "응, 했어"
at 00:03 left today's occurrence unanswered, and seven days later the catch-up net auto-archived it as **a miss
the user had explicitly denied**. A **screen rotation** recreated `ExecutionActivity` (no `configChanges`) and
re-recorded the fire — picking the phone up off a table double-counted the occurrence. A **double tap** wrote two
outcomes, and an impatient 했어-then-안 했어 wrote a `done` *and* a `miss` for the same occurrence.

**A forbidden escape.** "오늘은 쉼" stayed tappable **after the moment had fired**: the switch was gated on the
block's *start*, but the moment fires at `start − lead`. With a 1-hour lead, a 21:00 block's moment appeared at
20:00 and at 20:02 the card still offered the skip — flipping it filed a *pre-fire* skip for an occurrence that
had already fired **and cancelled the armed re-check**. That is the post-fire escape R7 forbids.

### The instrument was lying too (stage 2 — D60/D61)
**S1's denominator was every outcome**, so 강의/점심 blocks carrying a plain `알림` — which the moment never fires
on — were grading the lever, and could only drag it **down**. PRD §4's falsification condition would then have
fired on a number that was measuring something else: **a working lever could have been thrown away.** **S5 was
structurally 0% forever** (it matched `taskId`, but D37 gave every date its own id). And the whole 측정 screen sat
behind `__DEV__` — **the release build the experiment runs on had no instrument at all.**

Also: **"아직" left no trace anywhere**, so the app looked like it hadn't heard you (D61); and **no record could
be deleted**, on a device full of test data and bug-invented outcomes — you cannot run an honest experiment on a
log you cannot correct.

### What the docs designed and the build had dropped (stage 3)
**P-d, the reference-app data migration, was recorded as "done". It was not** (D59) — only the field mapping was.
The founder's own budget/calorie backups **bounced off the app built to replace those apps**. **Plan templates**
— the designed mitigation for **S3, the biggest non-technical risk** — were never built at all (D58); the app's
only S3 support was a nudge that asks for the very effort at risk. Plus: **deleting a pre-committed block on its
day now counts as a miss** (spec §3.6 — deletion was a silent, cost-free "can't today"); **timezone changes**
re-armed the wrong instant (D57); granting exact-alarm later re-armed nothing; no delete confirmations; and
**onboarding described the OLD lever** — the first thing the app ever said about its core mechanic was wrong.

### Docs corrected (stage 4)
`architecture.md` still said **"Firestore is the sole local store"** and "the storage impl is *replaced*" —
both revoked by D51. `data-model.md` specified **`serverTimestamp()` conflict resolution that exists nowhere in
the code**. `tailwind.config.js`'s header **instructed** a future agent that the skin was provisional and D36's
forest/gold was the truth — the most dangerous kind of stale comment, because it is an order.

---

## 2026-07-13 — F0: the backend, built (not yet device-verified)

**The last phase.** Firebase is wired, the sync engine is written, `/account` exists, and the security rules
are authored. The native build compiles with Firebase alongside the Kotlin alarm module; `typecheck` + all 32
tests are green. What is **not** done: deploying the rules and running two devices against each other.

**Two things the console told us to do that would have been wrong.**
1. *"Hand-edit the root and app `build.gradle`."* — **No.** `android/` is regenerated by every
   `expo prebuild` and is gitignored, so a hand-edit vanishes at the next native change. The
   `@react-native-firebase/app` **config plugin** injects exactly the same thing at prebuild time. Verified
   after a `--clean`: the `com.google.gms:google-services` classpath lands in the root Gradle file, the plugin
   is applied in the app one, and `google-services.json` is copied into `android/app/`.
2. *The **web** SDK config* (`initializeApp({apiKey…})`) the founder pasted first. — **No.** The Firebase JS
   SDK's Firestore cache on React Native is **memory-only**: it dies with the process. That breaks **R11**
   ("identical in airplane mode") and **D34** (Firestore's persistence *is* the local store). We use the
   native `@react-native-firebase`, which reads `google-services.json`, not a JS config object.

**The storage model had to be decided, because the docs contradicted themselves (→ D51).** D34 says Firestore's
cache is the *sole* local store; D20/R4 say the app works with **no account**. Both cannot hold — no account
means no `uid` means no document path. So **AsyncStorage stays the store of record and Firestore is a mirror
that switches on at login.** Logged out, the app is exactly what it was. **No screen and no native file
changed** — the sync lives behind the repository interfaces, as architecture §7 demands.

**The one ordering rule, which is the entire safety argument:** the cutover **pushes before it subscribes**. A
listener projects snapshots *into* local storage, so subscribing first would let a fresh account's empty cloud
land on a phone full of real plans and erase them.

**Deletes are soft** (`deletedAt` tombstones) and the rules **deny hard delete outright** — a hard delete
propagates as nothing, so the other phone would never hear about it and would push the row back up.

**Deliberately not synced:** `lp.outcomes/fires/missed/latencies` — this device's evidence of what the lever
actually did (S1–S5). Merging two devices' fire logs would corrupt the self-experiment.

**A remote row must move the alarm, not just the row.** Apply-hooks re-arm alarms after a snapshot lands, so a
block created on the other phone actually fires here.

**Also fixed, found while reading the repositories:** `normalize()` still produced `alert: "none"` — a tier
**D43 deleted**. A cast to `TimeBlock` hid it from the typechecker, and `scheduleBlock` matches only the two
live tiers, so any block written under D40's three-tier model would have sat in the plan **able to announce
itself in no way at all**. It now lands on `soft` (never silently *promote* a block to a lock-screen takeover
it opted out of).

**And a real hole in the repo:** `google-services.json` was **never actually gitignored**, though every doc
promised it was — and F0's first act is to drop that file into `app/`.

---

## 2026-07-11 — ✅ DEVICE PASS: the whole pre-Firebase app is verified

The founder ran the acceptance pass on a real Android device and it **passed**: the lever fires, re-checks
itself ~5 minutes later, appears while the phone is in use, **stays on top of another app's overlay** (캐시워크),
cannot be escaped or silently ended, and its tone cannot outlive its screen. F1–F5 all behave.

**Everything this device cycle produced is fixed and logged:** D41 (only a heads-up notification appeared) ·
D44 (a tone rang on with no screen and no way to stop it) · D46 (the countdown ran on in the background and
ended the moment) · D47 (coming back must be the app's job, not the user's) · D48 (another app's overlay covered
the moment) — plus D39 (skin locked to v5) and D40/D42/D43/D45 (the alert model, in three founder revisions).

**Status: only F0 (Firebase) remains.** The single "where are we" record is
`implementation-plan.md` → "Build progress (live) — CURRENT STATE".

**Not covered by one pass (for the self-experiment, not a checklist):** firing after a long idle with the screen
fully off (Doze), and multi-day reliability.

---

## 2026-07-11 — Another app's overlay covered the moment → the moment becomes an overlay too (D48)

- **Symptom (founder):** 캐시워크 (a lock-screen/ad app) pops **over** our execution moment; the moment is up,
  but the ad is what you see.
- **Why an activity can never win:** those apps draw a `TYPE_APPLICATION_OVERLAY` window, and **an overlay is
  always above every ordinary activity**. No flag fixes that. And Android has **no "always topmost" grade** —
  if it did, ad apps would already own it. Inside the overlay layer the only rule is: **last added wins.**
- **Fix:** the moment now **renders into its own overlay window** (the Activity stays underneath for what only
  an Activity can do — turn the screen on, show over the keyguard, own the lifecycle), and while **unanswered**
  it **re-claims the top every ~2s** (detach + re-attach). It uses the **"다른 앱 위에 표시"** grant we already
  require (D41); without the grant we fall back to a plain activity and can still be covered — which is exactly
  what the readiness banner exists to warn about.
- **Still bounded (B1/R14):** we out-*layer* other apps, we don't trap the user — the answers are one tap away,
  and leaving still just leaves the outcome pending.
- **Tied to D46:** the overlay is torn down when the activity stops. A window that outlived the moment would be
  precisely the "state that runs unseen" that D46 forbids — and the self-re-summon is what brings it all back.

### Verified
`typecheck` ✓ · `32 tests` ✓ · `prebuild --clean --platform android` ✓. **Device check:** with 캐시워크
installed, fire a moment → **ours must be on top**, and stay there if theirs re-appears.

---

## 2026-07-11 — Device pass #4: the countdown vanished → "the moment exists only on screen" (D46)

- **Symptom (founder):** mid **5·4·3** something was pressed; the countdown disappeared and the app's **main
  screen** came up.
- **Diagnosis — the same class as the unstoppable tone (D44), and the founder said so before I did:** the
  moment kept **living while invisible**. Its phase timers ran on a Handler that didn't care about the
  window, so once the activity lost the foreground the countdown kept ticking in the background and
  **ended the moment by itself** (leave → leavego → dismiss → finish), leaving the RN app on screen.
- **Fix (D46) — the moment is a thing that exists ON SCREEN and nowhere else:**
  · `onPause` **freezes every timer** (`handler.removeCallbacksAndMessages`) and stops the tone;
  · `onResume` **re-renders the same phase**, re-arming its timers — it resumes exactly where it froze;
  · losing the foreground therefore **cannot finish a moment** — only an answer, or a timeout it was awake
    for, can. An unanswered moment always still exists, and its notification is still there to return to.
- **Three supporting holes closed while in there:**
  · **Predictive back (Android 13+) ignores `onBackPressed`** — the override I relied on to kill the in-flow
    escape would be silently bypassed the day the app opts in. Now an `OnBackInvokedCallback` consumes it too.
  · **`FLAG_KEEP_SCREEN_ON`** — a countdown that lets the screen doze is a countdown that lost.
  · **`DONE` is idempotent** — a resumed "done" phase must not record a second outcome.
- **Standing rule (in decisions):** any new state in the moment (timer, sound, animation) must be **tied to
  visibility**. If it can run unseen, it is a bug.

### Follow-up (founder's challenge): "prevent, or pause-and-resume?" → **prevent first, re-summon second** (D47)
The founder pushed on the fix: *if it merely pauses and resumes, then something must bring it back — so
preventing the screen from leaving is the better answer.* Correct, and the honest split is:
- **Automatic screen-off is PREVENTED** (`FLAG_KEEP_SCREEN_ON` + turnScreenOn/showWhenLocked) — while the
  moment is up the screen does not time out. That layer does the real work.
- **A user pressing power/home/recents cannot be blocked by any app** — Android reserves that, and an app that
  *could* trap you would contradict B1 (we never coerce; the only intentional skip is the pre-fire 오늘은 쉼).
- So for that case the moment now **re-summons itself** instead of waiting to be tapped — the background
  activity start the **"다른 앱 위에 표시"** grant (D41) already gives us — **bounded to 3 attempts**: it
  insists, it never traps. After that the notification remains the way back and the outcome stays pending.
Also: a re-summon (or a re-tap of the same notification) is no longer mistaken for a NEW occurrence — it
resumes this one instead of being queued behind it.

### Verified
`typecheck` ✓ · `32 tests` ✓ · `prebuild --clean --platform android` ✓. (Kotlin compiles only on the device
build — needs `run:android`.)

---

## 2026-07-11 — Device pass #3: the unstoppable alarm (D44) · alert model round 2 (D43)

### THE SERIOUS ONE — a tone playing with no screen and no notification (D44)
- **Symptom (founder):** the moment fired on the lock screen; the screen was cycled off→on; then **the alarm
  tone kept playing with no window and no notification** — nothing to tap, **no way to stop it**.
- **Cause:** the tone is a looping `MediaPlayer` owned by `ExecutionActivity`. If the activity survived but
  stopped being **visible**, the loop kept running — and (since the previous fix) its notification was
  already cancelled, so there was no way back to the screen that owned the sound.
- **Fix — the tone lives and dies with the screen it belongs to:** it stops on `onPause` (the instant we lose
  the foreground), resumes on `onResume` if the moment is still asking, and is **hard-capped** by its own
  handler that no phase change can clear. **No path can leave audio running without a visible way to stop it.**
- **And the ghost/return trade-off is now right:** the notification is cancelled **on resolution** (not on
  takeover) and answered occurrences are never replayed — but an **unanswered** moment KEEPS its notification,
  because that is the user's way *back* to it. (The previous fix cancelled too early: it removed the very
  thing that could have rescued this situation.)

### Alert model, round 2 (D43)
1. **`없음` removed** — a block you'd never be told about isn't worth adding. Two tiers: **알림 / 실행**.
2. **`실행` is now the DEFAULT** for a new block — the lever is the product; you should have to opt *out*.
3. **A soft alert can arrive more than once** — *(revised same day by **D45**: the moments are **chosen**,
   not repeated on a 5-minute interval. `alertLeads: number[]`, max 3 — "＋ 알림 추가" → 정각 / 5분 / 15분 /
   30분 / 1시간 전 / 직접. Nobody wants "every 5 minutes"; they want "an hour before, 15 before, and on the
   dot".)*
4. **Sound is per-block and independent of the tier** — the **execution moment can be vibration-only**, and a
   **soft alert can ring**. (Two questions — *how hard does it push* vs *how loud is it* — had been fused.)
   Threaded natively (`AlarmItem.sound` → intent → mirror), because the moment reads it at fire time.
   The soft path got a second channel (audible) since Android freezes a channel's sound after creation.
- Consequence in the catch-up net: **only an `execution` block can be "missed"** — a soft alert merely
  informed you, so it never manufactures a miss.

### "그냥 닫기" is now a real button
The optional fail-reason's escape was a faint text link — which reads as *"you really should write something"*.
That friction is exactly how an app quietly stops being used (C2/B1). It is now a **bordered pill of equal
weight** to 남기기, in both the home card and 돌아보기.

### Verified
`typecheck` ✓ · `31 tests` ✓ · `prebuild --clean --platform android` ✓.

---

## 2026-07-11 — The moment must be a ONE-SHOT: the stale notification could replay it

Second round of founder device findings. Answers + one more real defect.

### THE DEFECT — a finished moment could be re-run from the notification shade
- **Symptom (founder):** after 5·4·3·2·1 → "나간다" the screen closed, **but the notification stayed at the top
  of the phone**; tapping it **re-ran the same 진짜 했어? flow**.
- **Cause:** `ExecutionActivity` never cancelled the full-screen-intent notification that launched it. The
  notification only auto-cancels *when tapped* — so after the moment ended by any other route (answer, timeout,
  countdown → 나가), it lingered as a live re-entry point. Worse: tapping a stale **commit** notification would
  re-enter commit and **arm a SECOND 5-min re-check**.
- **Fix:** the moment is now explicitly a **one-shot**. `AlarmNotifications.cancel()` is called (a) the instant
  the activity takes over an occurrence and (b) again when it dismisses; plus a process-level `handled` guard
  so a duplicate intent can't replay an occurrence that was already answered.
- **Same class of ghost, found while fixing it:** the native moment arms its own `"<id>#recheck"` alarm, but
  **JS didn't know to cancel it** — so a block you resolved from the app (해냄 / 미룸) would still ask
  "진짜 했어?" five minutes later. `unscheduleBlock` now cancels it too, and `scheduleBlock` cancels it **only
  once the block is closed** (a still-open block must keep its re-check — an app-open re-arm would otherwise
  silently delete a follow-up the user is still owed). Covered by 3 new tests.

### The re-check also only arrived as a notification → **same cause, already fixed**
The founder saw the 5-min re-check arrive as a heads-up ("지금 — 테스트…") that had to be tapped. It travels the
**same** `AlarmScheduler → AlarmReceiver → showFullScreen` path as the commit, so **D41's "다른 앱 위에 표시"**
covers both. With that grant, the re-check takes over the screen by itself.

### "나간다 → the app just closes. Is that right?" → **yes, by design**
The moment's job is to **push you out the door**, not to hold you for paperwork (A2/A3: one tap, no decisions,
no typing — designed for the depleted self). So it ends. The outcome stays **pending** — deliberately **not** an
immediate miss (R14) — and the evaluation happens **later, in the app**: the home **catch-up card** ("아직 안
했죠 · 했어 / 미룸") and, if it becomes a miss, the optional one-line reason and **돌아보기** (R17). Nothing is
lost by closing.

### Verified
`typecheck` ✓ · `31 tests` ✓ · `prebuild --clean --platform android` ✓.
**Still unverified on a device:** the moment with the screen **OFF/locked** (the founder's pass was screen-on).

---

## 2026-07-11 — On-device findings: the moment must APPEAR · skin locked to v5 · alert tiers · sound

Founder ran the device pass. One real defect, one lock, two missing features. All four land here.

### 1. THE DEFECT — the moment only appeared as a notification you had to tap (D41)
- **Symptom:** at the fire time a **heads-up notification** appeared; the full-screen moment opened **only
  after tapping it**. Execution became opt-in at exactly the point the user is trying to avoid it — the lever
  was, in effect, off.
- **Diagnosis (not a regression):** Android launches a full-screen intent **immediately only while the screen
  is off/locked**. On an **unlocked, in-use** phone it degrades to a banner, and a BroadcastReceiver's direct
  `startActivity` is blocked by the **background-activity-start restriction** (Android 10+). Earlier tests
  happened to be run with the phone locked, which is why it "used to work".
- **Fix:** request **`SYSTEM_ALERT_WINDOW` ("다른 앱 위에 표시")**, which lifts that restriction → the moment
  appears at its time **in every state**. It is now a first-class grant: onboarding row, 실행 준비 상태 (n/4),
  and the home denial banner, which now says exactly what is lost ("화면을 켜고 쓰는 중엔 실행 화면이 안 떠요").
  **D41** logged; PRD **R7/R16** amended.

### 2. Skin LOCKED to v5 (D39)
The founder confirmed the blue "Toss-form" skin. **It was never the docs that made the code old** — the v5
reskin had simply only touched the JS screens; the docs were *recording* that state ("provisional"). Now:
`design-system.md` §1 is confirmed (D39 supersedes D36's forest/gold **colors**; D36's base-library choice
stands), and the **native `ExecutionActivity` is repainted to v5** — brand `#3182F6`, gold `#B0862A`, exec
ground `#FBFAF6`. **No screen is left on the old palette.** The invariants a reskin may never touch are
restated: miss = taupe (never red) · gold = the one DONE mark · the moment is LIGHT · no confetti.

### 3. Alert tiers: 없음 / 단순 알림 / 실행 알림 (D40 — supersedes D38)
The founder asked for a tier that **just tells you** (notification + vibration) without forcing the
full-screen flow. This **contradicted D38**, which I had written from spec §3.9 ("a block's only notification
is the cue") — so **D38 is superseded, and spec §3.9 is amended**: a block still carries **exactly one**
alert, now chosen from **three**. `TimeBlock.executionAlarm: boolean` → **`alert: none|soft|execution`**
(old data reads through a normalizer). `soft` rides the **quiet channel**, so R15's "only the cue pierces"
still holds *structurally*.
**Why this makes the lever stronger, not weaker:** without a soft tier the user must either over-apply the
lock-screen cue — destroying "one loud thing" (C1/D30), which is loud *because* it is rare — or get nothing.
The soft tier is what protects the cue's scarcity.

### 4. Sound: choosable tone, and silence = vibration-only (D42)
설정 → **소리** (off by default = **진동만**) → when on, **알림음**: pick from the device's alarm/notification
tones **with preview**, or follow the device default. Stored natively (`SoundSetting` + `TonePreview`) because
the moment reads it **at fire time**, when JS may be dead.

### Verified
`typecheck` ✓ · `28 tests` ✓ · `expo prebuild --clean --platform android` ✓ (SYSTEM_ALERT_WINDOW merged into
the manifest). **Needs a device pass:** grant "다른 앱 위에 표시" → the moment must now take over **while the
phone is unlocked and in use**, not just from the lock screen.

---

## 2026-07-11 — F5: 돌아보기 (R17) — plan vs actual, with the reason OPTIONAL

The last phase before the backend. The whole design tension here is **D5 (a fail needs a reason) vs B1 (never
nag, never guilt)**. Founder's call (2026-07-11): **offer the reason, never demand it** — you can always just
close, and an empty reason is a first-class outcome, not an unfinished task.

### What
- **Optional fail reason.** When a miss is recorded (the R6 catch-up "미룸"), the record is **already closed**;
  only *then* does a gentle card appear — "왜 못 했는지 한 줄 남길까요? · 안 남겨도 괜찮아요" — with **남기기 /
  그냥 닫기**. Nothing is blocked, nothing is re-asked. Writes `TimeBlock.failReason` (D5), which until now
  was declared and never written.
- **`/review` (돌아보기)** — month rollup **executed vs planned** (해냄 · 미스 · 쉼 · 계획), with the D-1 line:
  "그중 N개는 전날 미리 정해둔 것" (**D23** — the plan of record is judged, not the same-day edit) · **아직 안
  남긴 것**: past unresolved blocks markable 해냄/미스 right there (R17 acceptance) · **못 한 이유들**: every
  fail gathered in one place, each reason addable/editable/removable **later** (so a skipped reason isn't lost
  forever). Reachable from 설정 and the day summary.
- **What it deliberately does NOT do (D29/D5):** no success-rate score to optimize, **no quantitative
  plan-vs-actual** (planned 60min vs actual 90min), **no auto-suggestions** — the screen says so out loud:
  *"앱은 계획을 대신 고쳐주지 않아요. 이유를 모아둘 뿐이고, 다음 계획은 내가 정해요."* No streak (R14).

### Known gap (needs F0)
spec §3.6: "a block in the D-1 plan but **soft-deleted on the day counts as fail**". We hard-delete today —
tombstones (`deletedAt`) arrive with F0's sync model, so that rule lands then.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (28). No native change → no prebuild.

---

## 2026-07-11 — F4: 하루 요약 (R10) — the day, linked but not merged

The one place the two surfaces meet. Built exactly to the constraint the docs put on it: **integration is a
day-level LINK, never a merged timeline** (D32) — so the screen shows **two distinct sections** and no
interleaved list exists anywhere in the code.

### What
- **`DayAggregate`** (`types.ts`, data-model §2.6) + **`dayAggregate(date, blocks, expenses, meals)`**
  (`logs/aggregate.ts`) — **derived on read, never stored** (zero writes, the §6-3 cost guard). Returns the
  plan side (`blocksPlanned/Success/Fail/Skipped`, `workoutDone`, `runDone`) and the log side
  (`expenseTotal`, `kcalTotal`, `kcalByMeal`) as **separate fields**, which is what makes "two sections, not
  one timeline" structural rather than a rendering choice.
- **`/summary?date=`** — 계획·실행 (tally + the day's blocks with done/miss/쉼) · a divider · 기록 (지출
  총액 + category dots · 칼로리 합계 vs 목표 + per-meal). Reachable from the **calendar's day panel** and the
  **day view's 요약 chip** — never embedded *in* a plan surface (D32 holds: home/day still show no spend/meal).
- **D22 upheld and now centralized:** 운동/러닝 O·X is derived from success blocks in the aggregate; the
  기록 tab's inlined copy of that derivation was removed and now reads the same function.
- **No-guilt (R14):** done = one calm gold 해냄 · miss = **taupe, never red** · 쉼 = neutral · no streak, no
  score, no "달성률".

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (28 — **new `dayAggregate` tests**: per-status counts scoped to the day ·
workout flag derived from a *success* block of that kind (planned ≠ done) · plan-side and log-side totals stay
separate and day-scoped). No native change → no prebuild. On-device pending.

---

## 2026-07-11 — Internal audit against `docs/core/` — 12 deviations found and fixed

A strict conformance audit of the whole build against the core docs (PRD R1–R17 · spec · data-model ·
architecture · design-principles · decisions · CLAUDE.md cautions). Two independent passes (product/UX and
data/architecture). What follows is **only what was actually wrong**; each was verified before fixing.

### The lever was breakable (HIGH)
1. **The cue could die silently when notifications were denied (R16).** The home readiness banner watched
   exact-alarm + full-screen-intent, but the cue is delivered *as* a full-screen-intent **notification** —
   the native path swallows the `SecurityException` when POST_NOTIFICATIONS is missing. So the one grant
   that also kills the lever was the one grant nothing surfaced. → The banner now watches **all three** and
   deep-links to whichever is missing. **PRD R16 amended** to say so.
2. **The migration left ghost alarms and unarmed blocks.** `ensureMigrated()` rewrote storage only. A
   prototype `daily` task re-arms itself **natively** (mirror → receiver → boot), so it would have kept
   firing **forever** with no block behind it (poisoning the catch-up net and S1), while migrated blocks got
   **no alarm at all**. → Migration now **cancels every prototype alarm + soft reminder** and **arms the
   migrated blocks**; app-open now also **re-derives every alarm from the repositories** (`rearmBlockAlarms`,
   architecture §11 layer 4) so any mirror divergence self-heals.
3. **The migration could destroy the prototype's data.** `removeItem(LEGACY_KEY)` sat *outside* the `try`,
   so a corrupt *destination* or a failed write dropped the legacy key anyway → tasks gone, nothing written.
   → The legacy key is now dropped **only after** the new payload is safely persisted.
4. **`/execution` (the JS preview) wrote real S1 data and had an in-flow escape.** It was a live route that
   recorded outcomes with `source: "execution-screen"` — the exact source S1 counts — and offered an "아직"
   bail. It was also two flows out of date. → **Deleted.** `ExecutionActivity` is the single execution moment.
5. **Hardware Back was an in-flow escape.** One Back press mid-5·4·3·2·1 ended the moment — precisely what
   the countdown exists to prevent (A2, CLAUDE.md). → `onBackPressed` is now a **no-op**; the dead prototype
   views (which still carried an "아직" escape) were deleted.

### Policy that was unenforced (MED)
6. **The soft path had no channel**, so R3 advance alerts landed on the OS default (default sound, default
   lock-screen visibility) — the two notification intensities were distinguished only by accident. → A
   dedicated **`lp-soft-v1` channel: IMPORTANCE_DEFAULT · no sound · lock-screen PRIVATE**. R15 is now
   enforced by the channel, not by hope.
7. **The metrics screen graded the wrong things.** It used the prototype's S-numbering (S1=정시발화,
   S2=착수율) while PRD §4 defines S1=execution rate, S2=alarm reliability, **S3=D-1 planning adoption**
   (the biggest non-technical risk), S4=logging friction, S5=no-guilt return — so the two numbers the PRD
   says to watch hardest were swapped/absent. → Rebuilt to **S1–S5 as the PRD defines them**, incl. a real
   S3 (days planned the day before, from each block's `plannedAt`) and S4 (same-day logging share).
8. **The micro-start had no screen.** The R7 flow change (commit → re-check) quietly dropped "지금 신발 신기"
   — the 5-second first move A2 is built on. → It's back, on the commit card.
9. **`skipped` was modelled twice** (`status` *and* a boolean) and could diverge — a settled block could keep
   rendering as 쉼 and stay uncued. → Collapsed to the **single `status`** the doc defines.
10. **Alarm eviction lived in the screens**, so any path that didn't hand-pair it (a future Firestore
    listener, `saveBlocks`) would ghost. → Moved **behind the repository**: add/update/delete reconcile the
    alarm themselves (architecture §9-2).
11. **Ids were timestamps**, so two same-millisecond records collided (and would silently merge under
    last-write-wins). → `newId()` with entropy; data-model §0 corrected (it said UUID, the code didn't).
12. **≤2-tap logging was not actually ≤2 taps** — the expense form required a *name* as well as an amount
    (two keyboard trips). → **Only the amount is required**; a blank name falls back to the category. PRD R8
    + data-model §2.4 amended. Also added the `memo` field the doc had but no screen could write.

### Also corrected
Tone: "나가면 이긴다" (a competitive frame the docs never license) → **"딱 첫 동작만 하면 돼."**; a mixed
존댓말/반말 sentence in `/day`. Copy: 백업 복원이 아직 "할 일 N개"라 하던 것 → "블록 N개".
**Docs that were themselves stale:** architecture §4.1 (recurrence / per-task soft reminders — retired by
D37/D38), design-system §4.3 (Recurrence picker · Plain-reminder picker → the multi-date picker), the
"Task row" component, data-model §2.4/§2.5 (`name` missing, `mealType` enum wrong).

### Not defects (checked, left alone)
**R10 day summary** and **R17 evaluation** are absent because they are **F4/F5** — the plan's next phases, not
drift. The **native moment still runs the forest/gold palette** — that's blocked on the skin-lock decision
(prep P-e), not a bug. `failReason` is still never captured; it lands with R17 (flagged: misses recorded
today accrue without a reason).

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (24) · `expo prebuild --clean` ✓ (native changed: Back no-op, micro-start
on the commit card, dead views removed). **On-device verification is still required** for the native changes.

---

## 2026-07-11 — F3: 기록 탭 real — expense + meal logging (reference apps ported)

The **기록** tab stops being a stub. Both reference apps are ported per their migration spec
(`reference-apps.md` §A/§B) — logic and field shapes, not the code: they were standalone single-file apps.

### What
- **Entities** — `Expense` (date, timestamp, name, amount **KRW** D25, category **8 fixed** D16, store,
  payment **free text** D26) and `MealEntry` (date, timestamp, mealType 아침/점심/저녁/간식, foodName, detail,
  **kcal manual only** D27). **No photo field** (D19). **No 운동/러닝 activity record** (D22) — see below.
- **`src/core/logs/constants.ts`** — the 8 categories with the reference apps' identity **colors + emoji**,
  the meal icons, and the per-meal kcal targets. **Reconciled a reference bug** the spec flagged (§B1): the
  daily target is now **derived** (`sum = 1500`) instead of a hard-coded literal that could desync.
- **`src/core/logs/aggregate.ts`** — pure: month filter · month total · **category distribution** ·
  **day sections** · **today's kcal-vs-target summary** · `stampFor` (the reference convention: the chosen
  date + the current clock time). Reused later by the day summary (R10).
- **Repositories** `lp.expenses.v1` / `lp.meals.v1` (same Repository pattern → F0 swaps them to Firestore).
  Both keys added to the JSON backup's merge map (R12).
- **Screens** — `(tabs)/logs.tsx`: 지출 / 식사 segmented, month nav, the summary card (총 지출 + distribution
  bar + top-3 legend / kcal vs target per meal), day-grouped list. `/add-expense` + `/add-meal`: **amount and
  food name are focused first**, the category/meal type is one tap (meal type is pre-picked from the clock) —
  the S4 bar is **≤2 taps + a number**.
- **D22 upheld:** the 식사 summary's **운동/러닝 O·X is derived from that day's TimeBlocks** marked success
  ("블록에서 자동"), not logged here. **D32 upheld:** nothing from this surface appears on home/My Day.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (24 — **new `aggregate.test.ts`**: month-scoped total, category split
+ ratio, day sections newest-first, KRW formatting, per-meal kcal vs target ignoring other days, derived
1500 daily target, `stampFor`). **No native change → no prebuild.** On-device pending: log an expense and a
meal in ≤2 taps; the month total / distribution / kcal summary read correctly.

---

## 2026-07-11 — F2: TimeBlock + day plan + My Day (Task fully retired)

The prototype's `Task` is **gone**; the app now runs on the full-app **`TimeBlock`** (data-model §2.3) — one
system, one integrated day. Two founder decisions were logged first (**D37**, **D38**) because the code had
drifted from the docs.

### Decisions taken before coding
- **D37 — no recurrence.** The docs' TimeBlock is strictly **per-date**; the prototype's `daily|weekly` had no
  home in it (no `date` → no D-1 snapshot, no per-day status, nothing for the day view to own). Kept the docs;
  replaced the need with **multi-date add**: tick N dates → **N independent blocks** (the UI says "반복이 아니라
  각각 따로예요"). Migrated recurring tasks land as **one block on today**.
- **D38 — one notification per block.** spec §3.9 as written: a block's only alert is the **execution cue**. The
  prototype's soft per-task "단순 알림" is dropped for blocks; the soft path lives on as the event advance
  notification (R3).

### What
- **`TimeBlock`** (`types.ts`) — date · start/end · title · location · kind(normal|workout|run) · executionAlarm
  + alarmLeadMinutes + microStartNote · **skipped** (the pre-fire "오늘은 쉼") · **snapStart/snapEnd/snapTitle/
  plannedAt** (D-1 snapshot) · status(planned|success|fail|**skipped**) · failReason · completedAt.
- **`blockRepository`** (`lp.blocks.v1`) — CRUD + `blocksOn` + `groupByDate`, and the **one-time Task migration**
  (`lp.tasks.v1` → blocks, **ids preserved** so existing outcomes/fires/latencies stay attached, then the old key
  is dropped). `kind` is guessed from the title. Old (prototype) JSON backups still import — the restore lands
  as tasks and the next read migrates them.
- **`blockScheduler`** — `blockFireAt` = **live** `date+start − lead` (D23: the snapshot never schedules);
  `scheduleBlock`/`unscheduleBlock` (one-shot; skipped/off/past → cancel); **`snapshotFor`** (mirrors while the
  date is future, **freezes by itself once the date arrives** — no midnight job; a block created on the day
  snapshots its creation values); **`pastUnfiredBlocks`** (R6 never-fired net, now trivially date-based);
  **`freeSlots`** (the day's real empty gaps).
- **`/day`** (new) — the day's schedule in clock order + the **free-slot hint** ("진짜로 비어 있는 시간이에요.
  운동은 여기에 놓으면 실제로 하게 돼요") which pre-fills the add screen's start/end.
- **`/add-block`** (replaces `/add`) — title · start(–end) · kind · **multi-date picker (21 days)** · location ·
  execution cue + lead + micro-start.
- **Home = My Day** — today's blocks as execution cards (next-up hero), the "오늘은 쉼" switch **only before the
  moment** (no in-flow escape), a calm **해냄** after it, plus a **"내일 하루 설계하기"** nudge (S3, the biggest
  adoption risk). Catch-up net (R6), permission banner (§8) and the no-guilt outcome model carry over unchanged.
  Outcomes now also write back to the block (`status`/`completedAt`) so R17 evaluation can read it off the block.
- **Calendar** — the selected-day panel gained a **하루 설계** section (that day's blocks) opening `/day` (D21).
- Retired: `taskRepository`, `taskScheduler` (+test), `/add`.

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (17 — **new `blockScheduler.test.ts`** covers: fire = live start − lead;
cue off / skipped → no fire; snapshot mirrors-then-freezes; same-day edit does **not** move the plan of record;
never-fired reconstruction skips blocks the native backup will still re-fire; free-slot gaps). **No native change
→ no prebuild.** On-device pending: migration of existing tasks, multi-date add, `/day` free slots, a flagged
block firing the execution moment.

---

## 2026-07-11 — F1 완결분: important-event advance notification (R3, local · no backend)

**Why now (a plan correction).** F1's advance notification was filed as "waits for F0 (backend)". A code
audit showed that's wrong: **R3/D18 specify a *local* notification** (explicitly **not** paid server push),
and `src/core/notifications/plainReminders.ts` (expo-notifications) already exists. So R3 needs **no
backend** — **F0 gates only R2 (cross-device propagation)**. F1 is now complete except R2.

### What
- **`plainReminders.ts` (reframed as "the SOFT notification path", R15a)** — gained the event path next to
  the task path: `scheduleEventNotification(event)` · `cancelEventNotification(id)` ·
  `rearmEventNotifications(events)` · the pure `eventNotifyAt(event, lead, now)`. Alert time =
  `date+time − lead`; **lead = `event.notifyLeadMinutes`, else the personal default** (R3 "default if
  unset", R13/D28 — read lazily from `settingsRepository`, so the module's time math stays import-clean).
  Identifiers `${eventId}-e` (task reminders are `${taskId}-r${offset}` — no collision).
  **An untimed event gets no alert** — R3 is defined on `time − lead`, and inventing a time was rejected.
- **`add-event.tsx`** — a **알림** lead section (정각 / 10분 / 30분 / 1시간 / 하루 전 + 직접), shown only when
  시각 지정 is on; new events pre-fill the personal default. Save schedules (same id → replaces), delete
  cancels. Copy states the R15 discipline plainly: **"조용한 알림이에요 — 잠금화면을 뚫지 않아요."**
- **Re-arm** — home's app-open drain (`(tabs)/index.tsx`) and **backup import** (`backup.ts`) both call
  `rearmEventNotifications`, which drops *all* event alerts (incl. ghosts of deleted events) then
  reschedules the current set. Survives reboot / reinstall / restore.
- **`(tabs)/calendar.tsx`** — the selected-day detail shows the set lead ("🔔 30분 전").

### Verified
`npm run typecheck` ✓ · `npm test` ✓ (**new** `plainReminders.test.ts`: lead counted back from local
date+time · 하루 전 · 정각 · untimed → none · past → none). **No native change → no prebuild** (JS only);
Metro reload suffices. On-device check pending: set an event 30분 전 → the quiet alert arrives, and it does
**not** pierce the lock screen.

---

## 2026-07-11 — Execution moment: delayed "진짜 했어?" re-check (R7 flow change, native)

Founder-directed change to the core lever (native `ExecutionActivity`). **New flow:** COMMIT ("…하기로 했잖아")
→ acknowledge ("응, 할게") + the app **arms a ~5-min follow-up alarm** and dismisses → 5 min later it re-opens
over the lock screen at **RECHECK ("진짜 했어?")**: **"응, 했어"** → DONE; **"아직 안 했어"** → 5·4·3·2·1 → **"지금
나가."** → dismiss (outcome stays **pending** — no-guilt catch-up, never an immediate miss). Replaces the prior
COMMIT→immediate-countdown→micro-start→GO. Invariants held: light, no in-flow "can't-today" escape, no guilt.

### What (native, `app/modules/lp-alarm/`)
- Threaded a new **`EXTRA_MODE`** ("commit" | "recheck") through `AlarmScheduler` (const + `AlarmItem.mode` +
  fire/show PendingIntents), `AlarmReceiver`, and `AlarmNotifications.showFullScreen`. JS path unaffected (`mode`
  defaults to "commit"; `LpAlarmModule.scheduleExactAlarm` unchanged).
- `ExecutionActivity`: reads `mode`; on **commit** it records the fire marker + `scheduleRecheck()` (a transient
  one-shot `AlarmItem(id="<taskId>#recheck", fireAt=now+5m, recurrence="none", mode="recheck")`, `persist=false`)
  then shows commit (button → dismiss); on **recheck** it renders "진짜 했어?" → 응했어=`render("done")`
  (existing `recordDone`), 아직안했어=`leave` 5·4·3·2·1 → `leavego` → dismiss. The re-check id's `#recheck` suffix
  is stripped so outcomes key the original task. The old commit→countdown→act→go views are kept but unreached.
- Outcomes: **no JS change** — "응, 했어" records `done` via the existing `PendingOutcomes`; "아직 안 했어" records
  nothing (pending → the R6 catch-up net resolves it later).

### Notes / risks
- **Native (Kotlin) — not compile-checkable here** (gradle compiles only at `run:android`); reviewed carefully.
  Needs **`prebuild --clean` + `run:android`** on a real device to verify.
- Edge: a re-check crossing local midnight would date the `done` to the next day (rare; accepted, `[TBD]`).
- The native moment still uses the **prototype forest/gold palette** (the v5 Toss-form skin only touched the JS
  preview `execution.tsx`, which is NOT the live moment) — reskinning the native moment to v5 is a separate task.
- Docs updated: PRD **R7** flow + acceptance; **design-principles A2** revision note.

---

## 2026-07-11 — Bottom tabs + month calendar (R1, local-first)

First full-app UI feature. **Note on order:** built the calendar **UI local-first ahead of F0** (the backend
phase) at the founder's direction — legitimate, because the Repository pattern lets the storage impl swap to
Firestore later behind the same interface (architecture §7). So this is F1's UI on a local store; F1's sync
(R2) + advance notification (R3) still wait on F0.

### What
- **Bottom tab bar** (`app/app/(tabs)/_layout.tsx`) — expo-router `(tabs)` group: **홈 · 캘린더 · 기록**
  (react-native-svg icons; active = brand blue, inactive = grey). Restructured the app from a flat Stack:
  moved the home screen `index.tsx → (tabs)/index.tsx`; non-tab screens (add, execution, settings,
  onboarding, metrics, add-event) stay at the `app/app/` root and push over the tabs via the root Stack.
  **기록** is a placeholder for now (the real expense/meal logs = R8/R9, a later feature).
- **Calendar screen** (`app/app/(tabs)/calendar.tsx`, PRD R1) — a **square-cell month grid** (7×6, CSS
  `aspectRatio: 1`, no measuring): date number top-left; a day with events shows a **horizontal colored bar**
  (color = `event.color`, up to 2 bars + "+N"); today = a filled brand circle; selected day = brand-soft cell.
  Prev/next month + **오늘**. Tapping a day selects it and the **panel below the grid** lists that day's events
  in detail (color dot + title + time + memo), with **＋ 일정 추가**; empty → gentle "이 날은 일정이 없어요".
- **ImportantEvent data** — new `ImportantEvent` entity in `src/core/data/types.ts` (id, title, date, time?,
  notifyLeadMinutes?, color?, memo?, createdAt, updatedAt — mirrors data-model §2.2) + a local
  `eventRepository.ts` (`lp.events.v1`, same AsyncStorage Repository pattern as taskRepository, +
  `groupByDate`). Added `lp.events.v1` → id to `backup.ts` merge keys so events are covered by JSON
  backup/restore.
- **Add/edit event** (`app/app/add-event.tsx`) — modeled on add.tsx: title (required), date (editable by day),
  optional time (Switch + HH:mm), a bar **color** (preset chips), memo; save/edit/delete.

### Scope / deferred
- **Sync (R2)** and **advance notification (R3)** are NOT in this change — they land with the backend (F0).
- The tab bar exists ahead of the full IA build-out; **기록** is a stub; 돌아보기/평가 (F5) not present.

### Verified
- `npm run typecheck` ✓ · `npm test` ✓ (route/type + scheduler logic intact). New native deps: none
  (react-native-svg already present) → no prebuild; a Metro reload suffices. On-device visual check pending
  (founder): tab switching, the square calendar, add-event → colored bar appears, tap-day → detail panel.
