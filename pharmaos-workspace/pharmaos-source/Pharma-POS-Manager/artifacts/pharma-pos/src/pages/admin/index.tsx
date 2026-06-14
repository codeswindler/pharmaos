import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Users, DollarSign, AlertTriangle, Plus, TrendingUp } from "lucide-react";

interface Stats {
  total: number;
  active: number;
  suspended: number;
  paidSmsRevenue: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  const cards = [
    { label: "Total Pharmacies", value: stats?.total ?? 0, icon: Building2, color: "#00c46a", bg: "rgba(0,196,106,0.1)", border: "rgba(0,196,106,0.2)" },
    { label: "Active Accounts", value: stats?.active ?? 0, icon: TrendingUp, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)" },
    { label: "Paid SMS Revenue", value: `KES ${(stats?.paidSmsRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", large: true },
    { label: "Suspended", value: stats?.suspended ?? 0, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/45 text-sm mt-1">Manage pharmacies, subscriptions, and system health</p>
        </div>
        <Link href="/admin/pharmacies/new">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-black transition-all"
            style={{ background: "linear-gradient(90deg,#00e87e,#00c46a)", boxShadow: "0 4px 16px rgba(0,196,106,0.3)" }}>
            <Plus size={15} />
            Add Pharmacy
          </button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.07)` }}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/45 uppercase tracking-wider font-medium">{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}` }}>
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/pharmacies/new">
            <div className="p-4 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
              style={{ border: "1px solid rgba(0,196,106,0.15)", background: "rgba(0,196,106,0.05)" }}>
              <Building2 size={20} className="text-green-400 mb-2" />
              <p className="text-sm font-semibold text-white">Onboard Pharmacy</p>
              <p className="text-xs text-white/40 mt-1">Create a new pharmacy account and set its subscription plan</p>
            </div>
          </Link>
          <Link href="/admin/pharmacies">
            <div className="p-4 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
              style={{ border: "1px solid rgba(59,130,246,0.15)", background: "rgba(59,130,246,0.05)" }}>
              <Users size={20} className="text-blue-400 mb-2" />
              <p className="text-sm font-semibold text-white">Manage Accounts</p>
              <p className="text-xs text-white/40 mt-1">View, edit, or suspend pharmacy accounts</p>
            </div>
          </Link>
          <div className="p-4 rounded-xl" style={{ border: "1px solid rgba(245,158,11,0.15)", background: "rgba(245,158,11,0.05)" }}>
            <DollarSign size={20} className="text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-white">Billing Overview</p>
            <p className="text-xs text-white/40 mt-1">Track subscription revenue and commission earnings</p>
          </div>
        </div>
      </div>
    </div>
  );
}
