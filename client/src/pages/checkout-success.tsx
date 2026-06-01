import { Link } from "wouter";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/stores/cart";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  const flags = useFeatureFlags();

  useEffect(() => {
    clearCart();
  }, []);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session_id");

  const { data, isLoading, isError } = useQuery<{ paid: boolean; order: { id: string; status: string } } | null>({
    queryKey: ["/api/checkout/verify", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    enabled: !!sessionId,
    retry: 3,
    retryDelay: 2000,
  });

  if (isLoading && sessionId) {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-primary/10">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h1 className="text-2xl font-bold mb-2" data-testid="text-verifying-title">Verifying Payment</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-verifying-message">
          Please wait while we confirm your payment...
        </p>
      </div>
    );
  }

  if (isError || (data && !data.paid)) {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2" data-testid="text-pending-title">Payment Pending</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed" data-testid="text-pending-message">
          {flags.emails
            ? "Your payment is still being processed. You will receive a confirmation email once it's complete."
            : "Your payment is still being processed. Please check back shortly."}
        </p>
        <Link href="/products">
          <Button data-testid="button-back-to-shop">
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-24 text-center">
      <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-primary/10">
        <CheckCircle className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold mb-2" data-testid="text-success-title">Order Confirmed</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed" data-testid="text-success-message">
        {flags.emails
          ? "Thank you for your order. You will receive a confirmation email shortly with your order details and tracking information."
          : "Thank you for your order. Your order details and tracking information will be available in your account."}
      </p>
      <Link href="/products">
        <Button data-testid="button-back-to-shop">
          Continue Shopping
        </Button>
      </Link>
    </div>
  );
}
