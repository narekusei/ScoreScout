import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrencyAmount, hasSpecifiedBudget } from "../lib/budget";

test("recognizes budgets across symbols and ISO currency codes", () => {
  for (const label of ["$500", "€ 750", "JPY 4,000,000", "500 CAD", "₹80k", "KRW 3,000,000"]) {
    assert.equal(hasSpecifiedBudget(label), true, label);
  }
});

test("does not treat vague compensation text as a specified amount", () => {
  for (const label of ["Budget unclear", "Paid — amount unclear", "Competitive salary"]) {
    assert.equal(hasSpecifiedBudget(label), false, label);
  }
});

test("formats valid currencies consistently", () => {
  assert.equal(formatCurrencyAmount(2000, "usd"), "USD 2,000");
  assert.equal(formatCurrencyAmount(4000000, "JPY"), "JPY 4,000,000");
});
