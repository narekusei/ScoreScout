"use client";

import { FormEvent, useEffect, useState } from "react";
import { opportunities as demoOpportunities, type ScoredOpportunity } from "../lib/opportunity";
import {
  mergeOpportunities,
  parseSavedOpportunities,
  serializeSavedOpportunities,
} from "../lib/saved-opportunities";
import { hasSpecifiedBudget } from "../lib/budget";

const disciplines = ["Composition", "Game audio", "Film scoring", "Sound design"] as const;
type Discipline = (typeof disciplines)[number];

const disciplineTerms: Record<Discipline, string[]> = {
  Composition: ["composer", "composition", "music"],
  "Game audio": ["game", "interactive", "adaptive"],
  "Film scoring": ["film", "score", "soundtrack", "cinematic"],
  "Sound design": ["sound design", "sound designer", "audio", "ui sounds"],
};

const savedStorageKey = "scorescout:saved-opportunities";
const statusStorageKey = "scorescout:application-statuses";
const applicationStatuses = ["Saved", "Applied", "Interview", "Won", "Rejected"] as const;
type ApplicationStatus = (typeof applicationStatuses)[number];

type OpportunitiesResponse = {
  opportunities?: ScoredOpportunity[];
  message?: string;
  meta?: { collected: number; returned: number; sources: string[] };
};

function formatAge(ageHours: number) {
  if (ageHours < 24) return `${ageHours}h ago`;
  if (ageHours < 48) return "Yesterday";
  return `${Math.floor(ageHours / 24)}d ago`;
}

export default function Home() {
  const [query, setQuery] = useState("composer, game music, film score");
  const [jobs, setJobs] = useState<ScoredOpportunity[]>(demoOpportunities);
  const [status, setStatus] = useState<"demo" | "loading" | "live" | "error">("demo");
  const [notice, setNotice] = useState("Showing demonstration opportunities");
  const [sourceCount, setSourceCount] = useState(1);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>([...disciplines]);
  const [paidOnly, setPaidOnly] = useState(false);
  const [budgetSpecified, setBudgetSpecified] = useState(false);
  const [minimumScore, setMinimumScore] = useState(40);
  const [sortOrder, setSortOrder] = useState<"match" | "recent">("match");
  const [savedJobs, setSavedJobs] = useState<ScoredOpportunity[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<Record<string, ApplicationStatus>>({});

  useEffect(() => {
    let cancelled = false;

    try {
      const saved = window.localStorage.getItem(savedStorageKey);
      const statuses = window.localStorage.getItem(statusStorageKey);
      const parsed = saved ? parseSavedOpportunities(saved, demoOpportunities) : [];
      const parsedStatuses = statuses
        ? (JSON.parse(statuses) as Record<string, ApplicationStatus>)
        : {};
      queueMicrotask(() => {
        if (!cancelled) {
          setSavedJobs(parsed);
          setJobStatuses(parsedStatuses);
          if (saved) {
            window.localStorage.setItem(savedStorageKey, serializeSavedOpportunities(parsed));
          }
        }
      });
    } catch {
      window.localStorage.removeItem(savedStorageKey);
      window.localStorage.removeItem(statusStorageKey);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const savedIds = savedJobs.map((job) => job.id);
  const availableJobs = mergeOpportunities(jobs, savedJobs);
  const visibleJobs = availableJobs
    .filter((job) => {
      const text = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
      const matchesDiscipline =
        selectedDisciplines.length === 0 ||
        selectedDisciplines.some((discipline) =>
          disciplineTerms[discipline].some((term) => text.includes(term)),
        );
      const isPaid = job.budgetLabel !== "Budget unclear" || job.tags.includes("Paid");
      const hasBudget = hasSpecifiedBudget(job.budgetLabel);

      return (
        job.score >= minimumScore &&
        matchesDiscipline &&
        (!paidOnly || isPaid) &&
        (!budgetSpecified || hasBudget) &&
        (!savedOnly || savedIds.includes(job.id))
      );
    })
    .sort((a, b) => (sortOrder === "match" ? b.score - a.score : a.ageHours - b.ageHours));

  function toggleDiscipline(discipline: Discipline) {
    setSelectedDisciplines((current) =>
      current.includes(discipline)
        ? current.filter((item) => item !== discipline)
        : [...current, discipline],
    );
  }

  function resetFilters() {
    setSelectedDisciplines([...disciplines]);
    setPaidOnly(false);
    setBudgetSpecified(false);
    setMinimumScore(40);
    setSortOrder("match");
    setSavedOnly(false);
  }

  function toggleSaved(job: ScoredOpportunity) {
    setSavedJobs((current) => {
      const removing = current.some((savedJob) => savedJob.id === job.id);
      const next = removing
        ? current.filter((savedJob) => savedJob.id !== job.id)
        : [...current, job];
      window.localStorage.setItem(savedStorageKey, serializeSavedOpportunities(next));
      setJobStatuses((statuses) => {
        const updated = { ...statuses };
        if (removing) delete updated[job.id];
        else updated[job.id] = "Saved";
        window.localStorage.setItem(statusStorageKey, JSON.stringify(updated));
        return updated;
      });
      return next;
    });
  }

  function updateJobStatus(id: string, status: ApplicationStatus) {
    setJobStatuses((current) => {
      const next = { ...current, [id]: status };
      window.localStorage.setItem(statusStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || status === "loading") return;

    setStatus("loading");
    setNotice("Scouting connected sources for fresh opportunities…");

    try {
      const response = await fetch(`/api/opportunities?q=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as OpportunitiesResponse;

      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "No live sources are configured yet. Add Reddit credentials, public RSS feeds, " +
              "Greenhouse board tokens, or Lever site names."
            : payload.message || "Live search is temporarily unavailable.",
        );
      }

      const results = payload.opportunities ?? [];
      setJobs(results);
      setSourceCount(payload.meta?.sources.length ?? 1);
      setStatus("live");
      setNotice(
        results.length
          ? `${results.length} strong matches from ${payload.meta?.collected ?? results.length} posts checked`
          : "No strong matches found. Try a broader search.",
      );
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof Error ? error.message : "Live search is temporarily unavailable.");
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ScoreScout home">
          <span className="brandMark">S</span>
          <span>ScoreScout</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#jobs">Opportunities</a>
          <a href="#how">How it works</a>
          <button type="button" className="savedButton" aria-pressed={savedOnly} onClick={() => setSavedOnly((current) => !current)}>Saved <span>{savedIds.length}</span></button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Built for composers</div>
        <h1>Find the work.<br /><em>Write the music.</em></h1>
        <p>ScoreScout searches creative communities for genuine, paid opportunities — so musicians spend less time scrolling and more time composing.</p>
        <form className="searchBox" onSubmit={handleSearch}>
          <label>
            <span>What are you looking for?</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search keywords" maxLength={120} />
          </label>
          <button type="submit" disabled={status === "loading"}>{status === "loading" ? "Scouting…" : "Scout opportunities"}</button>
        </form>
        <p className={`searchStatus ${status}`} role="status" aria-live="polite">{notice}</p>
        <div className="trustLine">
          <span><b>{sourceCount}</b> compliant {sourceCount === 1 ? "source" : "sources"} configured</span>
          <span><b>{visibleJobs.length}</b> of {availableJobs.length} matches shown</span>
          <span><b>{status === "live" ? "Live" : "Demo"}</b> data mode</span>
        </div>
      </section>

      <section className="workspace" id="jobs">
        <aside>
          <p className="sectionLabel">Refine results</p>
          <div className="filterGroup">
            <h3>Discipline</h3>
            {disciplines.map((item) => (
              <label className="check" key={item}><input type="checkbox" checked={selectedDisciplines.includes(item)} onChange={() => toggleDiscipline(item)} /><span>{item}</span></label>
            ))}
          </div>
          <div className="filterGroup">
            <h3>Payment</h3>
            <label className="check"><input type="checkbox" checked={paidOnly} onChange={(event) => setPaidOnly(event.target.checked)} /><span>Paid only</span></label>
            <label className="check"><input type="checkbox" checked={budgetSpecified} onChange={(event) => setBudgetSpecified(event.target.checked)} /><span>Budget specified</span></label>
          </div>
          <div className="filterGroup">
            <h3>Minimum match</h3>
            <input type="range" min="40" max="100" step="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} aria-label="Minimum match score" />
            <div className="rangeLabels"><span>40%</span><b>{minimumScore}%</b><span>100%</span></div>
          </div>
          <button type="button" className="resetFilters" onClick={resetFilters}>Reset filters</button>
        </aside>

        <div className="results">
          <div className="resultsHeader">
            <div><p className="sectionLabel">Today’s shortlist</p><h2>Opportunities worth hearing about</h2></div>
            <button type="button" className="sortButton" onClick={() => setSortOrder((current) => current === "match" ? "recent" : "match")} aria-label={`Sort by ${sortOrder === "match" ? "most recent" : "best match"}`}>{sortOrder === "match" ? "Best match ↓" : "Most recent ↓"}</button>
          </div>
          <div className="jobList">
            {visibleJobs.map((job) => (
              <article className="jobCard" key={job.id}>
                <div className="score" aria-label={`${job.score}% match`} title={job.scoreReasons.join(", ")}><strong>{job.score}</strong><span>% match</span></div>
                <div className="jobBody">
                  <div className="jobMeta"><span className={`source ${job.source === 'Reddit' ? 'reddit' : ''}`}>{job.source}</span><span>{job.community}</span><span>{formatAge(job.ageHours)}</span></div>
                  <h3>{job.title}</h3>
                  <p>{job.description}</p>
                  <div className="tagRow">{job.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                </div>
                <div className="jobAction">
                  <strong>{job.budgetLabel}</strong>
                  <button type="button" aria-pressed={savedIds.includes(job.id)} aria-label={`${savedIds.includes(job.id) ? "Remove" : "Save"} ${job.title}`} onClick={() => toggleSaved(job)}>{savedIds.includes(job.id) ? "♥" : "♡"}</button>
                  {savedIds.includes(job.id) && <label className="statusField"><span>Status</span><select value={jobStatuses[job.id] ?? "Saved"} onChange={(event) => updateJobStatus(job.id, event.target.value as ApplicationStatus)} aria-label={`Application status for ${job.title}`}>{applicationStatuses.map((applicationStatus) => <option key={applicationStatus}>{applicationStatus}</option>)}</select></label>}
                  <a href={job.url}>View post ↗</a>
                </div>
              </article>
            ))}
            {!visibleJobs.length && <div className="emptyState"><strong>{savedOnly ? "No saved opportunities yet" : "No opportunities match these filters"}</strong><p>{savedOnly ? "Save promising opportunities with the heart button to keep them here." : "Lower the minimum score, select more disciplines, or reset the filters."}</p><button type="button" onClick={resetFilters}>{savedOnly ? "Show all opportunities" : "Reset filters"}</button></div>}
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <p className="sectionLabel">Quietly working in the background</p>
        <h2>A smarter search, without the noise.</h2>
        <div className="steps">
          <div><b>01</b><h3>Scout</h3><p>We monitor selected communities and job boards for new creative briefs.</p></div>
          <div><b>02</b><h3>Score</h3><p>Each post is checked for intent, relevance, payment signals and freshness.</p></div>
          <div><b>03</b><h3>Shortlist</h3><p>You get a clean list of opportunities that actually fit your craft.</p></div>
        </div>
      </section>

      <footer><span>ScoreScout</span><p>Opportunities for musicians, minus the endless scrolling.</p><small>Early portfolio prototype · 2026</small></footer>
    </main>
  );
}
