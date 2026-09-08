import { signIn } from "./actions";
import Link from "next/link";

type AuthPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="authPage">
      <Link className="brand" href="/" aria-label="ScoreScout home">
        <span className="brandMark">S</span><span>ScoreScout</span>
      </Link>
      <section className="authCard">
        <p className="sectionLabel">Private workspace</p>
        <h1>Sign in to ScoreScout</h1>
        <p>Receive a secure one-time link by email. No password is stored by ScoreScout.</p>
        <form action={signIn}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <button type="submit">Send sign-in link</button>
        </form>
        {error && <p className="authError" role="alert">{error}</p>}
        {message && <p className="authMessage" role="status">{message}</p>}
      </section>
    </main>
  );
}
