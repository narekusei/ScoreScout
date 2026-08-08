# ScoreScout

ScoreScout is a portfolio web application that helps composers and music creators find relevant paid opportunities without manually scrolling through communities and job boards.

## Current milestone

The current milestone establishes the product identity, a responsive opportunity dashboard, and a typed opportunity model with deterministic relevance scoring. The listings are demonstration data while source integrations are developed incrementally.

## Product direction

- Collect public opportunities from supported platforms
- Distinguish clients hiring musicians from musicians advertising services
- Score every post for relevance, intent, payment signals, and freshness
- Filter, save, and track promising opportunities
- Add sources one at a time through independent collectors

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Roadmap

1. Responsive interface and product identity
2. Data model and opportunity scoring ✓
3. Reddit collector
4. Search and working filters
5. Saved opportunities and application tracking
6. Additional compliant data sources

## Important

API credentials must be supplied through environment variables and must never be committed to the repository.
