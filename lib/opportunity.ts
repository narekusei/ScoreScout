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
const hiringTerms = ["looking for", "needed", "seeking", "wanted", "hiring", "commission"];
const paymentTerms = ["paid", "budget", "fixed fee", "hourly rate", "day rate", "salary"];
const selfPromotionTerms = ["for hire", "available for work", "my portfolio"];
const unpaidTerms = ["unpaid", "no budget", "volunteer", "without pay"];
const revenueShareTerms = ["revenue share", "rev share", "profit share", "royalty only"];

const currencyPattern =
  /(?:[$€£¥₹₩₽₺₴₫฿₱₦₲₡₵]|\b(?:usd|eur|gbp|jpy|cad|aud|nzd|chf|cny|rmb|inr|krw|rub|brl|mxn|sgd|hkd|sek|nok|dkk|pln|czk|zar)\b)/i;

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function scoreOpportunity(opportunity: Opportunity): ScoredOpportunity {
  const title = opportunity.title.toLowerCase();
  const description = opportunity.description.toLowerCase();
  const budget = opportunity.budgetLabel.toLowerCase();
  const text = `${title} ${description} ${budget}`;
  const reasons: string[] = [];
  let score = 15;

  if (containsAny(title, musicTerms)) {
    score += 30;
    reasons.push("music role in title");
  } else if (containsAny(description, musicTerms)) {
    score += 15;
    reasons.push("music role in description");
  }

  if (containsAny(title, hiringTerms)) {
    score += 25;
    reasons.push("clear hiring intent");
  } else if (containsAny(description, hiringTerms)) {
    score += 15;
    reasons.push("hiring intent in description");
  }

  const hasBudget = budget !== "budget unclear" && budget.trim().length > 0;
  if (hasBudget && (containsAny(text, paymentTerms) || currencyPattern.test(text))) {
    score += 15;
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

  if (containsAny(text, unpaidTerms)) {
    score -= 50;
    reasons.push("unpaid opportunity");
  }

  if (containsAny(text, revenueShareTerms)) {
    score -= 35;
    reasons.push("revenue-share compensation");
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
