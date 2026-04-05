import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserCircle, Link2, FileText, MessageSquare } from "lucide-react";

const steps = [
  { icon: UserCircle, title: "Build your profile once", desc: "Your experience, skills, and education — all in one place." },
  { icon: Link2, title: "Paste any job URL", desc: "We fill in all the details automatically." },
  { icon: FileText, title: "Get a tailored CV", desc: "For every role, in seconds." },
  { icon: MessageSquare, title: "Find contacts & draft messages", desc: "Ready to send, personalized outreach." },
];

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Welcome to Reachboard</h1>
        <p className="text-muted-foreground mb-10">Here's how it works:</p>

        <div className="space-y-6 text-left mb-10">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Step {i + 1}: {step.title}</p>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => navigate("/onboarding")}
          size="lg"
          className="w-full rounded-lg text-base font-semibold hover:bg-accent transition-colors"
        >
          Build my profile
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
