// The numbers the Logs surface shows must match the reference apps (reference-apps.md §A4/§B4).

import { byDay, categoryDistribution, dayAggregate, expenseTotal, inMonth, mealSummary, stampFor, won } from "./aggregate";
import { DAILY_KCAL_TARGET } from "./constants";
import type { Expense, MealEntry, TimeBlock } from "@/core/data/types";

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

describe("dayAggregate (R10 · data-model §2.6)", () => {
  const block = (over: Partial<TimeBlock>): TimeBlock => ({
    id: "b1",
    date: "2026-08-03",
    start: "21:00",
    title: "헬스",
    kind: "normal",
    alert: "none",
    alarmLeadMinutes: 0,
    snapStart: "21:00",
    snapTitle: "헬스",
    plannedAt: 0,
    status: "planned",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  });

  const blocks = [
    block({ id: "a", kind: "workout", status: "success" }),
    block({ id: "b", status: "fail" }),
    block({ id: "c", status: "skipped" }),
    block({ id: "d", status: "planned" }),
    block({ id: "e", date: "2026-08-02", status: "success" }), // another day
  ];
  const expenses = [exp({ id: "x", amount: 8000 }), exp({ id: "y", date: "2026-08-02", amount: 50000 })];
  const meals = [meal({ id: "m", mealType: "저녁", kcal: 700 })];

  const agg = dayAggregate("2026-08-03", blocks, expenses, meals);

  it("counts only that day's blocks, by status", () => {
    expect([agg.blocksSuccess, agg.blocksFail, agg.blocksSkipped, agg.blocksPlanned]).toEqual([1, 1, 1, 1]);
  });

  it("derives the workout flag from a success block of that kind (D22 — no activity record)", () => {
    expect(agg.workoutDone).toBe(true);
    expect(agg.runDone).toBe(false);
  });

  it("keeps the plan side and the log side as SEPARATE totals (D32 — links, not merges)", () => {
    expect(agg.expenseTotal).toBe(8000); // that day only
    expect(agg.kcalTotal).toBe(700);
    expect(agg.kcalByMeal["저녁"]).toBe(700);
    expect(agg.kcalByMeal["아침"]).toBe(0);
  });

  it("a workout planned but not succeeded is not 'done'", () => {
    const notDone = dayAggregate("2026-08-03", [block({ kind: "workout", status: "planned" })], [], []);
    expect(notDone.workoutDone).toBe(false);
  });
});

describe("stampFor", () => {
  it("stamps the chosen date with the current clock time", () => {
    const now = new Date(2026, 7, 5, 14, 30, 15).getTime(); // Aug 5, 14:30:15
    expect(stampFor("2026-08-01", now)).toBe(new Date(2026, 7, 1, 14, 30, 15).getTime());
  });
});
