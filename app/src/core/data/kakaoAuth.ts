// Kakao login glue (D99). Uses the **native Kakao SDK** — `login()` tries KakaoTalk app login first (the
// founder's requirement) and falls back to 카카오계정 login on its own, handling the app-to-app deep-link return
// natively. (A browser Custom Tab could show "카카오톡으로 로그인" but the session died on the app-switch, so the
// KakaoTalk path never completed.) The SDK gives us a Kakao **access token**; we hand it to the Worker's
// `/kakao/mint`, which verifies it, reads the 회원번호 + email, and mints a Firebase custom token — the SA key
// stays on the Worker.
//
// Also here: the on-device Kakao email store. The email is not a Firebase auth email — it comes back from the
// Worker at login and, if the user consented, is kept **on-device only** (per uid) for the account screen. It
// is never synced (the sync key is the uid) and is wiped by 회원 탈퇴 (erase clears every lp.* key).

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { login as kakaoSdkLogin } from "@react-native-seoul/kakao-login";

export type KakaoResult = { token?: string; email?: string; error?: string; cancelled?: boolean };

const PROXY: string =
  (Constants.expoConfig?.extra as { kakaoProxyUrl?: string } | undefined)?.kakaoProxyUrl ?? "";

/**
 * Run the native Kakao login (KakaoTalk-first, account fallback) and swap the Kakao access token for a Firebase
 * custom token via the Worker. Cancelling the sheet → `{cancelled:true}` (the SDK throws on cancel).
 */
export async function openKakaoLogin(): Promise<KakaoResult> {
  let accessToken: string;
  try {
    const token = await kakaoSdkLogin();
    accessToken = token.accessToken;
  } catch {
    // The user backed out (or KakaoTalk returned an error) — not something to shout about.
    return { cancelled: true };
  }
  if (!accessToken) return { cancelled: true };
  try {
    const res = await fetch(`${PROXY}/kakao/mint`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { error: `mint_${res.status}` };
    const d = (await res.json()) as KakaoResult;
    if (d.error || !d.token) return { error: d.error || "no_token" };
    return { token: d.token, email: d.email };
  } catch {
    return { error: "network" };
  }
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
