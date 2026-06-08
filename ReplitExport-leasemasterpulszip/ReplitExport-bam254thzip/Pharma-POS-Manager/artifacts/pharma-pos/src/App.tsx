import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Checkout from "@/pages/checkout";
import CheckoutConfirm from "@/pages/checkout-confirm";
import CheckoutReceipt from "@/pages/checkout-receipt";
import Products from "@/pages/products";
import ProductForm from "@/pages/product-form";
import Inventory from "@/pages/inventory";
import Customers from "@/pages/customers";
import Transactions from "@/pages/transactions";
import Messages from "@/pages/messages";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/checkout" component={() => <Layout><Checkout /></Layout>} />
      <Route path="/checkout/confirm/:id" component={() => <Layout><CheckoutConfirm /></Layout>} />
      <Route path="/checkout/receipt/:id" component={() => <Layout><CheckoutReceipt /></Layout>} />
      <Route path="/products" component={() => <Layout><Products /></Layout>} />
      <Route path="/products/new" component={() => <Layout><ProductForm /></Layout>} />
      <Route path="/products/:id/edit" component={() => <Layout><ProductForm /></Layout>} />
      <Route path="/inventory" component={() => <Layout><Inventory /></Layout>} />
      <Route path="/customers" component={() => <Layout><Customers /></Layout>} />
      <Route path="/transactions" component={() => <Layout><Transactions /></Layout>} />
      <Route path="/messages" component={() => <Layout><Messages /></Layout>} />
      <Route component={() => <Layout><NotFound /></Layout>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
