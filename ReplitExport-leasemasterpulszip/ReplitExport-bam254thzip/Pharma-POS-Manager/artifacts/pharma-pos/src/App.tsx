import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Checkout from "@/pages/checkout";
import CheckoutReceipt from "@/pages/checkout-receipt";
import Products from "@/pages/products";
import ProductForm from "@/pages/product-form";
import Inventory from "@/pages/inventory";
import Sales from "@/pages/sales";
import Staff from "@/pages/staff";
import Messages from "@/pages/messages";
import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin/index";
import PharmaciesList from "@/pages/admin/pharmacies";
import PharmacyForm from "@/pages/admin/pharmacy-form";
import SmsAudit from "@/pages/admin/sms-audit";

const queryClient = new QueryClient();

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080f1c" }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-green-400" />
        <p className="text-white/40 text-sm">Loading PharmaOS…</p>
      </div>
    </div>
  );
}

function Router() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  if (loading) return <AppLoader />;

  if (!user) {
    if (location !== "/login") return <LoginPage />;
    return <LoginPage />;
  }

  if (user.role === "super_admin") {
    return (
      <Switch>
        <Route path="/admin" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/pharmacies" component={() => <AdminLayout><PharmaciesList /></AdminLayout>} />
        <Route path="/admin/pharmacies/new" component={() => <AdminLayout><PharmacyForm /></AdminLayout>} />
        <Route path="/admin/pharmacies/:id/edit" component={() => <AdminLayout><PharmacyForm /></AdminLayout>} />
        <Route path="/admin/pharmacies/:id/messages" component={() => <AdminLayout><SmsAudit /></AdminLayout>} />
        <Route component={() => { navigate("/admin"); return null; }} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/checkout" component={() => <Layout><Checkout /></Layout>} />
      <Route path="/checkout/receipt/:id" component={() => <Layout><CheckoutReceipt /></Layout>} />
      <Route path="/products" component={() => <Layout><Products /></Layout>} />
      <Route path="/products/new" component={() => <Layout><ProductForm /></Layout>} />
      <Route path="/products/:id/edit" component={() => <Layout><ProductForm /></Layout>} />
      <Route path="/inventory" component={() => <Layout><Inventory /></Layout>} />
      <Route path="/sales" component={() => <Layout><Sales /></Layout>} />
      <Route path="/staff" component={() => <Layout><Staff /></Layout>} />
      <Route path="/messages" component={() => <Layout><Messages /></Layout>} />
      <Route component={() => <Layout><NotFound /></Layout>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
