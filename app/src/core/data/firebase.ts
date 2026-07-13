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
export async function signInWithGoogle(): Promise<void> {
  if (!loadGoogle()) throw new Error("cloud-unavailable");
  await googleMod.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await googleMod.signIn();
  // v13+ returns {type, data}; older builds returned the user object flat. Accept both.
  const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;
  if (!idToken) throw new Error("auth/cancelled"); // the user backed out — not an error to shout about
  const authNs = require("@react-native-firebase/auth");
  await authMod().signInWithCredential(authNs.default.GoogleAuthProvider.credential(idToken));
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
  switch (err?.code) {
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
      return "로그인에 실패했어요. 앱은 그대로 쓸 수 있어요.";
  }
}
