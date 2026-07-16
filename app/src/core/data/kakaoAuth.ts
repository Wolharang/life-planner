// Kakao login glue (D99). The OAuth dance runs in a **Chrome Custom Tab** (a real browser), NOT a WebView —
// Kakao hides "카카오톡으로 로그인" inside plain WebViews for security, so a WebView only ever showed the
// account-password screen. A real browser offers KakaoTalk app login first (auto sign-in when the app is
// installed) and falls back to the 카카오계정 login on its own. The Worker's /kakao/callback finishes the
// exchange and redirects to `lifeplanner://kakao-auth?data=...`, which openAuthSessionAsync catches.
//
// Also here: the on-device Kakao email store. The email is not a Firebase auth email — it arrives from the
// Worker at login and, if the user consented, is kept **on-device only** (per uid) for the account screen. It
// is never synced (the sync key is the uid) and is wiped by 회원 탈퇴 (erase clears every lp.* key).

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { kakaoLoginUrl } from "./firebase";

export type KakaoResult = { token?: string; email?: string; error?: string; cancelled?: boolean };

/** The app's return scheme; the Worker redirects here with `?data=<json>` when it isn't inside a WebView. */
const RETURN_URL = "lifeplanner://kakao-auth";

/**
 * Open the Kakao login in a Custom Tab and resolve with the result. `state` binds the session (not
 * security-critical — the token is minted server-side and single-use). Cancelled/dismissed → `{cancelled:true}`.
 */
export async function openKakaoLogin(): Promise<KakaoResult> {
  const state = `s${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let res: WebBrowser.WebBrowserAuthSessionResult;
  try {
    res = await WebBrowser.openAuthSessionAsync(kakaoLoginUrl(state), RETURN_URL);
  } catch {
    return { error: "browser" };
  }
  if (res.type !== "success" || !("url" in res) || !res.url) return { cancelled: true };
  const data = Linking.parse(res.url).queryParams?.data;
  if (typeof data !== "string") return { error: "no_data" };
  try {
    return JSON.parse(data) as KakaoResult;
  } catch {
    return { error: "parse" };
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
