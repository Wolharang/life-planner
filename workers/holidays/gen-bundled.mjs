// One-time generator (D89): pull EVERY Korean holiday 2015–2040 from the Kakao API and print the {date: name}
// map as JSON to stdout. This becomes the app's baked-in base table (app/src/core/schedule/holidays.data.ts) —
// the offline/first-run/beyond-45-months fallback; the Worker's rolling 45-month sync overrides the near future.
//
// Run locally (no Cloudflare subrequest cap here): `node gen-bundled.mjs > bundled.json`
// The admin key is read from `.dev.vars` (never printed). Progress goes to stderr; the JSON goes to stdout.

import fs from "fs";

const devvars = fs.readFileSync(new URL("./.dev.vars", import.meta.url), "utf8");
const ADMIN_KEY = (devvars.match(/^\s*KAKAO_ADMIN_KEY\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
if (!ADMIN_KEY) {
  console.error("KAKAO_ADMIN_KEY not found in .dev.vars");
  process.exit(1);
}

const FROM_YEAR = 2015;
const TO_YEAR = 2040;
const iso = (d) => d.toISOString().slice(0, 19) + "Z";

function expand(start, end) {
  if (!end || end <= start) return [start];
  const out = [];
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d < e) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.length ? out : [start];
}

const days = {};
let calls = 0;
for (let y = FROM_YEAR; y <= TO_YEAR; y++) {
  for (let m = 0; m < 12; m++) {
    const from = iso(new Date(Date.UTC(y, m, 1)));
    const to = iso(new Date(Date.UTC(y, m + 1, 1)));
    const url = `https://kapi.kakao.com/v2/api/calendar/holidays?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${ADMIN_KEY}` } });
    if (!res.ok) {
      console.error(`FAIL ${from.slice(0, 7)}: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const j = await res.json();
    for (const e of j.events ?? []) {
      if (!e.holiday) continue;
      const start = String(e.time?.start_at ?? "").slice(0, 10);
      if (!start) continue;
      for (const d of expand(start, String(e.time?.end_at ?? "").slice(0, 10))) days[d] = e.title;
    }
    calls++;
    await new Promise((r) => setTimeout(r, 90));
  }
  console.error(`... ${y} done (${Object.keys(days).length} holidays so far)`);
}

const sorted = Object.fromEntries(Object.keys(days).sort().map((k) => [k, days[k]]));
process.stdout.write(JSON.stringify(sorted));
console.error(`DONE: ${calls} calls, ${Object.keys(sorted).length} holidays ${FROM_YEAR}–${TO_YEAR}`);
