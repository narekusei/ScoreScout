# ScoreScout

ScoreScout is a portfolio web application that helps composers and music creators find relevant paid opportunities without manually scrolling through communities and job boards.

## Live demo

[Open ScoreScout on Vercel](https://scorescout.vercel.app)

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

Create a production build with `npm run build`. The standard Next.js build is compatible with Vercel deployments.

## Reddit setup

ScoreScout uses Reddit's official OAuth API and never stores API credentials in source control. Copy `.env.example` to `.env.local`, add credentials for your Reddit application, and keep the local file private.

The collector handles authentication, searches selected communities, limits result counts, and converts Reddit posts into the shared `Opportunity` model. The `GET /api/opportunities` endpoint keeps credentials on the server, scores the collected posts, removes weak matches, and returns at most 30 results. An optional `q` query parameter can override the default music-job search.

## RSS and Atom setup

ScoreScout can also read publisher-provided RSS or Atom feeds without scraping web pages. Set `RSS_FEED_URLS` to a comma-separated list of up to five public HTTPS feed URLs. The server limits feed size, normalizes entries into the shared opportunity model, removes duplicate links, and combines them with Reddit results. Feed URLs containing private tokens should not be used.

## Greenhouse setup

ScoreScout supports the public Greenhouse Job Board API, which does not require credentials for published jobs. Set `GREENHOUSE_BOARD_TOKENS` to a comma-separated list of up to five tokens from company Greenhouse board URLs. The server only calls Greenhouse's fixed HTTPS API host, limits response size, and combines normalized jobs with the other configured sources.

## Lever setup

ScoreScout supports the official public Lever Postings API, which exposes published jobs without credentials. Set `LEVER_SITE_NAMES` to a comma-separated list of up to five company site names from Lever job URLs. The server only calls Lever's fixed HTTPS API host, limits response size, validates hosted job links, and combines normalized jobs with the other configured sources.

## Roadmap

1. Responsive interface and product identity
2. Data model and opportunity scoring ✓
3. Reddit collector and server endpoint ✓
4. Dashboard data loading, search, filters, and sorting ✓
5. Saved opportunities and application tracking ✓
6. Additional compliant data sources ✓

## Important

API credentials must be supplied through environment variables and must never be committed to the repository.
