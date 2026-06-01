import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail, sendViaProvider } from "./email";

interface CartItem {
  productId: string | number;
  quantity: number;
}

async function getProductById(id: string | number) {
  const product = await storage.getProductById(String(id));
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    description: product.contents,
    price: product.price,
    inStock: product.inStock,
  };
}

async function createOrder(data: {
  email: string;
  phone?: string;
  stripeSessionId: string;
  items: any[];
  total: number;
  shippingAddress?: any;
  shippingMethod?: string;
}) {
  return storage.createOrder({
    email: data.email,
    phone: data.phone || null,
    stripeSessionId: data.stripeSessionId,
    status: "pending",
    items: data.items,
    total: data.total,
    shippingAddress: data.shippingAddress || null,
    shippingMethod: data.shippingMethod || null,
  });
}

async function getOrderBySessionId(sessionId: string) {
  const order = await storage.getOrderBySessionId(sessionId);
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    email: order.email,
    phone: order.phone,
    total: order.total,
    shippingAddress: order.shippingAddress,
    shippingMethod: order.shippingMethod,
    items: order.items,
  };
}

async function markOrderPaid(orderId: string) {
  await storage.updateOrder(orderId, { status: "paid" });
}

async function resolveAffiliate(affiliateToken?: string, couponCode?: string) {
  const affiliatesEnabledSetting = await storage.getSetting("feature_affiliates_enabled");
  if (affiliatesEnabledSetting === "false") {
    return { affiliate: null, referral: null };
  }

  const crypto = await import("crypto");
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  // Path 1: session token from a previous ?ref=CODE click (localStorage)
  if (affiliateToken) {
    const existing = await storage.getAffiliateReferralBySessionToken(affiliateToken);
    if (existing) {
      const aff = await storage.getAffiliateById(existing.affiliateId);
      if (aff && aff.active && aff.approved) {
        const ageMs = Date.now() - new Date(existing.clickedAt).getTime();
        if (ageMs < thirtyDays) {
          // If the click row is still unconverted, reuse it for THIS purchase.
          // Otherwise this is a REPEAT purchase by the same referred customer —
          // create a fresh referral row so they still get credited.
          if (existing.status === "clicked") {
            return { affiliate: aff, referral: existing };
          }
          const referral = await storage.createAffiliateReferral({
            affiliateId: aff.id,
            sessionToken: crypto.randomUUID(),
          });
          return { affiliate: aff, referral };
        }
      }
    }
  }

  // Path 2: manually entered code in cart
  if (couponCode) {
    const aff = await storage.getAffiliateByCode(couponCode.toLowerCase());
    if (aff && aff.active && aff.approved) {
      const referral = await storage.createAffiliateReferral({
        affiliateId: aff.id,
        sessionToken: crypto.randomUUID(),
      });
      return { affiliate: aff, referral };
    }
  }

  return { affiliate: null, referral: null };
}

// Idempotently credit an affiliate for a paid order. Safe to call multiple times
// (from /verify and/or Stripe webhook). Returns true if commission was newly recorded.
export async function creditAffiliateForOrder(opts: {
  order: { id: string; total: number; items: any };
  referralId?: string | null;
  affiliateTokenLegacy?: string | null;
}): Promise<boolean> {
  try {
    const affiliatesEnabled = await storage.getSetting("feature_affiliates_enabled");
    if (affiliatesEnabled === "false") return false;

    // Idempotency: if any referral already points at this order, do nothing.
    const existingForOrder = await storage.getAffiliateReferralByOrderId(opts.order.id);
    if (existingForOrder) return false;

    let referral = null;
    if (opts.referralId) {
      referral = await storage.getAffiliateReferralById(opts.referralId);
    }
    if (!referral && opts.affiliateTokenLegacy) {
      referral = await storage.getAffiliateReferralBySessionToken(opts.affiliateTokenLegacy);
    }
    if (!referral) return false;
    if (referral.status !== "clicked") return false;

    const affiliate = await storage.getAffiliateById(referral.affiliateId);
    if (!affiliate) return false;

    const items = Array.isArray(opts.order.items) ? opts.order.items : [];
    const productTotal = items
      .filter((i: any) => !i.isShipping && !i.isDiscount)
      .reduce((s: number, i: any) => s + (Number(i.price) * Number(i.quantity)), 0);
    const commissionAmount = Math.round(productTotal * (affiliate.commissionRate / 100));

    await storage.updateAffiliateReferral(referral.id, {
      orderId: opts.order.id,
      orderTotal: opts.order.total,
      commissionAmount,
      status: "converted",
      convertedAt: new Date(),
    } as any);

    console.log(`[affiliate] credited ${affiliate.code} $${commissionAmount} for order ${opts.order.id}`);

    if (affiliate.emailNotificationsEnabled) {
      try {
        const siteUrl = process.env.SITE_URL || "https://aurapepts.com";
        const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#201C16;margin:0 0 12px;">New Sale — You Earned a Commission!</h2>
          <p style="color:#6B6258;font-size:14px;">Someone used your referral and completed a purchase.</p>
          <div style="background:#f9f8f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0 0 8px;font-size:14px;color:#3A332B;"><strong>Order Total:</strong> $${opts.order.total}</p>
            <p style="margin:0;font-size:14px;color:#3A332B;"><strong>Your Commission (${affiliate.commissionRate}%):</strong> $${commissionAmount}</p>
          </div>
          <div style="text-align:center;margin:20px 0;">
            <a href="${siteUrl}/affiliates" style="display:inline-block;padding:12px 32px;background:#201C16;color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">View Dashboard</a>
          </div>
        </div>`;
        await sendViaProvider({ to: affiliate.email, subject: `New Sale! You earned $${commissionAmount} — Aura Peptides`, html });
      } catch (emailErr: any) {
        console.error("[affiliate] conversion email error:", emailErr.message);
      }
    }
    return true;
  } catch (err: any) {
    console.error("[affiliate] creditAffiliateForOrder error:", err.message);
    return false;
  }
}

export function registerStripeRoutes(app: Express) {
  app.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(400).json({ message: "Stripe is not configured. Set STRIPE_SECRET_KEY in Secrets." });
      }

      const stripe = new Stripe(stripeKey);
      const currency = process.env.STRIPE_CURRENCY || "usd";

      const { email, phone, items, shippingOptionId, shippingAddress, affiliateToken, couponCode } = req.body as {
        email: string;
        phone?: string;
        items: CartItem[];
        shippingOptionId?: string;
        shippingAddress?: {
          name: string;
          line1: string;
          line2?: string;
          city: string;
          state: string;
          zip: string;
          country: string;
        };
        affiliateToken?: string;
        couponCode?: string;
      };

      if (!email || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Email and items are required." });
      }

      if (!shippingOptionId) {
        return res.status(400).json({ message: "Shipping method is required." });
      }

      let shippingName = "Standard Shipping";
      let shippingPriceCents = 999;
      let isPickup = false;

      const shippingOption = await storage.getShippingOptionById(shippingOptionId);
      if (shippingOption && shippingOption.enabled) {
        shippingName = shippingOption.name;
        shippingPriceCents = shippingOption.price;
        isPickup = shippingOption.price === 0;
      }

      if (!isPickup) {
        if (!shippingAddress || !shippingAddress.name?.trim() || !shippingAddress.line1?.trim() ||
            !shippingAddress.city?.trim() || !shippingAddress.state?.trim() || !shippingAddress.zip?.trim()) {
          return res.status(400).json({ message: "Complete shipping address is required for delivery orders." });
        }
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      let productTotalDollars = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const product = await getProductById(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
        if (!product.inStock) {
          return res.status(400).json({ message: `${product.name} is out of stock.` });
        }

        lineItems.push({
          price_data: {
            currency,
            product_data: {
              name: product.name,
              ...(product.description ? { description: product.description } : {}),
            },
            unit_amount: product.price * 100,
          },
          quantity: item.quantity,
        });

        productTotalDollars += product.price * item.quantity;
        orderItems.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
        });
      }

      const { affiliate, referral } = await resolveAffiliate(affiliateToken, couponCode);
      let discountDollars = 0;
      let stripeCouponId: string | undefined;
      if (affiliate) {
        discountDollars = Math.round(productTotalDollars * (affiliate.referralDiscount / 100));
        if (discountDollars > 0) {
          const coupon = await stripe.coupons.create({
            amount_off: discountDollars * 100,
            currency,
            duration: "once",
            name: `Affiliate ${affiliate.code.toUpperCase()} (${affiliate.referralDiscount}% off)`,
          });
          stripeCouponId = coupon.id;
          orderItems.push({
            name: `Affiliate Discount (${affiliate.code.toUpperCase()}, ${affiliate.referralDiscount}% off)`,
            price: -discountDollars,
            quantity: 1,
            isDiscount: true,
          });
        }
      }

      const thresholdVal = await storage.getSetting("free_shipping_threshold");
      const freeShippingThreshold = thresholdVal ? parseInt(thresholdVal, 10) : 0;
      let freeShippingApplied = false;
      if (freeShippingThreshold > 0 && productTotalDollars >= freeShippingThreshold && !isPickup && shippingPriceCents > 0) {
        freeShippingApplied = true;
        shippingPriceCents = 0;
      }

      if (shippingPriceCents > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: shippingName, description: "Shipping" },
            unit_amount: shippingPriceCents,
          },
          quantity: 1,
        });
      }

      const shippingDollars = shippingPriceCents / 100;
      const orderTotalDollars = productTotalDollars - discountDollars + shippingDollars;

      orderItems.push({
        name: freeShippingApplied ? `${shippingName} (Free — order over $${freeShippingThreshold})` : shippingName,
        price: shippingDollars,
        quantity: 1,
        isShipping: true,
      });

      const host = req.headers.host || "localhost:5000";
      const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
      const baseUrl = `${protocol}://${host}`;

      const metadata: Record<string, string> = {};
      if (referral) {
        metadata.affiliate_referral_id = referral.id;
        metadata.affiliate_token = referral.sessionToken; // legacy/back-compat
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        customer_email: email,
        success_url: process.env.SUCCESS_URL || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.CANCEL_URL || `${baseUrl}/cart`,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
      };

      const stripeSession = await stripe.checkout.sessions.create(sessionParams);

      const orderAddress = isPickup
        ? { pickup: true, location: shippingName }
        : (shippingAddress || null);

      await createOrder({
        email,
        phone: phone || undefined,
        stripeSessionId: stripeSession.id,
        items: orderItems,
        total: Math.round(orderTotalDollars),
        shippingAddress: orderAddress,
        shippingMethod: shippingName,
      });

      try {
        await storage.upsertCustomer({
          email,
          name: !isPickup && shippingAddress?.name ? shippingAddress.name : undefined,
          phone: phone || undefined,
          shippingAddress: !isPickup ? shippingAddress : undefined,
        });
      } catch (err) {
        console.error("Customer upsert at checkout error:", err);
      }

      try {
        const productOnlyItems = orderItems.filter((i: any) => !i.isShipping);
        await storage.upsertAbandonedCart(email, productOnlyItems, Math.round(productTotalDollars));
      } catch (err) {
        console.error("Abandoned cart upsert error:", err);
      }

      res.json({ url: stripeSession.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Checkout failed. Please try again." });
    }
  });

  app.get("/api/checkout/verify", async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ message: "session_id is required" });
      }

      const order = await getOrderBySessionId(sessionId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.json({ paid: order.status === "paid", order });
      }

      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.json({ paid: false, order });
      }

      // Mark paid + run one-shot side effects (customer upsert, abandoned cart, emails)
      // gated on the order transitioning from non-paid → paid so we don't duplicate.
      const wasJustMarkedPaid = order.status !== "paid";
      if (wasJustMarkedPaid) {
        await markOrderPaid(order.id);

        const addr = order.shippingAddress as any;
        const isPickup = addr?.pickup === true;
        try {
          await storage.upsertCustomer({
            email: order.email,
            name: !isPickup && addr?.name ? addr.name : undefined,
            phone: order.phone || undefined,
            shippingAddress: !isPickup ? addr : undefined,
            orderTotal: order.total,
            incrementOrder: true,
          });
        } catch (err) {
          console.error("Customer upsert at verify error:", err);
        }

        try {
          await storage.markAbandonedCartConverted(order.email);
        } catch (err) {
          console.error("Abandoned cart conversion error:", err);
        }

        const paidOrder = { ...order, status: "paid" as const };
        sendOrderConfirmationEmail(order.email, paidOrder).catch(err =>
          console.error("Order confirmation email error:", err)
        );
        sendAdminNewOrderEmail(paidOrder).catch(err =>
          console.error("Admin new order email error:", err)
        );
      }

      // Affiliate crediting runs UNCONDITIONALLY (idempotent on order.id), so a
      // webhook + verify race can't lose the commission and replays are safe.
      await creditAffiliateForOrder({
        order: { id: order.id, total: order.total, items: order.items },
        referralId: session.metadata?.affiliate_referral_id || null,
        affiliateTokenLegacy: session.metadata?.affiliate_token || null,
      });

      return res.json({ paid: true, order: { ...order, status: "paid" as const } });
    } catch (error: any) {
      console.error("Verify error:", error);
      res.status(500).json({ message: "Verification failed." });
    }
  });

  // Stripe webhook — safety net for customers who close the browser before
  // returning to /checkout/success. Optional: only active if STRIPE_WEBHOOK_SECRET
  // is configured. Idempotent via creditAffiliateForOrder + order.status check.
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeKey || !webhookSecret) {
      return res.status(200).json({ received: true, configured: false });
    }
    const stripe = new Stripe(stripeKey);
    let event: Stripe.Event;
    try {
      const sig = req.headers["stripe-signature"] as string;
      const rawBody = (req as any).rawBody;
      if (!rawBody || !sig) throw new Error("Missing raw body or signature");
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-webhook] signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          const order = await getOrderBySessionId(session.id);
          if (order) {
            const wasJustMarkedPaid = order.status !== "paid";
            if (wasJustMarkedPaid) {
              await markOrderPaid(order.id);
              const addr = order.shippingAddress as any;
              const isPickup = addr?.pickup === true;
              try {
                await storage.upsertCustomer({
                  email: order.email,
                  name: !isPickup && addr?.name ? addr.name : undefined,
                  phone: order.phone || undefined,
                  shippingAddress: !isPickup ? addr : undefined,
                  orderTotal: order.total,
                  incrementOrder: true,
                });
              } catch (err) { console.error("Customer upsert at webhook error:", err); }
              try { await storage.markAbandonedCartConverted(order.email); } catch {}
              const paidOrder = { ...order, status: "paid" as const };
              sendOrderConfirmationEmail(order.email, paidOrder).catch(err =>
                console.error("Webhook order confirmation email error:", err)
              );
              sendAdminNewOrderEmail(paidOrder).catch(err =>
                console.error("Webhook admin email error:", err)
              );
            }
            await creditAffiliateForOrder({
              order: { id: order.id, total: order.total, items: order.items },
              referralId: session.metadata?.affiliate_referral_id || null,
              affiliateTokenLegacy: session.metadata?.affiliate_token || null,
            });
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[stripe-webhook] handler error:", err.message);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });
}
