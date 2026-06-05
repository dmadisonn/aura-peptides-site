const express = require("express");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const session = require("express-session");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
let pool = null;
let PgSessionStore = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    PgSessionStore = require("connect-pg-simple")(session);
  }
} catch(e) { console.warn("DB pool init failed:", e.message); }


// Convert snake_case DB rows to camelCase for frontend
function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v
    ])
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || "aura-peptides-secret-2024",
  resave: false,
  saveUninitialized: false,
  ...(PgSessionStore && pool ? {
    store: new PgSessionStore({ pool, tableName: "session", createTableIfMissing: true })
  } : {}),
  cookie: { secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 }
}));

function q(sql, params) {
  if (!pool) return Promise.resolve([]);
  return pool.query(sql, params).then(r => r.rows);
}

// ── Email (Resend) ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn("RESEND_API_KEY not set"); return false; }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Aura Peptides <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      })
    });
    const data = await resp.json();
    if (!resp.ok) { console.error("Resend error:", JSON.stringify(data)); return false; }
    console.log("Email sent:", data.id);
    return true;
  } catch (e) { console.error("Email send error:", e); return false; }
}

// ── PDF Invoice Generator ────────────────────────────────────────────────────
function generateInvoicePDF({ invoiceNumber, date, product, amount, qty, priceEach, total, name, email, org, brand }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isAura = brand === "aura";
    // Aura: warm brown/cream palette | Blackwater: dark gold palette
    const BG        = isAura ? "#f7f3ee" : "#0d0b08";
    const ACCENT    = isAura ? "#8b5e3c" : "#d4af37";
    const TEXT_DARK = isAura ? "#2c1a0e" : "#e5e0d8";
    const TEXT_MID  = isAura ? "#6b4a32" : "#aaa";
    const RULE      = isAura ? "#d4b896" : "#2a2218";
    const BRAND_LABEL = isAura ? "Aura Peptides" : "Blackwater Bio Peptides";
    const LEGAL_LINE  = isAura ? "Aura Health LLC · DBA Aura Peptides" : "Aura Health LLC · DBA Blackwater Bio Peptides";
    const ADDRESS     = "6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446  ·  (629) 332-5351";

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BG);

    // Accent bar top
    doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);

    let y = 40;

    // Brand name
    doc.fontSize(9).fillColor(ACCENT).font("Helvetica")
      .text(BRAND_LABEL.toUpperCase(), 50, y, { characterSpacing: 3 });
    y += 16;

    doc.fontSize(22).fillColor(TEXT_DARK).font("Helvetica-Bold")
      .text("INVOICE", 50, y);

    // Invoice meta (right side)
    const metaX = 350;
    doc.fontSize(9).fillColor(TEXT_MID).font("Helvetica")
      .text("Invoice No.", metaX, y)
      .text("Date", metaX, y + 16)
      .text("Due", metaX, y + 32);
    doc.fontSize(9).fillColor(TEXT_DARK).font("Helvetica-Bold")
      .text(invoiceNumber, metaX + 80, y, { align: "left" })
      .text(date, metaX + 80, y + 16)
      .text("Upon receipt", metaX + 80, y + 32);

    y += 60;

    // Divider
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 20;

    // Bill To
    doc.fontSize(8).fillColor(ACCENT).font("Helvetica")
      .text("BILL TO", 50, y, { characterSpacing: 2 });
    y += 14;
    doc.fontSize(11).fillColor(TEXT_DARK).font("Helvetica-Bold").text(name, 50, y);
    y += 15;
    doc.fontSize(10).fillColor(TEXT_MID).font("Helvetica").text(email, 50, y);
    if (org) { y += 14; doc.text(org, 50, y); }
    y += 30;

    // Divider
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 16;

    // Table header
    doc.rect(50, y, doc.page.width - 100, 24).fill(ACCENT);
    doc.fontSize(9).fillColor(isAura ? "#fff" : "#0d0b08").font("Helvetica-Bold")
      .text("PRODUCT / DESCRIPTION", 60, y + 7)
      .text("QTY", 360, y + 7, { width: 50, align: "right" })
      .text("UNIT PRICE", 415, y + 7, { width: 70, align: "right" })
      .text("AMOUNT", 490, y + 7, { width: 65, align: "right" });
    y += 36;

    // Table row
    const rowH = 32;
    doc.rect(50, y - 4, doc.page.width - 100, rowH).fill(isAura ? "#f0e8df" : "#1a1510");
    const productLabel = amount ? `\${product} · \${amount}` : product;
    doc.fontSize(10).fillColor(TEXT_DARK).font("Helvetica-Bold").text(productLabel, 60, y + 4, { width: 290 });
    doc.fontSize(10).fillColor(TEXT_MID).font("Helvetica")
      .text(String(qty), 360, y + 4, { width: 50, align: "right" })
      .text("$" + parseFloat(priceEach||0).toFixed(2), 415, y + 4, { width: 70, align: "right" });
    doc.fontSize(10).fillColor(TEXT_DARK).font("Helvetica-Bold")
      .text("$" + parseFloat(total||0).toFixed(2), 490, y + 4, { width: 65, align: "right" });
    y += rowH + 16;

    // Totals block
    const totalsX = 390;
    doc.moveTo(totalsX, y).lineTo(doc.page.width - 50, y).strokeColor(RULE).lineWidth(0.5).stroke();
    y += 10;
    doc.fontSize(10).fillColor(TEXT_MID).font("Helvetica").text("Subtotal", totalsX, y);
    doc.fontSize(10).fillColor(TEXT_DARK).font("Helvetica").text("$" + parseFloat(total||0).toFixed(2), totalsX + 90, y, { width: 75, align: "right" });
    y += 16;
    doc.fontSize(10).fillColor(TEXT_MID).font("Helvetica").text("Shipping", totalsX, y);
    doc.fontSize(10).fillColor(TEXT_DARK).font("Helvetica").text("Included", totalsX + 90, y, { width: 75, align: "right" });
    y += 16;
    doc.moveTo(totalsX, y).lineTo(doc.page.width - 50, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 10;
    doc.fontSize(13).fillColor(ACCENT).font("Helvetica-Bold").text("TOTAL DUE", totalsX, y);
    doc.fontSize(14).fillColor(TEXT_DARK).font("Helvetica-Bold")
      .text("$" + parseFloat(total||0).toFixed(2), totalsX + 90, y - 1, { width: 75, align: "right" });
    y += 40;

    // Payment instructions
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 16;
    doc.fontSize(8).fillColor(ACCENT).font("Helvetica").text("PAYMENT INSTRUCTIONS", 50, y, { characterSpacing: 2 });
    y += 14;
    doc.fontSize(9).fillColor(TEXT_MID).font("Helvetica")
      .text("Payment is due upon receipt of this invoice. Please reference invoice number " + invoiceNumber + " in your payment.", 50, y, { width: doc.page.width - 100 });
    y += 30;

    // Research disclaimer
    doc.rect(50, y, doc.page.width - 100, 36).fill(isAura ? "#ede3d8" : "#1a1510");
    doc.fontSize(7.5).fillColor(TEXT_MID).font("Helvetica")
      .text("FOR LABORATORY RESEARCH USE ONLY · NOT FOR HUMAN OR ANIMAL CONSUMPTION · NOT INTENDED TO DIAGNOSE, TREAT, CURE, OR PREVENT ANY DISEASE", 60, y + 6, { width: doc.page.width - 120, align: "center" })
      .text("All sales are final for research compounds. By purchasing, buyer certifies they are a qualified researcher aged 18+.", 60, y + 19, { width: doc.page.width - 120, align: "center" });
    y += 50;

    // Footer
    doc.fontSize(8).fillColor(TEXT_MID).font("Helvetica")
      .text(LEGAL_LINE, 50, y, { align: "center", width: doc.page.width - 100 });
    doc.fontSize(7.5).fillColor(RULE).font("Helvetica")
      .text(ADDRESS, 50, y + 12, { align: "center", width: doc.page.width - 100 });

    // Bottom accent bar
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(ACCENT);

    doc.end();
  });
}

// ── Aura Email Templates (Brown/Cream palette) ────────────────────────────────
function buildAuraAdminInvoiceEmail({ product, amount, qty, priceEach, total, name, email, org, notes }) {
  const notesRow = notes
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#8b7355;width:120px;">Notes</td><td style="padding:6px 0;font-size:13px;color:#3d2a1a;">${notes}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ede3d8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede3d8;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#faf7f4;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(80,40,10,0.10);">
      <tr><td style="background:#2c1a0e;padding:32px 40px;text-align:center;border-bottom:3px solid #8b5e3c;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#c9956a;">Aura Peptides</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#faf7f4;">New Invoice Request</h1>
        <p style="margin:8px 0 0;font-size:12px;color:#8b7355;">Review and reply with a formal invoice</p>
      </td></tr>
      <tr><td style="padding:32px 40px 0;">
        <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8b5e3c;font-weight:600;">Order Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ddd0c0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f0e8df;">
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#3d2a1a;border-bottom:1px solid #ddd0c0;">Product</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#3d2a1a;border-bottom:1px solid #ddd0c0;text-align:right;">Qty</td>
          </tr>
          <tr>
            <td style="padding:14px 16px;font-size:14px;color:#2c1a0e;font-weight:500;">${product} &middot; ${amount || ""}</td>
            <td style="padding:14px 16px;font-size:14px;color:#2c1a0e;text-align:right;">${qty}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:13px;color:#8b7355;">Price per unit</td><td style="padding:6px 0;font-size:13px;color:#3d2a1a;text-align:right;">$${parseFloat(priceEach||0).toFixed(2)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#8b7355;">Quantity</td><td style="padding:6px 0;font-size:13px;color:#3d2a1a;text-align:right;">${qty}</td></tr>
          <tr><td colspan="2" style="padding:8px 0;"><hr style="border:none;border-top:1px solid #ddd0c0;margin:0;"/></td></tr>
          <tr><td style="padding:8px 0;font-size:16px;font-weight:700;color:#3d2a1a;">Total Due</td><td style="padding:8px 0;font-size:20px;font-weight:700;color:#8b5e3c;text-align:right;">$${parseFloat(total||0).toFixed(2)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px 0;"><hr style="border:none;border-top:2px solid #ddd0c0;"/></td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8b5e3c;font-weight:600;">Customer Details</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:13px;color:#8b7355;width:120px;">Name</td><td style="padding:6px 0;font-size:13px;color:#3d2a1a;font-weight:500;">${name}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#8b7355;">Email</td><td style="padding:6px 0;font-size:13px;"><a href="mailto:${email}" style="color:#8b5e3c;text-decoration:none;">${email}</a></td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#8b7355;">Organization</td><td style="padding:6px 0;font-size:13px;color:#3d2a1a;">${org || "—"}</td></tr>
          ${notesRow}
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px;">
        <div style="background:#f0e8df;border:1px solid #ddd0c0;border-radius:8px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#6b4a32;line-height:1.6;">Reply directly to <a href="mailto:${email}" style="color:#8b5e3c;font-weight:600;">${email}</a> to send their formal invoice. A PDF is attached for your reference.</p>
        </div>
      </td></tr>
      <tr><td style="background:#f0e8df;border-top:1px solid #ddd0c0;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#8b7355;">Aura Health LLC &middot; DBA Aura Peptides</p>
        <p style="margin:4px 0 0;font-size:11px;color:#a89070;">6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446 &middot; (629) 332-5351</p>
        <p style="margin:4px 0 0;font-size:10px;color:#c0a882;">For laboratory research use only. Not for human or animal consumption.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildAuraCustomerInvoiceEmail({ product, amount, qty, priceEach, total, name, email }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ede3d8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede3d8;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#faf7f4;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(80,40,10,0.10);">
      <tr><td style="background:#2c1a0e;padding:32px 40px;text-align:center;border-bottom:3px solid #8b5e3c;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#c9956a;">Aura Peptides</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#faf7f4;">Invoice Request Received</h1>
        <p style="margin:8px 0 0;font-size:12px;color:#8b7355;">We'll be in touch within 24 hours</p>
      </td></tr>
      <tr><td style="padding:32px 40px 0;">
        <p style="margin:0;font-size:15px;color:#2c1a0e;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="margin:12px 0 0;font-size:14px;color:#6b4a32;line-height:1.7;">We've received your invoice request. Within <strong style="color:#2c1a0e;">24 hours</strong>, a member of our team will contact you by phone at <a href="tel:+16293325351" style="color:#8b5e3c;">(629) 332-5351</a> or by email at <a href="mailto:support@aurapepts.bio" style="color:#8b5e3c;">support@aurapepts.bio</a> with your formal invoice.</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <div style="border:1px solid #ddd0c0;border-radius:10px;overflow:hidden;">
          <div style="background:#f0e8df;padding:14px 20px;border-bottom:1px solid #ddd0c0;">
            <p style="margin:0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8b5e3c;font-weight:600;">Order Summary</p>
          </div>
          <div style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;font-size:13px;color:#8b7355;width:140px;">Product</td><td style="padding:5px 0;font-size:13px;color:#2c1a0e;font-weight:600;">${product} &middot; ${amount || ""}</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#8b7355;">Quantity</td><td style="padding:5px 0;font-size:13px;color:#3d2a1a;">${qty}</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#8b7355;">Price Each</td><td style="padding:5px 0;font-size:13px;color:#3d2a1a;">$${parseFloat(priceEach||0).toFixed(2)}</td></tr>
              <tr><td colspan="2" style="padding:10px 0 6px;"><hr style="border:none;border-top:1px solid #ddd0c0;margin:0;"/></td></tr>
              <tr><td style="padding:6px 0;font-size:14px;font-weight:700;color:#2c1a0e;">Total</td><td style="padding:6px 0;font-size:18px;font-weight:700;color:#8b5e3c;">$${parseFloat(total||0).toFixed(2)}</td></tr>
            </table>
          </div>
        </div>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8b5e3c;font-weight:600;">What Happens Next</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#8b5e3c;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#faf7f4;">1</div></td>
            <td style="padding:0 0 12px 10px;font-size:13px;color:#6b4a32;line-height:1.5;">We review your request and prepare a formal invoice PDF.</td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#8b5e3c;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#faf7f4;">2</div></td>
            <td style="padding:0 0 12px 10px;font-size:13px;color:#6b4a32;line-height:1.5;">We contact you at <strong style="color:#2c1a0e;">${email}</strong> or <strong style="color:#2c1a0e;">(629) 332-5351</strong> within 24 hours with your invoice.</td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#8b5e3c;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#faf7f4;">3</div></td>
            <td style="padding:0 0 0 10px;font-size:13px;color:#6b4a32;line-height:1.5;">Order ships after payment confirmation.</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 40px 32px;">
        <p style="margin:0;font-size:13px;color:#8b7355;line-height:1.6;">Questions? Reach us at <a href="mailto:support@aurapepts.bio" style="color:#8b5e3c;">support@aurapepts.bio</a> or <a href="tel:+16293325351" style="color:#8b5e3c;">(629) 332-5351</a>.</p>
      </td></tr>
      <tr><td style="background:#f0e8df;border-top:1px solid #ddd0c0;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#8b7355;">Aura Health LLC &middot; DBA Aura Peptides</p>
        <p style="margin:4px 0 0;font-size:11px;color:#a89070;">6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446</p>
        <p style="margin:8px 0 0;font-size:10px;color:#c0a882;text-transform:uppercase;letter-spacing:0.1em;">For laboratory research use only. Not for human or animal consumption.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Invoice Request ────────────────────────────────────────────────────────────
app.post("/api/invoice-request", async (req, res) => {
  try {
    const { name, email, org, notes, product, amount, qty, priceEach, total } = req.body;
    const ADMIN_EMAIL = "darcimadisonllc@icloud.com";

    // Store in DB if available
    try {
      await q(
        "INSERT INTO orders (id,order_number,customer_email,customer_name,items,subtotal,shipping_cost,tax,total,status,payment_method,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,0,0,$6,'pending','invoice',NOW(),NOW())",
        [crypto.randomUUID(), "INV-" + Date.now(), email, name, JSON.stringify([{ name: product, amount, qty, price: priceEach }]), parseFloat(total)]
      );
    } catch (dbErr) { console.warn("DB insert skipped:", dbErr.message); }

    // Generate PDF invoice
    const invoiceNumber = "AUR-" + Date.now().toString().slice(-6);
    const invoiceDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const pdfBuffer = await generateInvoicePDF({ invoiceNumber, date: invoiceDate, product, amount, qty, priceEach, total, name, email, org, brand: "aura" });
    const pdfBase64 = pdfBuffer.toString("base64");

    const adminHtml = buildAuraAdminInvoiceEmail({ product, amount, qty, priceEach, total, name, email, org, notes });
    const customerHtml = buildAuraCustomerInvoiceEmail({ product, amount, qty, priceEach, total, name, email });

    const attachment = { filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBase64 };

    // Admin gets PDF attached (ready to forward)
    const RESEND_KEY = process.env.RESEND_API_KEY;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Aura Peptides <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `📋 Invoice Request — ${product} (${amount || ""}) · ${invoiceNumber}`,
        html: adminHtml,
        attachments: [attachment]
      })
    });
    // Customer gets confirmation (no PDF yet — they get it when you send)
    await sendEmail({ to: email, subject: `Invoice Request Received — Aura Peptides`, html: customerHtml });

    res.json({ success: true, message: "Invoice request submitted. You will receive a confirmation email shortly." });
  } catch (err) {
    console.error("Invoice request error:", err);
    res.status(500).json({ error: "Failed to process invoice request" });
  }
});

// ── Admin Auth (token-based for stateless Vercel) ─────────────────────────────
const ADMIN_TOKEN = "aura-admin-token-2024-darci";

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USERNAME || "darcimadison";
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "darci22";
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  res.json({ success: true });
});

app.get("/api/admin/check", (req, res) => {
  const token = req.headers["x-admin-token"] || req.query.token;
  res.json({ authenticated: token === ADMIN_TOKEN });
});

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Products ───────────────────────────────────────────────────────────────────
app.get("/api/products", async (req, res) => {
  try {
    const rows = await q("SELECT * FROM products WHERE published = true ORDER BY name");
    res.json(rows.map(toCamel));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const [p] = await q("SELECT * FROM products WHERE slug = $1", [req.params.slug]);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(toCamel(p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Products ─────────────────────────────────────────────────────────────
app.get("/api/admin/products", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try { res.json((await q("SELECT * FROM products ORDER BY created_at DESC")).map(toCamel)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/admin/products/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    const fields = Object.keys(req.body);
    const vals = [...Object.values(req.body), req.params.id];
    const sets = fields.map((f, i) => f + "=$" + (i + 1)).join(", ");
    const [p] = await q("UPDATE products SET " + sets + ", updated_at=NOW() WHERE id=$" + vals.length + " RETURNING *", vals);
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/products/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try { await q("DELETE FROM products WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Orders ───────────────────────────────────────────────────────────────
app.get("/api/admin/orders", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try { res.json(await q("SELECT * FROM orders ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/admin/orders/:id/status", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [o] = await q("UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [req.body.status, req.params.id]);
    res.json(o);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings ───────────────────────────────────────────────────────────────────
// ── Settings PATCH endpoints ───────────────────────────────────────────────────
app.patch("/api/admin/settings/free-shipping-threshold", async (req, res) => {
  const tok = req.headers["x-admin-token"] || req.query.token;
  if (tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { threshold } = req.body;
    const val = parseInt(threshold) || 0;
    const existing = await q("SELECT COUNT(*) FROM site_settings");
    if (parseInt(existing[0].count) === 0) {
      await q("INSERT INTO site_settings (free_shipping_threshold) VALUES ($1)", [val]);
    } else {
      await q("UPDATE site_settings SET free_shipping_threshold = $1", [val]);
    }
    res.json({ success: true, threshold: val });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings/free-shipping-threshold", async (req, res) => {
  try {
    const [s] = await q("SELECT free_shipping_threshold FROM site_settings LIMIT 1");
    res.json({ threshold: s ? s.free_shipping_threshold : 100 });
  } catch (e) { res.json({ threshold: 100 }); }
});

app.get("/api/settings/affiliate-banner", async (req, res) => {
  try {
    const [s] = await q("SELECT affiliate_banner_enabled FROM site_settings LIMIT 1");
    res.json({ enabled: s ? s.affiliate_banner_enabled : false });
  } catch (e) { res.json({ enabled: false }); }
});

// ── COAs ───────────────────────────────────────────────────────────────────────
app.get("/api/coas", async (req, res) => {
  try { res.json(await q("SELECT * FROM certificates ORDER BY created_at DESC")); }
  catch (e) { res.json([]); }
});

app.get("/api/certificates", async (req, res) => {
  try {
    const rows = await q("SELECT * FROM certificates ORDER BY created_at DESC");
    const mapped = rows.map(r => ({
      id: r.id,
      productId: r.product_id || null,
      productName: r.product_name || "",
      batchNumber: r.batch_number || "",
      purity: r.purity || null,
      testedBy: r.tested_by || null,
      testDate: r.test_date || null,
      fileUrl: r.file_url || null,
      fileType: r.file_type || null,
      title: r.title || null,
      thumbnailUrl: r.thumbnail_url || null,
      notes: r.notes || null,
      createdAt: r.created_at || null,
    }));
    res.json(mapped);
  }
  catch (e) { res.json([]); }
});

// ── Image Upload ──────────────────────────────────────────────────────────────
app.post("/api/admin/upload", (req, res, next) => {
  const tok = req.headers["x-admin-token"] || req.query.token;
  if (tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/jpg"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Only PNG, JPG, WEBP, and GIF images are allowed" });
  }
  const base64 = req.file.buffer.toString("base64");
  const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
  res.json({ imageUrl: dataUrl });
});

app.post("/api/admin/certificates", upload.single("file"), async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { title } = req.body;
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    const id = crypto.randomUUID();
    const name = title || req.file.originalname.replace(/\.[^/.]+$/, "");
    await q(
      `INSERT INTO certificates (id, product_name, batch_number, title, file_url, file_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, name, "N/A", name, dataUrl, req.file.mimetype]
    );
    const [cert] = await q("SELECT * FROM certificates WHERE id = $1", [id]);
    res.json(cert);
  } catch (e) {
    console.error("Certificate upload error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/admin/certificates/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    await q("DELETE FROM certificates WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/admin/certificates/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { title } = req.body;
    await q("UPDATE certificates SET title = $1, product_name = $1 WHERE id = $2", [title, req.params.id]);
    const [cert] = await q("SELECT * FROM certificates WHERE id = $1", [req.params.id]);
    res.json(cert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── Admin Session (for login page check) ──────────────────────────────────────
app.get("/api/admin/session", (req, res) => {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token === ADMIN_TOKEN) {
    res.json({ user: { username: process.env.ADMIN_USERNAME || "darcimadison", isSuperAdmin: true, permissions: { tabs: [], settingsSections: [] } } });
  } else {
    res.status(401).json({ user: null });
  }
});


// ── Affiliates ─────────────────────────────────────────────────────────────────
app.get("/api/admin/affiliates", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    // Ensure table exists
    await q(`CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      commission_rate INTEGER DEFAULT 10,
      referral_discount INTEGER DEFAULT 10,
      approved BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    const rows = await q("SELECT * FROM affiliates ORDER BY created_at DESC");
    // Return with stats (empty for now)
    const result = rows.map(a => ({
      ...a,
      commissionRate: a.commission_rate,
      referralDiscount: a.referral_discount,
      createdAt: a.created_at,
      stats: { totalReferrals: 0, totalRevenue: 0, totalEarnings: 0, unpaidEarnings: 0, paidEarnings: 0 }
    }));
    res.json(result);
  } catch (e) { console.error(e); res.json([]); }
});

app.post("/api/admin/affiliates", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    await q(`CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      commission_rate INTEGER DEFAULT 10,
      referral_discount INTEGER DEFAULT 10,
      approved BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    const { name, email, code, commissionRate, referralDiscount, approved } = req.body;
    if (!name || !email || !code) return res.status(400).json({ error: "Name, email, and code are required" });
    const id = crypto.randomUUID();
    const [row] = await q(
      `INSERT INTO affiliates (id, name, email, code, commission_rate, referral_discount, approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, name, email, code.toUpperCase(), commissionRate ?? 10, referralDiscount ?? 10, approved ?? true]
    );
    res.json({ ...row, commissionRate: row.commission_rate, referralDiscount: row.referral_discount, stats: { totalReferrals: 0, totalRevenue: 0, totalEarnings: 0, unpaidEarnings: 0, paidEarnings: 0 } });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: "That referral code is already taken" });
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/admin/affiliates/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { name, email, code, commissionRate, referralDiscount, approved } = req.body;
    const [row] = await q(
      `UPDATE affiliates SET name=$1, email=$2, code=$3, commission_rate=$4, referral_discount=$5, approved=$6 WHERE id=$7 RETURNING *`,
      [name, email, code.toUpperCase(), commissionRate ?? 10, referralDiscount ?? 10, approved ?? true, req.params.id]
    );
    res.json({ ...row, commissionRate: row.commission_rate, referralDiscount: row.referral_discount, stats: { totalReferrals: 0, totalRevenue: 0, totalEarnings: 0, unpaidEarnings: 0, paidEarnings: 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/affiliates/:id", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try {
    await q("DELETE FROM affiliates WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/affiliates/:id/pay", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  res.json({ count: 0 });
});

app.post("/api/admin/affiliates/:id/unpay", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token;
  if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  res.json({ count: 0 });
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: !!pool, timestamp: new Date().toISOString() });
});

module.exports = app;
// Thu Jun  4 22:42:37 UTC 2026
