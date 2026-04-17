import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Sparkles, Users, ScanLine, FileCheck2, Target, Search, MessageSquare, BookOpen, Menu, X } from "lucide-react";

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
          <a href="#features" className="hiro-nav-link">Features</a>
          <a href="#how" className="hiro-nav-link">How it works</a>
          <a href="#metrics" className="hiro-nav-link">About</a>
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
          <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#how" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#metrics" onClick={() => setMobileOpen(false)}>About</a>
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
              AI-Powered Job Search — Paste one URL
            </span>
            <h1 className="hiro-hero-headline">Become the obvious hire.</h1>
            <p className="hiro-hero-sub">One URL. Tailored CV. Right contacts.</p>
            <p className="hiro-hero-body">
              Paste any job posting URL. Hiro automatically fills your tracker, builds a tailored CV kit,
              finds the right people to reach out to, and drafts personalised messages. Your complete
              application, in seconds.
            </p>
            <div className="hiro-hero-cta-row">
              <Link to="/register" className="hiro-cta-primary">Get started free</Link>
              <a href="#how" className="hiro-cta-secondary">See how it works</a>
            </div>
            <div className="hiro-social-proof">
              <div className="hiro-avatars">
                <div className="hiro-avatar" />
                <div className="hiro-avatar" />
                <div className="hiro-avatar" />
              </div>
              <span className="hiro-social-text">Built for ambitious candidates</span>
            </div>
          </div>

          {/* Mock product UI */}
          <div className="hiro-mock" aria-hidden="true">
            <div className="hiro-mock-urlbar">
              <Link2 className="h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
              <span className="hiro-mock-url">https://careers.pernodricard.com/strategy-intern...</span>
              <span className="hiro-mock-add">+ Add</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Pernod Ricard</span>
              <span className="hiro-mock-role">Strategy Intern</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-match hiro-mock-match-green">87%</span>
              <span className="hiro-mock-status hiro-mock-status-applied">Applied</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Danone</span>
              <span className="hiro-mock-role">Marketing Intern</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-match hiro-mock-match-amber">72%</span>
              <span className="hiro-mock-status hiro-mock-status-screening">Screening</span>
            </div>
            <div className="hiro-mock-row">
              <span className="hiro-mock-company">Estée Lauder</span>
              <span className="hiro-mock-role">Brand Intern</span>
              <span className="hiro-mock-spacer" />
              <span className="hiro-mock-match hiro-mock-match-green">91%</span>
              <span className="hiro-mock-status hiro-mock-status-interview">Interview</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="hiro-divider-line" />

      {/* HOW IT WORKS */}
      <section id="how" className="hiro-section" style={{ background: "var(--color-bg-page)" }}>
        <div className="hiro-section-inner">
          <p className="hiro-section-eyebrow">How it works</p>
          <h2 className="hiro-section-heading">Three steps. One workflow.</h2>
          <p className="hiro-section-subtext">
            From job link to ready-to-send application, Hiro handles the busywork so you can focus
            on showing up as the obvious hire.
          </p>

          <div className="hiro-how-grid">
            <div className="hiro-how-card">
              <div className="hiro-how-num">01</div>
              <div className="hiro-how-icon-wrap"><Link2 className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Paste a job URL</h3>
              <p className="hiro-how-body">
                Drop in any job posting from LinkedIn, Workday, Greenhouse, or any company careers page.
                Hiro reads it instantly.
              </p>
            </div>
            <div className="hiro-how-arrow">→</div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">02</div>
              <div className="hiro-how-icon-wrap"><Sparkles className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Get your application kit</h3>
              <p className="hiro-how-body">
                A tailored CV, the right bullet points, trimmed skills, and a personalised summary
                generated in seconds.
              </p>
            </div>
            <div className="hiro-how-arrow">→</div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">03</div>
              <div className="hiro-how-icon-wrap"><Users className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Reach out with confidence</h3>
              <p className="hiro-how-body">
                Find who to contact at the company, draft a 300-character connection note and a
                challenge-based InMail. All ready to send.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="hiro-features-section">
        <div className="hiro-section-inner">
          <p className="hiro-section-eyebrow hiro-section-eyebrow-light">What you get</p>
          <h2 className="hiro-section-heading hiro-section-heading-dark">Everything an application needs.</h2>

          <div className="hiro-features-grid">
            <div className="hiro-feature-cell">
              <ScanLine className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Automatic job parsing</h3>
              <p className="hiro-feature-body">Paste any URL. Company, role, skills, deadline — all filled in automatically.</p>
            </div>
            <div className="hiro-feature-cell">
              <FileCheck2 className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">AI-tailored CV kit</h3>
              <p className="hiro-feature-body">The right bullets, trimmed skills, and a rewritten summary for every single role.</p>
            </div>
            <div className="hiro-feature-cell">
              <Target className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Match scoring</h3>
              <p className="hiro-feature-body">Know your fit before you apply. A 0–100 score with specific strengths and gaps.</p>
            </div>
            <div className="hiro-feature-cell">
              <Search className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">LinkedIn contact finder</h3>
              <p className="hiro-feature-body">Searches LinkedIn as you to find interns, managers, and recruiters at the company.</p>
            </div>
            <div className="hiro-feature-cell">
              <MessageSquare className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Personalised outreach drafts</h3>
              <p className="hiro-feature-body">300-character connection notes and consultative InMails, drafted and ready.</p>
            </div>
            <div className="hiro-feature-cell">
              <BookOpen className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Interview prep kit</h3>
              <p className="hiro-feature-body">Company intelligence, talking points, and a 10-question bank with STAR answers.</p>
            </div>
          </div>
        </div>
      </section>

      <hr className="hiro-divider-line" />

      {/* METRICS */}
      <section id="metrics" className="hiro-metrics-section">
        <div className="hiro-metrics-grid">
          <div className="hiro-metric">
            <div className="hiro-metric-num">1 URL</div>
            <div className="hiro-metric-label">That is all it takes to start</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">10 sec</div>
            <div className="hiro-metric-label">To fill your entire tracker row</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">6 tabs</div>
            <div className="hiro-metric-label">Replaced by one workspace</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">100%</div>
            <div className="hiro-metric-label">Of applications tracked in one place</div>
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
          <h2 className="hiro-final-h">Your next role starts with one URL.</h2>
          <p className="hiro-final-sub">
            Stop juggling tabs and copy-pasting bullet points. Let Hiro turn every job link into a
            complete, tailored application.
          </p>
          <Link to="/register" className="hiro-cta-primary">Start tracking for free</Link>
          <p className="hiro-final-note">No credit card required. Works with any job board.</p>
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
