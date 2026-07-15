# Holiday sync — Cloudflare Worker (D89)

Keeps the Korean public-holiday table current **automatically**, replacing the hand-maintained fallback in
`app/src/core/schedule/holidays.ts`. Free end to end (no card): Cloudflare Workers Cron + KV free tiers.

```
Cloudflare Worker
  ├ scheduled (Cron, weekly Mon 05:00 KST): Kakao API × 60 months (dedupe by id, holiday:true only)
  │                                          → KV: data {version,days}, meta {version}   (only on a diff)
  └ fetch (GET /): serve the JSON to devices, ETag-conditional (304 when unchanged)   [no key exposed]

Device: GET the Worker URL (If-None-Match) → 304 = keep; 200 = cache + show.  Offline/unwired → bundled table.
```

The Kakao **admin key never leaves Cloudflare** — it is a Wrangler secret, not in code or the app.

## Setup (founder)

From `workers/holidays/`. Do the local test first — it works **without** email verification and proves the
whole pull works; the production deploy needs the Cloudflare email verified.

### 0. Prereqs (once)
- `npm install`
- `npx wrangler login`
- `npx wrangler kv namespace create HOLIDAYS` → paste the printed `id` into `wrangler.toml` (already done if it
  shows a real id there).

### 1. Test locally (no email verification needed)
Local dev (Miniflare) does **not** use the production secrets — it reads a **`.dev.vars`** file. So:
- `cp .dev.vars.example .dev.vars` and fill in the **rotated** admin key + any REFRESH_TOKEN. (`.dev.vars` is
  gitignored — never commit it.)
- `npx wrangler dev --test-scheduled`  ← **the `--test-scheduled` flag is required**, otherwise
  `/__scheduled` just falls through to the normal GET and returns the empty `{"version":0,...}`.
- In another shell: `curl "http://localhost:8787/__scheduled"` → watch the `wrangler dev` log; it
  should pull Kakao and write local KV.
- `curl "http://localhost:8787/"` → now returns `{"version":1,"days":{ "...": "..." }}` with real holidays.

### 2. Deploy to production
- **Verify your Cloudflare email first** (the `[code: 10034]` error blocks Worker create/deploy until you do —
  check the shleelee@… inbox or resend from the dashboard).
- `npx wrangler secret put KAKAO_ADMIN_KEY` → paste the rotated admin key (masked)
- `npx wrangler secret put REFRESH_TOKEN` → a long random string
- `npx wrangler deploy` → note the URL, e.g. `https://lp-holidays.<subdomain>.workers.dev`
- **Populate once**: `curl "https://lp-holidays.<subdomain>.workers.dev/refresh?key=<REFRESH_TOKEN>"`
  → expect `{"version":1,"count":N,"changed":true}`.

### 3. Wire the app
Put the Worker URL in `app/app.json` → `extra.holidaysUrl`, then rebuild. (Empty = bundled fallback table.)

## Notes

- Cron is UTC; subtract 9h from the KST time you want. Weekly is ample; add `"0 8 * * *"` for a daily 17:00 KST run.
- Only `holiday: true` events become red days.
- Writes to KV happen only on a real diff; the ETag/version lets each device skip the download when nothing moved.
- `wrangler secret put` sets **production** secrets; `.dev.vars` holds the **local** ones — they are separate.
