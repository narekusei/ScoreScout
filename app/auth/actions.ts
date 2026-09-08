"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getSupabaseConfig } from "../../lib/supabase/config";

export async function signIn(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
    redirect("/auth?error=Enter%20a%20valid%20email%20address");
  }

  const supabase = await createClient();
  const { siteUrl } = getSupabaseConfig();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) redirect("/auth?error=Unable%20to%20send%20the%20sign-in%20link");
  redirect("/auth?message=Check%20your%20email%20for%20the%20sign-in%20link");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
