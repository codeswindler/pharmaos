import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Smartphone } from "lucide-react";

type MpesaStatus = "pending" | "completed" | "failed" | "cancelled" | "timeout";

interface MpesaPaymentResult {
  status: MpesaStatus;
  payerName?: string;
  payerPhone?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
}

interface MpesaModalProps {
  open: boolean;
  phone: string;
  amount: number;
  checkoutRequestId: string | null;
  onConfirm: (result: MpesaPaymentResult) => void;
  onCancel: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export function MpesaModal({
  open,
  phone,
  amount,
  checkoutRequestId,
  onConfirm,
  onCancel,
}: MpesaModalProps) {
  const [status, setStatus] = useState<MpesaStatus>("pending");
  const [result, setResult] = useState<MpesaPaymentResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const TIMEOUT_SECONDS = 90;

  useEffect(() => {
    if (!open || !checkoutRequestId) return;
    setStatus("pending");
    setResult(null);
    setElapsed(0);

    let done = false;
    const timer = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= TIMEOUT_SECONDS) {
          clearInterval(timer);
          setStatus("timeout");
          done = true;
        }
        return e + 1;
      });
    }, 1000);

    const poll = async () => {
      if (done) return;
      try {
        const res = await fetch(`${API_BASE}/transactions/mpesa/status/${checkoutRequestId}`);
        if (!res.ok) return;
        const data: MpesaPaymentResult = await res.json();
        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          clearInterval(timer);
          done = true;
          setStatus(data.status);
          setResult(data);
        }
      } catch {
        // keep polling
      }
    };

    const poller = setInterval(poll, 3000);
    poll();

    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [open, checkoutRequestId]);

  const displayPhone = phone.startsWith("254")
    ? `+${phone}`
    : phone.startsWith("0")
    ? `+254${phone.slice(1)}`
    : phone;

  const progressPct = Math.min((elapsed / TIMEOUT_SECONDS) * 100, 100);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <div className="mpesa-modal-card rounded-2xl overflow-hidden">
          <div className="mpesa-header px-6 pt-6 pb-4 text-white text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl font-black tracking-wide text-white">M-</span>
              <span className="text-2xl font-black tracking-wide" style={{ color: "#00c46a" }}>PESA</span>
            </div>
            <p className="text-xs text-white/60 uppercase tracking-widest">Secure Mobile Payment</p>
          </div>

          <div className="mpesa-body px-6 py-6 text-center">
            {status === "pending" && (
              <div className="space-y-4">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-green-500/20" />
                  <div className="absolute inset-0 rounded-full border-t-2 border-green-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Smartphone className="h-6 w-6 text-green-400" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">Waiting for payment</p>
                  <p className="text-white/60 text-sm mt-1">
                    STK Push sent to <span className="text-green-400 font-mono">{displayPhone}</span>
                  </p>
                  <p className="text-white/40 text-xs mt-1">Enter your M-PESA PIN on your phone to pay</p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Amount</p>
                  <p className="text-green-400 font-bold text-2xl">KES {amount.toFixed(2)}</p>
                </div>

                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-green-400 transition-all duration-1000"
                    style={{ width: `${100 - progressPct}%` }}
                  />
                </div>
                <p className="text-white/30 text-xs">
                  Expires in {TIMEOUT_SECONDS - elapsed}s
                </p>

                <Button
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white/80 hover:bg-white/5 text-sm"
                  onClick={onCancel}
                >
                  Cancel Request
                </Button>
              </div>
            )}

            {status === "completed" && result && (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <p className="text-green-400 font-bold text-lg">Payment Received!</p>
                  <p className="text-white/60 text-sm mt-1">
                    {result.payerName && result.payerName.trim()
                      ? result.payerName
                      : result.payerPhone
                      ? `+${result.payerPhone}`
                      : displayPhone}{" "}
                    paid{" "}
                    <span className="text-white font-bold">KES {(result.amount ?? amount).toFixed(2)}</span>
                  </p>
                  {result.mpesaReceiptNumber && (
                    <p className="text-white/30 text-xs mt-1 font-mono">
                      Ref: {result.mpesaReceiptNumber}
                    </p>
                  )}
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm text-white/70">
                  Is this the correct customer? Confirm to complete the transaction.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="border-white/20 text-white/60 hover:bg-white/5 hover:text-white"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-green-500 hover:bg-green-400 text-white font-bold"
                    onClick={() => onConfirm(result)}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            {(status === "failed" || status === "timeout" || status === "cancelled") && (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-bold text-lg">
                    {status === "timeout" ? "Request Timed Out" : status === "cancelled" ? "Payment Cancelled" : "Payment Failed"}
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    {status === "timeout"
                      ? "The payment request expired. Please try again."
                      : "The payment was not completed. Please try again."}
                  </p>
                </div>
                <Button
                  className="w-full bg-white/10 hover:bg-white/20 text-white"
                  onClick={onCancel}
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
