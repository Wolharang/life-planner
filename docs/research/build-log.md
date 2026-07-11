# Build log — Full app ("integrated day")

Chronological journal of the **full-app** build in `app/` (the phase after the completed trigger prototype).
Complements — does not replace — `docs/research/implementation-plan.md` (the F0–F5 plan) and
`docs/core/prd.md` (What/Why). The prototype's own history is `docs/research/prototype/build-log.md`.
Newest entries at the top. Working language English; UI copy stays Korean.

---

## 2026-07-11 — Bottom tabs + month calendar (R1, local-first)

First full-app UI feature. **Note on order:** built the calendar **UI local-first ahead of F0** (the backend
phase) at the founder's direction — legitimate, because the Repository pattern lets the storage impl swap to
Firestore later behind the same interface (architecture §7). So this is F1's UI on a local store; F1's sync
(R2) + advance notification (R3) still wait on F0.

### What
- **Bottom tab bar** (`app/app/(tabs)/_layout.tsx`) — expo-router `(tabs)` group: **홈 · 캘린더 · 기록**
  (react-native-svg icons; active = brand blue, inactive = grey). Restructured the app from a flat Stack:
  moved the home screen `index.tsx → (tabs)/index.tsx`; non-tab screens (add, execution, settings,
  onboarding, metrics, add-event) stay at the `app/app/` root and push over the tabs via the root Stack.
  **기록** is a placeholder for now (the real expense/meal logs = R8/R9, a later feature).
- **Calendar screen** (`app/app/(tabs)/calendar.tsx`, PRD R1) — a **square-cell month grid** (7×6, CSS
  `aspectRatio: 1`, no measuring): date number top-left; a day with events shows a **horizontal colored bar**
  (color = `event.color`, up to 2 bars + "+N"); today = a filled brand circle; selected day = brand-soft cell.
  Prev/next month + **오늘**. Tapping a day selects it and the **panel below the grid** lists that day's events
  in detail (color dot + title + time + memo), with **＋ 일정 추가**; empty → gentle "이 날은 일정이 없어요".
- **ImportantEvent data** — new `ImportantEvent` entity in `src/core/data/types.ts` (id, title, date, time?,
  notifyLeadMinutes?, color?, memo?, createdAt, updatedAt — mirrors data-model §2.2) + a local
  `eventRepository.ts` (`lp.events.v1`, same AsyncStorage Repository pattern as taskRepository, +
  `groupByDate`). Added `lp.events.v1` → id to `backup.ts` merge keys so events are covered by JSON
  backup/restore.
- **Add/edit event** (`app/app/add-event.tsx`) — modeled on add.tsx: title (required), date (editable by day),
  optional time (Switch + HH:mm), a bar **color** (preset chips), memo; save/edit/delete.

### Scope / deferred
- **Sync (R2)** and **advance notification (R3)** are NOT in this change — they land with the backend (F0).
- The tab bar exists ahead of the full IA build-out; **기록** is a stub; 돌아보기/평가 (F5) not present.

### Verified
- `npm run typecheck` ✓ · `npm test` ✓ (route/type + scheduler logic intact). New native deps: none
  (react-native-svg already present) → no prebuild; a Metro reload suffices. On-device visual check pending
  (founder): tab switching, the square calendar, add-event → colored bar appears, tap-day → detail panel.
