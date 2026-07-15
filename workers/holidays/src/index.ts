// Cloudflare Worker — Korean holiday sync (D89). Free tier is ample.
//
// · **Cron Trigger** (scheduled handler): pulls the Kakao holidays API for 60 months (one <=31-day call per
//   month, per the API limit), dedupes by event id, keeps only holiday==true, expands multi-day events, and
//   stores the {date: name} map + a version in KV — but only when it actually changed.
// · **fetch handler**: serves that map to devices as public JSON, with an ETag so an unchanged table returns
//   304 (no body). No key is ever exposed — the admin key lives only as the `KAKAO_ADMIN_KEY` Wrangler secret.
//
// Why a Worker and not Firebase Cloud Functions: Functions need the paid Blaze plan; Workers Cron is free.

export interface Env {
  KAKAO_ADMIN_KEY: string; // wrangler secret put KAKAO_ADMIN_KEY
  REFRESH_TOKEN: string; //   wrangler secret put REFRESH_TOKEN  (guards the manual /refresh)
  HOLIDAYS: KVNamespace;
}

const MONTHS = 60;
const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z"; // RFC3339 UTC, no millis

/** 60 one-month [from, to) windows from the current UTC month. `to` = next month day 1 → <= 31 days. */
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

async function collect(adminKey: string): Promise<Record<string, string>> {
  const seenIds = new Set<string>();
  const days: Record<string, string> = {};
  for (const w of monthWindows(MONTHS)) {
    const url = `https://kapi.kakao.com/v2/api/calendar/holidays?from=${encodeURIComponent(w.from)}&to=${encodeURIComponent(w.to)}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${adminKey}` } });
    if (!res.ok) throw new Error(`Kakao ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { events?: any[] };
    for (const e of json.events ?? []) {
      if (!e.holiday) continue; // red days only (기념일 like 국군의날 are holiday:false)
      if (e.id) {
        if (seenIds.has(e.id)) continue; // dedupe by id across overlapping month windows
        seenIds.add(e.id);
      }
      const start = String(e.time?.start_at ?? "").slice(0, 10);
      if (!start) continue;
      for (const d of expand(start, String(e.time?.end_at ?? "").slice(0, 10))) days[d] = e.title;
    }
  }
  return sortObj(days);
}

async function refresh(env: Env): Promise<{ version: number; count: number; changed: boolean }> {
  const days = await collect(env.KAKAO_ADMIN_KEY);
  const prevRaw = await env.HOLIDAYS.get("data");
  const prevDays = prevRaw ? sortObj((JSON.parse(prevRaw).days as Record<string, string>) ?? {}) : {};
  const meta = JSON.parse((await env.HOLIDAYS.get("meta")) ?? '{"version":0}');
  const count = Object.keys(days).length;

  if (JSON.stringify(prevDays) === JSON.stringify(days)) {
    return { version: meta.version ?? 0, count, changed: false };
  }
  const version = (meta.version ?? 0) + 1;
  await env.HOLIDAYS.put("data", JSON.stringify({ version, days }));
  await env.HOLIDAYS.put("meta", JSON.stringify({ version, count, updatedAt: Date.now() }));
  return { version, count, changed: true };
}

export default {
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Manual populate/refresh (e.g. right after deploy): /refresh?key=<REFRESH_TOKEN>. Guarded so it can't be
    // triggered by anyone — it would otherwise spend 60 Kakao calls on demand.
    if (url.pathname === "/refresh") {
      if (url.searchParams.get("key") !== env.REFRESH_TOKEN) return new Response("forbidden", { status: 403 });
      return Response.json(await refresh(env));
    }

    // Default: serve the holiday payload to devices, ETag-conditional so unchanged fetches return 304.
    const meta = JSON.parse((await env.HOLIDAYS.get("meta")) ?? '{"version":0}');
    const etag = `"v${meta.version ?? 0}"`;
    if (req.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    const data = (await env.HOLIDAYS.get("data")) ?? '{"version":0,"days":{}}';
    return new Response(data, {
      headers: {
        etag,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  },
};
