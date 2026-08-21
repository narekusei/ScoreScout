import type { Opportunity } from "./opportunity";

function searchTerms(query: string) {
  const terms: string[] = [];
  let current = "";
  let quote = "";

  function addCurrent() {
    const term = current.trim().toLocaleLowerCase();
    if (term) terms.push(term);
    current = "";
  }

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];

    if (quote) {
      if (character === quote) {
        quote = "";
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"') {
      quote = character;
      continue;
    }

    if (character === ",") {
      addCurrent();
      continue;
    }

    const remaining = query.slice(index);
    const operator = remaining.match(/^\s+OR\s+/i);
    if (operator) {
      addCurrent();
      index += operator[0].length - 1;
      continue;
    }

    current += character;
  }

  addCurrent();
  return [...new Set(terms)];
}

export function matchesOpportunityQuery(opportunity: Opportunity, query: string) {
  const terms = searchTerms(query);
  if (!terms.length) return true;

  const searchableText = [
    opportunity.title,
    opportunity.description,
    opportunity.community,
    opportunity.budgetLabel,
    ...opportunity.tags,
  ]
    .join(" ")
    .toLocaleLowerCase();

  return terms.some((term) => searchableText.includes(term));
}
