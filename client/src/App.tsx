import { Switch, Route } from "wouter";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
import { useFeatureFlags } from "@/hooks/use-feature-flags";

function AppAffiliateTracker() {
  const flags = useFeatureFlags();
  if (!flags.affiliates) return null;
  return <AffiliateTracker />;
}

function AffiliateBanner() {
  const flags = useFeatureFlags();
  const { data } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/affiliate-banner"],
  });
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("affiliate-banner-dismissed") === "true"
  );

  if (!flags.affiliates || !data || !data.enabled || dismissed) return null;

  function dismiss() {
    localStorage.setItem("affiliate-banner-dismissed", "true");
    setDismissed(true);
  }

  return (
    <div className="relative bg-foreground text-background text-center py-2.5 px-10">
      <a
        href="/affiliates"
        className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] uppercase text-background/85 hover:text-background transition-colors"
      >
        <span>Earn 10% commission</span>
        <span className="opacity-50">·</span>
        <span className="opacity-75">Join our affiliate program</span>
        <ArrowRight className="h-3 w-3" />
      </a>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-background/55 hover:text-background transition-colors p-1"
        aria-label="Dismiss banner"
        data-testid="button-dismiss-affiliate-banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AffiliateBanner />
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
        <StorefrontLayout><ResubscribeRouteGuard /></StorefrontLayout>
      </Route>
      <Route path="/affiliates">
        <StorefrontLayout><AffiliatesRouteGuard /></StorefrontLayout>
      </Route>
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminPage} />
      <Route>
        <StorefrontLayout><NotFound /></StorefrontLayout>
      </Route>
    </Switch>
  );
}

function ResubscribeRouteGuard() {
  const flags = useFeatureFlags();
  if (!flags.emails) return <NotFound />;
  return <ResubscribePage />;
}

function AffiliatesRouteGuard() {
  const flags = useFeatureFlags();
  if (!flags.affiliates) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="text-2xl font-light tracking-tight mb-3">Affiliate program unavailable</h1>
        <p className="text-sm text-muted-foreground">
          Our affiliate program is currently paused. Please check back later.
        </p>
      </div>
    );
  }
  return <AffiliatesPage />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppAffiliateTracker />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
