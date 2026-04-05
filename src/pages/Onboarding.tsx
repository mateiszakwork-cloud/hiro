import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import StepWorkExperience from "@/components/onboarding/StepWorkExperience";
import StepEducation from "@/components/onboarding/StepEducation";
import StepSkills from "@/components/onboarding/StepSkills";
import StepLanguages from "@/components/onboarding/StepLanguages";
import StepAwards from "@/components/onboarding/StepAwards";
import StepVolunteering from "@/components/onboarding/StepVolunteering";
import StepInterests from "@/components/onboarding/StepInterests";
import type { ParsedCVData } from "@/types/cv";

const TOTAL_STEPS = 7;

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);

  const cvData = (location.state as { cvData?: ParsedCVData } | null)?.cvData || null;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      const uid = session.user.id;
      const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("id", uid).single();
      if (profile?.onboarding_complete) { navigate("/dashboard"); return; }
      setUserId(uid);
    };
    checkAuth();
  }, [navigate]);

  const progressValue = (currentStep / TOTAL_STEPS) * 100;
  const handleNext = () => { if (currentStep < TOTAL_STEPS) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of {TOTAL_STEPS}</span>
        </div>
        <Progress value={progressValue} className="mb-8 h-2" />

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
