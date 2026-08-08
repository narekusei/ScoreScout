import { opportunities } from "../lib/opportunity";

function formatAge(ageHours: number) {
  if (ageHours < 24) return `${ageHours}h ago`;
  if (ageHours < 48) return "Yesterday";
  return `${Math.floor(ageHours / 24)}d ago`;
}

export default function Home() {
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
          <button type="button" className="savedButton">Saved <span>3</span></button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Built for composers</div>
        <h1>Find the work.<br /><em>Write the music.</em></h1>
        <p>ScoreScout searches creative communities for genuine, paid opportunities — so musicians spend less time scrolling and more time composing.</p>
        <div className="searchBox">
          <label>
            <span>What are you looking for?</span>
            <input defaultValue="composer, game music, film score" aria-label="Search keywords" />
          </label>
          <button type="button">Scout opportunities</button>
        </div>
        <div className="trustLine">
          <span><b>12</b> sources monitored</span>
          <span><b>247</b> posts scanned today</span>
          <span><b>18</b> strong matches</span>
        </div>
      </section>

      <section className="workspace" id="jobs">
        <aside>
          <p className="sectionLabel">Refine results</p>
          <div className="filterGroup">
            <h3>Discipline</h3>
            {['Composition', 'Game audio', 'Film scoring', 'Sound design'].map((item, index) => (
              <label className="check" key={item}><input type="checkbox" defaultChecked={index < 2} /><span>{item}</span></label>
            ))}
          </div>
          <div className="filterGroup">
            <h3>Payment</h3>
            <label className="check"><input type="checkbox" defaultChecked /><span>Paid only</span></label>
            <label className="check"><input type="checkbox" /><span>Budget specified</span></label>
          </div>
          <div className="filterGroup">
            <h3>Minimum match</h3>
            <input type="range" min="40" max="100" defaultValue="70" aria-label="Minimum match score" />
            <div className="rangeLabels"><span>40%</span><b>70%</b><span>100%</span></div>
          </div>
        </aside>

        <div className="results">
          <div className="resultsHeader">
            <div><p className="sectionLabel">Today’s shortlist</p><h2>Opportunities worth hearing about</h2></div>
            <button type="button" className="sortButton">Best match ↓</button>
          </div>
          <div className="jobList">
            {opportunities.map((job) => (
              <article className="jobCard" key={job.id}>
                <div className="score" aria-label={`${job.score}% match`} title={job.scoreReasons.join(", ")}><strong>{job.score}</strong><span>% match</span></div>
                <div className="jobBody">
                  <div className="jobMeta"><span className={`source ${job.source === 'Reddit' ? 'reddit' : ''}`}>{job.source}</span><span>{job.community}</span><span>{formatAge(job.ageHours)}</span></div>
                  <h3>{job.title}</h3>
                  <p>{job.description}</p>
                  <div className="tagRow">{job.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                </div>
                <div className="jobAction"><strong>{job.budgetLabel}</strong><button type="button" aria-label={`Save ${job.title}`}>♡</button><a href={job.url}>View post ↗</a></div>
              </article>
            ))}
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
