import assert from "node:assert/strict";
import test from "node:test";
import type { ScoredOpportunity } from "../lib/opportunity";
import {
  mergeOpportunities,
  parseSavedOpportunities,
  serializeSavedOpportunities,
} from "../lib/saved-opportunities";

const liveOpportunity: ScoredOpportunity = {
  id: "lever-live-composer",
  title: "Composer for a live game",
  description: "A paid remote contract for an original score.",
  source: "Lever",
  community: "Example studio",
  url: "https://jobs.lever.co/example/composer",
  publishedAt: "2026-08-20T00:00:00.000Z",
  ageHours: 4,
  budgetLabel: "$2,000 fixed",
  tags: ["Game music", "Paid", "Remote"],
  score: 100,
  scoreReasons: ["music role detected", "payment details found"],
};

test("round-trips the complete saved opportunity snapshot", () => {
  const serialized = serializeSavedOpportunities([liveOpportunity]);

  assert.deepEqual(parseSavedOpportunities(serialized), [liveOpportunity]);
  assert.match(serialized, /"version":1/);
  assert.match(serialized, /Composer for a live game/);
});

test("migrates legacy saved IDs when a matching snapshot is available", () => {
  assert.deepEqual(
    parseSavedOpportunities(JSON.stringify([liveOpportunity.id]), [liveOpportunity]),
    [liveOpportunity],
  );
});

test("keeps saved live opportunities after the current results change", () => {
  const currentOpportunity = { ...liveOpportunity, id: "rss-current", source: "RSS" as const };

  assert.deepEqual(mergeOpportunities([currentOpportunity], [liveOpportunity]), [
    currentOpportunity,
    liveOpportunity,
  ]);
  assert.deepEqual(mergeOpportunities([liveOpportunity], [liveOpportunity]), [liveOpportunity]);
});

test("rejects malformed saved snapshots", () => {
  const malformed = JSON.stringify({
    version: 1,
    opportunities: [{ id: "missing-required-fields" }],
  });

  assert.throws(() => parseSavedOpportunities(malformed), /invalid data/);
});
