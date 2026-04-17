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
              One URL. Everything you need.
            </span>
            <h1 className="hiro-hero-headline">Become the obvious hire.</h1>
            <p className="hiro-hero-sub">One link. Full application kit.</p>
            <p className="hiro-hero-body">
              Paste any job URL and Hiro fills in the details, builds your tailored CV, finds who to
              contact at the company, and drafts the messages. The whole application workflow, done
              properly.
            </p>
            <div className="hiro-hero-cta-row">
              <Link to="/register" className="hiro-cta-primary">Start for free</Link>
              <a href="#how" className="hiro-cta-secondary">See how it works</a>
            </div>
            <div className="hiro-social-proof">
              <div className="hiro-avatars">
                <div className="hiro-avatar" />
                <div className="hiro-avatar" />
                <div className="hiro-avatar" />
              </div>
              <span className="hiro-social-text">Used by students at CEMS, RSM, and Nova SBE</span>
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
          <p className="hiro-section-eyebrow">The workflow</p>
          <h2 className="hiro-section-heading">Three steps. Complete application.</h2>
          <p className="hiro-section-subtext">
            Most people spend hours on each application. Hiro cuts that to minutes without cutting corners.
          </p>

          <div className="hiro-how-grid">
            <div className="hiro-how-card">
              <div className="hiro-how-num">01</div>
              <div className="hiro-how-icon-wrap"><Link2 className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Drop in the link</h3>
              <p className="hiro-how-body">
                Paste any job URL — LinkedIn, Workday, Greenhouse, or a direct careers page. Hiro reads
                the posting and fills every column in your tracker automatically.
              </p>
            </div>
            <div className="hiro-how-arrow">→</div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">02</div>
              <div className="hiro-how-icon-wrap"><Sparkles className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Get your application kit</h3>
              <p className="hiro-how-body">
                A tailored CV with the right bullets selected, your skills trimmed to what matters for
                this role, and a summary rewritten for this specific company.
              </p>
            </div>
            <div className="hiro-how-arrow">→</div>
            <div className="hiro-how-card">
              <div className="hiro-how-num">03</div>
              <div className="hiro-how-icon-wrap"><Users className="h-6 w-6" /></div>
              <h3 className="hiro-how-h">Reach out properly</h3>
              <p className="hiro-how-body">
                Hiro searches LinkedIn as you, finds current interns, the hiring manager, and recruiters,
                then drafts a 300-character connection note and a longer InMail for the most important
                contacts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="hiro-features-section">
        <div className="hiro-section-inner">
          <p className="hiro-section-eyebrow hiro-section-eyebrow-light">What Hiro does</p>
          <h2 className="hiro-section-heading hiro-section-heading-dark">Everything in one tab.</h2>

          <div className="hiro-features-grid">
            <div className="hiro-feature-cell">
              <ScanLine className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Job tracker that fills itself</h3>
              <p className="hiro-feature-body">Paste a URL and every column — company, role, location, skills, deadline — fills in automatically. No more copy-pasting.</p>
            </div>
            <div className="hiro-feature-cell">
              <FileCheck2 className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">CV tailored to each role</h3>
              <p className="hiro-feature-body">Your master profile, trimmed and reordered for every single application. Copy the right bullets in one click.</p>
            </div>
            <div className="hiro-feature-cell">
              <Target className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Know your fit before you apply</h3>
              <p className="hiro-feature-body">A match score with specific strengths and gaps so you know exactly where to focus your cover note.</p>
            </div>
            <div className="hiro-feature-cell">
              <Search className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Find the right people</h3>
              <p className="hiro-feature-body">Searches LinkedIn as you to surface current interns, hiring managers, and HR contacts at the company.</p>
            </div>
            <div className="hiro-feature-cell">
              <MessageSquare className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Messages that actually get replies</h3>
              <p className="hiro-feature-body">A tight 300-character connection note and a longer, consultative InMail — both drafted, both editable, both ready to send.</p>
            </div>
            <div className="hiro-feature-cell">
              <BookOpen className="hiro-feature-icon h-8 w-8" />
              <h3 className="hiro-feature-h">Interview prep that goes deep</h3>
              <p className="hiro-feature-body">Company context, your strongest talking points, and ten likely questions with answer frameworks using your real experience.</p>
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
            <div className="hiro-metric-label">to start the whole process</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">&lt; 30s</div>
            <div className="hiro-metric-label">to fill your tracker row</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">6 tools</div>
            <div className="hiro-metric-label">replaced by one tab</div>
          </div>
          <div className="hiro-metric">
            <div className="hiro-metric-num">0 tabs</div>
            <div className="hiro-metric-label">of frantic copy-pasting</div>
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
          <h2 className="hiro-final-h">One tab. Every application.</h2>
          <p className="hiro-final-sub">
            Stop juggling spreadsheets, CV files, and LinkedIn tabs. Hiro keeps everything in one place
            so you can focus on what actually matters.
          </p>
          <Link to="/register" className="hiro-cta-primary">Get started free</Link>
          <p className="hiro-final-note">Takes two minutes to set up. No card needed.</p>
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
