import assert from "node:assert/strict";
import test from "node:test";

import type { Opportunity } from "../lib/opportunity";
import { matchesOpportunityQuery } from "../lib/opportunity-search";

const opportunity: Opportunity = {
  id: "greenhouse-example-1",
  title: "Senior Sound Designer",
  description: "Create original music and effects for a narrative game.",
  source: "Greenhouse",
  community: "example · Tokyo",
  url: "https://boards.greenhouse.io/example/jobs/1",
  publishedAt: "2026-08-21T00:00:00.000Z",
  ageHours: 1,
  budgetLabel: "Budget unclear",
  tags: ["Greenhouse", "Remote"],
};

test("matches comma-separated alternatives across opportunity fields", () => {
  assert.equal(matchesOpportunityQuery(opportunity, "composer, sound designer"), true);
  assert.equal(matchesOpportunityQuery(opportunity, "composer, tokyo"), true);
  assert.equal(matchesOpportunityQuery(opportunity, "composer, animation"), false);
});

test("supports Reddit-style OR queries and quoted phrases", () => {
  assert.equal(
    matchesOpportunityQuery(opportunity, 'composer OR "narrative game" OR soundtrack'),
    true,
  );
  assert.equal(matchesOpportunityQuery(opportunity, 'composer OR "film score"'), false);
});

test("matches source tags and treats an empty query as unrestricted", () => {
  assert.equal(matchesOpportunityQuery(opportunity, "remote"), true);
  assert.equal(matchesOpportunityQuery(opportunity, "   "), true);
});

test("keeps apostrophes as searchable text", () => {
  assert.equal(
    matchesOpportunityQuery({ ...opportunity, title: "Composer's assistant" }, "composer's"),
    true,
  );
});
