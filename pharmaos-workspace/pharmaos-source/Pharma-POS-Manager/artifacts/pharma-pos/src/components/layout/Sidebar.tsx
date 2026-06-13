import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Archive, 
  Users, 
  FileText, 
  MessageSquare,
  LogOut,
} from "lucide-react";
import { PharmaPOSLogo } from "./PharmaPOSLogo";
import { useAuth } from "@/contexts/AuthContext";

export function Sidebar() {
  const [location] = useLocation();
  const { user, modules, logout } = useAuth();
  const enabled = new Set(modules.length ? modules : ["dashboard", "checkout", "products", "inventory", "sales", "staff", "messages"]);

  const links = [
    { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
    { key: "checkout", href: "/checkout", label: "Checkout", icon: ShoppingCart },
    { key: "products", href: "/products", label: "Products", icon: Package },
    { key: "inventory", href: "/inventory", label: "Inventory", icon: Archive },
    { key: "sales", href: "/sales", label: "Sales", icon: FileText },
    ...(["pharmacy_owner", "manager"].includes(user?.role ?? "") ? [{ key: "staff", href: "/staff", label: "Staff", icon: Users }] : []),
    { key: "messages", href: "/messages", label: "Messages", icon: MessageSquare },
  ].filter(link => enabled.has(link.key));

  return (
    <div className="sidebar-root w-64 flex flex-col h-full hidden md:flex">
      <div className="sidebar-logo-area px-4 py-5 flex items-center gap-3">
        <div className="relative" style={{ filter: "drop-shadow(0 0 6px #00e87eaa) drop-shadow(0 0 14px #00c46a55)" }}>
          <PharmaPOSLogo size={38} />
        </div>
        <div>
          <span
            className="font-black text-base tracking-tight"
            style={{
              background: "linear-gradient(90deg, #00ffaa 0%, #00e87e 50%, #00c46a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 8px #00e87e88)",
            }}
          >PharmaOS</span>
          <p className="text-[10px] text-sidebar-muted uppercase tracking-widest leading-tight">Management System</p>
        </div>
      </div>

      <div className="px-3 mb-2">
        <div className="sidebar-divider" />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <p className="px-4 text-[9px] uppercase tracking-widest text-sidebar-muted mb-2 mt-1">Navigation</p>
        <ul className="space-y-0.5 px-2">
          {links.map((link) => {
            const isActive =
              location === link.href ||
              (link.href !== "/" && location.startsWith(link.href));
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive ? "sidebar-link-active" : "sidebar-link-inactive"
                  }`}
                >
                  <div className={`sidebar-icon-wrap flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isActive ? "sidebar-icon-active" : "sidebar-icon-inactive"
                  }`}>
                    <link.icon size={15} />
                  </div>
                  <span className="text-sm font-medium">{link.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 mb-2">
        <div className="sidebar-divider" />
      </div>

      <div className="px-4 pb-4 space-y-2">
        <div className="sidebar-status-card rounded-xl px-3 py-2.5 flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-50" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-white/80 truncate">{user?.name ?? "System Online"}</p>
            <p className="text-[9px] text-sidebar-muted">All services running</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/35 hover:text-red-400 transition-colors"
          >
            <LogOut size={12} />
          </button>
        </div>
        <p className="text-[9px] text-sidebar-muted text-center tracking-wider">PharmaOS v1.0 · EAT (GMT+3)</p>
      </div>
    </div>
  );
}
