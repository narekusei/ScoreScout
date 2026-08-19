import assert from "node:assert/strict";
import test from "node:test";

import { collectLeverOpportunities, leverPostingToOpportunity } from "../collectors/lever";

const now = new Date("2026-08-19T12:00:00Z");

test("normalizes a Lever posting into an opportunity", () => {
  const opportunity = leverPostingToOpportunity(
    {
      id: "audio-42",
      text: "Game Music Composer",
      categories: { location: "Remote", commitment: "Contract", team: "Audio" },
      descriptionPlain: "Seeking a composer for a paid game soundtrack.",
      additionalPlain: "Portfolio required.",
      hostedUrl: "https://jobs.lever.co/soundstudio/audio-42",
      workplaceType: "remote",
      salaryRange: { currency: "USD", min: 2000, max: 3000, interval: "project" },
      createdAt: Date.parse("2026-08-19T10:00:00Z"),
    },
    "soundstudio",
    now,
  );

  assert.ok(opportunity);
  assert.equal(opportunity.id, "lever-soundstudio-audio-42");
  assert.equal(opportunity.source, "Lever");
  assert.equal(
    opportunity.description,
    "Seeking a composer for a paid game soundtrack. Portfolio required.",
  );
  assert.equal(opportunity.budgetLabel, "USD 2,000–3,000 / project");
  assert.equal(opportunity.ageHours, 2);
  assert.deepEqual(opportunity.tags, ["Lever", "Audio", "Contract", "Remote"]);
});

test("loads jobs from the official public postings endpoint", async () => {
  let requestedUrl = "";
  const opportunities = await collectLeverOpportunities({
    siteNames: ["sound-studio"],
    now,
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify([
          {
            id: "job-7",
            text: "Audio Designer",
            categories: { location: "Tokyo" },
            descriptionPlain: "Music and sound design contract.",
            hostedUrl: "https://jobs.lever.co/sound-studio/job-7",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(
    requestedUrl,
    "https://api.lever.co/v0/postings/sound-studio?mode=json&limit=100",
  );
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].community, "sound-studio · Tokyo");
});

test("rejects unsafe Lever site names before making a request", async () => {
  let fetched = false;
  await assert.rejects(
    collectLeverOpportunities({
      siteNames: ["https://attacker.example/site"],
      fetchImpl: async () => {
        fetched = true;
        return new Response("[]");
      },
    }),
    /site names may contain only/,
  );
  assert.equal(fetched, false);
});
