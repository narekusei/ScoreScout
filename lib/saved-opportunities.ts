import type { ScoredOpportunity } from "./opportunity";

const storageVersion = 1;

type SavedOpportunitiesStore = {
  version: typeof storageVersion;
  opportunities: ScoredOpportunity[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isScoredOpportunity(value: unknown): value is ScoredOpportunity {
  if (!value || typeof value !== "object") return false;

  const opportunity = value as Record<string, unknown>;

  return (
    typeof opportunity.id === "string" &&
    typeof opportunity.title === "string" &&
    typeof opportunity.description === "string" &&
    typeof opportunity.source === "string" &&
    typeof opportunity.community === "string" &&
    typeof opportunity.url === "string" &&
    typeof opportunity.publishedAt === "string" &&
    typeof opportunity.ageHours === "number" &&
    Number.isFinite(opportunity.ageHours) &&
    typeof opportunity.budgetLabel === "string" &&
    isStringArray(opportunity.tags) &&
    typeof opportunity.score === "number" &&
    Number.isFinite(opportunity.score) &&
    isStringArray(opportunity.scoreReasons)
  );
}

export function serializeSavedOpportunities(opportunities: ScoredOpportunity[]) {
  const store: SavedOpportunitiesStore = {
    version: storageVersion,
    opportunities,
  };

  return JSON.stringify(store);
}

export function parseSavedOpportunities(
  rawValue: string,
  legacyCandidates: ScoredOpportunity[] = [],
) {
  const parsed: unknown = JSON.parse(rawValue);

  if (isStringArray(parsed)) {
    const savedIds = new Set(parsed);
    return legacyCandidates.filter((opportunity) => savedIds.has(opportunity.id));
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Saved opportunities must be an object");
  }

  const store = parsed as Record<string, unknown>;
  if (store.version !== storageVersion || !Array.isArray(store.opportunities)) {
    throw new Error("Unsupported saved opportunities format");
  }

  if (!store.opportunities.every(isScoredOpportunity)) {
    throw new Error("Saved opportunities contain invalid data");
  }

  return store.opportunities;
}

export function mergeOpportunities(
  current: ScoredOpportunity[],
  saved: ScoredOpportunity[],
) {
  const merged = [...current];
  const knownIds = new Set(current.map((opportunity) => opportunity.id));

  for (const opportunity of saved) {
    if (!knownIds.has(opportunity.id)) {
      merged.push(opportunity);
      knownIds.add(opportunity.id);
    }
  }

  return merged;
}
