import { useState } from "react";
import { Link2, FileText, Users, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Called when the user completes the tour (clicks "Set up my profile"). */
  onComplete: () => void;
  /** Called when the user clicks "Skip tour". */
  onSkip: () => void;
};

const TOTAL_STEPS = 5;

const ProductTour = ({ onComplete, onSkip }: Props) => {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div
        className="relative w-full max-w-[560px] rounded-2xl bg-card shadow-2xl overflow-hidden"
        style={{ border: "1px solid var(--color-border, hsl(var(--border)))" }}
      >
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-muted">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: "var(--color-primary)" }}
          />
        </div>

        {/* Step counter */}
        <div className="flex items-center justify-between px-7 pt-5 pb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </span>
          <span className="hiro-welcome-wordmark" style={{ fontSize: 16 }}>
            Hiro<span className="hiro-welcome-dot" />
          </span>
        </div>

        {/* Content */}
        <div className="px-7 pb-4 pt-2 min-h-[340px]">
          {step === 1 && (
            <div className="text-left">
              <h2 id="tour-title" className="text-2xl font-bold text-foreground leading-tight mb-3">
                Before you start — here's what you're building towards.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hiro turns a job link into a tailored CV, relevant LinkedIn contacts, and ready-to-send
                messages. The setup takes 10 minutes and makes every feature actually work.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { icon: FileText, label: "Tailored CV" },
                  { icon: Users, label: "Right contacts" },
                  { icon: Sparkles, label: "Drafted outreach" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 p-4"
                  >
                    <item.icon className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-left">
              <h2 id="tour-title" className="text-xl font-bold text-foreground mb-2">
                Paste a job link
              </h2>
              {/* Static URL bar visual */}
              <div className="my-5 rounded-xl border border-border bg-[#0F172A] p-4">
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5">
                  <Link2 className="h-4 w-4 text-white/40 shrink-0" />
                  <span className="text-xs text-white/70 font-mono truncate">
                    https://careers.spotify.com/job/product-manager-growth-12389
                  </span>
                  <span
                    className="ml-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    + Add
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-primary)" }} />
                  Reading the posting…
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paste any job posting URL. Hiro reads the description and fills in the role details
                and required skills so you can build a tailored application faster.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="text-left">
              <h2 id="tour-title" className="text-xl font-bold text-foreground mb-2">
                Get a tailored CV
              </h2>
              {/* Before / after */}
              <div className="my-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Before — generic
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    Worked on marketing projects and helped the team with various campaigns.
                  </p>
                </div>
                <div
                  className="rounded-xl border-2 p-4"
                  style={{ borderColor: "var(--color-primary)", background: "rgba(149, 6, 6, 0.04)" }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-primary)" }}
                  >
                    After — tailored
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    Led a 4-person growth campaign that lifted MQLs by 32% in 8 weeks, owning brief,
                    creative QA and channel mix.
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hiro rewrites your CV bullets to match each role. The better your profile, the stronger
                the output.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="text-left">
              <h2 id="tour-title" className="text-xl font-bold text-foreground mb-2">
                Find contacts and draft outreach
              </h2>
              {/* Contact card mock */}
              <div className="my-5 space-y-3">
                <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                    style={{ background: "var(--color-primary)" }}
                  >
                    SM
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Sarah Müller</p>
                    <p className="text-xs text-muted-foreground">Senior Growth Manager · Spotify</p>
                    <span
                      className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(149, 6, 6, 0.1)", color: "var(--color-primary)" }}
                    >
                      Hiring Manager
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Drafted connection note
                  </p>
                  <p className="text-xs text-foreground leading-relaxed italic">
                    "Hi Sarah — saw the Growth PM opening on your team. I led a similar lifecycle
                    rebuild at Klarna and would love to learn how you're thinking about activation at
                    Spotify…"
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hiro finds hiring managers and people in the role on LinkedIn, then drafts a
                personalised message for each one.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="text-left">
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(149, 6, 6, 0.1)" }}
              >
                <Sparkles className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
              </div>
              <h2 id="tour-title" className="text-2xl font-bold text-foreground leading-tight mb-3">
                Now let's set up your profile.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This is the most important step. Your tailored CVs, outreach messages, and interview prep
                all depend on what you put in here. Take 10 minutes to do it properly.
              </p>
              <div
                className="mt-5 rounded-xl border-l-4 p-4"
                style={{ borderLeftColor: "var(--color-primary)", background: "rgba(149, 6, 6, 0.04)" }}
              >
                <p className="text-xs text-foreground">
                  <span className="font-semibold">Tip:</span> Add 4–6 bullets per role and your full
                  skill list. Hiro picks what's relevant for each application.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-7 py-4 bg-muted/20">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && step < TOTAL_STEPS && (
              <Button variant="outline" size="sm" onClick={prev} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                size="sm"
                onClick={next}
                className="gap-1.5"
                style={{ background: "var(--color-primary)" }}
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onComplete}
                className="gap-1.5"
                style={{ background: "var(--color-primary)" }}
              >
                Set up my profile <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductTour;