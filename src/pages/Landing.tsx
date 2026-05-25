import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Sparkles, Users, FileCheck2, PlayCircle, Menu, X, ListChecks, Briefcase } from "lucide-react";

const Landing = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("hiro-landing-active");
    return () => document.body.classList.remove("hiro-landing-active");
  }, []);

  return (
    <div>
      {/* Sticky Nav */}
      <nav className="hiro-nav">
        <Link to="/" className="hiro-nav-logo">
          Hiro<span className="hiro-nav-logo-dot" />
        </Link>
        <div className="hiro-nav-links">
          <a href="#how" className="hiro-nav-link">How it works</a>
          <a href="#demo" className="hiro-nav-link">Demo</a>
          <a href="#about" className="hiro-nav-link">Why Hiro</a>
        </div>
        <div className="hiro-nav-actions">
          <Link to="/login" className="hiro-nav-login">Log in</Link>
          <Link to="/register" className="hiro-nav-cta">Get Started</Link>
          <button
            className="hiro-hamburger"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="text-white h-5 w-5" /> : <Menu className="text-white h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="hiro-mobile-menu open">
          <a href="#how" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#demo" onClick={() => setMobileOpen(false)}>Demo</a>
          <a href="#about" onClick={() => setMobileOpen(false)}>Why Hiro</a>
          <Link to="/register" className="hiro-cta-primary">Get Started</Link>
          <Link to="/login" className="hiro-cta-secondary">Log in</Link>
        </div>
      )}

      {/* HERO */}
      <section className="hiro-hero">
        <div className="hiro-hero-inner">
          <div>
            <span className="hiro-eyebrow">
              <span className="hiro-eyebrow-dot" />
              One URL. Everything you need.
            </span>
            <h1 className="hiro-hero-headline">Become the obvious hire.</h1>
            <p className="hiro-hero-sub">One link. Full application kit.</p>
            <p className="hiro-hero-body">
              Paste any job URL and Hiro fills your tracker, tailors your CV, drafts outreach, and
              prepares your interview — all in one workspace built around the actual application
              workflow.
            </p>
            <div className="hiro-hero-cta-row">
              <a href="#how" className="hiro-cta-primary">See how Hiro works</a>
              <Link to="/register" className="hiro-cta-secondary">Start free</Link>
            </div>
          </div>

          {/* Mock product UI */}
          <div className="hiro-mock" aria-hidden="true">
            <div className="hiro-mock-urlbar">
              <Link2 className="h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
              <span className="hiro-mock-url">https://careers.mckinsey.com/strategy-analyst...</span>
              <span className="hiro-mock-add">+ Add</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">McKinsey &amp; Co.</span>
              <span className="hiro-mock-role">Strategy Analyst</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-status hiro-mock-status-applied">Applied</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Unilever</span>
              <span className="hiro-mock-role">Brand Manager</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-status hiro-mock-status-progress">In Progress</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Spotify</span>
              <span className="hiro-mock-role">Product Manager</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-status hiro-mock-status-saved">Saved</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Goldman Sachs</span>
              <span className="hiro-mock-role">Corporate Finance Analyst</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-status hiro-mock-status-applied">Applied</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Nestlé</span>
              <span className="hiro-mock-role">Sustainability Coordinator</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-status hiro-mock-status-progress">In Progress</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="hiro-divider-line" />

      {/* HOW HIRO WORKS — merged workflow + features */}
      <section id="how" className="hiro-section" style={{ background: "var(--color-bg-page)" }}>
        <div className="hiro-section-inner">
          <p className="hiro-section-eyebrow">How Hiro works</p>
          <h2 className="hiro-section-heading">From one job link to a complete application.</h2>
          <p className="hiro-section-subtext">
            One workflow that covers the whole process — tracking, tailoring, outreach, and interview
            prep — without juggling spreadsheets, docs, and tabs.
          </p>

          <div className="hiro-how-grid">
            <div className="hiro-how-card">
              <div className="hiro-how-num">01</div>
              <div className="hiro-how-icon-wrap"><Link2 className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Paste the job link</h3>
              <p className="hiro-how-body">
                Drop any job URL — LinkedIn, Workday, Greenhouse, or a company careers page. That single
                link is the entry point to the whole workflow.
              </p>
            </div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">02</div>
              <div className="hiro-how-icon-wrap"><ListChecks className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Hiro reads the role and fills the tracker</h3>
              <p className="hiro-how-body">
                Hiro extracts role details, required and nice-to-have skills, deadline, and location,
                then creates the tracker row automatically — no copy-pasting.
              </p>
            </div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">03</div>
              <div className="hiro-how-icon-wrap"><FileCheck2 className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Build your application kit</h3>
              <p className="hiro-how-body">
                Tailor your CV to the role, see a fit score with real strengths and gaps, surface the
                right people on LinkedIn, and draft connection notes and InMail you can actually send.
              </p>
            </div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">04</div>
              <div className="hiro-how-icon-wrap"><Briefcase className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Prepare and track the process</h3>
              <p className="hiro-how-body">
                Move the role through stages, log outreach replies, prep STAR answers for likely
                questions, and track every interview round in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT DEMO PLACEHOLDER */}
      <section id="demo" className="hiro-section" style={{ background: "#0b0b0f" }}>
        <div className="hiro-section-inner">
          <p className="hiro-section-eyebrow hiro-section-eyebrow-light">Product demo</p>
          <h2 className="hiro-section-heading hiro-section-heading-dark">See one application go from link to interview.</h2>
          <p className="hiro-section-subtext" style={{ color: "rgba(255,255,255,0.65)" }}>
            A short walkthrough of the full Hiro workflow on a real role — tracker, kit, outreach, prep.
          </p>

          <div className="hiro-demo-frame">
            <div className="hiro-demo-inner">
              <PlayCircle className="hiro-demo-icon h-14 w-14" />
              <div className="hiro-demo-label">Interactive walkthrough — coming soon</div>
              <p className="hiro-demo-sub">
                One job URL turned into a tracker row, a tailored CV, a shortlist of contacts, drafted
                outreach, and an interview prep workspace.
              </p>
            </div>
          </div>

          <div className="hiro-demo-proof">
            <div className="hiro-demo-proof-cell">
              <ListChecks className="h-5 w-5" />
              <div>
                <div className="hiro-demo-proof-h">Auto-filled tracker</div>
                <div className="hiro-demo-proof-body">Role, skills, deadline, and location parsed from the job URL.</div>
              </div>
            </div>
            <div className="hiro-demo-proof-cell">
              <FileCheck2 className="h-5 w-5" />
              <div>
                <div className="hiro-demo-proof-h">Tailored application kit</div>
                <div className="hiro-demo-proof-body">CV rewritten for the role, with a fit score and gap list.</div>
              </div>
            </div>
            <div className="hiro-demo-proof-cell">
              <Users className="h-5 w-5" />
              <div>
                <div className="hiro-demo-proof-h">Interview and outreach workspace</div>
                <div className="hiro-demo-proof-body">Contacts, drafted messages, STAR prep, and round-by-round notes.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="hiro-divider-line" />

      {/* ABOUT — founder note */}
      <section id="about" className="hiro-about">
        <div className="hiro-about-inner">
          <p className="hiro-about-eyebrow">A note from the person who built this</p>
          <h2 className="hiro-about-h">Why Hiro exists.</h2>
          <div className="hiro-about-body">
            <p>
              I'm Máté. Before my Masters I spent a gap year chasing internships and it took more than
              six months to land two of them.
            </p>
            <p className="hiro-about-stat">
              <span className="hiro-about-stat-num">130+</span>
              <span className="hiro-about-stat-label">applications, a custom CV every time, and cold outreach on LinkedIn for each one.</span>
            </p>
            <p>
              Most of that time wasn't spent thinking about the role — it was spent reformatting CVs,
              hunting contacts, and rewriting the same notes. I built Hiro so candidates can actually
              apply better, not just feel busy.
            </p>
            <p className="hiro-about-sign">— Máté</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="hiro-final-cta">
        <div className="hiro-final-inner">
          <span className="hiro-eyebrow">
            <span className="hiro-eyebrow-dot" />
            Ready when you are
          </span>
          <h2 className="hiro-final-h">Run every application through one workspace.</h2>
          <p className="hiro-final-sub">
            Tracker, CV tailoring, outreach, and interview prep — connected end to end, so you can
            spend your time on the roles that actually matter.
          </p>
          <Link to="/register" className="hiro-cta-primary">Create your account</Link>
          <p className="hiro-final-note">Two minutes to set up. No card needed.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="hiro-footer">
        <div className="hiro-footer-inner">
          <div>
            <Link to="/" className="hiro-nav-logo">
              Hiro<span className="hiro-nav-logo-dot" />
            </Link>
            <div className="hiro-footer-tag">Become the obvious hire.</div>
          </div>
          <div className="hiro-footer-copy">© 2026 Hiro. Built for ambitious candidates.</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
