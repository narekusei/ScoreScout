import type { Opportunity } from "../lib/opportunity";
import { requestWithTimeout } from "../lib/fetch-with-timeout";

export type GreenhouseCollectorOptions = {
  boardTokens: string[];
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type GreenhouseJob = {
  id: number;
  title: string;
  location?: { name?: string };
  updated_at?: string;
  absolute_url: string;
  content?: string;
};

type GreenhouseJobsResponse = {
  jobs?: GreenhouseJob[];
};

const API_URL = "https://boards-api.greenhouse.io/v1/boards";
const MAX_BOARDS = 5;
const MAX_RESPONSE_BYTES = 5_000_000;

export class GreenhouseCollectorError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GreenhouseCollectorError";
  }
}

function cleanText(value: string) {
  return value
    .replace(/&#(x?[\da-f]+);/gi, (_, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const parsed = Number.parseInt(code.replace(/^x/i, ""), radix);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function budgetLabel(text: string) {
  const range = text.match(/[$€£]\s?\d[\d,]*(?:\s?[-–]\s?[$€£]?\s?\d[\d,]*)?/);
  if (range) return range[0];
  if (/\b(paid|budget|rate|salary|compensation)\b/i.test(text)) {
    return "Paid — amount unclear";
  }
  return "Budget unclear";
}

function validateBoardTokens(boardTokens: string[]) {
  if (boardTokens.length > MAX_BOARDS) {
    throw new GreenhouseCollectorError(`At most ${MAX_BOARDS} Greenhouse boards can be configured`);
  }

  return boardTokens.map((token) => {
    const normalized = token.trim();
    if (!/^[a-z0-9_-]+$/i.test(normalized)) {
      throw new GreenhouseCollectorError(
        "Greenhouse board tokens may contain only letters, numbers, hyphens, and underscores",
      );
    }
    return normalized;
  });
}

export function greenhouseJobToOpportunity(
  job: GreenhouseJob,
  boardToken: string,
  now = new Date(),
): Opportunity | null {
  if (!job.id || !job.title?.trim() || !job.absolute_url) return null;

  let url: URL;
  try {
    url = new URL(job.absolute_url);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;

  const fallbackDate = new Date(now.getTime() - 30 * 24 * 3_600_000);
  const parsedDate = job.updated_at ? new Date(job.updated_at) : fallbackDate;
  const publishedAt = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  const description = cleanText(job.content ?? "") || "No description provided.";
  const location = job.location?.name?.trim() || "Location not specified";
  const tags = ["Greenhouse"];
  if (/remote/i.test(location)) tags.push("Remote");

  return {
    id: `greenhouse-${boardToken}-${job.id}`,
    title: cleanText(job.title),
    description,
    source: "Greenhouse",
    community: `${boardToken} · ${location}`,
    url: url.toString(),
    publishedAt: publishedAt.toISOString(),
    ageHours: Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / 3_600_000)),
    budgetLabel: budgetLabel(`${job.title} ${description}`),
    tags,
  };
}

export async function collectGreenhouseOpportunities(options: GreenhouseCollectorOptions) {
  const { fetchImpl = fetch, now = new Date() } = options;
  const boardTokens = validateBoardTokens(options.boardTokens);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const boards = await Promise.all(
    boardTokens.map(async (boardToken) => {
      return requestWithTimeout(async (signal) => {
        const response = await fetchImpl(
          `${API_URL}/${encodeURIComponent(boardToken)}/jobs?content=true`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "ScoreScout/0.1 (public Greenhouse Job Board API client)",
            },
            signal,
          },
        );

        if (!response.ok) {
          throw new GreenhouseCollectorError("Greenhouse job board request failed", response.status);
        }

        const declaredSize = Number(response.headers.get("content-length") ?? 0);
        if (declaredSize > MAX_RESPONSE_BYTES) {
          throw new GreenhouseCollectorError("Greenhouse job board response is too large");
        }

        const body = await response.text();
        if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
          throw new GreenhouseCollectorError("Greenhouse job board response is too large");
        }

        let payload: GreenhouseJobsResponse;
        try {
          payload = JSON.parse(body) as GreenhouseJobsResponse;
        } catch {
          throw new GreenhouseCollectorError("Greenhouse job board returned invalid JSON");
        }

        return (payload.jobs ?? []).flatMap((job) => {
          const opportunity = greenhouseJobToOpportunity(job, boardToken, now);
          return opportunity ? [opportunity] : [];
        });
      }, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      });
    }),
  );

  return boards.flat().slice(0, limit);
}
