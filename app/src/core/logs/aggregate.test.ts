// The numbers the Logs surface shows must match the reference apps (reference-apps.md §A4/§B4).

import { byDay, categoryDistribution, expenseTotal, inMonth, mealSummary, stampFor, won } from "./aggregate";
import { DAILY_KCAL_TARGET } from "./constants";
import type { Expense, MealEntry } from "@/core/data/types";

const exp = (over: Partial<Expense>): Expense => ({
  id: "e1",
  date: "2026-08-03",
  timestamp: 1,
  name: "커피",
  amount: 5000,
  category: "간식",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const meal = (over: Partial<MealEntry>): MealEntry => ({
  id: "m1",
  date: "2026-08-03",
  timestamp: 1,
  mealType: "점심",
  foodName: "연어 포케",
  kcal: 480,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("expenses", () => {
  const all = [
    exp({ id: "a", date: "2026-08-01", amount: 10000, category: "주식" }),
    exp({ id: "b", date: "2026-08-03", amount: 5000, category: "간식" }),
    exp({ id: "c", date: "2026-08-03", amount: 5000, category: "주식" }),
    exp({ id: "d", date: "2026-07-30", amount: 99000, category: "뷰티" }), // another month
  ];

  it("totals only the viewed month", () => {
    expect(expenseTotal(inMonth(all, "2026-08"))).toBe(20000);
  });

  it("splits the month by category, biggest first", () => {
    const dist = categoryDistribution(inMonth(all, "2026-08"));
    expect(dist.map((d) => [d.category, d.amount])).toEqual([
      ["주식", 15000],
      ["간식", 5000],
    ]);
    expect(dist[0].ratio).toBe(0.75);
  });

  it("groups into day sections, newest day first", () => {
    expect(byDay(inMonth(all, "2026-08")).map((s) => s.date)).toEqual(["2026-08-03", "2026-08-01"]);
  });

  it("formats KRW the way the reference app did", () => {
    expect(won(20000)).toBe("20,000원");
  });
});

describe("meals", () => {
  it("sums today's kcal per meal against the targets, ignoring other days", () => {
    const s = mealSummary(
      [
        meal({ id: "a", mealType: "아침", foodName: "토스트", kcal: 300 }),
        meal({ id: "b", mealType: "점심", foodName: "포케", kcal: 480 }),
        meal({ id: "c", mealType: "점심", foodName: "커피", kcal: 20 }),
        meal({ id: "d", date: "2026-08-02", mealType: "저녁", foodName: "어제밥", kcal: 700 }),
      ],
      "2026-08-03"
    );
    expect(s.total).toBe(800);
    expect(s.byMeal["점심"]).toEqual({ kcal: 500, target: 500, names: ["포케", "커피"] });
    expect(s.byMeal["저녁"].kcal).toBe(0);
  });

  it("derives the daily target from the per-meal targets (reference-apps §B1 asked us to reconcile)", () => {
    expect(DAILY_KCAL_TARGET).toBe(1500);
  });
});

describe("stampFor", () => {
  it("stamps the chosen date with the current clock time", () => {
    const now = new Date(2026, 7, 5, 14, 30, 15).getTime(); // Aug 5, 14:30:15
    expect(stampFor("2026-08-01", now)).toBe(new Date(2026, 7, 1, 14, 30, 15).getTime());
  });
});
