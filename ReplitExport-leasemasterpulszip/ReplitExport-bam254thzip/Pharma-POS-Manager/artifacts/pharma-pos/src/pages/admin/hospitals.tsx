import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Building2, Users, CheckCircle, XCircle, AlertTriangle, Pencil, MoreHorizontal, Search } from "lucide-react";

interface Hospital {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  planType: string;
  planValue: string;
  status: string;
  createdAt: string;
  userCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  active: { label: "Active", icon: CheckCircle, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  inactive: { label: "Inactive", icon: XCircle, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  suspended: { label: "Suspended", icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export default function HospitalsList() {
  const { token } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/hospitals", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setHospitals)
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const filtered = hospitals.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    (h.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = async (id: number) => {
    if (!confirm("Suspend this hospital account?")) return;
    await fetch(`/api/admin/hospitals/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Hospitals</h1>
          <p className="text-white/45 text-sm mt-1">{hospitals.length} registered {hospitals.length === 1 ? "account" : "accounts"}</p>
        </div>
        <Link href="/admin/hospitals/new">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-black"
            style={{ background: "linear-gradient(90deg,#00e87e,#00c46a)", boxShadow: "0 4px 16px rgba(0,196,106,0.3)" }}>
            <Plus size={15} /> Add Hospital
          </button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search hospitals…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Hospital</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Plan</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Users</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Status</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: j === 0 ? 140 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Building2 size={36} className="text-white/15 mx-auto mb-3" />
                  <p className="text-white/35 text-sm">No hospitals found</p>
                  <Link href="/admin/hospitals/new">
                    <button className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold text-black"
                      style={{ background: "linear-gradient(90deg,#00e87e,#00c46a)" }}>
                      Add your first hospital
                    </button>
                  </Link>
                </td>
              </tr>
            ) : (
              filtered.map((h) => {
                const st = STATUS_CONFIG[h.status] ?? STATUS_CONFIG.inactive;
                const StIcon = st.icon;
                return (
                  <tr key={h.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(0,196,106,0.1)", border: "1px solid rgba(0,196,106,0.2)" }}>
                          <Building2 size={14} className="text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{h.name}</p>
                          <p className="text-xs text-white/40">{h.email ?? h.phone ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-xs font-semibold capitalize text-white/80">{h.planType}</span>
                        <p className="text-xs text-white/40">
                          {h.planType === "subscription" ? `KES ${Number(h.planValue).toLocaleString()}/mo` : `${h.planValue}% commission`}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-white/35" />
                        <span className="text-sm text-white/70">{h.userCount}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit"
                        style={{ background: st.bg }}>
                        <StIcon size={11} style={{ color: st.color }} />
                        <span className="text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-white/40">
                      {new Date(h.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/admin/hospitals/${h.id}/edit`}>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                            <Pencil size={12} />
                          </button>
                        </Link>
                        {h.status !== "suspended" && (
                          <button onClick={() => handleSuspend(h.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 transition-all"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                            <XCircle size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
