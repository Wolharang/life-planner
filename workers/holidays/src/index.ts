// Cloudflare Worker — Korean holiday sync (D89). Free tier is ample.
//
// · **Cron Trigger** (scheduled handler): pulls the Kakao holidays API for MONTHS months (one <=31-day call per
//   month, per the API limit), keeps only holiday==true, expands multi-day events, and stores a
//   `{version, days}` doc in KV — but only when the map actually changed (version++ on change).
// · **fetch handler**: serves that doc to devices as public JSON, with an ETag so an unchanged table returns
//   304 (no body). No key is ever exposed — the admin key lives only as the `KAKAO_ADMIN_KEY` Wrangler secret.
//
// **Why MONTHS = 45, not 60**: the free plan caps a single invocation at **50 subrequests** (fetch + KV), and
// Cloudflare **forbids a Worker from fetching itself** (error 1042), so batch-chaining across self-calls is out.
// 45 monthly Kakao calls + 2 KV ops stays safely under 50, and ~3.75 years forward is plenty for a calendar.
//
// Why a Worker and not Firebase Cloud Functions: Functions need the paid Blaze plan; Workers Cron is free.

export interface Env {
  KAKAO_ADMIN_KEY: string; // wrangler secret put KAKAO_ADMIN_KEY  (kapi holidays)
  KAKAO_REST_KEY: string; //  wrangler secret put KAKAO_REST_KEY   (dapi Local place-search proxy, D93 + Kakao login, D99)
  REFRESH_TOKEN: string; //   wrangler secret put REFRESH_TOKEN    (guards /refresh)
  // Kakao Login (D99): the Firebase service-account JSON (the whole file, as a string). Used ONLY to sign a
  // Firebase custom token so a Kakao user gets a Firebase uid and the existing sync just works. This is the
  // "server" that Firebase Spark (no Cloud Functions) never had. Set with `wrangler secret put FIREBASE_SA`.
  FIREBASE_SA?: string;
  // Optional — only if "보안 → Client Secret" is enabled in the Kakao app. `wrangler secret put KAKAO_CLIENT_SECRET`.
  KAKAO_CLIENT_SECRET?: string;
  HOLIDAYS: KVNamespace;
}

// Kakao Local (place search / reverse-geocode) proxy (D93): the app calls these two paths instead of
// dapi.kakao.com directly, so the **REST key never ships in the APK** (it would be extractable — it is NOT
// protected by a key-hash the way the native map key is). Only these two fixed endpoints are relayed — this is
// not an open proxy — and nothing is stored or logged (the query + map-centre pass straight through to Kakao).
const KAKAO_LOCAL: Record<string, string> = {
  "/kakao/keyword": "https://dapi.kakao.com/v2/local/search/keyword.json",
  "/kakao/coord2region": "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json",
};

const MONTHS = 45;
const KEY = "holidays"; // single KV doc: { version, days }
const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z"; // RFC3339 UTC, no millis

/** MONTHS one-month [from, to) windows from the current UTC month. `to` = next month day 1 → <= 31 days. */
function monthWindows(count: number): { from: string; to: string }[] {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  const out: { from: string; to: string }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))) });
    if (++m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/** All dates in [start, end) — a 3-day 설날 event expands to its three days; a 1-day event stays one. */
function expand(start: string, end: string): string[] {
  if (!end || end <= start) return [start];
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d < e) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.length ? out : [start];
}

const sortObj = (o: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

async function fetchMonth(w: { from: string; to: string }, adminKey: string): Promise<any[]> {
  const url = `https://kapi.kakao.com/v2/api/calendar/holidays?from=${encodeURIComponent(w.from)}&to=${encodeURIComponent(w.to)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${adminKey}` } });
  if (!res.ok) throw new Error(`Kakao ${res.status}: ${await res.text()}`);
  return (await res.json()).events ?? [];
}

async function refresh(env: Env): Promise<{ version: number; count: number; changed: boolean }> {
  const days: Record<string, string> = {};
  for (const w of monthWindows(MONTHS)) {
    for (const e of await fetchMonth(w, env.KAKAO_ADMIN_KEY)) {
      if (!e.holiday) continue; // red days only (기념일 like 국군의날 are holiday:false)
      const start = String(e.time?.start_at ?? "").slice(0, 10);
      if (!start) continue;
      for (const d of expand(start, String(e.time?.end_at ?? "").slice(0, 10))) days[d] = e.title;
    }
  }
  const sorted = sortObj(days);
  const count = Object.keys(sorted).length;

  // **Sanity guard against bad API data.** Korea has ~15–20 red days/year → a healthy 45-month pull is ~55–90
  // dates. If a glitch returns something implausible (e.g. every day flagged a holiday, or an empty/partial
  // response), REJECT it: throw before writing, so the last-good KV is untouched and the table can never get
  // stuck on garbage. The next run (or the device's bundled 2015–2040 table) keeps things correct meanwhile.
  if (count < 30 || count > 300) {
    throw new Error(`Sanity check failed: ${count} holidays (expected ~55–90) — refusing to overwrite.`);
  }

  const prevRaw = await env.HOLIDAYS.get(KEY);
  const prev = prevRaw ? JSON.parse(prevRaw) : { version: 0, days: {} };
  if (JSON.stringify(sortObj(prev.days ?? {})) === JSON.stringify(sorted)) {
    return { version: prev.version ?? 0, count, changed: false };
  }
  const version = (prev.version ?? 0) + 1;
  await env.HOLIDAYS.put(KEY, JSON.stringify({ version, days: sorted }));
  return { version, count, changed: true };
}

// ── Kakao Login → Firebase custom token (D99) ───────────────────────────────────────────────────────────────
// A Kakao user is not a Firebase-native provider, so we mint a Firebase **custom token** (a JWT signed with the
// project's service-account private key). Firebase accepts it because the signature verifies against that SA's
// public key. All free: the Worker is the "server" Firebase Spark lacks. The REST key never leaves the Worker —
// the app's WebView loads `/kakao/login` here, we redirect to Kakao, and Kakao redirects back to `/kakao/callback`.

const b64url = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlStr = (s: string): string => b64url(new TextEncoder().encode(s));

/** Import a PEM PKCS#8 RSA private key (the SA `private_key`, with real or escaped newlines) for RS256 signing. */
async function importRsaKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/** Sign a Firebase custom token for `uid` with optional additional claims. Valid 1h; single sign-in. */
async function firebaseCustomToken(saJson: string, uid: string, claims: Record<string, unknown>): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  };
  const signingInput = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(payload))}`;
  const key = await importRsaKey(sa.private_key);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

/** Hand a result back to the app's WebView via postMessage (falls back to a custom-scheme redirect if opened in a
 *  plain browser). `data` is `{ token, email }` on success or `{ error }` on failure. */
function kakaoResult(data: Record<string, unknown>): Response {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const body =
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#8B95A1;text-align:center;padding-top:40px">` +
    `<script>(function(){var d=${json};` +
    `if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(d));return;}` +
    `try{location.replace("lifeplanner://kakao-auth?data="+encodeURIComponent(JSON.stringify(d)));}catch(e){}})();</script>` +
    `로그인 처리 중…</body>`;
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export default {
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Manual populate/refresh: /refresh?key=<REFRESH_TOKEN>. Guarded. Errors return JSON (e.g. a Kakao 401/403)
    // instead of a bare Cloudflare 1101.
    if (url.pathname === "/refresh") {
      if (url.searchParams.get("key") !== env.REFRESH_TOKEN) return new Response("forbidden", { status: 403 });
      try {
        return Response.json(await refresh(env));
      } catch (e) {
        return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
          status: 502,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    // Kakao REST-key keep-alive (D95): a signed-in device pings this. If this account has NOT kept the key warm
    // in the current ~30-day period (anchored to its creation time), make ONE throwaway Kakao Local call with a
    // fixed constant coordinate and record the period in KV. Otherwise no-op. The response is discarded — the
    // point is only that the key was exercised, so it isn't deactivated for disuse. Server-side dedup means many
    // devices/launches in a month cause exactly one real call.
    if (url.pathname === "/keepalive") {
      const acct = url.searchParams.get("acct") ?? "";
      const created = Number(url.searchParams.get("created") ?? "0");
      // no-store: this must always execute the Worker (KV dedup governs the real Kakao call) — a cached response
      // would silently skip the monthly call and defeat the whole point.
      const cors = { "access-control-allow-origin": "*", "cache-control": "no-store" };
      if (!acct || !Number.isFinite(created) || created <= 0) {
        return Response.json({ ok: false, reason: "bad-params" }, { headers: cors });
      }
      const period = Math.floor((Date.now() - created) / (30 * 24 * 60 * 60 * 1000)); // ~monthly bucket
      const kvKey = `ka:${acct}`;
      const last = await env.HOLIDAYS.get(kvKey);
      if (last != null && Number(last) >= period) {
        return Response.json({ ok: true, fired: false }, { headers: cors });
      }
      let fired = false;
      try {
        const r = await fetch("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=126.9779&y=37.5663", {
          headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` },
        });
        fired = r.ok; // discard the body — we only needed the call to happen
      } catch {
        // transient failure — leave KV unchanged so the next ping retries this period
      }
      if (fired) await env.HOLIDAYS.put(kvKey, String(period));
      return Response.json({ ok: true, fired }, { headers: cors });
    }

    // Kakao Login step 1 (D99): the app's WebView opens this; we redirect to Kakao's consent page with the
    // server-held REST key as client_id (so the key never ships in the APK). `scope=account_email` requests the
    // email consent item. `redirect_uri` is our own /kakao/callback (must be registered in the Kakao console).
    if (url.pathname === "/kakao/login") {
      const auth = new URL("https://kauth.kakao.com/oauth/authorize");
      auth.searchParams.set("client_id", env.KAKAO_REST_KEY);
      auth.searchParams.set("redirect_uri", `${url.origin}/kakao/callback`);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "account_email");
      const state = url.searchParams.get("state");
      if (state) auth.searchParams.set("state", state);
      return Response.redirect(auth.toString(), 302);
    }

    // Kakao Login via the **native SDK** (D99): the app already holds a Kakao access token, so it POSTs it here
    // (Authorization: Bearer <kakao access token>) and we skip the code exchange. We still verify the token by
    // calling Kakao ourselves — never trust an id the client claims — then mint the Firebase custom token. (RN's
    // fetch is not a browser, so no CORS/preflight applies; the SA key never leaves the Worker.)
    if (url.pathname === "/kakao/mint") {
      if (req.method !== "POST") return Response.json({ error: "method" }, { status: 405 });
      if (!env.FIREBASE_SA) return Response.json({ error: "server_not_configured" }, { status: 500 });
      const accessToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!accessToken) return Response.json({ error: "no_token" }, { status: 400 });
      try {
        const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) return Response.json({ error: `me_${meRes.status}` }, { status: 502 });
        const me = await meRes.json<{ id?: number; kakao_account?: { email?: string; is_email_valid?: boolean; is_email_verified?: boolean } }>();
        if (me.id == null) return Response.json({ error: "no_id" }, { status: 502 });
        const acct = me.kakao_account;
        const email = acct?.email && acct.is_email_valid && acct.is_email_verified ? acct.email : undefined;
        const token = await firebaseCustomToken(
          env.FIREBASE_SA,
          `kakao:${me.id}`,
          email ? { provider: "kakao", email } : { provider: "kakao" },
        );
        return Response.json(email ? { token, email } : { token }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
      }
    }

    // Kakao Login step 2 (D99): Kakao redirects here with `code`. Exchange it (server-side, REST key stays here),
    // read the Kakao account id + email, mint a Firebase custom token for uid `kakao:<id>`, hand it to the app.
    if (url.pathname === "/kakao/callback") {
      const code = url.searchParams.get("code");
      const oauthErr = url.searchParams.get("error");
      if (oauthErr || !code) return kakaoResult({ error: oauthErr || "no_code" });
      if (!env.FIREBASE_SA) return kakaoResult({ error: "server_not_configured" });
      try {
        const tokRes = await fetch("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: env.KAKAO_REST_KEY,
            redirect_uri: `${url.origin}/kakao/callback`,
            code,
            ...(env.KAKAO_CLIENT_SECRET ? { client_secret: env.KAKAO_CLIENT_SECRET } : {}),
          }),
        });
        if (!tokRes.ok) return kakaoResult({ error: `token_${tokRes.status}` });
        const accessToken = (await tokRes.json<{ access_token?: string }>()).access_token;
        if (!accessToken) return kakaoResult({ error: "no_access_token" });

        const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) return kakaoResult({ error: `me_${meRes.status}` });
        const me = await meRes.json<{ id?: number; kakao_account?: { email?: string; is_email_valid?: boolean; is_email_verified?: boolean } }>();
        if (me.id == null) return kakaoResult({ error: "no_id" });

        // Only trust a Kakao email that Kakao itself marks valid AND verified; otherwise omit it (id-only account).
        const acct = me.kakao_account;
        const email = acct?.email && acct.is_email_valid && acct.is_email_verified ? acct.email : undefined;

        const token = await firebaseCustomToken(
          env.FIREBASE_SA,
          `kakao:${me.id}`,
          email ? { provider: "kakao", email } : { provider: "kakao" },
        );
        return kakaoResult(email ? { token, email } : { token });
      } catch (e) {
        return kakaoResult({ error: String((e as Error)?.message ?? e) });
      }
    }

    // Kakao Local proxy (D93) — relay the two whitelisted endpoints with the server-held REST key.
    const endpoint = KAKAO_LOCAL[url.pathname];
    if (endpoint) {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        });
      }
      const res = await fetch(`${endpoint}?${url.searchParams.toString()}`, {
        headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` },
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        },
      });
    }

    // Default: serve the holiday doc to devices, ETag-conditional so unchanged fetches return 304.
    const doc = (await env.HOLIDAYS.get(KEY)) ?? '{"version":0,"days":{}}';
    const etag = `"v${JSON.parse(doc).version ?? 0}"`;
    if (req.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(doc, {
      headers: {
        etag,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  },
};
