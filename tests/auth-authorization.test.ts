import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSupabaseConfig } from "../lib/supabase/config";

test("validates public Supabase authentication configuration", () => {
  assert.deepEqual(getSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-key",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  }), {
    url: "https://project.supabase.co",
    anonKey: "publishable-key",
    siteUrl: "http://localhost:3000",
  });

  assert.throws(() => getSupabaseConfig({}), /not configured/i);
  assert.throws(() => getSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: "http://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-key",
    NEXT_PUBLIC_SITE_URL: "https://scorescout.example",
  }), /must use HTTPS/i);
});

test("RLS migration grants authenticated users access only to owned rows", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260909000000_add_auth_and_rls.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /after insert on auth\.users/i);
  assert.match(migration, /security definer set search_path = ''/i);
  assert.equal(migration.match(/create policy/g)?.length, 10);
  assert.equal(migration.match(/to authenticated/g)?.length, 10);
  assert.equal(migration.match(/auth\.uid\(\)/g)?.length, 13);
  assert.doesNotMatch(migration, /to anon|using \(true\)|with check \(true\)/i);
});
