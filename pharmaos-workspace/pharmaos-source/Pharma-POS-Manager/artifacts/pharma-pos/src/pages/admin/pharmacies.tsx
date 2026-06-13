import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, MessageSquare, Pencil, Plus, Search, ShieldCheck, Users, XCircle } from "lucide-react";

type Pharmacy = { id: number; name: string; email?: string | null; phone?: string | null; status: string; planType: string; planValue: string; userCount: number; smsWalletBalance: number; mpesa?: { enabled: boolean; environment: string; credentialsVerifiedAt?: string | null } | null };

export default function PharmaciesList() {
  const { token } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pharmacies", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to load pharmacies");
      if (!Array.isArray(payload)) throw new Error("Unexpected pharmacy response from server");
      setPharmacies(payload);
    } catch (err: any) {
      setPharmacies([]);
      setError(err.message || "Unable to load pharmacies");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [token]);
  const filtered = pharmacies.filter(p => `${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(search.toLowerCase()));

  const suspend = async (id: number) => {
    if (!confirm("Suspend this pharmacy account?")) return;
    await fetch(`/api/admin/pharmacies/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  return <div>
    <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-bold text-white">Pharmacies</h1><p className="text-white/45 text-sm">{pharmacies.length} retail pharmacy accounts</p></div><Link href="/admin/pharmacies/new"><button className="bg-green-400 text-black font-semibold rounded-lg px-4 py-2 flex gap-2 items-center"><Plus size={15} /> Add pharmacy</button></Link></div>
    {error && <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
    <div className="relative mb-4"><Search className="absolute left-3 top-3 text-white/30" size={15} /><input className="w-full rounded-lg bg-white/5 border border-white/10 text-white pl-9 p-2.5" placeholder="Search pharmacies" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="rounded-lg border border-white/10 overflow-hidden"><table className="w-full text-sm text-white"><thead className="bg-white/5 text-white/40"><tr><th className="text-left p-4">Pharmacy</th><th className="text-left p-4">Staff</th><th className="text-left p-4">M-PESA</th><th className="text-left p-4">SMS credit</th><th className="text-left p-4">Status</th><th className="p-4" /></tr></thead><tbody>{filtered.map(p => <tr key={p.id} className="border-t border-white/5"><td className="p-4"><div className="flex gap-3 items-center"><Building2 size={16} className="text-green-400" /><div><b>{p.name}</b><p className="text-xs text-white/40">{p.email || p.phone || "No contact"}</p></div></div></td><td className="p-4"><span className="flex gap-1 items-center"><Users size={13} />{p.userCount}</span></td><td className="p-4"><span className="flex gap-1 items-center"><ShieldCheck size={13} className={p.mpesa?.enabled ? "text-green-400" : "text-white/30"} />{p.mpesa?.enabled ? `${p.mpesa.environment} enabled` : "Not enabled"}</span></td><td className="p-4">KES {Number(p.smsWalletBalance || 0).toLocaleString()}</td><td className="p-4 capitalize">{p.status}</td><td className="p-4"><div className="flex justify-end gap-2"><Link href={`/admin/pharmacies/${p.id}/messages`}><button title="SMS audit" className="p-2 border border-white/10 rounded"><MessageSquare size={13} /></button></Link><Link href={`/admin/pharmacies/${p.id}/edit`}><button className="p-2 border border-white/10 rounded"><Pencil size={13} /></button></Link>{p.status !== "suspended" && <button onClick={() => suspend(p.id)} className="p-2 border border-white/10 rounded text-red-400"><XCircle size={13} /></button>}</div></td></tr>)}{!loading && !error && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/45">{search ? "No pharmacies match your search." : "No pharmacies have been onboarded yet."}</td></tr>}{loading && <tr><td colSpan={6} className="p-8 text-center text-white/45">Loading pharmacies...</td></tr>}</tbody></table></div>
  </div>;
}
