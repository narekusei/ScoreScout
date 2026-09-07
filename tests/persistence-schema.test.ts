import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { applicationStatuses, applicationStatusValues, savedOpportunities, users } from "../db/schema";

test("defines the persistence tables and application states", () => {
  assert.equal(getTableName(users), "users");
  assert.equal(getTableName(savedOpportunities), "saved_opportunities");
  assert.equal(getTableName(applicationStatuses), "application_statuses");
  assert.deepEqual(applicationStatusValues, ["Saved", "Applied", "Interview", "Won", "Rejected"]);

  assert.deepEqual(Object.keys(getTableColumns(savedOpportunities)), [
    "id", "userId", "opportunityId", "title", "description", "source", "community", "url",
    "publishedAt", "budgetLabel", "tags", "score", "scoreReasons", "savedAt", "updatedAt",
  ]);
});

test("migration links records to Supabase users and starts with deny-by-default RLS", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260908000000_create_persistence_schema.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /unique \(user_id, opportunity_id\)/i);
  assert.match(migration, /foreign key \(saved_opportunity_id, user_id\)/i);
  assert.match(migration, /score between 0 and 100/i);
  assert.equal(migration.match(/enable row level security/g)?.length, 3);
  assert.doesNotMatch(migration, /create policy/i);
});
