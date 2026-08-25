import assert from "node:assert/strict";
import test from "node:test";

import { collectRssOpportunities, parseSyndicationFeed, RssCollectorError } from "../collectors/rss";

const now = new Date("2026-08-17T00:00:00.000Z");

test("normalizes RSS items into opportunities", () => {
  const items = parseSyndicationFeed(`
    <rss><channel><title>Music Jobs</title><item>
      <guid>brief-42</guid>
      <title>Composer needed for short film</title>
      <link>https://jobs.example/brief-42</link>
      <description><![CDATA[Paid project with a $750 budget.]]></description>
      <pubDate>Sun, 16 Aug 2026 12:00:00 GMT</pubDate>
    </item></channel></rss>
  `, "https://jobs.example/feed.xml", now);

  assert.equal(items.length, 1);
  assert.equal(items[0].source, "RSS");
  assert.equal(items[0].community, "Music Jobs");
  assert.equal(items[0].budgetLabel, "$750");
  assert.equal(items[0].ageHours, 12);
});

test("supports Atom links and resolves relative URLs", () => {
  const items = parseSyndicationFeed(`
    <feed><title>Creative Briefs</title><entry>
      <id>atom-1</id><title>Game music contract</title>
      <link rel="alternate" href="/jobs/atom-1" />
      <summary>Seeking a composer for a paid contract.</summary>
      <updated>2026-08-16T23:00:00Z</updated>
    </entry></feed>
  `, "https://briefs.example/feed.atom", now);

  assert.equal(items[0].url, "https://briefs.example/jobs/atom-1");
  assert.equal(items[0].budgetLabel, "Paid — amount unclear");
  assert.equal(items[0].ageHours, 1);
});

test("rejects non-HTTPS feeds before fetching", async () => {
  await assert.rejects(
    collectRssOpportunities({ feedUrls: ["http://jobs.example/feed.xml"] }),
    (error: unknown) => error instanceof RssCollectorError && /HTTPS/.test(error.message),
  );
});

test("keeps successful RSS feeds when a sibling feed fails", async () => {
  const failures: Array<{ source: string; target: string; message: string }> = [];
  const opportunities = await collectRssOpportunities({
    feedUrls: ["https://broken.example/feed.xml", "https://jobs.example/feed.xml"],
    now,
    onFailure: (failure) => failures.push(failure),
    fetchImpl: async (input) => {
      if (String(input).includes("broken.example")) {
        return new Response("Unavailable", { status: 503 });
      }
      return new Response(`
        <rss><channel><title>Working Feed</title><item>
          <guid>working-1</guid><title>Composer contract</title>
          <link>https://jobs.example/working-1</link>
          <description>Paid soundtrack project.</description>
        </item></channel></rss>
      `);
    },
  });

  assert.equal(opportunities.length, 1);
  assert.deepEqual(failures, [{
    source: "RSS",
    target: "https://broken.example/feed.xml",
    message: "RSS feed request failed",
  }]);
});

test("still rejects when every configured RSS feed fails", async () => {
  const failures: unknown[] = [];
  await assert.rejects(
    collectRssOpportunities({
      feedUrls: ["https://one.example/feed.xml", "https://two.example/feed.xml"],
      onFailure: (failure) => failures.push(failure),
      fetchImpl: async () => new Response("Unavailable", { status: 503 }),
    }),
    RssCollectorError,
  );
  assert.equal(failures.length, 2);
});
