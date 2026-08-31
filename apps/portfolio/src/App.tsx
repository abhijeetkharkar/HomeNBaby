import { meta, projects, workExperience, education, recognition } from './data/portfolio';
import type { WorkEntry } from './data/portfolio';
import './App.css';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.21.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ── Work Entry Component ───────────────────────────────────────────────────────
function WorkCard({ entry }: { entry: WorkEntry }) {
  return (
    <div className={`work-card ${entry.highlight ? 'work-card--highlight' : ''}`}>
      <div className="work-card__header">
        <div>
          <h3 className="work-card__company">{entry.company}</h3>
          {entry.companyNote && (
            <span className="work-card__company-note">{entry.companyNote}</span>
          )}
          <span className="work-card__role">{entry.role}</span>
        </div>
        <div className="work-card__meta">
          <span className="work-card__period">{entry.period}</span>
          <span className="work-card__location">{entry.location}</span>
        </div>
      </div>

      <div className="work-card__projects">
        {entry.items.map((item, i) => (
          <div key={i} className="work-project">
            <div className="work-project__title-row">
              <span className="work-project__name">{item.name}</span>
              {item.meta && <span className="work-project__badge">{item.meta}</span>}
            </div>
            <ul className="work-project__bullets">
              {item.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
            {item.tech && (
              <div className="work-project__tech-tags">
                {item.tech.split(' · ').map((t, k) => (
                  <span key={k} className="tech-tag tech-tag--work">{t.trim()}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="container header__inner">
          <img src="/profile.png" alt={meta.name} className="header__photo" />
          <div className="header__text">
            <h1 className="header__name">{meta.name}</h1>
            <p className="header__title">{meta.title}</p>
            <p className="header__summary">{meta.summary}</p>
            <div className="header__pills">
              {meta.pills.map((p) => (
                <span key={p} className="pill">{p}</span>
              ))}
            </div>
            <div className="header__links">
              <a href={meta.github} target="_blank" rel="noopener noreferrer" className="icon-link">
                <GithubIcon /> GitHub
              </a>
              <a href={meta.linkedin} target="_blank" rel="noopener noreferrer" className="icon-link">
                <LinkedinIcon /> LinkedIn
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── Featured Projects ── */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Featured Projects</h2>
          <div className="projects-grid">
            {projects.map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="project-card">
                <div className="project-card__top">
                  <span className="project-card__name">
                    {p.name}
                    {p.wip && <span className="badge badge--wip">WIP</span>}
                  </span>
                  <ExternalIcon />
                </div>
                <p className="project-card__desc">{p.description}</p>
                <div className="project-card__tech">
                  {p.tech.map((t) => <span key={t} className="tech-tag">{t}</span>)}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Work Experience ── */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Work Experience</h2>
          <div className="work-list">
            {workExperience.map((entry) => (
              <WorkCard key={entry.company + entry.period} entry={entry} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Education & Recognition ── */}
      <section className="section">
        <div className="container">
          <div className="bottom-grid">
            <div>
              <h2 className="section__title">Education</h2>
              {education.map((e) => (
                <div key={e.degree} className="edu-entry">
                  <span className="edu-entry__degree">{e.degree}</span>
                  <span className="edu-entry__institution">{e.institution} · {e.year} · GPA {e.gpa}</span>
                </div>
              ))}
            </div>
            <div>
              <h2 className="section__title">Recognition</h2>
              <ul className="recognition-list">
                {recognition.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Abhijeet Kharkar</span>
          <div className="footer__links">
            <a href={meta.github} target="_blank" rel="noopener noreferrer"><GithubIcon /></a>
            <a href={meta.linkedin} target="_blank" rel="noopener noreferrer"><LinkedinIcon /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
