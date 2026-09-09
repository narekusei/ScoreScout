import "server-only";

import type { ScoredOpportunity } from "./opportunity";
import type { ApplicationStatus } from "./saved-opportunities";
import { createClient } from "./supabase/server";

export type SavedOpportunityState = {
  opportunities: ScoredOpportunity[];
  statuses: Record<string, ApplicationStatus>;
};

type SavedRow = {
  id: string;
  opportunity_id: string;
  title: string;
  description: string;
  source: ScoredOpportunity["source"];
  community: string;
  url: string;
  published_at: string;
  budget_label: string;
  tags: string[];
  score: number;
  score_reasons: string[];
};

export type SavedOpportunityRepository = {
  list(userId: string): Promise<SavedOpportunityState>;
  save(userId: string, opportunity: ScoredOpportunity, status: ApplicationStatus): Promise<void>;
  remove(userId: string, opportunityId: string): Promise<void>;
  updateStatus(userId: string, opportunityId: string, status: ApplicationStatus): Promise<void>;
  migrate(userId: string, state: SavedOpportunityState): Promise<SavedOpportunityState>;
};

function toOpportunity(row: SavedRow): ScoredOpportunity {
  const publishedAt = new Date(row.published_at);
  return {
    id: row.opportunity_id,
    title: row.title,
    description: row.description,
    source: row.source,
    community: row.community,
    url: row.url,
    publishedAt: row.published_at,
    ageHours: Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 3_600_000)),
    budgetLabel: row.budget_label,
    tags: row.tags,
    score: row.score,
    scoreReasons: row.score_reasons,
  };
}

function toRow(userId: string, opportunity: ScoredOpportunity) {
  return {
    user_id: userId,
    opportunity_id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    source: opportunity.source,
    community: opportunity.community,
    url: opportunity.url,
    published_at: opportunity.publishedAt,
    budget_label: opportunity.budgetLabel,
    tags: opportunity.tags,
    score: opportunity.score,
    score_reasons: opportunity.scoreReasons,
    updated_at: new Date().toISOString(),
  };
}

function assertSuccess(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function createSupabaseSavedOpportunityRepository(): SavedOpportunityRepository {
  return {
    async list(userId) {
      const supabase = await createClient();
      const { data: saved, error: savedError } = await supabase
        .from("saved_opportunities")
        .select("id, opportunity_id, title, description, source, community, url, published_at, budget_label, tags, score, score_reasons")
        .eq("user_id", userId)
        .order("saved_at", { ascending: true });
      assertSuccess(savedError);

      const { data: statuses, error: statusError } = await supabase
        .from("application_statuses")
        .select("status, saved_opportunities!inner(opportunity_id)")
        .eq("user_id", userId);
      assertSuccess(statusError);

      return {
        opportunities: ((saved ?? []) as SavedRow[]).map(toOpportunity),
        statuses: Object.fromEntries((statuses ?? []).map((row) => {
          const joined = row.saved_opportunities as unknown as { opportunity_id: string };
          return [joined.opportunity_id, row.status as ApplicationStatus];
        })),
      };
    },

    async save(userId, opportunity, status) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("saved_opportunities")
        .upsert(toRow(userId, opportunity), { onConflict: "user_id,opportunity_id" })
        .select("id")
        .single();
      assertSuccess(error);
      if (!data) throw new Error("Saved opportunity was not returned");
      const { error: statusError } = await supabase.from("application_statuses").upsert({
        saved_opportunity_id: data.id,
        user_id: userId,
        status,
        updated_at: new Date().toISOString(),
      });
      assertSuccess(statusError);
    },

    async remove(userId, opportunityId) {
      const supabase = await createClient();
      const { error } = await supabase.from("saved_opportunities")
        .delete().eq("user_id", userId).eq("opportunity_id", opportunityId);
      assertSuccess(error);
    },

    async updateStatus(userId, opportunityId, status) {
      const supabase = await createClient();
      const { data, error } = await supabase.from("saved_opportunities")
        .select("id").eq("user_id", userId).eq("opportunity_id", opportunityId).maybeSingle();
      assertSuccess(error);
      if (!data) throw new Error("Saved opportunity was not found");
      const { error: statusError } = await supabase.from("application_statuses")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("user_id", userId).eq("saved_opportunity_id", data.id);
      assertSuccess(statusError);
    },

    async migrate(userId, state) {
      for (const opportunity of state.opportunities) {
        await this.save(userId, opportunity, state.statuses[opportunity.id] ?? "Saved");
      }
      return this.list(userId);
    },
  };
}
