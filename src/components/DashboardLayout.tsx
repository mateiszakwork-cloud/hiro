import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, User, LogOut, Menu, X, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { label: "Job Tracker", to: "/dashboard", icon: Table },
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/settings", icon: Settings },
];

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setEmail(session.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete, full_name")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        if (!profile.onboarding_complete) navigate("/onboarding");
      }
    };
    check();
  }, [navigate]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex flex-col px-5 py-6">
        <span className="text-xl font-bold text-white">Hiro</span>
        <span className="text-xs text-white/50">Become the obvious hire.</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            activeClassName="!bg-white !text-[#950606] font-semibold"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-5 space-y-3">
        {fullName && <p className="text-sm text-white font-medium truncate">{fullName}</p>}
        <p className="text-xs text-white/50 truncate">{email}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F6FA" }}>
      {!isMobile && (
        <aside className="w-60 shrink-0 fixed inset-y-0 left-0 z-30" style={{ background: "#950606" }}>
          {sidebarContent}
        </aside>
      )}

      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-60 z-50" style={{ background: "#950606" }}>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      <div className={`flex-1 flex flex-col ${!isMobile ? "ml-60" : ""}`}>
        {isMobile && (
          <header className="sticky top-0 z-20 flex items-center h-14 px-4 border-b bg-white">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="ml-3 font-bold text-foreground">Hiro</span>
          </header>
        )}

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
