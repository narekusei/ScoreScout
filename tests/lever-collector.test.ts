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
  assert.equal(opportunity.ageHours, 720);
  assert.equal(opportunity.publishedAt, "2026-07-20T12:00:00.000Z");
  assert.deepEqual(opportunity.tags, ["Lever", "Audio", "Contract", "Remote"]);
});

test("prefers a normalized structured salary and supports non-dollar currencies", () => {
  const opportunity = leverPostingToOpportunity({
    id: "audio-yen",
    text: "Audio Designer",
    hostedUrl: "https://jobs.lever.co/soundstudio/audio-yen",
    salaryRange: { currency: "JPY", min: 4000000, max: 6000000, interval: "year" },
    salaryDescriptionPlain: "Competitive salary",
  }, "soundstudio", now);

  assert.equal(opportunity?.budgetLabel, "JPY 4,000,000–6,000,000 / year");
});

test("preserves salary descriptions when Lever has no structured range", () => {
  const opportunity = leverPostingToOpportunity({
    id: "audio-description",
    text: "Composer",
    hostedUrl: "https://jobs.lever.co/soundstudio/audio-description",
    salaryDescriptionPlain: "€500 per day",
  }, "soundstudio", now);

  assert.equal(opportunity?.budgetLabel, "€500 per day");
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

test("keeps successful Lever sites when a sibling site fails", async () => {
  const failures: Array<{ source: string; target: string; message: string }> = [];
  const opportunities = await collectLeverOpportunities({
    siteNames: ["broken-site", "sound-studio"],
    now,
    onFailure: (failure) => failures.push(failure),
    fetchImpl: async (input) => {
      if (String(input).includes("broken-site")) {
        return new Response("Unavailable", { status: 503 });
      }
      return new Response(JSON.stringify([{
        id: "job-9",
        text: "Composer",
        categories: { location: "Remote" },
        descriptionPlain: "Paid music contract.",
        hostedUrl: "https://jobs.lever.co/sound-studio/job-9",
      }]));
    },
  });

  assert.equal(opportunities.length, 1);
  assert.deepEqual(failures, [{
    source: "Lever",
    target: "broken-site",
    message: "Lever job site request failed",
  }]);
});
