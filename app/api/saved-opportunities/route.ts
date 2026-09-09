import { createSavedOpportunityHandlers } from "../../../lib/saved-opportunities-api";
import { createSupabaseSavedOpportunityRepository } from "../../../lib/server-saved-opportunities";
import { createClient } from "../../../lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const handlers = createSavedOpportunityHandlers({
  getUser,
  repository: createSupabaseSavedOpportunityRepository(),
});

export const { GET, POST, PATCH, DELETE, PUT } = handlers;
