# ScoreScout

ScoreScout is a portfolio web application that helps composers and music creators find relevant paid opportunities without manually scrolling through communities and job boards.

## Current milestone

The current milestone includes the product identity, a responsive opportunity dashboard, deterministic relevance scoring, an OAuth-based Reddit collector, and live dashboard search through a server-only endpoint. Demonstration cards remain available before the first search and when showcasing the project without credentials.

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

## Reddit setup

ScoreScout uses Reddit's official OAuth API and never stores API credentials in source control. Copy `.env.example` to `.env.local`, add credentials for your Reddit application, and keep the local file private.

The collector handles authentication, searches selected communities, limits result counts, and converts Reddit posts into the shared `Opportunity` model. The `GET /api/opportunities` endpoint keeps credentials on the server, scores the collected posts, removes weak matches, and returns at most 30 results. An optional `q` query parameter can override the default music-job search.

## Roadmap

1. Responsive interface and product identity
2. Data model and opportunity scoring ✓
3. Reddit collector and server endpoint ✓
4. Dashboard data loading, search, filters, and sorting ✓
5. Saved opportunities and application tracking
6. Additional compliant data sources

## Important

API credentials must be supplied through environment variables and must never be committed to the repository.
