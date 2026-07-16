// Firebase handles + auth (PRD R4 · F0). The ONLY module that imports @react-native-firebase — everything
// else goes through `sync.ts` or the repositories, so the rest of the app never learns that a cloud exists
// (architecture §7: if a screen imports Firestore, the refactor is wrong).
//
// **The app must work with no account and no Firebase at all** (R4/D20/R11). So every entry point here is
// defensive: the native module is `require`d lazily, and if it is missing (Jest, an Expo Go run, a dev build
// made before the config plugin landed) we degrade to "logged out, local only" instead of crashing the app.
// A missing cloud costs you sync. It must never cost you the lever.

import Constants from "expo-constants";

type Unsubscribe = () => void;

export interface Account {
  uid: string;
  email: string | null;
  /**
   * The email is proven to belong to this user — 정회원. An email/password signup starts `false` (준회원): the
   * account is usable in full, but the address is only *claimed*, not shown to be theirs, until they click the
   * link. **A Google sign-in arrives `true`** — Google already verified it, so there is nothing for us to ask.
   */
  verified: boolean;
  /**
   * Signed in through Google. Their password is Google's, not ours, so we neither ask them to verify an email nor
   * offer to reset a password we do not hold. (D-log: 준회원/정회원, 2026-07-14.)
   */
  google: boolean;
  /**
   * Signed in through Kakao (D99). A custom-token user whose uid is `kakao:<회원번호>`; Kakao verified the
   * identity, so — like Google — they are a 정회원 with no email step, and we hold no password to reset. Their
   * email (if consented) is not a Firebase auth email, so it lives outside `email` here (see kakaoIdentity).
   */
  kakao: boolean;
}

/**
 * A Firebase user → our `Account`. Pure and exported so the membership rule can be tested without the native SDK.
 *
 * The two derived facts ARE the 준회원/정회원 model:
 *   · `verified` = `emailVerified`. Nothing we store — read live from Auth, so it can never drift from the truth.
 *   · `google`   = the user carries the google.com provider. Such a user is `emailVerified` from the start, so the
 *                  same rule that gates 정회원 on `verified` makes every Google user a 정회원 with no extra step.
 */
export function accountFromUser(u: any): Account {
  // A Kakao user (D99) is a custom-token user with uid `kakao:<회원번호>`. Kakao already verified them, so they
  // are a 정회원 (verified) with no email/password of ours — exactly the Google rule, keyed off the uid prefix.
  const kakao = typeof u?.uid === "string" && u.uid.startsWith("kakao:");
  return {
    uid: u.uid,
    email: u.email ?? null,
    verified: !!u.emailVerified || kakao,
    google: Array.isArray(u.providerData) && u.providerData.some((p: any) => p?.providerId === "google.com"),
    kakao,
  };
}

let authMod: any;
let firestoreMod: any;
let unavailable = false;

/** The **web** OAuth client id (`client_type: 3`), injected at build time from `google-services.json` by
 *  `app.config.js` — the Android client id is NOT the one Google Sign-In wants. Empty when the project has no
 *  `google-services.json`, which is how the UI knows to hide the Google button. */
const GOOGLE_WEB_CLIENT_ID: string =
  (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ?? "";

function load(): boolean {
  if (unavailable) return false;
  if (authMod && firestoreMod) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    authMod = require("@react-native-firebase/auth").default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    firestoreMod = require("@react-native-firebase/firestore").default;
    return true;
  } catch {
    unavailable = true; // no native Firebase in this binary — local-only mode
    return false;
  }
}

/** Is a cloud reachable at all in this build? `false` → the app runs local-only, silently and correctly. */
export function firebaseAvailable(): boolean {
  return load();
}

export function db(): any | null {
  return load() ? firestoreMod() : null;
}

/**
 * **Throw away everything Firestore is still holding for us — including writes it has not sent yet.**
 *
 * This exists because of a real, verified data leak. 회원 탈퇴 deleted the account's documents and then the
 * account, and **134 meal rows reappeared on the server anyway** — orphaned under a uid with no user behind it.
 * The cause was not the delete: it was Firestore's **outbox**. Rows this phone had queued for upload flushed
 * *after* the wipe, re-creating what we had just destroyed, and then the account vanished out from under them.
 *
 * A write we already told Firestore to make cannot be recalled — the queue is inside the SDK, not ours. The
 * only way to stop it is to discard the SDK's whole local state: `terminate()` the instance, then
 * `clearPersistence()`. Both are irreversible for this process, which is why the app **restarts** afterwards.
 *
 * *"We deleted your data" must not be a race we sometimes lose.*
 */
export async function purgeFirestoreCache(): Promise<void> {
  if (!load()) return;
  try {
    await firestoreMod().terminate();
    await firestoreMod().clearPersistence();
  } catch {
    // Already terminated, or persistence not enabled — nothing queued that could resurface.
  }
}

/**
 * Mark the account closed, on the server, and **wait for the server to say so**.
 *
 * This is the only part of 탈퇴 that other devices can see. It must not be fire-and-forget: if it never lands,
 * the other phone is free to push the whole account back the moment it reconnects. So it is awaited, and if it
 * fails, 탈퇴 fails — better to tell the user "다시 시도해 주세요" than to destroy an account we cannot keep shut.
 */
/**
 * **Why this is not 개인정보, and why the 처리방침 says nothing about it** (founder, 2026-07-14).
 *
 * 개인정보보호법 제2조 제1호 나목: information that cannot identify a person on its own is still 개인정보 if it
 * can be **easily combined** with other information to identify them. So the question is not "is a uid personal?"
 * — it is **"does any mapping from this uid to a person survive?"**
 *
 * At the moment this record starts to exist, none does, and it was checked rather than assumed:
 *   · the Firestore documents (blocks · devices · expenses · meals · consents) are **already deleted** — and no
 *     document in this app has ever carried an email, on any collection, alive or not;
 *   · the **Firebase Auth user is deleted**, and that is the only place the email ever lived;
 *   · **nothing is sent anywhere but Firebase** — no analytics, no third party, no `fetch` in the codebase.
 *
 * So what remains is `{uid, closedAt, wipeDevices}` with **no path back to a person**: not identifying, not
 * combinable, not 개인정보. **Declaring it in the 처리방침 as retained data would not be caution — it would be
 * telling the user we kept something about them, which is exactly what we did not do.** The 처리방침 therefore
 * says what is true: **모든 개인정보는 탈퇴 시 파기됩니다.**
 */
export async function closeAccount(uid: string, wipeDevices: boolean): Promise<void> {
  const database = db();
  if (!database) return;
  // **`wipeDevices` carries the user's choice to the phones that were not there when they made it.** "기기
  // 기록도 함께 지우기" is a decision about the *account*, but only one handset is in your hand when you take
  // it. The others must hear it — and they can only hear it from here.
  await database
    .collection("users")
    .doc(uid)
    .set({ uid, closedAt: Date.now(), wipeDevices }, { merge: true });
}

export interface AccountClosure {
  closed: boolean;
  /** The user asked for every device's records to go, not just the one they were holding. */
  wipeDevices: boolean;
}

/** Is this account closed? Read from the **server** — a cached "no" is exactly the answer we cannot trust. */
export async function accountClosure(uid: string): Promise<AccountClosure> {
  const database = db();
  if (!database) return { closed: false, wipeDevices: false };
  try {
    const snap = await database.collection("users").doc(uid).get({ source: "server" });
    const data = snap?.data?.();
    return { closed: !!data?.closedAt, wipeDevices: !!data?.wipeDevices };
  } catch {
    return { closed: false, wipeDevices: false }; // offline or refused — never guess an account into oblivion
  }
}

/** The signed-in user, or `null` (logged out **or** no Firebase). Sync is off in both cases. */
export function currentAccount(): Account | null {
  if (!load()) return null;
  const u = authMod().currentUser;
  return u ? accountFromUser(u) : null;
}

/** The signed-in account's creation time in ms (Firebase Auth metadata), or `null` if logged out / unknown.
 *  Used only to anchor the monthly Kakao keep-alive (D95) — not stored anywhere. */
export function currentAccountCreatedAt(): number | null {
  if (!load()) return null;
  const t = authMod().currentUser?.metadata?.creationTime;
  const ms = t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

export function onAccountChanged(fn: (account: Account | null) => void): Unsubscribe {
  if (!load()) {
    fn(null);
    return () => {};
  }
  return authMod().onAuthStateChanged((u: any) => fn(u ? accountFromUser(u) : null));
}

export async function signUp(email: string, password: string): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  const cred = await authMod().createUserWithEmailAndPassword(email.trim(), password);
  // **준회원 from this instant.** The account exists and every feature works; the email is only *claimed*. Send
  // the link that proves it and promotes them to 정회원 — but do not let a failed send fail the signup. Firebase
  // rate-limits these, and an offline signup still has to succeed; 계정 offers "인증 메일 다시 보내기" for both.
  try {
    await cred?.user?.sendEmailVerification();
  } catch {
    // Rate-limited, offline, or a build without email templates — the account still stands. Resend from 계정.
  }
}

/**
 * Re-send the 정회원 link to the signed-in email user. Throws `no-user` if nobody is signed in and lets
 * Firebase's own `auth/too-many-requests` surface — the send is deliberately rate-limited, and saying "잠시 후
 * 다시" is the honest response to it.
 */
export async function resendVerification(): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  const user = authMod().currentUser;
  if (!user) throw new Error("no-user");
  await user.sendEmailVerification();
}

/**
 * Ask Firebase whether the link has been clicked **since we last looked**. `emailVerified` is cached on the
 * client, so a verification done in the browser is invisible until the user object is `reload()`ed. Returns the
 * freshened account (or null) so the screen can update without waiting for an auth-state event that may not fire
 * for a mere verification flip.
 */
export async function refreshVerification(): Promise<Account | null> {
  if (!load()) return null;
  const user = authMod().currentUser;
  if (!user) return null;
  try {
    await user.reload();
  } catch {
    // Offline — the cached value is the best we have; report it rather than guess.
  }
  const fresh = authMod().currentUser;
  return fresh ? accountFromUser(fresh) : null;
}

/**
 * Change the account's email — the safe way, and the only way that cannot lock a user out.
 *
 * `verifyBeforeUpdateEmail` sends a confirmation link to the **new** address and swaps the email only once that
 * link is clicked. So a typo cannot strand the account on an inbox nobody owns, and someone who briefly holds the
 * session cannot silently move the account to their own inbox. Firebase **also notifies the old address** that a
 * change was requested — the security alert the founder expected.
 *
 * Firebase requires a *recent* login for this; a stale session throws `auth/requires-recent-login`, which the
 * screen turns into "다시 로그인한 뒤 시도해 주세요" rather than a dead end.
 */
export async function changeEmail(newEmail: string): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  const user = authMod().currentUser;
  if (!user) throw new Error("no-user");
  await user.verifyBeforeUpdateEmail(newEmail.trim());
}

/**
 * Send a password-reset link to an email address. **This is a logged-OUT action** — you use it precisely because
 * you cannot sign in — so we cannot read the account's 정회원 status here, and Firebase's email-enumeration
 * protection will not tell us either. That is fine, and it is *why the model holds*: the link goes only to that
 * inbox, and **completing the reset requires reading it — which is the same proof that makes someone 정회원.** A
 * 준회원 who resets their password has, by that act, shown the address is theirs.
 *
 * Google accounts are not served here (their password is Google's) — the calling screen says so in plain Korean.
 * Firebase rate-limits the send; `auth/too-many-requests` surfaces through `authErrorMessage`.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  await authMod().sendPasswordResetEmail(email.trim());
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  await authMod().signInWithEmailAndPassword(email.trim(), password);
}

// ── Google sign-in (D12, revised 2026-07-13: Google is now a first-class option, not "later") ────────────

let googleMod: any;

function loadGoogle(): boolean {
  if (!GOOGLE_WEB_CLIENT_ID || !load()) return false;
  if (googleMod) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    googleMod = require("@react-native-google-signin/google-signin").GoogleSignin;
    googleMod.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    return true;
  } catch {
    googleMod = undefined;
    return false;
  }
}

/** Can this build offer "Google로 계속하기"? `false` → the account screen shows only email/password. */
export function googleAvailable(): boolean {
  return loadGoogle();
}

/**
 * Google → a Firebase credential → the same `uid` machinery as email/password. Nothing downstream cares which
 * door the user came through: sync keys off `uid` alone.
 */
/**
 * Sign in with Google. **Returns whether this call CREATED the account**, which cannot be known before the
 * fact: one button serves both login and signup, and Firebase only tells us afterwards (`isNewUser`).
 *
 * That asymmetry is why the caller must ask. Gating the button on consent up front made the 로그인 tab demand
 * tick boxes from someone who already has an account — consent they gave when they signed up. **Asking again
 * for a consent already held is not caution; it is a wall in front of a door the user already owns.**
 */
export async function signInWithGoogle(chooseAccount = false): Promise<{ isNewUser: boolean }> {
  if (!loadGoogle()) throw new Error("cloud-unavailable");
  await googleMod.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // **Let them pick a different Google account.** After the first sign-in, Google remembers the choice and
  // silently reuses it — good for getting back in, and a dead end for someone who owns two accounts and picked
  // the wrong one. Signing out of the Google client (not of Firebase) is what brings the chooser back.
  if (chooseAccount) {
    try {
      await googleMod.signOut();
    } catch {
      // nothing cached to forget — the chooser will appear anyway
    }
  }

  const result = await googleMod.signIn();
  // v13+ returns {type, data}; older builds returned the user object flat. Accept both.
  const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;
  if (!idToken) throw new Error("auth/cancelled"); // the user backed out — not an error to shout about

  // **Both tokens, not just the id token.** `GoogleAuthProvider.credential(idToken)` alone threw
  // `auth/unknown: accessToken cannot be empty` — React Native Firebase's native binding requires the OAuth
  // access token too, and `signIn()`'s payload does not carry one. `getTokens()` does.
  //
  // This cost hours, because the failure *looked* like a configuration problem: the sign-in sheet appeared,
  // Google accepted the account, and only then did Firebase refuse — so we went and re-verified the SHA-1
  // against the actual APK signature, the web client id, the enabled providers. All were correct. It was one
  // missing argument, hidden behind a caught error that said only "로그인에 실패했어요". The lesson is the
  // error message, not the argument: **an error that says nothing costs more than one that looks technical.**
  const { accessToken } = await googleMod.getTokens();
  const authNs = require("@react-native-firebase/auth");
  const cred = await authMod().signInWithCredential(
    authNs.default.GoogleAuthProvider.credential(idToken, accessToken)
  );
  return { isNewUser: !!cred?.additionalUserInfo?.isNewUser };
}

// ── Kakao login (D99) ────────────────────────────────────────────────────────
// Kakao is not a Firebase-native provider, so the Cloudflare Worker mints a Firebase **custom token** (uid
// `kakao:<회원번호>`) after the OAuth code exchange; the app just signs in with it. The whole browser dance runs
// inside the app's WebView (app/kakao-login.tsx) so the REST key never ships in the APK (D93). This function is
// only the last step: swap the Worker's token for a Firebase session.

const KAKAO_PROXY: string =
  (Constants.expoConfig?.extra as { kakaoProxyUrl?: string } | undefined)?.kakaoProxyUrl ?? "";

/** Kakao login is offered only when Firebase is present AND a Worker proxy URL is configured. */
export function kakaoLoginAvailable(): boolean {
  return load() && KAKAO_PROXY.length > 0;
}

/** The Worker URL the login WebView opens; it 302-redirects to Kakao's consent page. `state` binds the session. */
export function kakaoLoginUrl(state: string): string {
  return `${KAKAO_PROXY}/kakao/login?state=${encodeURIComponent(state)}`;
}

/** Sign in with the Firebase custom token the Worker handed back. `isNewUser` drives the same consent asymmetry
 *  as Google: one button is both login and signup, and Firebase only says which afterward. */
export async function signInWithKakaoToken(token: string): Promise<{ isNewUser: boolean; uid: string }> {
  if (!load()) throw new Error("cloud-unavailable");
  const cred = await authMod().signInWithCustomToken(token);
  return { isNewUser: !!cred?.additionalUserInfo?.isNewUser, uid: cred?.user?.uid ?? "" };
}

/**
 * Undo an account that should never have been created — a Google signup with no consent behind it. The user
 * is deleted, not merely signed out: **an account we refused to accept must not be left standing on the
 * server**, or the next login would silently find it and treat it as consented-to long ago.
 */
export async function deleteCurrentUser(): Promise<void> {
  const user = authMod().currentUser;
  if (!user) return;
  // **This throws when it fails, and that is the point.** It used to swallow the error and sign out instead —
  // which is fine for undoing an empty signup, and a lie for 회원 탈퇴: the account would still exist while the
  // app told the user it was gone. Firebase refuses `delete()` on a stale credential (it wants a recent login),
  // so the caller must be able to say so.
  await user.delete();
}

/** Undo a signup we refused: delete it if we can, and at minimum leave nothing signed in on this phone. */
export async function discardCurrentUser(): Promise<void> {
  try {
    await deleteCurrentUser();
  } catch {
    // The account is empty — the consent gate held sync, so nothing of the user's ever reached it.
    await authMod().signOut();
  }
}

/** Logout stops sync but **keeps every local row** (D20) — the app carries on exactly as it did before login.
 *  Google's own session is cleared too, or the next "Google로 계속하기" would silently reuse the old account. */
export async function signOut(): Promise<void> {
  if (!load()) return;
  if (loadGoogle()) {
    try {
      await googleMod.signOut();
    } catch {
      /* no Google session to clear */
    }
  }
  await authMod().signOut();
}

/**
 * Firebase's own error codes are English and blunt ("The password is invalid..."). The app speaks Korean and
 * never scolds (B2/R14) — an auth failure is a fact, not a fault.
 */
export function authErrorMessage(err: any): string {
  // Backing out of the Google sheet is a choice, not a failure — say nothing.
  if (err?.message === "auth/cancelled" || err?.code === "SIGN_IN_CANCELLED" || err?.code === "-5") return "";

  // The generic fallback below was hiding the one thing we needed: WHICH failure this was. Google sign-in kept
  // failing with a message that said nothing, so we kept guessing at the cause. An error the user can read
  // back to us is worth more than a tidy one — the copy stays calm, the code rides along.
  // eslint-disable-next-line no-console
  console.warn("[auth] sign-in failed:", err?.code, err?.message, JSON.stringify(err ?? {}));

  switch (err?.code) {
    case "auth/account-exists-with-different-credential":
      return "이 이메일은 이미 다른 방법으로 가입돼 있어요. 이메일·비밀번호로 로그인해 주세요.";
    case "auth/operation-not-allowed":
      return "이 로그인 방식이 아직 켜져 있지 않아요.";
    case "auth/invalid-email":
      return "이메일 형식이 아니에요.";
    case "auth/email-already-in-use":
      return "이미 가입된 이메일이에요. 로그인해 주세요.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 해요.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "이메일 또는 비밀번호가 맞지 않아요.";
    case "auth/requires-recent-login":
      // The session is too old for a sensitive change (email / delete). Re-authenticating is the fix.
      return "보안을 위해 로그아웃한 뒤 다시 로그인하고 시도해 주세요.";
    case "auth/network-request-failed":
      return "네트워크에 연결되지 않았어요. 잠시 후 다시 시도해 주세요.";
    case "auth/too-many-requests":
      // Firebase's own **global** send limit — not the user's fault, and the honest thing is to say the mail
      // could not be sent right now, not to imply they did something wrong. (founder: 한도 초과 대비 안내 문구.)
      return "지금은 메일을 보낼 수 없어요. 인증 메일 발송이 잠시 제한됐어요. 잠시 후 다시 시도해 주세요.";
    default:
      // No code, or one we do not recognise — treat it as "Firebase did not answer cleanly" and guide rather
      // than dead-end. Show the code so a real report carries the one fact we would need. (founder: 응답이 제대로
      // 오지 않을 때 안내.)
      return `요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.${err?.code ? `\n(${err.code})` : ""}`;
  }
}
