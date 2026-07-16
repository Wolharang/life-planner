// Kakao login glue (D99). Two small things the WebView login screen (app/kakao-login.tsx) and the account screen
// share, kept out of firebase.ts (which stays the sole Firebase module) and the UI:
//
//  1. A one-shot bridge so the pushed WebView screen can hand its result back to the account screen, which owns
//     the consent/discard logic (identical to Google's). expo-router push returns nothing, so account.tsx does
//     `const r = awaitKakaoResult(); router.push("/kakao-login"); await r`.
//  2. The Kakao email store. The email is NOT a Firebase auth email — it arrives from the Worker at login and, if
//     the user consented to email sharing, is kept **on-device only** (per uid) for display on the account
//     screen. It is never synced (the sync key is the uid) and is wiped by 회원 탈퇴 (erase clears every lp.* key).

import AsyncStorage from "@react-native-async-storage/async-storage";

export type KakaoResult = { token?: string; email?: string; error?: string; cancelled?: boolean };

let resolver: ((r: KakaoResult) => void) | null = null;

/** Called by the account screen right before it pushes the WebView screen. */
export function awaitKakaoResult(): Promise<KakaoResult> {
  return new Promise((res) => {
    resolver = res;
  });
}

/** Called by the WebView screen when it has a token / error / the user cancelled. */
export function resolveKakaoResult(r: KakaoResult): void {
  const fn = resolver;
  resolver = null;
  fn?.(r);
}

const EMAIL_KEY = "lp.auth.kakaoEmail.v1"; // { [uid]: email }

async function readAll(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(EMAIL_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setKakaoEmail(uid: string, email: string | null): Promise<void> {
  const all = await readAll();
  if (email) all[uid] = email;
  else delete all[uid];
  await AsyncStorage.setItem(EMAIL_KEY, JSON.stringify(all));
}

export async function getKakaoEmail(uid: string): Promise<string | null> {
  return (await readAll())[uid] ?? null;
}
