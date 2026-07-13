import { detectReference, parseReference } from "@/core/data/referenceImport";

// The EXACT row shape reference/calculator.js writes (saveExpense → itemData)
const expenseRow = {
  id: "1699999999999",
  timestamp: 1699999999999,
  category: "주식",
  name: "김밥",
  amount: 4500,
  store: "김밥천국",
  payment: "카드",
  icon: "💳",
};
// The EXACT row shape reference/kcal.js writes
const mealRow = {
  id: "1699999999998",
  timestamp: 1699999999998,
  category: "점심",
  name: "집밥",
  details: "",
  kcal: 400,
  image: null,
  icon: "🍱",
};

describe("reference import — the founder's own backup files", () => {
  it("detects an expense export", () => {
    expect(detectReference([expenseRow])).toBe("expenses");
  });
  it("detects a meal export", () => {
    expect(detectReference([mealRow])).toBe("meals");
  });
  it("parses an expense row into an Expense", () => {
    const r = parseReference([expenseRow]);
    expect(r.expenses.length).toBe(1);
    expect(r.expenses[0].amount).toBe(4500);
    expect(r.expenses[0].category).toBe("주식");
    expect(r.expenses[0].date).toBe("2023-11-15");
  });
  it("parses a meal row and drops nothing it should keep", () => {
    const r = parseReference([mealRow]);
    expect(r.meals.length).toBe(1);
    expect(r.meals[0].kcal).toBe(400);
  });
});
