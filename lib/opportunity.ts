export type OpportunitySource =
  | "Reddit"
  | "RSS"
  | "Greenhouse"
  | "Lever"
  | "ProductionHub"
  | "Other";

export type Opportunity = {
  id: string;
  title: string;
  description: string;
  source: OpportunitySource;
  community: string;
  url: string;
  publishedAt: string;
  ageHours: number;
  budgetLabel: string;
  tags: string[];
};

export type ScoredOpportunity = Opportunity & {
  score: number;
  scoreReasons: string[];
};

const musicTerms = ["composer", "music", "score", "soundtrack", "sound designer"];
const hiringTerms = ["looking for", "needed", "seeking", "contract", "hire"];
const paymentTerms = ["paid", "budget", "fixed", "$", "rate"];
const selfPromotionTerms = ["for hire", "available for work", "my portfolio"];

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function scoreOpportunity(opportunity: Opportunity): ScoredOpportunity {
  const text = `${opportunity.title} ${opportunity.description} ${opportunity.budgetLabel}`.toLowerCase();
  const reasons: string[] = [];
  let score = 20;

  if (containsAny(text, musicTerms)) {
    score += 25;
    reasons.push("music role detected");
  }

  if (containsAny(text, hiringTerms)) {
    score += 25;
    reasons.push("clear hiring intent");
  }

  if (containsAny(text, paymentTerms) && opportunity.budgetLabel !== "Budget unclear") {
    score += 20;
    reasons.push("payment details found");
  }

  if (opportunity.ageHours <= 24) {
    score += 10;
    reasons.push("posted in the last 24 hours");
  } else if (opportunity.ageHours <= 72) {
    score += 5;
    reasons.push("recent post");
  }

  if (containsAny(text, selfPromotionTerms)) {
    score -= 45;
    reasons.push("possible self-promotion");
  }

  return { ...opportunity, score: Math.max(0, Math.min(100, score)), scoreReasons: reasons };
}

const sampleOpportunities: Opportunity[] = [
  {
    id: "reddit-indie-game-composer",
    title: "Composer needed for a narrative indie game",
    description: "Small studio looking for an original atmospheric score. Paid contract, 8–10 tracks.",
    source: "Reddit",
    community: "r/gameDevClassifieds",
    url: "#",
    publishedAt: "2026-08-08T06:00:00Z",
    ageHours: 2,
    budgetLabel: "$1,200–$2,000",
    tags: ["Game music", "Paid", "Remote"],
  },
  {
    id: "productionhub-short-film",
    title: "Composer sought for a 12-minute short film",
    description: "Director seeking a composer for a festival-bound drama. Paid project with references and timeline included.",
    source: "ProductionHub",
    community: "Film & TV",
    url: "#",
    publishedAt: "2026-08-08T03:00:00Z",
    ageHours: 5,
    budgetLabel: "$600 fixed",
    tags: ["Film score", "Paid", "Deadline"],
  },
  {
    id: "reddit-mobile-puzzle-audio",
    title: "Sound designer and composer needed for mobile puzzle game",
    description: "Early-stage team is looking for UI sounds and a short adaptive soundtrack. Budget to be discussed.",
    source: "Reddit",
    community: "r/INAT",
    url: "#",
    publishedAt: "2026-08-07T07:00:00Z",
    ageHours: 25,
    budgetLabel: "Budget unclear",
    tags: ["Sound design", "Mobile", "Remote"],
  },
];

export const opportunities = sampleOpportunities
  .map(scoreOpportunity)
  .sort((a, b) => b.score - a.score);
