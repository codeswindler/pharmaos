import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare } from "lucide-react";

export default function SmsAudit() {
  const { token } = useAuth();
  const [, params] = useRoute("/admin/pharmacies/:id/messages");
  const pharmacyId = Number(params?.id);
  const [messages, setMessages] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const headers = { Authorization: `Bearer ${token}` };
  useEffect(() => { fetch(`/api/admin/pharmacies/${pharmacyId}/messages`, { headers }).then(r => r.json()).then(setMessages); }, [pharmacyId, token]);
  const open = async (message: any) => { setSelected(message); setRecipients(await fetch(`/api/admin/messages/${message.id}/recipients`, { headers }).then(r => r.json())); };
  return <div className="text-white"><div className="mb-6"><h1 className="text-2xl font-bold flex gap-2 items-center"><MessageSquare className="text-green-400" /> Pharmacy SMS audit</h1><p className="text-sm text-white/45">Campaign content, spend, and per-recipient delivery status.</p></div>
    <div className="rounded-lg border border-white/10 overflow-auto"><table className="w-full text-sm"><thead className="bg-white/5 text-white/45"><tr><th className="text-left p-4">Campaign</th><th className="text-right p-4">Recipients</th><th className="text-right p-4">Spend</th><th className="text-left p-4">Status</th></tr></thead><tbody>{messages.map(row => <tr key={row.id} onClick={() => void open(row)} className="border-t border-white/5 cursor-pointer hover:bg-white/5"><td className="p-4"><b>{row.title}</b><p className="text-xs text-white/40 truncate max-w-lg">{row.content}</p></td><td className="p-4 text-right">{row.recipientCount}</td><td className="p-4 text-right">KES {Number(row.actualCost).toLocaleString()}</td><td className="p-4"><Badge>{row.status}</Badge></td></tr>)}</tbody></table></div>
    <Dialog open={Boolean(selected)} onOpenChange={value => !value && setSelected(null)}><DialogContent className="sm:max-w-[820px]"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle></DialogHeader><p className="text-sm">{selected?.content}</p><div className="max-h-[400px] overflow-auto border rounded"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left p-3">Recipient</th><th className="text-left p-3">Provider ID</th><th className="text-left p-3">Status</th><th className="text-left p-3">Response</th></tr></thead><tbody>{recipients.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.recipientName || row.phone}<p className="text-xs text-muted-foreground">{row.phone}</p></td><td className="p-3 font-mono text-xs">{row.providerMessageId || "-"}</td><td className="p-3">{row.status}</td><td className="p-3 text-xs">{row.responseCode || "-"} {row.responseDescription}</td></tr>)}</tbody></table></div></DialogContent></Dialog>
  </div>;
}
