import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { signOut } from "../auth/actions";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <main className="authPage">
      <Link className="brand" href="/" aria-label="ScoreScout home">
        <span className="brandMark">S</span><span>ScoreScout</span>
      </Link>
      <section className="authCard">
        <p className="sectionLabel">Account</p>
        <h1>Your private workspace</h1>
        <p>Signed in as <strong>{user.email}</strong>.</p>
        <p>Server persistence will be connected in the next roadmap stage.</p>
        <form action={signOut}><button type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
