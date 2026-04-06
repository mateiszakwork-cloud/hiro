import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Wait for Supabase to process the URL hash/params
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/login");
        return;
      }

      // Check onboarding status
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.onboarding_complete) {
        navigate("/welcome");
      } else {
        navigate("/dashboard");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
