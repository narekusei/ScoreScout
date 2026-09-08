export type SupabaseEnvironment = Record<string, string | undefined>;

export function getSupabaseConfig(environment: SupabaseEnvironment = process.env) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const siteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim();

  if (!url || !anonKey || !siteUrl) {
    throw new Error(
      "Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_SITE_URL.",
    );
  }

  for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", url], ["NEXT_PUBLIC_SITE_URL", siteUrl]] as const) {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) {
      throw new Error(`${name} must use HTTPS (HTTP is allowed only for localhost).`);
    }
  }

  return { url, anonKey, siteUrl };
}
