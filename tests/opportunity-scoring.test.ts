import assert from "node:assert/strict";
import test from "node:test";

import type { Opportunity } from "../lib/opportunity";
import { scoreOpportunity } from "../lib/opportunity";

const baseOpportunity: Opportunity = {
  id: "score-test",
  title: "Creative role",
  description: "Join a small game team.",
  source: "Other",
  community: "Test",
  url: "https://example.com/job",
  publishedAt: "2026-09-01T00:00:00.000Z",
  ageHours: 100,
  budgetLabel: "Budget unclear",
  tags: [],
};

test("weights music and hiring signals in the title more heavily", () => {
  const titleMatch = scoreOpportunity({
    ...baseOpportunity,
    title: "Composer needed for an indie game",
  });
  const descriptionMatch = scoreOpportunity({
    ...baseOpportunity,
    description: "We are looking for a composer for an indie game.",
  });

  assert.equal(titleMatch.score, 70);
  assert.equal(descriptionMatch.score, 45);
  assert.ok(titleMatch.score > descriptionMatch.score);
  assert.deepEqual(titleMatch.scoreReasons, ["music role in title", "clear hiring intent"]);
});

test("recognizes payment in broader currencies", () => {
  for (const budgetLabel of ["JPY 300,000 fixed", "€2,000", "₩3,000,000", "CHF 1,500"]) {
    const result = scoreOpportunity({ ...baseOpportunity, budgetLabel });
    assert.equal(result.score, 30, budgetLabel);
    assert.ok(result.scoreReasons.includes("payment details found"), budgetLabel);
  }
});

test("penalizes unpaid and revenue-share opportunities", () => {
  const unpaid = scoreOpportunity({
    ...baseOpportunity,
    title: "Composer needed",
    description: "This is an unpaid volunteer position with no budget.",
  });
  const revenueShare = scoreOpportunity({
    ...baseOpportunity,
    title: "Composer needed",
    description: "Compensation is revenue share after launch.",
  });

  assert.equal(unpaid.score, 20);
  assert.ok(unpaid.scoreReasons.includes("unpaid opportunity"));
  assert.equal(revenueShare.score, 35);
  assert.ok(revenueShare.scoreReasons.includes("revenue-share compensation"));
});

test("applies deterministic freshness tiers and clamps the score", () => {
  const fresh = scoreOpportunity({ ...baseOpportunity, ageHours: 24 });
  const recent = scoreOpportunity({ ...baseOpportunity, ageHours: 72 });
  const old = scoreOpportunity({ ...baseOpportunity, ageHours: 73 });
  const lowQuality = scoreOpportunity({
    ...baseOpportunity,
    description: "Unpaid volunteer work, revenue share only. My portfolio; available for work.",
  });

  assert.equal(fresh.score, 25);
  assert.equal(recent.score, 20);
  assert.equal(old.score, 15);
  assert.equal(lowQuality.score, 0);
  assert.deepEqual(scoreOpportunity(fresh), fresh);
});
