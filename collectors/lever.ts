import type { Opportunity } from "../lib/opportunity";

export type LeverCollectorOptions = {
  siteNames: string[];
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
};

type LeverPosting = {
  id: string;
  text: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
  };
  descriptionPlain?: string;
  additionalPlain?: string;
  hostedUrl: string;
  workplaceType?: "unspecified" | "on-site" | "remote" | "hybrid";
  salaryRange?: {
    currency?: string;
    interval?: string;
    min?: number;
    max?: number;
  };
  salaryDescriptionPlain?: string;
  createdAt?: number;
};

const API_URL = "https://api.lever.co/v0/postings";
const MAX_SITES = 5;
const MAX_RESPONSE_BYTES = 5_000_000;

export class LeverCollectorError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "LeverCollectorError";
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatSalary(posting: LeverPosting) {
  const description = cleanText(posting.salaryDescriptionPlain ?? "");
  if (description) return description;

  const { currency, interval, min, max } = posting.salaryRange ?? {};
  if (typeof min !== "number" && typeof max !== "number") return "Budget unclear";

  const amount = [min, max]
    .filter((value): value is number => typeof value === "number")
    .map((value) => value.toLocaleString("en-US"))
    .join("–");
  return `${currency ?? "Salary"} ${amount}${interval ? ` / ${interval}` : ""}`;
}

function validateSiteNames(siteNames: string[]) {
  if (siteNames.length > MAX_SITES) {
    throw new LeverCollectorError(`At most ${MAX_SITES} Lever sites can be configured`);
  }

  return siteNames.map((siteName) => {
    const normalized = siteName.trim();
    if (!/^[a-z0-9_-]+$/i.test(normalized)) {
      throw new LeverCollectorError(
        "Lever site names may contain only letters, numbers, hyphens, and underscores",
      );
    }
    return normalized;
  });
}

export function leverPostingToOpportunity(
  posting: LeverPosting,
  siteName: string,
  now = new Date(),
): Opportunity | null {
  if (!posting.id?.trim() || !posting.text?.trim() || !posting.hostedUrl) return null;

  let url: URL;
  try {
    url = new URL(posting.hostedUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !["jobs.lever.co", "jobs.eu.lever.co"].includes(url.hostname)) {
    return null;
  }

  const fallbackDate = new Date(now.getTime() - 30 * 24 * 3_600_000);
  const parsedDate = typeof posting.createdAt === "number" ? new Date(posting.createdAt) : fallbackDate;
  const publishedAt = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  const description = cleanText(
    [posting.descriptionPlain, posting.additionalPlain].filter(Boolean).join(" "),
  ) || "No description provided.";
  const location = cleanText(posting.categories?.location ?? "") || "Location not specified";
  const tags = ["Lever"];
  if (posting.categories?.team) tags.push(cleanText(posting.categories.team));
  if (posting.categories?.commitment) tags.push(cleanText(posting.categories.commitment));
  if (posting.workplaceType === "remote" || /remote/i.test(location)) tags.push("Remote");

  return {
    id: `lever-${siteName}-${posting.id}`,
    title: cleanText(posting.text),
    description,
    source: "Lever",
    community: `${siteName} · ${location}`,
    url: url.toString(),
    publishedAt: publishedAt.toISOString(),
    ageHours: Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / 3_600_000)),
    budgetLabel: formatSalary(posting),
    tags: [...new Set(tags)],
  };
}

export async function collectLeverOpportunities(options: LeverCollectorOptions) {
  const { fetchImpl = fetch, now = new Date() } = options;
  const siteNames = validateSiteNames(options.siteNames);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const sites = await Promise.all(
    siteNames.map(async (siteName) => {
      const response = await fetchImpl(
        `${API_URL}/${encodeURIComponent(siteName)}?mode=json&limit=100`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "ScoreScout/0.1 (public Lever Postings API client)",
          },
        },
      );

      if (!response.ok) {
        throw new LeverCollectorError("Lever job site request failed", response.status);
      }

      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_RESPONSE_BYTES) {
        throw new LeverCollectorError("Lever job site response is too large");
      }

      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
        throw new LeverCollectorError("Lever job site response is too large");
      }

      let payload: LeverPosting[];
      try {
        payload = JSON.parse(body) as LeverPosting[];
      } catch {
        throw new LeverCollectorError("Lever job site returned invalid JSON");
      }
      if (!Array.isArray(payload)) {
        throw new LeverCollectorError("Lever job site returned an unexpected response");
      }

      return payload.flatMap((posting) => {
        const opportunity = leverPostingToOpportunity(posting, siteName, now);
        return opportunity ? [opportunity] : [];
      });
    }),
  );

  return sites.flat().slice(0, limit);
}
