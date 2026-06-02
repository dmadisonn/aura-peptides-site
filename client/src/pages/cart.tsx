import { Link, useLocation } from "wouter";
import { Minus, Plus, Trash2, ArrowLeft, ShoppingCart, Truck, MapPin, Lock, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/stores/cart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { ShippingOption } from "@shared/schema";
import { getAffiliateToken, getAffiliateDiscount, getAffiliateCode, clearAffiliateData } from "@/components/affiliate-tracker";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const { toast } = useToast();
  const flags = useFeatureFlags();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [address, setAddress] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });

  const { data: shippingOptions } = useQuery<ShippingOption[]>({
    queryKey: ["/api/shipping-options"],
  });

  const { data: thresholdData } = useQuery<{ threshold: number | null }>({
    queryKey: ["/api/settings/free-shipping-threshold"],
  });
  const freeShippingThreshold = thresholdData?.threshold ?? 0;

  const { data: paymentMethodsData } = useQuery<{ stripeEnabled: boolean; invoiceEnabled: boolean }>({
    queryKey: ["/api/settings/payment-methods"],
  });
  const stripeEnabled = paymentMethodsData?.stripeEnabled ?? true;
  const invoiceEnabled = paymentMethodsData?.invoiceEnabled ?? false;

  useEffect(() => {
    if (shippingOptions && shippingOptions.length > 0 && !selectedShipping) {
      setSelectedShipping(shippingOptions[0].id);
    }
  }, [shippingOptions, selectedShipping]);

  const subtotal = getTotal();
  const activeShipping = shippingOptions?.find(o => o.id === selectedShipping);
  const isPickup = activeShipping ? activeShipping.price === 0 : false;
  const qualifiesForFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold && !isPickup;
  const shippingCost = activeShipping
    ? (qualifiesForFreeShipping && activeShipping.price > 0 ? 0 : activeShipping.price / 100)
    : null;

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; name: string } | null>(null);
  const [couponError, setCouponError] = useState("");

  const affiliateToken = getAffiliateToken();
  const affiliateDiscount = getAffiliateDiscount();
  const affiliateCode = getAffiliateCode();

  const effectiveDiscount = couponApplied ? couponApplied.discount : (affiliateToken ? affiliateDiscount : 0);
  const discountAmount = effectiveDiscount > 0 ? Math.round(subtotal * (effectiveDiscount / 100)) : 0;

  const applyCoupon = async () => {
    setCouponError("");
    if (!couponCode.trim()) return;
    try {
      const res = await fetch(`/api/affiliate/validate-code?code=${encodeURIComponent(couponCode.trim())}`);
      const data = await res.json();
      if (data.valid) {
        setCouponApplied({ code: couponCode.trim().toLowerCase(), discount: data.discount, name: data.affiliateName });
        setCouponError("");
      } else {
        setCouponError("Invalid code");
        setCouponApplied(null);
      }
    } catch {
      setCouponError("Failed to validate");
    }
  };

  const [invoiceSuccess, setInvoiceSuccess] = useState(false);
  const [researchCertified, setResearchCertified] = useState(false);
  const [invoiceOrderId, setInvoiceOrderId] = useState("");

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        email,
        phone: phone || undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        shippingOptionId: selectedShipping,
      };
      if (!isPickup) {
        body.shippingAddress = { ...address, country: "US" };
      }
      const res = await apiRequest("POST", "/api/checkout/invoice", body);
      return res.json();
    },
    onSuccess: (data: { orderId: string; total: number }) => {
      setInvoiceOrderId(data.orderId);
      setInvoiceSuccess(true);
      clearCart();
    },
    onError: (error: Error) => {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    },
  });

  const handleInvoice = () => {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Email required", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10) {
      toast({ title: "Phone number required", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    if (!selectedShipping) {
      toast({ title: "Shipping method required", description: "Please select a shipping method.", variant: "destructive" });
      return;
    }
    if (!isPickup) {
      if (!address.name.trim() || !address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
        toast({ title: "Shipping address required", description: "Please fill in all required address fields.", variant: "destructive" });
        return;
      }
    }
    if (!researchCertified) {
      toast({
        title: "Research certification required",
        description: "Please certify that you are a qualified researcher before placing an order.",
        variant: "destructive",
      });
      return;
    }
    invoiceMutation.mutate();
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        email,
        phone: phone || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        shippingOptionId: selectedShipping,
      };
      if (!isPickup) {
        body.shippingAddress = { ...address, country: "US" };
      }
      if (couponApplied) {
        body.couponCode = couponApplied.code;
      } else if (affiliateToken) {
        body.affiliateToken = affiliateToken;
      }
      const res = await apiRequest("POST", "/api/checkout", body);
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleCheckout = () => {
    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10) {
      toast({
        title: "Phone number required",
        description: "Please enter a valid 10-digit phone number.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedShipping) {
      toast({
        title: "Shipping method required",
        description: "Please select a shipping method.",
        variant: "destructive",
      });
      return;
    }
    if (!isPickup) {
      if (!address.name.trim() || !address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
        toast({
          title: "Shipping address required",
          description: "Please fill in all required address fields.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!researchCertified) {
      toast({
        title: "Research certification required",
        description: "Please certify that you are a qualified researcher before placing an order.",
        variant: "destructive",
      });
      return;
    }
    checkoutMutation.mutate();
  };

  if (invoiceSuccess) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-950">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Order Request Submitted!</h2>
        <p className="text-muted-foreground mb-1 text-sm">
          {flags.emails ? (
            <>We've received your order and sent a confirmation to <strong>{email}</strong>.</>
          ) : (
            <>We've received your order for <strong>{email}</strong>.</>
          )}
        </p>
        <p className="text-muted-foreground mb-1 text-sm">
          We'll follow up shortly with an invoice and payment instructions.
        </p>
        {invoiceOrderId && (
          <p className="text-xs text-muted-foreground mt-3 mb-6">
            Order #{invoiceOrderId.slice(0, 8).toUpperCase()}
          </p>
        )}
        <Link href="/products">
          <Button className="rounded-full mt-4" data-testid="button-continue-after-invoice">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-2" data-testid="text-empty-cart">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Browse our catalog to find research peptides.
        </p>
        <Link href="/products">
          <Button data-testid="button-continue-shopping">
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  const total = (shippingCost !== null ? subtotal + shippingCost : subtotal) - discountAmount;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const inputClass = "w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-8">
      <Link href="/products">
        <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-to-shop">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Continue Shopping
        </Button>
      </Link>

      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-cart-title">Checkout</h1>
        <span className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      {freeShippingThreshold > 0 && !qualifiesForFreeShipping && !isPickup && (
        <div className="mb-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {subtotal > 0
                ? `Add $${freeShippingThreshold - subtotal} more for free shipping`
                : `Free shipping on orders over $${freeShippingThreshold}`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((subtotal / freeShippingThreshold) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {qualifiesForFreeShipping && (
        <div className="mb-6 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <Truck className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">You qualify for free shipping!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Checkout flow */}
        <div className="lg:col-span-3 space-y-6">
          {/* Order summary breakdown */}
          <div className="rounded-lg border p-5">
            <h3 className="text-sm font-medium mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between gap-3">
                  <span className="text-muted-foreground truncate">
                    {item.name} <span className="text-xs">× {item.quantity}</span>
                  </span>
                  <span className="tabular-nums font-medium shrink-0">${item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span className="tabular-nums">
                  {qualifiesForFreeShipping ? (
                    <span className="text-green-600 font-medium">Free</span>
                  ) : shippingCost === 0 ? "Free" : shippingCost !== null ? `$${shippingCost % 1 === 0 ? shippingCost : shippingCost.toFixed(2)}` : "—"}
                </span>
              </div>
              {qualifiesForFreeShipping && activeShipping && activeShipping.price > 0 && (
                <p className="text-xs text-green-600">Free shipping applied — order over ${freeShippingThreshold}</p>
              )}
              {flags.affiliates && discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({effectiveDiscount}% off)</span>
                  <span className="tabular-nums font-medium">-${discountAmount}</span>
                </div>
              )}
            </div>
            {flags.affiliates && !couponApplied && !affiliateToken && (
              <div className="mt-3 mb-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value); setCouponError(""); }}
                    placeholder="Discount code"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="input-coupon-code"
                  />
                  <Button variant="outline" size="sm" onClick={applyCoupon} data-testid="button-apply-coupon">Apply</Button>
                </div>
                {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
              </div>
            )}
            {flags.affiliates && (couponApplied || (affiliateToken && affiliateDiscount > 0)) && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium">
                  {couponApplied ? `Code "${couponApplied.code.toUpperCase()}" applied` : `Referral discount applied`} ({effectiveDiscount}% off)
                </span>
                {couponApplied ? (
                  <button onClick={() => { setCouponApplied(null); setCouponCode(""); }} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
                ) : affiliateToken ? (
                  <button onClick={() => { clearAffiliateData(); window.location.reload(); }} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
                ) : null}
              </div>
            )}
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold" data-testid="text-cart-total">
                ${total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Delivery method */}
          <div>
            <label className="block text-sm font-medium mb-3">Delivery Method</label>
            <div className="space-y-2">
              {shippingOptions?.map((option) => {
                const isSelected = selectedShipping === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                    data-testid={`shipping-option-${option.id}`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <input
                      type="radio"
                      name="shipping"
                      value={option.id}
                      checked={isSelected}
                      onChange={() => setSelectedShipping(option.id)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {option.price > 0 ? (
                          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-semibold">{option.name}</span>
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed ml-6">
                          {option.description}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0 tabular-nums">
                      {option.price === 0 ? "Free" : qualifiesForFreeShipping ? (
                        <span className="flex flex-col items-end">
                          <span className="line-through text-muted-foreground text-xs">${option.price % 100 === 0 ? option.price / 100 : (option.price / 100).toFixed(2)}</span>
                          <span className="text-green-600">Free</span>
                        </span>
                      ) : `$${option.price % 100 === 0 ? option.price / 100 : (option.price / 100).toFixed(2)}`}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Shipping address (only for non-pickup) */}
          {!isPickup && (
            <div>
              <label className="block text-sm font-medium mb-3">Shipping Address <span className="text-destructive">*</span></label>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={address.name}
                  onChange={(e) => setAddress({ ...address, name: e.target.value })}
                  className={inputClass}
                  data-testid="input-shipping-name"
                />
                <input
                  type="text"
                  placeholder="Street address"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  className={inputClass}
                  autoComplete="off"
                  data-testid="input-shipping-line1"
                />
                <input
                  type="text"
                  placeholder="Apt, suite, unit (optional)"
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  className={inputClass}
                  data-testid="input-shipping-line2"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className={inputClass}
                    data-testid="input-shipping-city"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className={inputClass}
                    data-testid="input-shipping-state"
                  />
                  <input
                    type="text"
                    placeholder="ZIP code"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    className={inputClass}
                    data-testid="input-shipping-zip"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contact information */}
          <div>
            <label className="block text-sm font-medium mb-3">Contact Information <span className="text-destructive">*</span></label>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                data-testid="input-email"
              />
              <input
                type="tel"
                placeholder="Phone number (xxx) xxx-xxxx"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={inputClass}
                data-testid="input-phone"
              />
            </div>
          </div>

          {/* Checkout button */}
          <div className="space-y-3">
            {stripeEnabled && (
              <Button
                className="w-full h-12 text-sm font-semibold rounded-full"
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending || invoiceMutation.isPending}
                data-testid="button-checkout"
              >
                {checkoutMutation.isPending ? (
                  "Processing..."
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Pay ${total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}
                  </span>
                )}
              </Button>
            )}

            {stripeEnabled && invoiceEnabled && (
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide shrink-0">or</span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}

            {invoiceEnabled && (
              <>
                <Button
                  variant="outline"
                  className="w-full h-11 text-sm rounded-full"
                  onClick={handleInvoice}
                  disabled={checkoutMutation.isPending || invoiceMutation.isPending}
                  data-testid="button-request-invoice"
                >
                  {invoiceMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Request Invoice — Pay Later
                    </span>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  {flags.emails
                    ? "We'll email you an invoice with payment instructions."
                    : "We'll follow up with an invoice and payment instructions."}
                </p>
              </>
            )}

            {!stripeEnabled && !invoiceEnabled && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Checkout is temporarily unavailable. Please check back soon.</p>
              </div>
            )}

            {/* Researcher Certification Checkbox */}
            <div className={`rounded-lg border p-4 mt-2 transition-colors ${researchCertified ? 'border-primary/40 bg-primary/5' : 'border-yellow-500/40 bg-yellow-500/5'}`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="research-cert"
                  checked={researchCertified}
                  onCheckedChange={(checked) => setResearchCertified(!!checked)}
                  className="mt-0.5 shrink-0"
                />
                <label htmlFor="research-cert" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
                  <span className="font-semibold text-foreground">I certify that I am a qualified researcher</span> purchasing these compounds exclusively for legitimate in-vitro laboratory research. I am 18 years of age or older, will not use these products for human or animal consumption, and agree to the{" "}
                  <a href="/terms" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                  These statements have not been evaluated by the FDA.
                </label>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed text-center" data-testid="text-cart-disclaimer">
              For research use only. Not for human or veterinary use. Not intended for diagnostic or therapeutic purposes.
            </p>
          </div>
        </div>

        {/* Right: Cart items */}
        <div className="lg:col-span-2 order-first lg:order-last">
          <div className="lg:sticky lg:top-20">
            <h3 className="text-sm font-medium mb-4 text-muted-foreground uppercase tracking-wider">
              Your Items
            </h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="group flex gap-3 p-3 rounded-lg border bg-card"
                  data-testid={`card-cart-item-${item.productId}`}
                >
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted/30 shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight truncate" data-testid={`text-cart-item-name-${item.productId}`}>
                        {item.name}
                      </h3>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(item.productId)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-0.5 -mr-1"
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-cart-item-price-${item.productId}`}>
                      ${item.price} each
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-0 border rounded-full overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-semibold min-w-[2ch] text-center px-1 tabular-nums" data-testid={`text-quantity-${item.productId}`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" data-testid={`text-cart-item-subtotal-${item.productId}`}>
                        ${item.price * item.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
