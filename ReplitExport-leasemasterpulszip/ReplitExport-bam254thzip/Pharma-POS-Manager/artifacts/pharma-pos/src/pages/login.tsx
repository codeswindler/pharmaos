import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { PharmaPOSLogo } from "@/components/layout/PharmaPOSLogo";
import {
  ShoppingCart, Package, CreditCard, BarChart3, Users, MessageSquare,
  ChevronRight, Eye, EyeOff, Loader2, CheckCircle2
} from "lucide-react";

const FEATURES = [
  { icon: ShoppingCart, label: "Point of Sale", desc: "Fast, touch-friendly checkout with barcode scanning" },
  { icon: Package, label: "Inventory Management", desc: "Real-time stock tracking with low-stock alerts" },
  { icon: CreditCard, label: "M-PESA & Cash Payments", desc: "Integrated M-PESA STK push and cash handling" },
  { icon: Users, label: "Customer CRM", desc: "Customer profiles, purchase history, loyalty tracking" },
  { icon: BarChart3, label: "Analytics & Reports", desc: "Revenue trends, top products, performance insights" },
  { icon: MessageSquare, label: "SMS Campaigns", desc: "Bulk SMS and email campaigns to your customers" },
];

const STATS = [
  { value: "500+", label: "Pharmacies Onboarded" },
  { value: "KES 2B+", label: "Transactions Processed" },
  { value: "99.9%", label: "Uptime Guaranteed" },
];

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const token = localStorage.getItem("pharmaos_token");
      if (!token) { setError("Login failed"); return; }
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      const { user } = await res.json();
      if (user.role === "admin") navigate("/admin");
      else navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080f1c" }}>
      {/* Left — Marketing panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #080f1c 0%, #081a10 60%, #0a2218 100%)",
          borderRight: "1px solid rgba(0,196,106,0.12)",
        }}
      >
        {/* Glow orbs */}
        <div style={{ position: "absolute", top: "-80px", left: "-80px", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,196,106,0.09) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,120,255,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Logo + wordmark */}
        <div className="flex items-center gap-4 relative z-10">
          <div style={{ filter: "drop-shadow(0 0 10px #00e87eaa)" }}>
            <PharmaPOSLogo size={48} />
          </div>
          <div>
            <span
              className="font-black text-2xl tracking-tight"
              style={{
                background: "linear-gradient(90deg, #00ffaa 0%, #00e87e 50%, #00c46a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >PharmaOS</span>
            <p className="text-[11px] text-green-400/60 uppercase tracking-widest">Management System</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 my-8">
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            The complete pharmacy<br />
            <span style={{ background: "linear-gradient(90deg, #00ffaa, #00c46a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              operating system.
            </span>
          </h1>
          <p className="text-white/55 text-lg leading-relaxed max-w-md">
            Run your pharmacy smarter — from dispensing to payments, inventory to customer care, all in one seamless platform built for Kenyan pharmacies.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 grid grid-cols-1 gap-3 mb-8">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                style={{ background: "rgba(0,196,106,0.12)", border: "1px solid rgba(0,196,106,0.2)" }}>
                <Icon size={15} className="text-green-400" />
              </div>
              <div>
                <p className="text-white/90 text-sm font-semibold">{label}</p>
                <p className="text-white/45 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="relative z-10 flex gap-8 pt-6" style={{ borderTop: "1px solid rgba(0,196,106,0.12)" }}>
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-black" style={{ background: "linear-gradient(90deg,#00ffaa,#00c46a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</p>
              <p className="text-white/45 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <PharmaPOSLogo size={36} />
          <span className="font-black text-xl" style={{ background: "linear-gradient(90deg,#00ffaa,#00c46a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>PharmaOS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-white/45 text-sm">Sign in to your PharmaOS account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@pharmacy.co.ke"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,196,106,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,196,106,0.08)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,196,106,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,196,106,0.08)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: loading ? "rgba(0,196,106,0.4)" : "linear-gradient(90deg,#00e87e,#00c46a)",
                color: "#000",
                boxShadow: loading ? "none" : "0 4px 20px rgba(0,196,106,0.35)",
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-2 text-xs text-white/35">
              <CheckCircle2 size={12} className="text-green-400/60 mt-0.5 flex-shrink-0" />
              <span>Admin accounts are redirected to the system management panel</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-white/35">
              <CheckCircle2 size={12} className="text-green-400/60 mt-0.5 flex-shrink-0" />
              <span>Hospital accounts go directly to the POS dashboard</span>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-white/20">
            PharmaOS v1.0 · EAT (GMT+3) · © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
