import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, RefreshCw, Send, Smartphone, WalletCards } from "lucide-react";

type Campaign = { id: number; title: string; content: string; recipientType: string; recipientCount: number; characterCount: number; segmentCount: number; estimatedCost: number; actualCost: number; sentCount: number; deliveredCount: number; failedCount: number; status: string; sentAt?: string | null; createdAt: string };
type Recipient = { id: number; recipientName?: string | null; phone: string; status: string; providerMessageId?: string | null; responseCode?: string | null; responseDescription?: string | null };
type Summary = { creditBalance: number; unitRate: number; salesContacts: number; gatewayEnabled: boolean; billingMpesaEnabled: boolean };
type Quote = { recipientCount: number; characterCount: number; segmentCount: number; unitsPerRecipient: number; totalUnits: number; unitRate: number; amountKes: number; availableCredit: number; creditApplied: number; amountDue: number; gatewayEnabled: boolean; billingMpesaEnabled: boolean; canPurchase: boolean; unsupported: string[] };

const GSM_BASIC = new Set([...`@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ`, ...` !"#¤%&'()*+,-./0123456789:;<=>?`, ...`¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà`]);
const GSM_EXTENSION = new Set([...`^{}\\[~]|€`]);
function gsmCount(value: string) {
  let characters = 0; const unsupported = new Set<string>();
  for (const char of value) { if (GSM_BASIC.has(char)) characters += 1; else if (GSM_EXTENSION.has(char)) characters += 2; else unsupported.add(char); }
  return { characters, segments: characters === 0 ? 0 : characters <= 160 ? 1 : Math.ceil(characters / 153), unsupported: [...unsupported] };
}
const money = (value: number) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const badge = (status: string) => status === "delivered" || status === "sent" ? "bg-green-100 text-green-800" : status.includes("fail") ? "bg-red-100 text-red-800" : status.includes("payment") ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800";

export default function Messages() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<Summary>({ creditBalance: 0, unitRate: 1, salesContacts: 0, gatewayEnabled: false, billingMpesaEnabled: false });
  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [purchase, setPurchase] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", recipientType: "all", dateFrom: "", dateTo: "", paymentPhone: user?.phone || "" });
  const gsm = useMemo(() => gsmCount(form.content), [form.content]);
  const canManage = ["pharmacy_owner", "manager"].includes(user?.role ?? "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const request = async (path: string, init?: RequestInit) => { const response = await fetch(path, { ...init, headers }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Request failed"); return data; };
  const load = async () => { const [rows, overview] = await Promise.all([request("/api/messages"), request("/api/messages/summary")]); setCampaigns(rows); setSummary(overview); };
  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (!purchase?.purchaseId || ["completed", "payment_failed"].includes(purchase.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const data = await request(`/api/messages/purchases/${purchase.purchaseId}`);
        setPurchase({ ...data.purchase, purchaseId: data.purchase.id });
        if (["completed", "payment_failed"].includes(data.purchase.status)) {
          window.clearInterval(timer); await load();
          toast({ title: data.purchase.status === "completed" ? "Campaign sent" : "SMS payment failed", description: data.purchase.failureReason || undefined, variant: data.purchase.status === "payment_failed" ? "destructive" : undefined });
        }
      } catch {}
    }, 2000);
    return () => window.clearInterval(timer);
  }, [purchase?.purchaseId, purchase?.status]);
  useEffect(() => {
    if (!composeOpen || purchase || !form.content.trim() || (form.recipientType === "range" && (!form.dateFrom || !form.dateTo))) { setQuote(null); return; }
    setQuoteLoading(true);
    const timer = setTimeout(() => void request("/api/messages/quote", { method: "POST", body: JSON.stringify(form) }).then(setQuote).catch(() => setQuote(null)).finally(() => setQuoteLoading(false)), 250);
    return () => clearTimeout(timer);
  }, [composeOpen, purchase, form.content, form.recipientType, form.dateFrom, form.dateTo, token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const data = await request("/api/messages", { method: "POST", body: JSON.stringify(form) }); setPurchase(data); toast({ title: data.message || (data.status === "awaiting_payment" ? "STK Push sent" : "Campaign queued") }); }
    catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const closeCompose = (open: boolean) => {
    setComposeOpen(open);
    if (!open) { setPurchase(null); setQuote(null); setForm({ title: "", content: "", recipientType: "all", dateFrom: "", dateTo: "", paymentPhone: user?.phone || "" }); void load(); }
  };
  const openDetails = async (campaign: Campaign) => { setDetail(campaign); setRecipients(await request(`/api/messages/${campaign.id}/recipients`)); };
  const refresh = async () => { if (!detail) return; setBusy(true); try { await request(`/api/messages/${detail.id}/refresh-status`, { method: "POST" }); await load(); await openDetails(detail); toast({ title: "Delivery statuses refreshed" }); } catch (error: any) { toast({ title: error.message, variant: "destructive" }); } finally { setBusy(false); } };

  return <div className="p-6 lg:p-8 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">Messaging</h1><p className="text-sm text-muted-foreground">Send campaigns to unique contacts captured from completed M-PESA sales.</p></div>{canManage && <Button onClick={() => setComposeOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Compose SMS</Button>}</div>
    <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-lg border bg-white px-3 py-2 flex gap-2 items-center"><WalletCards className="h-4 w-4 text-green-600" /> Reusable credit: <b>{money(summary.creditBalance)}</b></span><span className="rounded-lg border bg-white px-3 py-2">{money(summary.unitRate)} per SMS page</span><span className="rounded-lg border bg-white px-3 py-2">{summary.salesContacts} sales contacts</span></div>
    <div className="border rounded-lg bg-white overflow-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left p-3">Campaign</th><th className="text-left p-3">Audience</th><th className="text-right p-3">Reach</th><th className="text-right p-3">Pages</th><th className="text-right p-3">Cost</th><th className="text-left p-3">Status</th><th className="text-left p-3">Created</th></tr></thead><tbody>{campaigns.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No SMS campaigns yet.</td></tr> : campaigns.map(row => <tr key={row.id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => void openDetails(row)}><td className="p-3"><p className="font-semibold">{row.title}</p><p className="text-xs text-muted-foreground truncate max-w-[300px]">{row.content}</p></td><td className="p-3 capitalize">{row.recipientType.replaceAll("_", " ")}</td><td className="p-3 text-right">{row.recipientCount}</td><td className="p-3 text-right">{row.segmentCount}</td><td className="p-3 text-right">{money(row.actualCost || row.estimatedCost)}</td><td className="p-3"><Badge className={badge(row.status)}>{row.status.replaceAll("_", " ")}</Badge></td><td className="p-3 text-muted-foreground">{format(new Date(row.sentAt || row.createdAt), "dd MMM yyyy, h:mm a")}</td></tr>)}</tbody></table></div>

    <Dialog open={composeOpen} onOpenChange={closeCompose}><DialogContent className="sm:max-w-[680px]"><DialogHeader><DialogTitle>Compose SMS campaign</DialogTitle></DialogHeader>
      {purchase ? <div className="py-8 text-center space-y-4"><div className="mx-auto h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">{purchase.status === "payment_failed" ? <Smartphone className="text-red-600" /> : <Loader2 className="animate-spin text-green-600" />}</div><h3 className="text-xl font-bold capitalize">{String(purchase.status).replaceAll("_", " ")}</h3><p className="text-muted-foreground">{purchase.status === "awaiting_payment" ? "Complete the M-PESA prompt on the selected phone. The campaign sends automatically after confirmation." : purchase.status === "completed" ? "The campaign has finished sending." : purchase.failureReason || "Your campaign is being processed."}</p>{purchase.amountDue !== undefined && <p className="font-semibold">{money(purchase.amountDue)} M-PESA payment</p>}<Button variant="outline" onClick={() => closeCompose(false)}>Close</Button></div> :
      <form onSubmit={submit} className="space-y-4">
        <label className="text-sm font-medium">Campaign title<Input className="mt-1" required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label>
        <label className="text-sm font-medium">Recipients<select className="mt-1 w-full h-10 rounded-md border bg-background px-3" value={form.recipientType} onChange={e => setForm(v => ({ ...v, recipientType: e.target.value }))}><option value="all">All sales contacts (all time)</option><option value="this_week">Sales contacts who visited this week</option><option value="range">Sales contacts from a date range</option></select></label>
        {form.recipientType === "range" && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">From<Input className="mt-1" required type="date" value={form.dateFrom} onChange={e => setForm(v => ({ ...v, dateFrom: e.target.value }))} /></label><label className="text-sm font-medium">To<Input className="mt-1" required type="date" value={form.dateTo} onChange={e => setForm(v => ({ ...v, dateTo: e.target.value }))} /></label></div>}
        <label className="text-sm font-medium">Message<Textarea className="mt-1 min-h-32" required value={form.content} onChange={e => setForm(v => ({ ...v, content: e.target.value }))} /></label>
        <div className={`rounded-lg border p-3 text-sm ${gsm.unsupported.length ? "border-red-200 bg-red-50" : "bg-muted/40"}`}><div className="flex flex-wrap gap-x-5 gap-y-1"><span><b>{gsm.characters}</b> GSM-7 characters</span><span><b>{gsm.segments}</b> page{gsm.segments === 1 ? "" : "s"}</span><span><b>{quote?.recipientCount || 0}</b> recipients</span><span><b>{quote?.totalUnits || 0}</b> billable units</span></div>{gsm.unsupported.length > 0 && <p className="text-red-700 mt-2">Unsupported characters: {gsm.unsupported.join(" ")}</p>}</div>
        <div className="rounded-lg border bg-white p-4 space-y-3"><div className="flex justify-between gap-4"><div><p className="text-xs uppercase text-muted-foreground">Locked send quote</p><h3 className="text-lg font-black">{quoteLoading ? "Calculating..." : money(quote?.amountKes || 0)}</h3></div><div className="text-right text-sm"><p>Credit applied: <b>{money(quote?.creditApplied || 0)}</b></p><p>M-PESA due: <b>{money(quote?.amountDue || 0)}</b></p></div></div>{Boolean(quote?.amountDue) && <label className="text-sm font-medium">M-PESA payment phone<Input className="mt-1" required value={form.paymentPhone} onChange={e => setForm(v => ({ ...v, paymentPhone: e.target.value }))} /></label>}<p className="text-xs text-muted-foreground">Payment confirmation sends the campaign automatically. Failed provider sends return their value to reusable SMS credit.</p></div>
        <div className="flex justify-end"><Button type="submit" disabled={busy || !quote?.canPurchase} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {quote?.amountDue ? `Pay ${money(quote.amountDue)} & send` : "Use credit & send"}</Button></div>
      </form>}
    </DialogContent></Dialog>

    <Dialog open={Boolean(detail)} onOpenChange={open => !open && setDetail(null)}><DialogContent className="sm:max-w-[820px]"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>{detail && <div className="space-y-4"><div className="rounded-lg bg-muted/40 p-4"><p className="text-sm">{detail.content}</p><div className="flex gap-4 mt-3 text-xs text-muted-foreground"><span>{detail.characterCount} characters</span><span>{detail.segmentCount} pages</span><span>{money(detail.actualCost)}</span></div></div>{canManage && <Button variant="outline" size="sm" onClick={refresh} disabled={busy} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Fetch latest statuses</Button>}<div className="max-h-[360px] overflow-auto border rounded-lg"><table className="w-full text-sm"><thead className="bg-muted/50 sticky top-0"><tr><th className="text-left p-3">Recipient</th><th className="text-left p-3">Provider ID</th><th className="text-left p-3">Status</th><th className="text-left p-3">Provider response</th></tr></thead><tbody>{recipients.map(row => <tr key={row.id} className="border-t"><td className="p-3"><b>{row.recipientName || "M-PESA customer"}</b><p className="text-xs text-muted-foreground">{row.phone}</p></td><td className="p-3 font-mono text-xs">{row.providerMessageId || "-"}</td><td className="p-3"><Badge className={badge(row.status)}>{row.status}</Badge></td><td className="p-3 text-xs text-muted-foreground">{row.responseCode ? `${row.responseCode}: ` : ""}{row.responseDescription || "-"}</td></tr>)}</tbody></table></div></div>}</DialogContent></Dialog>
  </div>;
}
