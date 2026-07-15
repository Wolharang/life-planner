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
  KAKAO_REST_KEY: string; //  wrangler secret put KAKAO_REST_KEY   (dapi Local place-search proxy, D93)
  REFRESH_TOKEN: string; //   wrangler secret put REFRESH_TOKEN    (guards /refresh)
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
