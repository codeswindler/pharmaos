import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SlidersHorizontal } from "lucide-react";

type Module = { key: string; label: string };
type PharmacyModules = { id: number; name: string; modules: string[]; status: string };

export default function AdminModules() {
  const { token } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyModules[]>([]);
  const [notice, setNotice] = useState("");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = async () => {
    const response = await fetch("/api/admin/modules", { headers });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load modules");
    setModules(payload.modules);
    setPharmacies(payload.pharmacies);
  };

  useEffect(() => { if (token) void load().catch(error => setNotice(error.message)); }, [token]);

  const toggle = async (pharmacy: PharmacyModules, key: string) => {
    const current = new Set(pharmacy.modules);
    current.has(key) ? current.delete(key) : current.add(key);
    const nextModules = [...current];
    setPharmacies(rows => rows.map(row => row.id === pharmacy.id ? { ...row, modules: nextModules } : row));
    const response = await fetch(`/api/admin/pharmacies/${pharmacy.id}/modules`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ modules: nextModules }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "Unable to save module settings");
      await load();
      return;
    }
    setNotice(`Saved modules for ${pharmacy.name}`);
  };

  return <div className="text-white space-y-5">
    <div><h1 className="text-2xl font-bold flex gap-2 items-center"><SlidersHorizontal className="text-green-400" /> Module management</h1><p className="text-sm text-white/45">Choose which operational modules each pharmacy can use.</p></div>
    {notice && <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{notice}</div>}
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-white/45"><tr><th className="p-3 text-left">Pharmacy</th>{modules.map(module => <th key={module.key} className="p-3 text-center">{module.label}</th>)}</tr></thead>
        <tbody>{pharmacies.map(pharmacy => <tr key={pharmacy.id} className="border-t border-white/5"><td className="p-3"><b>{pharmacy.name}</b><p className="text-xs text-white/40 capitalize">{pharmacy.status}</p></td>{modules.map(module => <td key={module.key} className="p-3 text-center"><input type="checkbox" checked={pharmacy.modules.includes(module.key)} onChange={() => toggle(pharmacy, module.key)} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
