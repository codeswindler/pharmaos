import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Eye, EyeOff, Loader2, MessageSquare, Save, Smartphone } from "lucide-react";

const initial = {
  baseUrl: "", apiKey: "", partnerId: "", shortcode: "", sendEndpointPath: "/api/services/sendsms",
  hashedEndpointPath: "/api/services/sendotp", statusEndpointPath: "/api/services/getdlr", unitRate: "1", smsEnabled: false,
  mpesaEnvironment: "sandbox", mpesaShortcode: "", mpesaTransactionType: "CustomerPayBillOnline",
  mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "", mpesaEnabled: false,
};
type Form = typeof initial;

function Field({ label, name, form, set, secret = false, revealed = false }: {
  label: string; name: keyof Form; form: Form; set: (name: keyof Form, value: string) => void; secret?: boolean; revealed?: boolean;
}) {
  return <label className="text-xs text-white/60">{label}<input className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 text-white p-2.5" type={secret && !revealed ? "password" : "text"} value={String(form[name])} onChange={e => set(name, e.target.value)} /></label>;
}

export default function AdminSettings() {
  const { token } = useAuth();
  const [form, setForm] = useState(initial);
  const [masked, setMasked] = useState<any>(null);
  const [revealed, setRevealed] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const set = (name: keyof Form, value: string | boolean) => setForm(current => ({ ...current, [name]: value }));
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };
  const load = async () => {
    const data = await request("/api/admin/settings");
    setMasked(data);
    setForm(current => ({ ...current, ...data, apiKey: "", partnerId: "", mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "", unitRate: String(data.unitRate || 1) }));
  };
  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => { setRevealed(false); setForm(v => ({ ...v, apiKey: "", partnerId: "", mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "" })); }, 60_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);
  const run = async (name: string, task: () => Promise<any>) => {
    setBusy(name); setNotice(null);
    try {
      const data = await task();
      setNotice({ kind: "ok", text: data.message || "Action completed successfully" });
      return data;
    }
    catch (error: any) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(""); }
  };
  const reveal = () => {
    if (revealed) { setRevealed(false); setForm(v => ({ ...v, apiKey: "", partnerId: "", mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "" })); return; }
    const password = window.prompt("Confirm your super-admin password to reveal stored credentials");
    if (!password) return;
    void run("reveal", async () => {
      const secrets = await request("/api/admin/settings/reveal", { method: "POST", body: JSON.stringify({ password }) });
      setForm(v => ({ ...v, ...secrets })); setRevealed(true);
      return { message: "Stored credentials revealed and audit logged" };
    });
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    void run("save", async () => {
      const data = await request("/api/admin/settings", { method: "PUT", body: JSON.stringify({ ...form, unitRate: Number(form.unitRate) }) });
      await load();
      return { message: data.message || "Platform settings saved" };
    });
  };

  const settingsPayload = { ...form, unitRate: Number(form.unitRate) };

  return <div className="max-w-4xl text-white">
    <div className="mb-4"><h1 className="text-2xl font-bold">Platform settings</h1><p className="text-sm text-white/45">Configure global SMS delivery, pricing, and the M-PESA account that receives SMS purchases.</p></div>
    {notice && <div role="alert" className={`sticky top-0 z-20 mb-4 rounded-lg border p-3 text-sm shadow-lg backdrop-blur ${notice.kind === "ok" ? "border-green-400/40 bg-green-950/90 text-green-200" : "border-red-400/40 bg-red-950/90 text-red-100"}`}>{notice.text}</div>}
    <form onSubmit={save} className="space-y-5">
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 flex items-start justify-between gap-3"><div><h2 className="font-semibold flex gap-2"><MessageSquare size={16} className="text-green-400" /> Global SMS gateway and billing rate</h2><p className="text-xs text-white/40 mt-1">Stored encrypted: API key {masked?.apiKey || "not set"}, partner ID {masked?.partnerId || "not set"}</p></div><button type="button" onClick={reveal} className="border border-white/15 rounded-lg px-3 py-2 flex gap-2 text-sm">{revealed ? <EyeOff size={15} /> : <Eye size={15} />} {revealed ? "Hide" : "Reveal"}</button></div>
        <Field label="Gateway base URL" name="baseUrl" form={form} set={set} /><Field label="SMS shortcode" name="shortcode" form={form} set={set} />
        <Field label="API key (leave blank to keep current)" name="apiKey" form={form} set={set} secret revealed={revealed} /><Field label="Partner ID (leave blank to keep current)" name="partnerId" form={form} set={set} secret revealed={revealed} />
        <Field label="Rate per SMS page (KES)" name="unitRate" form={form} set={set} /><Field label="Standard send endpoint" name="sendEndpointPath" form={form} set={set} />
        <Field label="Hashed transactional endpoint" name="hashedEndpointPath" form={form} set={set} /><Field label="Fallback status endpoint" name="statusEndpointPath" form={form} set={set} />
        <label className="flex gap-2 items-center"><input type="checkbox" checked={form.smsEnabled} onChange={e => set("smsEnabled", e.target.checked)} /> Enable platform SMS gateway</label>
        <div className="flex gap-2 items-end"><label className="text-xs text-white/60 flex-1">Test phone<input className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 text-white p-2.5" value={testPhone} onChange={e => setTestPhone(e.target.value)} /></label><button type="button" disabled={Boolean(busy)} onClick={() => void run("sms-test", () => request("/api/admin/settings/test-sms", { method: "POST", body: JSON.stringify({ ...settingsPayload, phone: testPhone }) }))} className="border border-white/15 rounded-lg px-3 py-2.5">{busy === "sms-test" ? "Testing..." : "Test SMS"}</button></div>
      </section>
      <section className="rounded-lg border border-white/10 p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><h2 className="font-semibold flex gap-2"><Smartphone size={16} className="text-green-400" /> SMS purchase M-PESA</h2><p className="text-xs text-white/40 mt-1">Stored encrypted: {masked?.mpesaConsumerKey || "key not set"}, {masked?.mpesaConsumerSecret || "secret not set"}, passkey {masked?.mpesaPasskey || "not set"}</p></div>
        <Field label="Paybill / Till shortcode" name="mpesaShortcode" form={form} set={set} /><label className="text-xs text-white/60">Environment<select className="mt-1 w-full rounded-lg bg-[#101820] border border-white/10 p-2.5" value={form.mpesaEnvironment} onChange={e => set("mpesaEnvironment", e.target.value)}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label>
        <Field label="Consumer key (leave blank to keep current)" name="mpesaConsumerKey" form={form} set={set} secret revealed={revealed} /><Field label="Consumer secret (leave blank to keep current)" name="mpesaConsumerSecret" form={form} set={set} secret revealed={revealed} />
        <Field label="STK passkey (leave blank to keep current)" name="mpesaPasskey" form={form} set={set} secret revealed={revealed} /><Field label="Transaction type" name="mpesaTransactionType" form={form} set={set} />
        <label className="flex gap-2 items-center"><input type="checkbox" checked={form.mpesaEnabled} onChange={e => set("mpesaEnabled", e.target.checked)} /> Enable SMS purchase M-PESA</label>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("mpesa-test", () => request("/api/admin/settings/test-mpesa", { method: "POST", body: JSON.stringify(settingsPayload) }))} className="border border-white/15 rounded-lg px-3 py-2.5 justify-self-start">{busy === "mpesa-test" ? "Testing..." : "Test billing credentials"}</button>
      </section>
      <button disabled={Boolean(busy)} className="bg-green-400 text-black rounded-lg px-5 py-2.5 font-semibold flex gap-2 items-center">{busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save settings</button>
    </form>
  </div>;
}
