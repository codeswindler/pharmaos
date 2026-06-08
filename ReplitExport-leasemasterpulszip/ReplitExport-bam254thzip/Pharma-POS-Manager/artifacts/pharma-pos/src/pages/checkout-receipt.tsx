import { useParams, useLocation } from "wouter";
import { useGetReceipt, getGetReceiptQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function CheckoutReceipt() {
  const { id } = useParams();
  const transactionId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: receipt, isLoading } = useGetReceipt(transactionId, {
    query: { enabled: !!transactionId, queryKey: getGetReceiptQueryKey(transactionId) }
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-1/2 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Receipt not found</h2>
          <Button className="mt-4" onClick={() => setLocation("/checkout")}>Return to Checkout</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start h-full p-8 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
      <div className="w-full max-w-md print:hidden flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => setLocation("/checkout")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> New Sale
        </Button>
        <div className="flex items-center text-green-600 font-medium">
          <CheckCircle2 className="mr-2 h-5 w-5" /> Payment Successful
        </div>
      </div>

      {/* Receipt Card - This gets printed */}
      <Card className="w-full max-w-md shadow-lg rounded-none border-t-8 border-t-primary print:shadow-none print:border-none print:m-0 print:p-0">
        <CardHeader className="text-center pb-4 border-b border-dashed">
          <CardTitle className="text-2xl font-bold uppercase tracking-widest text-primary">
            {receipt.storeName || "PharmaPOS"}
          </CardTitle>
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <p>{receipt.storeAddress || "123 Health Ave, Medical District"}</p>
            <p>{receipt.storePhone || "+1 (555) 012-3456"}</p>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 pb-2 space-y-6 text-sm">
          <div className="flex justify-between items-start text-xs text-muted-foreground">
            <div>
              <p>Receipt #: {receipt.transactionId.toString().padStart(6, '0')}</p>
              {receipt.referenceCode && <p>Ref: {receipt.referenceCode}</p>}
            </div>
            <div className="text-right">
              <p>{format(new Date(receipt.createdAt), 'MMM dd, yyyy')}</p>
              <p>{format(new Date(receipt.createdAt), 'hh:mm:ss a')}</p>
            </div>
          </div>

          {(receipt.customerName || receipt.cashierName) && (
            <div className="border-b border-dashed pb-4 space-y-1 text-xs">
              {receipt.customerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{receipt.customerName}</span>
                </div>
              )}
              {receipt.cashierName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cashier:</span>
                  <span className="font-medium">{receipt.cashierName}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between font-bold border-b pb-2">
              <span className="flex-1">Item</span>
              <span className="w-12 text-center">Qty</span>
              <span className="w-20 text-right">Price</span>
            </div>
            
            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start py-1">
                <span className="flex-1 pr-2">{item.productName}</span>
                <span className="w-12 text-center text-muted-foreground">{item.quantity}</span>
                <span className="w-20 text-right">KES {item.totalPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed pt-4 space-y-2">
            {(receipt.subtotal && receipt.subtotal !== receipt.totalAmount) ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>KES {receipt.subtotal.toFixed(2)}</span>
              </div>
            ) : null}
            
            {(receipt.discountAmount && receipt.discountAmount > 0) ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-KES {receipt.discountAmount.toFixed(2)}</span>
              </div>
            ) : null}
            
            {(receipt.taxAmount && receipt.taxAmount > 0) ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>KES {receipt.taxAmount.toFixed(2)}</span>
              </div>
            ) : null}

            <div className="flex justify-between items-center font-bold text-lg pt-2 pb-2">
              <span>Total</span>
              <span>KES {receipt.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed pt-4 space-y-1">
            <div className="flex justify-between">
              <span>Paid by {receipt.paymentMethod.replace('_', ' ')}</span>
              <span>KES {receipt.paidAmount.toFixed(2)}</span>
            </div>
            {receipt.changeAmount > 0 && (
              <div className="flex justify-between font-medium">
                <span>Change</span>
                <span>KES {receipt.changeAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex-col items-center justify-center pt-8 pb-6 text-center border-t border-dashed">
          <p className="font-medium text-sm">Thank you for your visit!</p>
          <p className="text-xs text-muted-foreground mt-1">Please keep this receipt for your records.</p>
        </CardFooter>
      </Card>

      <div className="w-full max-w-md mt-6 print:hidden">
        <Button onClick={handlePrint} className="w-full h-12 text-lg">
          <Printer className="mr-2 h-5 w-5" /> Print Receipt
        </Button>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:m-0 {
            margin: 0 !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          Card {
            position: absolute;
            left: 0;
            top: 0;
            visibility: visible;
            width: 100%;
          }
          Card * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
