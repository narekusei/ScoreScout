import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpportunitiesHandler,
} from "../app/api/opportunities/route";
import { RedditCollectorError } from "../collectors/reddit";
import type { Opportunity } from "../lib/opportunity";

const opportunity: Opportunity = {
  id: "test-composer-role",
  title: "Composer needed for an indie game",
  description: "Looking for a composer for a paid soundtrack.",
  source: "RSS",
  community: "Test feed",
  url: "https://example.com/jobs/composer",
  publishedAt: "2026-09-05T00:00:00.000Z",
  ageHours: 2,
  budgetLabel: "$1,000 fixed",
  tags: ["Paid", "Remote"],
};

function request(query = "composer") {
  return new Request(`https://scorescout.test/api/opportunities?q=${encodeURIComponent(query)}`);
}

test("returns 503 when no sources are configured", async () => {
  const response = await createOpportunitiesHandler({ env: {} })(request());
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.error, "sources_not_configured");
});

test("searches configured sources and returns matching scored opportunities", async () => {
  const handler = createOpportunitiesHandler({
    env: { RSS_FEED_URLS: "https://example.com/jobs.xml" },
    collectRss: async (options) => {
      assert.deepEqual(options.feedUrls, ["https://example.com/jobs.xml"]);
      return [opportunity];
    },
  });

  const response = await handler(request("composer"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.opportunities.length, 1);
  assert.equal(body.opportunities[0].id, opportunity.id);
  assert.ok(body.opportunities[0].score >= 45);
  assert.equal(body.meta.collected, 1);
  assert.equal(body.meta.returned, 1);
});

test("limits search queries to 120 characters", async () => {
  const handler = createOpportunitiesHandler({
    env: { RSS_FEED_URLS: "https://example.com/jobs.xml" },
    collectRss: async () => [],
  });

  const response = await handler(request("x".repeat(200)));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.meta.query, "x".repeat(120));
});

test("returns an empty successful result when collectors find no matches", async () => {
  const handler = createOpportunitiesHandler({
    env: { RSS_FEED_URLS: "https://example.com/jobs.xml" },
    collectRss: async () => [{
      ...opportunity,
      id: "unrelated-role",
      title: "Senior backend engineer",
      description: "Build distributed services.",
    }],
  });

  const response = await handler(request("composer"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.opportunities, []);
  assert.equal(body.meta.collected, 1);
  assert.equal(body.meta.returned, 0);
});

test("preserves results and reports details when one source partially fails", async () => {
  const handler = createOpportunitiesHandler({
    env: {
      RSS_FEED_URLS: "https://good.test/feed.xml,https://bad.test/feed.xml",
      LEVER_SITE_NAMES: "broken-site",
    },
    collectRss: async (options) => {
      options.onFailure?.({
        source: "RSS",
        request: "https://bad.test/feed.xml",
        message: "Feed request failed",
        status: 502,
      });
      return [opportunity];
    },
    collectLever: async () => {
      throw new Error("Lever unavailable");
    },
  });

  const response = await handler(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.opportunities.length, 1);
  assert.deepEqual(body.meta.failedSources, ["Lever"]);
  assert.equal(body.meta.failedRequests[0].request, "https://bad.test/feed.xml");
});

test("returns 502 when every configured source fails", async () => {
  const handler = createOpportunitiesHandler({
    env: {
      RSS_FEED_URLS: "https://example.com/jobs.xml",
      LEVER_SITE_NAMES: "broken-site",
    },
    collectRss: async () => {
      throw new Error("RSS unavailable");
    },
    collectLever: async () => {
      throw new Error("Lever unavailable");
    },
  });

  const response = await handler(request());
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error, "source_request_failed");
  assert.deepEqual(body.failedSources, ["RSS", "Lever"]);
});

test("returns 429 when all-source failure is caused by a rate limit", async () => {
  const handler = createOpportunitiesHandler({
    env: {
      REDDIT_CLIENT_ID: "client",
      REDDIT_CLIENT_SECRET: "secret",
      REDDIT_USER_AGENT: "scorescout-tests",
    },
    collectReddit: async () => {
      throw new RedditCollectorError("Reddit rate limit reached", 429);
    },
  });

  const response = await handler(request());
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error, "source_request_failed");
  assert.equal(body.message, "Reddit rate limit reached");
  assert.deepEqual(body.failedSources, ["Reddit"]);
});
