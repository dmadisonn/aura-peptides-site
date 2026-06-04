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

    const adminHtml = "<div style='font-family:sans-serif;background:#0e0c1a;color:#fff;padding:32px;max-width:600px;'>" +
      "<p style='color:#a78bfa;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 4px;'>Aura Peptides</p>" +
      "<h2 style='margin:0 0 24px;font-size:20px;color:#fff;'>New Invoice Request</h2>" +
      "<p><strong>Product:</strong> " + product + " " + (amount || "") + "</p>" +
      "<p><strong>Qty:</strong> " + qty + " &nbsp; <strong>Price Each:</strong> $" + parseFloat(priceEach || 0).toFixed(2) + "</p>" +
      "<p><strong>Total:</strong> <span style='color:#a78bfa;font-size:18px;'>$" + parseFloat(total || 0).toFixed(2) + "</span></p>" +
      "<hr style='border-color:#333;'/>" +
      "<p><strong>Name:</strong> " + name + "</p>" +
      "<p><strong>Email:</strong> " + email + "</p>" +
      "<p><strong>Org:</strong> " + (org || "—") + "</p>" +
      (notes ? "<p><strong>Notes:</strong> " + notes + "</p>" : "") +
      "<p style='color:#888;font-size:11px;margin-top:24px;'>Reply directly to " + email + " to send their invoice.</p>" +
      "</div>";

    const customerHtml = "<div style='font-family:sans-serif;background:#0e0c1a;color:#fff;padding:32px;max-width:600px;'>" +
      "<p style='color:#a78bfa;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 4px;'>Aura Peptides</p>" +
      "<h2 style='margin:0 0 24px;font-size:20px;color:#fff;'>Invoice Request Received</h2>" +
      "<p style='color:#ccc;'>Hi " + name + ",</p>" +
      "<p style='color:#ccc;'>We received your request for <strong style='color:#fff;'>" + product + " " + (amount || "") + " (qty: " + qty + ")</strong>.</p>" +
      "<p style='color:#ccc;'>A formal invoice for <strong style='color:#a78bfa;'>$" + parseFloat(total || 0).toFixed(2) + "</strong> will be sent to this email within 24 hours.</p>" +
      "<p style='color:#555;font-size:10px;margin-top:24px;text-transform:uppercase;letter-spacing:0.1em;'>All products are for laboratory research use only. Not for human or animal consumption.</p>" +
      "</div>";

    await sendEmail({ to: ADMIN_EMAIL, subject: "New Invoice Request — " + product, html: adminHtml });
    await sendEmail({ to: email, subject: "Invoice Request Received — " + product, html: customerHtml });

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
