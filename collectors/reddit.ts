import type { Opportunity } from "../lib/opportunity";
import { requestWithTimeout } from "../lib/fetch-with-timeout";

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

type RedditTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

export type RedditCollectorOptions = {
  credentials: RedditCredentials;
  communities: string[];
  query: string;
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_URL = "https://oauth.reddit.com";
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export class RedditCollectorError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RedditCollectorError";
  }
}

function retryAfterSeconds(response: Response) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.ceil(retryAfter);

  const resetHeader = response.headers.get("x-ratelimit-reset");
  const reset = resetHeader === null ? Number.NaN : Number(resetHeader);
  return Number.isFinite(reset) && reset >= 0 ? Math.ceil(reset) : undefined;
}

function requestError(message: string, response: Response) {
  const retryAfter = response.status === 429 ? retryAfterSeconds(response) : undefined;
  return new RedditCollectorError(message, response.status, retryAfter);
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

async function getAccessToken(
  credentials: RedditCredentials,
  fetchImpl: typeof fetch,
  timeoutMs?: number,
  signal?: AbortSignal,
) {
  const cacheKey = credentials.clientId;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  return requestWithTimeout(
    async (requestSignal) => {
      const response = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": credentials.userAgent,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        signal: requestSignal,
      });

      if (!response.ok) {
        throw requestError("Reddit OAuth authentication failed", response);
      }

      let payload: RedditTokenResponse;
      try {
        payload = (await response.json()) as RedditTokenResponse;
      } catch {
        throw new RedditCollectorError("Reddit OAuth returned invalid JSON", response.status);
      }
      if (!payload.access_token) {
        throw new RedditCollectorError("Reddit OAuth response did not include an access token");
      }

      const lifetimeMs = Math.max(0, (payload.expires_in ?? 3_600) * 1_000);
      tokenCache.set(cacheKey, {
        accessToken: payload.access_token,
        expiresAt: Date.now() + Math.max(0, lifetimeMs - TOKEN_EXPIRY_SAFETY_MS),
      });
      return payload.access_token;
    },
    { timeoutMs, signal },
  );
}

export async function collectRedditOpportunities(options: RedditCollectorOptions) {
  const { credentials, communities, query, now = new Date(), fetchImpl = fetch } = options;
  validateCredentials(credentials);

  if (!communities.length || !query.trim()) return [];

  const accessToken = await getAccessToken(
    credentials,
    fetchImpl,
    options.timeoutMs,
    options.signal,
  );
  const subredditPath = communities.map((name) => name.replace(/^r\//, "")).join("+");
  const params = new URLSearchParams({
    q: query.trim(),
    restrict_sr: "on",
    sort: "new",
    t: "week",
    limit: String(Math.min(Math.max(options.limit ?? 50, 1), 100)),
  });

  return requestWithTimeout(
    async (signal) => {
      const response = await fetchImpl(`${API_URL}/r/${subredditPath}/search?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": credentials.userAgent,
        },
        signal,
      });

      if (!response.ok) {
        throw requestError("Reddit search request failed", response);
      }

      let listing: RedditListing;
      try {
        listing = (await response.json()) as RedditListing;
      } catch {
        throw new RedditCollectorError("Reddit search returned invalid JSON", response.status);
      }
      if (!Array.isArray(listing?.data?.children)) {
        throw new RedditCollectorError("Reddit search returned an unexpected response");
      }

      return listing.data.children.flatMap(({ data }) => {
        if (
          !data ||
          typeof data.id !== "string" ||
          typeof data.title !== "string" ||
          typeof data.subreddit !== "string" ||
          typeof data.permalink !== "string" ||
          typeof data.created_utc !== "number"
        ) {
          return [];
        }
        return [redditPostToOpportunity(data, now)];
      });
    },
    { timeoutMs: options.timeoutMs, signal: options.signal },
  );
}

export function clearRedditTokenCache() {
  tokenCache.clear();
}
