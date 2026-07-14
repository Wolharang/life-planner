// Expo config. Everything static lives in app.json; this file exists for ONE dynamic value.
//
// Google Sign-In needs the **web** OAuth client id (`client_type: 3`) — the Android client id is not the one
// you pass to `GoogleSignin.configure`. That id already lives in `google-services.json`, which is deliberately
// **gitignored** (it carries this project's identifiers). Hardcoding the id into a tracked source file would
// leak back into git exactly what we kept out of it, so we read it from that file at build time instead.
//
// If the file is absent (a fresh clone, CI, a founder who hasn't downloaded it yet), `googleWebClientId` is
// empty and the app simply hides the Google button and offers email/password. A missing cloud config must
// never break the build — and it must never break the lever.

const fs = require("fs");
const path = require("path");

function googleWebClientId() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "google-services.json"), "utf8");
    for (const client of JSON.parse(raw).client ?? []) {
      for (const oauth of client.oauth_client ?? []) {
        if (oauth.client_type === 3) return oauth.client_id; // 3 = web
      }
    }
  } catch {
    /* no google-services.json → local-only build */
  }
  return "";
}

// The Kakao **native app key** for the map SDK. Like the Google id above it is a public identifier (protected by
// the console's package-name + key-hash registration, not a secret), but it is a project identifier, so it lives
// in the **gitignored** `kakao.json` rather than tracked source. Absent → the app falls back to the OSM map.
function kakaoKeys() {
  try {
    const k = JSON.parse(fs.readFileSync(path.join(__dirname, "kakao.json"), "utf8"));
    return { nativeAppKey: k.nativeAppKey || "", restApiKey: k.restApiKey || "" };
  } catch {
    return { nativeAppKey: "", restApiKey: "" };
  }
}

module.exports = ({ config }) => {
  const kakao = kakaoKeys();
  return {
    ...config,
    extra: {
      ...config.extra,
      googleWebClientId: googleWebClientId(),
      kakaoNativeAppKey: kakao.nativeAppKey,
      // The Local (place-search) REST key. Unlike the native key it is NOT protected by a key-hash — embedded in
      // a client it is extractable — so it rides Kakao's free search quota and is fine for personal use, but it
      // is a real key: keep it in gitignored kakao.json, never tracked source.
      kakaoRestApiKey: kakao.restApiKey,
    },
  };
};
