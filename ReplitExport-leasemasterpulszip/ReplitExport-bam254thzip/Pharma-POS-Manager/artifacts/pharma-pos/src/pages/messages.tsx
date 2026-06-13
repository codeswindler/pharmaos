import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, Plus, RefreshCw, Send, WalletCards } from "lucide-react";

type Campaign = {
  id: number; title: string; content: string; recipientType: string; recipientCount: number; characterCount: number;
  segmentCount: number; estimatedCost: number; actualCost: number; sentCount: number; deliveredCount: number;
  failedCount: number; status: string; sentAt?: string | null; createdAt: string;
};
type Recipient = { id: number; recipientName?: string | null; phone: string; status: string; providerMessageId?: string | null; responseCode?: string | null; responseDescription?: string | null };
type Summary = { balance: number; unitRate: number; availableUnits: number; pendingTopUp: number; pendingUnits: number; salesContacts: number; gatewayEnabled: boolean };
type Quote = {
  recipientCount: number;
  characterCount: number;
  segmentCount: number;
  unitsPerRecipient: number;
  totalUnits: number;
  unitBreakdown: Array<{ unitsPerRecipient: number; recipients: number; totalUnits: number }>;
  unitRate: number;
  amountKes: number;
  walletBalance: number;
  walletShortfall: number;
  pendingTopUp: number;
  pendingUnits: number;
  gatewayEnabled: boolean;
  canSend: boolean;
  unsupported: string[];
};

const GSM_BASIC = new Set([...`@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ`, ...` !"#¤%&'()*+,-./0123456789:;<=>?`, ...`¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà`]);
const GSM_EXTENSION = new Set([...`^{}\\[~]|€`]);
function gsmCount(value: string) {
  let characters = 0;
  const unsupported = new Set<string>();
  for (const char of value) {
    if (GSM_BASIC.has(char)) characters += 1;
    else if (GSM_EXTENSION.has(char)) characters += 2;
    else unsupported.add(char);
  }
  return { characters, segments: characters === 0 ? 0 : characters <= 160 ? 1 : Math.ceil(characters / 153), unsupported: [...unsupported] };
}
const money = (value: number) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const badge = (status: string) => status === "delivered" ? "bg-green-100 text-green-800" : status.includes("fail") ? "bg-red-100 text-red-800" : status === "sent" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";

export default function Messages() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<Summary>({ balance: 0, unitRate: 1, availableUnits: 0, pendingTopUp: 0, pendingUnits: 0, salesContacts: 0, gatewayEnabled: false });
  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", recipientType: "all", dateFrom: "", dateTo: "" });
  const gsm = useMemo(() => gsmCount(form.content), [form.content]);
  const quotedRecipients = quote?.recipientCount ?? 0;
  const quotedUnits = quote?.totalUnits ?? 0;
  const estimatedCost = quote?.amountKes ?? 0;
  const lowBalanceAmount = quote?.walletShortfall ?? 0;
  const requiredTopUpAmount = quote ? Math.max(0, Number((quote.walletShortfall - quote.pendingTopUp).toFixed(2))) : 0;
  const canManage = ["pharmacy_owner", "manager"].includes(user?.role ?? "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };
  const load = async () => {
    const [rows, overview] = await Promise.all([request("/api/messages"), request("/api/messages/summary")]);
    setCampaigns(rows); setSummary(overview);
  };
  useEffect(() => { void load(); }, [token]);

  const loadQuote = async () => {
    const data = await request("/api/messages/quote", {
      method: "POST",
      body: JSON.stringify({ content: form.content, recipientType: form.recipientType, dateFrom: form.dateFrom || null, dateTo: form.dateTo || null }),
    });
    setQuote(data);
    return data as Quote;
  };

  useEffect(() => {
    if (!composeOpen || !form.content.trim() || (form.recipientType === "range" && (!form.dateFrom || !form.dateTo))) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      void loadQuote().catch(() => setQuote(null)).finally(() => setQuoteLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [composeOpen, form.content, form.recipientType, form.dateFrom, form.dateTo, token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await request("/api/messages", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Campaign sent" }); setComposeOpen(false); setQuote(null); setForm({ title: "", content: "", recipientType: "all", dateFrom: "", dateTo: "" }); await load();
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); } finally { setBusy(false); }
  };
  const openDetails = async (campaign: Campaign) => {
    setDetail(campaign); setRecipients(await request(`/api/messages/${campaign.id}/recipients`));
  };
  const refresh = async () => {
    if (!detail) return; setBusy(true);
    try { await request(`/api/messages/${detail.id}/refresh-status`, { method: "POST" }); await load(); await openDetails(detail); toast({ title: "Delivery statuses refreshed" }); }
    catch (error: any) { toast({ title: error.message, variant: "destructive" }); } finally { setBusy(false); }
  };
  const topUp = async () => {
    if (requiredTopUpAmount <= 0) return;
    setBusy(true);
    try {
      const data = await request("/api/messages/wallet/top-up", { method: "POST", body: JSON.stringify({ amount: requiredTopUpAmount }) });
      if (data.summary) setSummary(data.summary);
      else await load();
      if (form.content.trim()) await loadQuote();
      toast({ title: data.message, description: data.requestedUnits ? `${data.requestedUnits.toLocaleString()} SMS units pending admin approval.` : undefined });
    }
    catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return <div className="p-6 lg:p-8 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-black">Messaging</h1><p className="text-sm text-muted-foreground">Reach unique contacts captured from completed M-PESA sales.</p></div>
      {canManage && <Button onClick={() => setComposeOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Compose SMS</Button>}
    </div>

    <div className="border rounded-lg bg-white overflow-auto">
      <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left p-3">Campaign</th><th className="text-left p-3">Audience</th><th className="text-right p-3">Reach</th><th className="text-right p-3">Pages</th><th className="text-right p-3">Cost</th><th className="text-left p-3">Delivery</th><th className="text-left p-3">Sent</th></tr></thead>
        <tbody>{campaigns.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No SMS campaigns yet.</td></tr> : campaigns.map(row => <tr key={row.id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => void openDetails(row)}>
          <td className="p-3"><p className="font-semibold">{row.title}</p><p className="text-xs text-muted-foreground truncate max-w-[300px]">{row.content}</p></td>
          <td className="p-3 capitalize">{row.recipientType.replaceAll("_", " ")}</td><td className="p-3 text-right">{row.recipientCount}</td><td className="p-3 text-right">{row.segmentCount}</td><td className="p-3 text-right">{money(row.actualCost)}</td>
          <td className="p-3"><Badge className={badge(row.status)}>{row.status.replaceAll("_", " ")}</Badge><p className="text-[11px] text-muted-foreground mt-1">{row.deliveredCount} delivered · {row.failedCount} failed</p></td>
          <td className="p-3 text-muted-foreground">{format(new Date(row.sentAt || row.createdAt), "dd MMM yyyy, h:mm a")}</td>
        </tr>)}</tbody></table>
    </div>

    <Dialog open={composeOpen} onOpenChange={setComposeOpen}><DialogContent className="sm:max-w-[640px]"><DialogHeader><DialogTitle>Compose SMS campaign</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <label className="text-sm font-medium">Campaign title<Input className="mt-1" required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="Internal campaign name" /></label>
        <label className="text-sm font-medium">Recipients<select className="mt-1 w-full h-10 rounded-md border bg-background px-3" value={form.recipientType} onChange={e => setForm(v => ({ ...v, recipientType: e.target.value }))}><option value="all">All sales contacts (all time)</option><option value="this_week">Sales contacts who visited this week</option><option value="range">Sales contacts from a date range</option></select></label>
        {form.recipientType === "range" && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">From<Input className="mt-1" required type="date" value={form.dateFrom} onChange={e => setForm(v => ({ ...v, dateFrom: e.target.value }))} /></label><label className="text-sm font-medium">To<Input className="mt-1" required type="date" value={form.dateTo} onChange={e => setForm(v => ({ ...v, dateTo: e.target.value }))} /></label></div>}
        <label className="text-sm font-medium">Message<Textarea className="mt-1 min-h-32" required value={form.content} onChange={e => setForm(v => ({ ...v, content: e.target.value }))} placeholder="Use GSM-7 characters only" /></label>
        <div className={`rounded-lg border p-3 text-sm ${gsm.unsupported.length ? "border-red-200 bg-red-50" : "bg-muted/40"}`}>
          <div className="flex flex-wrap gap-x-5 gap-y-1"><span><b>{gsm.characters}</b> GSM-7 characters</span><span><b>{gsm.segments}</b> SMS page{gsm.segments === 1 ? "" : "s"}</span><span><b>{quotedRecipients}</b> unique recipients</span><span><b>{quotedUnits}</b> billable SMS unit{quotedUnits === 1 ? "" : "s"}</span></div>
          {gsm.unsupported.length > 0 && <p className="text-red-700 mt-2">Unsupported non-GSM characters: {gsm.unsupported.join(" ")}</p>}
          {gsm.characters > 160 && <p className="text-muted-foreground mt-2">Multipart SMS uses 153 GSM-7 character units per page. ^ {'{ }'} [ ] | ~ \ and € count twice.</p>}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send quote</p>
              <h3 className="mt-1 text-lg font-black">
                {quote
                  ? `${quote.recipientCount.toLocaleString()} recipients, ${quote.totalUnits.toLocaleString()} SMS units`
                  : quoteLoading
                    ? "Calculating recipients and SMS units..."
                    : "Write a message to calculate billing"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Like the church system, billing is based on resolved recipients x GSM-7 SMS pages before sending.</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <b>{money(estimatedCost)}</b>
              <span className="block text-xs">at {money(quote?.unitRate ?? summary.unitRate)}/unit</span>
            </div>
          </div>
          {quote && <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-xs uppercase text-muted-foreground">Wallet</span><b className="mt-1 block">{money(quote.walletBalance)}</b></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-xs uppercase text-muted-foreground">After send</span><b className="mt-1 block">{money(quote.walletBalance - quote.amountKes)}</b></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-xs uppercase text-muted-foreground">Unit split</span><b className="mt-1 block">{quote.unitBreakdown.map(item => `${item.recipients} x ${item.unitsPerRecipient}`).join(", ") || "n/a"}</b></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-xs uppercase text-muted-foreground">Gateway</span><b className="mt-1 block">{quote.gatewayEnabled ? "Ready" : "Not enabled"}</b></div>
          </div>}
          {quote?.pendingTopUp ? <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><WalletCards className="h-4 w-4" /> {money(quote.pendingTopUp)} is already pending admin approval ({quote.pendingUnits.toLocaleString()} units).</p> : null}
          {lowBalanceAmount > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            SMS wallet is low by <b>{money(lowBalanceAmount)}</b>.
            {requiredTopUpAmount > 0 ? <Button type="button" variant="outline" size="sm" onClick={topUp} disabled={busy} className="ml-3 gap-2"><CreditCard className="h-4 w-4" /> Request {money(requiredTopUpAmount)} top-up</Button> : <span className="ml-1">A top-up request is already waiting for admin approval.</span>}
          </div>}
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={busy || !quote?.canSend} className="gap-2"><Send className="h-4 w-4" /> Send campaign</Button></div>
      </form>
    </DialogContent></Dialog>

    <Dialog open={Boolean(detail)} onOpenChange={open => !open && setDetail(null)}><DialogContent className="sm:max-w-[820px]"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
      {detail && <div className="space-y-4"><div className="rounded-lg bg-muted/40 p-4"><p className="text-sm">{detail.content}</p><div className="flex gap-4 mt-3 text-xs text-muted-foreground"><span>{detail.characterCount} characters</span><span>{detail.segmentCount} pages</span><span>{money(detail.actualCost)}</span></div></div>
        {canManage && <Button variant="outline" size="sm" onClick={refresh} disabled={busy} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Fetch latest statuses</Button>}
        <div className="max-h-[360px] overflow-auto border rounded-lg"><table className="w-full text-sm"><thead className="bg-muted/50 sticky top-0"><tr><th className="text-left p-3">Recipient</th><th className="text-left p-3">Provider ID</th><th className="text-left p-3">Status</th><th className="text-left p-3">Provider response</th></tr></thead><tbody>{recipients.map(row => <tr key={row.id} className="border-t"><td className="p-3"><b>{row.recipientName || "M-PESA customer"}</b><p className="text-xs text-muted-foreground">{row.phone}</p></td><td className="p-3 font-mono text-xs">{row.providerMessageId || "-"}</td><td className="p-3"><Badge className={badge(row.status)}>{row.status}</Badge></td><td className="p-3 text-xs text-muted-foreground">{row.responseCode ? `${row.responseCode}: ` : ""}{row.responseDescription || "-"}</td></tr>)}</tbody></table></div>
      </div>}
    </DialogContent></Dialog>
  </div>;
}
