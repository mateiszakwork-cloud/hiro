import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Onboarding = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, onboarding_complete: true })
      .eq("id", session.user.id);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome aboard!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-primary text-center mb-2">Let's get you set up</h1>
        <p className="text-center text-muted-foreground mb-6">Tell us a bit about yourself</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-lg" placeholder="Jane Doe" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-lg text-base font-semibold hover:bg-accent transition-colors">
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
