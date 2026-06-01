import { Switch, Route } from "wouter";
import { X } from "lucide-react";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { MobileBottomNav } from "@/components/mobile-nav";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import ProductsPage from "@/pages/products";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutSuccessPage from "@/pages/checkout-success";
import AdminLoginPage from "@/pages/admin-login";
import AdminPage from "@/pages/admin";
import AboutPage from "@/pages/about";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import CertificatesPage from "@/pages/certificates";
import ContactPage from "@/pages/contact";
import { ResubscribePage } from "@/pages/unsubscribe";
import AffiliatesPage from "@/pages/affiliates";
import { AffiliateTracker } from "@/components/affiliate-tracker";

function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <StoreHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <StoreFooter />
      <MobileBottomNav />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <StorefrontLayout><HomePage /></StorefrontLayout>
      </Route>
      <Route path="/products">
        <StorefrontLayout><ProductsPage /></StorefrontLayout>
      </Route>
      <Route path="/products/:slug">
        <StorefrontLayout><ProductDetailPage /></StorefrontLayout>
      </Route>
      <Route path="/cart">
        <StorefrontLayout><CartPage /></StorefrontLayout>
      </Route>
      <Route path="/checkout/success">
        <StorefrontLayout><CheckoutSuccessPage /></StorefrontLayout>
      </Route>
      <Route path="/about">
        <StorefrontLayout><AboutPage /></StorefrontLayout>
      </Route>
      <Route path="/certificates">
        <StorefrontLayout><CertificatesPage /></StorefrontLayout>
      </Route>
      <Route path="/contact">
        <StorefrontLayout><ContactPage /></StorefrontLayout>
      </Route>
      <Route path="/terms">
        <StorefrontLayout><TermsPage /></StorefrontLayout>
      </Route>
      <Route path="/privacy">
        <StorefrontLayout><PrivacyPage /></StorefrontLayout>
      </Route>
      <Route path="/resubscribe">
        <StorefrontLayout><ResubscribePage /></StorefrontLayout>
      </Route>
      <Route path="/affiliates">
        <StorefrontLayout><AffiliatesPage /></StorefrontLayout>
      </Route>
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminPage} />
      <Route>
        <StorefrontLayout><NotFound /></StorefrontLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AffiliateTracker />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
