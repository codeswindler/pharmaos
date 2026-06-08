import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, ArrowLeft, Loader2, CheckCircle2, User, Lock, DollarSign, Percent } from "lucide-react";

type PlanType = "subscription" | "commission";

export default function HospitalForm() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [matchEdit, paramsEdit] = useRoute("/admin/hospitals/:id/edit");
  const editId = matchEdit ? Number(paramsEdit?.id) : null;

  const [form, setForm] = useState({
    name: "", address: "", phone: "", email: "", licenseNumber: "",
    planType: "subscription" as PlanType, planValue: "",
    adminName: "", adminEmail: "", adminPassword: "", status: "active",
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!editId);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/admin/hospitals`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((hospitals: any[]) => {
        const h = hospitals.find(x => x.id === editId);
        if (h) setForm(f => ({ ...f, name: h.name, address: h.address ?? "", phone: h.phone ?? "", email: h.email ?? "", licenseNumber: h.licenseNumber ?? "", planType: h.planType, planValue: h.planValue, status: h.status }));
      })
      .finally(() => setLoadingData(false));
  }, [editId, token]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = editId ? `/api/admin/hospitals/${editId}` : "/api/admin/hospitals";
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { name: form.name, address: form.address, phone: form.phone, email: form.email, licenseNumber: form.licenseNumber, planType: form.planType, planValue: form.planValue, status: form.status }
        : form;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || "Failed"); }
      setSuccess(true);
      setTimeout(() => navigate("/admin/hospitals"), 1200);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) => (
    <div>
      <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">{label}{required && " *"}</label>
      <input
        type={type}
        value={(form as any)[name]}
        onChange={e => set(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,196,106,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,196,106,0.07)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );

  if (loadingData) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-green-400" /></div>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/admin/hospitals")}
        className="flex items-center gap-2 text-sm text-white/45 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to Hospitals
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,196,106,0.12)", border: "1px solid rgba(0,196,106,0.2)" }}>
          <Building2 size={18} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{editId ? "Edit Hospital" : "Onboard New Hospital"}</h1>
          <p className="text-sm text-white/40">{editId ? "Update hospital details and plan" : "Create a hospital account and assign a plan"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hospital details */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><Building2 size={14} className="text-green-400" /> Hospital Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="Hospital / Pharmacy Name" name="name" placeholder="Nairobi General Pharmacy" required /></div>
            <Field label="Phone" name="phone" placeholder="+254 712 345 678" />
            <Field label="Email" name="email" type="email" placeholder="admin@hospital.co.ke" />
            <Field label="License Number" name="licenseNumber" placeholder="PPB/2024/0001" />
            <Field label="Address" name="address" placeholder="123 Health Ave, Nairobi" />
          </div>
        </div>

        {/* Plan */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><DollarSign size={14} className="text-amber-400" /> Billing Plan</h3>
          <div className="grid grid-cols-2 gap-3">
            {(["subscription", "commission"] as PlanType[]).map(t => (
              <button key={t} type="button" onClick={() => set("planType", t)}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  border: form.planType === t ? "1px solid rgba(0,196,106,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  background: form.planType === t ? "rgba(0,196,106,0.08)" : "rgba(255,255,255,0.02)",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  {t === "subscription" ? <DollarSign size={14} className="text-green-400" /> : <Percent size={14} className="text-amber-400" />}
                  <span className="text-sm font-semibold text-white capitalize">{t}</span>
                </div>
                <p className="text-xs text-white/40">{t === "subscription" ? "Fixed monthly fee billed to the hospital" : "Percentage of each transaction as commission"}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">
              {form.planType === "subscription" ? "Monthly Amount (KES)" : "Commission Rate (%)"}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 text-sm">{form.planType === "subscription" ? "KES" : "%"}</span>
              <input
                type="number"
                min="0"
                step={form.planType === "subscription" ? "100" : "0.1"}
                value={form.planValue}
                onChange={e => set("planValue", e.target.value)}
                placeholder={form.planType === "subscription" ? "5000" : "2.5"}
                required
                className="w-full pl-12 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,196,106,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,196,106,0.07)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>
          {editId && (
            <div>
              <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">Account Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}
        </div>

        {/* Admin account (create only) */}
        {!editId && (
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><User size={14} className="text-blue-400" /> Hospital Admin Account</h3>
            <p className="text-xs text-white/35">This user will be the primary account for this hospital</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" name="adminName" placeholder="John Kamau" required />
              <Field label="Email" name="adminEmail" type="email" placeholder="john@hospital.co.ke" required />
              <div className="col-span-2">
                <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">Password *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={e => set("adminPassword", e.target.value)}
                    placeholder="Secure password (min 8 chars)"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,196,106,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,196,106,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate("/admin/hospitals")}
            className="px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            Cancel
          </button>
          <button type="submit" disabled={loading || success}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-black transition-all"
            style={{ background: success ? "rgba(0,196,106,0.6)" : "linear-gradient(90deg,#00e87e,#00c46a)", boxShadow: "0 4px 16px rgba(0,196,106,0.25)" }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : success ? <CheckCircle2 size={15} /> : null}
            {loading ? "Saving…" : success ? "Saved!" : editId ? "Save Changes" : "Create Hospital"}
          </button>
        </div>
      </form>
    </div>
  );
}
