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
      {/* Logo area */}
      <div
        className="flex items-center"
        style={{
          minHeight: "84px",
          padding: "20px",
          borderBottom: "1px solid var(--color-border-dark)",
        }}
      >
        <div className="flex flex-col" style={{ marginLeft: 0 }}>
          <div className="flex items-start">
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "20px",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Hiro
            </span>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "9999px",
                background: "var(--color-primary)",
                marginLeft: "4px",
                position: "relative",
                top: "-8px",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--color-text-white-50)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            Become the obvious hire
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "20px 14px", flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            color: "var(--color-text-white-50)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "8px 10px 8px",
            marginBottom: "6px",
          }}
        >
          Workspace
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className="hiro-nav-link"
              activeClassName="hiro-nav-link-active"
            >
              <item.icon className="hiro-nav-icon" style={{ width: 18, height: 18 }} />
              <span className="hiro-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom user area */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--color-border-dark)",
        }}
      >
        {fullName && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "#fff",
              fontWeight: 500,
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fullName}
          </p>
        )}
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: "var(--color-text-white-50)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email}
        </p>
        <button
          onClick={handleLogout}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-white-50)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
            display: "block",
            marginTop: "4px",
            transition: "var(--transition)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-white-50)")}
        >
          Log out
        </button>
      </div>
    </div>
  );

  const sidebarStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #0F1525 0%, #0A0E1A 100%)",
    borderRight: "1px solid var(--color-border-dark)",
    padding: 0,
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg-page)" }}>
      {!isMobile && (
        <aside
          className="shrink-0 fixed inset-y-0 left-0 z-30"
          style={{ width: "240px", ...sidebarStyle }}
        >
          {sidebarContent}
        </aside>
      )}

      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside
            className="fixed inset-y-0 left-0 z-50"
            style={{ width: "240px", ...sidebarStyle }}
          >
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

      <div
        className="flex-1 flex flex-col"
        style={{
          marginLeft: !isMobile ? "240px" : 0,
          background: "var(--color-bg-page)",
          minHeight: "100vh",
        }}
      >
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
