const express = require("express");
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

function buildAuraAdminInvoiceEmail({ product, amount, qty, priceEach, total, name, email, org, notes }) {
  const notesRow = notes
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Notes</td><td style="padding:6px 0;font-size:13px;color:#333;">${notes}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f3f0;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d0d0d;padding:32px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a78bfa;">Aura Peptides</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">New Invoice Request</h1>
        <p style="margin:8px 0 0;font-size:12px;color:#666;">Review and reply with a formal invoice</p>
      </td></tr>
      <tr><td style="padding:32px 40px 0;">
        <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#a78bfa;font-weight:600;">Order Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9f8ff;">
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#333;border-bottom:1px solid #eee;">Product</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#333;border-bottom:1px solid #eee;text-align:right;">Qty</td>
          </tr>
          <tr>
            <td style="padding:14px 16px;font-size:14px;color:#222;font-weight:500;">${product} &middot; ${amount || ""}</td>
            <td style="padding:14px 16px;font-size:14px;color:#222;text-align:right;">${qty}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:13px;color:#666;">Price per unit</td><td style="padding:6px 0;font-size:13px;color:#333;text-align:right;">$${parseFloat(priceEach||0).toFixed(2)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#666;">Quantity</td><td style="padding:6px 0;font-size:13px;color:#333;text-align:right;">${qty}</td></tr>
          <tr><td colspan="2" style="padding:8px 0;"><hr style="border:none;border-top:1px solid #eee;margin:0;"/></td></tr>
          <tr><td style="padding:8px 0;font-size:16px;font-weight:700;color:#333;">Total Due</td><td style="padding:8px 0;font-size:20px;font-weight:700;color:#7c3aed;text-align:right;">$${parseFloat(total||0).toFixed(2)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px 0;"><hr style="border:none;border-top:2px solid #f0f0f0;"/></td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#a78bfa;font-weight:600;">Customer Details</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Name</td><td style="padding:6px 0;font-size:13px;color:#333;font-weight:500;">${name}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#888;">Email</td><td style="padding:6px 0;font-size:13px;"><a href="mailto:${email}" style="color:#7c3aed;text-decoration:none;">${email}</a></td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#888;">Organization</td><td style="padding:6px 0;font-size:13px;color:#333;">${org || "—"}</td></tr>
          ${notesRow}
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px;">
        <div style="background:#f9f8ff;border:1px solid #e8e0ff;border-radius:8px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">Reply directly to <a href="mailto:${email}" style="color:#7c3aed;font-weight:600;">${email}</a> to send their formal invoice.</p>
        </div>
      </td></tr>
      <tr><td style="background:#f9f8ff;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#aaa;">Aura Health LLC &middot; DBA Aura Peptides</p>
        <p style="margin:4px 0 0;font-size:11px;color:#bbb;">6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446 &middot; (629) 332-5351</p>
        <p style="margin:4px 0 0;font-size:10px;color:#ccc;">For laboratory research use only. Not for human or animal consumption.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildAuraCustomerInvoiceEmail({ product, amount, qty, priceEach, total, name, email }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f3f0;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d0d0d;padding:32px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a78bfa;">Aura Peptides</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Invoice Request Received</h1>
        <p style="margin:8px 0 0;font-size:12px;color:#777;">We'll be in touch within 24 hours</p>
      </td></tr>
      <tr><td style="padding:32px 40px 0;">
        <p style="margin:0;font-size:15px;color:#333;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="margin:12px 0 0;font-size:14px;color:#555;line-height:1.7;">We've received your invoice request. A formal invoice will be sent to this address within <strong>24 hours</strong>.</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <div style="border:1px solid #e8e0ff;border-radius:10px;overflow:hidden;">
          <div style="background:#f9f8ff;padding:14px 20px;border-bottom:1px solid #e8e0ff;">
            <p style="margin:0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#a78bfa;font-weight:600;">Order Summary</p>
          </div>
          <div style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;font-size:13px;color:#888;width:140px;">Product</td><td style="padding:5px 0;font-size:13px;color:#333;font-weight:600;">${product} &middot; ${amount || ""}</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#888;">Quantity</td><td style="padding:5px 0;font-size:13px;color:#333;">${qty}</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#888;">Price Each</td><td style="padding:5px 0;font-size:13px;color:#333;">$${parseFloat(priceEach||0).toFixed(2)}</td></tr>
              <tr><td colspan="2" style="padding:10px 0 6px;"><hr style="border:none;border-top:1px solid #eee;margin:0;"/></td></tr>
              <tr><td style="padding:6px 0;font-size:14px;font-weight:700;color:#333;">Total</td><td style="padding:6px 0;font-size:18px;font-weight:700;color:#7c3aed;">$${parseFloat(total||0).toFixed(2)}</td></tr>
            </table>
          </div>
        </div>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#a78bfa;font-weight:600;">What Happens Next</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#7c3aed;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#fff;">1</div></td>
            <td style="padding:0 0 12px 10px;font-size:13px;color:#555;line-height:1.5;">We review your request and prepare a formal invoice.</td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#7c3aed;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#fff;">2</div></td>
            <td style="padding:0 0 12px 10px;font-size:13px;color:#555;line-height:1.5;">Invoice sent to <strong>${email}</strong> within 24 hours.</td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;"><div style="width:20px;height:20px;border-radius:50%;background:#7c3aed;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#fff;">3</div></td>
            <td style="padding:0 0 0 10px;font-size:13px;color:#555;line-height:1.5;">Order ships after payment confirmation.</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 40px 32px;">
        <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">Questions? Reply to this email or reach us at <a href="mailto:support@aurapepts.bio" style="color:#7c3aed;">support@aurapepts.bio</a> or <a href="tel:+16293325351" style="color:#7c3aed;">(629) 332-5351</a>.</p>
      </td></tr>
      <tr><td style="background:#f9f8ff;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#aaa;">Aura Health LLC &middot; DBA Aura Peptides</p>
        <p style="margin:4px 0 0;font-size:11px;color:#bbb;">6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446</p>
        <p style="margin:8px 0 0;font-size:10px;color:#ccc;text-transform:uppercase;letter-spacing:0.1em;">For laboratory research use only. Not for human or animal consumption.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Contact Form ──────────────────────────────────────────────────────────────
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, order, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: "Name, email, and message are required." });

    // Send notification to admin
    await sendEmail({
      to: "darcimadisonllc@icloud.com",
      subject: `📬 Contact Form: ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin-bottom:16px;">New Contact Form Submission</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px;font-weight:bold;color:#555;width:130px;">Name</td><td style="padding:8px;">${name}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">Order #</td><td style="padding:8px;">${order || "N/A"}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;color:#555;vertical-align:top;">Message</td><td style="padding:8px;white-space:pre-wrap;">${message}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#999;">Sent from aurapepts.bio contact form</p>
        </div>
      `
    });

    // Send confirmation to customer
    await sendEmail({
      to: email,
      subject: "We received your message — Aura Peptides",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">Thanks for reaching out, ${name}!</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;">We've received your message and will get back to you within 1–2 business days.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0;font-size:14px;color:#444;">
            <strong>Your message:</strong><br/><br/>
            <span style="white-space:pre-wrap;">${message}</span>
          </div>
          <p style="color:#555;font-size:13px;">— Aura Health LLC / Aura Peptides<br/>support@aurapepts.bio | (629) 332-5351</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
          <p style="font-size:11px;color:#aaa;">All products are for laboratory research use only. Not for human consumption.</p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

    const adminHtml = buildAuraAdminInvoiceEmail({ product, amount, qty, priceEach, total, name, email, org, notes });
    const customerHtml = buildAuraCustomerInvoiceEmail({ product, amount, qty, priceEach, total, name, email });

    await sendEmail({ to: ADMIN_EMAIL, subject: `📋 New Invoice Request — ${product} (${amount || ""})`, html: adminHtml });
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
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const [p] = await q("SELECT * FROM products WHERE slug = $1", [req.params.slug]);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Products ─────────────────────────────────────────────────────────────
app.get("/api/admin/products", async (req, res) => {
  const _tok = req.headers["x-admin-token"] || req.query.token; if (_tok !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  try { res.json(await q("SELECT * FROM products ORDER BY created_at DESC")); }
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
