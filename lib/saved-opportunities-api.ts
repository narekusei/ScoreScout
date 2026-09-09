import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SavedOpportunityRepository } from "./server-saved-opportunities";
import { isApplicationStatus, isScoredOpportunity, type ApplicationStatus } from "./saved-opportunities";
import type { ScoredOpportunity } from "./opportunity";

type Dependencies = { getUser(): Promise<User | null>; repository: SavedOpportunityRepository };
type SaveBody = { opportunity?: ScoredOpportunity; status?: ApplicationStatus };

const unauthorized = () => NextResponse.json(
  { message: "Sign in to sync saved opportunities" },
  { status: 401 },
);
const invalid = (message: string) => NextResponse.json({ message }, { status: 400 });

export function createSavedOpportunityHandlers(dependencies: Dependencies) {
  async function withUser(action: (user: User) => Promise<Response>) {
    try {
      const user = await dependencies.getUser();
      if (!user) return unauthorized();
      return await action(user);
    } catch {
      return NextResponse.json(
        { message: "Saved opportunities are temporarily unavailable" },
        { status: 503 },
      );
    }
  }

  return {
    GET: () => withUser(async (user) => NextResponse.json({
      userId: user.id,
      ...await dependencies.repository.list(user.id),
    })),
    POST: (request: Request) => withUser(async (user) => {
      const body = await request.json() as SaveBody;
      if (!isScoredOpportunity(body.opportunity)) return invalid("Invalid opportunity");
      await dependencies.repository.save(
        user.id,
        body.opportunity,
        isApplicationStatus(body.status) ? body.status : "Saved",
      );
      return NextResponse.json({ saved: true });
    }),
    PATCH: (request: Request) => withUser(async (user) => {
      const body = await request.json() as { opportunityId?: unknown; status?: unknown };
      if (typeof body.opportunityId !== "string" || !isApplicationStatus(body.status)) {
        return invalid("Invalid status update");
      }
      await dependencies.repository.updateStatus(user.id, body.opportunityId, body.status);
      return NextResponse.json({ updated: true });
    }),
    DELETE: (request: Request) => withUser(async (user) => {
      const opportunityId = new URL(request.url).searchParams.get("id");
      if (!opportunityId) return invalid("Opportunity id is required");
      await dependencies.repository.remove(user.id, opportunityId);
      return new Response(null, { status: 204 });
    }),
    PUT: (request: Request) => withUser(async (user) => {
      const body = await request.json() as { opportunities?: unknown; statuses?: unknown };
      if (!Array.isArray(body.opportunities) || body.opportunities.length > 100 ||
          !body.opportunities.every(isScoredOpportunity) ||
          !body.statuses || typeof body.statuses !== "object") {
        return invalid("Invalid local migration payload");
      }
      const statuses = body.statuses as Record<string, unknown>;
      if (Object.values(statuses).some((status) => !isApplicationStatus(status))) {
        return invalid("Invalid local migration statuses");
      }
      const state = await dependencies.repository.migrate(user.id, {
        opportunities: body.opportunities,
        statuses: statuses as Record<string, ApplicationStatus>,
      });
      return NextResponse.json({ userId: user.id, ...state });
    }),
  };
}
