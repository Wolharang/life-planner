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
function kakaoNativeKey() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "kakao.json"), "utf8")).nativeAppKey || "";
  } catch {
    return "";
  }
}

module.exports = ({ config }) => {
  const kakaoKey = kakaoNativeKey();
  const plugins = [...(config.plugins ?? [])];
  // Kakao native SDK login (D99): app-to-app KakaoTalk login (the reliable path — a browser Custom Tab dies on
  // the KakaoTalk app-switch). Wired only when the native key is present; absent → the button is hidden anyway
  // (kakaoLoginAvailable also needs the proxy) and the build still succeeds. kotlinVersion MUST match the project
  // (1.9.25) — the plugin's default 1.5.10 would downgrade and break the Expo 52 build.
  if (kakaoKey) {
    plugins.push(["@react-native-seoul/kakao-login", { kakaoAppKey: kakaoKey, kotlinVersion: "1.9.25" }]);
  }
  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      googleWebClientId: googleWebClientId(),
      // Only the **native map key** is shipped — it is key-hash protected (useless without our keystore), the
      // standard Kakao model. It also drives Kakao login (D99). The **REST (place-search) key is NOT** bundled
      // (D93): it is not key-hash protected, so a public APK would leak it. Place search + the Kakao-login token
      // mint go through the Cloudflare Worker (`kakaoProxyUrl`), which holds the REST/SA keys as secrets.
      kakaoNativeAppKey: kakaoKey,
    },
  };
};
