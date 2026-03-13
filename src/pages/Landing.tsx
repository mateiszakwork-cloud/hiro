import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-2xl px-6">
        <h1 className="text-5xl font-bold text-primary mb-4 tracking-tight">
          Your entire job search, in one place
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Track applications, tailor your CV, and reach out to the right people, all from a single URL
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg" className="px-8 rounded-lg text-base font-semibold transition-colors hover:bg-accent">
            <Link to="/register">Sign Up</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8 rounded-lg text-base font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
            <Link to="/login">Log In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
