import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserCircle, Link2, FileText, MessageSquare, Upload, Loader2, CheckCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedCVData } from "@/types/cv";

const steps = [
  { icon: UserCircle, title: "Build your profile once", desc: "Your experience, skills, and education — all in one place." },
  { icon: Link2, title: "Paste any job URL", desc: "We fill in all the details automatically." },
  { icon: FileText, title: "Get a tailored CV", desc: "For every role, in seconds." },
  { icon: MessageSquare, title: "Find contacts & draft messages", desc: "Ready to send, personalized outreach." },
];

const Welcome = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedCVData | null>(null);
  const [summary, setSummary] = useState("");
  const [parseError, setParseError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Wait for auth session to be ready (handles post-registration timing)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setParseError(true);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setParseError(true);
      return;
    }

    setUploading(true);
    setParsed(null);
    setSummary("");
    setParseError(false);

    try {
      // Re-fetch session right before upload to guarantee freshness
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setParseError(true);
        setUploading(false);
        return;
      }

      const uid = session.user.id;
      const filePath = `${uid}/cv-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("cv-uploads")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setParseError(true);
        setUploading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("parse-cv", {
        body: { filePath },
      });

      if (fnError) {
        console.error("Parse error:", fnError);
        setParseError(true);
        setUploading(false);
        return;
      }

      const cvData = data as ParsedCVData;
      setParsed(cvData);

      const expCount = cvData.work_experiences?.length || 0;
      const skillCount = (cvData.hard_skills?.length || 0) + (cvData.soft_skills?.length || 0);
      setSummary(`We found ${expCount} experience${expCount !== 1 ? "s" : ""} and ${skillCount} skill${skillCount !== 1 ? "s" : ""}. Review and edit below.`);
    } catch (err) {
      console.error("CV upload error:", err);
      setParseError(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    setParseError(false);
    setParsed(null);
    setSummary("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleProceed = () => {
    navigate("/onboarding", { state: { cvData: parsed } });
  };

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

        {/* CV Upload Section */}
        <div className="mb-4 rounded-lg border-2 border-dashed border-border p-6 bg-muted/30">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Parsing your CV...</p>
              <p className="text-xs text-muted-foreground">This may take a few seconds</p>
            </div>
          ) : parseError ? (
            <div className="flex flex-col items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-foreground">We had trouble reading your CV.</p>
              <p className="text-xs text-muted-foreground">You can try again or fill in your profile manually.</p>
              <div className="flex gap-3 mt-1">
                <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </Button>
                <Button variant="outline" size="sm" onClick={handleProceed}>
                  Fill in manually
                </Button>
              </div>
            </div>
          ) : parsed ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-foreground">{summary}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import from CV (PDF)
            </button>
          )}
        </div>

        <Button
          onClick={handleProceed}
          size="lg"
          disabled={uploading}
          className="w-full rounded-lg text-base font-semibold hover:bg-accent transition-colors"
        >
          {parsed ? "Review & edit my profile" : "Build my profile"}
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
