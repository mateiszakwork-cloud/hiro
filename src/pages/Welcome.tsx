import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserCircle, Link2, FileText, MessageSquare, Upload, Loader2, CheckCircle, AlertTriangle, RotateCcw, ClipboardPaste } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ParsedCVData } from "@/types/cv";

const steps = [
  { icon: UserCircle, title: "Build your profile once", desc: "Your experience, skills, and education — all in one place." },
  { icon: Link2, title: "Paste any job URL", desc: "We fill in all the details automatically." },
  { icon: FileText, title: "Get a tailored CV", desc: "For every role, in seconds." },
  { icon: MessageSquare, title: "Find contacts & draft messages", desc: "Ready to send, personalized outreach." },
];

const Welcome = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedCVData | null>(null);
  const [summary, setSummary] = useState("");
  const [parseError, setParseError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");

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

  const handleParseSuccess = (data: ParsedCVData) => {
    setParsed(data);
    const expCount = data.work_experiences?.length || 0;
    const skillCount = (data.hard_skills?.length || 0) + (data.soft_skills?.length || 0);
    setSummary(`We found ${expCount} experience${expCount !== 1 ? "s" : ""} and ${skillCount} skill${skillCount !== 1 ? "s" : ""}. Review and edit below.`);
  };

  const handleParseError = (msg: string) => {
    setErrorMessage(msg);
    setParseError(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      handleParseError("Please upload a PDF version of your CV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      handleParseError("Your CV is too large. Please use a version under 10MB.");
      return;
    }

    setUploading(true);
    setParsed(null);
    setSummary("");
    setParseError(false);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data, error: fnError } = await supabase.functions.invoke("parse-cv", {
        body: formData,
      });

      if (fnError) {
        handleParseError(fnError.message || "Failed to parse your CV.");
        return;
      }
      if (data?.success === false) {
        handleParseError(data.message || "Failed to parse your CV.");
        return;
      }
      handleParseSuccess(data as ParsedCVData);
    } catch (err) {
      handleParseError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setUploading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 50) {
      handleParseError("Please paste more text. We need your full CV to parse it.");
      return;
    }

    setUploading(true);
    setParsed(null);
    setSummary("");
    setParseError(false);
    setErrorMessage("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-cv", {
        body: { text: pastedText },
      });

      if (fnError) {
        handleParseError(fnError.message || "Failed to parse your CV.");
        return;
      }
      if (data?.success === false) {
        handleParseError(data.message || "Failed to parse your CV.");
        return;
      }
      handleParseSuccess(data as ParsedCVData);
      setShowPasteMode(false);
    } catch (err) {
      handleParseError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    setParseError(false);
    setParsed(null);
    setSummary("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (showPasteMode) return; // stay in paste mode
    fileInputRef.current?.click();
  };

  const handleProceed = () => {
    navigate("/onboarding", { state: { cvData: parsed } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Welcome to Hiro</h1>
        <p className="text-muted-foreground mb-6">Paste a job URL. Get a tailored CV, contacts to reach out to, and your full application tracked.</p>
        <p className="text-sm text-muted-foreground mb-10">Here's how it works:</p>

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
              <p className="text-sm font-medium text-foreground">{errorMessage || "We had trouble reading your CV."}</p>
              <p className="text-xs text-muted-foreground">You can try again or fill in your profile manually.</p>
              <div className="flex gap-3 mt-1">
                <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setParseError(false); setShowPasteMode(true); }}>
                  Paste as text instead
                </Button>
                <Button variant="outline" size="sm" onClick={handleProceed}>
                  Build manually
                </Button>
              </div>
            </div>
          ) : parsed ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-foreground">{summary}</p>
            </div>
          ) : showPasteMode ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Paste your CV text below</p>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your full CV text here..."
                className="min-h-[200px] text-sm"
              />
              <div className="flex gap-3 justify-center">
                <Button size="sm" onClick={handlePasteSubmit} disabled={!pastedText.trim()} className="gap-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Parse CV
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowPasteMode(false); setPastedText(""); }}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 w-full text-sm font-medium text-primary hover:text-accent transition-colors"
              >
                <Upload className="h-4 w-4" />
                Import from CV (PDF)
              </button>
              <button
                type="button"
                onClick={() => setShowPasteMode(true)}
                className="flex items-center justify-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste CV as text
              </button>
            </div>
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
