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

/** The signed-in user, or `null` (logged out **or** no Firebase). Sync is off in both cases. */
export function currentAccount(): Account | null {
  if (!load()) return null;
  const u = authMod().currentUser;
  return u ? { uid: u.uid, email: u.email ?? null } : null;
}

export function onAccountChanged(fn: (account: Account | null) => void): Unsubscribe {
  if (!load()) {
    fn(null);
    return () => {};
  }
  return authMod().onAuthStateChanged((u: any) =>
    fn(u ? { uid: u.uid, email: u.email ?? null } : null),
  );
}

export async function signUp(email: string, password: string): Promise<void> {
  if (!load()) throw new Error("cloud-unavailable");
  await authMod().createUserWithEmailAndPassword(email.trim(), password);
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
export async function signInWithGoogle(): Promise<{ isNewUser: boolean }> {
  if (!loadGoogle()) throw new Error("cloud-unavailable");
  await googleMod.hasPlayServices({ showPlayServicesUpdateDialog: true });

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

/**
 * Undo an account that should never have been created — a Google signup with no consent behind it. The user
 * is deleted, not merely signed out: **an account we refused to accept must not be left standing on the
 * server**, or the next login would silently find it and treat it as consented-to long ago.
 */
export async function deleteCurrentUser(): Promise<void> {
  const user = authMod().currentUser;
  if (!user) return;
  try {
    await user.delete();
  } catch {
    // Deletion can be refused (stale credential). Signing out at least leaves nothing usable on this device;
    // the empty account carries no data, because the consent gate ran before sync ever started.
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
    case "auth/network-request-failed":
      return "네트워크에 연결되지 않았어요. 앱은 그대로 쓸 수 있어요.";
    case "auth/too-many-requests":
      return "잠시 후에 다시 시도해 주세요.";
    default:
      // Show the code. A message that says nothing costs more than one that looks technical.
      return `로그인에 실패했어요. 앱은 그대로 쓸 수 있어요.${err?.code ? `\n(${err.code})` : ""}`;
  }
}
