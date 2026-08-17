import type { Opportunity } from "../lib/opportunity";

export type RssCollectorOptions = {
  feedUrls: string[];
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
};

const MAX_FEEDS = 5;
const MAX_FEED_BYTES = 1_000_000;

export class RssCollectorError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "RssCollectorError";
  }
}

function decodeXml(value: string) {
  return value
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1")
    .replace(/&#(x?[\da-f]+);/gi, (_, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const value = Number.parseInt(code.replace(/^x/i, ""), radix);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function cleanText(value: string) {
  return decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function element(fragment: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = fragment.match(
      new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"),
    );
    if (match) return match[1];
  }
  return "";
}

function entryLink(fragment: string) {
  const textLink = cleanText(element(fragment, ["link"]));
  if (textLink) return textLink;

  const alternate = fragment.match(
    /<link\b(?=[^>]*\bhref=["']([^"']+)["'])(?=[^>]*\brel=["']alternate["'])[^>]*\/?>/i,
  );
  const anyLink = fragment.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  return decodeXml(alternate?.[1] ?? anyLink?.[1] ?? "").trim();
}

function budgetLabel(text: string) {
  const range = text.match(/[$€£]\s?\d[\d,]*(?:\s?[-–]\s?[$€£]?\s?\d[\d,]*)?/);
  if (range) return range[0];
  if (/\b(paid|budget|rate|compensation)\b/i.test(text)) return "Paid — amount unclear";
  return "Budget unclear";
}

function stableId(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `rss-${(hash >>> 0).toString(36)}`;
}

export function parseSyndicationFeed(xml: string, feedUrl: string, now = new Date()) {
  const fragments = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  const feedTitle = cleanText(element(xml, ["title"])) || new URL(feedUrl).hostname;
  const fallbackDate = new Date(now.getTime() - 30 * 24 * 3_600_000);

  return fragments.flatMap((fragment): Opportunity[] => {
    const title = cleanText(element(fragment, ["title"]));
    const rawLink = entryLink(fragment);
    if (!title || !rawLink) return [];

    let url: string;
    try {
      url = new URL(rawLink, feedUrl).toString();
    } catch {
      return [];
    }

    const description =
      cleanText(element(fragment, ["description", "summary", "content:encoded", "content"])) ||
      "No description provided.";
    const rawDate = cleanText(element(fragment, ["pubDate", "published", "updated", "dc:date"]));
    const parsedDate = rawDate ? new Date(rawDate) : fallbackDate;
    const publishedAt = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
    const ageHours = Math.max(
      0,
      Math.floor((now.getTime() - publishedAt.getTime()) / 3_600_000),
    );
    const identity = cleanText(element(fragment, ["guid", "id"])) || url;

    return [{
      id: stableId(`${feedUrl}:${identity}`),
      title,
      description,
      source: "RSS",
      community: feedTitle,
      url,
      publishedAt: publishedAt.toISOString(),
      ageHours,
      budgetLabel: budgetLabel(`${title} ${description}`),
      tags: ["RSS"],
    }];
  });
}

function validateFeedUrls(feedUrls: string[]) {
  if (feedUrls.length > MAX_FEEDS) {
    throw new RssCollectorError(`At most ${MAX_FEEDS} RSS feeds can be configured`);
  }

  return feedUrls.map((feedUrl) => {
    const url = new URL(feedUrl);
    if (url.protocol !== "https:") {
      throw new RssCollectorError("RSS feed URLs must use HTTPS");
    }
    return url.toString();
  });
}

export async function collectRssOpportunities(options: RssCollectorOptions) {
  const { fetchImpl = fetch, now = new Date() } = options;
  const feedUrls = validateFeedUrls(options.feedUrls);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const feeds = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      const response = await fetchImpl(feedUrl, {
        headers: {
          Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
          "User-Agent": "ScoreScout/0.1 (RSS reader)",
        },
      });

      if (!response.ok) {
        throw new RssCollectorError("RSS feed request failed", response.status);
      }

      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_FEED_BYTES) {
        throw new RssCollectorError("RSS feed is too large");
      }

      const xml = await response.text();
      if (xml.length > MAX_FEED_BYTES) {
        throw new RssCollectorError("RSS feed is too large");
      }

      return parseSyndicationFeed(xml, feedUrl, now);
    }),
  );

  return feeds.flat().slice(0, limit);
}
