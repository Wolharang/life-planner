# Reference Apps — Complete Feature Inventory

> Purpose: capture **every** feature and field of the two existing apps so nothing is silently lost when we
> reimplement/integrate them in LifePlanner. Both are working apps built with **React Native + Expo**.
> This is a faithful catalog of *what they do*, not a proposal. When building the corresponding LifePlanner
> feature, treat every bullet here as a requirement to preserve unless a decision explicitly drops it.
>
> Sources: `reference/calculator.js` (budget / 가계부), `reference/kcal.js` (calorie+workout / 식단).

---

## A. Budget app — `reference/calculator.js`

**Stack / libs**: React Native, `@react-native-async-storage/async-storage`, `expo-file-system/legacy`,
`expo-sharing`, `expo-document-picker`, `@expo/vector-icons` (Ionicons), `expo-linear-gradient`,
`expo-haptics`.

### A1. Constants
- **Categories (8, fixed)**: `주식, 간식, 문화생활, 잡화소모, 이동통신, 대중교통비, 뷰티, 기타`.
- **Per-category color** (used on icon circle, badge, distribution bar): 주식 `#1B4332`, 간식 `#C9A227`,
  문화생활 `#46466B`, 잡화소모 `#3C7A89`, 이동통신 `#5B7C99`, 대중교통비 `#B5533C`, 뷰티 `#7C5295`, 기타 `#8B7E74`.
- **Per-category icon (emoji)**: 주식 🍚, 간식 🍩, 문화생활 🎬, 잡화소모 🛒, 이동통신 📱, 대중교통비 🚌, 뷰티 💄, 기타 💳.
- **Day-of-week labels**: 일요일…토요일.
- **Theme**: "ledger" concept — deep forest ink + gold accent; monospace font for numbers (Menlo/monospace).

### A2. Data model — one expense record
`id` (string; `Date.now()` on create, preserved on edit) · `timestamp` (ms; built from the selected **input
date** + the **current time-of-day** at save) · `category` · `name` (**required**) · `amount` (number;
commas stripped) · `store` (구매처, optional) · `payment` (결제수단, optional) · `icon` (from category).

### A3. Storage & persistence
- AsyncStorage key **`@expense_list`**.
- Load on mount; sort by `timestamp` **descending**.
- **Auto-save** to storage on every change to the list (skips the first render).

### A4. Screens (single-file, `currentView` = `list` | `input` | `settings`)

**List screen**
- Header: eyebrow "MY LEDGER"; month title `YYYY.MM`; prev/next **month** arrows; settings (gear) button.
- **Summary card** "이번 달 총 지출" = sum of amounts whose timestamp falls in `currentMonth`, shown as
  `n,nnn원` (localized).
- **Category distribution bar**: horizontal stacked segments sized by each category's percent of the month
  total; legend lists **top 3** categories (colored dot, name, amount) and "+N개 카테고리" if more than 3.
- **Transaction list**: `SectionList` grouped by day; section header shows `MM.DD. 요일` and the **day
  subtotal**; filtered to `currentMonth`. Each row: category icon in colored circle, name, colored category
  badge, optional `· store`, optional `· payment`, amount as `-n,nnn원` (negative red, mono), **edit** and
  **delete** buttons.
- **Empty state**: "입력된 지출이 없습니다." + hint to press the + button.
- **FAB** (+) bottom-right with spring press animation and light haptic; opens the input screen.

**Input screen** (add or edit)
- Header: X (cancel); title "지출 입력" / "지출 수정".
- **Date** selector: prev/next **day** arrows; shows `MM.DD. 요일` (defaults to today; edit loads item's date).
- **Category** grid: 8 buttons (4 per row), each icon + label; active button filled with its category color.
- **Name** (소비 이름, **required**), placeholder `ex) 점심 식사, 커피, 버스`.
- **Store** (구매처, optional, `ex) GS25`) and **Payment** (결제수단, optional, `ex) 네이버페이`) side by side.
- **Amount** (금액, **required**), numeric, right-aligned, gold underline, `원` suffix; submit triggers save.
- **Save** button "저장" / "수정 완료".
- **Validation**: name and amount required → info dialog; amount must be numeric after stripping commas →
  info dialog.
- **Save behavior**: timestamp = selected date + current clock time; new item prepended; list re-sorted desc;
  `currentMonth` jumps to the saved item's month; success haptic; return to list.
- **Edit**: loads the record back into the form (keeps `id`).
- **Delete**: confirm dialog → warning haptic → remove by `id`.

**Settings screen**
- Header: back to 홈; title "설정"; description about backing up / moving to another device.
- **"데이터 백업"** card → export. **"데이터 복원"** card → import.

### A5. Export (backup)
- If list empty → dialog "백업할 데이터가 없습니다."
- `JSON.stringify(expenseList)`; filename **`expense_backup_{Date.now()}.json`**.
- **Android**: via `StorageAccessFramework` — request directory permission → create file → write UTF-8 →
  success dialog. If permission denied → "취소" dialog. If SAF throws → fall back to sharing.
- **Otherwise / fallback**: write to `cacheDirectory` then `Sharing.shareAsync` (UTI `public.json`, dialog
  title "가계부 백업").
- Any exception → error dialog with message.

### A6. Import (restore)
- `DocumentPicker.getDocumentAsync` → read file UTF-8 → `JSON.parse` (invalid JSON → error dialog).
- **Validation**: must be an array where **every** item has `id`, `timestamp`, `name`; else "파일 구조가
  올바르지 않거나 데이터가 손상되었습니다."
- Dialog "데이터 복원 — 어떻게 적용하시겠습니까?" with three actions:
  - **기존 데이터와 병합** — append only items whose `id` isn't already present; re-sort desc; success dialog.
  - **기존 데이터 지우고 덮어쓰기** (destructive) — replace entire list; re-sort desc; success dialog.
  - **취소**.

### A7. Cross-cutting UX
- **Custom modal (`AppModal`)** replaces OS `Alert` — icon, title, message, primary/destructive/cancel actions.
- **Hardware back**: close dialog if open → else return to list if not on list → else default.
- **Haptics**: light (open/FAB), success (save/export/import), warning (delete).
- Gradient headers, card shadows, keyboard avoidance, tap-to-dismiss keyboard.

---

## B. Calorie + workout app — `reference/kcal.js`

**Stack / libs**: React Native, AsyncStorage, `expo-file-system/legacy`, `expo-sharing`,
`expo-document-picker`, `expo-image-picker`, `react-native-image-zoom-viewer`. Uses OS `Alert` (not a custom
modal). Theme: green (`#4CAF50`).

### B1. Constants
- **Meal categories (4)**: `아침, 점심, 저녁, 간식`. Plus two **activity** categories created via buttons:
  `운동`, `러닝`.
- **Per-meal kcal targets** (`KCAL_TARGETS`): 아침 400, 점심 500, 저녁 400, 간식 200 (sum = 1500). The daily
  target in the summary is a **hard-coded literal** "목표 1500kcal" (not computed from the per-meal targets),
  so if the per-meal targets change, the daily label won't follow automatically — reconcile this in LifePlanner.
- **Meal icons**: 아침 🍳, 점심 🍱, 저녁 🥩, 간식 ☕ (fallback 🍽️). **Activity icons**: 러닝 👟, 운동 🏃‍♂️.

### B2. Data model — one record
`id` · `timestamp` (selected input date + current clock time) · `category` (meal or `운동`/`러닝`) · `name`
(**required** for meals; activities auto-named `"운동 완료"` / `"러닝 완료"`) · `details` (상세 정보, optional) ·
`kcal` (number; 0 if blank; always 0 for activities) · ~~`image`~~ (**dropped in LifePlanner**, D19) · `icon`.

### B3. Storage & persistence
- AsyncStorage key **`@diet_list`**; load on mount sorted desc; auto-save on change (skip first render).

### B4. Screens (`list` | `input` | `settings`)

**List screen**
- Header: gear (settings); month control with prev/next **month** arrows + `YYYY.MM`.
- **Today's summary panel** ("오늘의 기록 요약 (DD일)"): shows `현재 {totalTodayKcal}kcal / 목표 1500kcal`, then
  lines:
  - `👟 러닝: O (완료)` / `X` — whether any 러닝 record exists **today**.
  - For each meal (아침/점심/저녁/간식): `[{sum}/{target}]: {comma-joined food names}` for today.
  - `🏃 운동: O (완료)` / `X` — whether any 운동 record exists **today**.
- **Records list**: `SectionList` grouped by day (`MM.DD. 요일` header), filtered to `currentMonth`.
  - Meal row: icon circle, name, category badge, optional `{kcal}kcal` badge, optional `• details`,
    **view-photo** button (🖼️, only if image) → fullscreen zoomable viewer, **edit**, **delete**.
  - Activity row (운동/러닝): icon (러닝 gets light-blue bg + blue text), big label (name), **delete** only.
- **Empty state**: "입력된 기록이 없습니다." + hint.
- **FAB** (+) → input screen.

**Input screen**
- Header: cancel; title "기록 추가" / "기록 수정".
- **Date** selector (prev/next day, `MM.DD. 요일`).
- **Meal category** grid (4 buttons), active highlighted.
- **Food name** (음식 이름, **required**, `ex) 연어 포케`) and **Details** (상세 정보, optional,
  `ex) 식당, 소스 종류`) side by side.
- **Kcal** (numeric, `kcal` suffix) and **Photo attach** (선택) side by side: pick from gallery
  (`ImagePicker`, quality 1); shows "사진 변경" if one is attached, with a **삭제** button to clear.
  **⚠️ Photos are DROPPED in LifePlanner** (docs/core/decisions.md D19, free-plan only) — do not port the photo attach,
  photo viewer, or `image` field.
- **Save** button "음식 기록 저장" / "기록 수정 완료".
- **Physical-activity section** (only when **adding**, not editing): divider + "또는 신체 활동" with two
  buttons — **👟 러닝 완료** (blue) and **🏃‍♂️ 운동 완료**. Each opens a confirm alert
  ("...추가하시겠습니까? 이 결정은 되돌릴 수 없습니다.") → on 예, creates an activity record dated to the selected
  input date + current time, prepends, jumps month, returns to list.
- **Validation**: food name required (activities exempt — they use fixed names).
- **Edit**: loads record (incl. details, kcal, image). **Delete**: confirm alert → remove by `id`.

**Settings screen**
- Header back to 홈; description; **📥 데이터 백업 (내보내기)** and **📤 데이터 복원 (불러오기)** buttons.

### B5. Export / import
- **Export**: same pattern as budget app — empty check ("백업할 데이터가 없습니다."), filename
  **`diet_backup_{Date.now()}.json`**, Android SAF with sharing fallback, share dialog title "식단 백업".
- **Import**: `DocumentPicker` → parse → validate array where every item has `id`, `timestamp`, `name` →
  alert "데이터 복원 / 어떻게 적용하시겠습니까?" with **취소 / 기존 데이터와 병합 / 기존 데이터 덮어쓰기**
  (merge skips existing ids; overwrite replaces). Corrupt → "데이터가 손상되었습니다."

### B6. Cross-cutting UX
- Fullscreen **image viewer** modal (swipe-down to close, close button).
- Hardware back: return to list when not on list.
- Accessibility labels/roles on most controls.

---

## C. Notes for LifePlanner integration
- Both apps are **local-first** (AsyncStorage) and already ship **JSON export/import with merge-vs-overwrite**
  — directly relevant to our data-portability and sync-conflict UX (spec §3.7, §3.8).
- Record shape convention is shared: string `id`, ms `timestamp` = **chosen date + current clock time**,
  `category`, `icon`. Preserve this when unifying, or provide a migration.
- Divergences to reconcile: budget app uses a **custom modal + haptics**; calorie app uses **OS Alert** and
  adds **photos** and **activity records**. LifePlanner should pick one dialog/haptic convention.
- The calorie app's **activity records (운동/러닝)** overlap conceptually with LifePlanner's workout tracking
  and with time-block "did I work out" evaluation — unify these rather than duplicating.
- Stack is **confirmed RN + Expo** (docs/core/decisions.md D11/D34) — the same stack as these reference apps → **reference & port
  (참고·이식)** the logic directly (each is a standalone app, so not literal drop-in reuse; adapt it). This catalog is the migration spec.
