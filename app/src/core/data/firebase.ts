// Firebase handles + auth (PRD R4 · F0). The ONLY module that imports @react-native-firebase — everything
// else goes through `sync.ts` or the repositories, so the rest of the app never learns that a cloud exists
// (architecture §7: if a screen imports Firestore, the refactor is wrong).
//
// **The app must work with no account and no Firebase at all** (R4/D20/R11). So every entry point here is
// defensive: the native module is `require`d lazily, and if it is missing (Jest, an Expo Go run, a dev build
// made before the config plugin landed) we degrade to "logged out, local only" instead of crashing the app.
// A missing cloud costs you sync. It must never cost you the lever.

type Unsubscribe = () => void;

export interface Account {
  uid: string;
  email: string | null;
}

let authMod: any;
let firestoreMod: any;
let unavailable = false;

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

/** Logout stops sync but **keeps every local row** (D20) — the app carries on exactly as it did before login. */
export async function signOut(): Promise<void> {
  if (!load()) return;
  await authMod().signOut();
}

/**
 * Firebase's own error codes are English and blunt ("The password is invalid..."). The app speaks Korean and
 * never scolds (B2/R14) — an auth failure is a fact, not a fault.
 */
export function authErrorMessage(err: any): string {
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
