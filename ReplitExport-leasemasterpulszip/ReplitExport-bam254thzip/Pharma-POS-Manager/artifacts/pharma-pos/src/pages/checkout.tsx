import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListProducts, useCreateTransaction } from "@workspace/api-client-react";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, User, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MpesaModal } from "@/components/MpesaModal";

interface CartItem {
  product: any;
  quantity: number;
}

interface MpesaPaymentResult {
  status: "completed";
  payerName?: string;
  payerPhone?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Checkout() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mobile_money" | "other">("cash");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaModalOpen, setMpesaModalOpen] = useState(false);
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: products, isLoading: loadingProducts } = useListProducts({ search });
  const createTransaction = useCreateTransaction();

  const handleAddToCart = (product: any) => {
    if (product.stockQty <= 0) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) {
          toast({ title: "Cannot exceed available stock", variant: "destructive" });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item;
          if (newQty > item.product.stockQty) {
            toast({ title: "Cannot exceed available stock", variant: "destructive" });
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return { subtotal, total: subtotal };
  }, [cart]);

  const changeDue = useMemo(() => {
    const paid = parseFloat(paidAmount) || 0;
    return Math.max(0, paid - totals.total);
  }, [paidAmount, totals.total]);

  const doCreateTransaction = (opts?: { referenceCode?: string; paidAmt?: number; custName?: string }) => {
    const paid = opts?.paidAmt ?? (parseFloat(paidAmount) || 0);
    const ref = opts?.referenceCode;
    const name = (opts?.custName ?? customerName) || undefined;

    createTransaction.mutate(
      {
        data: {
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          paymentMethod,
          paidAmount: paymentMethod === "cash" ? paid : totals.total,
          customerName: name,
          referenceCode: ref,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Transaction created successfully" });
          setLocation(`/checkout/confirm/${data.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create transaction", variant: "destructive" });
        },
      }
    );
  };

  const handleProcessPayment = () => {
    if (cart.length === 0) return;

    if (paymentMethod === "mobile_money") {
      const rawPhone = mpesaPhone.trim();
      if (!rawPhone) {
        toast({ title: "Please enter customer phone number for M-PESA", variant: "destructive" });
        return;
      }
      handleInitiateMpesa(rawPhone);
      return;
    }

    const paid = parseFloat(paidAmount) || 0;
    if (paid < totals.total && paymentMethod === "cash") {
      toast({ title: "Paid amount is less than total", variant: "destructive" });
      return;
    }

    doCreateTransaction();
  };

  const handleInitiateMpesa = async (phone: string) => {
    setMpesaLoading(true);
    try {
      const normalised = phone.replace(/^(0|\+?254)/, "254").replace(/\D/g, "");
      const res = await fetch(`${API_BASE}/transactions/mpesa/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised, amount: totals.total, accountRef: "PharmaPOS" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to initiate M-PESA");
      }

      const data = await res.json() as { checkoutRequestId: string };
      setMpesaCheckoutId(data.checkoutRequestId);
      setMpesaModalOpen(true);
    } catch (err: any) {
      toast({ title: err.message || "M-PESA request failed", variant: "destructive" });
    } finally {
      setMpesaLoading(false);
    }
  };

  const handleMpesaConfirm = (result: MpesaPaymentResult) => {
    setMpesaModalOpen(false);
    const custName = result.payerName?.trim() || customerName || undefined;
    doCreateTransaction({
      referenceCode: result.mpesaReceiptNumber,
      paidAmt: result.amount ?? totals.total,
      custName,
    });
  };

  const handleMpesaCancel = () => {
    setMpesaModalOpen(false);
    setMpesaCheckoutId(null);
  };

  const isChargeDisabled =
    cart.length === 0 ||
    createTransaction.isPending ||
    mpesaLoading ||
    (paymentMethod === "cash" && (parseFloat(paidAmount) || 0) < totals.total) ||
    (paymentMethod === "mobile_money" && !mpesaPhone.trim());

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border/60">
        <div className="p-5 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              className="pl-10 h-11 text-sm bg-white rounded-xl border-border/60 focus:ring-2 focus:ring-primary/20"
              placeholder="Search by product name, SKU, or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : products?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-6">
              {products?.map((product) => {
                const inCart = cart.find(i => i.product.id === product.id);
                return (
                  <div
                    key={product.id}
                    className={`product-card p-4 flex flex-col h-full justify-between ${product.stockQty <= 0 ? "opacity-50 cursor-not-allowed" : ""} ${inCart ? "product-card-active" : ""}`}
                    onClick={() => handleAddToCart(product)}
                  >
                    <div>
                      <p className="font-semibold text-sm line-clamp-2 leading-snug">{product.name}</p>
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {product.category}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="font-black text-base text-primary">{formatKES(product.price)}</p>
                      <p className={`text-[11px] font-semibold ${product.stockQty <= product.lowStockThreshold ? "text-red-500" : "text-muted-foreground"}`}>
                        {product.stockQty} left
                      </p>
                    </div>
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-[380px] lg:w-[400px] flex flex-col order-panel">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-base font-black tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Current Order
            {cart.length > 0 && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-15" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Click a product to add it</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex flex-col bg-white p-3 rounded-xl border border-border/60 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-sm pr-4 line-clamp-1">{item.product.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0 rounded-lg"
                    onClick={() => handleRemoveFromCart(item.product.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg border-border/60"
                      onClick={() => handleUpdateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg border-border/60"
                      onClick={() => handleUpdateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-bold text-sm text-primary">
                    {formatKES(item.product.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-white border-t border-border/60 shadow-[0_-4px_16px_-6px_rgba(0,0,0,0.06)] z-10 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9 text-sm rounded-xl border-border/60"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              className={`pay-method-btn ${paymentMethod === "cash" ? "pay-method-btn-active" : ""}`}
              onClick={() => setPaymentMethod("cash")}
            >
              <Banknote className="h-4 w-4" />
              <span>Cash</span>
            </button>
            <button
              className={`pay-method-btn ${paymentMethod === "card" ? "pay-method-btn-active" : ""}`}
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard className="h-4 w-4" />
              <span>Card</span>
            </button>
            <button
              className={`pay-method-btn ${paymentMethod === "mobile_money" ? "pay-method-mpesa-active" : ""}`}
              onClick={() => setPaymentMethod("mobile_money")}
            >
              <span className="font-black text-[13px] leading-none">M</span>
              <span style={{ color: paymentMethod === "mobile_money" ? "#00a651" : undefined }}>M-PESA</span>
            </button>
          </div>

          {paymentMethod === "mobile_money" && (
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
                <span className="text-[9px] font-black text-green-700">M</span>
              </div>
              <Input
                placeholder="+254 7XX XXX XXX"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                className="h-9 text-sm rounded-xl border-green-200 focus:ring-green-300"
              />
            </div>
          )}

          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatKES(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center font-black text-xl border-t border-border/40 pt-2">
              <span>Total</span>
              <span className="text-primary">{formatKES(totals.total)}</span>
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="space-y-2 border-t border-border/40 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Amount Paid</span>
                <Input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-32 text-right font-bold h-9 rounded-xl border-border/60"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Change Due</span>
                <span className={`text-lg font-bold ${changeDue > 0 ? "text-green-600" : "text-foreground"}`}>
                  {formatKES(changeDue)}
                </span>
              </div>
            </div>
          )}

          <button
            className="charge-btn w-full h-13 text-base font-black text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2"
            disabled={isChargeDisabled}
            onClick={handleProcessPayment}
          >
            {createTransaction.isPending || mpesaLoading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {paymentMethod === "mobile_money" ? "Sending M-PESA..." : "Processing..."}
              </>
            ) : paymentMethod === "mobile_money" ? (
              <>
                <span className="font-black">M</span>
                Send M-PESA Request · {formatKES(totals.total)}
              </>
            ) : (
              `Charge ${formatKES(totals.total)}`
            )}
          </button>
        </div>
      </div>

      <MpesaModal
        open={mpesaModalOpen}
        phone={mpesaPhone}
        amount={totals.total}
        checkoutRequestId={mpesaCheckoutId}
        onConfirm={handleMpesaConfirm as any}
        onCancel={handleMpesaCancel}
      />
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
