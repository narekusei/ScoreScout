import { collectRedditOpportunities, RedditCollectorError } from "../../../collectors/reddit";
import { collectRssOpportunities, RssCollectorError } from "../../../collectors/rss";
import {
  collectGreenhouseOpportunities,
  GreenhouseCollectorError,
} from "../../../collectors/greenhouse";
import { collectLeverOpportunities, LeverCollectorError } from "../../../collectors/lever";
import { scoreOpportunity, type Opportunity } from "../../../lib/opportunity";
import { matchesOpportunityQuery } from "../../../lib/opportunity-search";

const DEFAULT_QUERY = 'composer OR "game music" OR soundtrack OR "film score"';
const COMMUNITIES = ["gameDevClassifieds", "INAT", "MusicJobs", "GameAudio"];

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function getCredentials() {
  return {
    clientId: process.env.REDDIT_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET?.trim() ?? "",
    userAgent: process.env.REDDIT_USER_AGENT?.trim() ?? "",
  };
}

function getRssFeedUrls() {
  return (process.env.RSS_FEED_URLS ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getGreenhouseBoardTokens() {
  return (process.env.GREENHOUSE_BOARD_TOKENS ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getLeverSiteNames() {
  return (process.env.LEVER_SITE_NAMES ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const credentials = getCredentials();
  const rssFeedUrls = getRssFeedUrls();
  const greenhouseBoardTokens = getGreenhouseBoardTokens();
  const leverSiteNames = getLeverSiteNames();
  const redditConfigured = Boolean(
    credentials.clientId && credentials.clientSecret && credentials.userAgent,
  );

  if (
    !redditConfigured &&
    !rssFeedUrls.length &&
    !greenhouseBoardTokens.length &&
    !leverSiteNames.length
  ) {
    return json(
      {
        error: "sources_not_configured",
        message: "No opportunity sources are configured on this server.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q")?.trim() || DEFAULT_QUERY).slice(0, 120);

  const collectors: Array<{
    source: string;
    run: () => Promise<Opportunity[]>;
  }> = [];
  if (redditConfigured) {
    collectors.push({
      source: "Reddit",
      run: () =>
        collectRedditOpportunities({ credentials, communities: COMMUNITIES, query, limit: 50 }),
    });
  }
  if (rssFeedUrls.length) {
    collectors.push({
      source: "RSS",
      run: () => collectRssOpportunities({ feedUrls: rssFeedUrls, limit: 50 }),
    });
  }
  if (greenhouseBoardTokens.length) {
    collectors.push({
      source: "Greenhouse",
      run: () => collectGreenhouseOpportunities({ boardTokens: greenhouseBoardTokens, limit: 50 }),
    });
  }
  if (leverSiteNames.length) {
    collectors.push({
      source: "Lever",
      run: () => collectLeverOpportunities({ siteNames: leverSiteNames, limit: 50 }),
    });
  }

  const settled = await Promise.allSettled(collectors.map((collector) => collector.run()));
  const collected = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const failedSources = settled.flatMap((result, index) =>
    result.status === "rejected" ? [collectors[index].source] : [],
  );

  if (!collected.length && failedSources.length === collectors.length) {
    const firstError = settled.find((result) => result.status === "rejected");
    const reason = firstError?.status === "rejected" ? firstError.reason : undefined;
    const rateLimited =
      (reason instanceof RedditCollectorError ||
        reason instanceof GreenhouseCollectorError ||
        reason instanceof LeverCollectorError) &&
      reason.status === 429;
    const knownError =
      reason instanceof RedditCollectorError ||
      reason instanceof RssCollectorError ||
      reason instanceof GreenhouseCollectorError ||
      reason instanceof LeverCollectorError;

    return json(
      {
        error: "source_request_failed",
        message: knownError ? reason.message : "ScoreScout could not load opportunities right now.",
        failedSources,
      },
      { status: rateLimited ? 429 : 502 },
    );
  }

  const seenUrls = new Set<string>();
  const opportunities = collected
    .filter((opportunity) => matchesOpportunityQuery(opportunity, query))
    .filter((opportunity) => {
      if (seenUrls.has(opportunity.url)) return false;
      seenUrls.add(opportunity.url);
      return true;
    })
    .map(scoreOpportunity)
    .filter((opportunity) => opportunity.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  return json({
    opportunities,
    meta: {
      sources: collectors.map((collector) => collector.source),
      failedSources,
      query,
      communities: redditConfigured ? COMMUNITIES : [],
      collected: collected.length,
      returned: opportunities.length,
    },
  });
}
