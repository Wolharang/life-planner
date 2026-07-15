// Holiday sync (D89) — runs in GitHub Actions, NOT on any device.
//
// Why here: the Kakao holidays endpoint authenticates with the **service admin key**, which can never ship in
// the app (extractable, unrotatable, admin-level). GitHub Actions is a free (no-card) server-side runner, so the
// key lives only as a repo Secret here. Firebase Cloud Functions would also work but require the paid Blaze plan.
//
// What it does: pulls 60 months of holidays from Kakao (one ≤31-day call per month), keeps only holiday==true,
// expands multi-day events, and writes a {date: name} map to Firestore — but ONLY when it differs from what is
// already there, bumping a version int so each device can tell "changed / unchanged" with one tiny read.
//
// Env (from GitHub Secrets): KAKAO_ADMIN_KEY, FIREBASE_SA (the service-account JSON, as a string).

import admin from "firebase-admin";

const ADMIN_KEY = process.env.KAKAO_ADMIN_KEY;
const SA_RAW = process.env.FIREBASE_SA;
if (!ADMIN_KEY || !SA_RAW) {
  console.error("Missing KAKAO_ADMIN_KEY or FIREBASE_SA env.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA_RAW)) });
const db = admin.firestore();

const MONTHS = 60;
const iso = (d) => d.toISOString().slice(0, 19) + "Z"; // drop millis; Kakao wants RFC3339 UTC

/** 60 one-month [from, to) windows starting from the current UTC month. `to` = next month day 1 → ≤ 31 days. */
function monthWindows(count) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))) });
    if (++m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

async function fetchMonth(from, to) {
  const url = `https://kapi.kakao.com/v2/api/calendar/holidays?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${ADMIN_KEY}` } });
  if (!res.ok) throw new Error(`Kakao ${res.status}: ${await res.text()}`);
  return (await res.json()).events ?? [];
}

/** All dates in [startYmd, endYmd) — so a 3-day 설날 event expands to its three days; a 1-day event stays one. */
function expand(startYmd, endYmd) {
  if (!endYmd || endYmd <= startYmd) return [startYmd];
  const out = [];
  const d = new Date(startYmd + "T00:00:00Z");
  const end = new Date(endYmd + "T00:00:00Z");
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.length ? out : [startYmd];
}

const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

async function collect() {
  const days = {};
  for (const w of monthWindows(MONTHS)) {
    const events = await fetchMonth(w.from, w.to);
    for (const e of events) {
      if (!e.holiday) continue; // red days only — 기념일(holiday:false) are not coloured
      const start = (e.time?.start_at ?? "").slice(0, 10);
      if (!start) continue;
      for (const d of expand(start, (e.time?.end_at ?? "").slice(0, 10))) days[d] = e.title;
    }
    await new Promise((r) => setTimeout(r, 120)); // be polite to the API
  }
  return sortObj(days);
}

async function main() {
  const days = await collect();
  const dataRef = db.doc("config/holidays_data");
  const metaRef = db.doc("config/holidays_meta");

  const prev = sortObj((await dataRef.get()).data()?.days ?? {});
  if (JSON.stringify(prev) === JSON.stringify(days)) {
    console.log(`No change (${Object.keys(days).length} holidays).`);
    return;
  }

  const version = ((await metaRef.get()).data()?.version ?? 0) + 1;
  await dataRef.set({ days });
  await metaRef.set({
    version,
    count: Object.keys(days).length,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`Updated to version ${version} (${Object.keys(days).length} holidays).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
