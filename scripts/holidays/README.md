# Holiday sync (D89)

Keeps the Korean public-holiday table current **automatically**, replacing the hand-maintained fallback in
`app/src/core/schedule/holidays.ts`. Free end to end (no paid cloud, no card).

```
GitHub Actions (cron 03:00 & 17:00 KST)
  └ node index.mjs  ── Kakao holidays API (60 months, 1 call/month; admin key = repo Secret)
                    └ writes config/holidays_meta {version} + config/holidays_data {days} to Firestore
                       (only when the map actually changed; version++ each change)
Devices: read holidays_meta (tiny) → if version moved, read holidays_data → cache → show.
         Offline / logged out / no Firebase → the bundled table in holidays.ts is the fallback.
```

## One-time setup (founder)

1. **Rotate the Kakao admin key** (the one shared in chat is exposed): Kakao 개발자 콘솔 → 앱 → 앱 키 →
   어드민 키 재발급.
2. **Firebase service account**: Firebase Console → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성** → download
   the JSON.
3. **Add GitHub repo Secrets** (Settings → Secrets and variables → Actions → *New repository secret*):
   - `KAKAO_ADMIN_KEY` = the rotated admin key
   - `FIREBASE_SA` = the **entire contents** of the service-account JSON (paste as-is)
4. **Deploy the Firestore rule** so devices can read `/config` (already in `firestore.rules`):
   `firebase deploy --only firestore:rules` (or paste the `/config/{doc}` block in the console → Firestore →
   규칙). The Action's Admin SDK bypasses rules, so it can write regardless.
5. **Push** the repo to GitHub (Actions only run once the workflow file is on GitHub), then run it once manually:
   Actions → *Sync holidays* → **Run workflow**. Check the log says `Updated to version 1 (N holidays)`.

## Notes

- Runs **anywhere Node 20 is present**; locally: `KAKAO_ADMIN_KEY=… FIREBASE_SA="$(cat sa.json)" npm run sync`.
- Only `holiday: true` events become red days (기념일 like 국군의날 are skipped).
- The Action writes only on a real diff, so most runs print `No change` and touch nothing.
