import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Building2, Edit3, MessageSquare, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Pharmacy = { id: number; name: string; email?: string | null; phone?: string | null; address?: string | null; status: string; planType: string; planValue: string };
type Module = { key: string; label: string };
type StaffUser = { id: number; name: string; email: string; phone: string; role: "pharmacy_owner" | "manager" | "cashier"; isActive: boolean };
type Overview = {
  pharmacy: Pharmacy;
  userCount: number;
  modules: string[];
  mpesa?: { enabled: boolean; environment: string; credentialsVerifiedAt?: string | null } | null;
  sms: { smsCredit: number; smsRevenue: number; smsSendCost: number; refundCredit: number; smsCommission: number };
  campaigns: Array<{ id: number; title: string; status: string; recipientCount: number; paidAmount: number; actualCost: number; refundCredit: number; createdAt: string }>;
};
type PermissionEditor = { user: StaffUser; modules: Module[]; enabledModules: string[]; pharmacyModules: string[] };

const emptyUser = { name: "", email: "", phone: "", password: "", role: "cashier" };
const money = (value: number) => `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PharmacyDetail() {
  const { token } = useAuth();
  const [, params] = useRoute("/admin/pharmacies/:id");
  const pharmacyId = Number(params?.id);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(emptyUser);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [permissions, setPermissions] = useState<PermissionEditor | null>(null);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Request failed");
    return payload;
  };

  const load = async () => {
    const [overviewPayload, userRows] = await Promise.all([
      request(`/api/admin/pharmacies/${pharmacyId}/overview`),
      request(`/api/admin/pharmacies/${pharmacyId}/users`),
    ]);
    setOverview(overviewPayload);
    setUsers(userRows);
  };

  useEffect(() => { if (token && pharmacyId) void load().catch(error => setNotice(error.message)); }, [token, pharmacyId]);

  const submitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setNotice("");
    try {
      await request(`/api/admin/pharmacies/${pharmacyId}/users`, { method: "POST", body: JSON.stringify(form) });
      setForm(emptyUser);
      await load();
      setNotice("Pharmacy user created");
    } catch (error: any) {
      setNotice(error.message || "Unable to create pharmacy user");
    } finally {
      setBusy("");
    }
  };

  const patchUser = async (userId: number, data: Record<string, unknown>) => {
    await request(`/api/admin/pharmacies/${pharmacyId}/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) });
    await load();
  };

  const openPermissions = async (user: StaffUser) => {
    try {
      const payload = await request(`/api/admin/pharmacies/${pharmacyId}/users/${user.id}/permissions`);
      setPermissions({ user, modules: payload.modules, enabledModules: payload.enabledModules, pharmacyModules: payload.pharmacyModules });
    } catch (error: any) {
      setNotice(error.message || "Unable to load permissions");
    }
  };

  const savePermissions = async () => {
    if (!permissions) return;
    setBusy("permissions");
    try {
      await request(`/api/admin/pharmacies/${pharmacyId}/users/${permissions.user.id}/permissions`, { method: "PUT", body: JSON.stringify({ modules: permissions.enabledModules }) });
      setNotice(`Saved permissions for ${permissions.user.name}`);
      setPermissions(null);
    } catch (error: any) {
      setNotice(error.message || "Unable to save permissions");
    } finally {
      setBusy("");
    }
  };

  if (!overview) return <div className="text-white/60">Loading pharmacy...</div>;
  const { pharmacy, sms } = overview;

  return <div className="text-white space-y-6">
    <div className="flex justify-between gap-3 items-start">
      <div>
        <Link href="/admin/pharmacies" className="text-sm text-white/50 flex gap-2 items-center mb-3"><ArrowLeft size={15} /> Back to pharmacies</Link>
        <h1 className="text-2xl font-bold flex gap-2 items-center"><Building2 className="text-green-400" /> {pharmacy.name}</h1>
        <p className="text-sm text-white/45">{pharmacy.email || pharmacy.phone || "No contact"} · {pharmacy.status}</p>
      </div>
      <div className="flex gap-2"><Link href={`/admin/pharmacies/${pharmacy.id}/messages`}><button className="rounded-lg border border-white/10 px-3 py-2 flex gap-2 items-center"><MessageSquare size={15} /> SMS audit</button></Link><Link href={`/admin/pharmacies/${pharmacy.id}/edit`}><button className="rounded-lg bg-green-400 text-black px-3 py-2 font-semibold flex gap-2 items-center"><Edit3 size={15} /> Edit</button></Link></div>
    </div>
    {notice && <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{notice}</div>}

    <section className="grid md:grid-cols-4 gap-3">
      <Kpi label="SMS credit" value={money(sms.smsCredit)} />
      <Kpi label="SMS revenue" value={money(sms.smsRevenue)} />
      <Kpi label="Send cost" value={money(sms.smsSendCost)} />
      <Kpi label="Commission" value={money(sms.smsCommission)} tone={sms.smsCommission >= 0 ? "green" : "red"} />
    </section>

    <section className="rounded-lg border border-white/10 p-4 grid md:grid-cols-4 gap-4">
      <Info label="Plan value" value={money(Number(pharmacy.planValue))} />
      <Info label="Staff users" value={String(overview.userCount)} />
      <Info label="M-PESA" value={overview.mpesa?.enabled ? `${overview.mpesa.environment} enabled` : "Not enabled"} />
      <Info label="Enabled modules" value={overview.modules.join(", ") || "None"} />
    </section>

    <section className="rounded-lg border border-white/10 p-4 space-y-3">
      <h2 className="font-semibold flex gap-2 items-center"><Users size={17} className="text-green-400" /> Pharmacy users</h2>
      <form onSubmit={submitUser} className="grid md:grid-cols-6 gap-3 items-end">
        <Field label="Name" value={form.name} set={value => setForm({ ...form, name: value })} />
        <Field label="Phone" value={form.phone} set={value => setForm({ ...form, phone: value })} />
        <Field label="Email" type="email" value={form.email} set={value => setForm({ ...form, email: value })} />
        <label className="text-xs text-white/60">Role<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="pharmacy_owner">Owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option></select></label>
        <Field label="Password" type="password" value={form.password} set={value => setForm({ ...form, password: value })} />
        <button disabled={busy === "create"} className="rounded-lg bg-green-400 text-black px-3 py-2.5 font-semibold flex gap-2 items-center"><UserPlus size={15} /> Add user</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm"><thead className="bg-white/5 text-white/45"><tr><th className="p-3 text-left">User</th><th className="p-3 text-left">Phone</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-t border-white/5"><td className="p-3"><b>{user.name}</b><p className="text-xs text-white/40">{user.email}</p></td><td className="p-3">{user.phone}</td><td className="p-3 capitalize">{user.role.replace("_", " ")}</td><td className="p-3">{user.isActive ? "Active" : "Disabled"}</td><td className="p-3 text-right"><div className="flex justify-end gap-2 whitespace-nowrap"><button onClick={() => void openPermissions(user)} className="rounded border border-green-400/30 px-3 py-1.5 text-green-300 flex gap-1.5 items-center"><ShieldCheck size={14} /> Permissions</button><button onClick={() => void patchUser(user.id, { isActive: !user.isActive })} className="rounded border border-white/10 px-3 py-1.5">{user.isActive ? "Disable" : "Enable"}</button><button onClick={() => { const password = prompt("New temporary password"); if (password) void patchUser(user.id, { password }); }} className="rounded border border-white/10 px-3 py-1.5">Reset password</button></div></td></tr>)}</tbody></table>
      </div>
    </section>

    <section className="rounded-lg border border-white/10 overflow-hidden">
      <div className="p-4 font-semibold">Recent SMS campaigns</div>
      <table className="w-full text-sm"><thead className="bg-white/5 text-white/45"><tr><th className="p-3 text-left">Campaign</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Refund credit</th></tr></thead><tbody>{overview.campaigns.map(campaign => <tr key={campaign.id} className="border-t border-white/5"><td className="p-3">{campaign.title}<p className="text-xs text-white/35">{campaign.recipientCount} recipients</p></td><td className="p-3">{campaign.status}</td><td className="p-3 text-right">{money(campaign.paidAmount)}</td><td className="p-3 text-right">{money(campaign.actualCost)}</td><td className="p-3 text-right">{money(campaign.refundCredit)}</td></tr>)}{overview.campaigns.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-white/45">No SMS campaigns yet.</td></tr>}</tbody></table>
    </section>

    <Dialog open={Boolean(permissions)} onOpenChange={open => !open && setPermissions(null)}>
      <DialogContent className="bg-[#101820] border-white/10 text-white">
        <DialogHeader><DialogTitle>Permissions for {permissions?.user.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-white/50">Access can only be granted to modules enabled for this pharmacy.</p>
        <div className="grid sm:grid-cols-2 gap-2 py-2">{permissions?.modules.map(module => {
          const available = permissions.pharmacyModules.includes(module.key);
          const checked = permissions.enabledModules.includes(module.key);
          return <label key={module.key} className={`rounded-lg border p-3 flex items-center gap-3 ${available ? "border-white/10 bg-white/[0.03]" : "border-white/5 opacity-40"}`}><input type="checkbox" disabled={!available} checked={checked} onChange={() => setPermissions(current => current ? { ...current, enabledModules: checked ? current.enabledModules.filter(key => key !== module.key) : [...current.enabledModules, module.key] } : current)} /><span>{module.label}</span>{!available && <span className="ml-auto text-[10px] uppercase">Pharmacy disabled</span>}</label>;
        })}</div>
        <button disabled={busy === "permissions"} onClick={() => void savePermissions()} className="w-fit rounded-lg bg-green-400 px-4 py-2.5 text-black font-semibold">{busy === "permissions" ? "Saving..." : "Save permissions"}</button>
      </DialogContent>
    </Dialog>
  </div>;
}

function Kpi({ label, value, tone = "white" }: { label: string; value: string; tone?: "white" | "green" | "red" }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase text-white/45 font-semibold">{label}</p><p className={`text-xl font-bold mt-2 ${tone === "green" ? "text-green-300" : tone === "red" ? "text-red-300" : "text-white"}`}>{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase text-white/40 font-semibold">{label}</p><p className="mt-1 text-sm">{value}</p></div>;
}

function Field({ label, value, set, type = "text" }: { label: string; value: string; set: (value: string) => void; type?: string }) {
  return <label className="text-xs text-white/60">{label}<input required className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5 text-white" type={type} value={value} onChange={e => set(e.target.value)} /></label>;
}
