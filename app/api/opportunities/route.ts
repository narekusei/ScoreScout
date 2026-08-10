import { collectRedditOpportunities, RedditCollectorError } from "../../../collectors/reddit";
import { scoreOpportunity } from "../../../lib/opportunity";

const DEFAULT_QUERY = 'composer OR "game music" OR soundtrack OR "film score"';
const COMMUNITIES = ["gameDevClassifieds", "INAT", "MusicJobs", "GameAudio"];

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function getCredentials() {
  return {
    clientId: process.env.REDDIT_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET?.trim() ?? "",
    userAgent: process.env.REDDIT_USER_AGENT?.trim() ?? "",
  };
}

export async function GET(request: Request) {
  const credentials = getCredentials();
  if (!credentials.clientId || !credentials.clientSecret || !credentials.userAgent) {
    return json(
      {
        error: "reddit_not_configured",
        message: "Reddit integration is not configured on this server.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q")?.trim() || DEFAULT_QUERY).slice(0, 120);

  try {
    const collected = await collectRedditOpportunities({
      credentials,
      communities: COMMUNITIES,
      query,
      limit: 50,
    });
    const opportunities = collected
      .map(scoreOpportunity)
      .filter((opportunity) => opportunity.score >= 45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    return json({
      opportunities,
      meta: {
        source: "Reddit",
        query,
        communities: COMMUNITIES,
        collected: collected.length,
        returned: opportunities.length,
      },
    });
  } catch (error) {
    if (error instanceof RedditCollectorError) {
      return json(
        {
          error: "reddit_request_failed",
          message: error.message,
        },
        { status: error.status === 429 ? 429 : 502 },
      );
    }

    return json(
      {
        error: "unexpected_error",
        message: "ScoreScout could not load opportunities right now.",
      },
      { status: 500 },
    );
  }
}
