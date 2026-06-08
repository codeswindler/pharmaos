import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetTransaction, 
  useConfirmPayment, 
  useListRecentTransactions, 
  useRequestValidationCode, 
  useValidateTransactionCode,
  getGetTransactionQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { format } from "date-fns";

export default function CheckoutConfirm() {
  const { id } = useParams();
  const transactionId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"confirm" | "recent" | "validate">("confirm");
  const [validationCode, setValidationCode] = useState("");

  const { data: transaction, isLoading } = useGetTransaction(transactionId, {
    query: { enabled: !!transactionId, queryKey: getGetTransactionQueryKey(transactionId) }
  });

  const { data: recentTransactions } = useListRecentTransactions({
    query: { enabled: step === "recent" }
  });

  const confirmPayment = useConfirmPayment();
  const requestCode = useRequestValidationCode();
  const validateCode = useValidateTransactionCode();

  const handleConfirm = () => {
    confirmPayment.mutate(
      { id: transactionId, data: { confirmed: true } },
      {
        onSuccess: () => {
          toast({ title: "Payment confirmed successfully" });
          setLocation(`/checkout/receipt/${transactionId}`);
        },
        onError: () => {
          toast({ title: "Failed to confirm payment", variant: "destructive" });
        }
      }
    );
  };

  const handleReject = () => {
    setStep("recent");
  };

  const handleRequestCode = () => {
    requestCode.mutate(
      { id: transactionId },
      {
        onSuccess: () => {
          toast({ title: "Validation code requested" });
          setStep("validate");
        },
        onError: () => {
          toast({ title: "Failed to request code", variant: "destructive" });
        }
      }
    );
  };

  const handleValidate = () => {
    validateCode.mutate(
      { id: transactionId, data: { code: validationCode } },
      {
        onSuccess: () => {
          toast({ title: "Transaction validated successfully" });
          setLocation(`/checkout/receipt/${transactionId}`);
        },
        onError: () => {
          toast({ title: "Invalid validation code", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Transaction not found</h2>
          <Button className="mt-4" onClick={() => setLocation("/checkout")}>Return to Checkout</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50">
      {step === "confirm" && (
        <Card className="w-full max-w-lg shadow-xl border-primary/20">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Confirm Payment</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6 pt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Customer</p>
              <h3 className="text-3xl font-bold text-primary">
                {transaction.customerName || "Walk-in Customer"}
              </h3>
            </div>
            
            <div className="bg-muted p-6 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Total Amount Paid</p>
              <p className="text-4xl font-bold">KES {(transaction.paidAmount ?? transaction.totalAmount).toFixed(2)}</p>
            </div>

            <div className="pt-4">
              <h4 className="text-xl font-medium mb-6">Is this you?</h4>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-16 text-lg border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                  onClick={handleReject}
                >
                  <XCircle className="mr-2 h-6 w-6" /> No
                </Button>
                <Button 
                  size="lg" 
                  className="h-16 text-lg text-white"
                  onClick={handleConfirm}
                  disabled={confirmPayment.isPending}
                >
                  <CheckCircle2 className="mr-2 h-6 w-6" /> Yes, that's me
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "recent" && (
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <p className="text-muted-foreground">Please select the correct transaction from the last 60 minutes.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {recentTransactions?.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">KES {Number(tx.totalAmount).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tx.createdAt), 'h:mm a')} • {tx.customerName || 'Walk-in'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => setLocation(`/checkout/confirm/${tx.id}`)}
                  >
                    Select <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {(!recentTransactions || recentTransactions.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No recent transactions found.
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={() => setStep("confirm")}>Back</Button>
            <Button variant="secondary" onClick={handleRequestCode} disabled={requestCode.isPending}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Request Validation Code
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "validate" && (
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle>Validate Transaction</CardTitle>
            <p className="text-muted-foreground">Please enter the validation code provided by the manager.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Input 
              placeholder="Enter validation code" 
              className="text-center text-2xl tracking-widest h-14"
              value={validationCode}
              onChange={(e) => setValidationCode(e.target.value.toUpperCase())}
            />
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={() => setStep("recent")}>Back</Button>
            <Button onClick={handleValidate} disabled={validateCode.isPending || !validationCode}>
              Validate Code
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
