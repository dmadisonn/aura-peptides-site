import nodemailer from "nodemailer";
import crypto from "crypto";
import { Resend } from "resend";
import { storage } from "./storage";
import type { Order } from "@shared/schema";

function getSiteUrl(): string {
  return process.env.SITE_URL || "https://aurapepts.com";
}

async function getEmailProvider(): Promise<"gmail" | "resend"> {
  const provider = await storage.getSetting("email_provider");
  return (provider === "resend") ? "resend" : "gmail";
}

async function getGmailCredentials(): Promise<{ user: string; pass: string } | null> {
  const dbUser = await storage.getSetting("gmail_user");
  const dbPass = await storage.getSetting("gmail_app_password");
  const user = dbUser || process.env.GMAIL_USER;
  const pass = dbPass || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass };
}

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
  const apiKey = await storage.getSetting("resend_api_key");
  const fromEmail = await storage.getSetting("resend_from_email");
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail };
}

interface SendEmailOpts {
  to: string;
  bcc?: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  html: string;
}

async function buildBccList(opts: SendEmailOpts): Promise<string[]> {
  const list: string[] = [];
  if (opts.bcc) list.push(opts.bcc);
  const adminBcc = await storage.getSetting("admin_bcc_email");
  if (adminBcc) {
    adminBcc
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((addr) => list.push(addr));
  }
  const toLower = opts.to.toLowerCase();
  const ccLower = opts.cc?.toLowerCase();
  const seen = new Set<string>();
  return list.filter((addr) => {
    const key = addr.toLowerCase();
    if (key === toLower || key === ccLower) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function sendViaProvider(opts: SendEmailOpts): Promise<void> {
  const emailsEnabled = await storage.getSetting("feature_emails_enabled");
  if (emailsEnabled === "false") {
    console.log(`[email disabled] skipping send to ${opts.to} – ${opts.subject}`);
    return;
  }
  const provider = await getEmailProvider();
  const bccList = await buildBccList(opts);

  if (provider === "resend") {
    const creds = await getResendCredentials();
    if (!creds) throw new Error("Resend not configured");
    const resend = new Resend(creds.apiKey);
    const { error } = await resend.emails.send({
      from: `Aura Peptides <${creds.fromEmail}>`,
      to: [opts.to],
      bcc: bccList.length ? bccList : undefined,
      cc: opts.cc ? [opts.cc] : undefined,
      reply_to: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) throw new Error(error.message);
  } else {
    const creds = await getGmailCredentials();
    if (!creds) throw new Error("Gmail not configured");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: creds.user, pass: creds.pass },
    });
    await transporter.sendMail({
      from: `"Aura Peptides" <${creds.user}>`,
      to: opts.to,
      bcc: bccList.length ? bccList : undefined,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
    });
  }
}

async function isProviderConfigured(): Promise<boolean> {
  const provider = await getEmailProvider();
  if (provider === "resend") {
    const creds = await getResendCredentials();
    return !!creds;
  }
  const creds = await getGmailCredentials();
  return !!creds;
}

async function getAdminEmail(): Promise<string> {
  const stored = await storage.getSetting("admin_notify_email");
  if (stored) return stored;
  const creds = await getGmailCredentials();
  return creds?.user || "admin@aurapepts.com";
}

const ENCRYPTION_ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required for email token encryption");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptEmailToken(email: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(email, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptEmailToken(token: string): string | null {
  try {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = token.split(":");
    if (!ivHex || !encrypted) return null;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

function emailWrapper(content: string, recipientEmail?: string, showDisclaimer?: boolean): string {
  const siteUrl = getSiteUrl();
  const unsubscribeHtml = recipientEmail
    ? `<p style="margin:14px 0 0;font-size:11px;text-align:center;">
        <a href="${siteUrl}/unsubscribe?t=${encryptEmailToken(recipientEmail)}" style="color:#9D958A;text-decoration:none;border-bottom:1px solid #D9D2C2;">Unsubscribe</a>
      </p>
      <p style="margin:6px 0 0;font-size:10px;color:#B8AE9C;text-align:center;line-height:1.5;">Unsubscribing will not affect order confirmations or shipping notifications</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background-color:#F1ECE2;font-family:Helvetica,Arial,sans-serif;color:#1C1A16;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1ECE2;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FAF6EC;border:1px solid #E5DECF;border-radius:2px;">
<tr><td style="padding:40px 40px 20px;text-align:center;">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:0.18em;color:#1C1A16;font-weight:400;line-height:1;">A&nbsp;U&nbsp;R&nbsp;A</p>
<p style="margin:10px 0 0;font-size:10px;letter-spacing:0.34em;color:#6B6258;text-transform:uppercase;font-weight:600;">Peptides</p>
<div style="height:1px;width:40px;margin:20px auto 0;background-color:#C9C0AC;line-height:1;font-size:0;">&nbsp;</div>
</td></tr>
<tr><td style="padding:8px 40px 32px;">
${content}
</td></tr>
<tr><td style="padding:24px 40px 32px;border-top:1px solid #E5DECF;">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:#6B6258;text-align:center;line-height:1.5;">Refined Research Compounds.</p>
<p style="margin:14px 0 0;font-size:11px;color:#9D958A;text-align:center;letter-spacing:0.06em;">AURA&nbsp;PEPTIDES &nbsp;·&nbsp; <a href="${siteUrl}" style="color:#9D958A;text-decoration:none;">aurapepts.com</a></p>
${showDisclaimer ? `<p style="margin:16px 0 0;font-size:10px;color:#B8AE9C;text-align:center;line-height:1.6;font-style:italic;">For research use only. Not for human or veterinary use. Not intended for diagnostic or therapeutic purposes.</p>` : ""}
${unsubscribeHtml}
<p style="margin:18px 0 0;font-size:10px;color:#A8A091;text-align:center;letter-spacing:0.04em;">Powered by <a href="https://mindctrl.com" style="color:#6B6258;text-decoration:none;border-bottom:1px solid #D9D2C2;" target="_blank" rel="noopener">mindctrl.com</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function formatDollars(amount: number): string {
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

type OrderItems = Array<{ name: string; quantity: number; price: number; isShipping?: boolean }>;
type ShippingAddr = { name?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string; pickup?: boolean; location?: string } | null;

function buildOrderConfirmationHtml(email: string, order: Order): string {
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);
  const shippingItem = items.find(i => i.isShipping);
  const addr = order.shippingAddress as ShippingAddr;
  const isPickup = addr?.pickup === true;
  const productSubtotal = productItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = shippingItem?.price || 0;

  const itemsHtml = productItems.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#6B6258;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(i.price * i.quantity)}</td>
    </tr>
  `).join("");

  const addressHtml = isPickup
    ? `<p style="font-size:14px;color:#6B6258;"><strong>Pickup:</strong> ${addr?.location}</p>`
    : addr && addr.line1
      ? `<p style="font-size:14px;color:#3A332B;margin:0;font-weight:600;">${addr.name}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.city}, ${addr.state} ${addr.zip}</p>`
      : "";

  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">Order Confirmed</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6258;">Thank you for your order! Here's your receipt.</p>
    <p style="font-size:13px;color:#9D958A;margin:0 0 16px;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr style="border-bottom:2px solid #1C1A16;">
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">Item</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:center;">Qty</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:right;">Price</td>
      </tr>
      ${itemsHtml}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Subtotal</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(productSubtotal)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Shipping</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${shippingCost === 0 ? "Free" : formatDollars(shippingCost)}</td></tr>
      <tr><td style="padding:8px 0;font-size:16px;font-weight:700;color:#1C1A16;border-top:2px solid #1C1A16;">Total</td><td style="padding:8px 0;font-size:16px;font-weight:700;color:#1C1A16;text-align:right;border-top:2px solid #1C1A16;">${formatDollars(order.total)}</td></tr>
    </table>
    ${addressHtml ? `<div style="margin-top:16px;padding:12px 16px;background:#F1ECE2;border-radius:6px;"><p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">${isPickup ? "Pickup Location" : "Shipping To"}</p>${addressHtml}</div>` : ""}
  `, undefined, true);
}

export async function sendOrderConfirmationEmail(email: string, order: Order): Promise<void> {
  const subject = `Order Confirmed — #${order.id.slice(0, 8).toUpperCase()}`;
  const html = buildOrderConfirmationHtml(email, order);
  const adminEmail = await getAdminEmail();
  try {
    await sendViaProvider({ to: email, bcc: adminEmail !== email ? adminEmail : undefined, subject, html });
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Order confirmation email error:", error.message);
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

function buildAdminNewOrderHtml(order: Order): string {
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);
  const addr = order.shippingAddress as ShippingAddr;
  const isPickup = addr?.pickup === true;

  const itemsHtml = productItems.map(i =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#3A332B;">${i.quantity}x ${i.name}</td><td style="padding:6px 0;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(i.price * i.quantity)}</td></tr>`
  ).join("");

  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">New Order Received</h1>
    <p style="margin:0 0 4px;font-size:14px;color:#6B6258;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
    <p style="margin:0 0 14px;font-size:14px;color:#6B6258;">Customer: ${order.email}${order.phone ? ` | ${order.phone}` : ""}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">${itemsHtml}</table>
    <p style="font-size:18px;font-weight:700;color:#1C1A16;margin:12px 0;">Total: ${formatDollars(order.total)}</p>
    ${isPickup
      ? `<p style="font-size:14px;color:#6B6258;"><strong>Pickup:</strong> ${addr?.location}</p>`
      : addr && addr.line1
        ? `<div style="padding:12px;background:#F1ECE2;border-radius:6px;"><p style="margin:0;font-size:13px;font-weight:600;color:#1C1A16;">Ship To:</p><p style="margin:4px 0 0;font-size:14px;color:#6B6258;">${addr.name}<br>${addr.line1}${addr.line2 ? `<br>${addr.line2}` : ""}<br>${addr.city}, ${addr.state} ${addr.zip}</p></div>`
        : ""}
  `, undefined, true);
}

export async function sendAdminNewOrderEmail(order: Order): Promise<void> {
  const adminEmail = await getAdminEmail();
  const subject = `New Order #${order.id.slice(0, 8).toUpperCase()} — ${formatDollars(order.total)}`;
  const html = buildAdminNewOrderHtml(order);
  try {
    await sendViaProvider({ to: adminEmail, subject, html });
    await storage.createEmailLog({ toEmail: adminEmail, subject, templateType: "admin_new_order", orderId: order.id, status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Admin new order email error:", error.message);
    await storage.createEmailLog({ toEmail: adminEmail, subject, templateType: "admin_new_order", orderId: order.id, status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

function buildShippedHtml(email: string, order: Order, trackingNumber?: string, carrier?: string): string {
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);

  let trackingUrl = "";
  const c = (carrier || "").toLowerCase();
  let carrierLabel = "";
  if (trackingNumber) {
    if (c.includes("usps")) { trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`; carrierLabel = "USPS"; }
    else if (c.includes("ups")) { trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`; carrierLabel = "UPS"; }
    else if (c.includes("fedex")) { trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`; carrierLabel = "FedEx"; }
    else if (c.includes("dhl")) { trackingUrl = `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`; carrierLabel = "DHL"; }
  }

  const itemsList = productItems.map(i =>
    `<p style="margin:4px 0;font-size:14px;color:#6B6258;">${i.quantity}x ${i.name}</p>`
  ).join("");

  const trackingBlock = trackingNumber ? `
    <div style="padding:16px;background:#F1ECE2;border-radius:6px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">${carrierLabel ? `${carrierLabel} Tracking` : "Tracking Number"}</p>
      ${trackingUrl
        ? `<a href="${trackingUrl}" style="font-size:16px;font-weight:600;color:#1C1A16;font-family:monospace;text-decoration:underline;" target="_blank">${trackingNumber}</a>`
        : `<p style="margin:0;font-size:16px;font-weight:600;color:#1C1A16;font-family:monospace;">${trackingNumber}</p>`
      }
    </div>
    ${trackingUrl ? `<div style="text-align:center;margin-bottom:16px;"><a href="${trackingUrl}" style="display:inline-block;padding:12px 32px;background-color:#1C1A16;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Track Your Package</a></div>` : ""}
  ` : `<p style="margin:0 0 20px;font-size:14px;color:#6B6258;">Tracking information will be sent as soon as it becomes available.</p>`;

  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">Your Order Has Shipped!</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6258;">Great news — your order is on its way.</p>
    <p style="font-size:13px;color:#9D958A;margin:0 0 16px;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
    ${trackingBlock}
    <div style="border-top:1px solid #E5DECF;padding:16px 0;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">Items in Shipment</p>
      ${itemsList}
    </div>
  `, undefined, true);
}

export async function sendShippedEmail(email: string, order: Order, trackingNumber?: string, carrier?: string): Promise<void> {
  const subject = `Your Order Has Shipped — #${order.id.slice(0, 8).toUpperCase()}`;
  const html = buildShippedHtml(email, order, trackingNumber, carrier);
  try {
    await sendViaProvider({ to: email, subject, html });
    await storage.createEmailLog({ toEmail: email, subject, templateType: "shipped", orderId: order.id, trackingNumber: trackingNumber || null, status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Shipped email error:", error.message);
    await storage.createEmailLog({ toEmail: email, subject, templateType: "shipped", orderId: order.id, trackingNumber: trackingNumber || null, status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

function buildCartReminderHtml(email: string, items: any[], subtotal: number): string {
  const siteUrl = getSiteUrl();
  const itemsHtml = items.map((i: any) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;">
        <p style="margin:0;font-size:14px;font-weight:500;color:#3A332B;">${i.name}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#9D958A;">Qty: ${i.quantity}</p>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;text-align:right;font-size:14px;color:#3A332B;">${formatDollars(i.price * i.quantity)}</td>
    </tr>`
  ).join("");

  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">You Left Something Behind</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6258;">Looks like you didn't finish checking out. Your items are still waiting for you.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${itemsHtml}</table>
    <p style="font-size:16px;font-weight:700;color:#1C1A16;margin:8px 0;">Subtotal: ${formatDollars(subtotal)}</p>
    <div style="text-align:center;margin:16px 0;">
      <a href="${siteUrl}/cart" style="display:inline-block;padding:12px 32px;background-color:#1C1A16;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Complete Your Order</a>
    </div>
  `, undefined, true);
}

export async function sendCartReminderEmail(email: string, items: any[], subtotal: number): Promise<void> {
  const subject = "You left items in your cart — Aura Peptides";
  const html = buildCartReminderHtml(email, items, subtotal);
  try {
    await sendViaProvider({ to: email, subject, html });
    await storage.createEmailLog({ toEmail: email, subject, templateType: "cart_reminder", status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Cart reminder email error:", error.message);
    await storage.createEmailLog({ toEmail: email, subject, templateType: "cart_reminder", status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

function buildContactFormHtml(name: string, email: string, phone: string, message: string): string {
  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">Contact Form Submission</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6258;">A message was submitted through the Aura Peptides contact form.</p>
    <div style="padding:12px 16px;background:#F1ECE2;border-radius:6px;margin:0 0 16px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#9D958A;text-transform:uppercase;">Contact Information</p>
      <p style="margin:0 0 2px;font-size:14px;color:#3A332B;font-weight:500;">${name}</p>
      <p style="margin:0;font-size:14px;color:#6B6258;">${email}${phone ? ` &middot; ${phone}` : ""}</p>
    </div>
    <div style="padding:12px 16px;background:#F1ECE2;border-radius:6px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#9D958A;text-transform:uppercase;">Message</p>
      <p style="margin:0;font-size:14px;color:#3A332B;white-space:pre-wrap;line-height:1.5;">${message}</p>
    </div>
  `, undefined);
}

export async function sendContactFormEmail(name: string, email: string, message: string, phone?: string): Promise<void> {
  const adminEmail = await getAdminEmail();
  const subject = `Contact Form: ${name}`;
  const html = buildContactFormHtml(name, email, phone || "", message);
  try {
    await sendViaProvider({ to: adminEmail, cc: email, replyTo: email, subject, html });
    await storage.createEmailLog({ toEmail: adminEmail, subject, templateType: "contact_form", status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Contact form email error:", error.message);
    await storage.createEmailLog({ toEmail: adminEmail, subject, templateType: "contact_form", status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

export async function processAbandonedCartReminders(): Promise<void> {
  try {
    const carts = await storage.getAbandonedCartsForReminder();
    for (const cart of carts) {
      const items = cart.items as any[];
      await sendCartReminderEmail(cart.email, items, cart.subtotal);
      await storage.markAbandonedCartReminderSent(cart.id);
    }
    if (carts.length > 0) {
      console.log(`Sent ${carts.length} abandoned cart reminder(s)`);
    }
  } catch (error: any) {
    console.error("Abandoned cart reminder error:", error.message);
  }
}

export function startCartReminderInterval(): void {
  setInterval(() => {
    processAbandonedCartReminders();
  }, 15 * 60 * 1000);
  console.log("Abandoned cart reminder interval started (every 15 min)");
}

const sampleOrder: Order = {
  id: "a1b2c3d4-preview-order",
  email: "customer@example.com",
  phone: "(555) 123-4567",
  stripeSessionId: "cs_test_preview",
  status: "paid",
  items: [
    { name: "BPC-157", quantity: 2, price: 50 },
    { name: "TB-500", quantity: 1, price: 60 },
    { name: "Standard Shipping", quantity: 1, price: 10, isShipping: true },
  ],
  total: 160,
  shippingAddress: { name: "Jane Doe", line1: "123 Research Blvd", line2: "Suite 4", city: "St George", state: "UT", zip: "84790" },
  shippingMethod: "Standard Shipping",
  trackingNumber: null,
  carrier: null,
  createdAt: new Date(),
};

function buildInvoiceRequestHtml(order: Order): string {
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);
  const shippingItem = items.find(i => i.isShipping);
  const addr = order.shippingAddress as ShippingAddr;
  const isPickup = addr?.pickup === true;
  const productSubtotal = productItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = shippingItem?.price || 0;

  const itemsHtml = productItems.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#6B6258;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(i.price * i.quantity)}</td>
    </tr>
  `).join("");

  const addressHtml = isPickup
    ? `<p style="font-size:14px;color:#6B6258;"><strong>Pickup:</strong> ${addr?.location}</p>`
    : addr && addr.line1
      ? `<p style="font-size:14px;color:#3A332B;margin:0;font-weight:600;">${addr.name}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.city}, ${addr.state} ${addr.zip}</p>`
      : "";

  return emailWrapper(`
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">Order Request Received</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6258;">We've received your order and will send you an invoice shortly. Simply reply to that email to arrange payment.</p>
    <p style="font-size:13px;color:#9D958A;margin:0 0 16px;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr style="border-bottom:2px solid #1C1A16;">
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">Item</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:center;">Qty</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:right;">Price</td>
      </tr>
      ${itemsHtml}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Subtotal</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(productSubtotal)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Shipping</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${shippingCost === 0 ? "Free" : formatDollars(shippingCost)}</td></tr>
      <tr><td style="padding:8px 0;font-size:16px;font-weight:700;color:#1C1A16;border-top:2px solid #1C1A16;">Total</td><td style="padding:8px 0;font-size:16px;font-weight:700;color:#1C1A16;text-align:right;border-top:2px solid #1C1A16;">${formatDollars(order.total)}</td></tr>
    </table>
    ${addressHtml ? `<div style="margin-top:16px;padding:12px 16px;background:#F1ECE2;border-radius:6px;"><p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;">${isPickup ? "Pickup Location" : "Shipping To"}</p>${addressHtml}</div>` : ""}
  `, undefined, true);
}

function buildInvoiceHtml(order: Order): string {
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);
  const shippingItem = items.find(i => i.isShipping);
  const addr = order.shippingAddress as ShippingAddr;
  const isPickup = addr?.pickup === true;
  const productSubtotal = productItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = shippingItem?.price || 0;
  const siteUrl = getSiteUrl();

  const itemsHtml = productItems.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;">${i.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#6B6258;text-align:center;">${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E5DECF;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(i.price * i.quantity)}</td>
    </tr>
  `).join("");

  const addressHtml = isPickup
    ? `<p style="font-size:14px;color:#6B6258;margin:0;"><strong>Pickup:</strong> ${addr?.location}</p>`
    : addr && addr.line1
      ? `<p style="font-size:14px;color:#3A332B;margin:0;font-weight:600;">${addr.name}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}</p>
         <p style="font-size:14px;color:#6B6258;margin:4px 0 0;">${addr.city}, ${addr.state} ${addr.zip}</p>`
      : "";

  return emailWrapper(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;letter-spacing:0.18em;color:#1C1A16;line-height:1;">INVOICE</h1>
        <p style="margin:0;font-size:13px;color:#9D958A;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#9D958A;">Date: ${new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
    </div>
    <div style="margin-bottom:20px;padding:12px 16px;background:#F1ECE2;border-radius:6px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#1C1A16;text-transform:uppercase;letter-spacing:0.5px;">Bill To</p>
      <p style="margin:0;font-size:14px;color:#3A332B;">${order.email}</p>
      ${order.phone ? `<p style="margin:4px 0 0;font-size:14px;color:#6B6258;">${order.phone}</p>` : ""}
      ${addressHtml ? `<div style="margin-top:8px;">${addressHtml}</div>` : ""}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr style="border-bottom:2px solid #1C1A16;">
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;letter-spacing:0.5px;">Description</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:center;">Qty</td>
        <td style="padding:8px 0;font-size:12px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:right;">Amount</td>
      </tr>
      ${itemsHtml}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Subtotal</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${formatDollars(productSubtotal)}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#6B6258;">Shipping</td><td style="padding:4px 0;font-size:14px;color:#3A332B;text-align:right;">${shippingCost === 0 ? "Free" : formatDollars(shippingCost)}</td></tr>
      <tr>
        <td style="padding:10px 0;font-size:18px;font-weight:700;color:#1C1A16;border-top:2px solid #1C1A16;">Total Due</td>
        <td style="padding:10px 0;font-size:18px;font-weight:700;color:#1C1A16;text-align:right;border-top:2px solid #1C1A16;">${formatDollars(order.total)}</td>
      </tr>
    </table>
    <div style="padding:16px;background:#1C1A16;border-radius:6px;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;color:#ffffff;font-weight:600;">Ready to Pay?</p>
      <p style="margin:0;font-size:13px;color:#9D958A;">Simply reply to this email to arrange payment. We accept PayPal, Venmo, Zelle, and bank transfer.</p>
    </div>
  `, undefined, false);
}

export async function sendInvoiceRequestEmail(email: string, order: Order): Promise<void> {
  const subject = `Order Request Received — #${order.id.slice(0, 8).toUpperCase()}`;
  const html = buildInvoiceRequestHtml(order);
  try {
    await sendViaProvider({ to: email, subject, html });
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Invoice request email error:", error.message);
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "failed", errorMessage: error.message, htmlContent: html });
  }
}

export async function sendAdminInvoiceAlert(order: Order): Promise<void> {
  const adminEmail = await getAdminEmail();
  const items = order.items as OrderItems;
  const productItems = items.filter(i => !i.isShipping);
  const shippingItem = items.find(i => i.isShipping);
  const addr = order.shippingAddress as any;

  const itemsHtml = productItems.map(i =>
    `<tr>
      <td style="padding:7px 0;font-size:14px;color:#3A332B;border-bottom:1px solid #E9E2D5;">${i.quantity}× ${i.name}</td>
      <td style="padding:7px 0;font-size:14px;color:#3A332B;text-align:right;border-bottom:1px solid #E9E2D5;">${formatDollars(i.price * i.quantity)}</td>
    </tr>`
  ).join("");

  const addressBlock = addr?.pickup
    ? `<p style="margin:4px 0 0;font-size:13px;color:#6B6258;">Pickup: ${addr.location || "In-store"}</p>`
    : addr
    ? `<p style="margin:4px 0 0;font-size:13px;color:#6B6258;">${[addr.name, addr.line1, addr.line2, addr.city && addr.state ? `${addr.city}, ${addr.state} ${addr.zip}` : ""].filter(Boolean).join(" · ")}</p>`
    : "";

  const shippingRow = shippingItem
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#6B6258;">Shipping (${shippingItem.name || order.shippingMethod || ""})</td><td style="padding:4px 0;font-size:13px;color:#6B6258;text-align:right;">${formatDollars(shippingItem.price)}</td></tr>`
    : "";

  const subject = `⚡ New Invoice Request — #${order.id.slice(0, 8).toUpperCase()} · ${formatDollars(order.total)}`;
  const html = emailWrapper(`
    <div style="padding:14px 18px;background:#F4EEDF;border-left:3px solid #1C1A16;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#1C1A16;letter-spacing:0.04em;text-transform:uppercase;">Action Required</p>
      <p style="margin:4px 0 0;font-size:13px;color:#3A332B;">Create a Square invoice for this customer.</p>
    </div>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;letter-spacing:-0.005em;color:#1C1A16;line-height:1.2;">New Invoice Request</h1>
    <p style="margin:0 0 16px;font-size:13px;color:#9D958A;">Order #${order.id.slice(0, 8).toUpperCase()} · ${new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

    <div style="padding:12px 16px;background:#F1ECE2;border-radius:6px;margin-bottom:16px;">
      <p style="margin:0;font-size:11px;font-weight:600;color:#1C1A16;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
      <p style="margin:6px 0 0;font-size:14px;color:#3A332B;font-weight:600;">${order.email}</p>
      ${order.phone ? `<p style="margin:4px 0 0;font-size:13px;color:#6B6258;">${order.phone}</p>` : ""}
      ${addressBlock}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
      <tr style="border-bottom:2px solid #1C1A16;">
        <td style="padding:6px 0;font-size:11px;font-weight:600;color:#1C1A16;text-transform:uppercase;letter-spacing:0.5px;">Item</td>
        <td style="padding:6px 0;font-size:11px;font-weight:600;color:#1C1A16;text-transform:uppercase;text-align:right;">Amount</td>
      </tr>
      ${itemsHtml}
      ${shippingRow}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:10px 0;font-size:16px;font-weight:700;color:#1C1A16;border-top:2px solid #1C1A16;">Invoice Total</td>
        <td style="padding:10px 0;font-size:16px;font-weight:700;color:#1C1A16;text-align:right;border-top:2px solid #1C1A16;">${formatDollars(order.total)}</td>
      </tr>
    </table>

    <div style="padding:14px 16px;background:#1C1A16;border-radius:6px;">
      <p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-weight:600;">Next Steps</p>
      <p style="margin:0;font-size:13px;color:#9D958A;">Create a Square invoice for <strong style="color:#fff;">${order.email}</strong> for the amount above, then send them the payment link. The customer has been notified their order is pending invoice.</p>
    </div>
  `);
  try {
    await sendViaProvider({ to: adminEmail, subject, html });
  } catch (error: any) {
    console.error("Admin invoice alert error:", error.message);
  }
}

export async function sendInvoiceEmail(email: string, order: Order): Promise<void> {
  const subject = `Invoice — #${order.id.slice(0, 8).toUpperCase()} · ${formatDollars(order.total)}`;
  const html = buildInvoiceHtml(order);
  try {
    await sendViaProvider({ to: email, subject, html });
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "sent", htmlContent: html });
  } catch (error: any) {
    console.error("Invoice email error:", error.message);
    await storage.createEmailLog({ toEmail: email, subject, templateType: "order_confirmation", orderId: order.id, status: "failed", errorMessage: error.message, htmlContent: html });
    throw error;
  }
}

export function generateTemplatePreview(type: string): { subject: string; html: string } | null {
  const previewEmail = "preview@example.com";
  switch (type) {
    case "order_confirmation":
      return {
        subject: `Order Confirmed — #${sampleOrder.id.slice(0, 8).toUpperCase()}`,
        html: buildOrderConfirmationHtml(previewEmail, sampleOrder),
      };
    case "admin_new_order":
      return {
        subject: `New Order #${sampleOrder.id.slice(0, 8).toUpperCase()} — ${formatDollars(sampleOrder.total)}`,
        html: buildAdminNewOrderHtml(sampleOrder),
      };
    case "shipped":
      return {
        subject: `Your Order Has Shipped — #${sampleOrder.id.slice(0, 8).toUpperCase()}`,
        html: buildShippedHtml(previewEmail, sampleOrder, "9400111899223100001234", "usps"),
      };
    case "cart_reminder":
      return {
        subject: "You left items in your cart — Aura Peptides",
        html: buildCartReminderHtml(previewEmail, [
          { name: "BPC-157", quantity: 2, price: 50 },
          { name: "GHK-Cu", quantity: 1, price: 50 },
        ], 150),
      };
    case "contact_form":
      return {
        subject: "Contact Form: John Smith",
        html: buildContactFormHtml("John Smith", "john@example.com", "(555) 987-6543", "Hi, I'm interested in learning more about your BPC-157 and TB-500 products. Could you provide additional details on purity testing and certificates of analysis?\n\nThank you!"),
      };
    default:
      return null;
  }
}
