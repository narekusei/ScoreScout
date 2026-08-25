import assert from "node:assert/strict";
import test from "node:test";

import {
  collectGreenhouseOpportunities,
  greenhouseJobToOpportunity,
} from "../collectors/greenhouse";

const now = new Date("2026-08-18T12:00:00Z");

test("normalizes a Greenhouse job into an opportunity", () => {
  const opportunity = greenhouseJobToOpportunity(
    {
      id: 42,
      title: "Game Music Composer",
      location: { name: "Remote" },
      updated_at: "2026-08-18T10:00:00Z",
      absolute_url: "https://example.com/jobs/42",
      content: "<p>Seeking a composer for a paid project with a $2,000 budget.</p>",
    },
    "soundstudio",
    now,
  );

  assert.ok(opportunity);
  assert.equal(opportunity.id, "greenhouse-soundstudio-42");
  assert.equal(opportunity.source, "Greenhouse");
  assert.equal(opportunity.description, "Seeking a composer for a paid project with a $2,000 budget.");
  assert.equal(opportunity.budgetLabel, "$2,000");
  assert.equal(opportunity.ageHours, 2);
  assert.deepEqual(opportunity.tags, ["Greenhouse", "Remote"]);
});

test("loads jobs from the official public board endpoint", async () => {
  let requestedUrl = "";
  const opportunities = await collectGreenhouseOpportunities({
    boardTokens: ["sound-studio"],
    now,
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        jobs: [{
          id: 7,
          title: "Audio Designer",
          location: { name: "Tokyo" },
          updated_at: "2026-08-18T11:00:00Z",
          absolute_url: "https://example.com/jobs/7",
          content: "<p>Music and sound design contract.</p>",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.equal(
    requestedUrl,
    "https://boards-api.greenhouse.io/v1/boards/sound-studio/jobs?content=true",
  );
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].community, "sound-studio · Tokyo");
});

test("rejects unsafe Greenhouse board tokens before making a request", async () => {
  let fetched = false;
  await assert.rejects(
    collectGreenhouseOpportunities({
      boardTokens: ["https://attacker.example/board"],
      fetchImpl: async () => {
        fetched = true;
        return new Response("{}");
      },
    }),
    /board tokens may contain only/,
  );
  assert.equal(fetched, false);
});

test("keeps successful Greenhouse boards when a sibling board fails", async () => {
  const failures: Array<{ source: string; target: string; message: string }> = [];
  const opportunities = await collectGreenhouseOpportunities({
    boardTokens: ["broken-board", "sound-studio"],
    now,
    onFailure: (failure) => failures.push(failure),
    fetchImpl: async (input) => {
      if (String(input).includes("broken-board")) {
        return new Response("Unavailable", { status: 503 });
      }
      return new Response(JSON.stringify({
        jobs: [{
          id: 9,
          title: "Composer",
          location: { name: "Remote" },
          absolute_url: "https://example.com/jobs/9",
          content: "Paid music contract.",
        }],
      }));
    },
  });

  assert.equal(opportunities.length, 1);
  assert.deepEqual(failures, [{
    source: "Greenhouse",
    target: "broken-board",
    message: "Greenhouse job board request failed",
  }]);
});
