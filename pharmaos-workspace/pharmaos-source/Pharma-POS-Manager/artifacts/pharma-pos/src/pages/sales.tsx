import { Link } from "wouter";
import { useListCheckouts, getListCheckoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, RotateCcw } from "lucide-react";
import { format } from "date-fns";

const money = (value: number) => `KES ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export default function Sales() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sales, isLoading } = useListCheckouts();
  const canVoid = ["pharmacy_owner", "manager"].includes(user?.role ?? "");

  const voidSale = async (id: number) => {
    if (!confirm("Void this sale, restore stock, and mark its payments refund-required?")) return;
    const response = await fetch(`/api/checkouts/${id}/void`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return void toast({ title: data.error || "Could not void sale", variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: getListCheckoutsQueryKey() });
  };

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-black">Sales</h1><p className="text-sm text-muted-foreground mb-6">Open, completed, expired, and voided pharmacy checkouts.</p>
      <div className="border rounded-lg bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Checkout</th><th className="text-left p-3">Created</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Status</th><th className="text-right p-3">Paid</th><th className="text-right p-3">Balance</th><th className="p-3" /></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center">Loading sales...</td></tr> : sales?.map(sale => (
              <tr key={sale.id} className="border-t">
                <td className="p-3 font-semibold">#{String(sale.id).padStart(6, "0")}</td>
                <td className="p-3 text-muted-foreground">{format(new Date(sale.createdAt), "dd MMM yyyy, h:mm a")}</td>
                <td className="p-3">{sale.customerName || "Walk-in"}</td>
                <td className="p-3"><Badge variant={sale.status === "completed" ? "default" : "secondary"} className="capitalize">{sale.status.replace("_", " ")}</Badge></td>
                <td className="p-3 text-right">{money(sale.paidAmount)}</td>
                <td className="p-3 text-right font-bold">{money(sale.balanceAmount)}</td>
                <td className="p-3"><div className="flex justify-end gap-1"><Link href={`/checkout/receipt/${sale.id}`}><Button size="icon" variant="ghost" title="Receipt"><Receipt className="h-4 w-4" /></Button></Link>{canVoid && ["open", "completed"].includes(sale.status) && <Button size="icon" variant="ghost" title="Void sale" onClick={() => voidSale(sale.id)}><RotateCcw className="h-4 w-4 text-destructive" /></Button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
