import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  clearRedditTokenCache,
  collectRedditOpportunities,
  RedditCollectorError,
} from "../collectors/reddit";

const credentials = {
  clientId: "test-client",
  clientSecret: "test-secret",
  userAgent: "web:scorescout-tests:v1.0 (by /u/tester)",
};

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "oauth-token", expires_in: 3_600 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function listingResponse() {
  return new Response(JSON.stringify({
    data: {
      children: [{
        data: {
          id: "abc123",
          title: "Composer needed for a paid indie game",
          selftext: "Budget is $1,500 for an original soundtrack.",
          subreddit: "gameDevClassifieds",
          permalink: "/r/gameDevClassifieds/comments/abc123/composer_needed/",
          created_utc: 1_788_508_800,
        },
      }],
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => clearRedditTokenCache());

test("authenticates, searches selected communities, and normalizes Reddit posts", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    return requests.length === 1 ? tokenResponse() : listingResponse();
  };

  const results = await collectRedditOpportunities({
    credentials,
    communities: ["gameDevClassifieds", "r/GameAudio"],
    query: 'composer OR "game music"',
    now: new Date("2026-09-06T02:00:00.000Z"),
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://www.reddit.com/api/v1/access_token");
  assert.match(String(requests[0].init?.headers && new Headers(requests[0].init.headers).get("authorization")), /^Basic /);
  assert.match(requests[1].url, /gameDevClassifieds\+GameAudio\/search/);
  assert.match(requests[1].url, /restrict_sr=on/);
  assert.equal(new Headers(requests[1].init?.headers).get("authorization"), "Bearer oauth-token");
  assert.deepEqual(results[0], {
    id: "reddit-abc123",
    title: "Composer needed for a paid indie game",
    description: "Budget is $1,500 for an original soundtrack.",
    source: "Reddit",
    community: "r/gameDevClassifieds",
    url: "https://www.reddit.com/r/gameDevClassifieds/comments/abc123/composer_needed/",
    publishedAt: "2026-09-04T08:00:00.000Z",
    ageHours: 42,
    budgetLabel: "$1,500",
    tags: ["Reddit", "Remote"],
  });
});

test("reuses the OAuth token while it remains valid", async () => {
  let tokenRequests = 0;
  const fetchImpl = async (input: string | URL | Request) => {
    if (input.toString().includes("access_token")) {
      tokenRequests += 1;
      return tokenResponse();
    }
    return listingResponse();
  };
  const options = {
    credentials,
    communities: ["MusicJobs"],
    query: "composer",
    fetchImpl: fetchImpl as typeof fetch,
  };

  await collectRedditOpportunities(options);
  await collectRedditOpportunities(options);

  assert.equal(tokenRequests, 1);
});

test("returns an empty array for a valid empty Reddit listing", async () => {
  const responses = [
    tokenResponse(),
    new Response(JSON.stringify({ data: { children: [] } }), { status: 200 }),
  ];
  const results = await collectRedditOpportunities({
    credentials,
    communities: ["MusicJobs"],
    query: "composer",
    fetchImpl: (async () => responses.shift()!) as typeof fetch,
  });

  assert.deepEqual(results, []);
});

test("reports Reddit rate limits with the retry delay", async () => {
  const responses = [
    tokenResponse(),
    new Response("rate limited", {
      status: 429,
      headers: { "x-ratelimit-reset": "17.2" },
    }),
  ];

  await assert.rejects(
    collectRedditOpportunities({
      credentials,
      communities: ["MusicJobs"],
      query: "composer",
      fetchImpl: (async () => responses.shift()!) as typeof fetch,
    }),
    (error: unknown) =>
      error instanceof RedditCollectorError &&
      error.status === 429 &&
      error.retryAfterSeconds === 18,
  );
});

test("rejects malformed API responses without leaking implementation errors", async () => {
  const responses = [tokenResponse(), new Response(JSON.stringify({ data: {} }), { status: 200 })];

  await assert.rejects(
    collectRedditOpportunities({
      credentials,
      communities: ["MusicJobs"],
      query: "composer",
      fetchImpl: (async () => responses.shift()!) as typeof fetch,
    }),
    (error: unknown) =>
      error instanceof RedditCollectorError &&
      error.message === "Reddit search returned an unexpected response",
  );
});
