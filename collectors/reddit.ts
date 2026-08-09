import type { Opportunity } from "../lib/opportunity";

export type RedditCredentials = {
  clientId: string;
  clientSecret: string;
  userAgent: string;
};

type RedditPost = {
  id: string;
  title: string;
  selftext?: string;
  subreddit: string;
  permalink: string;
  created_utc: number;
};

type RedditListing = {
  data: {
    children: Array<{ data: RedditPost }>;
  };
};

export type RedditCollectorOptions = {
  credentials: RedditCredentials;
  communities: string[];
  query: string;
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
};

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_URL = "https://oauth.reddit.com";

export class RedditCollectorError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "RedditCollectorError";
  }
}

function validateCredentials(credentials: RedditCredentials) {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.userAgent) {
    throw new RedditCollectorError("Reddit credentials and user agent are required");
  }
}

function extractBudget(text: string) {
  const range = text.match(/[$€£]\s?\d[\d,]*(?:\s?[-–]\s?[$€£]?\s?\d[\d,]*)?/);
  if (range) return range[0];
  if (/\b(paid|budget|rate)\b/i.test(text)) return "Paid — amount unclear";
  return "Budget unclear";
}

export function redditPostToOpportunity(post: RedditPost, now = new Date()): Opportunity {
  const description = post.selftext?.trim() || "No description provided.";
  const publishedAt = new Date(post.created_utc * 1000);
  const ageHours = Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / 3_600_000));

  return {
    id: `reddit-${post.id}`,
    title: post.title,
    description,
    source: "Reddit",
    community: `r/${post.subreddit}`,
    url: `https://www.reddit.com${post.permalink}`,
    publishedAt: publishedAt.toISOString(),
    ageHours,
    budgetLabel: extractBudget(`${post.title} ${description}`),
    tags: ["Reddit", "Remote"],
  };
}

async function getAccessToken(credentials: RedditCredentials, fetchImpl: typeof fetch) {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": credentials.userAgent,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    throw new RedditCollectorError("Reddit OAuth authentication failed", response.status);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new RedditCollectorError("Reddit OAuth response did not include an access token");
  }

  return payload.access_token;
}

export async function collectRedditOpportunities(options: RedditCollectorOptions) {
  const { credentials, communities, query, now = new Date(), fetchImpl = fetch } = options;
  validateCredentials(credentials);

  if (!communities.length || !query.trim()) return [];

  const accessToken = await getAccessToken(credentials, fetchImpl);
  const subredditPath = communities.map((name) => name.replace(/^r\//, "")).join("+");
  const params = new URLSearchParams({
    q: query.trim(),
    restrict_sr: "on",
    sort: "new",
    t: "week",
    limit: String(Math.min(Math.max(options.limit ?? 50, 1), 100)),
  });

  const response = await fetchImpl(`${API_URL}/r/${subredditPath}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": credentials.userAgent,
    },
  });

  if (!response.ok) {
    throw new RedditCollectorError("Reddit search request failed", response.status);
  }

  const listing = (await response.json()) as RedditListing;
  return listing.data.children.map(({ data }) => redditPostToOpportunity(data, now));
}
