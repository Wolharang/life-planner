// Fixed constants for the Logs surface (D16 — not user-editable): the 8 budget categories with their colors,
// and the 4 meal kcal targets. The category *set* began verbatim from the reference apps
// (docs/research/reference-apps.md §A1 / §B1), but 뷰티 was replaced by 의료 (D87 — a deliberate product
// choice) and the glyphs are now custom line icons (src/ui/icons/LogIcons.tsx), not emoji.

import type { ExpenseCategory, MealType } from "@/core/data/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "주식",
  "간식",
  "문화생활",
  "잡화소모",
  "이동통신",
  "대중교통비",
  "의료",
  "기타",
];

/** Category identity colors — used on the icon circle, badge and distribution bar. Deliberately a **vivid,
 *  well-spread hue wheel** (D91): the old set was all dark/desaturated cool tones, so 주식 and 잡화소모 read as
 *  the same colour and the list looked monochrome. Each category now owns a clearly distinct hue. (Red is left
 *  out on purpose — the app reserves red-anxiety for nothing; a miss is taupe, never red.) */
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  주식: "#FD7E14", // orange
  간식: "#FAB005", // amber
  문화생활: "#7950F2", // violet
  잡화소모: "#40C057", // green
  이동통신: "#228BE6", // blue
  대중교통비: "#E64980", // pink
  의료: "#15AABF", // cyan
  기타: "#868E96", // grey
};

export const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];

/** Per-meal identity colors — so the 식사 list reads colorful (not one grey), the same way CATEGORY_COLOR
 *  gives 지출 its variety. Muted, time-of-day tones that sit with the category palette. */
export const MEAL_COLOR: Record<MealType, string> = {
  아침: "#D9932B", // sunrise ochre
  점심: "#3E9E7A", // midday green
  저녁: "#6A5A9C", // dusk violet
  간식: "#C56B7A", // rose
};

/** Per-meal kcal targets (D16). */
export const KCAL_TARGET: Record<MealType, number> = { 아침: 400, 점심: 500, 저녁: 400, 간식: 200 };

/** The daily target is **derived** from the per-meal targets (= 1500). The reference app hard-coded the
 *  1500 literal, so changing a meal target silently desynced the daily label — reference-apps.md §B1 asks
 *  us to reconcile that here. */
export const DAILY_KCAL_TARGET = MEAL_TYPES.reduce((sum, m) => sum + KCAL_TARGET[m], 0);
