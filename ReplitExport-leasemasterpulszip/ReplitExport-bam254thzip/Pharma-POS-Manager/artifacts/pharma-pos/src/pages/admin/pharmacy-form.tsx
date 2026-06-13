import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Building2, CheckCircle2, KeyRound, Loader2, MessageSquare, WalletCards } from "lucide-react";

const initial = {
  name: "", address: "", phone: "", email: "", planType: "subscription", planValue: "0", status: "active",
  ownerName: "", ownerEmail: "", ownerPhone: "", ownerPassword: "",
  environment: "sandbox", shortcode: "", transactionType: "CustomerPayBillOnline", consumerKey: "", consumerSecret: "", passkey: "", enabled: false,
  smsBaseUrl: "", smsApiKey: "", smsPartnerId: "", smsShortcode: "", smsSendEndpointPath: "/api/services/sendsms", smsHashedEndpointPath: "/api/services/sendotp", smsStatusEndpointPath: "/api/services/getdlr", smsUnitRate: "1", smsEnabled: false,
};

export default function PharmacyForm() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/admin/pharmacies/:id/edit");
  const editId = match ? Number(params?.id) : null;
  const [form, setForm] = useState(initial);
  const [masked, setMasked] = useState<any>(null);
  const [maskedSms, setMaskedSms] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCredit, setWalletCredit] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const set = (name: string, value: any) => setForm(current => ({ ...current, [name]: value }));

  useEffect(() => {
    if (!editId) return;
    fetch("/api/admin/pharmacies", { headers }).then(r => r.json()).then(rows => {
      const pharmacy = rows.find((row: any) => row.id === editId);
      if (!pharmacy) return;
      setForm(current => ({ ...current, name: pharmacy.name, address: pharmacy.address || "", phone: pharmacy.phone || "", email: pharmacy.email || "", planType: pharmacy.planType, planValue: pharmacy.planValue, status: pharmacy.status, environment: pharmacy.mpesa?.environment || "sandbox", shortcode: pharmacy.mpesa?.shortcode || "", transactionType: pharmacy.mpesa?.transactionType || "CustomerPayBillOnline", enabled: pharmacy.mpesa?.enabled || false, smsBaseUrl: pharmacy.sms?.baseUrl || "", smsShortcode: pharmacy.sms?.shortcode || "", smsSendEndpointPath: pharmacy.sms?.sendEndpointPath || "/api/services/sendsms", smsHashedEndpointPath: pharmacy.sms?.hashedEndpointPath || "/api/services/sendotp", smsStatusEndpointPath: pharmacy.sms?.statusEndpointPath || "/api/services/getdlr", smsUnitRate: String(pharmacy.sms?.unitRate || 1), smsEnabled: pharmacy.sms?.enabled || false }));
      setMasked(pharmacy.mpesa);
      setMaskedSms(pharmacy.sms);
      setWalletBalance(pharmacy.smsWalletBalance || 0);
    });
  }, [editId, token]);

  const request = async (path: string, init: RequestInit) => {
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const pharmacyBody = { name: form.name, address: form.address, phone: form.phone, email: form.email, planType: form.planType, planValue: form.planValue, status: form.status, ...(!editId && { ownerName: form.ownerName, ownerEmail: form.ownerEmail, ownerPhone: form.ownerPhone, ownerPassword: form.ownerPassword }) };
      const result = await request(editId ? `/api/admin/pharmacies/${editId}` : "/api/admin/pharmacies", { method: editId ? "PUT" : "POST", body: JSON.stringify(pharmacyBody) });
      const pharmacyId = editId || result.pharmacyId;
      if (form.shortcode) await request(`/api/admin/pharmacies/${pharmacyId}/mpesa`, { method: "PUT", body: JSON.stringify({ environment: form.environment, shortcode: form.shortcode, transactionType: form.transactionType, consumerKey: form.consumerKey || undefined, consumerSecret: form.consumerSecret || undefined, passkey: form.passkey || undefined, enabled: form.enabled }) });
      await request(`/api/admin/pharmacies/${pharmacyId}/sms`, { method: "PUT", body: JSON.stringify({ baseUrl: form.smsBaseUrl, apiKey: form.smsApiKey || undefined, partnerId: form.smsPartnerId || undefined, shortcode: form.smsShortcode, sendEndpointPath: form.smsSendEndpointPath, hashedEndpointPath: form.smsHashedEndpointPath, statusEndpointPath: form.smsStatusEndpointPath, unitRate: Number(form.smsUnitRate), enabled: form.smsEnabled }) });
      setMessage("Pharmacy saved");
      setTimeout(() => navigate("/admin/pharmacies"), 700);
    } catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
  };

  const action = async (name: "test" | "register-callbacks") => {
    if (!editId) return; setBusy(true); setMessage("");
    try { await request(`/api/admin/pharmacies/${editId}/mpesa/${name}`, { method: "POST" }); setMessage(name === "test" ? "Credentials verified" : "C2B callbacks registered"); }
    catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
  };

  const creditWallet = async () => {
    if (!editId || Number(walletCredit) <= 0) return;
    setBusy(true); setMessage("");
    try {
      const result = await request(`/api/admin/pharmacies/${editId}/sms-wallet/credit`, { method: "POST", body: JSON.stringify({ amount: Number(walletCredit), reference: "Admin portal credit" }) });
      setWalletBalance(result.balance); setWalletCredit(""); setMessage("SMS wallet credited");
    } catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
  };

  const Field = ({ name, label, type = "text", required = false, placeholder = "" }: any) => <label className="text-xs text-white/60">{label}<input className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 text-white p-2.5" type={type} required={required} placeholder={placeholder} value={(form as any)[name]} onChange={e => set(name, e.target.value)} /></label>;

  return <div className="max-w-3xl text-white"><button onClick={() => navigate("/admin/pharmacies")} className="flex gap-2 text-sm text-white/50 mb-5"><ArrowLeft size={15} /> Back to pharmacies</button><h1 className="text-2xl font-bold flex gap-2 items-center mb-6"><Building2 className="text-green-400" /> {editId ? "Edit pharmacy" : "Onboard pharmacy"}</h1>
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><h2 className="md:col-span-2 font-semibold">Pharmacy details</h2><Field name="name" label="Pharmacy name" required /><Field name="phone" label="Phone" /><Field name="email" label="Email" type="email" /><Field name="address" label="Address" /><Field name="planValue" label="Plan value" type="number" /><label className="text-xs text-white/60">Status<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.status} onChange={e => set("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label></section>
      {!editId && <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><h2 className="md:col-span-2 font-semibold">Pharmacy owner</h2><Field name="ownerName" label="Full name" required /><Field name="ownerPhone" label="Phone" required /><Field name="ownerEmail" label="Email" type="email" required /><Field name="ownerPassword" label="Temporary password" type="password" required /></section>}
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><div className="md:col-span-2"><h2 className="font-semibold flex gap-2"><KeyRound size={16} className="text-green-400" /> M-PESA production or sandbox credentials</h2>{masked && <p className="text-xs text-white/40 mt-1">Stored encrypted: {masked.consumerKey}, {masked.consumerSecret}, passkey {masked.passkey || "not configured"}</p>}</div><Field name="shortcode" label="Paybill / Till shortcode" /><label className="text-xs text-white/60">Environment<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.environment} onChange={e => set("environment", e.target.value)}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label><Field name="consumerKey" label="Consumer key (leave blank to keep current)" type="password" /><Field name="consumerSecret" label="Consumer secret (leave blank to keep current)" type="password" /><Field name="passkey" label="STK passkey (leave blank to keep current)" type="password" /><label className="flex gap-2 items-center mt-5"><input type="checkbox" checked={form.enabled} onChange={e => set("enabled", e.target.checked)} /> Enable M-PESA for this pharmacy</label>{editId && <div className="md:col-span-2 flex gap-2"><button type="button" onClick={() => action("test")} className="border border-white/15 rounded-lg px-3 py-2">Test credentials</button><button type="button" onClick={() => action("register-callbacks")} className="border border-white/15 rounded-lg px-3 py-2">Register C2B callbacks</button></div>}</section>
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4"><div className="md:col-span-2"><h2 className="font-semibold flex gap-2"><MessageSquare size={16} className="text-green-400" /> SMS gateway and pharmacy rate</h2>{maskedSms && <p className="text-xs text-white/40 mt-1">Stored encrypted: API key {maskedSms.apiKey || "not set"}, partner ID {maskedSms.partnerId || "not set"}</p>}</div><Field name="smsBaseUrl" label="Gateway base URL" placeholder="https://sms-provider.example" /><Field name="smsShortcode" label="SMS shortcode" /><Field name="smsApiKey" label="API key (leave blank to keep current)" type="password" /><Field name="smsPartnerId" label="Partner ID (leave blank to keep current)" type="password" /><Field name="smsUnitRate" label="Rate per SMS page (KES)" type="number" /><Field name="smsSendEndpointPath" label="Standard send endpoint path" /><Field name="smsHashedEndpointPath" label="Hashed transactional endpoint path" /><Field name="smsStatusEndpointPath" label="Fallback status endpoint path" /><label className="flex gap-2 items-center mt-5"><input type="checkbox" checked={form.smsEnabled} onChange={e => set("smsEnabled", e.target.checked)} /> Enable SMS for this pharmacy</label>{editId && <div className="md:col-span-2 rounded-lg border border-white/10 p-4 flex flex-wrap gap-3 items-end"><div><p className="text-xs text-white/50 flex gap-2 items-center"><WalletCards size={13} /> Current wallet</p><p className="text-xl font-bold">KES {walletBalance.toLocaleString()}</p></div><label className="text-xs text-white/60 ml-auto">Credit amount<input className="mt-1 w-40 rounded-lg bg-white/5 border border-white/10 text-white p-2.5" type="number" min="1" value={walletCredit} onChange={e => setWalletCredit(e.target.value)} /></label><button type="button" onClick={creditWallet} className="border border-green-400/30 text-green-300 rounded-lg px-3 py-2.5">Credit wallet</button></div>}</section>
      {message && <p className="text-sm text-green-300">{message}</p>}<button disabled={busy} className="bg-green-400 text-black rounded-lg px-5 py-2.5 font-semibold flex gap-2 items-center">{busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save pharmacy</button>
    </form>
  </div>;
}
