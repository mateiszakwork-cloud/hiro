import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { Fragment } from "react";
import StepWorkExperience from "@/components/onboarding/StepWorkExperience";
import StepEducation from "@/components/onboarding/StepEducation";
import StepSkills from "@/components/onboarding/StepSkills";
import StepLanguages from "@/components/onboarding/StepLanguages";
import type { ParsedCVData } from "@/types/cv";

const STEPS = [
  { n: 1, label: "Experience" },
  { n: 2, label: "Education" },
  { n: 3, label: "Skills" },
  { n: 4, label: "Languages" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [checkingProfile, setCheckingProfile] = useState(true);

  const cvData = (location.state as { cvData?: ParsedCVData } | null)?.cvData || null;

  const handleNext = () => { if (currentStep < STEPS.length) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };
  const handleFinish = () => navigate("/dashboard");

  // Scroll to top whenever the step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  // Guard: if onboarding is already complete, bounce to dashboard
  useEffect(() => {
    if (!isReady || !user) { return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (!error && data?.onboarding_complete) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setCheckingProfile(false);
    })();
    return () => { cancelled = true; };
  }, [isReady, user, navigate]);

  if (!isReady || (user && checkingProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Your session expired</h2>
          <p className="text-muted-foreground mb-6">Please log in again to continue.</p>
          <Button onClick={() => navigate("/login")} className="rounded-lg">Log In</Button>
        </div>
      </div>
    );
  }

  const userId = user.id;

  return (
    <div className="hiro-onboarding-bg">
      <div className="hiro-onboarding-container">
        {/* Intro framing */}
        <div className="mb-6 rounded-lg border border-border bg-card px-5 py-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Set up your experience bank — once.</span>{" "}
            <span className="text-muted-foreground">
              We know you've done this a million times for applications. On Hiro, you only do it once. Hiro stores your structured background and reuses it to tailor every future application.
            </span>
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="hiro-stepper">
            {STEPS.map((step, idx) => {
              const isComplete = step.n < currentStep;
              const isActive = step.n === currentStep;
              const cls = isComplete ? "hiro-step-circle--complete" : isActive ? "hiro-step-circle--active" : "hiro-step-circle--upcoming";
              return (
                <Fragment key={step.n}>
                  <div className="hiro-stepper-item">
                    <div className={`hiro-step-circle ${cls}`}>
                      {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step.n}
                    </div>
                    <span className="hiro-step-label">{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && <div className="hiro-step-line" />}
                </Fragment>
              );
            })}
          </div>
        </div>

        {currentStep === 1 && (
          <StepWorkExperience
            userId={userId}
            onNext={handleNext}
            initialData={cvData?.work_experiences}
          />
        )}
        {currentStep === 2 && (
          <StepEducation
            userId={userId}
            onBack={handleBack}
            onNext={handleNext}
            initialData={cvData?.education}
          />
        )}
        {currentStep === 3 && (
          <StepSkills
            userId={userId}
            onBack={handleBack}
            onNext={handleNext}
            initialHardSkills={cvData?.hard_skills}
            initialSoftSkills={cvData?.soft_skills}
          />
        )}
        {currentStep === 4 && (
          <StepLanguages
            userId={userId}
            onBack={handleBack}
            onNext={handleFinish}
            initialData={cvData?.languages}
          />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
