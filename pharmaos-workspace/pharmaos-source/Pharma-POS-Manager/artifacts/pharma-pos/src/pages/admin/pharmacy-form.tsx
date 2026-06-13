import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

const initial = {
  name: "", address: "", phone: "", email: "", planType: "subscription", planValue: "0", status: "active",
  ownerName: "", ownerEmail: "", ownerPhone: "", ownerPassword: "",
  environment: "sandbox", shortcode: "", transactionType: "CustomerPayBillOnline",
  consumerKey: "", consumerSecret: "", passkey: "", enabled: false,
};
type FormState = typeof initial;
type FieldName = keyof FormState;

function Field({ form, name, label, onChange, type = "text", required = false, revealed = false }: {
  form: FormState; name: FieldName; label: string; onChange: (name: FieldName, value: string) => void; type?: string; required?: boolean; revealed?: boolean;
}) {
  return <label className="text-xs text-white/60">{label}<input className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 text-white p-2.5" type={type === "password" && revealed ? "text" : type} required={required} value={String(form[name] ?? "")} onChange={event => onChange(name, event.target.value)} /></label>;
}

export default function PharmacyForm() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/admin/pharmacies/:id/edit");
  const editId = match ? Number(params?.id) : null;
  const [form, setForm] = useState(initial);
  const [masked, setMasked] = useState<any>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const set = (name: FieldName, value: string | boolean) => setForm(current => ({ ...current, [name]: value }));
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };
  const load = async () => {
    if (!editId) return;
    const rows = await request("/api/admin/pharmacies");
    const pharmacy = rows.find((row: any) => row.id === editId);
    if (!pharmacy) return;
    setForm(current => ({ ...current, name: pharmacy.name, address: pharmacy.address || "", phone: pharmacy.phone || "", email: pharmacy.email || "", planType: pharmacy.planType, planValue: pharmacy.planValue, status: pharmacy.status, environment: pharmacy.mpesa?.environment || "sandbox", shortcode: pharmacy.mpesa?.shortcode || "", transactionType: pharmacy.mpesa?.transactionType || "CustomerPayBillOnline", enabled: pharmacy.mpesa?.enabled || false }));
    setMasked(pharmacy.mpesa);
  };
  useEffect(() => { void load(); }, [editId, token]);
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => { setRevealed(false); setForm(v => ({ ...v, consumerKey: "", consumerSecret: "", passkey: "" })); }, 60_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);
  const run = async (name: string, task: () => Promise<any>) => {
    setBusy(name); setNotice(null);
    try { const data = await task(); setNotice({ kind: "ok", text: data.message || "Action completed successfully" }); return data; }
    catch (error: any) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(""); }
  };
  const reveal = () => {
    if (revealed) { setRevealed(false); setForm(v => ({ ...v, consumerKey: "", consumerSecret: "", passkey: "" })); return; }
    const password = window.prompt("Confirm your super-admin password to reveal stored credentials");
    if (!password || !editId) return;
    void run("reveal", async () => {
      const secrets = await request(`/api/admin/pharmacies/${editId}/mpesa/reveal`, { method: "POST", body: JSON.stringify({ password }) });
      setForm(v => ({ ...v, ...secrets })); setRevealed(true);
      return { message: "Stored credentials revealed and audit logged" };
    });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run("save", async () => {
      const pharmacyBody = { name: form.name, address: form.address, phone: form.phone, email: form.email, planType: form.planType, planValue: form.planValue, status: form.status, ...(!editId && { ownerName: form.ownerName, ownerEmail: form.ownerEmail, ownerPhone: form.ownerPhone, ownerPassword: form.ownerPassword }) };
      const result = await request(editId ? `/api/admin/pharmacies/${editId}` : "/api/admin/pharmacies", { method: editId ? "PUT" : "POST", body: JSON.stringify(pharmacyBody) });
      const pharmacyId = editId || result.pharmacyId;
      if (form.shortcode) await request(`/api/admin/pharmacies/${pharmacyId}/mpesa`, { method: "PUT", body: JSON.stringify({ environment: form.environment, shortcode: form.shortcode, transactionType: form.transactionType, consumerKey: form.consumerKey || undefined, consumerSecret: form.consumerSecret || undefined, passkey: form.passkey || undefined, enabled: form.enabled }) });
      setTimeout(() => navigate("/admin/pharmacies"), 700);
      return { message: "Pharmacy saved" };
    });
  };
  const action = (name: "test" | "register-callbacks") => {
    if (!editId) return;
    void run(name, () => request(`/api/admin/pharmacies/${editId}/mpesa/${name}`, { method: "POST" }));
  };

  return <div className="max-w-3xl text-white"><button onClick={() => navigate("/admin/pharmacies")} className="flex gap-2 text-sm text-white/50 mb-5"><ArrowLeft size={15} /> Back to pharmacies</button><h1 className="text-2xl font-bold flex gap-2 items-center mb-6"><Building2 className="text-green-400" /> {editId ? "Edit pharmacy" : "Onboard pharmacy"}</h1>
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><h2 className="md:col-span-2 font-semibold">Pharmacy details</h2><Field form={form} onChange={set} name="name" label="Pharmacy name" required /><Field form={form} onChange={set} name="phone" label="Phone" /><Field form={form} onChange={set} name="email" label="Email" type="email" /><Field form={form} onChange={set} name="address" label="Address" /><Field form={form} onChange={set} name="planValue" label="Plan value" type="number" /><label className="text-xs text-white/60">Status<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.status} onChange={e => set("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label></section>
      {!editId && <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><h2 className="md:col-span-2 font-semibold">Pharmacy owner</h2><Field form={form} onChange={set} name="ownerName" label="Full name" required /><Field form={form} onChange={set} name="ownerPhone" label="Phone" required /><Field form={form} onChange={set} name="ownerEmail" label="Email" type="email" required /><Field form={form} onChange={set} name="ownerPassword" label="Temporary password" type="password" required /></section>}
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><div className="md:col-span-2 flex justify-between gap-3"><div><h2 className="font-semibold flex gap-2"><KeyRound size={16} className="text-green-400" /> Pharmacy checkout M-PESA</h2>{masked && <p className="text-xs text-white/40 mt-1">Stored encrypted: {masked.consumerKey}, {masked.consumerSecret}, passkey {masked.passkey || "not configured"}</p>}</div>{editId && <button type="button" onClick={reveal} className="border border-white/15 rounded-lg px-3 py-2 flex gap-2 text-sm">{revealed ? <EyeOff size={15} /> : <Eye size={15} />} {revealed ? "Hide" : "Reveal"}</button>}</div><Field form={form} onChange={set} name="shortcode" label="Paybill / Till shortcode" /><label className="text-xs text-white/60">Environment<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.environment} onChange={e => set("environment", e.target.value)}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label><Field form={form} onChange={set} name="consumerKey" label="Consumer key (leave blank to keep current)" type="password" revealed={revealed} /><Field form={form} onChange={set} name="consumerSecret" label="Consumer secret (leave blank to keep current)" type="password" revealed={revealed} /><Field form={form} onChange={set} name="passkey" label="STK passkey (leave blank to keep current)" type="password" revealed={revealed} /><label className="flex gap-2 items-center mt-5"><input type="checkbox" checked={form.enabled} onChange={e => set("enabled", e.target.checked)} /> Enable checkout M-PESA</label>{editId && <div className="md:col-span-2 flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => action("test")} className="border border-white/15 rounded-lg px-3 py-2">{busy === "test" ? "Testing..." : "Test credentials"}</button><button type="button" disabled={Boolean(busy)} onClick={() => action("register-callbacks")} className="border border-white/15 rounded-lg px-3 py-2">{busy === "register-callbacks" ? "Registering..." : "Register C2B callbacks"}</button></div>}</section>
      {notice && <p className={`rounded-lg border p-3 text-sm ${notice.kind === "ok" ? "border-green-400/30 text-green-300" : "border-red-400/30 text-red-300"}`}>{notice.text}</p>}<button disabled={Boolean(busy)} className="bg-green-400 text-black rounded-lg px-5 py-2.5 font-semibold flex gap-2 items-center">{busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save pharmacy</button>
    </form>
  </div>;
}
