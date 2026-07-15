// Kakao REST-key keep-alive (D95). The Kakao Local (place-search) REST key is exercised only when someone opens
// the gym map/search; a user who never does could let it go unused long enough to risk deactivation. So a
// **signed-in** device pings our Worker on startup, and the **Worker** decides — at most **once per ~month,
// anchored to the account's creation time** — whether to make one throwaway Kakao call that keeps the key warm
// (the response is discarded). Server-side dedup means many devices/launches in a month cause only one real
// call. A signed-out or genuinely-inactive customer never connects, so nothing is wasted.
//
// Privacy: the only thing sent is the account uid + its creation timestamp, to **our own** Worker (an internal
// dedup key). No location, no user content, and nothing reaches Kakao about the user — the keep-alive call uses
// a fixed constant coordinate.

import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentAccount, currentAccountCreatedAt, onAccountChanged } from "./firebase";

const PROXY: string =
  (Constants.expoConfig?.extra as { kakaoProxyUrl?: string } | undefined)?.kakaoProxyUrl ?? "";
const LAST_PING = "lp.kakaoKeepAlive.lastPing.v1";
const DAY = 24 * 60 * 60 * 1000;

/** Fire-and-forget, best-effort. A once/day local throttle avoids pinging the Worker on every launch; the Worker
 *  enforces the actual monthly Kakao call. Never throws. */
async function ping(): Promise<void> {
  try {
    if (!PROXY) return;
    const account = currentAccount();
    const created = currentAccountCreatedAt();
    if (!account || !created) return; // only server-connected (signed-in) devices trigger it
    const last = await AsyncStorage.getItem(LAST_PING);
    if (last && Date.now() - Number(last) < DAY) return; // at most one Worker ping per day
    await AsyncStorage.setItem(LAST_PING, String(Date.now()));
    void fetch(`${PROXY}/keepalive?acct=${encodeURIComponent(account.uid)}&created=${created}`).catch(() => {});
  } catch {
    // keep-alive must never affect startup
  }
}

/** Start the keep-alive: ping whenever an account is (or becomes) signed in. Returns an unsubscribe. */
export function startKakaoKeepAlive(): () => void {
  return onAccountChanged((account) => {
    if (account) void ping();
  });
}
