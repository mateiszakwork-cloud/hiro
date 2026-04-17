import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { Fragment } from "react";
import StepWorkExperience from "@/components/onboarding/StepWorkExperience";
import StepEducation from "@/components/onboarding/StepEducation";
import StepSkills from "@/components/onboarding/StepSkills";
import StepLanguages from "@/components/onboarding/StepLanguages";
import StepAwards from "@/components/onboarding/StepAwards";
import StepVolunteering from "@/components/onboarding/StepVolunteering";
import StepInterests from "@/components/onboarding/StepInterests";
import type { ParsedCVData } from "@/types/cv";

const STEPS = [
  { n: 1, label: "Experience" },
  { n: 2, label: "Education" },
  { n: 3, label: "Skills" },
  { n: 4, label: "Languages" },
  { n: 5, label: "Awards" },
  { n: 6, label: "Volunteer" },
  { n: 7, label: "Interests" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  const cvData = (location.state as { cvData?: ParsedCVData } | null)?.cvData || null;

  const handleNext = () => { if (currentStep < STEPS.length) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };

  if (!isReady) {
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
            onNext={handleNext}
            initialData={cvData?.languages}
          />
        )}
        {currentStep === 5 && <StepAwards userId={userId} onBack={handleBack} onNext={handleNext} />}
        {currentStep === 6 && <StepVolunteering userId={userId} onBack={handleBack} onNext={handleNext} />}
        {currentStep === 7 && <StepInterests userId={userId} onBack={handleBack} onFinish={() => navigate("/dashboard")} />}
      </div>
    </div>
  );
};

export default Onboarding;
