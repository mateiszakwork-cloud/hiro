import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import StepWorkExperience from "@/components/onboarding/StepWorkExperience";
import StepEducation from "@/components/onboarding/StepEducation";
import StepSkills from "@/components/onboarding/StepSkills";
import StepLanguages from "@/components/onboarding/StepLanguages";

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
        return;
      }
      const uid = session.user.id;

      // Redirect if onboarding already complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", uid)
        .single();

      if (profile?.onboarding_complete) {
        navigate("/dashboard");
        return;
      }

      setUserId(uid);
    };
    checkAuth();
  }, [navigate]);

  const progressValue = (currentStep / TOTAL_STEPS) * 100;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
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
          <StepEducation userId={userId} onBack={handleBack} onNext={handleNext} />
        )}
        {currentStep === 3 && (
          <StepSkills userId={userId} onBack={handleBack} onNext={handleNext} />
        )}
        {currentStep === 4 && (
          <StepLanguages userId={userId} onBack={handleBack} onFinish={() => navigate("/dashboard")} />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
