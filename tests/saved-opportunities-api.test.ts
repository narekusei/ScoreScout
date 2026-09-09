import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { createSavedOpportunityHandlers } from "../lib/saved-opportunities-api";
import type { SavedOpportunityRepository, SavedOpportunityState } from "../lib/server-saved-opportunities";
import type { ScoredOpportunity } from "../lib/opportunity";

const opportunity: ScoredOpportunity = {
  id: "reddit-project",
  title: "Composer wanted",
  description: "Paid score",
  source: "Reddit",
  community: "r/MusicJobs",
  url: "https://reddit.com/example",
  publishedAt: "2026-09-09T00:00:00.000Z",
  ageHours: 4,
  budgetLabel: "$500",
  tags: ["Paid"],
  score: 80,
  scoreReasons: ["hiring intent"],
};

function setup(authenticated = true) {
  let state: SavedOpportunityState = { opportunities: [], statuses: {} };
  const calls: string[] = [];
  const repository: SavedOpportunityRepository = {
    async list(userId) { calls.push(`list:${userId}`); return state; },
    async save(userId, saved, status) {
      calls.push(`save:${userId}:${saved.id}:${status}`);
      state = { opportunities: [saved], statuses: { [saved.id]: status } };
    },
    async remove(userId, id) { calls.push(`remove:${userId}:${id}`); },
    async updateStatus(userId, id, status) { calls.push(`status:${userId}:${id}:${status}`); },
    async migrate(userId, migrated) { calls.push(`migrate:${userId}`); state = migrated; return state; },
  };
  return {
    calls,
    handlers: createSavedOpportunityHandlers({
      getUser: async () => authenticated ? ({ id: "user-1" } as User) : null,
      repository,
    }),
  };
}

test("requires authentication before reading saved opportunities", async () => {
  const { handlers, calls } = setup(false);
  const response = await handlers.GET();
  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});

test("saves and updates only through the authenticated user id", async () => {
  const { handlers, calls } = setup();
  const save = await handlers.POST(new Request("https://scorescout.test/api/saved-opportunities", {
    method: "POST",
    body: JSON.stringify({ opportunity, status: "Interview" }),
  }));
  const update = await handlers.PATCH(new Request("https://scorescout.test/api/saved-opportunities", {
    method: "PATCH",
    body: JSON.stringify({ opportunityId: opportunity.id, status: "Won" }),
  }));
  assert.equal(save.status, 200);
  assert.equal(update.status, 200);
  assert.deepEqual(calls, [
    "save:user-1:reddit-project:Interview",
    "status:user-1:reddit-project:Won",
  ]);
});

test("migrates validated local data and rejects malformed statuses", async () => {
  const { handlers, calls } = setup();
  const migrated = await handlers.PUT(new Request("https://scorescout.test/api/saved-opportunities", {
    method: "PUT",
    body: JSON.stringify({ opportunities: [opportunity], statuses: { [opportunity.id]: "Applied" } }),
  }));
  assert.equal(migrated.status, 200);
  assert.equal((await migrated.json()).statuses[opportunity.id], "Applied");
  assert.deepEqual(calls, ["migrate:user-1"]);

  const invalid = await handlers.PUT(new Request("https://scorescout.test/api/saved-opportunities", {
    method: "PUT",
    body: JSON.stringify({ opportunities: [opportunity], statuses: { [opportunity.id]: "Admin" } }),
  }));
  assert.equal(invalid.status, 400);
});
