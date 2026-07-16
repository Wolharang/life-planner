// Account (PRD R4 · F0). v5 skin — grey ground, white grouped cards, matching /settings.
//
// The whole point of this screen is what it does NOT do: it never blocks anything. The app is fully usable
// with no account (D20) — this screen only turns **sync** on. So it opens by saying so, in plain Korean, and
// a failure to log in is stated as a fact and never as a fault (B2/R14: the app does not scold).
//
// Sync is not a feature of the lever. Losing it costs you the other phone; it must never cost you the moment.

import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  authErrorMessage,
  changeEmail,
  currentAccount,
  discardCurrentUser,
  firebaseAvailable,
  googleAvailable,
  kakaoLoginAvailable,
  onAccountChanged,
  refreshVerification,
  resendVerification,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signInWithKakaoToken,
  signOut,
  signUp,
  type Account,
} from "@/core/data/firebase";
import { openKakaoLogin, getKakaoEmail, setKakaoEmail } from "@/core/data/kakaoAuth";
import { spendDaily, refundDaily, dailyLimit } from "@/core/data/rateLimit";
import { holdSync, releaseSync, syncStats } from "@/core/data/sync";
import { deleteAccount } from "@/core/data/erase";
import { Sheet, ConfirmSheet } from "@/ui/Sheet";
import { AGE_CONSENT, LEGAL_DOCS, LEGAL_ORDER, type LegalKey } from "@/content/legal";
import {
  CONSENT_ITEMS,
  consentComplete,
  consentIsCurrent,
  fetchConsent,
  pushConsent,
  recordConsent,
  type ConsentItem,
} from "@/core/data/consentRepository";

type Mode = "signIn" | "signUp";

export default function AccountScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAccountChanged(setAccount), []);

  // ── Consent (이용약관 · 개인정보 처리방침 · 위치기반서비스) ─────────────────────────────────────────
  // All three are required **to sign up** — never to log in. Ticking a box that leaves no trace is theatre, so
  // the answer is *recorded* with the version of the words they actually saw (consentRepository).
  // **Each tick keeps its own second.** They are separate acts — the moment the age was confirmed is not the
  // moment the privacy policy was accepted — and a single timestamp stamped over all four at submit would be a
  // record of the *submit*, not of the consents. Unticking clears the time: an act that was taken back leaves
  // no trace of having happened.
  const [ticks, setTicks] = useState<Partial<Record<ConsentItem, number>>>({});
  const tick = (item: ConsentItem) =>
    setTicks((t) => (t[item] ? { ...t, [item]: undefined } : { ...t, [item]: Date.now() }));

  const [alreadyConsented, setAlreadyConsented] = useState(false);
  useEffect(() => {
    consentIsCurrent().then(setAlreadyConsented);
  }, []);

  const allTicked = CONSENT_ITEMS.every((k) => !!ticks[k]);
  const toggleAll = () => {
    if (allTicked) {
      setTicks({});
      return;
    }
    const now = Date.now();
    const all: Partial<Record<ConsentItem, number>> = {};
    for (const k of CONSENT_ITEMS) all[k] = now; // one press, one instant — honestly the same second for all
    setTicks(all);
  };

  // **Say when sync is behind.** Writes are handed to Firestore and not awaited (awaiting hangs the save
  // button offline), but the app must not therefore *pretend* they landed: the founder's 180 imported expenses
  // sat undelivered in Firestore's outbox while the app reported everything synced. This is the number that
  // would have said so.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPending(syncStats().inFlight + syncStats().failed), 1500);
    return () => clearInterval(t);
  }, []);

  const available = firebaseAvailable();
  const withGoogle = googleAvailable();
  const withKakao = kakaoLoginAvailable();

  // **Do not show them a login that is about to be taken back.** `onAccountChanged` fires the moment Firebase
  // accepts the Google account, so the screen flashed "동기화 켜짐" with their email — and only then bounced them
  // to 가입. Announcing an account we are in the middle of deleting is a lie the user watches us tell.
  const [deciding, setDeciding] = useState(false);

  // Kakao's email is not a Firebase auth email — load the on-device copy (if the user consented) to show instead
  // of "로그인됨". Cleared when the account isn't a Kakao one.
  const [kakaoEmail, setKakaoEmailState] = useState<string | null>(null);
  useEffect(() => {
    if (account?.kakao && account.uid) getKakaoEmail(account.uid).then(setKakaoEmailState);
    else setKakaoEmailState(null);
  }, [account?.uid, account?.kakao]);

  const google = async (chooseAccount = false) => {
    if (busy) return;
    setError("");

    // **One button, two acts.** "Google로 계속하기" is a login for someone who has an account and a *signup*
    // for someone who does not — and which one it is cannot be known until Firebase answers (`isNewUser`).
    //
    // So: on the 가입 tab, the ticks are demanded up front. On the 로그인 tab they are NOT — asking again for a
    // consent the user already gave at signup is not caution, it is a wall in front of a door they own. If the
    // sign-in turns out to have *created* an account, we undo it and send them to 가입, where the ticks live.
    if (mode === "signUp" && !allTicked) {
      setError("필수 항목에 모두 체크해 주세요.");
      return;
    }

    setBusy(true);
    setDeciding(true);
    // Sync must not start until we know what this login was. It begins the instant auth reports a user, and
    // an account we are about to delete would already have this phone's rows on the server.
    holdSync();
    let keepIt = true;
    try {
      const { isNewUser } = await signInWithGoogle(chooseAccount);

      if (isNewUser && mode !== "signUp") {
        // A brand-new account, minted with nothing behind it. Take it back rather than let it stand.
        keepIt = false;
        await discardCurrentUser();
        setMode("signUp");
        setError("처음이시네요. 필수 항목에 체크해 주세요.");
        return;
      }

      const uid = currentAccount()?.uid;
      if (isNewUser) {
        await recordConsent(ticks, uid); // each tick, with the second it was given
        setAlreadyConsented(true);
      } else if (uid) {
        // A returning phone, or a second one: bring the account's consent down, or 동의 내역 would be empty
        // for the same person on the same account (D74).
        await pushConsent(uid);
        setAlreadyConsented(consentComplete(await fetchConsent(uid)));
      }
    } catch (e) {
      keepIt = false;
      setError(authErrorMessage(e)); // "" when the user simply backed out of the sheet
    } finally {
      releaseSync(keepIt);
      setDeciding(false);
      setBusy(false);
    }
  };

  // **Kakao — the same one-button asymmetry as Google (D99).** The OAuth dance runs in a Custom Tab (a real
  // browser, so KakaoTalk app login is offered first); it hands back a Firebase custom token, and from here the
  // consent/discard logic is identical to `google()`.
  const kakao = async () => {
    if (busy) return;
    setError("");
    if (mode === "signUp" && !allTicked) {
      setError("필수 항목에 모두 체크해 주세요.");
      return;
    }
    setBusy(true);
    setDeciding(true);
    holdSync();
    let keepIt = false;
    try {
      const r = await openKakaoLogin();
      if (r.cancelled) return; // closed the browser — nothing to say
      if (r.error || !r.token) {
        setError("카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const { isNewUser, uid } = await signInWithKakaoToken(r.token);
      if (r.email && uid) await setKakaoEmail(uid, r.email); // on-device email, if consented
      // Update the display state directly too — the load effect fires on the auth-state change (before this
      // store completes), so without this the email would only appear on the next visit to the screen.
      if (r.email) setKakaoEmailState(r.email);

      if (isNewUser && mode !== "signUp") {
        await discardCurrentUser(); // a brand-new account with no consent behind it — take it back
        setMode("signUp");
        setError("처음이시네요. 필수 항목에 체크해 주세요.");
        return;
      }
      keepIt = true;
      const acc = currentAccount()?.uid;
      if (isNewUser) {
        await recordConsent(ticks, acc);
        setAlreadyConsented(true);
      } else if (acc) {
        await pushConsent(acc);
        setAlreadyConsented(consentComplete(await fetchConsent(acc)));
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      releaseSync(keepIt);
      setDeciding(false);
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (mode === "signUp" && !allTicked) {
      setError("필수 항목에 모두 체크해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signUp") {
        await signUp(email, password);
        await recordConsent(ticks, currentAccount()?.uid); // each tick, with the second it was given
        setAlreadyConsented(true);
      } else {
        await signIn(email, password);
        // A returning phone: bring the account's consent down, or 동의 내역 would be empty for the same
        // person on the same account (D74). And if this phone consented moments ago, stamp the uid on it.
        const uid = currentAccount()?.uid;
        if (uid) {
          await pushConsent(uid);
          setAlreadyConsented(consentComplete(await fetchConsent(uid)));
        }
      }
      setPassword("");
      // The sync engine is watching the auth state (app/_layout) — it pushes this device's rows up, then
      // starts listening. Nothing to do here.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  // ── 준회원 → 정회원 (이메일 인증) ─────────────────────────────────────────────────────────────────────
  // An email/password account starts **준회원**: it works in full, but the address is only claimed. The link in
  // the signup mail promotes it to **정회원**, which is what unlocks password reset. A Google account skips all of
  // this — `verified` arrives true. This banner is **never a wall** (D20): it explains a benefit, it blocks
  // nothing, and it is taupe-neutral, never a warning (R14).
  const [note, setNote] = useState("");

  // Catch a link that was clicked in the browser: `emailVerified` is cached, so a fresh `reload` is the only way
  // to see it. Runs once per login while still 준회원 — never for Google, never once already verified.
  useEffect(() => {
    if (!account || account.google || account.verified) return;
    refreshVerification().then((fresh) => {
      if (fresh?.verified) setAccount(fresh);
    });
  }, [account?.uid, account?.verified, account?.google]);

  const resend = async () => {
    if (busy) return;
    // Device budget first — before we touch Firebase's shared quota.
    const gate = await spendDaily("resendVerification");
    if (!gate.allowed) {
      setNote(`인증 메일은 같은 기기에서 하루에 ${dailyLimit("resendVerification")}번까지 보낼 수 있어요. 내일 다시 시도해 주세요.`);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      await resendVerification();
      setNote("인증 메일을 다시 보냈어요. 메일함을 확인해 주세요.");
    } catch (e) {
      if (isNetwork(e)) await refundDaily("resendVerification"); // a mail that never left must not cost a token
      setNote(authErrorMessage(e) || "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  // ── 이메일 주소 변경 (로그인 상태 · 이메일 계정만) ────────────────────────────────────────────────────
  // Google accounts do not change their email here — it is Google's, not ours. The new address must confirm the
  // change by clicking a link (verifyBeforeUpdateEmail): the email only moves once the new inbox proves it is
  // real, and the OLD address is notified by Firebase. Same device budget as resend — 3 a day.
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailNote, setEmailNote] = useState("");

  const submitEmailChange = async () => {
    if (busy) return;
    if (!newEmail.trim()) {
      setEmailNote("새 이메일을 입력해 주세요.");
      return;
    }
    const gate = await spendDaily("emailChange");
    if (!gate.allowed) {
      setEmailNote(`이메일 변경은 같은 기기에서 하루에 ${dailyLimit("emailChange")}번까지 보낼 수 있어요. 내일 다시 시도해 주세요.`);
      return;
    }
    setBusy(true);
    setEmailNote("");
    try {
      await changeEmail(newEmail);
      setEmailNote(`${newEmail.trim()}(으)로 확인 링크를 보냈어요. 링크를 누르면 이메일이 바뀌어요. 기존 이메일로도 변경 안내가 가요.`);
      setNewEmail("");
    } catch (e) {
      if (isNetwork(e)) await refundDaily("emailChange");
      setEmailNote(authErrorMessage(e) || "변경하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const checkVerified = async () => {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const fresh = await refreshVerification();
      if (fresh?.verified) {
        setAccount(fresh); // the banner disappears on its own — 정회원 now
      } else {
        setNote("아직 인증되지 않았어요. 메일의 링크를 누른 뒤 다시 눌러 주세요.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── 비밀번호 재설정 (로그아웃 상태 · 로그인 탭) ───────────────────────────────────────────────────────
  // You reach for this because you cannot sign in, so it runs logged out. The message stays neutral and does not
  // reveal whether the email is registered — standard practice, and it costs us nothing here.
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const forgotPassword = async () => {
    if (busy) return;
    if (!email.trim()) {
      setError("이메일을 입력한 뒤 눌러 주세요.");
      return;
    }
    // The tightest budget: one reset per device per day. It is the most abusable send (logged out, any address),
    // and the founder's concern is exactly this — one device must not be able to drain Firebase's shared quota.
    const gate = await spendDaily("passwordReset");
    if (!gate.allowed) {
      setResetInfo("비밀번호 재설정 메일은 같은 기기에서 하루에 한 번만 보낼 수 있어요. 내일 다시 시도해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordReset(email);
      setResetInfo(
        "가입한 이메일이라면 재설정 링크를 보냈어요. 메일함을 확인해 주세요.\n\nGoogle로 가입했다면 'Google로 계속하기'로 로그인해 주세요.",
      );
    } catch (e) {
      if (isNetwork(e)) await refundDaily("passwordReset"); // no network → the reset never left; give it back
      // Firebase did not answer cleanly (its own limit, or no response). Guide, in the same calm sheet, instead
      // of dead-ending with a raw error. (founder: 제대로 응답이 오지 않을 때 안내 문구.)
      setResetInfo(authErrorMessage(e) || "지금은 메일을 보낼 수 없어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  // ── Leaving ────────────────────────────────────────────────────────────────────────────────────────
  // 이용약관 제6조 and 처리방침 제7조 already promise 탈퇴 and 파기. Until now they had **no implementation
  // behind them** — the worst kind of clause, because the user cannot discover it is empty.
  //
  // 모든 기록 삭제 does NOT live here: erasing your records is not leaving the service, and putting the two
  // side by side made the account screen a place where the two heaviest buttons sat together. It moved to
  // 설정, merged with 기록 초기화 — where the records are.
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<null | { keepLocal: boolean }>(null);
  // After 탈퇴 the app MUST restart: `purgeFirestoreCache()` terminates the Firestore instance to throw away
  // any upload it still had queued, and a terminated instance cannot be used again in this process.
  //
  // Which is what we owe the user anyway. The screen used to stay exactly where it was — a login form, with
  // their email still sitting in it, under a message saying the account was gone. **Telling someone they have
  // been erased while still showing them their own name is not a confirmation; it is a contradiction.**
  const [done, setDone] = useState<null | { msg: string; exit: boolean }>(null);

  const withdraw = async (keepLocal: boolean) => {
    setBusy(true);
    try {
      const { failed } = await deleteAccount(keepLocal);
      setConfirmLeave(null);
      setDone({
        msg:
          failed > 0
            ? `탈퇴했어요. ${failed}건은 서버에서 지우지 못했어요.`
            : "탈퇴했어요. 계정과 서버의 기록을 지웠어요.",
        exit: true, // the account is gone; there is nothing here to come back to
      });
    } catch {
      // Firebase refuses `user.delete()` on a stale credential — it wants a recent login. Say so, rather than
      // report a 탈퇴 that did not happen.
      setConfirmLeave(null);
      // Not gone. Do NOT close the app on them — they need to be able to log in again and retry.
      setDone({ msg: "탈퇴하지 못했어요. 다시 로그인한 뒤 바로 시도해 주세요.", exit: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-group">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="mb-4"
        >
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>

        <Text className="text-ink" style={{ fontSize: 26, fontWeight: "700", marginBottom: 6 }}>
          계정
        </Text>
        <Text className="text-grey" style={{ fontSize: 14, lineHeight: 21, marginBottom: 20 }}>
          로그인은 <Text style={{ fontWeight: "700" }}>기기 간 동기화</Text>만 켜요. 로그인하지 않아도 앱의 모든 기능은
          그대로 동작하고, 로그아웃해도 이 기기의 기록은 지워지지 않아요.
        </Text>

        {!available ? (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600", marginBottom: 6 }}>
              이 빌드에서는 동기화를 쓸 수 없어요
            </Text>
            <Text className="text-grey" style={{ fontSize: 13, lineHeight: 20 }}>
              앱은 평소대로 쓰면 돼요. 모든 기록은 이 기기에 안전하게 저장돼요.
            </Text>
          </View>
        ) : account && !deciding ? (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <Text className="text-grey" style={{ fontSize: 12, marginBottom: 4 }}>
              동기화 켜짐
            </Text>
            <Text className="text-ink" style={{ fontSize: 17, fontWeight: "600", marginBottom: 14 }}>
              {account.email ?? kakaoEmail ?? (account.kakao ? "카카오 로그인" : "로그인됨")}
            </Text>
            <Text className="text-grey" style={{ fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
              일정·시간블록·지출·식사가 다른 기기와 자동으로 맞춰져요. 오프라인에서 바꾼 것은 연결되면 올라가요.
            </Text>
            {pending > 0 && (
              // Taupe, not red. Being behind is a fact, not a fault (R14) — but it is a fact the user is owed.
              <Text className="text-miss" style={{ fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
                아직 올라가지 못한 기록 {pending}건 — 연결되면 자동으로 올라가요.
              </Text>
            )}

            {/* 준회원 → 정회원. Only for an email account that has not clicked the link. Google is already verified;
                a verified email needs nothing. Blocks nothing — it names a benefit, in neutral tones. */}
            {!account.google && !account.verified && (
              <View className="bg-group" style={{ borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <Text className="text-ink" style={{ fontSize: 13.5, fontWeight: "600", marginBottom: 4 }}>
                  이메일 인증을 하면 비밀번호를 되찾을 수 있어요
                </Text>
                <Text className="text-grey" style={{ fontSize: 12.5, lineHeight: 19, marginBottom: 12 }}>
                  가입할 때 보낸 메일의 링크를 누르면 인증돼요. 인증하지 않아도 앱은 그대로 쓸 수 있어요.
                </Text>
                {note ? (
                  <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600", marginBottom: 12 }}>
                    {note}
                  </Text>
                ) : null}
                <View className="flex-row">
                  <Pressable
                    onPress={checkVerified}
                    disabled={busy}
                    className="bg-brand items-center"
                    style={{ borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, marginRight: 8, opacity: busy ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>인증했어요</Text>
                  </Pressable>
                  <Pressable
                    onPress={resend}
                    disabled={busy}
                    className="bg-surface items-center"
                    style={{ borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: "#E5E8EB", opacity: busy ? 0.5 : 1 }}
                  >
                    <Text className="text-ink" style={{ fontSize: 13, fontWeight: "600" }}>메일 다시 보내기</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 이메일 주소 변경 — email accounts only (a Google email is Google's; a Kakao email is Kakao's). Collapsed
                until asked for: it is a rare action, and an always-open input next to the account email invites accidents. */}
            {!account.google && !account.kakao && (
              <View style={{ marginBottom: 12 }}>
                {!changingEmail ? (
                  <Pressable
                    onPress={() => {
                      setChangingEmail(true);
                      setEmailNote("");
                    }}
                    hitSlop={{ top: 6, bottom: 6 }}
                  >
                    <Text className="text-grey" style={{ fontSize: 13, textDecorationLine: "underline" }}>
                      이메일 주소 변경
                    </Text>
                  </Pressable>
                ) : (
                  <View className="bg-group" style={{ borderRadius: 12, padding: 14 }}>
                    <Text className="text-ink" style={{ fontSize: 13.5, fontWeight: "600", marginBottom: 8 }}>
                      새 이메일 주소
                    </Text>
                    <TextInput
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="새 이메일"
                      placeholderTextColor="#B0B8C1"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="bg-surface text-ink"
                      style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }}
                    />
                    <Text className="text-grey" style={{ fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                      새 주소로 확인 링크를 보내요. 링크를 눌러야 바뀌고, 기존 주소로도 변경 안내가 가요.
                    </Text>
                    {emailNote ? (
                      <Text className="text-grey" style={{ fontSize: 12.5, fontWeight: "600", marginTop: 8 }}>
                        {emailNote}
                      </Text>
                    ) : null}
                    <View className="flex-row" style={{ marginTop: 12 }}>
                      <Pressable
                        onPress={submitEmailChange}
                        disabled={busy}
                        className="bg-brand items-center"
                        style={{ borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, marginRight: 8, opacity: busy ? 0.5 : 1 }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>확인 링크 보내기</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setChangingEmail(false);
                          setNewEmail("");
                          setEmailNote("");
                        }}
                        disabled={busy}
                        className="items-center justify-center"
                        style={{ paddingVertical: 11, paddingHorizontal: 12 }}
                      >
                        <Text className="text-grey" style={{ fontSize: 13, fontWeight: "600" }}>취소</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
            <Pressable
              onPress={leave}
              disabled={busy}
              className="bg-group items-center"
              style={{ borderRadius: 12, paddingVertical: 14, opacity: busy ? 0.5 : 1 }}
            >
              <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600" }}>
                로그아웃
              </Text>
            </Pressable>

          </View>
        ) : (
          <View className="bg-surface" style={{ borderRadius: 18, padding: 18 }}>
            <View className="flex-row" style={{ marginBottom: 16 }}>
              <Tab label="로그인" on={mode === "signIn"} onPress={() => setMode("signIn")} />
              <Tab label="가입" on={mode === "signUp"} onPress={() => setMode("signUp")} />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              placeholderTextColor="#B0B8C1"
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-group text-ink"
              style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 10 }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호 (6자 이상)"
              placeholderTextColor="#B0B8C1"
              autoCapitalize="none"
              secureTextEntry
              className="bg-group text-ink"
              style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 }}
            />

            {mode === "signUp" && (
              <View style={{ marginTop: 18 }}>
                <Pressable onPress={toggleAll} className="flex-row items-center" style={{ paddingVertical: 6 }}>
                  <Box on={allTicked} />
                  <Text className="text-ink" style={{ fontSize: 14.5, fontWeight: "600", marginLeft: 10 }}>
                    전체 동의
                  </Text>
                </Pressable>

                <View className="bg-group" style={{ height: 1, marginVertical: 6 }} />

                {/* A statement, not a document — nothing to open, so no 보기 link. */}
                <Pressable
                  onPress={() => tick("age")}
                  className="flex-row items-center"
                  style={{ paddingVertical: 6 }}
                  hitSlop={{ top: 6, bottom: 6 }}
                >
                  <Box on={!!ticks.age} />
                  <Text className="text-grey" style={{ fontSize: 12.5, marginLeft: 10, flex: 1 }}>
                    {AGE_CONSENT}
                  </Text>
                </Pressable>

                {/* One line each, and no subtitle. The consent list is not where the document gets explained —
                    that is what the document is for, one tap away behind 보기. Prose piled onto a tick box does
                    not get read; it only makes the box harder to find. */}
                {LEGAL_ORDER.map((key) => (
                  <View key={key} className="flex-row items-center" style={{ paddingVertical: 6 }}>
                    <Pressable
                      onPress={() => tick(key)}
                      className="flex-row items-center"
                      style={{ flex: 1 }}
                      hitSlop={{ top: 6, bottom: 6 }}
                    >
                      <Box on={!!ticks[key]} />
                      <Text
                        numberOfLines={1}
                        className="text-grey"
                        style={{ fontSize: 12.5, marginLeft: 10, flex: 1, paddingRight: 8 }}
                      >
                        {LEGAL_DOCS[key].consent}
                      </Text>
                    </Pressable>
                    {/* You cannot meaningfully agree to something you cannot open. */}
                    <Pressable
                      onPress={() => router.push({ pathname: "/legal/doc", params: { doc: key } })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text className="text-faint" style={{ fontSize: 11.5, textDecorationLine: "underline" }}>
                        보기
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {error ? (
              // **Ink, not grey — and still not red.** A failed login is neutral data (R14: the app does not
              // scold), but a message the user cannot see is not restraint, it is just a dead end: they press
              // 가입, nothing happens, and the reason is whispered in the same grey as the placeholder text.
              <Text className="text-ink" style={{ fontSize: 13.5, fontWeight: "600", marginTop: 12 }}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              className="bg-brand items-center"
              style={{ borderRadius: 12, paddingVertical: 15, marginTop: 16, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                  {mode === "signUp" ? "가입하고 동기화 켜기" : "로그인하고 동기화 켜기"}
                </Text>
              )}
            </Pressable>

            {/* Forgot-password lives only on the 로그인 tab — it is the answer to "I cannot get in". It reads the
                email already typed above; the reset link, once used, is itself the proof of ownership. */}
            {mode === "signIn" && (
              <Pressable
                onPress={forgotPassword}
                disabled={busy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginTop: 14, alignSelf: "center" }}
              >
                <Text className="text-faint" style={{ fontSize: 12, textDecorationLine: "underline" }}>
                  비밀번호를 잊으셨나요?
                </Text>
              </Pressable>
            )}

            {(withGoogle || withKakao) && (
              <>
                <View className="flex-row items-center" style={{ marginVertical: 16 }}>
                  <View className="bg-group" style={{ flex: 1, height: 1 }} />
                  <Text className="text-faint" style={{ fontSize: 12, marginHorizontal: 10 }}>
                    또는
                  </Text>
                  <View className="bg-group" style={{ flex: 1, height: 1 }} />
                </View>

                {withKakao && (
                  <Pressable
                    onPress={kakao}
                    disabled={busy}
                    className="items-center"
                    style={{ borderRadius: 12, paddingVertical: 15, backgroundColor: "#FEE500", opacity: busy ? 0.6 : 1, marginBottom: withGoogle ? 10 : 0 }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#191600" }}>
                      카카오로 계속하기
                    </Text>
                  </Pressable>
                )}

                {withGoogle && (
                  <>
                    <Pressable
                      onPress={() => google(false)}
                      disabled={busy}
                      className="items-center"
                      style={{
                        borderRadius: 12,
                        paddingVertical: 15,
                        borderWidth: 1,
                        borderColor: "#E5E8EB",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <Text className="text-ink" style={{ fontSize: 15, fontWeight: "600" }}>
                        Google로 계속하기
                      </Text>
                    </Pressable>

                    {/* Google remembers the first account and silently reuses it — which is a dead end for someone
                        who owns two and picked the wrong one. This is the way back. */}
                    <Pressable
                      onPress={() => google(true)}
                      disabled={busy}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={{ marginTop: 12, alignSelf: "center" }}
                    >
                      <Text className="text-faint" style={{ fontSize: 11.5, textDecorationLine: "underline" }}>
                        다른 Google 계정으로 로그인
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* **Leaving.** Only 회원 탈퇴 lives here. Erasing your records is a different act — it belongs with the
            records, in 설정 — and side by side the two heaviest buttons in the app made each other easier to
            press by mistake. */}
        {account && (
          <View style={{ marginTop: 24 }}>
            <Pressable onPress={() => setLeaveOpen(true)} disabled={busy} hitSlop={{ top: 6, bottom: 6 }}>
              <Text className="text-grey" style={{ fontSize: 12.5, textDecorationLine: "underline" }}>
                회원 탈퇴
              </Text>
            </Pressable>
            <Text className="text-faint" style={{ fontSize: 11, lineHeight: 17, marginTop: 3 }}>
              계정과 서버의 기록을 지워요. 기기에 저장된 기록을 남길지는 고를 수 있어요.
            </Text>
          </View>
        )}

        {/* The quiet shelf. These have to be *reachable*, not *prominent*: nothing down here helps you do the
            thing at 7am, and the screen's job is sync. Faint, small, at the very bottom — findable when looked
            for, invisible when not. (공지사항 sits with them because the terms promise changes are announced
            there — 제3조 3항.) */}
        <View style={{ marginTop: 36 }}>
          <View className="flex-row flex-wrap items-center">
            {LEGAL_ORDER.map((key, i) => (
              <View key={key} className="flex-row items-center">
                {i > 0 && (
                  <Text className="text-faint" style={{ fontSize: 11, marginHorizontal: 7 }}>
                    ·
                  </Text>
                )}
                <Pressable
                  onPress={() => router.push({ pathname: "/legal/doc", params: { doc: key } })}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                >
                  <Text className="text-faint" style={{ fontSize: 11.5 }}>
                    {LEGAL_DOCS[key].title}
                  </Text>
                </Pressable>
              </View>
            ))}
            <Text className="text-faint" style={{ fontSize: 11, marginHorizontal: 7 }}>
              ·
            </Text>
            <Pressable onPress={() => router.push("/notices")} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
              <Text className="text-faint" style={{ fontSize: 11.5 }}>
                공지사항
              </Text>
            </Pressable>
          </View>

          {/* The standing record: what you agreed to, and when. Only offered once there is something to show. */}
          {alreadyConsented && (
            <Pressable
              onPress={() => router.push("/legal")}
              hitSlop={{ top: 8, bottom: 8 }}
              style={{ marginTop: 14 }}
            >
              <Text className="text-faint" style={{ fontSize: 11.5, textDecorationLine: "underline" }}>
                약관 및 개인정보 처리 동의 내역
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Two steps, on purpose. The first asks the question only the user can answer — **do the records on this
          phone go with the account?** Leaving the service is not the same as giving up what you wrote. The
          second is the one that cannot be undone, and it stands alone so it cannot be reached by momentum. */}
      <Sheet
        visible={leaveOpen}
        title="회원 탈퇴"
        message="계정과 서버에 저장된 기록이 지워져요. 기기에 저장된 기록은 어떻게 할까요?"
        onClose={() => setLeaveOpen(false)}
        actions={[
          {
            label: "기기 기록은 남기기",
            desc: "계정과 서버의 기록만 지워요. 기기에 저장된 기록은 어느 기기에서든 그대로 쓸 수 있어요.",
            onPress: () => {
              setLeaveOpen(false);
              setConfirmLeave({ keepLocal: true });
            },
          },
          {
            label: "기기 기록도 함께 지우기",
            desc: "계정과 서버는 물론, 로그인된 모든 기기의 기록까지 지워요. 다른 기기는 인터넷에 연결되는 순간 지워져요.",
            danger: true,
            onPress: () => {
              setLeaveOpen(false);
              setConfirmLeave({ keepLocal: false });
            },
          },
        ]}
      />

      <ConfirmSheet
        visible={!!confirmLeave}
        title="정말 탈퇴할까요?"
        message={
          confirmLeave?.keepLocal
            ? "계정과 서버의 기록이 지워져요. 기기에 저장된 기록은 남아요. 되돌릴 수 없어요."
            : "계정과 서버의 기록, 그리고 로그인된 모든 기기의 기록까지 지워져요. 되돌릴 수 없어요."
        }
        confirmLabel={busy ? "지우는 중…" : "탈퇴하기"}
        busy={busy}
        onConfirm={() => withdraw(!!confirmLeave?.keepLocal)}
        onClose={() => setConfirmLeave(null)}
      />

      <Sheet
        visible={!!resetInfo}
        title="비밀번호 재설정"
        message={resetInfo ?? undefined}
        onClose={() => setResetInfo(null)}
        actions={[]}
        cancelLabel="확인"
      />

      <Sheet
        visible={!!done}
        title={done?.msg ?? ""}
        message={done?.exit ? "앱을 종료해요. 다시 열면 처음 상태로 시작해요." : undefined}
        onClose={() => (done?.exit ? BackHandler.exitApp() : setDone(null))}
        actions={done?.exit ? [{ label: "앱 종료", onPress: () => BackHandler.exitApp() }] : []}
        cancelLabel={done?.exit ? "앱 종료" : "확인"}
      />
    </SafeAreaView>
  );
}

/** A send that never reached Firebase — so the device budget should be refunded, not charged. */
function isNetwork(err: any): boolean {
  return err?.code === "auth/network-request-failed";
}

/** A tick box. Brand blue when on — an unticked box is a blank, never a warning (nothing here is red). */
function Box({ on }: { on: boolean }) {
  return (
    <View
      className={on ? "bg-brand items-center justify-center" : "bg-group items-center justify-center"}
      style={{ width: 20, height: 20, borderRadius: 6 }}
    >
      {on && <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>✓</Text>}
    </View>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={on ? "bg-brand" : "bg-group"}
      style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18, marginRight: 8 }}
    >
      <Text
        className={on ? "" : "text-grey"}
        style={{ fontSize: 14, fontWeight: "600", color: on ? "#FFFFFF" : undefined }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
