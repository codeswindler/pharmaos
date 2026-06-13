import { useParams, useLocation } from "wouter";
import { useGetCheckoutReceipt, getGetCheckoutReceiptQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";

const money = (value: number) => `KES ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export default function CheckoutReceipt() {
  const { id } = useParams();
  const checkoutId = Number(id);
  const [, navigate] = useLocation();
  const { data: receipt, isLoading } = useGetCheckoutReceipt(checkoutId, {
    query: { enabled: checkoutId > 0, queryKey: getGetCheckoutReceiptQueryKey(checkoutId) },
  });

  if (isLoading) return <div className="p-8">Loading receipt...</div>;
  if (!receipt) return <div className="p-8">Receipt not found.</div>;

  return (
    <div className="min-h-full bg-muted/30 p-6 overflow-auto">
      <div className="max-w-md mx-auto flex justify-between mb-4 print:hidden">
        <Button variant="outline" onClick={() => navigate("/checkout")}><ArrowLeft className="h-4 w-4 mr-2" /> New sale</Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
      </div>
      <article className="receipt max-w-md mx-auto bg-white border p-7 text-sm">
        <header className="text-center border-b border-dashed pb-5">
          <h1 className="text-xl font-black">{receipt.pharmacy.name}</h1>
          <p>{receipt.pharmacy.address}</p><p>{receipt.pharmacy.phone}</p>
        </header>
        <div className="py-4 border-b border-dashed text-xs flex justify-between">
          <div><p>Receipt #{String(receipt.id).padStart(6, "0")}</p><p>Cashier: {receipt.cashierName}</p>{receipt.customerName && <p>Customer: {receipt.customerName}</p>}</div>
          <div className="text-right"><p>{format(new Date(receipt.createdAt), "dd MMM yyyy")}</p><p>{format(new Date(receipt.createdAt), "h:mm a")}</p></div>
        </div>
        <div className="py-4 space-y-3 border-b border-dashed">
          {receipt.items.map(item => <div key={item.productId} className="flex justify-between"><span>{item.productName}<small className="block text-muted-foreground">{item.quantity} x {money(item.unitPrice)}</small></span><b>{money(item.totalPrice)}</b></div>)}
        </div>
        <div className="py-4 space-y-2 border-b border-dashed">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.subtotal)}</span></div>
          {receipt.discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(receipt.discountAmount)}</span></div>}
          <div className="flex justify-between text-lg font-black"><span>Total</span><span>{money(receipt.totalAmount)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{money(receipt.paidAmount)}</span></div>
          <div className="flex justify-between"><span>Balance</span><span>{money(receipt.balanceAmount)}</span></div>
          {receipt.changeAmount > 0 && <div className="flex justify-between"><span>Change</span><span>{money(receipt.changeAmount)}</span></div>}
        </div>
        <div className="py-4 space-y-2">
          <p className="font-bold">Payments</p>
          {receipt.payments.map(payment => <div key={payment.id} className="flex justify-between"><span className="capitalize">{payment.method}{payment.referenceCode ? ` (${payment.referenceCode})` : ""}</span><span>{money(payment.amount)}</span></div>)}
        </div>
        <footer className="text-center pt-4 border-t border-dashed">Thank you for shopping with us.</footer>
      </article>
      <style>{`@media print { body * { visibility: hidden; } .receipt, .receipt * { visibility: visible; } .receipt { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; } }`}</style>
    </div>
  );
}
