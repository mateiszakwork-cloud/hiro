import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, onboarding_complete")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.onboarding_complete) {
        navigate("/onboarding");
        return;
      }
      setFullName(profile?.full_name || "");
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Tappy</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Hi, {fullName}</span>
          <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-lg border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
            Log Out
          </Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
        <p className="text-muted-foreground">Your job applications will appear here.</p>
      </main>
    </div>
  );
};

export default Dashboard;
