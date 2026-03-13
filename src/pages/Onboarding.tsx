import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import StepWorkExperience from "@/components/onboarding/StepWorkExperience";

const TOTAL_STEPS = 4;

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      } else {
        setUserId(session.user.id);
      }
    };
    checkAuth();
  }, [navigate]);

  const progressValue = (currentStep / TOTAL_STEPS) * 100;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleFinish = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_complete: true })
      .eq("id", userId);
    if (!error) {
      navigate("/dashboard");
    }
  };

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of {TOTAL_STEPS}</span>
        </div>
        <Progress value={progressValue} className="mb-8 h-2" />

        {currentStep === 1 && (
          <StepWorkExperience userId={userId} onNext={handleNext} />
        )}
        {currentStep === 2 && (
          <Placeholder step={2} onBack={handleBack} onNext={handleNext} />
        )}
        {currentStep === 3 && (
          <Placeholder step={3} onBack={handleBack} onNext={handleNext} />
        )}
        {currentStep === 4 && (
          <Placeholder step={4} onBack={handleBack} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
};

const Placeholder = ({
  step,
  onBack,
  onNext,
  onFinish,
}: {
  step: number;
  onBack: () => void;
  onNext?: () => void;
  onFinish?: () => void;
}) => (
  <div className="rounded-lg bg-card p-8 shadow-sm">
    <h1 className="text-2xl font-bold text-foreground">Step {step}</h1>
    <p className="mt-2 text-muted-foreground">Coming soon…</p>
    <div className="mt-8 flex justify-between">
      <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      {onNext && (
        <button onClick={onNext} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors">
          Next →
        </button>
      )}
      {onFinish && (
        <button onClick={onFinish} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors">
          Finish
        </button>
      )}
    </div>
  </div>
);

export default Onboarding;
