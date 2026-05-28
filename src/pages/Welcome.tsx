import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserCircle, Link2, FileText, Users, Upload, Loader2, CheckCircle, AlertTriangle, RotateCcw, ClipboardPaste, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ParsedCVData } from "@/types/cv";
import ProductTour from "@/components/ProductTour";

const steps = [
  { icon: UserCircle, title: "Set up your experience bank — once" },
  { icon: Link2, title: "Paste any job URL" },
  { icon: FileText, title: "Hiro picks the most relevant experience, bullets and skills for that role" },
  { icon: Users, title: "Track applications and craft outreach in one place" },
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
  const [tourState, setTourState] = useState<"loading" | "show" | "hide">("loading");
  const [isDragging, setIsDragging] = useState(false);

  // Decide whether to show the first-login product tour
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("tour_complete")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const done = (data as any)?.tour_complete === true;
      setTourState(done ? "hide" : "show");
    };
    if (isReady && user) check();
    return () => { cancelled = true; };
  }, [isReady, user]);

  const markTourComplete = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ tour_complete: true } as any).eq("id", user.id);
  };

  const handleTourFinish = async () => {
    setTourState("hide");
    await markTourComplete();
    navigate("/onboarding");
  };

  const handleTourSkip = async () => {
    setTourState("hide");
    await markTourComplete();
    navigate("/onboarding");
  };

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
    if (showPasteMode) return;
    fileInputRef.current?.click();
  };

  const handleProceed = () => {
    navigate("/onboarding", { state: { cvData: parsed } });
  };

  return (
    <>
      {tourState === "show" && (
        <ProductTour onComplete={handleTourFinish} onSkip={handleTourSkip} />
      )}
    <div className="hiro-onboarding-bg flex items-center justify-center">
      <div className="hiro-onboarding-container w-full" style={{ maxWidth: 560 }}>
        <div className="hiro-form-card">
          <div className="text-center">
            <span className="hiro-welcome-wordmark">
              Hiro<span className="hiro-welcome-dot" />
            </span>
            <h1 className="hiro-welcome-heading">Set up your experience bank</h1>
            <p className="hiro-welcome-subtext">
              We know you've done this a million times for applications. On Hiro, you only do it once — then we reuse your structured background to tailor every future application.
            </p>
          </div>

          {/* 4-step visual flow */}
          <div className="grid grid-cols-2 gap-3 mt-8">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-foreground leading-snug pt-0.5">{step.title}</p>
              </div>
            ))}
          </div>

          {/* Optional CV import */}
          <div className="mt-8">
            <p className="text-sm font-semibold text-foreground">Optional: import from an existing CV</p>
            <p className="text-xs text-muted-foreground mt-1">
              This is a shortcut, not the main path. Building your bank manually usually gives Hiro better material to tailor with.
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              CV import can help you get started, but it may miss context or wording. Review every section before saving.
            </p>
          </div>

          <div className="mt-6 rounded-lg border-2 border-dashed border-border p-6 bg-muted/30">
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
                <p className="text-sm font-medium text-foreground text-center">{errorMessage || "We had trouble reading your CV."}</p>
                <p className="text-xs text-muted-foreground">You can try again or fill in your profile manually.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setParseError(false); setShowPasteMode(true); }}>
                    Paste as text
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleProceed}>
                    Build manually
                  </Button>
                </div>
              </div>
            ) : parsed ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium text-foreground text-center">{summary}</p>
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
                  className="flex items-center justify-center gap-2 w-full text-sm font-medium text-primary hover:opacity-80 transition-opacity"
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

          {/* Primary action: build manually. Import stays available above. */}
          <div className="mt-6">
            {parsed ? (
              <button onClick={handleProceed} className="hiro-upload-btn">
                Review imported data & continue
              </button>
            ) : (
              <button onClick={handleProceed} disabled={uploading} className="hiro-upload-btn">
                Build my experience bank
              </button>
            )}
            <p className="hiro-build-manual-link mt-3 text-center" style={{ background: "transparent", border: "none" }}>
              You can always import a CV later from your profile.
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Welcome;
