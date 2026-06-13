import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { PharmaPOSLogo } from "./PharmaPOSLogo";
import { LayoutDashboard, Building2, LogOut, ShieldCheck } from "lucide-react";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pharmacies", label: "Pharmacies", icon: Building2, exact: false },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: "#080f1c" }}>
      {/* Admin Sidebar */}
      <div className="w-60 flex flex-col flex-shrink-0" style={{
        background: "linear-gradient(160deg,#080f1c 0%,#091a10 100%)",
        borderRight: "1px solid rgba(0,196,106,0.1)",
      }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div style={{ filter: "drop-shadow(0 0 6px #00e87eaa)" }}>
            <PharmaPOSLogo size={34} />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight"
              style={{ background: "linear-gradient(90deg,#00ffaa,#00c46a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              PharmaOS
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck size={9} className="text-amber-400" />
              <p className="text-[9px] text-amber-400/80 uppercase tracking-widest font-semibold">Admin Panel</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mb-3" style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(0,196,106,0.2),transparent)" }} />

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <p className="px-3 text-[9px] uppercase tracking-widest text-green-400/40 mb-2 mt-1">Navigation</p>
          {links.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? location === href : location.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                  ? "text-white border border-green-500/25"
                  : "text-white/75 border border-transparent hover:text-white hover:bg-white/5"}`}
                style={isActive ? { background: "linear-gradient(90deg,rgba(0,196,106,0.2),rgba(0,196,106,0.05))" } : {}}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/60"}`}
                  style={isActive ? { boxShadow: "0 0 8px rgba(0,196,106,0.3)" } : {}}>
                  <Icon size={14} />
                </div>
                <span className="text-sm font-medium">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 mb-3" style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(0,196,106,0.2),transparent)" }} />

        <div className="px-4 pb-5">
          <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={14} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90 truncate">{user?.name}</p>
              <p className="text-[10px] text-amber-400/70">System Admin</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-red-400 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8" style={{ background: "linear-gradient(135deg,#0d1117 0%,#0a1f12 100%)" }}>
        {children}
      </main>
    </div>
  );
}
