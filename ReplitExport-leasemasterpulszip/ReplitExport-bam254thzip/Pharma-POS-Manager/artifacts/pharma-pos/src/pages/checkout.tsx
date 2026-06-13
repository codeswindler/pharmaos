import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Minus, Package, Plus, RefreshCw, Search, ShoppingCart, Trash2, X } from "lucide-react";

type CartItem = { product: any; quantity: number };
type Payment = {
  id: number;
  method: "cash" | "mpesa";
  amount: number;
  appliedAmount: number;
  changeAmount: number;
  status: string;
  referenceCode?: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  receivedAt: string;
};
type CheckoutData = {
  id: number;
  customerName?: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  changeAmount: number;
  status: string;
  expiresAt: string;
  payments: Payment[];
};
type PaymentMode = "chooser" | "mpesa" | "stk" | "cash";

const MPESA_LOGO = "/payment-assets/mpesa-logo.png";
const CASH_LOGO = "/payment-assets/cash-payment-clean.png";
const money = (value: number) => `KES ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export default function Checkout() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [mpesaAmount, setMpesaAmount] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [unmatched, setUnmatched] = useState<Payment[]>([]);
  const [suggested, setSuggested] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("chooser");
  const { data: products, isLoading } = useListProducts({ search });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0), [cart]);
  const remainingBalance = checkout?.balanceAmount ?? total;

  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const refreshCheckout = async (returnToChooser = false) => {
    if (!checkout) return null;
    const fresh = await api(`/checkouts/${checkout.id}`);
    setCheckout(fresh);
    if (fresh.status === "completed") {
      setPaymentModalOpen(false);
      navigate(`/checkout/receipt/${fresh.id}`);
      return fresh;
    }
    setMpesaAmount(String(fresh.balanceAmount));
    if (returnToChooser) {
      setPaymentMode("chooser");
      setPaymentModalOpen(true);
    }
    return fresh;
  };

  const loadUnmatched = async (showSuggestion = false, checkoutId = checkout?.id) => {
    if (!checkoutId) return;
    const rows = await api(`/payments/unmatched?checkoutId=${checkoutId}`);
    setUnmatched(rows);
    if (showSuggestion && rows[0]) setSuggested(rows[0]);
  };

  const findPayments = async (showSuggestion = false) => {
    try {
      await loadUnmatched(showSuggestion);
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!checkout || checkout.status !== "open" || !token) return;
    const events = new EventSource(`/api/payments/events?token=${encodeURIComponent(token)}`);
    events.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "payment_received") void findPayments(true);
    };
    return () => events.close();
  }, [checkout?.id, token]);

  const add = (product: any) => {
    if (checkout || product.stockQty <= 0) return;
    setCart(items => {
      const current = items.find(item => item.product.id === product.id);
      if (current && current.quantity >= product.stockQty) return items;
      return current
        ? items.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { product, quantity: 1 }];
    });
  };

  const changeQty = (productId: number, delta: number) => setCart(items => items
    .map(item => item.product.id === productId ? { ...item, quantity: Math.min(item.product.stockQty, item.quantity + delta) } : item)
    .filter(item => item.quantity > 0));

  const openCheckout = async () => {
    setBusy(true);
    try {
      const created = await api("/checkouts", {
        method: "POST",
        body: JSON.stringify({ customerName: customerName || undefined, items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })) }),
      });
      setCheckout(created);
      setMpesaAmount(String(created.balanceAmount));
      setPaymentMode("chooser");
      setPaymentModalOpen(true);
      toast({ title: "Checkout reserved", description: "Stock is reserved for 15 minutes. Choose a payment option." });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const openPaymentMode = async (mode: PaymentMode) => {
    if (!checkout) return;
    setPaymentMode(mode);
    setPaymentModalOpen(true);
    if (mode === "cash") setCashAmount("");
    if (mode === "stk") setMpesaAmount(String(checkout.balanceAmount));
    if (mode === "mpesa") await findPayments();
  };

  const addCash = async () => {
    if (!checkout) return;
    setBusy(true);
    try {
      await api("/payments/cash", { method: "POST", body: JSON.stringify({ checkoutId: checkout.id, amount: Number(cashAmount) }) });
      setCashAmount("");
      await refreshCheckout(true);
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const initiateMpesa = async () => {
    if (!checkout) return;
    setBusy(true);
    try {
      await api("/payments/mpesa/initiate", { method: "POST", body: JSON.stringify({ checkoutId: checkout.id, phone: mpesaPhone, amount: Number(mpesaAmount) }) });
      toast({ title: "STK Push sent", description: "Waiting for the customer's M-PESA payment." });
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const attachMpesa = async (payment: Payment) => {
    if (!checkout) return;
    setBusy(true);
    try {
      await api(`/payments/${payment.id}/attach`, { method: "POST", body: JSON.stringify({ checkoutId: checkout.id }) });
      setSuggested(null);
      await refreshCheckout(true);
      await loadUnmatched();
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const cancelCheckout = async () => {
    if (!checkout) return;
    try {
      await api(`/checkouts/${checkout.id}/cancel`, { method: "POST" });
      setCheckout(null);
      setCart([]);
      setCustomerName("");
      setUnmatched([]);
      setPaymentModalOpen(false);
      setPaymentMode("chooser");
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
  };

  const PaymentCard = ({
    mode,
    title,
    description,
    image,
    badge,
  }: {
    mode: PaymentMode;
    title: string;
    description: string;
    image: string;
    badge?: string;
  }) => {
    const isMpesa = image === MPESA_LOGO;
    const isCash = image === CASH_LOGO;

    return (
      <button
        type="button"
        onClick={() => void openPaymentMode(mode)}
        className="group rounded-xl border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <div className={`relative mb-3 flex h-28 items-center justify-center rounded-lg ${isMpesa ? "overflow-hidden bg-black" : "overflow-visible bg-transparent"}`}>
          <img
            src={image}
            alt={`${title} logo`}
            className={isCash ? "h-full w-full scale-110 object-contain p-0" : "max-h-full max-w-full object-contain p-3"}
          />
          {badge && <span className="absolute right-2 top-2 rounded-full bg-green-500 px-2.5 py-1 text-[11px] font-black tracking-wide text-white shadow">{badge}</span>}
        </div>
        <p className="text-base font-black">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </button>
    );
  };

  return (
    <div className="grid h-full overflow-hidden lg:grid-cols-[1fr_430px]">
      <section className="flex flex-col overflow-hidden border-r">
        <div className="border-b bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search product, SKU, or barcode" value={search} onChange={e => setSearch(e.target.value)} disabled={!!checkout} />
          </div>
        </div>
        <div className="grid content-start gap-3 overflow-auto p-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {isLoading ? <p className="text-muted-foreground">Loading products...</p> : products?.map(product => (
            <button key={product.id} onClick={() => add(product)} disabled={!!checkout || product.stockQty <= 0} className="relative rounded-lg border bg-white p-3 text-left hover:border-primary disabled:opacity-50">
              <p className="text-sm font-semibold">{product.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{product.sku}</p>
              <div className="mt-4 flex justify-between">
                <strong className="text-primary">{money(product.price)}</strong>
                <span className="text-xs">{product.stockQty} left</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex flex-col overflow-hidden bg-muted/20">
        <div className="flex items-center gap-2 border-b bg-white p-4">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="font-black">{checkout ? `Checkout #${checkout.id}` : "Current basket"}</h2>
          {checkout && <Badge className="ml-auto capitalize">{checkout.status}</Badge>}
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {cart.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Package className="mx-auto mb-2 h-10 w-10 opacity-30" />Add products to begin</div> : cart.map(item => (
            <div key={item.product.id} className="rounded-lg border bg-white p-3">
              <div className="flex justify-between">
                <p className="text-sm font-semibold">{item.product.name}</p>
                {!checkout && <button onClick={() => setCart(items => items.filter(x => x.product.id !== item.product.id))}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={!!checkout} onClick={() => changeQty(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <b>{item.quantity}</b>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={!!checkout} onClick={() => changeQty(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <strong>{money(item.product.price * item.quantity)}</strong>
              </div>
            </div>
          ))}

          {checkout && (
            <>
              <div className="space-y-2 rounded-lg border bg-white p-4">
                <div className="flex justify-between"><span>Total</span><strong>{money(checkout.totalAmount)}</strong></div>
                <div className="flex justify-between text-green-700"><span>Paid</span><strong>{money(checkout.paidAmount)}</strong></div>
                <div className="flex justify-between border-t pt-2 text-lg"><span>Balance</span><strong>{money(checkout.balanceAmount)}</strong></div>
                {checkout.changeAmount > 0 && <div className="flex justify-between"><span>Change</span><strong>{money(checkout.changeAmount)}</strong></div>}
              </div>
              {checkout.payments?.map(payment => (
                <div key={payment.id} className="flex justify-between rounded-lg border bg-white p-3 text-sm">
                  <span className="capitalize">{payment.method} {payment.referenceCode && `- ${payment.referenceCode}`}</span>
                  <strong>{money(payment.appliedAmount)}</strong>
                </div>
              ))}
              {checkout.status === "open" && checkout.balanceAmount > 0 && (
                <div className="rounded-lg border border-primary/20 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining balance</p>
                  <p className="mt-1 text-2xl font-black text-primary">{money(checkout.balanceAmount)}</p>
                  <Button className="mt-4 w-full" onClick={() => void openPaymentMode("chooser")}>Choose payment method</Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t bg-white p-4">
          {!checkout ? (
            <>
              <Input className="mb-3" placeholder="Customer name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <div className="mb-3 flex justify-between text-xl font-black"><span>Total</span><span>{money(total)}</span></div>
              <Button className="w-full" disabled={busy || cart.length === 0} onClick={openCheckout}>Review, Reserve & Checkout</Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={cancelCheckout} disabled={checkout.paidAmount > 0}>Cancel unpaid checkout</Button>
          )}
        </div>
      </aside>

      {checkout && paymentModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkout #{checkout.id}</p>
                <h2 className="text-2xl font-black">{paymentMode === "chooser" ? "Choose payment method" : paymentMode === "mpesa" ? "MPESA payment" : paymentMode === "stk" ? "STK-PUSH" : "Cash payment"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Remaining balance: <span className="font-black text-primary">{money(remainingBalance)}</span></p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPaymentModalOpen(false)} title="Close payment options"><X className="h-5 w-5" /></Button>
            </div>

            {paymentMode === "chooser" && (
              <div className="grid gap-3 md:grid-cols-3">
                <PaymentCard mode="mpesa" title="MPESA" image={MPESA_LOGO} description="Customer pays to the till or paybill, then cashier confirms the matching payment." />
                <PaymentCard mode="stk" title="STK-PUSH" image={MPESA_LOGO} badge="STK-PUSH" description="Send a push request to the customer's phone for the remaining or partial balance." />
                <PaymentCard mode="cash" title="CASH" image={CASH_LOGO} description="Record cash received. Overpayment is allowed and change will be shown." />
              </div>
            )}

            {paymentMode === "mpesa" && (
              <div className="space-y-4">
                <Button variant="outline" onClick={() => setPaymentMode("chooser")}><ArrowLeft className="mr-2 h-4 w-4" /> Payment options</Button>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="font-semibold">Ask the customer to pay any amount up to {money(checkout.balanceAmount)} via MPESA.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Incoming payments appear here for cashier confirmation before attachment.</p>
                  <Button variant="outline" className="mt-4" onClick={() => void findPayments()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" /> Find payments</Button>
                </div>
                <PaymentList unmatched={unmatched} checkout={checkout} busy={busy} onAttach={attachMpesa} />
              </div>
            )}

            {paymentMode === "stk" && (
              <div className="space-y-4">
                <Button variant="outline" onClick={() => setPaymentMode("chooser")}><ArrowLeft className="mr-2 h-4 w-4" /> Payment options</Button>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="mb-4 flex h-20 items-center justify-center rounded-lg bg-black">
                    <img src={MPESA_LOGO} alt="M-PESA logo" className="max-h-full max-w-full object-contain p-3" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="2547..." value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                    <Input type="number" max={checkout.balanceAmount} value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} />
                  </div>
                  <Button className="mt-4 w-full" onClick={initiateMpesa} disabled={busy || !mpesaPhone || Number(mpesaAmount) <= 0 || Number(mpesaAmount) > checkout.balanceAmount}>Send STK-PUSH</Button>
                  <p className="mt-2 text-xs text-muted-foreground">When the payment arrives, the cashier will confirm and attach it to this checkout.</p>
                </div>
              </div>
            )}

            {paymentMode === "cash" && (
              <div className="space-y-4">
                <Button variant="outline" onClick={() => setPaymentMode("chooser")}><ArrowLeft className="mr-2 h-4 w-4" /> Payment options</Button>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-white">
                    <img src={CASH_LOGO} alt="Cash payment logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <Input type="number" min="1" placeholder="Amount received" value={cashAmount} onChange={e => setCashAmount(e.target.value)} />
                  <Button className="mt-4 w-full" onClick={addCash} disabled={busy || Number(cashAmount) <= 0}>Apply cash payment</Button>
                  {Number(cashAmount) > checkout.balanceAmount && <p className="mt-2 text-sm font-semibold text-green-700">Change: {money(Number(cashAmount) - checkout.balanceAmount)}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {suggested && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-5 rounded-lg bg-white p-6">
            <div>
              <Badge className="mb-2">MPESA received</Badge>
              <h2 className="text-xl font-black">Does this payment belong to checkout #{checkout?.id}?</h2>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-3xl font-black text-green-700">{money(suggested.amount)}</p>
              <p className="mt-2 font-semibold">{suggested.payerName || "Name unavailable"}</p>
              <p className="text-sm text-muted-foreground">{suggested.payerPhone} - {suggested.referenceCode}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => { setSuggested(null); void findPayments(); }}><X className="mr-2 h-4 w-4" /> No</Button>
              <Button onClick={() => attachMpesa(suggested)} disabled={busy || suggested.amount > (checkout?.balanceAmount ?? 0)}><Check className="mr-2 h-4 w-4" /> Yes, attach</Button>
            </div>
            {suggested.amount > (checkout?.balanceAmount ?? 0) && <p className="text-sm text-destructive">This MPESA payment exceeds the remaining balance and cannot be attached.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentList({
  unmatched,
  checkout,
  busy,
  onAttach,
}: {
  unmatched: Payment[];
  checkout: CheckoutData;
  busy: boolean;
  onAttach: (payment: Payment) => void;
}) {
  if (unmatched.length === 0) {
    return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No recent unmatched MPESA payments found yet.</div>;
  }
  return (
    <div className="space-y-2">
      <h3 className="font-bold">Recent unmatched MPESA payments</h3>
      {unmatched.map(payment => (
        <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <b>{payment.payerName || payment.payerPhone || "MPESA customer"}</b>
            <small className="block text-muted-foreground">{payment.payerPhone} - {payment.referenceCode}</small>
          </span>
          <div className="text-right">
            <strong>{money(payment.amount)}</strong>
            <Button size="sm" className="ml-3" onClick={() => onAttach(payment)} disabled={busy || payment.amount > checkout.balanceAmount}>Attach</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
