import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Search, UserPlus, Users } from "lucide-react";

type Pharmacy = { id: number; name: string };
type AdminUser = { id: number; name: string; email: string; phone: string; role: string; pharmacyId: number | null; isActive: boolean; pharmacy?: Pharmacy | null };

const emptyForm = { name: "", email: "", phone: "", password: "", role: "cashier", pharmacyId: "" };

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Request failed");
    return payload;
  };

  const load = async () => {
    const [userRows, pharmacyRows] = await Promise.all([request("/api/admin/users"), request("/api/admin/pharmacies")]);
    setUsers(userRows);
    setPharmacies(pharmacyRows);
  };

  useEffect(() => { if (token) void load().catch(error => setNotice(error.message)); }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await request("/api/admin/users", { method: "POST", body: JSON.stringify({ ...form, pharmacyId: form.pharmacyId ? Number(form.pharmacyId) : null }) });
      setForm(emptyForm);
      await load();
      setNotice("User created");
    } catch (error: any) {
      setNotice(error.message || "Unable to create user");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: number, data: Record<string, unknown>) => {
    await request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    await load();
  };

  const filtered = users.filter(user => `${user.name} ${user.email} ${user.phone} ${user.role} ${user.pharmacy?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="text-white space-y-5">
    <div><h1 className="text-2xl font-bold flex gap-2 items-center"><Users className="text-green-400" /> Users</h1><p className="text-sm text-white/45">Create, assign, disable, and reset PharmaOS users.</p></div>
    {notice && <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{notice}</div>}
    <form onSubmit={submit} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 grid md:grid-cols-6 gap-3 items-end">
      <Field label="Name" value={form.name} set={value => setForm({ ...form, name: value })} />
      <Field label="Email" value={form.email} set={value => setForm({ ...form, email: value })} type="email" />
      <Field label="Phone" value={form.phone} set={value => setForm({ ...form, phone: value })} />
      <label className="text-xs text-white/60">Role<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="cashier">Cashier</option><option value="manager">Manager</option><option value="pharmacy_owner">Pharmacy owner</option><option value="super_admin">Super admin</option></select></label>
      <label className="text-xs text-white/60">Pharmacy<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.pharmacyId} onChange={e => setForm({ ...form, pharmacyId: e.target.value })}><option value="">None</option>{pharmacies.map(pharmacy => <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>)}</select></label>
      <Field label="Password" value={form.password} set={value => setForm({ ...form, password: value })} type="password" />
      <button disabled={busy} className="md:col-span-6 w-fit rounded-lg bg-green-400 px-4 py-2.5 text-black font-semibold flex gap-2 items-center"><UserPlus size={15} /> {busy ? "Creating..." : "Add user"}</button>
    </form>
    <div className="relative"><Search className="absolute left-3 top-3 text-white/30" size={15} /><input className="w-full rounded-lg bg-white/5 border border-white/10 text-white pl-9 p-2.5" placeholder="Search users" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="rounded-lg border border-white/10 overflow-hidden"><table className="w-full text-sm"><thead className="bg-white/5 text-white/45"><tr><th className="p-3 text-left">User</th><th className="p-3 text-left">Phone</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Pharmacy</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead><tbody>{filtered.map(user => <tr key={user.id} className="border-t border-white/5"><td className="p-3"><b>{user.name}</b><p className="text-xs text-white/40">{user.email}</p></td><td className="p-3">{user.phone}</td><td className="p-3 capitalize">{user.role.replace("_", " ")}</td><td className="p-3">{user.pharmacy?.name ?? "-"}</td><td className="p-3">{user.isActive ? "Active" : "Disabled"}</td><td className="p-3 text-right flex justify-end gap-2"><button onClick={() => patch(user.id, { isActive: !user.isActive })} className="rounded border border-white/10 px-3 py-1.5">{user.isActive ? "Disable" : "Enable"}</button><button onClick={() => { const password = prompt("New temporary password"); if (password) void patch(user.id, { password }); }} className="rounded border border-white/10 px-3 py-1.5">Reset password</button></td></tr>)}</tbody></table></div>
  </div>;
}

function Field({ label, value, set, type = "text" }: { label: string; value: string; set: (value: string) => void; type?: string }) {
  return <label className="text-xs text-white/60">{label}<input required className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5 text-white" type={type} value={value} onChange={e => set(e.target.value)} /></label>;
}
