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

## One-time setup (founder)

From `workers/holidays/`:

1. `npm install`
2. `npx wrangler login`
3. **Create the KV namespace** and paste its id into `wrangler.toml` (`kv_namespaces.id`):
   `npx wrangler kv namespace create HOLIDAYS`
4. **Set the secrets** (rotate the Kakao admin key first — the old one was exposed in chat):
   - `npx wrangler secret put KAKAO_ADMIN_KEY`  → paste the rotated admin key
   - `npx wrangler secret put REFRESH_TOKEN`    → any long random string (guards `/refresh`)
5. **Test locally**: `npx wrangler dev`, then in another shell trigger the scheduled handler:
   `curl "http://localhost:8787/cdn-cgi/handler/scheduled"` — the log should show it wrote KV.
6. **Deploy**: `npx wrangler deploy` → note the URL, e.g. `https://lp-holidays.<subdomain>.workers.dev`.
7. **Populate production once**: `curl "https://lp-holidays.<subdomain>.workers.dev/refresh?key=<REFRESH_TOKEN>"`
   → expect `{"version":1,"count":N,"changed":true}`.
8. **Wire the app**: put the Worker URL in `app/app.json` → `extra.holidaysUrl`, then rebuild the app.
   (Empty = the app just uses the bundled fallback table.)

## Notes

- Cron is UTC; subtract 9h from the KST time you want. Weekly is ample; add `"0 8 * * *"` for a daily 17:00 KST run.
- Only `holiday: true` events become red days.
- Writes to KV happen only on a real diff; the ETag/version lets each device skip the download when nothing moved.
